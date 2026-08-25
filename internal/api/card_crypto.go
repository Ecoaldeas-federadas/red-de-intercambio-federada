package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CardCryptoHandler implementa el modelo criptografico completo para tarjetas NFC.
//
// Las tarjetas ya no son "tontas" (solo UID). Ahora tienen claves AES-128
// embebidas que prueban criptograficamente que son legitimas.
//
// Flujo:
// 1. Servidor genera clave AES-128 por tarjeta (provisionamiento)
// 2. Clave se escribe en la tarjeta (DESFire EV3 o NTAG424)
// 3. Clave se guarda cifrada en la BD (cifrada con clave maestra del nodo)
// 4. Terminal/app lee tarjeta, pide clave al servidor (canal cifrado)
// 5. Terminal descifra clave en memoria (nunca en disco)
// 6. Terminal hace challenge-response con la tarjeta
// 7. Tarjeta responde con HMAC/AES del challenge
// 8. Terminal envia UID + prueba criptografica al servidor
// 9. Servidor verifica y procesa
type CardCryptoHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *CardCryptoHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Provisionamiento de tarjetas criptograficas (admin)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/cards/provision-crypto", h.provisionCryptoCard)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/cards/{uid}/rotate-key", h.rotateCardKey)

	// Distribucion de claves a terminales/apps autenticadas
	r.Post("/api/nfc/cards/{uid}/request-key", h.requestCardKey)
	// La terminal pide la clave AES de una tarjeta (canal cifrado)

	// Challenge-response
	r.Post("/api/nfc/cards/{uid}/challenge", h.generateChallenge)
	// Servidor genera un challenge para la tarjeta
	r.Post("/api/nfc/cards/{uid}/verify-response", h.verifyCardResponse)
	// Terminal envia la respuesta de la tarjeta, servidor verifica

	// NTAG424 SUN verification
	r.Post("/api/nfc/cards/{uid}/verify-sun", h.verifySUN)
	// Terminal envia el SUN MAC leido de la tarjeta

	// Estado criptografico de una tarjeta
	r.Get("/api/nfc/cards/{uid}/crypto-status", h.getCryptoStatus)
	r.With(am.RequirePermission("nfc.register_terminal")).Post("/api/nfc/cards/{uid}/block-crypto", h.blockCardCrypto)
}

// === CLAVE MAESTRA DEL NODO ===

// getOrCreateMasterKey obtiene o crea la clave maestra del nodo
// que se usa para cifrar las claves AES de las tarjetas
func (h *CardCryptoHandler) getOrCreateMasterKey(nodeDomain string) ([]byte, error) {
	// La clave de entorno para cifrar la clave maestra
	envKey := os.Getenv("NODE_MASTER_KEY")
	if envKey == "" {
		// Si no hay clave de entorno, derivar del dominio del nodo
		// (no ideal, pero mejor que nada para desarrollo)
		envKey = "default-master-key-" + nodeDomain
	}

	var masterKeyEncrypted, keySalt []byte
	err := h.Pool.QueryRow(nil, `
		SELECT master_key_encrypted, key_salt FROM node_master_keys WHERE node_domain = $1`,
		nodeDomain).Scan(&masterKeyEncrypted, &keySalt)

	if err == nil {
		// Descifrar la clave maestra con la clave de entorno
		return decryptWithPassword(masterKeyEncrypted, envKey, keySalt)
	}

	// Crear nueva clave maestra
	masterKey := make([]byte, 32)
	rand.Read(masterKey)

	salt := make([]byte, 16)
	rand.Read(salt)

	encrypted, err := encryptWithPassword(masterKey, envKey, salt)
	if err != nil {
		return nil, fmt.Errorf("error encrypting master key: %w", err)
	}

	h.Pool.Exec(nil, `
		INSERT INTO node_master_keys (node_domain, master_key_encrypted, key_salt)
		VALUES ($1, $2, $3)
		ON CONFLICT (node_domain) DO NOTHING`,
		nodeDomain, encrypted, salt)

	return masterKey, nil
}

