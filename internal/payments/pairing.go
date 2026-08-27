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
	ChipID             string     `json:"chip_id,omitempty"`
	DeviceModel        string     `json:"device_model,omitempty"`
	DeviceManufacturer string     `json:"device_manufacturer,omitempty"`
	AndroidVersion     string     `json:"android_version,omitempty"`
	TerminalLabel      string     `json:"terminal_label,omitempty"`
	TerminalType       string     `json:"terminal_type"`
	Status             string     `json:"status"`
	TerminalID         string     `json:"terminal_id,omitempty"`
	ExpiresAt          time.Time  `json:"expires_at"`
	ApprovedAt         *time.Time `json:"approved_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	RemainingSeconds   int        `json:"remaining_seconds,omitempty"`
	// Info de terminal existente con mismo fingerprint (para re-registros)
	ExistingTerminalID string `json:"existing_terminal_id,omitempty"`
	ExistingLabel      string `json:"existing_label,omitempty"`
	ExistingIsActive   bool   `json:"existing_is_active,omitempty"`
}

// PairingStatus es la respuesta del polling del terminal
type PairingStatus struct {
	Status           string `json:"status"`
	RemainingSeconds int    `json:"remaining_seconds"`
	TerminalID       string `json:"terminal_id,omitempty"`
	ServerPublicKey  string `json:"server_public_key,omitempty"`
	Message          string `json:"message,omitempty"`
}

// InitiatePairing crea una solicitud de emparejamiento con un codigo corto de 6 digitos.
// El terminal envia su clave publica Ed25519, chip_id/fingerprint y datos del dispositivo.
func (nt *NFCTerminals) InitiatePairing(ctx context.Context, terminalPublicKey, deviceFingerprint, label string,
	chipID, deviceModel, deviceManufacturer, androidVersion, terminalType string) (string, error) {
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

	if terminalType == "" {
		terminalType = "android_pos"
	}
	if label == "" {
		label = "POS Android"
	}

	_, err := nt.Pool.Exec(ctx, `
		INSERT INTO terminal_pairing_requests
			(node_domain, pairing_code, terminal_public_key, device_fingerprint,
			 terminal_label, terminal_type, chip_id, device_model, device_manufacturer,
			 android_version, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
		nt.NodeDomain, pairingCode, terminalPublicKey, deviceFingerprint,
		label, terminalType, chipID, deviceModel, deviceManufacturer, androidVersion,
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
		// Obtener la server_public_key del servidor
		var serverPubKey string
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
// mode = "new" crea un terminal nuevo, mode = "replace" actualiza uno existente.
func (nt *NFCTerminals) ApprovePairing(ctx context.Context, code string, adminUserID uuid.UUID, label, terminalType, location, mode string) (*PairingResult, error) {
	// Buscar la solicitud pendiente
	var req PairingRequest
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, terminal_public_key, device_fingerprint, terminal_label, terminal_type, expires_at,
		       chip_id, device_model, device_manufacturer, android_version
		FROM terminal_pairing_requests
		WHERE pairing_code = $1 AND status = 'pending'`,
		code,
	).Scan(&req.ID, &req.TerminalPublicKey, &req.DeviceFingerprint, &req.TerminalLabel, &req.TerminalType, &req.ExpiresAt,
		&req.ChipID, &req.DeviceModel, &req.DeviceManufacturer, &req.AndroidVersion)
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
			terminalType = "android_pos"
		}
	}
	if location == "" {
		location = "Movil"
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

	var terminalID string

	if mode == "replace" && req.DeviceFingerprint != "" {
		// Buscar terminal existente con mismo fingerprint
		var existingID string
		err = nt.Pool.QueryRow(ctx, `
			SELECT terminal_id FROM nfc_terminals
			WHERE device_fingerprint = $1 AND node_domain = $2
			ORDER BY updated_at DESC LIMIT 1`,
			req.DeviceFingerprint, nt.NodeDomain,
		).Scan(&existingID)
		if err != nil {
			return nil, fmt.Errorf("no se encontro terminal existente con ese fingerprint para reemplazar")
		}

		// Actualizar el terminal existente con la nueva clave
		_, err = nt.Pool.Exec(ctx, `
			UPDATE nfc_terminals
			SET terminal_public_key = $3, is_active = true, is_registered = true,
			    label = $4, terminal_type = $5, location = $6,
			    device_model = COALESCE(NULLIF($7, ''), device_model),
			    device_manufacturer = COALESCE(NULLIF($8, ''), device_manufacturer),
			    android_version = COALESCE(NULLIF($9, ''), android_version),
			    registration_token = NULL, updated_at = NOW()
			WHERE terminal_id = $1 AND node_domain = $2`,
			existingID, nt.NodeDomain, req.TerminalPublicKey,
			label, terminalType, location,
			req.DeviceModel, req.DeviceManufacturer, req.AndroidVersion,
		)
		if err != nil {
			return nil, fmt.Errorf("error reemplazando terminal existente: %w", err)
		}
		terminalID = existingID

	} else {
		// Modo "new" o sin fingerprint: crear terminal nuevo

		// Generar terminal_id automatico segun tipo
		fingerprintShort := "AABBCC"
		if len(req.DeviceFingerprint) >= 6 {
			fingerprintShort = req.DeviceFingerprint[:6]
		}

		// Prefijo segun tipo de terminal
		prefix := "TERM-ANDROID"
		if req.ChipID != "" && len(req.ChipID) >= 6 {
			fingerprintShort = req.ChipID[:6]
			prefix = "TERM-ESP32"
		}
		terminalID = fmt.Sprintf("%s-%s", prefix, fingerprintShort)

		// Verificar que el terminal_id no exista ya
		var existingID uuid.UUID
		_ = nt.Pool.QueryRow(ctx, `SELECT id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&existingID)
		if existingID != uuid.Nil {
			// Si ya existe, agregar un sufijo aleatorio
			suffix, _ := generatePairingCode()
			terminalID = fmt.Sprintf("%s-%s%s", prefix, fingerprintShort, suffix[:3])
		}

		// Crear el terminal directamente con la clave publica ya registrada
		_, err = nt.Pool.Exec(ctx, `
			INSERT INTO nfc_terminals
				(node_domain, terminal_id, label, terminal_type, location,
				 terminal_public_key, device_fingerprint, chip_id,
				 device_model, device_manufacturer, android_version,
				 is_active, is_registered)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, true)`,
			nt.NodeDomain, terminalID, label, terminalType, location,
			req.TerminalPublicKey, req.DeviceFingerprint, req.ChipID,
			req.DeviceModel, req.DeviceManufacturer, req.AndroidVersion,
		)
		if err != nil {
			return nil, fmt.Errorf("error creando terminal: %w", err)
		}
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
// e incluye info de terminal existente con mismo fingerprint (para re-registros)
func (nt *NFCTerminals) ListPendingPairings(ctx context.Context) ([]PairingRequest, error) {
	// Primero expirar las que ya vencieron
	_, _ = nt.Pool.Exec(ctx, `
		UPDATE terminal_pairing_requests SET status = 'expired'
		WHERE status = 'pending' AND expires_at < NOW()`)

	rows, err := nt.Pool.Query(ctx, `
		SELECT id, node_domain, pairing_code, terminal_public_key, device_fingerprint,
		       terminal_label, terminal_type, status, expires_at, created_at,
		       chip_id, device_model, device_manufacturer, android_version
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
		var fingerprint, label, chipID, deviceModel, deviceManufacturer, androidVersion sql.NullString
		if err := rows.Scan(&r.ID, &r.NodeDomain, &r.PairingCode, &r.TerminalPublicKey,
			&fingerprint, &label, &r.TerminalType, &r.Status, &r.ExpiresAt, &r.CreatedAt,
			&chipID, &deviceModel, &deviceManufacturer, &androidVersion); err != nil {
			continue
		}
		r.DeviceFingerprint = fingerprint.String
		r.TerminalLabel = label.String
		r.ChipID = chipID.String
		r.DeviceModel = deviceModel.String
		r.DeviceManufacturer = deviceManufacturer.String
		r.AndroidVersion = androidVersion.String
		r.RemainingSeconds = int(time.Until(r.ExpiresAt).Seconds())
		if r.RemainingSeconds < 0 {
			r.RemainingSeconds = 0
		}

		// Buscar si ya existe un terminal con ese fingerprint
		if r.DeviceFingerprint != "" {
			var existingID, existingLabel sql.NullString
			var existingActive bool
			_ = nt.Pool.QueryRow(ctx, `
				SELECT terminal_id, label, is_active FROM nfc_terminals
				WHERE device_fingerprint = $1 AND node_domain = $2
				ORDER BY updated_at DESC LIMIT 1`,
				r.DeviceFingerprint, nt.NodeDomain,
			).Scan(&existingID, &existingLabel, &existingActive)
			if existingID.Valid {
				r.ExistingTerminalID = existingID.String
				r.ExistingLabel = existingLabel.String
				r.ExistingIsActive = existingActive
			}
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
