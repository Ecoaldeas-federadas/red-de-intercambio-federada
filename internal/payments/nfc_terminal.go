package payments

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"federated-credit-node/internal/crypto"
	"federated-credit-node/internal/payments/cards"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type NFCTerminal struct {
	ID                 uuid.UUID  `json:"id"`
	NodeDomain         string     `json:"node_domain"`
	TerminalID         string     `json:"terminal_id"`
	Label              *string    `json:"label"`
	TerminalType       string     `json:"terminal_type"`
	Location           *string    `json:"location"`
	ChipID             *string    `json:"chip_id,omitempty"`
	FirmwareBinaryPath string     `json:"firmware_binary_path,omitempty"`
	TerminalPublicKey  *string    `json:"terminal_public_key,omitempty"`
	ServerPublicKey    *string    `json:"server_public_key,omitempty"`
	RegistrationToken  *string    `json:"registration_token,omitempty"`
	DeviceFingerprint  *string    `json:"device_fingerprint,omitempty"`
	IsActive           bool       `json:"is_active"`
	IsRegistered       bool       `json:"is_registered"`
	LastSeen           *time.Time `json:"last_seen"`
	FirmwareVersion    *string    `json:"firmware_version"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	// Info de dispositivo (migration 127)
	DeviceModel        *string `json:"device_model,omitempty"`
	DeviceManufacturer *string `json:"device_manufacturer,omitempty"`
	AndroidVersion     *string `json:"android_version,omitempty"`
	// Asignacion
	OrganizationID   *uuid.UUID `json:"organization_id,omitempty"`
	OrganizationName *string    `json:"organization_name,omitempty"`
	MerchantUserID   *uuid.UUID `json:"merchant_user_id,omitempty"`
	MerchantUserName *string    `json:"merchant_user_name,omitempty"`
}

type NFCTerminalSession struct {
	ID                uuid.UUID  `json:"id"`
	TerminalID        uuid.UUID  `json:"terminal_id"`
	SessionToken      string     `json:"session_token"`
	MerchantUserID    *uuid.UUID `json:"merchant_user_id"`
	CurrentAmount     *int64     `json:"current_amount"`
	Status            string     `json:"status"`
	SellerCardUID     string     `json:"seller_card_uid,omitempty"`
	SellerPinVerified bool       `json:"seller_pin_verified"`
	BuyerCardUID      string     `json:"buyer_card_uid,omitempty"`
	ExpiresAt         time.Time  `json:"expires_at"`
	CreatedAt         time.Time  `json:"created_at"`
}

type NFCTransaction struct {
	ID              uuid.UUID  `json:"id"`
	TerminalID      uuid.UUID  `json:"terminal_id"`
	CardUID         string     `json:"card_uid"`
	UserID          *uuid.UUID `json:"user_id"`
	Amount          int64      `json:"amount"`
	Status          string     `json:"status"`
	CryptoToken     string     `json:"crypto_token,omitempty"`
	PinVerified     bool       `json:"pin_verified"`
	TransactionType string     `json:"transaction_type"`
	SellerUserID    *uuid.UUID `json:"seller_user_id,omitempty"`
	BuyerUserID     *uuid.UUID `json:"buyer_user_id,omitempty"`
	ErrorMessage    string     `json:"error_message,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type NFCTerminals struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func NewNFCTerminals(pool *pgxpool.Pool, nodeDomain string) *NFCTerminals {
	return &NFCTerminals{Pool: pool, NodeDomain: nodeDomain}
}

func (nt *NFCTerminals) RegisterTerminal(ctx context.Context, terminalID, label, terminalType, location, deviceFingerprint string) (*NFCTerminal, string, error) {
	token := uuid.New().String()

	var t NFCTerminal
	err := nt.Pool.QueryRow(ctx, `
		INSERT INTO nfc_terminals (node_domain, terminal_id, label, terminal_type, location, registration_token, device_fingerprint)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, node_domain, terminal_id, label, terminal_type, location,
			registration_token, is_active, is_registered, last_seen, firmware_version, created_at, updated_at`,
		nt.NodeDomain, terminalID, label, terminalType, location, token, deviceFingerprint,
	).Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.Label, &t.TerminalType,
		&t.Location, &t.RegistrationToken, &t.IsActive, &t.IsRegistered,
		&t.LastSeen, &t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, "", fmt.Errorf("registering terminal: %w", err)
	}
	return &t, token, nil
}

// ProvisionTerminal registra un terminal vinculado a un chip ID de hardware especifico.
// El chip_id es el MAC/efuse del ESP32 — el firmware compilado no funcionara en otro chip.
// Retorna el terminal creado y el registration_token para incluir en el config.h generado.
func (nt *NFCTerminals) ProvisionTerminal(ctx context.Context, terminalID, chipID, label, terminalType, location string) (*NFCTerminal, string, error) {
	token := uuid.New().String()

	var t NFCTerminal
	err := nt.Pool.QueryRow(ctx, `
		INSERT INTO nfc_terminals (node_domain, terminal_id, chip_id, label, terminal_type, location, registration_token)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, node_domain, terminal_id, chip_id, label, terminal_type, location,
			registration_token, is_active, is_registered, last_seen, firmware_version, created_at, updated_at`,
		nt.NodeDomain, terminalID, chipID, label, terminalType, location, token,
	).Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.ChipID, &t.Label, &t.TerminalType,
		&t.Location, &t.RegistrationToken, &t.IsActive, &t.IsRegistered,
		&t.LastSeen, &t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, "", fmt.Errorf("provisioning terminal: %w", err)
	}
	return &t, token, nil
}

// GetTerminalForProvisioning busca un terminal por terminal_id que aun no ha sido
// registrado por el ESP32 (tiene registration_token activo). Retorna el terminal
// y su registration_token para generar el config.h.
func (nt *NFCTerminals) GetTerminalForProvisioning(ctx context.Context, terminalID string) (*NFCTerminal, string, error) {
	var t NFCTerminal
	var token *string
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, node_domain, terminal_id, chip_id, label, terminal_type, location,
			registration_token, is_active, is_registered, last_seen, firmware_version, created_at, updated_at
		FROM nfc_terminals
		WHERE terminal_id = $1 AND is_active = true AND is_registered = false AND registration_token IS NOT NULL`,
		terminalID,
	).Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.ChipID, &t.Label, &t.TerminalType,
		&t.Location, &token, &t.IsActive, &t.IsRegistered,
		&t.LastSeen, &t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, "", fmt.Errorf("terminal not found or already registered: %w", err)
	}
	if token == nil {
		return nil, "", fmt.Errorf("terminal has no registration token")
	}
	t.RegistrationToken = token
	return &t, *token, nil
}

func (nt *NFCTerminals) CompleteRegistration(ctx context.Context, terminalID, registrationToken, terminalPublicKey, deviceFingerprint string) (string, error) {
	var serverPubKey string
	var t NFCTerminal
	err := nt.Pool.QueryRow(ctx, `
		UPDATE nfc_terminals
		SET terminal_public_key = $3, is_registered = true, registration_token = NULL,
		    device_fingerprint = COALESCE(NULLIF($4, ''), device_fingerprint),
		    updated_at = NOW()
		WHERE terminal_id = $1 AND registration_token = $2 AND is_active = true
		RETURNING id, node_domain, terminal_id, label, terminal_type, location,
			terminal_public_key, is_active, is_registered, last_seen, firmware_version, created_at, updated_at`,
		terminalID, registrationToken, terminalPublicKey, deviceFingerprint,
	).Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.Label, &t.TerminalType,
		&t.Location, &t.TerminalPublicKey, &t.IsActive, &t.IsRegistered,
		&t.LastSeen, &t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return "", fmt.Errorf("completing terminal registration: %w", err)
	}

	if err := nt.EnsureServerKeys(ctx); err != nil {
		return "", fmt.Errorf("ensuring server keys: %w", err)
	}

	err = nt.Pool.QueryRow(ctx, `
		SELECT public_key FROM nfc_server_keys WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&serverPubKey)
	if err != nil {
		return "", fmt.Errorf("getting server public key: %w", err)
	}

	return serverPubKey, nil
}

