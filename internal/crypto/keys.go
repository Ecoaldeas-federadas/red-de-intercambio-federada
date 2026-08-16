package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
)

type KeyManager struct{}

func NewKeyManager() *KeyManager {
	return &KeyManager{}
}

func (km *KeyManager) GenerateEd25519KeyPair() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	return ed25519.GenerateKey(rand.Reader)
}

func (km *KeyManager) Sign(privateKey ed25519.PrivateKey, data []byte) string {
	sig := ed25519.Sign(privateKey, data)
	return hex.EncodeToString(sig)
}

func (km *KeyManager) Verify(publicKey ed25519.PublicKey, data []byte, signatureHex string) bool {
	sig, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}
	return ed25519.Verify(publicKey, data, sig)
}

func (km *KeyManager) PublicKeyToHex(pub ed25519.PublicKey) string {
	return hex.EncodeToString(pub)
}

func (km *KeyManager) PrivateKeyToHex(priv ed25519.PrivateKey) string {
	return hex.EncodeToString(priv)
}

func (km *KeyManager) PublicKeyFromHex(hexStr string) (ed25519.PublicKey, error) {
	data, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("decoding public key: %w", err)
	}
	if len(data) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key size: %d", len(data))
	}
	return ed25519.PublicKey(data), nil
}

func (km *KeyManager) PrivateKeyFromHex(hexStr string) (ed25519.PrivateKey, error) {
	data, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("decoding private key: %w", err)
	}
	if len(data) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size: %d", len(data))
	}
	return ed25519.PrivateKey(data), nil
}

func (km *KeyManager) EncryptPrivateKey(privKey ed25519.PrivateKey, passphrase string) (ciphertext, salt []byte, err error) {
	salt = make([]byte, 32)
	if _, err = io.ReadFull(rand.Reader, salt); err != nil {
		return nil, nil, fmt.Errorf("generating salt: %w", err)
	}

	key := deriveKey(passphrase, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generating nonce: %w", err)
	}

	ciphertext = gcm.Seal(nonce, nonce, privKey, salt)
	return ciphertext, salt, nil
}

func (km *KeyManager) DecryptPrivateKey(ciphertext, salt []byte, passphrase string) (ed25519.PrivateKey, error) {
	key := deriveKey(passphrase, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBody := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plainKey, err := gcm.Open(nil, nonce, ciphertextBody, salt)
	if err != nil {
		return nil, fmt.Errorf("decrypting private key: %w", err)
	}

	if len(plainKey) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid decrypted key size: %d", len(plainKey))
	}

	return ed25519.PrivateKey(plainKey), nil
}

func deriveKey(passphrase string, salt []byte) []byte {
	h := sha256.New()
	h.Write([]byte(passphrase))
	h.Write(salt)
	return h.Sum(nil)
}
