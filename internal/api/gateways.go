package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"net/url"
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

// isInQuietHours verifica si la hora actual esta dentro del periodo silencioso
// Soporta rangos que cruzan medianoche (ej: 22 a 7)
func isInQuietHours(currentHour, quietStart, quietEnd int) bool {
	if quietStart == quietEnd {
		return false
	}
	if quietStart < quietEnd {
		// Rango normal (ej: 2 a 6)
		return currentHour >= quietStart && currentHour < quietEnd
	}
	// Rango que cruza medianoche (ej: 22 a 7)
	return currentHour >= quietStart || currentHour < quietEnd
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

	// 2. Obtener datos de contacto del usuario y quiet hours
	var email, phone, telegramChatID, matrixUserID, xmppJID string
	var quietStart, quietEnd *int
	g.Pool.QueryRow(ctx, `
		SELECT COALESCE(email, ''), COALESCE(phone, ''), COALESCE(telegram_chat_id, ''),
		       COALESCE(matrix_user_id, ''), COALESCE(xmpp_jid, ''),
		       quiet_hours_start, quiet_hours_end
		FROM users WHERE id = $1`, userID).Scan(&email, &phone, &telegramChatID, &matrixUserID, &xmppJID, &quietStart, &quietEnd)

	// 2b. Verificar quiet hours (horas silenciosas del usuario)
	if quietStart != nil && quietEnd != nil {
		now := time.Now()
		currentHour := now.Hour()
		if isInQuietHours(currentHour, *quietStart, *quietEnd) {
			// En quiet hours: solo entregar in_app, posponer el resto
			// Marcar como pospuesta para entrega despues
			g.Pool.Exec(ctx, `UPDATE notifications SET delivery_errors = $2 WHERE id = $1`,
				notifID, `{"quiet_hours": "pospuesta fuera de horas silenciosas"}`)
			return
		}
	}

	// 2c. Rate limiting: max 10 notificaciones por hora por usuario
	var recentCount int
	g.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM notifications
		WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, userID).Scan(&recentCount)
	if recentCount > 10 {
		// Rate limit excedido: solo in_app, no enviar por pasarelas
		g.Pool.Exec(ctx, `UPDATE notifications SET delivery_errors = $2 WHERE id = $1`,
			notifID, `{"rate_limited": "max 10 por hora excedido"}`)
		return
	}

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
		case "xmpp":
			if xmppJID == "" {
				continue
			}
			err = g.sendXMPP(gw.config, xmppJID, title, message, link)
		case "webpush":
			err = g.sendWebPush(ctx, gw.config, userID, title, message, link)
		case "sms":
			if phone == "" {
				continue
			}
			err = g.sendSMS(gw.config, phone, title, message, link)
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

// ===== WebPush (W3C Push API) =====
//
// WebPush envia notificaciones push al navegador del usuario via el endpoint
// de su suscripcion. Requiere VAPID (Voluntary Application Server Identification)
// para autenticar el envio.
//
// El subscription se almacena en users.webpush_subscription (JSONB) y contiene:
//   - endpoint: URL del push service (Chrome: fcm.googleapis.com, Firefox: updates.push.services.mozilla.com, etc.)
//   - keys.p256dh: clave publica ECDH
//   - keys.auth: secreto de autenticacion
//
// El envio requiere firmar un JWT con la clave privada VAPID y encriptar el
// payload con el esquema aes128gcm. Para evitar dependencias criptograficas
// pesadas, esta implementacion envia una notificacion vacia (TTL only) que
// hace que el navegador muestre la notificacion basica. Para payloads completos
// se requiere una libreria como github.com/SherClockHolmes/webpush-go.
func (g *GatewayService) sendWebPush(ctx context.Context, config map[string]interface{}, userID uuid.UUID, title, message, link string) error {
	// Obtener el subscription del usuario
	var subBytes []byte
	err := g.Pool.QueryRow(ctx, `SELECT webpush_subscription FROM users WHERE id = $1`, userID).Scan(&subBytes)
	if err != nil || len(subBytes) == 0 {
		return fmt.Errorf("usuario sin suscripcion webpush")
	}

	var subscription struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
		ExpirationTime *int64 `json:"expirationTime"`
	}
	if err := json.Unmarshal(subBytes, &subscription); err != nil {
		return fmt.Errorf("subscription invalido: %w", err)
	}
	if subscription.Endpoint == "" {
		return fmt.Errorf("subscription sin endpoint")
	}

	// Verificar VAPID config
	vapidPublicKey, _ := config["vapid_public_key"].(string)
	vapidPrivateKey, _ := config["vapid_private_key"].(string)
	vapidSubject, _ := config["vapid_subject"].(string)
	if vapidSubject == "" {
		vapidSubject = "mailto:notificaciones@red-federada.org"
	}

	if vapidPublicKey == "" || vapidPrivateKey == "" {
		// Sin VAPID keys: enviar payload vacio con TTL
		// El navegador mostrara una notificacion generica
		req, _ := http.NewRequestWithContext(ctx, "POST", subscription.Endpoint, nil)
		req.Header.Set("TTL", "86400")
		req.Header.Set("Content-Encoding", "aes128gcm")
		req.Header.Set("Content-Length", "0")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return fmt.Errorf("webpush error: %d", resp.StatusCode)
		}
		return nil
	}

	// Con VAPID keys: construir el JWT y enviar
	// Nota: para envio completo con payload encriptado se requiere
	// una libreria especializada. Por ahora enviamos notificacion vacia
	// con VAPID auth header.
	jwtToken, err := buildVapidJWT(vapidPrivateKey, vapidSubject, subscription.Endpoint)
	if err != nil {
		return fmt.Errorf("error generando VAPID JWT: %w", err)
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", subscription.Endpoint, nil)
	req.Header.Set("TTL", "86400")
	req.Header.Set("Authorization", "vapid t="+jwtToken+", k="+vapidPublicKey)
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Length", "0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("webpush error: %d", resp.StatusCode)
	}
	return nil
}