// AutoRenewKeys permite a un terminal actualizar sus claves criptograficas
// automaticamente cuando se pierden (app reinstalada, datos borrados, etc.).
// Verifica que el terminal_id existe Y que el device_fingerprint coincide
// con el registrado. Si coincide, actualiza terminal_public_key y devuelve
// el server_public_key. Esto evita que el usuario tenga que re-parear manualmente
// despues de actualizar o reinstalar la app.
func (nt *NFCTerminals) AutoRenewKeys(ctx context.Context, terminalID, newTerminalPublicKey, deviceFingerprint string) (string, error) {
	// 1. Verificar que el terminal existe y que el device_fingerprint coincide
	var storedFingerprint string
	var isActive bool
	err := nt.Pool.QueryRow(ctx, `
		SELECT COALESCE(device_fingerprint, ''), is_active FROM nfc_terminals
		WHERE terminal_id = $1 AND is_registered = true`,
		terminalID,
	).Scan(&storedFingerprint, &isActive)
	if err != nil {
		return "", fmt.Errorf("terminal not found: %w", err)
	}

	if !isActive {
		return "", fmt.Errorf("terminal is not active")
	}

	// 2. Verificar que el device_fingerprint coincide
	// Si el stored fingerprint esta vacio (terminal viejo sin fingerprint),
	// permitir la renovacion (migracion)
	if storedFingerprint != "" && deviceFingerprint != "" && storedFingerprint != deviceFingerprint {
		return "", fmt.Errorf("device fingerprint mismatch: terminal may belong to a different device")
	}

	// 3. Actualizar la clave publica del terminal
	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals
		SET terminal_public_key = $2, updated_at = NOW()
		WHERE terminal_id = $1 AND is_active = true`,
		terminalID, newTerminalPublicKey,
	)
	if err != nil {
		return "", fmt.Errorf("updating terminal public key: %w", err)
	}

	// 4. Devolver el server_public_key
	if err := nt.EnsureServerKeys(ctx); err != nil {
		return "", fmt.Errorf("ensuring server keys: %w", err)
	}

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

// IsUserAuthorizedForTerminal verifica si un usuario tiene permiso para usar
// un terminal. Verifica en orden:
// 1. merchant_user_id == userID (persona asignada directamente)
// 2. Existe en nfc_terminal_authorized_users (personas adicionales)
// 3. department_id IS NOT NULL → userID es miembro del departamento
// 4. organization_id IS NOT NULL → userID es board member de la organizacion
// 5. Todo NULL (sin asignar) → true (admin asigna despues)
// 6. Todo lo demas → false
func (nt *NFCTerminals) IsUserAuthorizedForTerminal(ctx context.Context, terminalID string, userID uuid.UUID) (bool, error) {
	var merchantUserID *uuid.UUID
	var orgID *uuid.UUID
	var deptID *uuid.UUID

	err := nt.Pool.QueryRow(ctx, `
		SELECT merchant_user_id, organization_id, department_id
		FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&merchantUserID, &orgID, &deptID)
	if err != nil {
		return false, fmt.Errorf("terminal not found: %w", err)
	}

	// 1. Sin asignar — permitir (admin asigna despues)
	if merchantUserID == nil && orgID == nil && deptID == nil {
		return true, nil
	}

	// 2. merchant_user_id coincide
	if merchantUserID != nil && *merchantUserID == userID {
		return true, nil
	}

	// 3. En nfc_terminal_authorized_users
	var authCount int
	err = nt.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM nfc_terminal_authorized_users
		WHERE terminal_id = $1 AND user_id = $2`,
		terminalID, userID,
	).Scan(&authCount)
	if err == nil && authCount > 0 {
		return true, nil
	}

	// 4. Miembro del departamento
	if deptID != nil {
		var deptCount int
		err = nt.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM department_members
			WHERE department_id = $1 AND user_id = $2`,
			*deptID, userID,
		).Scan(&deptCount)
		if err == nil && deptCount > 0 {
			return true, nil
		}
	}

	// 5. Board member de la organizacion
	if orgID != nil {
		var boardCount int
		err = nt.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM organization_board_members
			WHERE organization_id = $1 AND user_id = $2`,
			*orgID, userID,
		).Scan(&boardCount)
		if err == nil && boardCount > 0 {
			return true, nil
		}
	}

	return false, nil
}

// AuthenticateTerminal verifica la firma Ed25519 del terminal Y la huella del dispositivo.
// El mensaje firmado por el terminal es: terminal_id:nonce:device_fingerprint
// Esto asegura que incluso si alguien copia la clave privada, no puede autenticar
// desde otro dispositivo porque el fingerprint no coincidira.
func (nt *NFCTerminals) AuthenticateTerminal(ctx context.Context, terminalID string, signature []byte, nonce, deviceFingerprint string, serverPrivKey ed25519.PrivateKey) (string, error) {
	var t NFCTerminal
	var pubKeyStr, storedFingerprint *string
	var terminalType string
	var webSessionExpiresAt *time.Time
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, terminal_public_key, device_fingerprint, terminal_type, web_session_expires_at
		FROM nfc_terminals
		WHERE terminal_id = $1 AND is_active = true AND is_registered = true`,
		terminalID,
	).Scan(&t.ID, &pubKeyStr, &storedFingerprint, &terminalType, &webSessionExpiresAt)
	if err != nil {
		return "", fmt.Errorf("terminal not found or not registered")
	}

	// Verificar expiracion de sesion web (solo terminales web)
	if (terminalType == "web" || terminalType == "web_pos") && webSessionExpiresAt != nil {
		if time.Now().After(*webSessionExpiresAt) {
			// Marcar como inactivo para forzar re-validacion
			nt.Pool.Exec(ctx, `UPDATE nfc_terminals SET is_active = false WHERE id = $1`, t.ID)
			return "", fmt.Errorf("web_session_expired")
		}
	}

	if pubKeyStr == nil || *pubKeyStr == "" {
		return "", fmt.Errorf("terminal has no public key")
	}

	pubKey, err := hex.DecodeString(*pubKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid terminal public key")
	}

	// Verificar fingerprint si el terminal tiene uno registrado
	// (terminales web_pos siempre tienen fingerprint; terminales fisicos pueden no tenerlo)
	if storedFingerprint != nil && *storedFingerprint != "" && deviceFingerprint != "" {
		if *storedFingerprint != deviceFingerprint {
			return "", fmt.Errorf("device fingerprint mismatch - terminal may have been cloned")
		}
	}

	// El mensaje firmado es: terminal_id:nonce:fingerprint
	// Si no hay fingerprint, el mensaje es: terminal_id:nonce
	signedMessage := terminalID + ":" + nonce
	if deviceFingerprint != "" {
		signedMessage += ":" + deviceFingerprint
	}

	if !ed25519.Verify(ed25519.PublicKey(pubKey), []byte(signedMessage), signature) {
		return "", fmt.Errorf("terminal signature verification failed")
	}

	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals SET last_seen = NOW() WHERE id = $1`,
		t.ID,
	)
	if err != nil {
		return "", fmt.Errorf("updating last seen: %w", err)
	}

	sessionToken := uuid.New().String()
	respSig := ed25519.Sign(serverPrivKey, []byte(sessionToken))

	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_terminal_sessions (terminal_id, session_token, status)
		VALUES ($1, $2, 'idle')`,
		t.ID, sessionToken,
	)
	if err != nil {
		return "", fmt.Errorf("creating session: %w", err)
	}

	_ = respSig
	return sessionToken, nil
}

