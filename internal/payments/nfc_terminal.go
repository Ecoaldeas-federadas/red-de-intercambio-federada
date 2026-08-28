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
	"fmt"
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

// HeartbeatFull retorna el estado completo del terminal: is_active e is_registered.
// El terminal usa esto para verificar que sigue registrado y activo antes de
// cada transaccion. Si is_registered=false o el terminal no existe, el cliente
// debe volver a la pantalla de emparejamiento.
func (nt *NFCTerminals) HeartbeatFull(ctx context.Context, terminalID string) (isActive, isRegistered bool, err error) {
	err = nt.Pool.QueryRow(ctx, `
		UPDATE nfc_terminals SET last_seen = NOW()
		WHERE terminal_id = $1
		RETURNING is_active, is_registered`,
		terminalID,
	).Scan(&isActive, &isRegistered)
	if err != nil {
		return false, false, fmt.Errorf("heartbeat: %w", err)
	}
	return isActive, isRegistered, nil
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

	var balance int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, card.UserID).Scan(&balance)
	if err != nil {
		return nil, fmt.Errorf("getting user balance: %w", err)
	}

	if balance-payload.Amount < -50000 {
		nt.logTransaction(ctx, termDBID, payload.CardUID, &card.UserID, payload.Amount, "rejected", payload.CryptoToken, true, "single", "", "insufficient balance")
		return &NFCPaymentResult{Status: "rejected", Message: "saldo insuficiente"}, nil
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

	var buyerBalance int64
	err = nt.Pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, buyerCard.UserID).Scan(&buyerBalance)
	if err != nil {
		return nil, fmt.Errorf("getting buyer balance: %w", err)
	}

	if buyerBalance-payload.Amount < -50000 {
		nt.logTransaction(ctx, termDBID, payload.BuyerCardUID, &buyerCard.UserID, payload.Amount, "rejected", payload.BuyerCryptoToken, true, "community", "", "insufficient balance")
		return &NFCPaymentResult{Status: "rejected", Message: "saldo insuficiente del comprador"}, nil
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
	privHex := hex.EncodeToString(priv)

	_, err = nt.Pool.Exec(ctx, `
		INSERT INTO nfc_server_keys (node_domain, public_key, private_key_encrypted)
		VALUES ($1, $2, $3)`,
		nt.NodeDomain, pubHex, []byte(privHex),
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

func (nt *NFCTerminals) DecodePayload(ctx context.Context, terminalID string, encMsg json.RawMessage) (json.RawMessage, []byte, error) {
	terminalIdentityPub, err := nt.GetTerminalPublicKey(ctx, terminalID)
	if err != nil {
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

	serverEphemeral, err := crypto.GenerateEphemeralKeyPair()
	if err != nil {
		return nil, nil, fmt.Errorf("generating server ephemeral keypair: %w", err)
	}

	sharedKey, err := crypto.PerformEphemeralECDH(serverEphemeral.PrivateKey, ed25519.PublicKey(ephPub))
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
		return nil, nil, fmt.Errorf("decrypting payload: %w", err)
	}

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
