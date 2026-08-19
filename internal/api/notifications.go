package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NotificationHandler maneja notificaciones generales del sistema
type NotificationHandler struct {
	Pool *pgxpool.Pool
	Auth *AuthMiddleware
}

// RegisterRoutes registra las rutas de notificaciones
func (h *NotificationHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Notificaciones del usuario
	r.With(am.RequireAuth).Get("/api/notifications", h.listNotifications)
	r.With(am.RequireAuth).Get("/api/notifications/unread-count", h.unreadCount)
	r.With(am.RequireAuth).Put("/api/notifications/{id}/read", h.markRead)
	r.With(am.RequireAuth).Put("/api/notifications/read-all", h.markAllRead)
	r.With(am.RequireAuth).Delete("/api/notifications/{id}", h.deleteNotification)

	// Configuracion de pasarelas (solo admin)
	r.With(am.RequirePermission("config.manage")).Get("/api/notifications/gateways", h.listGateways)
	r.With(am.RequirePermission("config.manage")).Put("/api/notifications/gateways/{channel}", h.updateGateway)
	r.With(am.RequirePermission("config.manage")).Post("/api/notifications/gateways/{channel}/test", h.testGateway)

	// Preferencias de usuario
	r.With(am.RequireAuth).Get("/api/notifications/preferences", h.getPreferences)
	r.With(am.RequireAuth).Put("/api/notifications/preferences", h.updatePreferences)

	// WebPush subscription
	r.With(am.RequireAuth).Post("/api/notifications/webpush/subscribe", h.subscribeWebPush)
	r.With(am.RequireAuth).Delete("/api/notifications/webpush/subscribe", h.unsubscribeWebPush)

	// Canales disponibles (publico para usuarios autenticados)
	r.With(am.RequireAuth).Get("/api/notifications/channels", h.listChannels)
}

// NotifyService es el servicio para crear notificaciones desde cualquier handler
type NotifyService struct {
	Pool    *pgxpool.Pool
	gateway *GatewayService
}

// NewNotifyService crea un nuevo servicio de notificaciones
func NewNotifyService(pool *pgxpool.Pool) *NotifyService {
	return &NotifyService{Pool: pool, gateway: NewGatewayService(pool)}
}

// Notify crea una notificacion para un usuario y dispara la entrega por pasarelas
func (s *NotifyService) Notify(ctx context.Context, nodeDomain string, userID uuid.UUID, notifType, title, message, link string, metadata map[string]interface{}) {
	var notifID uuid.UUID
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO notifications (node_domain, user_id, notification_type, title, message, link, metadata, channels_delivered)
		VALUES ($1, $2, $3, $4, $5, $6, $7, ARRAY['in_app'])
		RETURNING id`,
		nodeDomain, userID, notifType, title, message, link, metadata).Scan(&notifID)
	if err != nil {
		// Log pero no fallar la operacion principal
		fmt.Printf("Error creando notificacion: %v\n", err)
		return
	}
	// Entregar en background por los canales configurados (email, telegram, matrix, etc.)
	if s.gateway != nil {
		s.gateway.DeliverInBackground(nodeDomain, userID, notifID, notifType, title, message, link)
	}
}

// NotifyMany crea notificaciones para multiples usuarios
func (s *NotifyService) NotifyMany(ctx context.Context, nodeDomain string, userIDs []uuid.UUID, notifType, title, message, link string, metadata map[string]interface{}) {
	for _, uid := range userIDs {
		s.Notify(ctx, nodeDomain, uid, notifType, title, message, link, metadata)
	}
}

// NotifyVotingMembers notifica a todos los miembros con derecho a voto del nodo
func (s *NotifyService) NotifyVotingMembers(ctx context.Context, nodeDomain, notifType, title, message, link string, metadata map[string]interface{}) {
	rows, err := s.Pool.Query(ctx, `
		SELECT u.id FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		AND ml.has_vote = true`, nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid uuid.UUID
		rows.Scan(&uid)
		s.Notify(ctx, nodeDomain, uid, notifType, title, message, link, metadata)
	}
}

// NotifyBoard notifica a la junta directiva del nodo
func (s *NotifyService) NotifyBoard(ctx context.Context, nodeDomain, notifType, title, message, link string, metadata map[string]interface{}) {
	rows, err := s.Pool.Query(ctx, `
		SELECT user_id FROM assembly_board_members WHERE node_domain = $1`, nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid uuid.UUID
		rows.Scan(&uid)
		s.Notify(ctx, nodeDomain, uid, notifType, title, message, link, metadata)
	}
}

// ===== Handlers HTTP =====

func (h *NotificationHandler) listNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id, notification_type, title, message, metadata, link, is_read, created_at, read_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50`, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	notifs := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var notifType, title string
		var message, link *string
		var metadata []byte
		var isRead bool
		var createdAt time.Time
		var readAt *time.Time
		rows.Scan(&id, &notifType, &title, &message, &metadata, &link, &isRead, &createdAt, &readAt)

		var meta interface{}
		if metadata != nil {
			json.Unmarshal(metadata, &meta)
		}

		entry := map[string]interface{}{
			"id":                id.String(),
			"notification_type": notifType,
			"title":             title,
			"message":           deref(message),
			"metadata":          meta,
			"link":              deref(link),
			"is_read":           isRead,
			"created_at":        createdAt.Format(time.RFC3339),
		}
		if readAt != nil {
			entry["read_at"] = readAt.Format(time.RFC3339)
		}
		notifs = append(notifs, entry)
	}
	writeJSON(w, 200, notifs)
}

