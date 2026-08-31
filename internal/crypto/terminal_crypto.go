package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"

	"golang.org/x/crypto/curve25519"
)

type TerminalKeyPair struct {
	PrivateKey ed25519.PrivateKey
	PublicKey  ed25519.PublicKey
}

func GenerateTerminalKeyPair() (*TerminalKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating terminal keypair: %w", err)
	}
	return &TerminalKeyPair{PrivateKey: priv, PublicKey: pub}, nil
}

func GenerateServerKeyPair() (*TerminalKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating server keypair: %w", err)
	}
	return &TerminalKeyPair{PrivateKey: priv, PublicKey: pub}, nil
}

func GenerateEphemeralKeyPair() (*TerminalKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating ephemeral keypair: %w", err)
	}
	return &TerminalKeyPair{PrivateKey: priv, PublicKey: pub}, nil
}

type EphemeralHandshake struct {
	EphemeralPublicKey string `json:"ephemeral_public_key"`
	IdentitySignature  string `json:"identity_signature"`
	Nonce              string `json:"nonce"`
}

type EphemeralMessage struct {
	Handshake  EphemeralHandshake `json:"handshake"`
	Nonce      string             `json:"nonce"`
	Ciphertext string             `json:"ciphertext"`
	Signature  string             `json:"signature"`
}

func PerformEphemeralECDH(localEphemeralPriv ed25519.PrivateKey, peerEphemeralPub ed25519.PublicKey) ([]byte, error) {
	return DeriveSharedKey(localEphemeralPriv, peerEphemeralPub)
}

func SignEphemeralHandshake(identityPriv ed25519.PrivateKey, ephemeralPub ed25519.PublicKey, nonce string) ([]byte, error) {
	msg := append(ephemeralPub, []byte(nonce)...)
	return SignMessage(identityPriv, msg)
}

func VerifyEphemeralHandshake(identityPub ed25519.PublicKey, ephemeralPub ed25519.PublicKey, nonce string, signature []byte) bool {
	msg := append(ephemeralPub, []byte(nonce)...)
	return VerifySignature(identityPub, msg, signature)
}

func PublicKeyToHex(pub ed25519.PublicKey) string {
	return hex.EncodeToString(pub)
}

func PrivateKeyToHex(priv ed25519.PrivateKey) string {
	return hex.EncodeToString(priv)
}

func PublicKeyFromHex(hexStr string) (ed25519.PublicKey, error) {
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("decoding public key hex: %w", err)
	}
	return ed25519.PublicKey(b), nil
}

func PrivateKeyFromHex(hexStr string) (ed25519.PrivateKey, error) {
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("decoding private key hex: %w", err)
	}
	return ed25519.PrivateKey(b), nil
}

func SignMessage(privateKey ed25519.PrivateKey, message []byte) ([]byte, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size: %d", len(privateKey))
	}
	return ed25519.Sign(privateKey, message), nil
}

func VerifySignature(publicKey ed25519.PublicKey, message, signature []byte) bool {
	if len(publicKey) != ed25519.PublicKeySize {
		return false
	}
	return ed25519.Verify(publicKey, message, signature)
}

func DeriveSharedKey(privateKey ed25519.PrivateKey, peerPublicKey ed25519.PublicKey) ([]byte, error) {
	privCurve, err := ed25519PrivateKeyToCurve25519(privateKey)
	if err != nil {
		return nil, fmt.Errorf("converting private key: %w", err)
	}

	pubCurve, err := ed25519PublicKeyToCurve25519(peerPublicKey)
	if err != nil {
		return nil, fmt.Errorf("converting public key: %w", err)
	}

	shared, err := curve25519.X25519(privCurve, pubCurve)
	if err != nil {
		return nil, fmt.Errorf("deriving shared key: %w", err)
	}

	key := sha256.Sum256(shared)
	return key[:], nil
}