func (nt *NFCTerminals) Heartbeat(ctx context.Context, terminalID string) error {
	_, err := nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals SET last_seen = NOW() WHERE terminal_id = $1`,
		terminalID,
	)
	if err != nil {
		return fmt.Errorf("heartbeat: %w", err)
	}
	return nil
}

// HeartbeatWithStatus actualiza last_seen y retorna si el terminal esta activo.
// El terminal usa esto para saber si el dueño cerro el punto desde su panel web.
func (nt *NFCTerminals) HeartbeatWithStatus(ctx context.Context, terminalID string) (bool, error) {
	var isActive bool
	err := nt.Pool.QueryRow(ctx, `
		UPDATE nfc_terminals SET last_seen = NOW()
		WHERE terminal_id = $1
		RETURNING is_active`,
		terminalID,
	).Scan(&isActive)
	if err != nil {
		return false, fmt.Errorf("heartbeat: %w", err)
	}
	return isActive, nil
}

// HeartbeatFull retorna el estado completo del terminal: is_active, is_registered
// y la terminal_public_key registrada en el servidor.
// El terminal usa esto para verificar que sigue registrado, activo y que las
// claves criptograficas coinciden antes de cada transaccion.
// Si is_registered=false o el terminal no existe, el cliente debe volver a
// la pantalla de emparejamiento. Si key_mismatch=true, las claves del terminal
// cambiaron y debe re-parear.
func (nt *NFCTerminals) HeartbeatFull(ctx context.Context, terminalID string) (isActive, isRegistered bool, registeredPubKey string, err error) {
	err = nt.Pool.QueryRow(ctx, `
		UPDATE nfc_terminals SET last_seen = NOW()
		WHERE terminal_id = $1
		RETURNING is_active, is_registered, COALESCE(terminal_public_key, '')`,
		terminalID,
	).Scan(&isActive, &isRegistered, &registeredPubKey)
	if err != nil {
		return false, false, "", fmt.Errorf("heartbeat: %w", err)
	}
	return isActive, isRegistered, registeredPubKey, nil
}

func (nt *NFCTerminals) GetTerminalStatus(ctx context.Context, terminalID string) (*NFCTerminal, error) {
	var t NFCTerminal
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, node_domain, terminal_id, label, terminal_type, location,
			is_active, is_registered, last_seen, firmware_version, created_at, updated_at
		FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.Label, &t.TerminalType,
		&t.Location, &t.IsActive, &t.IsRegistered,
		&t.LastSeen, &t.FirmwareVersion, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("terminal not found: %w", err)
	}
	return &t, nil
}

func (nt *NFCTerminals) ListTerminals(ctx context.Context, nodeDomain string) ([]NFCTerminal, error) {
	rows, err := nt.Pool.Query(ctx, `
		SELECT t.id, t.node_domain, t.terminal_id, t.label, t.terminal_type, t.location,
			t.is_active, t.is_registered, t.last_seen, t.firmware_version, t.created_at, t.updated_at,
			t.chip_id, t.device_fingerprint, t.device_model, t.device_manufacturer, t.android_version,
			t.organization_id, org.username, org.display_name,
			t.merchant_user_id, merchant.username, merchant.display_name
		FROM nfc_terminals t
		LEFT JOIN users org ON org.id = t.organization_id
		LEFT JOIN users merchant ON merchant.id = t.merchant_user_id
		WHERE t.node_domain = $1 ORDER BY t.created_at DESC`,
		nodeDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("listing terminals: %w", err)
	}
	defer rows.Close()

	var terminals []NFCTerminal
	for rows.Next() {
		var t NFCTerminal
		var chipID, deviceFingerprint, deviceModel, deviceManufacturer, androidVersion, firmwareVersion sql.NullString
		var orgID, merchantID sql.NullString
		var orgUsername, orgDisplayName, merchantUsername, merchantDisplayName sql.NullString
		if err := rows.Scan(&t.ID, &t.NodeDomain, &t.TerminalID, &t.Label, &t.TerminalType,
			&t.Location, &t.IsActive, &t.IsRegistered,
			&t.LastSeen, &firmwareVersion, &t.CreatedAt, &t.UpdatedAt,
			&chipID, &deviceFingerprint, &deviceModel, &deviceManufacturer, &androidVersion,
			&orgID, &orgUsername, &orgDisplayName,
			&merchantID, &merchantUsername, &merchantDisplayName); err != nil {
			return nil, fmt.Errorf("scanning terminal: %w", err)
		}
		t.ChipID = strPtr(chipID)
		t.DeviceFingerprint = strPtr(deviceFingerprint)
		t.DeviceModel = strPtr(deviceModel)
		t.DeviceManufacturer = strPtr(deviceManufacturer)
		t.AndroidVersion = strPtr(androidVersion)
		t.FirmwareVersion = strPtr(firmwareVersion)
		if orgID.Valid {
			id, _ := uuid.Parse(orgID.String)
			t.OrganizationID = &id
			name := orgDisplayName.String
			if name == "" {
				name = orgUsername.String
			}
			t.OrganizationName = &name
		}
		if merchantID.Valid {
			id, _ := uuid.Parse(merchantID.String)
			t.MerchantUserID = &id
			name := merchantDisplayName.String
			if name == "" {
				name = merchantUsername.String
			}
			t.MerchantUserName = &name
		}
		terminals = append(terminals, t)
	}
	return terminals, nil
}

func (nt *NFCTerminals) ListTerminalTypes() []string {
	return []string{"keypad", "web", "touch", "community", "android_pos", "ble-reader"}
}

func (nt *NFCTerminals) DeactivateTerminal(ctx context.Context, terminalID string) error {
	_, err := nt.Pool.Exec(ctx, `
		UPDATE nfc_terminals SET is_active = false, updated_at = NOW() WHERE terminal_id = $1`,
		terminalID,
	)
	if err != nil {
		return fmt.Errorf("deactivating terminal: %w", err)
	}
	return nil
}

func (nt *NFCTerminals) CreateSession(ctx context.Context, terminalID string, merchantUserID *uuid.UUID) (*NFCTerminalSession, error) {
	var termID uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
		terminalID,
	).Scan(&termID)
	if err != nil {
		return nil, fmt.Errorf("terminal not found")
	}

	sessionToken := uuid.New().String()
	var s NFCTerminalSession
	err = nt.Pool.QueryRow(ctx, `
		INSERT INTO nfc_terminal_sessions (terminal_id, session_token, merchant_user_id, status)
		VALUES ($1, $2, $3, 'idle')
		RETURNING id, terminal_id, session_token, merchant_user_id, current_amount, status, expires_at, created_at`,
		termID, sessionToken, merchantUserID,
	).Scan(&s.ID, &s.TerminalID, &s.SessionToken, &s.MerchantUserID,
		&s.CurrentAmount, &s.Status, &s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}
	return &s, nil
}

func (nt *NFCTerminals) SetTerminalAmount(ctx context.Context, sessionToken string, amount int64) (*NFCTerminalSession, error) {
	var s NFCTerminalSession
	err := nt.Pool.QueryRow(ctx, `
		UPDATE nfc_terminal_sessions
		SET current_amount = $2, status = 'waiting_card'
		WHERE session_token = $1 AND expires_at > NOW()
		RETURNING id, terminal_id, session_token, merchant_user_id, current_amount, status, expires_at, created_at`,
		sessionToken, amount,
	).Scan(&s.ID, &s.TerminalID, &s.SessionToken, &s.MerchantUserID,
		&s.CurrentAmount, &s.Status, &s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("setting amount: %w", err)
	}
	return &s, nil
}

type NFCPaymentPayload struct {
	CardUID          string `json:"card_uid"`
	CryptoToken      string `json:"crypto_token"`
	PIN              string `json:"pin"`
	Amount           int64  `json:"amount"`
	Timestamp        int64  `json:"timestamp"`
	Nonce            string `json:"nonce"`
	IDDocumentType   string `json:"id_document_type,omitempty"`
	IDDocumentNumber string `json:"id_document_number,omitempty"`
}

type NFCPaymentResult struct {
	Status        string `json:"status"`
	TransactionID string `json:"transaction_id,omitempty"`
	Message       string `json:"message,omitempty"`
	UserBalance   *int64 `json:"user_balance,omitempty"`
	// Campos para multifirma (cuando status == "pending_multisig")
	PendingID     string `json:"pending_id,omitempty"`
	RequiredSigs  int    `json:"required_sigs,omitempty"`
	CollectedSigs int    `json:"collected_sigs,omitempty"`
	RemainingSigs int    `json:"remaining_sigs,omitempty"`
}

func (nt *NFCTerminals) ProcessNFCPayment(ctx context.Context, terminalID string, payload NFCPaymentPayload) (*NFCPaymentResult, error) {
	var termDBID uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
		terminalID,
	).Scan(&termDBID)
	if err != nil {
		return nil, fmt.Errorf("terminal not found or inactive")
	}

	card, err := nt.lookupCard(ctx, payload.CardUID)
	if err != nil {
		nt.logTransaction(ctx, termDBID, payload.CardUID, nil, payload.Amount, "rejected", payload.CryptoToken, false, "single", "", "card not found")
		return &NFCPaymentResult{Status: "rejected", Message: "tarjeta no encontrada o inactiva"}, nil
	}

	if card.PinHash != nil {
		blocked, err := nt.checkCardBlocked(ctx, payload.CardUID)
		if err != nil {
			return nil, err
		}
		if blocked {
			nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, false, "single", "", "card blocked")
			return &NFCPaymentResult{Status: "rejected", Message: "tarjeta bloqueada por intentos de PIN"}, nil
		}

		if err := bcrypt.CompareHashAndPassword([]byte(*card.PinHash), []byte(payload.PIN)); err != nil {
			nt.incrementCardAttempt(ctx, payload.CardUID)
			nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, false, "single", "", "invalid PIN")
			return &NFCPaymentResult{Status: "rejected", Message: "PIN incorrecto"}, nil
		}

		nt.resetCardAttempts(ctx, payload.CardUID)
	}

	// Verificacion de documento de identidad para tarjetas UID-only
	// (solo si el nodo lo tiene configurado y la tarjeta no es segura)
	if card.CardType == "uid_only" {
		requireDoc, err := nt.checkRequireIDDocument(ctx)
		if err == nil && requireDoc {
			if payload.IDDocumentNumber == "" {
				nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, true, "single", "", "id document required but not provided")
				return &NFCPaymentResult{Status: "rejected", Message: "se requiere documento de identidad para esta tarjeta"}, nil
			}
			matched, err := nt.verifyIDDocument(ctx, card.UserID, payload.IDDocumentType, payload.IDDocumentNumber)
			if err != nil || !matched {
				nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, true, "single", "", "id document mismatch")
				return &NFCPaymentResult{Status: "rejected", Message: "documento de identidad no coincide"}, nil
			}
		}
	}

	var balance, creditLimit int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance, credit_limit FROM users WHERE id = $1`, card.UserID).Scan(&balance, &creditLimit)
	if err != nil {
		return nil, fmt.Errorf("getting user balance: %w", err)
	}

	// Filosofia moneda cero: el saldo puede ser negativo.
	// El pago se rechaza solo al llegar al tope de credito (credit_limit),
	// no por "saldo insuficiente" convencional.
	if balance-payload.Amount < creditLimit {
		nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, true, "single", "", "limite de credito alcanzado")
		return &NFCPaymentResult{Status: "rejected", Message: "has llegado al tope de tu credito comunitario. Debes aportar a la comunidad para poder pagar nuevamente."}, nil
	}

	// Verificar si la cuenta del comprador requiere multi-firma
	reqSigs, _, err := nt.checkAccountMultiSig(ctx, card.UserID)
	if err == nil && reqSigs > 1 {
		// Crear pago pendiente multi-firma
		msig := NewMultiSigPayments(nt.Pool, nt.NodeDomain)
		// Necesitamos el merchant_id del terminal para saber a quien se le paga
		var merchantID *uuid.UUID
		_ = nt.Pool.QueryRow(ctx, `SELECT merchant_user_id FROM nfc_terminals WHERE id = $1`, termDBID).Scan(&merchantID)
		if merchantID == nil {
			return &NFCPaymentResult{Status: "rejected", Message: "terminal no tiene comerciante asignado"}, nil
		}
		pending, err := msig.CreatePendingPayment(ctx, CreatePendingPaymentParams{
			PaymentType:   "nfc",
			FromAccount:   card.UserID,
			ToAccount:     *merchantID,
			Amount:        payload.Amount,
			PaymentMethod: "nfc",
			TerminalID:    &termDBID,
			Description:   "Pago NFC multi-firma",
		})
		if err != nil {
			return &NFCPaymentResult{Status: "rejected", Message: "error creando pago multi-firma: " + err.Error()}, nil
		}
		// La primera firma es del comprador que acerco su tarjeta
		remaining, _, _ := msig.SignPendingPayment(ctx, pending.ID, card.UserID, "nfc_card", payload.CardUID, true, payload.IDDocumentNumber != "")
		nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "pending", payload.CryptoToken, true, "single", "", "multisig pending")
		return &NFCPaymentResult{
			Status:        "pending_multisig",
			TransactionID: pending.ID.String(),
			PendingID:     pending.ID.String(),
			RequiredSigs:  reqSigs,
			CollectedSigs: 1,
			RemainingSigs: remaining,
			Message:       fmt.Sprintf("Pago pendiente. Faltan %d firma(s). Acerque las tarjetas de los firmantes autorizados.", remaining),
			UserBalance:   &balance,
		}, nil
	}

	txID := uuid.New()
	_, err = nt.Pool.Exec(ctx, `
		UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`,
		card.UserID, payload.Amount,
	)
	if err != nil {
		return nil, fmt.Errorf("debiting user: %w", err)
	}

	newBalance := balance - payload.Amount
	nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "approved", payload.CryptoToken, true, "single", "", "")

	return &NFCPaymentResult{
		Status:        "approved",
		TransactionID: txID.String(),
		Message:       "transaccion aprobada",
		UserBalance:   &newBalance,
	}, nil
}

type CommunityPaymentPayload struct {
	SellerCardUID         string `json:"seller_card_uid"`
	SellerCryptoToken     string `json:"seller_crypto_token"`
	SellerPIN             string `json:"seller_pin"`
	BuyerCardUID          string `json:"buyer_card_uid"`
	BuyerCryptoToken      string `json:"buyer_crypto_token"`
	BuyerPIN              string `json:"buyer_pin"`
	Amount                int64  `json:"amount"`
	Timestamp             int64  `json:"timestamp"`
	Nonce                 string `json:"nonce"`
	BuyerIDDocumentType   string `json:"buyer_id_document_type,omitempty"`
	BuyerIDDocumentNumber string `json:"buyer_id_document_number,omitempty"`
}

func (nt *NFCTerminals) ProcessCommunityPayment(ctx context.Context, terminalID string, payload CommunityPaymentPayload) (*NFCPaymentResult, error) {
	var termDBID uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT id FROM nfc_terminals WHERE terminal_id = $1 AND is_active = true`,
		terminalID,
	).Scan(&termDBID)
	if err != nil {
		return nil, fmt.Errorf("terminal not found or inactive")
	}

	sellerCard, err := nt.lookupCard(ctx, payload.SellerCardUID)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "tarjeta vendedora no encontrada"}, nil
	}

	buyerCard, err := nt.lookupCard(ctx, payload.BuyerCardUID)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "tarjeta compradora no encontrada"}, nil
	}

	if sellerCard.UserID == buyerCard.UserID {
		return &NFCPaymentResult{Status: "rejected", Message: "vendedor y comprador son la misma persona"}, nil
	}

	if sellerCard.PinHash != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(*sellerCard.PinHash), []byte(payload.SellerPIN)); err != nil {
			nt.logTransaction(ctx, termDBID, payload.SellerCardUID, &sellerCard.UserID, payload.Amount, "rejected", payload.SellerCryptoToken, false, "community", "", "seller PIN invalid")
			return &NFCPaymentResult{Status: "rejected", Message: "PIN del vendedor incorrecto"}, nil
		}
	}

	if buyerCard.PinHash != nil {
		blocked, _ := nt.checkCardBlocked(ctx, payload.BuyerCardUID)
		if blocked {
			return &NFCPaymentResult{Status: "rejected", Message: "tarjeta compradora bloqueada"}, nil
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*buyerCard.PinHash), []byte(payload.BuyerPIN)); err != nil {
			nt.incrementCardAttempt(ctx, payload.BuyerCardUID)
			nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "rejected", payload.BuyerCryptoToken, false, "community", "", "buyer PIN invalid")
			return &NFCPaymentResult{Status: "rejected", Message: "PIN del comprador incorrecto"}, nil
		}
		nt.resetCardAttempts(ctx, payload.BuyerCardUID)
	}

	// Verificacion de documento de identidad para tarjetas UID-only del comprador
	if buyerCard.CardType == "uid_only" {
		requireDoc, err := nt.checkRequireIDDocument(ctx)
		if err == nil && requireDoc {
			if payload.BuyerIDDocumentNumber == "" {
				nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "rejected", payload.BuyerCryptoToken, true, "community", "", "buyer id document required but not provided")
				return &NFCPaymentResult{Status: "rejected", Message: "se requiere documento de identidad del comprador para esta tarjeta"}, nil
			}
			matched, err := nt.verifyIDDocument(ctx, buyerCard.UserID, payload.BuyerIDDocumentType, payload.BuyerIDDocumentNumber)
			if err != nil || !matched {
				nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "rejected", payload.BuyerCryptoToken, true, "community", "", "buyer id document mismatch")
				return &NFCPaymentResult{Status: "rejected", Message: "documento de identidad del comprador no coincide"}, nil
			}
		}
	}

	var buyerBalance, buyerCreditLimit int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance, credit_limit FROM users WHERE id = $1`, buyerCard.UserID).Scan(&buyerBalance, &buyerCreditLimit)
	if err != nil {
		return nil, fmt.Errorf("getting buyer balance: %w", err)
	}

	if buyerBalance-payload.Amount < buyerCreditLimit {
		nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "rejected", payload.BuyerCryptoToken, true, "community", "", "limite de credito alcanzado")
		return &NFCPaymentResult{Status: "rejected", Message: "has llegado al tope de tu credito comunitario. Debes aportar a la comunidad para poder pagar nuevamente."}, nil
	}

	// Verificar si la cuenta del comprador requiere multi-firma (cuenta mancomunada).
	// Si required_signatures > 1, se crea un pago pendiente y la primera firma
	// es del comprador que acerco su tarjeta. Los firmantes siguientes deben
	// acercar sus tarjetas via el endpoint /api/nfc/terminal/payment/multisig-sign.
	reqSigs, _, err := nt.checkAccountMultiSig(ctx, buyerCard.UserID)
	if err == nil && reqSigs > 1 {
		msig := NewMultiSigPayments(nt.Pool, nt.NodeDomain)
		pending, err := msig.CreatePendingPayment(ctx, CreatePendingPaymentParams{
			PaymentType:   "nfc_community",
			FromAccount:   buyerCard.UserID,
			ToAccount:     sellerCard.UserID,
			Amount:        payload.Amount,
			PaymentMethod: "nfc_community",
			TerminalID:    &termDBID,
			Description:   "Pago comunitario multi-firma",
		})
		if err != nil {
			return &NFCPaymentResult{Status: "rejected", Message: "error creando pago multi-firma: " + err.Error()}, nil
		}
		// La primera firma es del comprador que acerco su tarjeta
		remaining, _, _ := msig.SignPendingPayment(ctx, pending.ID, buyerCard.UserID, "nfc_card", payload.BuyerCardUID, true, payload.BuyerIDDocumentNumber != "")
		nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "pending", payload.BuyerCryptoToken, true, "community", "", "multisig pending")
		return &NFCPaymentResult{
			Status:        "pending_multisig",
			TransactionID: pending.ID.String(),
			PendingID:     pending.ID.String(),
			RequiredSigs:  reqSigs,
			CollectedSigs: 1,
			RemainingSigs: remaining,
			Message:       fmt.Sprintf("Pago pendiente. Faltan %d firma(s). Acerque las tarjetas de los firmantes autorizados.", remaining),
			UserBalance:   &buyerBalance,
		}, nil
	}

	_, err = nt.Pool.Exec(ctx, `UPDATE users SET balance = balance - $2 WHERE id = $1`, buyerCard.UserID, payload.Amount)
	if err != nil {
		return nil, fmt.Errorf("debiting buyer: %w", err)
	}

	_, err = nt.Pool.Exec(ctx, `UPDATE users SET balance = balance + $2 WHERE id = $1`, sellerCard.UserID, payload.Amount)
	if err != nil {
		return nil, fmt.Errorf("crediting seller: %w", err)
	}

	newBalance := buyerBalance - payload.Amount
	txID := uuid.New()
	nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "approved", payload.BuyerCryptoToken, true, "community", "", "")

	return &NFCPaymentResult{
		Status:        "approved",
		TransactionID: txID.String(),
		Message:       "transaccion comunitaria aprobada",
		UserBalance:   &newBalance,
	}, nil
}

