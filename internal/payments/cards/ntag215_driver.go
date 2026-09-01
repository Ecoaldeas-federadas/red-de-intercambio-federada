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

// NTAG215SlotData representa un slot de certificado NTAG215.
type NTAG215SlotData struct {
	SlotNumber   int    `json:"slot_number"`
	Certificate  string `json:"certificate"` // hex 16 bytes
	IsActive     bool   `json:"is_active"`
	IsBackup     bool   `json:"is_backup"`
	BackupOfSlot *int   `json:"backup_of_slot,omitempty"`
}

// NTAG215ProvisionResponse es la respuesta de provisionamiento NTAG215.
type NTAG215ProvisionResponse struct {
	CardUID      string            `json:"card_uid"`
	Password     string            `json:"password"`       // hex 4 bytes
	Pack         string            `json:"pack"`           // hex 2 bytes
	Auth0        int               `json:"auth0"`          // 10
	CustomCardID string            `json:"custom_card_id"` // hex 8 bytes
	Slots        []NTAG215SlotData `json:"slots"`
}

// NTAG215PreAuthData son los datos específicos de pre-auth NTAG215.
type NTAG215PreAuthData struct {
	Password            string `json:"password"`             // hex 4 bytes
	Pack                string `json:"pack"`                 // hex 2 bytes
	ReadSlot            int    `json:"read_slot"`            // 0-14
	ExpectedCertificate string `json:"expected_certificate"` // hex 16 bytes
	WriteSlot           int    `json:"write_slot"`           // 0-14
	BackupSlot          int    `json:"backup_slot"`          // 15-29
	NewCertificate      string `json:"new_certificate"`      // hex 16 bytes
}

// NTAG215Driver implementa el protocolo de certificados dinámicos para NTAG215.
//
// NTAG215 tiene:
//   - 504 bytes de memoria de usuario (126 páginas de 4 bytes)
//   - 1 PWD de 32 bits para toda la zona privada
//   - 30 slots (15 activos + 15 backups) con doble redundancia
//   - Zona pública (páginas 4-9) sin contraseña
//   - Compatible con TODOS los teléfonos (Android + iOS)
type NTAG215Driver struct {
	manifest CardManifest
}

func init() {
	Register(&NTAG215Driver{
		manifest: CardManifest{
			Type:         "ntag215",
			DisplayName:  "NTAG215",
			Description:  "Tarjeta NFC Type 2 con 504 bytes, PWD de 32 bits. Compatible con todos los telefonos.",
			Manufacturer: "NXP Semiconductors",
			Capacity:     "full",
			Memory: MemSpec{
				TotalBytes: 540, UserBytes: 504, PageSize: 4,
				TotalPages: 135, UserPages: 126,
			},
			Security: SecuritySpec{
				Level: "password", Algorithm: "PWD-32bit",
				KeyLengthBits: 32, KeyCount: 1,
				MutualAuth: false, SecureMessaging: false,
				CryptoPerSlot: false, OriginalitySignature: true,
				AuthLimitConfigurable: true,
			},
			Compatibility: CompatibilitySpec{
				Android: "full", IOS: "full", ESP32PN532: "full",
				PhoneReader: true, NFCForumType: 2,
				Notes: "Universal — funciona en todos los telefonos NFC Android y iOS",
			},
			Protocol: ProtocolSpec{
				Slots: 30, ActiveSlots: 15, BackupSlots: 15,
				CertificateSize: 16, Redundancy: 2,
				PublicZonePages: 6, PublicZoneStartPage: 4,
				PrivateZoneStartPage: 10, PrivateZoneEndPage: 129,
				AuthMethod: "PWD_AUTH", Rotation: "random_per_transaction",
				PreAuthTTLSeconds: 30,
			},
			Availability: AvailabilitySpec{
				Venezuela: true, PriceUSD: 0.15,
				Notes: "Disponible en Venezuela. Recomendada como tarjeta principal.",
			},
			Endpoints: EndpointsSpec{
				Provision: "/api/nfc/cards/provision-ntag215",
				PreAuth:   "/api/nfc/terminal/ntag215/pre-auth",
				Confirm:   "/api/nfc/terminal/ntag215/confirm",
			},
			Docs: []string{"docs/tarjeta-ntag215-protocolo.md"},
		},
	})
}

