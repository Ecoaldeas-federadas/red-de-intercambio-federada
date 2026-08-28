package payments

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// ============================================
// POS Web Session Requests
// ============================================
// A diferencia del pairing de Android/ESP32 (aprobado por el admin y permanente),
// las sesiones del POS web son aprobadas por el DUEÑO del terminal y son temporales.
// Cada navegador genera sus propias claves Ed25519 y debe ser validado por el dueño.

// WebSessionRequest representa una solicitud de sesion web pendiente.
type WebSessionRequest struct {
	ID                uuid.UUID  `json:"id"`
	TerminalID        string     `json:"terminal_id"`
	TerminalLabel     string     `json:"terminal_label"`
	TerminalPublicKey string     `json:"-"` // nunca exponer al frontend
	DeviceFingerprint string     `json:"device_fingerprint"`
	PairingCode       string     `json:"-"` // nunca exponer al frontend directamente
	Status            string     `json:"status"`
	ApprovedHours     *int       `json:"approved_hours,omitempty"`
	ApprovedBy        *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// generateWebSessionCode genera un codigo de 4 digitos para validacion de sesion web.
func generateWebSessionCode() (string, error) {
	bytes := make([]byte, 2)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	num := int(bytes[0])<<8 | int(bytes[1])
	code := num % 10000
	return fmt.Sprintf("%04d", code), nil
}

// RequestWebSession crea una solicitud de sesion web para un terminal web_pos.
// El POS web envia su terminal_id (asignado por el admin), su clave publica
// Ed25519 efimera y la huella del navegador. El servidor genera un codigo de
// 4 digitos que el POS muestra al usuario. El dueño del terminal debe aprobarlo.
func (nt *NFCTerminals) RequestWebSession(ctx context.Context, terminalID, terminalPublicKey, deviceFingerprint string) (string, uuid.UUID, error) {
	if terminalID == "" || terminalPublicKey == "" {
		return "", uuid.Nil, fmt.Errorf("terminal_id y terminal_public_key son requeridos")
	}

	// Verificar que el terminal existe, es web_pos y esta activo
	var dbTerminalType string
	var dbIsActive bool
	var dbMerchantUserID *uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT terminal_type, is_active, merchant_user_id
		FROM nfc_terminals
		WHERE terminal_id = $1
		ORDER BY updated_at DESC LIMIT 1`,
		terminalID,
	).Scan(&dbTerminalType, &dbIsActive, &dbMerchantUserID)
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("terminal no encontrado. Debe ser registrado por el administrador primero")
	}
	if dbTerminalType != "web" && dbTerminalType != "web_pos" {
		return "", uuid.Nil, fmt.Errorf("este terminal no es un POS web")
	}
	if !dbIsActive {
		return "", uuid.Nil, fmt.Errorf("terminal inactivo. Contacte al administrador")
	}

	// Rate limiting: maximo 3 solicitudes por fingerprint en 5 minutos
	if deviceFingerprint != "" {
		var recentCount int
		_ = nt.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM pos_web_session_requests
			WHERE device_fingerprint = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
			deviceFingerprint,
		).Scan(&recentCount)
		if recentCount >= 3 {
			return "", uuid.Nil, fmt.Errorf("demasiadas solicitudes. Espere 5 minutos.")
		}
	}

	// Expirar solicitudes pendientes anteriores del mismo terminal
	nt.Pool.Exec(ctx, `
		UPDATE pos_web_session_requests SET status = 'expired'
		WHERE terminal_id = $1 AND status = 'pending'`,
		terminalID,
	)

	// Generar codigo de 4 digitos unico
	var pairingCode string
	for attempts := 0; attempts < 10; attempts++ {
		code, err := generateWebSessionCode()
		if err != nil {
			continue
		}
		var exists bool
		_ = nt.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM pos_web_session_requests
			WHERE pairing_code = $1 AND status = 'pending')`, code,
		).Scan(&exists)
		if !exists {
			pairingCode = code
			break
		}
	}
	if pairingCode == "" {
		return "", uuid.Nil, fmt.Errorf("no se pudo generar un codigo unico, intente nuevamente")
	}

	requestID := uuid.New()
	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO pos_web_session_requests
			(id, terminal_id, terminal_public_key, device_fingerprint, pairing_code, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')`,
		requestID, terminalID, terminalPublicKey, deviceFingerprint, pairingCode,
	)
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("creating web session request: %w", err)
	}

	return pairingCode, requestID, nil
}

