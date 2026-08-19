package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GatewayService maneja el envio de notificaciones por multiples canales
type GatewayService struct {
	Pool *pgxpool.Pool
}

// NewGatewayService crea un nuevo servicio de pasarelas
func NewGatewayService(pool *pgxpool.Pool) *GatewayService {
	return &GatewayService{Pool: pool}
}

// DeliverInBackground envia la notificacion por los canales configurados en una goroutine
func (g *GatewayService) DeliverInBackground(nodeDomain string, userID uuid.UUID, notifID uuid.UUID, notifType, title, message, link string) {
	go g.deliver(nodeDomain, userID, notifID, notifType, title, message, link)
}

// deliver envia la notificacion por todos los canales activos configurados
func (g *GatewayService) deliver(nodeDomain string, userID uuid.UUID, notifID uuid.UUID, notifType, title, message, link string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Obtener canales activos para este nodo
	rows, err := g.Pool.Query(ctx, `
		SELECT channel_code, config FROM notification_gateway_config
		WHERE node_domain = $1 AND is_active = true`, nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()

	type gateway struct {
		channel string
		config  map[string]interface{}
	}
	var gateways []gateway
	for rows.Next() {
		var channel string
		var configBytes []byte
		rows.Scan(&channel, &configBytes)
		var cfg map[string]interface{}
		json.Unmarshal(configBytes, &cfg)
		gateways = append(gateways, gateway{channel: channel, config: cfg})
	}

	if len(gateways) == 0 {
		return
	}

	// 2. Obtener datos de contacto del usuario
	var email, phone, telegramChatID, matrixUserID, xmppJID string
	g.Pool.QueryRow(ctx, `
		SELECT COALESCE(email, ''), COALESCE(phone, ''), COALESCE(telegram_chat_id, ''),
		       COALESCE(matrix_user_id, ''), COALESCE(xmpp_jid, '')
		FROM users WHERE id = $1`, userID).Scan(&email, &phone, &telegramChatID, &matrixUserID, &xmppJID)

	// 3. Verificar preferencias del usuario
	prefMap := g.getUserPreferences(ctx, userID, notifType)

	// 4. Enviar por cada canal
	var delivered []string
	errors := map[string]string{}

	for _, gw := range gateways {
		// Verificar preferencia
		if enabled, ok := prefMap[gw.channel]; ok && !enabled {
			continue
		}

		var err error
		switch gw.channel {
		case "email":
			if email == "" {
				continue
			}
			err = g.sendEmail(gw.config, email, title, message, link)
		case "telegram":
			if telegramChatID == "" {
				continue
			}
			err = g.sendTelegram(gw.config, telegramChatID, title, message, link)
		case "matrix":
			if matrixUserID == "" {
				continue
			}
			err = g.sendMatrix(gw.config, matrixUserID, title, message, link)
		case "webhook":
			err = g.sendWebhook(gw.config, title, message, link, userID)
		case "whatsapp":
			if phone == "" {
				continue
			}
			err = g.sendWhatsApp(gw.config, phone, title, message, link)
		default:
			continue
		}

		if err != nil {
			errors[gw.channel] = err.Error()
		} else {
			delivered = append(delivered, gw.channel)
		}
	}

	// 5. Actualizar la notificacion con los canales entregados
	if len(delivered) > 0 {
		g.Pool.Exec(ctx, `UPDATE notifications SET channels_delivered = $2 WHERE id = $1`, notifID, delivered)
	}
	if len(errors) > 0 {
		errJSON, _ := json.Marshal(errors)
		g.Pool.Exec(ctx, `UPDATE notifications SET delivery_errors = $2 WHERE id = $1`, notifID, errJSON)
	}
}

// getUserPreferences obtiene las preferencias del usuario para un tipo de notificacion
func (g *GatewayService) getUserPreferences(ctx context.Context, userID uuid.UUID, notifType string) map[string]bool {
	prefs := map[string]bool{}
	rows, err := g.Pool.Query(ctx, `
		SELECT channel_code, is_enabled FROM notification_preferences
		WHERE user_id = $1 AND notification_type = $2`, userID, notifType)
	if err != nil {
		return prefs
	}
	defer rows.Close()
	for rows.Next() {
		var channel string
		var enabled bool
		rows.Scan(&channel, &enabled)
		prefs[channel] = enabled
	}
	return prefs
}

// ===== Email (SMTP) =====

func (g *GatewayService) sendEmail(config map[string]interface{}, to, subject, body, link string) error {
	host, _ := config["host"].(string)
	port, _ := config["port"].(float64)
	username, _ := config["username"].(string)
	password, _ := config["password"].(string)
	fromEmail, _ := config["from_email"].(string)
	fromName, _ := config["from_name"].(string)
	useTLS, _ := config["use_tls"].(bool)

	if host == "" || fromEmail == "" {
		return fmt.Errorf("config de email incompleta")
	}

	if fromName == "" {
		fromName = "Red Federada"
	}

	fullBody := body
	if link != "" {
		fullBody += "\n\nVer: " + link
	}
	fullBody += "\n\n--\nRed de Intercambio Federada"

	msg := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		fromName, fromEmail, to, subject, fullBody)

	addr := fmt.Sprintf("%s:%.0f", host, port)
	var auth smtp.Auth
	if username != "" {
		auth = smtp.PlainAuth("", username, password, host)
	}

	if useTLS {
		// Para TLS usamos smtp.SendMail que maneja STARTTLS automaticamente
		return smtp.SendMail(addr, auth, fromEmail, []string{to}, []byte(msg))
	}
	// Sin TLS - conexion directa
	return smtp.SendMail(addr, auth, fromEmail, []string{to}, []byte(msg))
}