type nfcCardInfo struct {
	UserID   uuid.UUID
	CardType string
	PinHash  *string
	IsActive bool
}

// checkRequireIDDocument verifica si el nodo requiere documento de identidad
// para tarjetas UID-only
func (nt *NFCTerminals) checkRequireIDDocument(ctx context.Context) (bool, error) {
	var requireDoc bool
	err := nt.Pool.QueryRow(ctx, `
		SELECT COALESCE(require_id_document_for_uid_only, false)
		FROM nfc_card_type_config WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&requireDoc)
	if err != nil {
		// Si no hay config, no requerir
		return false, nil
	}
	return requireDoc, nil
}

// checkAccountMultiSig verifica si una cuenta requiere multi-firma
func (nt *NFCTerminals) checkAccountMultiSig(ctx context.Context, userID uuid.UUID) (int, []uuid.UUID, error) {
	var reqSigs int
	var signers []uuid.UUID
	err := nt.Pool.QueryRow(ctx, `
		SELECT COALESCE(required_signatures, 1), COALESCE(authorized_signers, ARRAY[]::uuid[])
		FROM users WHERE id = $1`, userID).Scan(&reqSigs, &signers)
	if err != nil {
		return 1, nil, err
	}
	return reqSigs, signers, nil
}

// verifyIDDocument verifica que el documento de identidad proporcionado
// coincida con el registrado del usuario
func (nt *NFCTerminals) verifyIDDocument(ctx context.Context, userID uuid.UUID, docType, docNumber string) (bool, error) {
	if docNumber == "" {
		return false, nil
	}
	// 1. Verificar contra users.national_id (campo directo)
	var nationalID string
	err := nt.Pool.QueryRow(ctx, `SELECT COALESCE(national_id, '') FROM users WHERE id = $1`, userID).Scan(&nationalID)
	if err == nil && nationalID != "" && nationalID == docNumber {
		return true, nil
	}
	// 2. Verificar contra user_documents (puede tener varios documentos)
	var exists bool
	err = nt.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_documents
			WHERE user_id = $1
			AND document_number = $2
			AND ($3 = '' OR document_type_code = $3)
		)`,
		userID, docNumber, docType,
	).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (nt *NFCTerminals) lookupCard(ctx context.Context, cardUID string) (*nfcCardInfo, error) {
	var c nfcCardInfo
	var pinHash *string
	err := nt.Pool.QueryRow(ctx, `
		SELECT user_id, card_type, pin_hash, is_active
		FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	).Scan(&c.UserID, &c.CardType, &pinHash, &c.IsActive)
	if err != nil {
		return nil, fmt.Errorf("card not found or inactive")
	}
	c.PinHash = pinHash
	return &c, nil
}

func (nt *NFCTerminals) checkCardBlocked(ctx context.Context, cardUID string) (bool, error) {
	var blockedUntil *time.Time
	err := nt.Pool.QueryRow(ctx, `
		SELECT blocked_until FROM nfc_card_attempts WHERE card_uid = $1`,
		cardUID,
	).Scan(&blockedUntil)
	if err != nil {
		return false, nil
	}
	if blockedUntil != nil && time.Now().Before(*blockedUntil) {
		return true, nil
	}
	return false, nil
}

func (nt *NFCTerminals) incrementCardAttempt(ctx context.Context, cardUID string) {
	var count int
	err := nt.Pool.QueryRow(ctx, `
		SELECT attempt_count FROM nfc_card_attempts WHERE card_uid = $1`,
		cardUID,
	).Scan(&count)
	if err != nil {
		nt.Pool.Exec(ctx, `
			INSERT INTO nfc_card_attempts (card_uid, attempt_count, last_attempt_at)
			VALUES ($1, 1, NOW())`, cardUID)
		return
	}

	count++
	blockedUntil := time.Now().Add(15 * time.Minute)
	if count >= 3 {
		nt.Pool.Exec(ctx, `
			UPDATE nfc_card_attempts SET attempt_count = $2, last_attempt_at = NOW(), blocked_until = $3
			WHERE card_uid = $1`, cardUID, count, blockedUntil)
	} else {
		nt.Pool.Exec(ctx, `
			UPDATE nfc_card_attempts SET attempt_count = $2, last_attempt_at = NOW()
			WHERE card_uid = $1`, cardUID, count)
	}
}

func (nt *NFCTerminals) resetCardAttempts(ctx context.Context, cardUID string) {
	nt.Pool.Exec(ctx, `
		UPDATE nfc_card_attempts SET attempt_count = 0, blocked_until = NULL
		WHERE card_uid = $1`, cardUID)
}

func (nt *NFCTerminals) logTransaction(ctx context.Context, terminalID uuid.UUID, cardUID string, userID *uuid.UUID, amount int64, status, cryptoToken string, pinVerified bool, txType, errMsg, _ string) {
	nt.Pool.Exec(ctx, `
		INSERT INTO nfc_transactions (terminal_id, card_uid, user_id, amount, status, crypto_token, pin_verified, transaction_type, error_message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		terminalID, cardUID, userID, amount, status, cryptoToken, pinVerified, txType, errMsg)
}

func (nt *NFCTerminals) ListTransactions(ctx context.Context, nodeDomain string, limit int) ([]NFCTransaction, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := nt.Pool.Query(ctx, `
		SELECT t.id, t.terminal_id, t.card_uid, t.user_id, t.amount, t.status,
			t.crypto_token, t.pin_verified, t.transaction_type, t.seller_user_id, t.buyer_user_id,
			t.error_message, t.created_at
		FROM nfc_transactions t
		JOIN nfc_terminals nt ON nt.id = t.terminal_id
		WHERE nt.node_domain = $1
		ORDER BY t.created_at DESC
		LIMIT $2`,
		nodeDomain, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("listing transactions: %w", err)
	}
	defer rows.Close()

	var txs []NFCTransaction
	for rows.Next() {
		var tx NFCTransaction
		if err := rows.Scan(&tx.ID, &tx.TerminalID, &tx.CardUID, &tx.UserID, &tx.Amount,
			&tx.Status, &tx.CryptoToken, &tx.PinVerified, &tx.TransactionType,
			&tx.SellerUserID, &tx.BuyerUserID, &tx.ErrorMessage, &tx.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning transaction: %w", err)
		}
		txs = append(txs, tx)
	}
	return txs, nil
}

func (nt *NFCTerminals) IssueCryptoCard(ctx context.Context, userID uuid.UUID, cardUID, cardType, initialPIN string) (*NFCCard, error) {
	// Validar que el usuario tenga al menos un documento de identidad registrado
	// para tarjetas uid_only (el POS pedirá documento al pagar)
	if cardType == "uid_only" || cardType == "classic" {
		var docCount int
		nt.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_documents WHERE user_id = $1`, userID).Scan(&docCount)
		if docCount == 0 {
			return nil, fmt.Errorf("el usuario no tiene documentos de identidad registrados. Debe registrar al menos un documento antes de emitir una tarjeta %s", cardType)
		}
	}

	pinHash, err := bcrypt.GenerateFromPassword([]byte(initialPIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing PIN: %w", err)
	}

	var card NFCCard
	err = nt.Pool.QueryRow(ctx, `
		INSERT INTO nfc_cards (user_id, card_uid, is_active, card_type, crypto_enabled, pin_hash)
		VALUES ($1, $2, true, $3, true, $4)
		ON CONFLICT (card_uid) DO UPDATE SET is_active = true, card_type = $3, crypto_enabled = true, pin_hash = $4
		RETURNING id, user_id, card_uid, is_active, issued_at, deactivated_at`,
		userID, cardUID, cardType, string(pinHash),
	).Scan(&card.ID, &card.UserID, &card.CardUID, &card.IsActive, &card.IssuedAt, &card.DeactivatedAt)
	if err != nil {
		return nil, fmt.Errorf("issuing crypto card: %w", err)
	}
	return &card, nil
}

func (nt *NFCTerminals) ChangeCardPIN(ctx context.Context, cardUID, oldPIN, newPIN string) error {
	var pinHash *string
	err := nt.Pool.QueryRow(ctx, `
		SELECT pin_hash FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	).Scan(&pinHash)
	if err != nil {
		return fmt.Errorf("card not found")
	}

	if pinHash != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(oldPIN)); err != nil {
			return fmt.Errorf("old PIN incorrect")
		}
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPIN), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing new PIN: %w", err)
	}

	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_cards SET pin_hash = $2 WHERE card_uid = $1`,
		cardUID, string(newHash),
	)
	if err != nil {
		return fmt.Errorf("updating PIN: %w", err)
	}
	return nil
}

func (nt *NFCTerminals) ResetCardPIN(ctx context.Context, cardUID, newPIN string) error {
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPIN), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing new PIN: %w", err)
	}

	_, err = nt.Pool.Exec(ctx, `
		UPDATE nfc_cards SET pin_hash = $2, pin_attempts = 0, blocked_until = NULL
		WHERE card_uid = $1`,
		cardUID, string(newHash),
	)
	if err != nil {
		return fmt.Errorf("resetting PIN: %w", err)
	}

	nt.resetCardAttempts(ctx, cardUID)
	return nil
}

func (nt *NFCTerminals) GetSession(ctx context.Context, sessionToken string) (*NFCTerminalSession, error) {
	var s NFCTerminalSession
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, terminal_id, session_token, merchant_user_id, current_amount, status,
			seller_card_uid, seller_pin_verified, buyer_card_uid, expires_at, created_at
		FROM nfc_terminal_sessions WHERE session_token = $1 AND expires_at > NOW()`,
		sessionToken,
	).Scan(&s.ID, &s.TerminalID, &s.SessionToken, &s.MerchantUserID, &s.CurrentAmount,
		&s.Status, &s.SellerCardUID, &s.SellerPinVerified, &s.BuyerCardUID,
		&s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("session not found or expired")
	}
	return &s, nil
}

