package api

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"
	"net/url"
	"strings"
	"time"
)

// ===== VAPID JWT Signing (ES256) =====
//
// VAPID requiere un JWT firmado con ES256 (ECDSA P-256 + SHA-256)
// El JWT contiene:
//   - aud: origin del push service endpoint
//   - exp: timestamp de expiracion (24h)
//   - sub: mailto o URL de contacto

// buildVapidJWT real construye un JWT ES256 valido para VAPID
func buildVapidJWTReal(privateKeyB64, subject, endpoint string) (string, error) {
	// Decodificar la private key (32 bytes scalar)
	privDBytes, err := base64.RawURLEncoding.DecodeString(privateKeyB64)
	if err != nil {
		return "", fmt.Errorf("decoding private key: %w", err)
	}

	// Reconstruir la clave ECDSA desde el scalar D
	curve := elliptic.P256()
	privD := new(big.Int).SetBytes(privDBytes)
	// Punto generador G de P-256 (NIST)
	gx := new(big.Int).SetBytes([]byte{
		0x6b, 0x17, 0xd1, 0xf2, 0xe1, 0x2c, 0x42, 0x47,
		0xf8, 0xbc, 0xe6, 0xe5, 0x63, 0xa4, 0x40, 0xf2,
		0x77, 0x03, 0x7d, 0x81, 0x2d, 0xeb, 0x33, 0xa0,
		0xf4, 0xa1, 0x39, 0x45, 0xd8, 0x98, 0xc2, 0x96,
	})
	gy := new(big.Int).SetBytes([]byte{
		0x4f, 0xe3, 0x42, 0xe2, 0xfe, 0x1a, 0x7f, 0x9b,
		0x8e, 0xe7, 0xeb, 0x4a, 0x7c, 0x0f, 0x9e, 0x16,
		0x2b, 0xce, 0x33, 0x57, 0x6b, 0x31, 0x5e, 0xce,
		0xcb, 0xb6, 0x40, 0x68, 0x37, 0xbf, 0x51, 0xf5,
	})
	pubX, pubY := curve.ScalarMult(gx, gy, privDBytes)
	privKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{Curve: curve, X: pubX, Y: pubY},
		D:         privD,
	}

	// Extraer el origin del endpoint para el claim "aud"
	endpointURL, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parsing endpoint: %w", err)
	}
	aud := endpointURL.Scheme + "://" + endpointURL.Host

	// Construir el payload del JWT
	now := time.Now()
	claims := map[string]interface{}{
		"aud": aud,
		"exp": now.Add(24 * time.Hour).Unix(),
		"sub": subject,
	}
	claimsJSON, _ := json.Marshal(claims)

	// Header del JWT (ES256)
	header := `{"typ":"JWT","alg":"ES256"}`

	// Base64URL encode header y payload
	headerB64 := base64.RawURLEncoding.EncodeToString([]byte(header))
	payloadB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	// Mensaje a firmar
	signingInput := headerB64 + "." + payloadB64

	// Firmar con ECDSA P-256
	hash := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, privKey, hash[:])
	if err != nil {
		return "", fmt.Errorf("signing JWT: %w", err)
	}

	// ECDSA signature a bytes (r || s, cada uno 32 bytes = 64 total)
	sig := make([]byte, 64)
	rBytes := r.Bytes()
	sBytes := s.Bytes()
	copy(sig[32-len(rBytes):32], rBytes)
	copy(sig[64-len(sBytes):64], sBytes)

	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	return signingInput + "." + sigB64, nil
}

// ===== WebPush Payload Encryption (aes128gcm) =====
//
// RFC 8291: encripta el payload usando ECDH (P-256) entre el server
// y la subscription del navegador, luego AES-128-GCM.