func (h *NotificationHandler) unreadCount(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var count int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, userID).Scan(&count)

	// Tambien contar assembly_notifications no leidas
	var assemblyCount int
	h.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM assembly_notifications WHERE user_id = $1 AND is_read = false`, userID).Scan(&assemblyCount)

	writeJSON(w, 200, map[string]interface{}{
		"unread":       count,
		"assembly":     assemblyCount,
		"total_unread": count + assemblyCount,
	})
}

func (h *NotificationHandler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	h.Pool.Exec(r.Context(), `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2`, notifID, userID)
	writeJSON(w, 200, map[string]interface{}{"message": "ok"})
}

func (h *NotificationHandler) markAllRead(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	h.Pool.Exec(r.Context(), `UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`, userID)
	h.Pool.Exec(r.Context(), `UPDATE assembly_notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`, userID)
	writeJSON(w, 200, map[string]interface{}{"message": "todas marcadas como leidas"})
}

func (h *NotificationHandler) deleteNotification(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid id")
		return
	}
	h.Pool.Exec(r.Context(), `DELETE FROM notifications WHERE id = $1 AND user_id = $2`, notifID, userID)
	writeJSON(w, 200, map[string]interface{}{"message": "ok"})
}

func (h *NotificationHandler) listChannels(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT nc.channel_code, nc.name, nc.description, nc.is_enabled, nc.requires_config, nc.sort_order,
		       EXISTS(
		           SELECT 1 FROM notification_gateway_config gc
		           WHERE gc.node_domain = $1 AND gc.channel_code = nc.channel_code AND gc.is_active = true
		       ) AS gateway_active
		FROM notification_channels nc
		ORDER BY nc.sort_order`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	channels := []map[string]interface{}{}
	for rows.Next() {
		var code, name, desc string
		var enabled, requiresConfig, gatewayActive bool
		var sortOrder int
		rows.Scan(&code, &name, &desc, &enabled, &requiresConfig, &sortOrder, &gatewayActive)
		channels = append(channels, map[string]interface{}{
			"channel_code":    code,
			"name":            name,
			"description":     desc,
			"is_enabled":      enabled,
			"requires_config": requiresConfig,
			"sort_order":      sortOrder,
			"gateway_active":  gatewayActive,
		})
	}
	writeJSON(w, 200, channels)
}

