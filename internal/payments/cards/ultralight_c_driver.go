package cards

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// UltralightCSlotData representa un slot de certificado Ultralight C.
type UltralightCSlotData struct {
	SlotNumber   int    `json:"slot_number"`
	Certificate  string `json:"certificate"` // hex 16 bytes
	IsActive     bool   `json:"is_active"`
	IsBackup     bool   `json:"is_backup"`
	BackupOfSlot *int   `json:"backup_of_slot,omitempty"`
}

// UltralightCProvisionResponse es la respuesta de provisionamiento Ultralight C.
type UltralightCProvisionResponse struct {
	CardUID      string                `json:"card_uid"`
	DesKey       string                `json:"des_key"` // hex 16 bytes (3DES key)
	CustomCardID string                `json:"custom_card_id"`
	Slots        []UltralightCSlotData `json:"slots"`
}

// UltralightCPreAuthData son los datos específicos de pre-auth Ultralight C.
type UltralightCPreAuthData struct {
	DesKey              string `json:"des_key"`              // hex 16 bytes
	ReadSlot            int    `json:"read_slot"`            // 0-3
	ExpectedCertificate string `json:"expected_certificate"` // hex 16 bytes
	WriteSlot           int    `json:"write_slot"`           // 0-3
	BackupSlot          int    `json:"backup_slot"`          // 4-7
	NewCertificate      string `json:"new_certificate"`      // hex 16 bytes
}

// UltralightCDriver implementa el protocolo de certificados dinámicos para
// MIFARE Ultralight C.
//
// Ultralight C tiene:
//   - 148 bytes de memoria de usuario (37 páginas de 4 bytes)
//   - 3DES con clave de 112 bits (MEJOR que Crypto1 de Classic)
//   - 8 slots (4 activos + 4 backups) con doble redundancia
//   - Autenticación mutua 3-pass con 3DES
//   - Capacidad "low" — usar solo si no se consigue NTAG215
type UltralightCDriver struct {
	manifest CardManifest
}

func init() {
	Register(&UltralightCDriver{
		manifest: CardManifest{
			Type:         "ultralight_c",
			DisplayName:  "MIFARE Ultralight C",
			Description:  "Tarjeta con 3DES (112-bit), mejor cripto que Classic pero solo 148 bytes = 8 slots. Baja capacidad.",
			Manufacturer: "NXP Semiconductors",
			Capacity:     "low",
			Memory: MemSpec{
				TotalBytes: 192, UserBytes: 148, PageSize: 4,
				TotalPages: 48, UserPages: 37,
			},
			Security: SecuritySpec{
				Level: "3des", Algorithm: "3DES-112bit",
				KeyLengthBits: 112, KeyCount: 1,
				MutualAuth: true, SecureMessaging: false,
				CryptoPerSlot: false, OriginalitySignature: false,
				Notes: "Mejor criptografia que Classic. Sin secure messaging post-auth.",
			},
			Compatibility: CompatibilitySpec{
				Android: "partial", IOS: "partial", ESP32PN532: "full",
				PhoneReader: true, NFCForumType: 2,
				Notes: "Implementacion de MifareUltralight es opcional en Android",
			},
			Protocol: ProtocolSpec{
				Slots: 8, ActiveSlots: 4, BackupSlots: 4,
				CertificateSize: 16, Redundancy: 2,
				PublicZonePages: 4, PublicZoneStartPage: 4,
				PrivateZoneStartPage: 8, PrivateZoneEndPage: 39,
				AuthMethod: "3DES_3pass_mutual", Rotation: "random_per_transaction",
				PreAuthTTLSeconds: 30,
			},
			Availability: AvailabilitySpec{
				Venezuela: true, PriceUSD: 0.15,
				Notes: "Usar solo si no se consigue NTAG215. Menos slots pero mejor cripto que Classic.",
			},
			Endpoints: EndpointsSpec{
				Provision: "/api/nfc/cards/provision-ultralight-c",
				PreAuth:   "/api/nfc/terminal/ultralight-c/pre-auth",
				Confirm:   "/api/nfc/terminal/ultralight-c/confirm",
			},
			Docs: []string{"docs/tarjeta-ultralight-c-protocolo.md"},
		},
	})
}

