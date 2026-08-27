package payments

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// PairingRequest representa una solicitud de emparejamiento pendiente
type PairingRequest struct {
	ID                 uuid.UUID  `json:"id"`
	NodeDomain         string     `json:"node_domain"`
	PairingCode        string     `json:"pairing_code"`
	TerminalPublicKey  string     `json:"terminal_public_key"`
	DeviceFingerprint  string     `json:"device_fingerprint,omitempty"`
	TerminalLabel      string     `json:"terminal_label,omitempty"`
	TerminalType       string     `json:"terminal_type"`
	Status             string     `json:"status"`
	TerminalID         string     `json:"terminal_id,omitempty"`
	ExpiresAt          time.Time  `json:"expires_at"`
	ApprovedAt         *time.Time `json:"approved_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	RemainingSeconds   int        `json:"remaining_seconds,omitempty"`
}

// PairingStatus es la respuesta del polling del terminal
type PairingStatus struct {
	Status            string `json:"status"`
	RemainingSeconds  int    `json:"remaining_seconds"`
	TerminalID        string `json:"terminal_id,omitempty"`
	ServerPublicKey   string `json:"server_public_key,omitempty"`
	Message           string `json:"message,omitempty"`
}

// InitiatePairing crea una solicitud de emparejamiento con un codigo corto de 6 digitos.
// El terminal envia su clave publica Ed25519 y el servidor guarda la solicitud
// con una expiracion de 60 segundos.
func (nt *NFCTerminals) InitiatePairing(ctx context.Context, terminalPublicKey, deviceFingerprint, label string) (string, error) {
	if terminalPublicKey == "" {
		return "", fmt.Errorf("terminal_public_key is required")
	}

	// Rate limiting: maximo 3 solicitudes por fingerprint en 5 minutos
	if deviceFingerprint != "" {
		var recentCount int
		_ = nt.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM terminal_pairing_requests
			WHERE device_fingerprint = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
			deviceFingerprint,
		).Scan(&recentCount)
		if recentCount >= 3 {
			return "", fmt.Errorf("demasiadas solicitudes de emparejamiento. Espere 5 minutos.")
		}
	}

	// Generar codigo de 6 digitos unico (reintentar si colisiona)
	var pairingCode string
	for attempts := 0; attempts < 10; attempts++ {
		code, err := generatePairingCode()
		if err != nil {
			return "", fmt.Errorf("generating pairing code: %w", err)
		}
		// Verificar que no exista un codigo pendiente igual
		var exists bool
		_ = nt.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM terminal_pairing_requests
			WHERE pairing_code = $1 AND status = 'pending')`, code,
		).Scan(&exists)
		if !exists {
			pairingCode = code
			break
		}
	}
	if pairingCode == "" {
		return "", fmt.Errorf("no se pudo generar un codigo unico, intente nuevamente")
	}

	terminalType := "android"
	if label == "" {
		label = "POS Android"
	}

	_, err := nt.Pool.Exec(ctx, `
		INSERT INTO terminal_pairing_requests
			(node_domain, pairing_code, terminal_public_key, device_fingerprint, terminal_label, terminal_type, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
		nt.NodeDomain, pairingCode, terminalPublicKey, deviceFingerprint, label, terminalType,
	)
	if err != nil {
		return "", fmt.Errorf("creating pairing request: %w", err)
	}

	return pairingCode, nil
}

// GetPairingStatus consulta el estado de una solicitud de emparejamiento.
// Si el tiempo expiro, marca como expired automaticamente.
func (nt *NFCTerminals) GetPairingStatus(ctx context.Context, code string) (*PairingStatus, error) {
	var req PairingRequest
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, status, expires_at, terminal_id
		FROM terminal_pairing_requests WHERE pairing_code = $1`,
		code,
	).Scan(&req.ID, &req.Status, &req.ExpiresAt, &req.TerminalID)
	if err != nil {
		return nil, fmt.Errorf("codigo de emparejamiento no encontrado")
	}

	remaining := int(time.Until(req.ExpiresAt).Seconds())

	// Auto-expirar si el tiempo se agoto
	if (req.Status == "pending") && remaining <= 0 {
		nt.Pool.Exec(ctx, `UPDATE terminal_pairing_requests SET status = 'expired' WHERE id = $1`, req.ID)
		return &PairingStatus{
			Status:           "expired",
			RemainingSeconds: 0,
			Message:          "Tiempo agotado. Intente nuevamente.",
		}, nil
	}

	if req.Status == "approved" {
		// Obtener la server_public_key del terminal registrado
		var serverPubKey string
		_ = nt.Pool.QueryRow(ctx, `
			SELECT terminal_public_key FROM nfc_terminals WHERE terminal_id = $1`,
			req.TerminalID,
		).Scan(&serverPubKey)
		// No, necesitamos la server_public_key, no la terminal_public_key
		// La server_public_key esta en nfc_server_keys
		_ = nt.Pool.QueryRow(ctx, `
			SELECT public_key FROM nfc_server_keys WHERE node_domain = $1`,
			nt.NodeDomain,
		).Scan(&serverPubKey)

		return &PairingStatus{
			Status:           "approved",
			RemainingSeconds: 0,
			TerminalID:       req.TerminalID,
			ServerPublicKey:  serverPubKey,
			Message:          "Terminal aprobado y registrado exitosamente.",
		}, nil
	}

	if req.Status == "rejected" {
		return &PairingStatus{
			Status:           "rejected",
			RemainingSeconds: 0,
			Message:          "Solicitud rechazada por el administrador.",
		}, nil
	}

	if req.Status == "expired" {
		return &PairingStatus{
			Status:           "expired",
			RemainingSeconds: 0,
			Message:          "Tiempo agotado. Intente nuevamente.",
		}, nil
	}

	// pending
	return &PairingStatus{
		Status:           "pending",
		RemainingSeconds: remaining,
		Message:          "Esperando aprobacion del administrador.",
	}, nil
}