// ===== Telegram Bot =====

func (g *GatewayService) sendTelegram(config map[string]interface{}, chatID, title, message, link string) error {
	botToken, _ := config["bot_token"].(string)
	if botToken == "" {
		return fmt.Errorf("bot_token no configurado")
	}

	text := fmt.Sprintf("*%s*\n\n%s", title, message)
	if link != "" {
		text += fmt.Sprintf("\n\n[%s](%s)", "Ver", link)
	}

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("telegram API error: %d", resp.StatusCode)
	}
	return nil
}

// ===== Matrix (Client-Server API) =====

func (g *GatewayService) sendMatrix(config map[string]interface{}, userID, title, message, link string) error {
	homeserverURL, _ := config["homeserver_url"].(string)
	accessToken, _ := config["access_token"].(string)
	defaultRoomID, _ := config["default_room_id"].(string)

	if homeserverURL == "" || accessToken == "" {
		return fmt.Errorf("config de matrix incompleta")
	}

	// Si hay un room por defecto, enviamos ahi
	// En el futuro se puede resolver el userID a room via /createRoom o /directory
	roomID := defaultRoomID
	if roomID == "" {
		return fmt.Errorf("no hay room_id configurado")
	}

	text := fmt.Sprintf("**%s**\n\n%s", title, message)
	if link != "" {
		text += fmt.Sprintf("\n\n%s", link)
	}

	// Matrix requiere un txn_id unico
	txnID := fmt.Sprintf("notif_%d", time.Now().UnixNano())

	payload := map[string]interface{}{
		"msgtype": "m.text",
		"body":    text,
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("%s/_matrix/client/r0/rooms/%s/send/m.room.message/%s?access_token=%s",
		strings.TrimSuffix(homeserverURL, "/"), roomID, txnID, accessToken)

	req, _ := http.NewRequest("PUT", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("matrix API error: %d", resp.StatusCode)
	}
	return nil
}

// ===== Webhook generico =====

func (g *GatewayService) sendWebhook(config map[string]interface{}, title, message, link string, userID uuid.UUID) error {
	endpointURL, _ := config["endpoint_url"].(string)
	authToken, _ := config["auth_token"].(string)
	if endpointURL == "" {
		return fmt.Errorf("endpoint_url no configurado")
	}

	payload := map[string]interface{}{
		"title":   title,
		"message": message,
		"link":    link,
		"user_id": userID.String(),
		"time":    time.Now().Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", endpointURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook error: %d", resp.StatusCode)
	}
	return nil
}

// ===== WhatsApp (Meta Cloud API o API propia) =====

func (g *GatewayService) sendWhatsApp(config map[string]interface{}, phone, title, message, link string) error {
	// Detectar tipo: Meta Cloud API vs API propia
	if phoneNumberID, ok := config["phone_number_id"].(string); ok && phoneNumberID != "" {
		return g.sendWhatsAppMeta(config, phone, title, message, link)
	}
	if endpointURL, ok := config["endpoint_url"].(string); ok && endpointURL != "" {
		return g.sendWhatsAppCustom(config, phone, title, message, link)
	}
	return fmt.Errorf("config de whatsapp incompleta")
}

func (g *GatewayService) sendWhatsAppMeta(config map[string]interface{}, phone, title, message, link string) error {
	phoneNumberID, _ := config["phone_number_id"].(string)
	accessToken, _ := config["access_token"].(string)
	if phoneNumberID == "" || accessToken == "" {
		return fmt.Errorf("config de whatsapp meta incompleta")
	}

	text := fmt.Sprintf("%s\n\n%s", title, message)
	if link != "" {
		text += "\n\n" + link
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                phone,
		"type":              "text",
		"text": map[string]interface{}{
			"body": text,
		},
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/messages", phoneNumberID)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("whatsapp meta API error: %d", resp.StatusCode)
	}
	return nil
}

func (g *GatewayService) sendWhatsAppCustom(config map[string]interface{}, phone, title, message, link string) error {
	endpointURL, _ := config["endpoint_url"].(string)
	authToken, _ := config["auth_token"].(string)
	phoneField, _ := config["phone_field"].(string)
	messageField, _ := config["message_field"].(string)

	if phoneField == "" {
		phoneField = "phone"
	}
	if messageField == "" {
		messageField = "message"
	}

	text := fmt.Sprintf("%s\n\n%s", title, message)
	if link != "" {
		text += "\n\n" + link
	}

	payload := map[string]interface{}{
		phoneField:   phone,
		messageField: text,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", endpointURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("whatsapp custom API error: %d", resp.StatusCode)
	}
	return nil
}