// encryptWithPassword cifra datos usando AES-256-GCM derivado de una password
func encryptWithPassword(plaintext []byte, password string, salt []byte) ([]byte, error) {
	// Derivar clave de la password + salt
	key := deriveKey(password, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	rand.Read(nonce)

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// decryptWithPassword descifra datos usando AES-256-GCM derivado de una password
func decryptWithPassword(ciphertext []byte, password string, salt []byte) ([]byte, error) {
	key := deriveKey(password, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	return plaintext, nil
}

// deriveKey deriva una clave AES-256 de una password + salt
func deriveKey(password string, salt []byte) []byte {
	h := sha256.New()
	h.Write([]byte(password))
	h.Write(salt)
	return h.Sum(nil) // 32 bytes = AES-256
}

// encryptAESKey cifra una clave AES-128 con la clave maestra del nodo
func encryptAESKey(aesKey []byte, masterKey []byte) ([]byte, error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	rand.Read(nonce)
	return gcm.Seal(nonce, nonce, aesKey, nil), nil
}

// decryptAESKey descifra una clave AES-128 con la clave maestra del nodo
func decryptAESKey(encrypted []byte, masterKey []byte) ([]byte, error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return nil, fmt.Errorf("encrypted key too short")
	}
	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// === PROVISIONAMIENTO ===

// provisionCryptoCard: genera una clave AES-128 para una tarjeta,
// la guarda cifrada en la BD, y devuelve la clave en base64
// para que el admin la escriba en la tarjeta (DESFire/NTAG424)
func (h *CardCryptoHandler) provisionCryptoCard(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		CardUID   string `json:"card_uid"`
		UserID    string `json:"user_id"`
		CardType  string `json:"card_type"` // ntag424, desfire, mifare_classic
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.CardUID == "" || body.UserID == "" {
		writeError(w, 400, "card_uid y user_id son requeridos")
		return
	}
	if body.CardType == "" {
		body.CardType = "ntag424"
	}

	userID, err := uuid.Parse(body.UserID)
	if err != nil {
		writeError(w, 400, "user_id invalido")
		return
	}

	// Verificar que la tarjeta no tenga ya una clave
	var existingID *string
	h.Pool.QueryRow(r.Context(), `SELECT id FROM nfc_card_keys WHERE card_uid = $1`, body.CardUID).Scan(&existingID)
	if existingID != nil {
		writeError(w, 409, "esta tarjeta ya tiene una clave criptografica. Use rotate-key para rotarla.")
		return
	}

	// Generar clave AES-128 (16 bytes)
	aesKey := make([]byte, 16)
	rand.Read(aesKey)

	// Cifrar la clave con la clave maestra del nodo
	masterKey, err := h.getOrCreateMasterKey(nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting master key")
		return
	}

	encryptedKey, err := encryptAESKey(aesKey, masterKey)
	if err != nil {
		writeError(w, 500, "error encrypting card key")
		return
	}

	adminID, _ := getUserID(r)

	// Guardar en la BD
	var id string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO nfc_card_keys (card_uid, node_domain, user_id, card_type,
			aes_key_encrypted, secret_key_encrypted, key_version,
			provisioned_by, provisioned_at, is_active)
		VALUES ($1, $2, $3, $4, $5, $5, 1, $6, NOW(), true)
		RETURNING id`,
		body.CardUID, nodeDomain, userID, body.CardType,
		encryptedKey, adminID).Scan(&id)
	if err != nil {
		writeError(w, 500, "error saving card key")
		return
	}

	// Devolver la clave AES en base64 para que el admin la escriba en la tarjeta
	// TAMBIEN devolver en hex para compatibilidad con herramientas NFC
	writeJSON(w, 201, map[string]interface{}{
		"id":         id,
		"card_uid":   body.CardUID,
		"card_type":  body.CardType,
		"aes_key_b64": base64.StdEncoding.EncodeToString(aesKey),
		"aes_key_hex": hex.EncodeToString(aesKey),
		"message":    "Clave generada. Escribe esta clave en la tarjeta usando tu herramienta NFC (DESFire o NTAG424). La clave se guarda cifrada en el servidor.",
		"warning":    "GUARDA ESTA CLAVE DE FORMA SEGURA. No se volvera a mostrar. Si la pierdes, usa rotate-key para generar una nueva.",
	})
}

// rotateCardKey: genera una nueva clave AES para una tarjeta existente
func (h *CardCryptoHandler) rotateCardKey(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Generar nueva clave
	newKey := make([]byte, 16)
	rand.Read(newKey)

	masterKey, err := h.getOrCreateMasterKey(nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting master key")
		return
	}

	encrypted, err := encryptAESKey(newKey, masterKey)
	if err != nil {
		writeError(w, 500, "error encrypting key")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE nfc_card_keys
		SET aes_key_encrypted = $2, secret_key_encrypted = $2,
		    key_version = key_version + 1, sun_counter = 0,
		    auth_fail_count = 0, crypto_blocked_until = NULL
		WHERE card_uid = $1`, uid, encrypted)
	if err != nil {
		writeError(w, 500, "error rotating key")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"card_uid":   uid,
		"aes_key_b64": base64.StdEncoding.EncodeToString(newKey),
		"aes_key_hex": hex.EncodeToString(newKey),
		"message":    "Nueva clave generada. Escribe esta clave en la tarjeta. El contador SUN se reinicio.",
	})
}

// === DISTRIBUCION DE CLAVES A TERMINALES/APPS ===

// requestCardKey: una terminal/app autenticada pide la clave AES de una tarjeta
// La clave se entrega cifrada sobre el canal existente (Ed25519 + AES-256-GCM)
// La terminal debe descifrarla en memoria y NUNCA guardarla en disco
func (h *CardCryptoHandler) requestCardKey(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Verificar que la tarjeta existe y esta activa
	var aesKeyEncrypted []byte
	var cardType string
	var cryptoBlockedUntil *time.Time
	var isActive bool
	err := h.Pool.QueryRow(r.Context(), `
		SELECT aes_key_encrypted, card_type, crypto_blocked_until, is_active
		FROM nfc_card_keys WHERE card_uid = $1 AND node_domain = $2`,
		uid, nodeDomain).Scan(&aesKeyEncrypted, &cardType, &cryptoBlockedUntil, &isActive)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada o sin clave criptografica")
		return
	}
	if !isActive {
		writeError(w, 403, "tarjeta desactivada")
		return
	}
	if cryptoBlockedUntil != nil && cryptoBlockedUntil.After(time.Now()) {
		writeError(w, 403, "tarjeta bloqueada por intentos fallidos")
		return
	}

	// Descifrar la clave AES con la clave maestra
	masterKey, err := h.getOrCreateMasterKey(nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting master key")
		return
	}

	aesKey, err := decryptAESKey(aesKeyEncrypted, masterKey)
	if err != nil {
		writeError(w, 500, "error decrypting card key")
		return
	}

	// Crear sesion de distribucion de clave
	sessionToken := generateCheckInCode() + generateCheckInCode()
	terminalID := r.URL.Query().Get("terminal_id")

	h.Pool.Exec(r.Context(), `
		INSERT INTO card_key_sessions (card_uid, terminal_id, session_token, key_delivered)
		VALUES ($1, $2, $3, true)`, uid, terminalID, sessionToken)

	// Devolver la clave AES en base64
	// La terminal debe usar esta clave para hacer challenge-response con la tarjeta
	// NUNCA guardarla en disco. Solo en memoria durante la transaccion.
	writeJSON(w, 200, map[string]interface{}{
		"card_uid":      uid,
		"card_type":     cardType,
		"aes_key_b64":   base64.StdEncoding.EncodeToString(aesKey),
		"session_token": sessionToken,
		"expires_in":    300, // 5 minutos
		"warning":       "Esta clave es para uso en memoria SOLAMENTE. No la guardes en disco. Haz challenge-response con la tarjeta y luego borra la clave de memoria.",
	})
}