// ApprovePairing aprueba una solicitud de emparejamiento pendiente.
// Crea el terminal en nfc_terminals, registra la clave publica, y marca
// la solicitud como approved. El terminal descubre el resultado via polling.
func (nt *NFCTerminals) ApprovePairing(ctx context.Context, code string, adminUserID uuid.UUID, label, terminalType, location string) (*PairingResult, error) {
	// Buscar la solicitud pendiente
	var req PairingRequest
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, terminal_public_key, device_fingerprint, terminal_label, terminal_type, expires_at
		FROM terminal_pairing_requests
		WHERE pairing_code = $1 AND status = 'pending'`,
		code,
	).Scan(&req.ID, &req.TerminalPublicKey, &req.DeviceFingerprint, &req.TerminalLabel, &req.TerminalType, &req.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("codigo no encontrado o ya procesado")
	}

	// Verificar que no ha expirado
	if time.Now().After(req.ExpiresAt) {
		nt.Pool.Exec(ctx, `UPDATE terminal_pairing_requests SET status = 'expired' WHERE id = $1`, req.ID)
		return nil, fmt.Errorf("el codigo ya expiro")
	}

	// Usar label/type proporcionados o los de la solicitud
	if label == "" {
		label = req.TerminalLabel
		if label == "" {
			label = "POS Android"
		}
	}
	if terminalType == "" {
		terminalType = req.TerminalType
		if terminalType == "" {
			terminalType = "android"
		}
	}
	if location == "" {
		location = "Movil"
	}

	// Generar terminal_id automatico
	fingerprintShort := "AABBCC"
	if len(req.DeviceFingerprint) >= 6 {
		fingerprintShort = req.DeviceFingerprint[:6]
	}
	terminalID := fmt.Sprintf("TERM-ANDROID-%s", fingerprintShort)

	// Verificar que el terminal_id no exista ya
	var existingID uuid.UUID
	_ = nt.Pool.QueryRow(ctx, `SELECT id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&existingID)
	if existingID != uuid.Nil {
		// Si ya existe, agregar un sufijo aleatorio
		suffix, _ := generatePairingCode()
		terminalID = fmt.Sprintf("TERM-ANDROID-%s%s", fingerprintShort, suffix[:3])
	}

	// Crear el terminal directamente con la clave publica ya registrada
	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_terminals
			(node_domain, terminal_id, label, terminal_type, location,
			 terminal_public_key, device_fingerprint, is_active, is_registered)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)`,
		nt.NodeDomain, terminalID, label, terminalType, location,
		req.TerminalPublicKey, req.DeviceFingerprint,
	)
	if err != nil {
		return nil, fmt.Errorf("error creando terminal: %w", err)
	}

	// Asegurar que las claves del servidor existan
	if err := nt.EnsureServerKeys(ctx); err != nil {
		return nil, fmt.Errorf("error asegurando claves del servidor: %w", err)
	}

	// Obtener la server_public_key
	var serverPubKey string
	err = nt.Pool.QueryRow(ctx, `
		SELECT public_key FROM nfc_server_keys WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&serverPubKey)
	if err != nil {
		return nil, fmt.Errorf("error obteniendo clave publica del servidor: %w", err)
	}

	// Marcar la solicitud como approved
	_, err = nt.Pool.Exec(ctx, `
		UPDATE terminal_pairing_requests
		SET status = 'approved', admin_user_id = $2, terminal_id = $3, approved_at = NOW()
		WHERE id = $1`,
		req.ID, adminUserID, terminalID,
	)
	if err != nil {
		return nil, fmt.Errorf("error aprobando solicitud: %w", err)
	}

	return &PairingResult{
		TerminalID:      terminalID,
		ServerPublicKey: serverPubKey,
		Status:          "approved",
	}, nil
}