func EncryptPayload(sharedKey, plaintext []byte) (nonce, ciphertext []byte, err error) {
	block, err := aes.NewCipher(sharedKey)
	if err != nil {
		return nil, nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generating nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

func DecryptPayload(sharedKey, nonce, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(sharedKey)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce size: %d, expected %d", len(nonce), gcm.NonceSize())
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypting payload: %w", err)
	}

	return plaintext, nil
}

type EncryptedMessage struct {
	Nonce      []byte `json:"nonce"`
	Ciphertext []byte `json:"ciphertext"`
	Signature  []byte `json:"signature"`
}

func EncodeTerminalPayload(sharedKey []byte, payload []byte, signingKey ed25519.PrivateKey) (*EncryptedMessage, error) {
	nonce, ciphertext, err := EncryptPayload(sharedKey, payload)
	if err != nil {
		return nil, fmt.Errorf("encrypting payload: %w", err)
	}

	sig, err := SignMessage(signingKey, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("signing payload: %w", err)
	}

	return &EncryptedMessage{
		Nonce:      nonce,
		Ciphertext: ciphertext,
		Signature:  sig,
	}, nil
}

func DecodeTerminalPayload(sharedKey []byte, msg *EncryptedMessage, verifyKey ed25519.PublicKey) ([]byte, error) {
	if !VerifySignature(verifyKey, msg.Ciphertext, msg.Signature) {
		return nil, fmt.Errorf("signature verification failed")
	}

	plaintext, err := DecryptPayload(sharedKey, msg.Nonce, msg.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("decrypting payload: %w", err)
	}

	return plaintext, nil
}

func ed25519PrivateKeyToCurve25519(priv ed25519.PrivateKey) ([]byte, error) {
	if len(priv) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid ed25519 private key size")
	}
	h := sha512.New()
	h.Write(priv.Seed())
	digest := h.Sum(nil)
	digest[0] &= 248
	digest[31] &= 127
	digest[31] |= 64
	return digest[:32], nil
}

// ed25519PublicKeyToCurve25519 convierte una clave pública Ed25519 a su
// equivalente en Curve25519 (X25519) usando el mapa birracional:
//
//	u = (1 + y) / (1 - y) mod p
//
// donde y es la coordenada y del punto Ed25519 (little-endian, 32 bytes)
// y p = 2^255 - 19 es el primo del campo de Curve25519.
//
// NOTA: SHA-512 NO es válido para claves públicas. Solo funciona para
// la clave privada (seed → scalar). Usar SHA-512 para la pública produce
// un X25519 público que NO corresponde al X25519 privado derivado del seed.
func ed25519PublicKeyToCurve25519(pub ed25519.PublicKey) ([]byte, error) {
	if len(pub) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid ed25519 public key size")
	}

	// El primo del campo de Curve25519: p = 2^255 - 19
	p, _ := new(big.Int).SetString("57896044618658097711785492504343953926634992332820282019728792003956564819949", 10)

	// La clave pública Ed25519 está en little-endian. El byte 31 contiene
	// el bit de signo en el bit más significativo. Enmascararlo para
	// obtener solo la coordenada y.
	yBytes := make([]byte, 32)
	copy(yBytes, pub)
	yBytes[31] &= 0x7f // mask sign bit

	// Convertir de little-endian a big.Int (big-endian)
	y := new(big.Int).SetBytes(reverseBytes(yBytes))
	y.Mod(y, p)

	// u = (1 + y) / (1 - y) mod p
	one := big.NewInt(1)
	num := new(big.Int).Add(one, y) // 1 + y
	num.Mod(num, p)

	den := new(big.Int).Sub(one, y) // 1 - y
	den.Mod(den, p)

	denInv := new(big.Int).ModInverse(den, p)
	if denInv == nil {
		return nil, fmt.Errorf("no modular inverse for public key (denominator is zero)")
	}

	u := new(big.Int).Mul(num, denInv)
	u.Mod(u, p)

	// Convertir de big.Int a little-endian 32 bytes
	uBytes := u.FillBytes(make([]byte, 32))
	return reverseBytes(uBytes), nil
}

// reverseBytes invierte el orden de los bytes (little-endian ↔ big-endian).
func reverseBytes(b []byte) []byte {
	r := make([]byte, len(b))
	for i := range b {
		r[i] = b[len(b)-1-i]
	}
	return r
}