// GetWebSessionStatus consulta el estado de una solicitud de sesion web.
// El POS web hace polling con el request_id para saber si fue aprobada.
func (nt *NFCTerminals) GetWebSessionStatus(ctx context.Context, requestID uuid.UUID) (string, string, string, *time.Time, error) {
	var status, terminalID, serverPubKey string
	var expiresAt *time.Time
	err := nt.Pool.QueryRow(ctx, `
		SELECT r.status, r.terminal_id, sk.public_key, r.expires_at
		FROM pos_web_session_requests r
		LEFT JOIN nfc_terminals t ON t.terminal_id = r.terminal_id
		LEFT JOIN nfc_server_keys sk ON sk.node_domain = t.node_domain
		WHERE r.id = $1`,
		requestID,
	).Scan(&status, &terminalID, &serverPubKey, &expiresAt)
	if err != nil {
		return "", "", "", nil, fmt.Errorf("solicitud no encontrada")
	}

	// Si esta pendiente y pasaron mas de 60 segundos, marcar como expirada
	if status == "pending" {
		var createdAt time.Time
		_ = nt.Pool.QueryRow(ctx, `SELECT created_at FROM pos_web_session_requests WHERE id = $1`, requestID).Scan(&createdAt)
		if time.Since(createdAt) > 60*time.Second {
			nt.Pool.Exec(ctx, `UPDATE pos_web_session_requests SET status = 'expired' WHERE id = $1`, requestID)
			return "expired", "", "", nil, nil
		}
	}

	return status, terminalID, serverPubKey, expiresAt, nil
}