func (nt *NFCTerminals) GetSessionByTerminal(ctx context.Context, terminalID string) (*NFCTerminalSession, error) {
	var termID uuid.UUID
	err := nt.Pool.QueryRow(ctx, `SELECT id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&termID)
	if err != nil {
		return nil, fmt.Errorf("terminal not found")
	}

	var s NFCTerminalSession
	err = nt.Pool.QueryRow(ctx, `
		SELECT id, terminal_id, session_token, merchant_user_id, current_amount, status,
			seller_card_uid, seller_pin_verified, buyer_card_uid, expires_at, created_at
		FROM nfc_terminal_sessions
		WHERE terminal_id = $1 AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`,
		termID,
	).Scan(&s.ID, &s.TerminalID, &s.SessionToken, &s.MerchantUserID, &s.CurrentAmount,
		&s.Status, &s.SellerCardUID, &s.SellerPinVerified, &s.BuyerCardUID,
		&s.ExpiresAt, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("no active session")
	}
	return &s, nil
}

func (nt *NFCTerminals) EnsureServerKeys(ctx context.Context) error {
	var exists bool
	err := nt.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM nfc_server_keys WHERE node_domain = $1)`,
		nt.NodeDomain,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("checking server keys: %w", err)
	}
	if exists {
		return nil
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return fmt.Errorf("generating server keypair: %w", err)
	}

	pubHex := hex.EncodeToString(pub)

	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_server_keys (node_domain, public_key, private_key_encrypted)
		VALUES ($1, $2, $3)`,
		nt.NodeDomain, pubHex, priv,
	)
	if err != nil {
		return fmt.Errorf("storing server keys: %w", err)
	}
	return nil
}

func (nt *NFCTerminals) GetServerPrivateKey(ctx context.Context) (ed25519.PrivateKey, error) {
	var privHex string
	err := nt.Pool.QueryRow(ctx, `
		SELECT private_key_encrypted::text FROM nfc_server_keys WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&privHex)
	if err != nil {
		return nil, fmt.Errorf("server keys not found: %w", err)
	}

	// Remove the \x prefix if present
	if len(privHex) > 2 && privHex[:2] == "\\x" {
		privHex = privHex[2:]
	}

	priv, err := hex.DecodeString(privHex)
	if err != nil {
		return nil, fmt.Errorf("decoding server private key: %w", err)
	}

	// Si la clave tiene 128 bytes, fue doble-codificada:
	// EnsureServerKeys guardaba []byte(hex.EncodeToString(priv)) en BYTEA,
	// lo que produce el doble de bytes al leer. Decodificar de nuevo.
	if len(priv) == 128 {
		priv, err = hex.DecodeString(string(priv))
		if err != nil {
			return nil, fmt.Errorf("decoding double-encoded server private key: %w", err)
		}
	}

	return ed25519.PrivateKey(priv), nil
}

func (nt *NFCTerminals) GetServerPublicKey(ctx context.Context) (ed25519.PublicKey, error) {
	var pubHex string
	err := nt.Pool.QueryRow(ctx, `
		SELECT public_key FROM nfc_server_keys WHERE node_domain = $1`,
		nt.NodeDomain,
	).Scan(&pubHex)
	if err != nil {
		return nil, fmt.Errorf("server keys not found: %w", err)
	}

	pub, err := hex.DecodeString(pubHex)
	if err != nil {
		return nil, fmt.Errorf("decoding server public key: %w", err)
	}
	return ed25519.PublicKey(pub), nil
}

func (nt *NFCTerminals) GetTerminalPublicKey(ctx context.Context, terminalID string) (ed25519.PublicKey, error) {
	var pubHex string
	err := nt.Pool.QueryRow(ctx, `
		SELECT terminal_public_key FROM nfc_terminals WHERE terminal_id = $1`,
		terminalID,
	).Scan(&pubHex)
	if err != nil {
		return nil, fmt.Errorf("terminal not found or not registered: %w", err)
	}

	pub, err := hex.DecodeString(pubHex)
	if err != nil {
		return nil, fmt.Errorf("decoding terminal public key: %w", err)
	}
	return ed25519.PublicKey(pub), nil
}

// ===== CERTIFICADOS DINAMICOS PARA MIFARE CLASSIC =====

// ClassicSectorData representa los datos de un sector para provisionamiento
type ClassicSectorData struct {
	SectorNumber int    `json:"sector_number"`
	KeyA         string `json:"key_a"`       // hex (6 bytes)
	KeyB         string `json:"key_b"`       // hex (6 bytes)
	AccessBits   string `json:"access_bits"` // hex (4 bytes)
	Certificate  string `json:"certificate"` // hex (16 bytes)
	IsActive     bool   `json:"is_active"`
}

// ProvisionClassicResponse es la respuesta del provisionamiento
type ProvisionClassicResponse struct {
	CardUID string              `json:"card_uid"`
	Sectors []ClassicSectorData `json:"sectors"`
}