// PairingResult es el resultado de aprobar un emparejamiento
type PairingResult struct {
	TerminalID      string `json:"terminal_id"`
	ServerPublicKey string `json:"server_public_key"`
	Status          string `json:"status"`
}

// RejectPairing rechaza una solicitud de emparejamiento
func (nt *NFCTerminals) RejectPairing(ctx context.Context, code string, adminUserID uuid.UUID) error {
	_, err := nt.Pool.Exec(ctx, `
		UPDATE terminal_pairing_requests
		SET status = 'rejected', admin_user_id = $2
		WHERE pairing_code = $1 AND status = 'pending'`,
		code, adminUserID,
	)
	if err != nil {
		return fmt.Errorf("error rechazando solicitud: %w", err)
	}
	return nil
}

// ListPendingPairings lista las solicitudes de emparejamiento pendientes
func (nt *NFCTerminals) ListPendingPairings(ctx context.Context) ([]PairingRequest, error) {
	// Primero expirar las que ya vencieron
	_, _ = nt.Pool.Exec(ctx, `
		UPDATE terminal_pairing_requests SET status = 'expired'
		WHERE status = 'pending' AND expires_at < NOW()`)

	rows, err := nt.Pool.Query(ctx, `
		SELECT id, node_domain, pairing_code, terminal_public_key, device_fingerprint,
		       terminal_label, terminal_type, status, expires_at, created_at
		FROM terminal_pairing_requests
		WHERE node_domain = $1 AND status = 'pending'
		ORDER BY created_at DESC`,
		nt.NodeDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("listing pending pairings: %w", err)
	}
	defer rows.Close()

	var requests []PairingRequest
	for rows.Next() {
		var r PairingRequest
		var fingerprint sql.NullString
		var label sql.NullString
		if err := rows.Scan(&r.ID, &r.NodeDomain, &r.PairingCode, &r.TerminalPublicKey,
			&fingerprint, &label, &r.TerminalType, &r.Status, &r.ExpiresAt, &r.CreatedAt); err != nil {
			continue
		}
		r.DeviceFingerprint = fingerprint.String
		r.TerminalLabel = label.String
		r.RemainingSeconds = int(time.Until(r.ExpiresAt).Seconds())
		if r.RemainingSeconds < 0 {
			r.RemainingSeconds = 0
		}
		requests = append(requests, r)
	}
	return requests, nil
}

// generatePairingCode genera un codigo aleatorio de 6 digitos
func generatePairingCode() (string, error) {
	bytes := make([]byte, 3)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	// Convertir a numero de 6 digitos
	num := int(bytes[0])<<16 | int(bytes[1])<<8 | int(bytes[2])
	code := num % 1000000
	return fmt.Sprintf("%06d", code), nil
}