// ListPendingWebSessions lista las solicitudes de sesion web pendientes
// para los terminales asignados al usuario (merchant_user_id) o a su organizacion.
func (nt *NFCTerminals) ListPendingWebSessions(ctx context.Context, userID uuid.UUID) ([]WebSessionRequest, error) {
	rows, err := nt.Pool.Query(ctx, `
		SELECT r.id, r.terminal_id, t.label, r.device_fingerprint,
		       r.status, r.created_at
		FROM pos_web_session_requests r
		JOIN nfc_terminals t ON t.terminal_id = r.terminal_id
		WHERE r.status = 'pending'
		  AND (t.merchant_user_id = $1 OR t.organization_id = $1)
		ORDER BY r.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing pending web sessions: %w", err)
	}
	defer rows.Close()

	var requests []WebSessionRequest
	for rows.Next() {
		var r WebSessionRequest
		if err := rows.Scan(&r.ID, &r.TerminalID, &r.TerminalLabel, &r.DeviceFingerprint, &r.Status, &r.CreatedAt); err != nil {
			continue
		}
		requests = append(requests, r)
	}
	return requests, nil
}

// GetWebSessionOptions devuelve 4 opciones de codigo para que el dueno elija.
// El servidor busca el codigo real internamente por UUID y genera 4 opciones.
func (nt *NFCTerminals) GetWebSessionOptions(ctx context.Context, requestID uuid.UUID) ([]string, error) {
	var code, status string
	var createdAt time.Time
	err := nt.Pool.QueryRow(ctx, `
		SELECT pairing_code, status, created_at FROM pos_web_session_requests
		WHERE id = $1`,
		requestID,
	).Scan(&code, &status, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("solicitud no encontrada")
	}
	if status != "pending" {
		return nil, fmt.Errorf("la solicitud ya fue procesada (estado: %s)", status)
	}
	if time.Since(createdAt) > 60*time.Second {
		nt.Pool.Exec(ctx, `UPDATE pos_web_session_requests SET status = 'expired' WHERE id = $1`, requestID)
		return nil, fmt.Errorf("el codigo ya expiro")
	}

	// Generar 3 decoys aleatorios
	options := []string{code}
	for len(options) < 4 {
		decoy, err := generateWebSessionCode()
		if err != nil {
			continue
		}
		duplicate := false
		for _, o := range options {
			if o == decoy {
				duplicate = true
				break
			}
		}
		if !duplicate {
			options = append(options, decoy)
		}
	}

	// Mezclar opciones
	for i := len(options) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		options[i], options[j] = options[j], options[i]
	}

	return options, nil
}

// ApproveWebSession aprueba una solicitud de sesion web.
// El dueno del terminal envia el codigo que eligio de las 4 opciones
// y las horas que desea aprobar (1, 5 o 24).
func (nt *NFCTerminals) ApproveWebSession(ctx context.Context, requestID uuid.UUID, selectedCode string, approvedHours int, approverID uuid.UUID) (string, error) {
	if selectedCode == "" {
		return "", fmt.Errorf("selected_code es requerido")
	}
	if approvedHours != 1 && approvedHours != 5 && approvedHours != 24 {
		approvedHours = 24 // default
	}

	var code, terminalID, terminalPublicKey string
	var status string
	var createdAt time.Time
	err := nt.Pool.QueryRow(ctx, `
		SELECT pairing_code, terminal_id, terminal_public_key, status, created_at
		FROM pos_web_session_requests WHERE id = $1`,
		requestID,
	).Scan(&code, &terminalID, &terminalPublicKey, &status, &createdAt)
	if err != nil {
		return "", fmt.Errorf("solicitud no encontrada")
	}
	if status != "pending" {
		return "", fmt.Errorf("la solicitud ya fue procesada")
	}
	if time.Since(createdAt) > 60*time.Second {
		nt.Pool.Exec(ctx, `UPDATE pos_web_session_requests SET status = 'expired' WHERE id = $1`, requestID)
		return "", fmt.Errorf("el codigo ya expiro")
	}
	if code != selectedCode {
		return "", fmt.Errorf("codigo incorrecto. Verifique con la persona del POS web.")
	}

	// Aprobar la solicitud
	expiresAt := time.Now().Add(time.Duration(approvedHours) * time.Hour)
	_, err = nt.Pool.Exec(ctx, `
		UPDATE pos_web_session_requests
		SET status = 'approved', approved_by = $1, approved_at = NOW(),
		    approved_hours = $2, expires_at = $3
		WHERE id = $4`,
		approverID, approvedHours, expiresAt, requestID,
	)
	if err != nil {
		return "", fmt.Errorf("approving web session: %w", err)
	}

	// Actualizar el terminal con la nueva clave publica del navegador y la expiracion
	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals
		SET terminal_public_key = $1, web_session_expires_at = $2,
		    is_registered = true, is_active = true, updated_at = NOW()
		WHERE terminal_id = $3`,
		terminalPublicKey, expiresAt, terminalID,
	)
	if err != nil {
		return "", fmt.Errorf("updating terminal: %w", err)
	}

	// Obtener la server public key para devolver al POS
	var serverPubKey string
	err = nt.Pool.QueryRow(ctx, `
		SELECT public_key FROM nfc_server_keys WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&serverPubKey)
	if err != nil {
		return "", fmt.Errorf("getting server public key: %w", err)
	}

	return serverPubKey, nil
}

// RejectWebSession rechaza una solicitud de sesion web.
func (nt *NFCTerminals) RejectWebSession(ctx context.Context, requestID uuid.UUID, rejecterID uuid.UUID) error {
	_, err := nt.Pool.Exec(ctx, `
		UPDATE pos_web_session_requests
		SET status = 'rejected', approved_by = $1, approved_at = NOW()
		WHERE id = $2 AND status = 'pending'`,
		rejecterID, requestID,
	)
	if err != nil {
		return fmt.Errorf("rejecting web session: %w", err)
	}
	return nil
}

// RevokeWebSession anula la sesion activa de un terminal web_pos.
// El dueno del terminal puede hacer esto desde su panel.
func (nt *NFCTerminals) RevokeWebSession(ctx context.Context, terminalID string, userID uuid.UUID) error {
	// Verificar que el usuario es el dueno o parte de la organizacion
	var merchantUserID *uuid.UUID
	var orgID *uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT merchant_user_id, organization_id FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&merchantUserID, &orgID)
	if err != nil {
		return fmt.Errorf("terminal no encontrado")
	}

	isOwner := merchantUserID != nil && *merchantUserID == userID
	if !isOwner && orgID != nil && *orgID == userID {
		isOwner = true
	}
	if !isOwner {
		return fmt.Errorf("no tienes permiso para revocar esta sesion")
	}

	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals
		SET web_session_expires_at = NOW(), is_active = false, updated_at = NOW()
		WHERE terminal_id = $1`,
		terminalID,
	)
	if err != nil {
		return fmt.Errorf("revoking web session: %w", err)
	}
	return nil
}