// ProvisionClassicCard genera 15 sectores con claves y certificados unicos
// y los guarda en nfc_card_sectors. Retorna la data para que el POS escriba.
func (nt *NFCTerminals) ProvisionClassicCard(ctx context.Context, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionClassicResponse, error) {
	// Hashear PIN
	pinHash, err := bcrypt.GenerateFromPassword([]byte(initialPIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing PIN: %w", err)
	}

	// Registrar tarjeta en nfc_cards con has_dynamic_certs=true
	var card NFCCard
	err = nt.Pool.QueryRow(ctx, `
		INSERT INTO nfc_cards (user_id, card_uid, is_active, card_type, crypto_enabled, pin_hash, has_dynamic_certs)
		VALUES ($1, $2, true, 'uid_only', false, $3, true)
		ON CONFLICT (card_uid) DO UPDATE SET is_active = true, card_type = 'uid_only', pin_hash = $3, has_dynamic_certs = true
		RETURNING id, user_id, card_uid, is_active, issued_at, deactivated_at`,
		userID, cardUID, string(pinHash),
	).Scan(&card.ID, &card.UserID, &card.CardUID, &card.IsActive, &card.IssuedAt, &card.DeactivatedAt)
	if err != nil {
		return nil, fmt.Errorf("issuing classic card: %w", err)
	}

	// Elegir sector activo aleatorio (1-15)
	activeSector := make([]byte, 1)
	if _, err := rand.Read(activeSector); err != nil {
		return nil, fmt.Errorf("generating random sector: %w", err)
	}
	activeSectorNum := int(activeSector[0])%15 + 1 // 1-15

	// Access bits estandar: Key A lee, Key B escribe
	// Configuracion comun para MIFARE Classic
	accessBits := []byte{0x78, 0x77, 0x88, 0x69}

	var sectors []ClassicSectorData

	// Generar 15 sectores
	for sectorNum := 1; sectorNum <= 15; sectorNum++ {
		// Generar Key A aleatoria (6 bytes)
		keyA := make([]byte, 6)
		if _, err := rand.Read(keyA); err != nil {
			return nil, fmt.Errorf("generating key A: %w", err)
		}

		// Generar Key B aleatoria (6 bytes)
		keyB := make([]byte, 6)
		if _, err := rand.Read(keyB); err != nil {
			return nil, fmt.Errorf("generating key B: %w", err)
		}

		// Generar certificado (16 bytes)
		cert := make([]byte, 16)
		if _, err := rand.Read(cert); err != nil {
			return nil, fmt.Errorf("generating certificate: %w", err)
		}

		isActive := (sectorNum == activeSectorNum)

		// Guardar en BD
		_, err = nt.Pool.Exec(ctx, `
			INSERT INTO nfc_card_sectors (card_uid, node_domain, sector_number, key_a_encrypted, key_b_encrypted, access_bits, certificate, is_active, written_blocks)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
			ON CONFLICT (card_uid, sector_number) DO UPDATE SET
				key_a_encrypted = $4, key_b_encrypted = $5, access_bits = $6,
				certificate = $7, is_active = $8, written_blocks = 0, needs_repair = false, updated_at = NOW()`,
			cardUID, nt.NodeDomain, sectorNum, keyA, keyB, accessBits, cert, isActive,
		)
		if err != nil {
			return nil, fmt.Errorf("inserting sector %d: %w", sectorNum, err)
		}

		sectors = append(sectors, ClassicSectorData{
			SectorNumber: sectorNum,
			KeyA:         hex.EncodeToString(keyA),
			KeyB:         hex.EncodeToString(keyB),
			AccessBits:   hex.EncodeToString(accessBits),
			Certificate:  hex.EncodeToString(cert),
			IsActive:     isActive,
		})
	}

	return &ProvisionClassicResponse{
		CardUID: cardUID,
		Sectors: sectors,
	}, nil
}

// UserLookupResponse es la respuesta del lookup de usuario por username.
// El POS llama esto primero para saber que tipo de tarjeta tiene el usuario
// y si necesita pedir documento de identidad (solo para Classic).
type UserLookupResponse struct {
	Found            bool     `json:"found"`
	UserID           string   `json:"user_id,omitempty"`
	CardType         string   `json:"card_type,omitempty"`         // "classic", "uid_only", "desfire"
	RequiresDocument bool     `json:"requires_document"`           // true si es Classic
	RequiredDocType  string   `json:"required_doc_type,omitempty"` // tipo especifico si la tarjeta lo exige
	DocumentTypes    []string `json:"document_types,omitempty"`    // tipos de documento del usuario
	DisplayName      string   `json:"display_name,omitempty"`
	IsRemote         bool     `json:"is_remote"`             // true si el usuario es de otro nodo
	RemoteNode       string   `json:"remote_node,omitempty"` // nodo del usuario si es remoto
	Message          string   `json:"message,omitempty"`
}

// parseUsername separa "maria@nodo1.trueque.local" en ("maria", "nodo1.trueque.local").
// Si no tiene @, asume que es del nodo local.
func parseUsername(username, localNode string) (string, string) {
	for i := 0; i < len(username); i++ {
		if username[i] == '@' {
			return username[:i], username[i+1:]
		}
	}
	return username, localNode
}

// UserLookup busca un usuario por username para determinar el tipo de tarjeta
// y si necesita documento de identidad (solo para Classic).
// Si el usuario es remoto (tiene @nodo), consulta al nodo origen via federation.
func (nt *NFCTerminals) UserLookup(ctx context.Context, terminalID, username string) (*UserLookupResponse, error) {
	localNode := nt.NodeDomain
	lookupUsername, lookupNode := parseUsername(username, localNode)

	// Usuario local
	if lookupNode == localNode {
		return nt.localUserLookup(ctx, lookupUsername)
	}

	// Usuario remoto: consultar al nodo origen via federation
	return nt.remoteUserLookup(ctx, lookupUsername, lookupNode)
}

func (nt *NFCTerminals) localUserLookup(ctx context.Context, username string) (*UserLookupResponse, error) {
	var userID string
	var displayName string
	err := nt.Pool.QueryRow(ctx,
		`SELECT id::text, display_name FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
		username, nt.NodeDomain,
	).Scan(&userID, &displayName)
	if err != nil {
		return &UserLookupResponse{Found: false, Message: "usuario no encontrado"}, nil
	}

	// Buscar tarjeta activa del usuario
	var cardType string
	var hasDynamicCerts bool
	var requiredDocType *string
	err = nt.Pool.QueryRow(ctx, `
		SELECT card_type, has_dynamic_certs, required_doc_type FROM nfc_cards
		WHERE user_id = $1::uuid AND is_active = true
		ORDER BY has_dynamic_certs DESC, issued_at DESC LIMIT 1`,
		userID,
	).Scan(&cardType, &hasDynamicCerts, &requiredDocType)
	if err != nil {
		return &UserLookupResponse{Found: false, Message: "no se encontro tarjeta activa para este usuario"}, nil
	}

	respType := cardType
	if respType == "" {
		respType = "uid_only"
	}

	// Solo Classic requiere documento
	requiresDoc := hasDynamicCerts || respType == "classic"

	// Obtener tipos de documento del usuario
	var docTypes []string
	rows, err := nt.Pool.Query(ctx,
		`SELECT document_type_code FROM user_documents WHERE user_id = $1::uuid ORDER BY document_type_code`,
		userID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dt string
			if err := rows.Scan(&dt); err == nil {
				docTypes = append(docTypes, dt)
			}
		}
	}

	// Si no hay user_documents, intentar con national_id
	if len(docTypes) == 0 {
		var nationalID string
		err = nt.Pool.QueryRow(ctx,
			`SELECT COALESCE(national_id, '') FROM users WHERE id = $1::uuid`,
			userID,
		).Scan(&nationalID)
		if err == nil && nationalID != "" {
			docTypes = append(docTypes, "cedula")
		}
	}

	resp := &UserLookupResponse{
		Found:            true,
		UserID:           userID,
		CardType:         respType,
		RequiresDocument: requiresDoc,
		DocumentTypes:    docTypes,
		DisplayName:      displayName,
	}
	if requiredDocType != nil && *requiredDocType != "" {
		resp.RequiredDocType = *requiredDocType
	}
	return resp, nil
}

func (nt *NFCTerminals) remoteUserLookup(ctx context.Context, username, remoteNode string) (*UserLookupResponse, error) {
	// TODO: consultar al nodo remoto via federation (mTLS)
	// Por ahora retornar error — se implementa en federation/server.go
	return &UserLookupResponse{
		Found:      false,
		IsRemote:   true,
		RemoteNode: remoteNode,
		Message:    "lookup de usuario remoto no implementado — requiere federation mTLS",
	}, nil
}

// ClassicPreAuthResponse contiene todo lo que el POS necesita para
// leer y escribir la tarjeta en un solo paso.
// Para tarjetas UID-only/DESFire, los campos de sectores van vacios
// y el POS solo necesita verificar el card_uid.
type ClassicPreAuthResponse struct {
	PreApproved         bool   `json:"pre_approved"`
	CardType            string `json:"card_type"` // "classic", "uid_only", "desfire"
	CardUID             string `json:"card_uid"`
	ReadSector          int    `json:"read_sector"`
	ReadKeyA            string `json:"read_key_a"`           // hex (6 bytes)
	ExpectedCertificate string `json:"expected_certificate"` // hex (16 bytes)
	WriteSector         int    `json:"write_sector"`
	WriteKeyB           string `json:"write_key_b"`     // hex (6 bytes)
	NewCertificate      string `json:"new_certificate"` // hex (16 bytes)
	Message             string `json:"message,omitempty"`
}

// ClassicPreAuth valida username + PIN + saldo, y prepara la rotacion
// del certificado. NO procesa el pago hasta que el POS confirme la escritura.
// Para tarjetas Classic, el documento se verifica en ClassicPreAuthWithDocument.
func (nt *NFCTerminals) ClassicPreAuth(ctx context.Context, terminalID, username, pin string, amount int64) (*ClassicPreAuthResponse, error) {
	// 1. Buscar usuario por username
	localNode := nt.NodeDomain
	lookupUsername, lookupNode := parseUsername(username, localNode)

	var userID uuid.UUID
	var err error
	if lookupNode == localNode {
		err = nt.Pool.QueryRow(ctx,
			`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
			lookupUsername, localNode,
		).Scan(&userID)
		if err != nil {
			return &ClassicPreAuthResponse{PreApproved: false, Message: "usuario no encontrado"}, nil
		}
	} else {
		// Usuario remoto: consultar al nodo origen via federation (3 reintentos)
		userID, err = nt.lookupRemoteUserWithRetry(ctx, lookupUsername, lookupNode, 3)
		if err != nil {
			return &ClassicPreAuthResponse{PreApproved: false, Message: "no se pudo contactar al nodo del usuario"}, nil
		}
	}

	// 1b. Verificar que el usuario no se esté pagando a sí mismo
	// (el merchant del terminal no puede ser el mismo que el cliente que paga)
	var merchantUserID *uuid.UUID
	_ = nt.Pool.QueryRow(ctx, `SELECT merchant_user_id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&merchantUserID)
	if merchantUserID != nil && *merchantUserID == userID {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no puedes pagarte a ti mismo"}, nil
	}

	// 2. Buscar tarjeta activa del usuario (cualquier tipo)
	var cardUID string
	var cardType string
	var hasDynamicCerts bool
	err = nt.Pool.QueryRow(ctx, `
		SELECT card_uid, card_type, has_dynamic_certs FROM nfc_cards
		WHERE user_id = $1 AND is_active = true
		ORDER BY has_dynamic_certs DESC, issued_at DESC LIMIT 1`,
		userID).Scan(&cardUID, &cardType, &hasDynamicCerts)
	if err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no se encontro tarjeta activa para este usuario"}, nil
	}

	// 3. Verificar PIN
	var pinHash *string
	err = nt.Pool.QueryRow(ctx, `SELECT pin_hash FROM nfc_cards WHERE card_uid = $1 AND is_active = true`, cardUID).Scan(&pinHash)
	if err != nil || pinHash == nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "tarjeta no encontrada"}, nil
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(pin)); err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "PIN incorrecto"}, nil
	}

	// 4. Verificar saldo (filosofia moneda cero: puede ser negativo hasta credit_limit)
	var balance, creditLimit int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance, credit_limit FROM users WHERE id = $1`, userID).Scan(&balance, &creditLimit)
	if err != nil {
		return nil, fmt.Errorf("getting user balance: %w", err)
	}
	log.Printf("ClassicPreAuth: user=%s balance=%d amount=%d creditLimit=%d check=%v (balance-amount=%d < creditLimit=%d = %v)",
		username, balance, amount, creditLimit, balance-amount < creditLimit, balance-amount, creditLimit, balance-amount < creditLimit)
	if balance-amount < creditLimit {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "has llegado al tope de tu credito comunitario"}, nil
	}

	// 5. Si NO es Classic, retornar respuesta simple para UID-only/DESFire
	// El POS solo necesita verificar el card_uid y luego llamar a processNfcPayment
	if !hasDynamicCerts {
		respType := cardType
		if respType == "" {
			respType = "uid_only"
		}
		return &ClassicPreAuthResponse{
			PreApproved: true,
			CardType:    respType,
			CardUID:     cardUID,
		}, nil
	}

	// 6. Buscar sector activo (solo para Classic)
	var readSector int
	var keyABytes, certBytes []byte
	err = nt.Pool.QueryRow(ctx, `
		SELECT sector_number, key_a_encrypted, certificate FROM nfc_card_sectors
		WHERE card_uid = $1 AND is_active = true LIMIT 1`,
		cardUID).Scan(&readSector, &keyABytes, &certBytes)
	if err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no hay sector activo en la tarjeta"}, nil
	}

	// 6. Generar nuevo certificado (16 bytes aleatorios)
	newCert := make([]byte, 16)
	if _, err := rand.Read(newCert); err != nil {
		return nil, fmt.Errorf("generating new certificate: %w", err)
	}

	// 7. Elegir sector aleatorio para escribir (1-15, != sector activo)
	writeSector := readSector
	for writeSector == readSector {
		randByte := make([]byte, 1)
		rand.Read(randByte)
		writeSector = int(randByte[0])%15 + 1
	}

	// 8. Obtener Key B del sector destino
	var keyBBytes []byte
	err = nt.Pool.QueryRow(ctx, `
		SELECT key_b_encrypted FROM nfc_card_sectors WHERE card_uid = $1 AND sector_number = $2`,
		cardUID, writeSector).Scan(&keyBBytes)
	if err != nil {
		return nil, fmt.Errorf("getting key B for sector %d: %w", writeSector, err)
	}

	// 9. Guardar pre-aprobacion (TTL 30s)
	pendingID := uuid.New()
	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_classic_pending (id, card_uid, terminal_id, user_id, amount, read_sector, write_sector, new_certificate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		pendingID, cardUID, terminalID, userID, amount, readSector, writeSector, newCert)
	if err != nil {
		return nil, fmt.Errorf("saving pre-auth: %w", err)
	}

	return &ClassicPreAuthResponse{
		PreApproved:         true,
		CardType:            "classic",
		CardUID:             cardUID,
		ReadSector:          readSector,
		ReadKeyA:            hex.EncodeToString(keyABytes),
		ExpectedCertificate: hex.EncodeToString(certBytes),
		WriteSector:         writeSector,
		WriteKeyB:           hex.EncodeToString(keyBBytes),
		NewCertificate:      hex.EncodeToString(newCert),
	}, nil
}