func (d *UltralightCDriver) GetType() string           { return "ultralight_c" }
func (d *UltralightCDriver) GetManifest() CardManifest { return d.manifest }
func (d *UltralightCDriver) RequiresDocument() bool    { return true }

// Provision genera clave 3DES, 8 slots y custom_card_id.
func (d *UltralightCDriver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	// 1. Hashear PIN
	pinHash, err := bcrypt.GenerateFromPassword([]byte(initialPIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing PIN: %w", err)
	}

	// 2. Generar clave 3DES (16 bytes = 112 bits efectivos)
	desKey := make([]byte, 16)
	if _, err := rand.Read(desKey); err != nil {
		return nil, fmt.Errorf("generating 3DES key: %w", err)
	}

	// 3. Generar custom_card_id (8 bytes)
	customID := make([]byte, 8)
	if _, err := rand.Read(customID); err != nil {
		return nil, fmt.Errorf("generating custom_card_id: %w", err)
	}

	// 4. Registrar tarjeta en nfc_cards
	var cardID uuid.UUID
	err = pool.QueryRow(ctx, `
		INSERT INTO nfc_cards (user_id, card_uid, is_active, card_type, crypto_enabled, pin_hash, has_dynamic_certs, custom_card_id, ultralight_c_key_encrypted)
		VALUES ($1, $2, true, 'ultralight_c', true, $3, true, $4, $5)
		ON CONFLICT (card_uid) DO UPDATE SET is_active = true, card_type = 'ultralight_c', pin_hash = $3, has_dynamic_certs = true, custom_card_id = $4, ultralight_c_key_encrypted = $5
		RETURNING id`,
		userID, cardUID, string(pinHash), hex.EncodeToString(customID), desKey,
	).Scan(&cardID)
	if err != nil {
		return nil, fmt.Errorf("issuing Ultralight C card: %w", err)
	}

	// 5. Elegir slot activo aleatorio (0-3)
	activeSlotByte := make([]byte, 1)
	rand.Read(activeSlotByte)
	activeSlot := int(activeSlotByte[0]) % 4

	// 6. Generar 8 certificados y guardar en nfc_ultralight_c_slots
	slots := make([]UltralightCSlotData, 8)
	for i := 0; i < 8; i++ {
		cert := make([]byte, 16)
		if _, err := rand.Read(cert); err != nil {
			return nil, fmt.Errorf("generating cert for slot %d: %w", i, err)
		}

		isActive := i == activeSlot
		isBackup := i >= 4
		var backupOf *int
		if isBackup {
			b := i - 4
			backupOf = &b
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO nfc_ultralight_c_slots (card_uid, node_domain, slot_number, is_backup, backup_of_slot, start_page, end_page, certificate, is_active, written_pages)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
			ON CONFLICT (card_uid, slot_number) DO UPDATE SET
				is_backup = $4, backup_of_slot = $5, start_page = $6, end_page = $7, certificate = $8, is_active = $9, written_pages = 0, needs_repair = false, updated_at = NOW()`,
			cardUID, nodeDomain, i, isBackup, backupOf, UltralightCSlotToStartPage(i), UltralightCSlotToEndPage(i), cert, isActive,
		)
		if err != nil {
			return nil, fmt.Errorf("inserting slot %d: %w", i, err)
		}

		slots[i] = UltralightCSlotData{
			SlotNumber:   i,
			Certificate:  hex.EncodeToString(cert),
			IsActive:     isActive,
			IsBackup:     isBackup,
			BackupOfSlot: backupOf,
		}
	}

	// 7. Copiar el cert activo al backup correspondiente
	activeCert := slots[activeSlot].Certificate
	backupSlot := activeSlot + 4
	activeCertBytes, _ := hex.DecodeString(activeCert)
	_, err = pool.Exec(ctx, `
		UPDATE nfc_ultralight_c_slots SET certificate = $3, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, backupSlot, activeCertBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("updating backup slot: %w", err)
	}
	slots[backupSlot].Certificate = activeCert

	rawData, _ := json.Marshal(UltralightCProvisionResponse{
		CardUID:      cardUID,
		DesKey:       hex.EncodeToString(desKey),
		CustomCardID: hex.EncodeToString(customID),
		Slots:        slots,
	})

	return &ProvisionResponse{
		CardUID:      cardUID,
		CardType:     "ultralight_c",
		CustomCardID: hex.EncodeToString(customID),
		RawData:      rawData,
	}, nil
}

// PreAuth valida usuario + PIN + saldo y prepara la rotación del certificado.
func (d *UltralightCDriver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	// 1. Verificar que el usuario no se esté pagando a sí mismo
	var merchantUserID *uuid.UUID
	_ = pool.QueryRow(ctx, `SELECT merchant_user_id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&merchantUserID)
	if merchantUserID != nil && *merchantUserID == userID {
		return &PreAuthResponse{PreApproved: false, Message: "no puedes pagarte a ti mismo"}, nil
	}

	// 2. Buscar tarjeta Ultralight C activa del usuario
	var cardUID string
	var desKeyBytes []byte
	err := pool.QueryRow(ctx, `
		SELECT card_uid, ultralight_c_key_encrypted
		FROM nfc_cards
		WHERE user_id = $1 AND is_active = true AND card_type = 'ultralight_c'
		ORDER BY issued_at DESC LIMIT 1`,
		userID,
	).Scan(&cardUID, &desKeyBytes)
	if err != nil {
		return &PreAuthResponse{PreApproved: false, Message: "no se encontro tarjeta Ultralight C activa para este usuario"}, nil
	}

	// 3. Verificar saldo
	var balance, creditLimit int64
	err = pool.QueryRow(ctx, `SELECT balance, credit_limit FROM users WHERE id = $1`, userID).Scan(&balance, &creditLimit)
	if err != nil {
		return nil, fmt.Errorf("getting user balance: %w", err)
	}
	if balance-amount < creditLimit {
		return &PreAuthResponse{PreApproved: false, Message: "has llegado al tope de tu credito comunitario"}, nil
	}

	// 4. Buscar slot activo actual
	var readSlot int
	var certBytes []byte
	err = pool.QueryRow(ctx, `
		SELECT slot_number, certificate FROM nfc_ultralight_c_slots
		WHERE card_uid = $1 AND is_active = true AND is_backup = false LIMIT 1`,
		cardUID,
	).Scan(&readSlot, &certBytes)
	if err != nil {
		return &PreAuthResponse{PreApproved: false, Message: "no hay slot activo en la tarjeta"}, nil
	}

	// 5. Generar nuevo certificado
	newCert := make([]byte, 16)
	if _, err := rand.Read(newCert); err != nil {
		return nil, fmt.Errorf("generating new certificate: %w", err)
	}

	// 6. Elegir slot de escritura aleatorio (0-3, != slot activo)
	writeSlot := readSlot
	for writeSlot == readSlot {
		randByte := make([]byte, 1)
		rand.Read(randByte)
		writeSlot = int(randByte[0]) % 4
	}
	backupSlot := writeSlot + 4

	// 7. Guardar pre-aprobación (TTL 30s)
	pendingID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO nfc_ultralight_c_pending (id, card_uid, terminal_id, user_id, amount, read_slot, write_slot, backup_slot, new_certificate, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '30 seconds')`,
		pendingID, cardUID, terminalID, userID, amount, readSlot, writeSlot, backupSlot, newCert,
	)
	if err != nil {
		return nil, fmt.Errorf("saving pre-auth: %w", err)
	}

	data := UltralightCPreAuthData{
		DesKey:              hex.EncodeToString(desKeyBytes),
		ReadSlot:            readSlot,
		ExpectedCertificate: hex.EncodeToString(certBytes),
		WriteSlot:           writeSlot,
		BackupSlot:          backupSlot,
		NewCertificate:      hex.EncodeToString(newCert),
	}
	rawData, _ := json.Marshal(data)

	return &PreAuthResponse{
		PreApproved: true,
		CardType:    "ultralight_c",
		CardUID:     cardUID,
		RawData:     rawData,
	}, nil
}

// Confirm confirma la lectura/escritura y procesa el pago.
func (d *UltralightCDriver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	// 1. Buscar pre-aprobación pendiente
	var pendingID uuid.UUID
	var userID uuid.UUID
	var amount int64
	var readSlot, writeSlot, backupSlot int
	var newCert []byte
	err := pool.QueryRow(ctx, `
		SELECT id, user_id, amount, read_slot, write_slot, backup_slot, new_certificate
		FROM nfc_ultralight_c_pending
		WHERE card_uid = $1 AND terminal_id = $2 AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`,
		cardUID, terminalID,
	).Scan(&pendingID, &userID, &amount, &readSlot, &writeSlot, &backupSlot, &newCert)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "no hay pre-aprobacion pendiente o ha expirado"}, nil
	}

	// 2. Si falló la lectura o escritura, cancelar
	if !confirmData.ReadOK || !confirmData.WriteOK {
		pool.Exec(ctx, `DELETE FROM nfc_ultralight_c_pending WHERE id = $1`, pendingID)
		msg := "lectura o escritura de tarjeta fallo"
		if !confirmData.ReadOK {
			msg = "no se pudo leer el certificado de la tarjeta"
		} else if !confirmData.WriteOK {
			msg = "no se pudo escribir el nuevo certificado en la tarjeta"
		}
		return &NFCPaymentResult{Status: "rejected", Message: msg}, nil
	}

	// 3. Procesar pago: debitar balance
	_, err = pool.Exec(ctx, `UPDATE users SET balance = balance - $2, updated_at = NOW() WHERE id = $1`, userID, amount)
	if err != nil {
		return nil, fmt.Errorf("debiting user: %w", err)
	}

	// 4. Rotar slots
	pool.Exec(ctx, `UPDATE nfc_ultralight_c_slots SET is_active = false, updated_at = NOW() WHERE card_uid = $1 AND slot_number = $2`, cardUID, readSlot)

	needsRepair := confirmData.WrittenPages < 8
	pool.Exec(ctx, `
		UPDATE nfc_ultralight_c_slots SET is_active = true, certificate = $3, written_pages = $4, needs_repair = $5, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, writeSlot, newCert, confirmData.WrittenPages/4, needsRepair)

	// 5. Actualizar backup slot
	pool.Exec(ctx, `
		UPDATE nfc_ultralight_c_slots SET certificate = $3, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, backupSlot, newCert)

	// 6. Borrar pre-aprobación
	pool.Exec(ctx, `DELETE FROM nfc_ultralight_c_pending WHERE id = $1`, pendingID)

	// 7. Log transacción
	var termDBID sql.NullString
	pool.QueryRow(ctx, `SELECT id::text FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&termDBID)
	pool.Exec(ctx, `
		INSERT INTO nfc_transactions (terminal_id, card_uid, user_id, amount, status, crypto_token, pin_verified, transaction_type, error_message)
		VALUES ($1, $2, $3, $4, 'approved', $5, true, 'single', '')`,
		termDBID.String, cardUID, userID, amount, hex.EncodeToString(newCert))

	// 8. Calcular nuevo balance
	var newBalance int64
	pool.QueryRow(ctx, `SELECT balance FROM users WHERE id = $1`, userID).Scan(&newBalance)

	txID := uuid.New()
	return &NFCPaymentResult{
		Status:        "approved",
		TransactionID: txID.String(),
		Message:       "transaccion aprobada",
		UserBalance:   &newBalance,
	}, nil
}

// CleanupExpired borra las pre-aprobaciones expiradas.
func (d *UltralightCDriver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	_, err := pool.Exec(ctx, `DELETE FROM nfc_ultralight_c_pending WHERE expires_at < NOW()`)
	return err
}

// UltralightCSlotToStartPage convierte un número de slot a su página inicial.
// página_inicial = 8 + (slot * 4)
func UltralightCSlotToStartPage(slot int) int {
	return 8 + (slot * 4)
}

// UltralightCSlotToEndPage convierte un número de slot a su página final.
func UltralightCSlotToEndPage(slot int) int {
	return UltralightCSlotToStartPage(slot) + 3
}