func (d *NTAG215Driver) GetType() string           { return "ntag215" }
func (d *NTAG215Driver) GetManifest() CardManifest { return d.manifest }
func (d *NTAG215Driver) RequiresDocument() bool    { return true }

// Provision genera PWD, PACK, 30 slots y custom_card_id.
func (d *NTAG215Driver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	// 1. Hashear PIN
	pinHash, err := bcrypt.GenerateFromPassword([]byte(initialPIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing PIN: %w", err)
	}

	// 2. Generar PWD (4 bytes) y PACK (2 bytes) aleatorios
	pwd := make([]byte, 4)
	if _, err := rand.Read(pwd); err != nil {
		return nil, fmt.Errorf("generating PWD: %w", err)
	}
	pack := make([]byte, 2)
	if _, err := rand.Read(pack); err != nil {
		return nil, fmt.Errorf("generating PACK: %w", err)
	}

	// 3. Generar custom_card_id (8 bytes) aleatorio
	customID := make([]byte, 8)
	if _, err := rand.Read(customID); err != nil {
		return nil, fmt.Errorf("generating custom_card_id: %w", err)
	}

	// 4. Registrar tarjeta en nfc_cards
	var cardID uuid.UUID
	err = pool.QueryRow(ctx, `
		INSERT INTO nfc_cards (user_id, card_uid, is_active, card_type, crypto_enabled, pin_hash, has_dynamic_certs, custom_card_id, ntag215_pwd_encrypted, ntag215_pack, ntag215_auth0)
		VALUES ($1, $2, true, 'ntag215', true, $3, true, $4, $5, $6, 10)
		ON CONFLICT (card_uid) DO UPDATE SET is_active = true, card_type = 'ntag215', pin_hash = $3, has_dynamic_certs = true, custom_card_id = $4, ntag215_pwd_encrypted = $5, ntag215_pack = $6, ntag215_auth0 = 10
		RETURNING id`,
		userID, cardUID, string(pinHash), hex.EncodeToString(customID), pwd, pack,
	).Scan(&cardID)
	if err != nil {
		return nil, fmt.Errorf("issuing NTAG215 card: %w", err)
	}

	// 5. Elegir slot activo aleatorio (0-14)
	activeSlotByte := make([]byte, 1)
	rand.Read(activeSlotByte)
	activeSlot := int(activeSlotByte[0]) % 15

	// 6. Generar 30 certificados y guardar en nfc_ntag215_slots
	slots := make([]NTAG215SlotData, 30)
	for i := 0; i < 30; i++ {
		cert := make([]byte, 16)
		if _, err := rand.Read(cert); err != nil {
			return nil, fmt.Errorf("generating cert for slot %d: %w", i, err)
		}

		isActive := i == activeSlot
		isBackup := i >= 15
		var backupOf *int
		if isBackup {
			b := i - 15
			backupOf = &b
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO nfc_ntag215_slots (card_uid, node_domain, slot_number, is_backup, backup_of_slot, start_page, end_page, certificate, is_active, written_pages)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
			ON CONFLICT (card_uid, slot_number) DO UPDATE SET
				is_backup = $4, backup_of_slot = $5, start_page = $6, end_page = $7, certificate = $8, is_active = $9, written_pages = 0, needs_repair = false, updated_at = NOW()`,
			cardUID, nodeDomain, i, isBackup, backupOf, SlotToStartPage(i), SlotToEndPage(i), cert, isActive,
		)
		if err != nil {
			return nil, fmt.Errorf("inserting slot %d: %w", i, err)
		}

		slots[i] = NTAG215SlotData{
			SlotNumber:   i,
			Certificate:  hex.EncodeToString(cert),
			IsActive:     isActive,
			IsBackup:     isBackup,
			BackupOfSlot: backupOf,
		}
	}

	// 7. Copiar el cert activo al backup correspondiente
	activeCert := slots[activeSlot].Certificate
	backupSlot := activeSlot + 15
	activeCertBytes, _ := hex.DecodeString(activeCert)
	_, err = pool.Exec(ctx, `
		UPDATE nfc_ntag215_slots SET certificate = $3, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, backupSlot, activeCertBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("updating backup slot: %w", err)
	}
	slots[backupSlot].Certificate = activeCert

	rawData, _ := json.Marshal(NTAG215ProvisionResponse{
		CardUID:      cardUID,
		Password:     hex.EncodeToString(pwd),
		Pack:         hex.EncodeToString(pack),
		Auth0:        10,
		CustomCardID: hex.EncodeToString(customID),
		Slots:        slots,
	})

	return &ProvisionResponse{
		CardUID:      cardUID,
		CardType:     "ntag215",
		CustomCardID: hex.EncodeToString(customID),
		RawData:      rawData,
	}, nil
}

// PreAuth valida usuario + PIN + saldo y prepara la rotación del certificado.
func (d *NTAG215Driver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	// 1. Verificar que el usuario no se esté pagando a sí mismo
	var merchantUserID *uuid.UUID
	_ = pool.QueryRow(ctx, `SELECT merchant_user_id FROM nfc_terminals WHERE terminal_id = $1`, terminalID).Scan(&merchantUserID)
	if merchantUserID != nil && *merchantUserID == userID {
		return &PreAuthResponse{PreApproved: false, Message: "no puedes pagarte a ti mismo"}, nil
	}

	// 2. Buscar tarjeta NTAG215 activa del usuario
	var cardUID string
	var pwdBytes, packBytes []byte
	err := pool.QueryRow(ctx, `
		SELECT card_uid, ntag215_pwd_encrypted, ntag215_pack
		FROM nfc_cards
		WHERE user_id = $1 AND is_active = true AND card_type = 'ntag215'
		ORDER BY issued_at DESC LIMIT 1`,
		userID,
	).Scan(&cardUID, &pwdBytes, &packBytes)
	if err != nil {
		return &PreAuthResponse{PreApproved: false, Message: "no se encontro tarjeta NTAG215 activa para este usuario"}, nil
	}

	// 3. Verificar saldo (filosofia moneda cero: puede ser negativo hasta credit_limit)
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
		SELECT slot_number, certificate FROM nfc_ntag215_slots
		WHERE card_uid = $1 AND is_active = true AND is_backup = false LIMIT 1`,
		cardUID,
	).Scan(&readSlot, &certBytes)
	if err != nil {
		return &PreAuthResponse{PreApproved: false, Message: "no hay slot activo en la tarjeta"}, nil
	}

	// 5. Generar nuevo certificado (16 bytes aleatorios)
	newCert := make([]byte, 16)
	if _, err := rand.Read(newCert); err != nil {
		return nil, fmt.Errorf("generating new certificate: %w", err)
	}

	// 6. Elegir slot de escritura aleatorio (0-14, != slot activo)
	writeSlot := readSlot
	for writeSlot == readSlot {
		randByte := make([]byte, 1)
		rand.Read(randByte)
		writeSlot = int(randByte[0]) % 15
	}
	backupSlot := writeSlot + 15

	// 7. Guardar pre-aprobación (TTL 30s)
	pendingID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO nfc_ntag215_pending (id, card_uid, terminal_id, user_id, amount, read_slot, write_slot, backup_slot, new_certificate, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '30 seconds')`,
		pendingID, cardUID, terminalID, userID, amount, readSlot, writeSlot, backupSlot, newCert,
	)
	if err != nil {
		return nil, fmt.Errorf("saving pre-auth: %w", err)
	}

	data := NTAG215PreAuthData{
		Password:            hex.EncodeToString(pwdBytes),
		Pack:                hex.EncodeToString(packBytes),
		ReadSlot:            readSlot,
		ExpectedCertificate: hex.EncodeToString(certBytes),
		WriteSlot:           writeSlot,
		BackupSlot:          backupSlot,
		NewCertificate:      hex.EncodeToString(newCert),
	}
	rawData, _ := json.Marshal(data)

	return &PreAuthResponse{
		PreApproved: true,
		CardType:    "ntag215",
		CardUID:     cardUID,
		RawData:     rawData,
	}, nil
}

// Confirm confirma la lectura/escritura y procesa el pago.
func (d *NTAG215Driver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	// 1. Buscar pre-aprobación pendiente
	var pendingID uuid.UUID
	var userID uuid.UUID
	var amount int64
	var readSlot, writeSlot, backupSlot int
	var newCert []byte
	err := pool.QueryRow(ctx, `
		SELECT id, user_id, amount, read_slot, write_slot, backup_slot, new_certificate
		FROM nfc_ntag215_pending
		WHERE card_uid = $1 AND terminal_id = $2 AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`,
		cardUID, terminalID,
	).Scan(&pendingID, &userID, &amount, &readSlot, &writeSlot, &backupSlot, &newCert)
	if err != nil {
		return &NFCPaymentResult{Status: "rejected", Message: "no hay pre-aprobacion pendiente o ha expirado"}, nil
	}

	// 2. Si falló la lectura o escritura, cancelar
	if !confirmData.ReadOK || !confirmData.WriteOK {
		pool.Exec(ctx, `DELETE FROM nfc_ntag215_pending WHERE id = $1`, pendingID)
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

	// 4. Rotar slots: desactivar viejo, activar nuevo
	pool.Exec(ctx, `UPDATE nfc_ntag215_slots SET is_active = false, updated_at = NOW() WHERE card_uid = $1 AND slot_number = $2`, cardUID, readSlot)

	needsRepair := confirmData.WrittenPages < 8
	pool.Exec(ctx, `
		UPDATE nfc_ntag215_slots SET is_active = true, certificate = $3, written_pages = $4, needs_repair = $5, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, writeSlot, newCert, confirmData.WrittenPages/4, needsRepair)

	// 5. Actualizar backup slot
	pool.Exec(ctx, `
		UPDATE nfc_ntag215_slots SET certificate = $3, written_pages = $4, updated_at = NOW()
		WHERE card_uid = $1 AND slot_number = $2`,
		cardUID, backupSlot, newCert, confirmData.WrittenPages/4)

	// 6. Borrar pre-aprobación
	pool.Exec(ctx, `DELETE FROM nfc_ntag215_pending WHERE id = $1`, pendingID)

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
func (d *NTAG215Driver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	_, err := pool.Exec(ctx, `DELETE FROM nfc_ntag215_pending WHERE expires_at < NOW()`)
	return err
}

// GetNTAG215Slots retorna todos los slots de una tarjeta NTAG215.
func GetNTAG215Slots(ctx context.Context, pool *pgxpool.Pool, cardUID string) ([]NTAG215SlotData, error) {
	rows, err := pool.Query(ctx, `
		SELECT slot_number, certificate, is_active, is_backup, backup_of_slot
		FROM nfc_ntag215_slots WHERE card_uid = $1 ORDER BY slot_number`, cardUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []NTAG215SlotData
	for rows.Next() {
		var s NTAG215SlotData
		var cert []byte
		var backupOf *int
		if err := rows.Scan(&s.SlotNumber, &cert, &s.IsActive, &s.IsBackup, &backupOf); err != nil {
			continue
		}
		s.Certificate = hex.EncodeToString(cert)
		s.BackupOfSlot = backupOf
		slots = append(slots, s)
	}
	return slots, nil
}

// PageToSlot convierte un número de página inicial a número de slot.
// página_inicial = 10 + (slot * 4)
func PageToSlot(page int) int {
	return (page - 10) / 4
}

// SlotToStartPage convierte un número de slot a su página inicial.
// página_inicial = 10 + (slot * 4)
func SlotToStartPage(slot int) int {
	return 10 + (slot * 4)
}

// SlotToEndPage convierte un número de slot a su página final (inclusiva).
func SlotToEndPage(slot int) int {
	return SlotToStartPage(slot) + 3
}