// lookupRemoteUserWithRetry consulta al nodo remoto para obtener el user_id.
// Hace hasta maxRetries intentos con timeout de 5s cada uno.
// TODO: implementar con federation mTLS cuando este disponible.
func (nt *NFCTerminals) lookupRemoteUserWithRetry(ctx context.Context, username, remoteNode string, maxRetries int) (uuid.UUID, error) {
	// Por ahora, buscar en la base de datos local si tenemos una referencia
	// al usuario remoto (por ejemplo, si ya hizo una transaccion cross-node antes)
	for i := 0; i < maxRetries; i++ {
		var userID uuid.UUID
		err := nt.Pool.QueryRow(ctx,
			`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
			username, remoteNode,
		).Scan(&userID)
		if err == nil {
			return userID, nil
		}
		// Si no se encuentra localmente, no reintentar — necesitamos federation
		break
	}
	return uuid.Nil, fmt.Errorf("usuario remoto no encontrado — requiere federation mTLS con %s", remoteNode)
}

// ClassicPreAuthWithDocument valida username + documento + PIN + saldo.
// Se usa para tarjetas Classic que requieren documento de identidad adicional.
// El documento debe coincidir con el required_doc_type de la tarjeta (si esta configurado).
func (nt *NFCTerminals) ClassicPreAuthWithDocument(ctx context.Context, terminalID, username, docType, docNumber, pin string, amount int64) (*ClassicPreAuthResponse, error) {
	// 1. Buscar usuario por username
	localNode := nt.NodeDomain
	lookupUsername, lookupNode := parseUsername(username, localNode)

	var userID uuid.UUID
	if lookupNode == localNode {
		err := nt.Pool.QueryRow(ctx,
			`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
			lookupUsername, localNode,
		).Scan(&userID)
		if err != nil {
			return &ClassicPreAuthResponse{PreApproved: false, Message: "usuario no encontrado"}, nil
		}
	} else {
		var err error
		userID, err = nt.lookupRemoteUserWithRetry(ctx, lookupUsername, lookupNode, 3)
		if err != nil {
			return &ClassicPreAuthResponse{PreApproved: false, Message: "no se pudo contactar al nodo del usuario"}, nil
		}
	}

	// 1b. Verificar que el usuario no se esté pagando a sí mismo
	var merchantUserID *uuid.UUID
	_ = nt.Pool.QueryRow(ctx, `SELECT merchant_user_id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&merchantUserID)
	if merchantUserID != nil && *merchantUserID == userID {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no puedes pagarte a ti mismo"}, nil
	}

	// 2. Buscar tarjeta activa del usuario
	var cardUID string
	var cardType string
	var hasDynamicCerts bool
	var requiredDocType *string
	err := nt.Pool.QueryRow(ctx, `
		SELECT card_uid, card_type, has_dynamic_certs, required_doc_type FROM nfc_cards
		WHERE user_id = $1 AND is_active = true
		ORDER BY has_dynamic_certs DESC, issued_at DESC LIMIT 1`,
		userID).Scan(&cardUID, &cardType, &hasDynamicCerts, &requiredDocType)
	if err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no se encontro tarjeta activa para este usuario"}, nil
	}

	// 3. Verificar que el documento coincida con el required_doc_type de la tarjeta
	if requiredDocType != nil && *requiredDocType != "" {
		if docType != *requiredDocType {
			return &ClassicPreAuthResponse{PreApproved: false, Message: "tipo de documento incorrecto para esta tarjeta"}, nil
		}
	}

	// 4. Verificar documento del usuario
	docOK, err := nt.verifyIDDocument(ctx, userID, docType, docNumber)
	if err != nil {
		return nil, fmt.Errorf("verifying document: %w", err)
	}
	if !docOK {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "documento de identidad no coincide"}, nil
	}

	// 5. Verificar PIN
	var pinHash *string
	err = nt.Pool.QueryRow(ctx, `SELECT pin_hash FROM nfc_cards WHERE card_uid = $1 AND is_active = true`, cardUID).Scan(&pinHash)
	if err != nil || pinHash == nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "tarjeta no encontrada"}, nil
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(pin)); err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "PIN incorrecto"}, nil
	}

	// 6. Verificar saldo
	var balance, creditLimit int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance, credit_limit FROM users WHERE id = $1`, userID).Scan(&balance, &creditLimit)
	if err != nil {
		return nil, fmt.Errorf("getting user balance: %w", err)
	}
	log.Printf("ClassicPreAuthWithDocument: user=%s balance=%d amount=%d creditLimit=%d (balance-amount=%d < creditLimit=%d = %v)",
		username, balance, amount, creditLimit, balance-amount, creditLimit, balance-amount < creditLimit)
	if balance-amount < creditLimit {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "has llegado al tope de tu credito comunitario"}, nil
	}

	// 7. Si NO es Classic, retornar respuesta simple
	if !hasDynamicCerts {
		respType := cardType
		if respType == "" {
			respType = "uid_only"
		}
		return &ClassicPreAuthResponse{
			PreApproved: true,
			CardType:    respType,
			CardUID:     cardUID,
		}, nil
	}

	// 8. Buscar sector activo (solo para Classic)
	var readSector int
	var keyABytes, certBytes []byte
	err = nt.Pool.QueryRow(ctx, `
		SELECT sector_number, key_a_encrypted, certificate FROM nfc_card_sectors
		WHERE card_uid = $1 AND is_active = true LIMIT 1`,
		cardUID).Scan(&readSector, &keyABytes, &certBytes)
	if err != nil {
		return &ClassicPreAuthResponse{PreApproved: false, Message: "no hay sector activo en la tarjeta"}, nil
	}

	// 9. Generar nuevo certificado (16 bytes aleatorios)
	newCert := make([]byte, 16)
	if _, err := rand.Read(newCert); err != nil {
		return nil, fmt.Errorf("generating new certificate: %w", err)
	}

	// 10. Elegir sector aleatorio para escribir (1-15, != sector activo)
	writeSector := readSector
	for writeSector == readSector {
		randByte := make([]byte, 1)
		rand.Read(randByte)
		writeSector = int(randByte[0])%15 + 1
	}

	// 11. Obtener Key B del sector destino
	var keyBBytes []byte
	err = nt.Pool.QueryRow(ctx, `
		SELECT key_b_encrypted FROM nfc_card_sectors WHERE card_uid = $1 AND sector_number = $2`,
		cardUID, writeSector).Scan(&keyBBytes)
	if err != nil {
		return nil, fmt.Errorf("getting key B for sector %d: %w", writeSector, err)
	}

	// 12. Guardar pre-aprobacion (TTL 30s)
	pendingID := uuid.New()
	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_classic_pending (id, card_uid, terminal_id, user_id, amount, read_sector, write_sector, new_certificate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		pendingID, cardUID, terminalID, userID, amount, readSector, writeSector, newCert)
	if err != nil {
		return nil, fmt.Errorf("saving pre-auth: %w", err)
	}

	return &ClassicPreAuthResponse{
		PreApproved:         true,
		CardType:            "classic",
		CardUID:             cardUID,
		ReadSector:          readSector,
		ReadKeyA:            hex.EncodeToString(keyABytes),
		ExpectedCertificate: hex.EncodeToString(certBytes),
		WriteSector:         writeSector,
		WriteKeyB:           hex.EncodeToString(keyBBytes),
		NewCertificate:      hex.EncodeToString(newCert),
	}, nil
}