// ListActiveWebSessions lista las sesiones web activas (no expiradas) del usuario.
func (nt *NFCTerminals) ListActiveWebSessions(ctx context.Context, userID uuid.UUID) ([]map[string]interface{}, error) {
	rows, err := nt.Pool.Query(ctx, `
		SELECT t.terminal_id, t.label, t.web_session_expires_at, t.last_seen,
		       t.device_fingerprint, t.is_active
		FROM nfc_terminals t
		WHERE t.terminal_type IN ('web', 'web_pos')
		  AND (t.merchant_user_id = $1 OR t.organization_id = $1)
		ORDER BY t.web_session_expires_at DESC NULLS LAST`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing active web sessions: %w", err)
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var terminalID, label string
		var expiresAt *time.Time
		var lastSeen *time.Time
		var fingerprint *string
		var isActive bool
		if err := rows.Scan(&terminalID, &label, &expiresAt, &lastSeen, &fingerprint, &isActive); err != nil {
			continue
		}
		session := map[string]interface{}{
			"terminal_id": terminalID,
			"label":       label,
			"is_active":   isActive,
			"last_seen":   lastSeen,
			"fingerprint": fingerprint,
		}
		if expiresAt != nil {
			session["expires_at"] = *expiresAt
			session["expired"] = time.Now().After(*expiresAt)
		} else {
			session["expired"] = true
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

// IsWebSessionExpired verifica si la sesion web de un terminal ha expirado.
// Usado por el middleware de password login para bloquear logins en sesiones expiradas.
func (nt *NFCTerminals) IsWebSessionExpired(ctx context.Context, terminalID string) (bool, string) {
	var terminalType string
	var webSessionExpiresAt *time.Time
	var isActive bool
	err := nt.Pool.QueryRow(ctx, `
		SELECT terminal_type, web_session_expires_at, is_active
		FROM nfc_terminals WHERE terminal_id = $1
		ORDER BY updated_at DESC LIMIT 1`,
		terminalID,
	).Scan(&terminalType, &webSessionExpiresAt, &isActive)
	if err != nil {
		return true, "terminal_not_found"
	}
	if terminalType != "web" && terminalType != "web_pos" {
		return false, "" // no es web, no aplica expiracion
	}
	if !isActive {
		return true, "terminal_inactive"
	}
	if webSessionExpiresAt == nil {
		return true, "no_web_session"
	}
	if time.Now().After(*webSessionExpiresAt) {
		return true, "web_session_expired"
	}
	return false, ""
}