// buildVapidJWT construye un JWT minimal para VAPID
// Nota: esto es una implementacion simplificada. Para produccion se recomienda
// usar github.com/golang-jwt/jwt o una libreria webpush dedicada.
func buildVapidJWT(privateKeyPEM, subject, endpoint string) (string, error) {
	// Por ahora retornamos un placeholder - en produccion esto requiere
	// firmar un JWT ES256 con la clave privada VAPID
	// El payload contiene: aud (origin del endpoint), exp (24h), sub (subject)
	_ = privateKeyPEM
	_ = subject
	_ = endpoint
	return "placeholder.vapid.jwt", nil
}

// ===== SMS (generico) =====
//
// SMS via proveedor generico. Soporta:
//   - Twilio (twilio.com)
//   - Vonage/Nexmo
//   - API propia via HTTP
//
// El admin configura el proveedor y las credenciales en notification_gateway_config.
func (g *GatewayService) sendSMS(config map[string]interface{}, phone, title, message, link string) error {
	provider, _ := config["provider"].(string)
	if provider == "" {
		// Auto-detectar por campos
		if _, ok := config["account_sid"].(string); ok {
			provider = "twilio"
		} else if endpointURL, _ := config["endpoint_url"].(string); endpointURL != "" {
			provider = "custom"
		} else {
			return fmt.Errorf("config de SMS incompleta")
		}
	}

	switch provider {
	case "twilio":
		return g.sendSMSTwilio(config, phone, title, message, link)
	case "vonage":
		return g.sendSMSVonage(config, phone, title, message, link)
	default:
		return g.sendSMSCustom(config, phone, title, message, link)
	}
}

func (g *GatewayService) sendSMSTwilio(config map[string]interface{}, phone, title, message, link string) error {
	accountSID, _ := config["account_sid"].(string)
	authToken, _ := config["auth_token"].(string)
	fromNumber, _ := config["from_number"].(string)

	if accountSID == "" || authToken == "" || fromNumber == "" {
		return fmt.Errorf("config de twilio incompleta: account_sid, auth_token, from_number requeridos")
	}

	text := fmt.Sprintf("%s: %s", title, message)
	if link != "" {
		text += " " + link
	}

	twilioURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSID)
	form := url.Values{}
	form.Set("To", phone)
	form.Set("From", fromNumber)
	form.Set("Body", text)

	req, _ := http.NewRequest("POST", twilioURL, strings.NewReader(form.Encode()))
	req.SetBasicAuth(accountSID, authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("twilio API error: %d", resp.StatusCode)
	}
	return nil
}

func (g *GatewayService) sendSMSVonage(config map[string]interface{}, phone, title, message, link string) error {
	apiKey, _ := config["api_key"].(string)
	apiSecret, _ := config["api_secret"].(string)
	fromName, _ := config["from"].(string)
	if apiKey == "" || apiSecret == "" {
		return fmt.Errorf("config de vonage incompleta")
	}
	if fromName == "" {
		fromName = "RedFederada"
	}

	text := fmt.Sprintf("%s: %s", title, message)
	if link != "" {
		text += " " + link
	}

	payload := map[string]interface{}{
		"api_key":    apiKey,
		"api_secret": apiSecret,
		"to":         phone,
		"from":       fromName,
		"text":       text,
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post("https://rest.nexmo.com/sms/json", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("vonage API error: %d", resp.StatusCode)
	}
	return nil
}

func (g *GatewayService) sendSMSCustom(config map[string]interface{}, phone, title, message, link string) error {
	endpointURL, _ := config["endpoint_url"].(string)
	authToken, _ := config["auth_token"].(string)
	phoneField, _ := config["phone_field"].(string)
	messageField, _ := config["message_field"].(string)

	if endpointURL == "" {
		return fmt.Errorf("endpoint_url no configurado")
	}
	if phoneField == "" {
		phoneField = "phone"
	}
	if messageField == "" {
		messageField = "message"
	}

	text := fmt.Sprintf("%s: %s", title, message)
	if link != "" {
		text += " " + link
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
		return fmt.Errorf("SMS custom API error: %d", resp.StatusCode)
	}
	return nil
}

// XMPP soporta varios modos de integracion:
//  1. HTTP API del servidor (Prosody mod_rest, ejabberd XMLRPC, etc.)
//  2. Bridge externo que recibe HTTP y reenvia por XMPP
//  3. Cliente XMPP nativo (requiere libreria pesada, no incluida aqui)
//
// Implementamos el modo HTTP API / bridge por ser el mas ligero y compatible
// con cualquier servidor XMPP que exponga una API REST (Prosody mod_rest,
// ejabberd, o un bridge propio). El admin configura la URL del endpoint.
func (g *GatewayService) sendXMPP(config map[string]interface{}, toJID, title, message, link string) error {
	endpointURL, _ := config["endpoint_url"].(string)
	authToken, _ := config["auth_token"].(string)
	fromJID, _ := config["from_jid"].(string)

	if endpointURL == "" {
		return fmt.Errorf("config de xmpp incompleta: endpoint_url requerido")
	}

	text := fmt.Sprintf("%s\n\n%s", title, message)
	if link != "" {
		text += "\n\n" + link
	}

	payload := map[string]interface{}{
		"to":   toJID,
		"body": text,
	}
	if fromJID != "" {
		payload["from"] = fromJID
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
		return fmt.Errorf("xmpp API error: %d", resp.StatusCode)
	}
	return nil
}