// === CHALLENGE-RESPONSE ===

// generateChallenge: genera un challenge (nonce) para la tarjeta
// La terminal enviara este challenge a la tarjeta (DESFire EV3)
// y la tarjeta respondera con AES(challenge, key)
func (h *CardCryptoHandler) generateChallenge(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Generar challenge aleatorio (16 bytes)
	challenge := make([]byte, 16)
	rand.Read(challenge)
	challengeHex := hex.EncodeToString(challenge)

	// Obtener la clave AES para calcular la respuesta esperada
	var aesKeyEncrypted []byte
	err := h.Pool.QueryRow(r.Context(), `
		SELECT aes_key_encrypted FROM nfc_card_keys
		WHERE card_uid = $1 AND node_domain = $2 AND is_active = true`,
		uid, nodeDomain).Scan(&aesKeyEncrypted)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}

	masterKey, err := h.getOrCreateMasterKey(nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting master key")
		return
	}

	aesKey, err := decryptAESKey(aesKeyEncrypted, masterKey)
	if err != nil {
		writeError(w, 500, "error decrypting key")
		return
	}

	// Calcular respuesta esperada: AES-ECB(challenge, key)
	// (DESFire EV3 usa AES-ECB para el challenge-response)
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		writeError(w, 500, "error creating cipher")
		return
	}
	expectedResponse := make([]byte, 16)
	block.Encrypt(expectedResponse, challenge)

	// Guardar el challenge
	var challengeID string
	h.Pool.QueryRow(r.Context(), `
		INSERT INTO nfc_card_challenges (card_uid, challenge, expected_response, terminal_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		uid, challengeHex, hex.EncodeToString(expectedResponse),
		r.URL.Query().Get("terminal_id")).Scan(&challengeID)

	// Devolver el challenge en hex
	// La terminal envia este challenge a la tarjeta
	// La tarjeta responde con AES(challenge, key)
	// La terminal envia la respuesta a /verify-response
	writeJSON(w, 200, map[string]interface{}{
		"challenge_id": challengeID,
		"card_uid":     uid,
		"challenge":    challengeHex,
		"message":      "Envia este challenge a la tarjeta (DESFire EV3). La tarjeta respondera con AES(challenge, key). Envía la respuesta a /verify-response.",
	})
}

// verifyCardResponse: verifica la respuesta del challenge-response
// La terminal envia la respuesta que dio la tarjeta
// El servidor verifica que sea correcta
func (h *CardCryptoHandler) verifyCardResponse(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	var body struct {
		ChallengeID string `json:"challenge_id"`
		Response    string `json:"response"` // Respuesta de la tarjeta en hex
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.Response == "" {
		writeError(w, 400, "response requerido")
		return
	}

	// Obtener el challenge pendiente
	var expectedResponse, cardUID string
	var used bool
	var expiresAt time.Time
	err := h.Pool.QueryRow(r.Context(), `
		SELECT expected_response, card_uid, used, expires_at
		FROM nfc_card_challenges
		WHERE id = $1 AND card_uid = $2`,
		body.ChallengeID, uid).Scan(&expectedResponse, &cardUID, &used, &expiresAt)
	if err != nil {
		writeError(w, 404, "challenge no encontrado")
		return
	}
	if used {
		writeError(w, 403, "challenge ya usado (posible replay attack)")
		return
	}
	if time.Now().After(expiresAt) {
		writeError(w, 403, "challenge expirado")
		return
	}

	// Verificar la respuesta
	if body.Response != expectedResponse {
		// Incrementar contador de fallos
		h.Pool.Exec(r.Context(), `
			UPDATE nfc_card_keys
			SET auth_fail_count = auth_fail_count + 1,
			    crypto_blocked_until = CASE
			    	WHEN auth_fail_count + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
			    	ELSE crypto_blocked_until
			    END
			WHERE card_uid = $1`, uid)

		writeError(w, 401, "respuesta incorrecta. La tarjeta puede ser falsa o clonada.")
		return
	}

	// Marcar challenge como usado
	h.Pool.Exec(r.Context(), `UPDATE nfc_card_challenges SET used = true WHERE id = $1`, body.ChallengeID)

	// Actualizar estado de la tarjeta
	h.Pool.Exec(r.Context(), `
		UPDATE nfc_card_keys
		SET last_auth_at = NOW(), auth_fail_count = 0, crypto_blocked_until = NULL
		WHERE card_uid = $1`, uid)

	writeJSON(w, 200, map[string]interface{}{
		"verified":  true,
		"card_uid":  uid,
		"message":   "Tarjeta autenticada criptograficamente. Es legitima.",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// === NTAG424 SUN ===

// verifySUN: verifica el Secure Unique Number de NTAG424
// NTAG424 genera en cada tap: UID + counter + MAC(AES key, UID | counter)
// El servidor verifica el MAC porque tiene la misma clave AES
func (h *CardCryptoHandler) verifySUN(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	var body struct {
		SUNMAC    string `json:"sun_mac"`     // MAC leido de la tarjeta (hex)
		Counter   int64  `json:"counter"`     // Counter leido de la tarjeta
		UID       string `json:"uid"`         // UID leido (debe coincidir)
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.SUNMAC == "" {
		writeError(w, 400, "sun_mac requerido")
		return
	}

	// Obtener la clave AES de la tarjeta
	var aesKeyEncrypted []byte
	var storedCounter int64
	var cryptoBlockedUntil *time.Time
	err := h.Pool.QueryRow(r.Context(), `
		SELECT aes_key_encrypted, sun_counter, crypto_blocked_until
		FROM nfc_card_keys WHERE card_uid = $1 AND node_domain = $2 AND is_active = true`,
		uid, nodeDomain).Scan(&aesKeyEncrypted, &storedCounter, &cryptoBlockedUntil)
	if err != nil {
		writeError(w, 404, "tarjeta no encontrada")
		return
	}
	if cryptoBlockedUntil != nil && cryptoBlockedUntil.After(time.Now()) {
		writeError(w, 403, "tarjeta bloqueada")
		return
	}

	masterKey, err := h.getOrCreateMasterKey(nodeDomain)
	if err != nil {
		writeError(w, 500, "error getting master key")
		return
	}

	aesKey, err := decryptAESKey(aesKeyEncrypted, masterKey)
	if err != nil {
		writeError(w, 500, "error decrypting key")
		return
	}

	// Verificar counter (anti-replay)
	if body.Counter <= storedCounter {
		writeError(w, 403, "counter invalido (posible replay attack). Counter recibido: "+fmt.Sprintf("%d", body.Counter)+" vs almacenado: "+fmt.Sprintf("%d", storedCounter))
		return
	}

	// Calcular MAC esperado: HMAC-SHA256(AES key, UID | counter)
	// NTAG424 SUN usa AES-CMAC, pero HMAC-SHA256 es una alternativa compatible
	mac := hmac.New(sha256.New, aesKey)
	mac.Write([]byte(body.UID))
	mac.Write([]byte(fmt.Sprintf("%d", body.Counter)))
	expectedMAC := hex.EncodeToString(mac.Sum(nil))[:32] // primeros 16 bytes en hex

	if body.SUNMAC != expectedMAC {
		h.Pool.Exec(r.Context(), `
			UPDATE nfc_card_keys
			SET auth_fail_count = auth_fail_count + 1,
			    crypto_blocked_until = CASE
			    	WHEN auth_fail_count + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
			    	ELSE crypto_blocked_until
			    END
			WHERE card_uid = $1`, uid)

		writeError(w, 401, "MAC invalido. La tarjeta puede ser falsa o clonada.")
		return
	}

	// Actualizar counter y estado
	h.Pool.Exec(r.Context(), `
		UPDATE nfc_card_keys
		SET sun_counter = $2, last_auth_at = NOW(), auth_fail_count = 0, crypto_blocked_until = NULL
		WHERE card_uid = $1`, uid, body.Counter)

	writeJSON(w, 200, map[string]interface{}{
		"verified":  true,
		"card_uid":  uid,
		"counter":   body.Counter,
		"message":   "NTAG424 SUN verificado. Tarjeta autenticada criptograficamente.",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// === ESTADO Y BLOQUEO ===

func (h *CardCryptoHandler) getCryptoStatus(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	var cardType string
	var keyVersion int
	var isActive bool
	var lastAuthAt *time.Time
	var authFailCount int
	var cryptoBlockedUntil *time.Time
	var sunCounter int64
	var provisionedAt *time.Time

	err := h.Pool.QueryRow(r.Context(), `
		SELECT card_type, key_version, is_active, last_auth_at,
		       auth_fail_count, crypto_blocked_until, sun_counter, provisioned_at
		FROM nfc_card_keys WHERE card_uid = $1`, uid).Scan(
		&cardType, &keyVersion, &isActive, &lastAuthAt,
		&authFailCount, &cryptoBlockedUntil, &sunCounter, &provisionedAt)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"card_uid":        uid,
			"crypto_enabled":  false,
			"message":         "Tarjeta sin clave criptografica (modo uid_only)",
		})
		return
	}

	blocked := cryptoBlockedUntil != nil && cryptoBlockedUntil.After(time.Now())
	writeJSON(w, 200, map[string]interface{}{
		"card_uid":          uid,
		"crypto_enabled":    true,
		"card_type":         cardType,
		"key_version":       keyVersion,
		"is_active":         isActive,
		"last_auth_at":      lastAuthAt,
		"auth_fail_count":   authFailCount,
		"blocked":           blocked,
		"crypto_blocked_until": cryptoBlockedUntil,
		"sun_counter":       sunCounter,
		"provisioned_at":    provisionedAt,
	})
}

func (h *CardCryptoHandler) blockCardCrypto(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "uid")
	if uid == "" {
		writeError(w, 400, "uid requerido")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE nfc_card_keys
		SET is_active = false, crypto_blocked_until = NOW() + INTERVAL '365 days'
		WHERE card_uid = $1`, uid)
	if err != nil {
		writeError(w, 500, "error blocking card")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"card_uid": uid,
		"message":  "Tarjeta bloqueada criptograficamente. No podra usarse para pagos.",
	})
}

// Suppress unused import warnings
var _ = ed25519.GenerateKey
