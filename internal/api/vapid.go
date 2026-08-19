package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"fmt"
)

// generateVapidKeys genera un par de claves ECDSA P-256 para VAPID (WebPush)
// Retorna la public key y private key en formato Base64URL (sin padding)
// compatible con el estandar Web Push.
func generateVapidKeys() (publicKeyB64, privateKeyB64 string, err error) {
	// Generar par de claves ECDSA P-256
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", "", fmt.Errorf("generating ECDSA key: %w", err)
	}

	// Public key: punto no comprimido (0x04 + X + Y = 65 bytes)
	pubX := privateKey.PublicKey.X.Bytes()
	pubY := privateKey.PublicKey.Y.Bytes()

	// Rellenar a 32 bytes cada coordenada
	pubX = padTo32(pubX)
	pubY = padTo32(pubY)

	uncompressed := make([]byte, 65)
	uncompressed[0] = 0x04
	copy(uncompressed[1:33], pubX)
	copy(uncompressed[33:65], pubY)

	publicKeyB64 = base64.RawURLEncoding.EncodeToString(uncompressed)

	// Private key: el scalar D en 32 bytes
	privD := privateKey.D.Bytes()
	privD = padTo32(privD)
	privateKeyB64 = base64.RawURLEncoding.EncodeToString(privD)

	_ = x509.MarshalECPrivateKey // referencia para evitar import no usado

	return publicKeyB64, privateKeyB64, nil
}

// padTo32 rellena un byte slice con ceros al inicio para que tenga 32 bytes
func padTo32(b []byte) []byte {
	if len(b) >= 32 {
		return b[:32]
	}
	result := make([]byte, 32)
	copy(result[32-len(b):], b)
	return result
}