// encryptWebPushPayload encripta el payload segun RFC 8291 (aes128gcm)
func encryptWebPushPayload(payload string, subscriptionP256dh, subscriptionAuth string, vapidPrivateKeyB64 string) ([]byte, error) {
	_ = vapidPrivateKeyB64 // VAPID key se usa para JWT, no para encriptar payload (RFC 8291 usa clave efimera)
	// Decodificar las claves del subscription (Base64URL)
	userPublicKeyBytes, err := base64.RawURLEncoding.DecodeString(subscriptionP256dh)
	if err != nil {
		return nil, fmt.Errorf("decoding p256dh: %w", err)
	}
	authSecret, err := base64.RawURLEncoding.DecodeString(subscriptionAuth)
	if err != nil {
		return nil, fmt.Errorf("decoding auth: %w", err)
	}

	// Parsear la public key del usuario (punto no comprimido: 0x04 || X || Y)
	if len(userPublicKeyBytes) != 65 || userPublicKeyBytes[0] != 0x04 {
		return nil, fmt.Errorf("invalid user public key format")
	}
	curve := elliptic.P256()
	userPubX := new(big.Int).SetBytes(userPublicKeyBytes[1:33])
	userPubY := new(big.Int).SetBytes(userPublicKeyBytes[33:65])

	// Generar par de claves efimero del servidor
	ephemeralPriv, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating ephemeral key: %w", err)
	}

	// ECDH: calcular el shared secret
	sharedX, _ := curve.ScalarMult(userPubX, userPubY, ephemeralPriv.D.Bytes())
	sharedSecret := sharedX.Bytes()

	// Serializar la public key efimera (punto no comprimido)
	ephPubX := ephemeralPriv.PublicKey.X.Bytes()
	ephPubY := ephemeralPriv.PublicKey.Y.Bytes()
	ephPubX = padTo32(ephPubX)
	ephPubY = padTo32(ephPubY)
	asymmetricKey := make([]byte, 65)
	asymmetricKey[0] = 0x04
	copy(asymmetricKey[1:33], ephPubX)
	copy(asymmetricKey[33:65], ephPubY)

	// Derivar la clave de encriptacion con HKDF
	// Info = "WebPush: info" || 0x00 || userPublicKey || aserverPublicKey
	info := bytes.NewBuffer(nil)
	info.WriteString("WebPush: info\x00")
	info.Write(userPublicKeyBytes)
	info.Write(asymmetricKey)

	// IKM = HKDF(authSecret, sharedSecret, info, 32)
	ikm := hkdfSHA256(authSecret, sharedSecret, info.Bytes(), 32)

	// Salt aleatorio (16 bytes)
	salt := make([]byte, 16)
	rand.Read(salt)

	// Content encryption key (16 bytes) y nonce (12 bytes)
	// CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\x00", 16)
	cekInfo := []byte("Content-Encoding: aes128gcm\x00")
	cek := hkdfSHA256(salt, ikm, cekInfo, 16)

	// Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\x00", 12)
	nonceInfo := []byte("Content-Encoding: nonce\x00")
	nonce := hkdfSHA256(salt, ikm, nonceInfo, 12)

	// Encriptar con AES-128-GCM
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	// Padding del payload (RFC 8291): payload || 0x02 || padding
	paddedPayload := append([]byte(payload), 0x02)

	ciphertext := aesgcm.Seal(nil, nonce, paddedPayload, nil)

	// Construir el header binario (RFC 8188)
	// Header: salt (16) || recordSize (4) || keyIdLen (1) || keyId (65)
	recordSize := uint32(4096)
	header := make([]byte, 21)
	copy(header[0:16], salt)
	binary.BigEndian.PutUint32(header[16:20], recordSize)
	header[20] = 65 // keyId length

	// Resultado final: header || keyId (asymmetricKey) || ciphertext
	result := bytes.NewBuffer(nil)
	result.Write(header)
	result.Write(asymmetricKey)
	result.Write(ciphertext)

	return result.Bytes(), nil
}

// hkdfSHA256 implementa HKDF con SHA-256
func hkdfSHA256(salt, ikm, info []byte, length int) []byte {
	if len(salt) == 0 {
		salt = make([]byte, 32)
	}

	// Extract
	h := hmac.New(sha256.New, salt)
	h.Write(ikm)
	prk := h.Sum(nil)

	// Expand
	var t []byte
	var okm []byte
	for i := 1; len(okm) < length; i++ {
		h := hmac.New(sha256.New, prk)
		h.Write(t)
		h.Write(info)
		h.Write([]byte{byte(i)})
		t = h.Sum(nil)
		okm = append(okm, t...)
	}

	return okm[:length]
}

// secureCompare compara dos byte slices en tiempo constante
func secureCompare(a, b []byte) bool {
	return subtle.ConstantTimeCompare(a, b) == 1
}

// suppress unused warning
var _ = secureCompare
var _ = strings.TrimPrefix