func (h *NotificationHandler) listGateways(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	rows, err := h.Pool.Query(r.Context(), `
		SELECT channel_code, config, is_active, updated_at
		FROM notification_gateway_config WHERE node_domain = $1`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	gateways := []map[string]interface{}{}
	for rows.Next() {
		var channelCode string
		var config []byte
		var isActive bool
		var updatedAt time.Time
		rows.Scan(&channelCode, &config, &isActive, &updatedAt)
		var cfg interface{}
		if config != nil {
			json.Unmarshal(config, &cfg)
		}
		// No devolver secretos
		if m, ok := cfg.(map[string]interface{}); ok {
			for k := range m {
				if k == "password" || k == "auth_token" || k == "access_token" || k == "bot_token" || k == "auth_token" {
					m[k] = "***"
				}
			}
		}
		gateways = append(gateways, map[string]interface{}{
			"channel_code": channelCode,
			"config":       cfg,
			"is_active":    isActive,
			"updated_at":   updatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, gateways)
}

func (h *NotificationHandler) updateGateway(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	channel := chi.URLParam(r, "channel")

	var req struct {
		Config   map[string]interface{} `json:"config"`
		IsActive bool                   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	configJSON, _ := json.Marshal(req.Config)
	_, err := h.Pool.Exec(r.Context(), `
		INSERT INTO notification_gateway_config (node_domain, channel_code, config, is_active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (node_domain, channel_code) DO UPDATE SET
			config = $3, is_active = $4, updated_at = NOW()`,
		nodeDomain, channel, configJSON, req.IsActive)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"message": "pasarela actualizada"})
}

func (h *NotificationHandler) testGateway(w http.ResponseWriter, r *http.Request) {
	channel := chi.URLParam(r, "channel")
	// Por ahora solo devolvemos ok. El envio real se implementa en Fase 3.
	writeJSON(w, 200, map[string]interface{}{
		"message": "test enviado (canal: " + channel + ")",
		"channel": channel,
		"success": true,
		"note":    "El envio real por pasarelas se implementa en Fase 3",
	})
}

func (h *NotificationHandler) getPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	rows, err := h.Pool.Query(r.Context(), `
		SELECT notification_type, channel_code, is_enabled
		FROM notification_preferences WHERE user_id = $1`, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	prefs := []map[string]interface{}{}
	for rows.Next() {
		var ntype, channel string
		var enabled bool
		rows.Scan(&ntype, &channel, &enabled)
		prefs = append(prefs, map[string]interface{}{
			"notification_type": ntype,
			"channel_code":      channel,
			"is_enabled":        enabled,
		})
	}
	writeJSON(w, 200, prefs)
}

func (h *NotificationHandler) updatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	var req struct {
		Preferences []struct {
			NotificationType string `json:"notification_type"`
			ChannelCode      string `json:"channel_code"`
			IsEnabled        bool   `json:"is_enabled"`
		} `json:"preferences"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	for _, p := range req.Preferences {
		h.Pool.Exec(r.Context(), `
			INSERT INTO notification_preferences (user_id, notification_type, channel_code, is_enabled)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, notification_type, channel_code) DO UPDATE SET is_enabled = $4`,
			userID, p.NotificationType, p.ChannelCode, p.IsEnabled)
	}
	writeJSON(w, 200, map[string]interface{}{"message": "preferencias actualizadas"})
}

// ===== WebPush subscription =====

func (h *NotificationHandler) subscribeWebPush(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
		ExpirationTime *int64 `json:"expirationTime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Endpoint == "" {
		writeError(w, 400, "endpoint is required")
		return
	}

	subscription := map[string]interface{}{
		"endpoint":       req.Endpoint,
		"keys":           req.Keys,
		"expirationTime": req.ExpirationTime,
	}
	subBytes, _ := json.Marshal(subscription)

	_, err = h.Pool.Exec(r.Context(), `UPDATE users SET webpush_subscription = $2 WHERE id = $1`, userID, subBytes)
	if err != nil {
		writeError(w, 500, "error saving subscription")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"message": "subscription saved"})
}

func (h *NotificationHandler) unsubscribeWebPush(w http.ResponseWriter, r *http.Request) {
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	h.Pool.Exec(r.Context(), `UPDATE users SET webpush_subscription = NULL WHERE id = $1`, userID)
	writeJSON(w, 200, map[string]interface{}{"message": "subscription removed"})
}