// ConfirmClassicTransaction confirma la lectura/escritura de la tarjeta
// y procesa el pago si todo fue exitoso.
func (nt *NFCTerminals) ConfirmClassicTransaction(ctx context.Context, terminalID, cardUID string, readOK, writeOK bool, writtenBlocks int) (*NFCPaymentResult, error) {
	// 1. Buscar pre-aprobacion pendiente
	var pendingID uuid.UUID
	var userID uuid.UUID
	var amount int64
	var readSector, writeSector int
	var newCert []byte
	err := nt.Pool.QueryRow(ctx, `
		SELECT id, user_id, amount, read_sector, write_sector, new_certificate
		FROM nfc_classic_pending
		WHERE card_uid = $1 AND terminal_id = $2 AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`,
		cardUID, terminalID).Scan(&pendingID, &userID, &amount, &readSector, &writeSector, &newCert)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "no hay pre-aprobacion pendiente o ha expirado"}, nil
	}

	// 2. Si fallo la lectura o escritura, cancelar
	if !readOK || !writeOK {
		nt.Pool.Exec(ctx, `DELETE FROM nfc_classic_pending WHERE id = $1`, pendingID)
		msg := "lectura o escritura de tarjeta fallo"
		if !readOK {
			msg = "no se pudo leer el certificado de la tarjeta"
		} else if !writeOK {
			msg = "no se pudo escribir el nuevo certificado en la tarjeta"
		}
		return &NFCPaymentResult{Status: "rejected", Message: msg}, nil
	}

	// 3. Procesar pago: debitar balance
	_, err = nt.Pool.Exec(ctx, `UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`, userID, amount)
	if err != nil {
		return nil, fmt.Errorf("debiting user: %w", err)
	}

	// 4. Rotar sector: desactivar viejo, activar nuevo
	nt.Pool.Exec(ctx, `UPDATE nfc_card_sectors SET is_active = false, updated_at = NOW() WHERE card_uid = $1 AND sector_number = $2`, cardUID, readSector)

	needsRepair := writtenBlocks < 3
	nt.Pool.Exec(ctx, `
		UPDATE nfc_card_sectors SET is_active = true, certificate = $3, written_blocks = $4, needs_repair = $5, updated_at = NOW()
		WHERE card_uid = $1 AND sector_number = $2`,
		cardUID, writeSector, newCert, writtenBlocks, needsRepair)

	// 5. Borrar pre-aprobacion
	nt.Pool.Exec(ctx, `DELETE FROM nfc_classic_pending WHERE id = $1`, pendingID)

	// 6. Log transaccion
	var termDBID uuid.UUID
	nt.Pool.QueryRow(ctx, `SELECT id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&termDBID)
	nt.logTransaction(ctx, termDBID, cardUID, &userID, amount, "approved", hex.EncodeToString(newCert), true, "single", "", "")

	// 7. Calcular nuevo balance
	var newBalance int64
	nt.Pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, userID).Scan(&newBalance)

	txID := uuid.New()
	return &NFCPaymentResult{
		Status:        "approved",
		TransactionID: txID.String(),
		Message:       "transaccion aprobada",
		UserBalance:   &newBalance,
	}, nil
}

// CleanupExpiredClassicPending borra pre-aprobaciones expiradas
func (nt *NFCTerminals) CleanupExpiredClassicPending(ctx context.Context) {
	nt.Pool.Exec(ctx, `DELETE FROM nfc_classic_pending WHERE expires_at < NOW()`)
}

// GetClassicCardSectors retorna todos los sectores de una tarjeta
func (nt *NFCTerminals) GetClassicCardSectors(ctx context.Context, cardUID string) ([]ClassicSectorData, error) {
	rows, err := nt.Pool.Query(ctx, `
		SELECT sector_number, key_a_encrypted, key_b_encrypted, access_bits, certificate, is_active
		FROM nfc_card_sectors WHERE card_uid = $1 ORDER BY sector_number`, cardUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sectors []ClassicSectorData
	for rows.Next() {
		var s ClassicSectorData
		var keyA, keyB, accessBits, cert []byte
		if err := rows.Scan(&s.SectorNumber, &keyA, &keyB, &accessBits, &cert, &s.IsActive); err != nil {
			continue
		}
		s.KeyA = hex.EncodeToString(keyA)
		s.KeyB = hex.EncodeToString(keyB)
		s.AccessBits = hex.EncodeToString(accessBits)
		if cert != nil {
			s.Certificate = hex.EncodeToString(cert)
		}
		sectors = append(sectors, s)
	}
	return sectors, nil
}

// HasClassicCerts verifica si una tarjeta tiene certificados dinamicos
func (nt *NFCTerminals) HasClassicCerts(ctx context.Context, cardUID string) bool {
	var has bool
	err := nt.Pool.QueryRow(ctx, `SELECT has_dynamic_certs FROM nfc_cards WHERE card_uid = $1`, cardUID).Scan(&has)
	if err != nil {
		return false
	}
	return has
}

func (nt *NFCTerminals) DecodePayload(ctx context.Context, terminalID string, encMsg json.RawMessage) (json.RawMessage, []byte, error) {
	terminalIdentityPub, err := nt.GetTerminalPublicKey(ctx, terminalID)
	if err != nil {
		log.Printf("DecodePayload: terminal %s not found: %v", terminalID, err)
		return nil, nil, err
	}

	var msg crypto.EphemeralMessage
	if err := json.Unmarshal(encMsg, &msg); err != nil {
		return nil, nil, fmt.Errorf("unmarshaling ephemeral message: %w", err)
	}

	ephPub, err := hex.DecodeString(msg.Handshake.EphemeralPublicKey)
	if err != nil {
		return nil, nil, fmt.Errorf("decoding ephemeral public key: %w", err)
	}

	idSig, err := hex.DecodeString(msg.Handshake.IdentitySignature)
	if err != nil {
		return nil, nil, fmt.Errorf("decoding identity signature: %w", err)
	}

	if !crypto.VerifyEphemeralHandshake(terminalIdentityPub, ed25519.PublicKey(ephPub), msg.Handshake.Nonce, idSig) {
		return nil, nil, fmt.Errorf("terminal identity signature verification failed")
	}

	// Derivar shared key usando la clave de IDENTIDAD del servidor (no una efímera).
	// El POS usa ECDH(ephemeral_priv, server_identity_pub) para derivar el shared key,
	// por lo que el servidor debe usar ECDH(server_identity_priv, ephemeral_pub) para
	// obtener el mismo shared key. Usar una efímera nueva del servidor ROMPE el ECDH
	// porque el POS no conoce esa efímera.
	serverIdentityPriv, err := nt.GetServerPrivateKey(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("getting server identity private key: %w", err)
	}

	// Log de depuración: comparar claves para diagnosticar mismatch
	serverIdentityPub, _ := nt.GetServerPublicKey(ctx)
	log.Printf("DecodePayload: terminal=%s terminalPub=%x ephPub=%x serverPrivLen=%d serverPub=%x",
		terminalID, terminalIdentityPub, ed25519.PublicKey(ephPub), len(serverIdentityPriv), serverIdentityPub)

	sharedKey, err := crypto.DeriveSharedKey(serverIdentityPriv, ed25519.PublicKey(ephPub))
	if err != nil {
		return nil, nil, fmt.Errorf("deriving ephemeral shared key: %w", err)
	}

	nonce, err := hex.DecodeString(msg.Nonce)
	if err != nil {
		return nil, nil, fmt.Errorf("decoding nonce: %w", err)
	}
	ciphertext, err := hex.DecodeString(msg.Ciphertext)
	if err != nil {
		return nil, nil, fmt.Errorf("decoding ciphertext: %w", err)
	}
	signature, err := hex.DecodeString(msg.Signature)
	if err != nil {
		return nil, nil, fmt.Errorf("decoding signature: %w", err)
	}

	if !ed25519.Verify(terminalIdentityPub, ciphertext, signature) {
		return nil, nil, fmt.Errorf("terminal payload signature verification failed")
	}

	plaintext, err := cryptoDecrypt(sharedKey, nonce, ciphertext)
	if err != nil {
		log.Printf("DecodePayload: decrypt failed for terminal %s: %v (sharedKey len=%d, nonce len=%d, ciphertext len=%d)",
			terminalID, err, len(sharedKey), len(nonce), len(ciphertext))
		return nil, nil, fmt.Errorf("decrypting payload: %w", err)
	}

	log.Printf("DecodePayload: success for terminal %s, plaintext len=%d", terminalID, len(plaintext))
	return plaintext, sharedKey, nil
}

func (nt *NFCTerminals) EncodeResponseWithSharedKey(ctx context.Context, terminalID string, payload []byte, sharedKey []byte) (map[string]string, error) {
	serverIdentityPriv, err := nt.GetServerPrivateKey(ctx)
	if err != nil {
		return nil, err
	}

	nonce, ciphertext, err := cryptoEncrypt(sharedKey, payload)
	if err != nil {
		return nil, err
	}

	sig := ed25519.Sign(serverIdentityPriv, ciphertext)

	return map[string]string{
		"nonce":      hex.EncodeToString(nonce),
		"ciphertext": hex.EncodeToString(ciphertext),
		"signature":  hex.EncodeToString(sig),
	}, nil
}

func cryptoEncrypt(sharedKey, plaintext []byte) (nonce, ciphertext []byte, err error) {
	block, err := aes.NewCipher(sharedKey)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

func cryptoDecrypt(sharedKey, nonce, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(sharedKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// strPtr convierte sql.NullString a *string (nil si invalid)
func strPtr(n sql.NullString) *string {
	if !n.Valid || n.String == "" {
		return nil
	}
	s := n.String
	return &s
}

// ===== HELPERS PARA DRIVERS MODULARES (NTAG215, Ultralight C, etc.) =====

// LookupUserByUsername busca un usuario por username (case-insensitive) y devuelve
// su ID. Soporta usuarios locales y remotos (vía federation).
func (nt *NFCTerminals) LookupUserByUsername(ctx context.Context, username string) (uuid.UUID, error) {
	localNode := nt.NodeDomain
	lookupUsername, lookupNode := parseUsername(username, localNode)

	if lookupNode == localNode {
		var userID uuid.UUID
		err := nt.Pool.QueryRow(ctx,
			`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND node_domain = $2`,
			lookupUsername, localNode,
		).Scan(&userID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("usuario no encontrado")
		}
		return userID, nil
	}

	userID, err := nt.lookupRemoteUserWithRetry(ctx, lookupUsername, lookupNode, 3)
	if err != nil {
		return uuid.Nil, fmt.Errorf("no se pudo contactar al nodo del usuario")
	}
	return userID, nil
}

// VerifyCardPIN verifica el PIN de una tarjeta activa por card_uid.
func (nt *NFCTerminals) VerifyCardPIN(ctx context.Context, cardUID, pin string) error {
	var pinHash *string
	err := nt.Pool.QueryRow(ctx,
		`SELECT pin_hash FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	).Scan(&pinHash)
	if err != nil || pinHash == nil {
		return fmt.Errorf("tarjeta no encontrada")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(pin)); err != nil {
		return fmt.Errorf("PIN incorrecto")
	}
	return nil
}

// VerifyUserDocument verifica el documento de identidad de un usuario.
func (nt *NFCTerminals) VerifyUserDocument(ctx context.Context, userID uuid.UUID, docType, docNumber string) (bool, error) {
	return nt.verifyIDDocument(ctx, userID, docType, docNumber)
}

// GetCardRequiredDocType obtiene el required_doc_type de una tarjeta.
func (nt *NFCTerminals) GetCardRequiredDocType(ctx context.Context, cardUID string) (*string, error) {
	var docType *string
	err := nt.Pool.QueryRow(ctx,
		`SELECT required_doc_type FROM nfc_cards WHERE card_uid = $1 AND is_active = true`,
		cardUID,
	).Scan(&docType)
	if err != nil {
		return nil, err
	}
	return docType, nil
}

// FindActiveCardByType busca la tarjeta activa de un usuario de un tipo específico.
func (nt *NFCTerminals) FindActiveCardByType(ctx context.Context, userID uuid.UUID, cardType string) (cardUID string, err error) {
	err = nt.Pool.QueryRow(ctx,
		`SELECT card_uid FROM nfc_cards WHERE user_id = $1 AND is_active = true AND card_type = $2 ORDER BY issued_at DESC LIMIT 1`,
		userID, cardType,
	).Scan(&cardUID)
	if err != nil {
		return "", fmt.Errorf("no se encontro tarjeta %s activa para este usuario", cardType)
	}
	return cardUID, nil
}

// ProvisionNTAG215Card delega al driver NTAG215 del registry modular.
func (nt *NFCTerminals) ProvisionNTAG215Card(ctx context.Context, userID uuid.UUID, cardUID, initialPIN string) (interface{}, error) {
	return cards.ProvisionNTAG215(ctx, nt.Pool, nt.NodeDomain, userID, cardUID, initialPIN)
}

// ProvisionUltralightCCard delega al driver Ultralight C del registry modular.
func (nt *NFCTerminals) ProvisionUltralightCCard(ctx context.Context, userID uuid.UUID, cardUID, initialPIN string) (interface{}, error) {
	return cards.ProvisionUltralightC(ctx, nt.Pool, nt.NodeDomain, userID, cardUID, initialPIN)
}

// NTAG215PreAuth delega al driver NTAG215 del registry modular.
func (nt *NFCTerminals) NTAG215PreAuth(ctx context.Context, terminalID string, userID uuid.UUID, amount int64) (interface{}, error) {
	return cards.NTAG215PreAuth(ctx, nt.Pool, nt.NodeDomain, terminalID, userID, amount)
}

// NTAG215Confirm delega al driver NTAG215 del registry modular.
func (nt *NFCTerminals) NTAG215Confirm(ctx context.Context, terminalID, cardUID string, readOK, writeOK bool, writtenPages int) (*cards.NFCPaymentResult, error) {
	return cards.NTAG215Confirm(ctx, nt.Pool, nt.NodeDomain, terminalID, cardUID, cards.ConfirmData{
		ReadOK:       readOK,
		WriteOK:      writeOK,
		WrittenPages: writtenPages,
	})
}

// UltralightCPreAuth delega al driver Ultralight C del registry modular.
func (nt *NFCTerminals) UltralightCPreAuth(ctx context.Context, terminalID string, userID uuid.UUID, amount int64) (interface{}, error) {
	return cards.UltralightCPreAuth(ctx, nt.Pool, nt.NodeDomain, terminalID, userID, amount)
}

// UltralightCConfirm delega al driver Ultralight C del registry modular.
func (nt *NFCTerminals) UltralightCConfirm(ctx context.Context, terminalID, cardUID string, readOK, writeOK bool, writtenPages int) (*cards.NFCPaymentResult, error) {
	return cards.UltralightCConfirm(ctx, nt.Pool, nt.NodeDomain, terminalID, cardUID, cards.ConfirmData{
		ReadOK:       readOK,
		WriteOK:      writeOK,
		WrittenPages: writtenPages,
	})
}
