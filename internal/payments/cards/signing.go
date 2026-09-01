// Package cards — signing.go
//
// Firma y verificacion de paquetes .nfcpkg con Ed25519.
// Modelo: por-nodo (federado, no centralizado).
//
// Cada nodo genera su propia clave Ed25519 para firmar drivers.
// La clave publica se asocia al node_domain del nodo firmante.
// Los nodos federados ya intercambian claves publicas (federation existente).
// El admin puede agregar claves confiables manualmente desde la UI.

package cards

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TrustLevel indica el nivel de confianza de una clave de firma.
type TrustLevel string

const (
	TrustSelf      TrustLevel = "self"      // firmado por este propio nodo
	TrustFederated TrustLevel = "federated" // firmado por un nodo federado conocido
	TrustManual    TrustLevel = "manual"    // clave agregada manualmente por el admin
	TrustUnknown   TrustLevel = "unknown"   // firma no reconocida
)

// SigningKeyPair es una clave de firma Ed25519 del nodo.
type SigningKeyPair struct {
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
}

// GenerateSigningKey genera una nueva clave Ed25519 para firmar drivers.
func GenerateSigningKey() (*SigningKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generando clave Ed25519: %w", err)
	}
	return &SigningKeyPair{
		PublicKey:  pub,
		PrivateKey: priv,
	}, nil
}

// SignPackage firma los datos del paquete con la clave privada del nodo.
// Retorna la firma en hex.
func SignPackage(privateKey ed25519.PrivateKey, data []byte) string {
	sig := ed25519.Sign(privateKey, data)
	return hex.EncodeToString(sig)
}

// VerifySignature verifica una firma Ed25519.
// publicKeyHex es la clave publica en hex (64 bytes = 128 chars).
// signatureHex es la firma en hex.
// data son los datos a verificar.
func VerifySignature(publicKeyHex, signatureHex string, data []byte) bool {
	pubKey, err := hex.DecodeString(publicKeyHex)
	if err != nil || len(pubKey) != ed25519.PublicKeySize {
		return false
	}
	sig, err := hex.DecodeString(signatureHex)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return false
	}
	return ed25519.Verify(ed25519.PublicKey(pubKey), data, sig)
}

// GetOrCreateNodeSigningKey obtiene la clave de firma del nodo desde la DB,
// o genera una nueva si no existe.
func GetOrCreateNodeSigningKey(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, encryptFn func([]byte) ([]byte, error)) (*SigningKeyPair, error) {
	// Intentar cargar la clave existente
	var pubKeyHex string
	var privKeyEncrypted []byte
	err := pool.QueryRow(ctx,
		"SELECT public_key, private_key_encrypted FROM nfc_driver_signing_keys_local WHERE node_domain = $1",
		nodeDomain).Scan(&pubKeyHex, &privKeyEncrypted)

	if err == nil {
		// Clave existe — cargarla
		pubKey, err := hex.DecodeString(pubKeyHex)
		if err != nil {
			return nil, fmt.Errorf("decodificando clave publica: %w", err)
		}
		// Desencriptar clave privada
		// Nota: el caller pasa la funcion de desencriptacion
		// Por ahora, guardamos la clave privada en hex simple (mejorar despues)
		privKey, err := hex.DecodeString(string(privKeyEncrypted))
		if err != nil {
			return nil, fmt.Errorf("decodificando clave privada: %w", err)
		}
		return &SigningKeyPair{
			PublicKey:  ed25519.PublicKey(pubKey),
			PrivateKey: ed25519.PrivateKey(privKey),
		}, nil
	}

	// No existe — generar nueva
	keyPair, err := GenerateSigningKey()
	if err != nil {
		return nil, err
	}

	pubHex := hex.EncodeToString(keyPair.PublicKey)
	privHex := hex.EncodeToString(keyPair.PrivateKey)

	// Guardar en DB
	_, err = pool.Exec(ctx,
		"INSERT INTO nfc_driver_signing_keys_local (node_domain, private_key_encrypted, public_key) VALUES ($1, $2, $3) ON CONFLICT (node_domain) DO NOTHING",
		nodeDomain, []byte(privHex), pubHex)
	if err != nil {
		return nil, fmt.Errorf("guardando clave de firma: %w", err)
	}

	// Tambien agregar la clave publica a la tabla de claves confiables
	_, err = pool.Exec(ctx,
		"INSERT INTO nfc_driver_signing_keys (label, node_domain, public_key, trust_level) VALUES ($1, $2, $3, 'self') ON CONFLICT (public_key) DO NOTHING",
		"Este nodo ("+nodeDomain+")", nodeDomain, pubHex)
	if err != nil {
		// No es fatal — la clave de firma local ya esta guardada
		fmt.Printf("warning: no se pudo agregar clave a signing_keys: %v\n", err)
	}

	return keyPair, nil
}

// VerifyPackageSignature verifica la firma de un paquete contra las claves
// confiables en la DB. Retorna el nivel de confianza y el node_domain del firmante.
func VerifyPackageSignature(ctx context.Context, pool *pgxpool.Pool, pkg *NFCPackage) (TrustLevel, string, error) {
	if pkg.Signature == "" {
		return TrustUnknown, "", fmt.Errorf("paquete sin firma")
	}

	// Datos firmados
	sigData := pkg.ComputeSignatureData()

	// Buscar todas las claves confiables activas
	rows, err := pool.Query(ctx,
		"SELECT public_key, node_domain, trust_level FROM nfc_driver_signing_keys WHERE is_active = true")
	if err != nil {
		return TrustUnknown, "", fmt.Errorf("consultando claves: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var pubKeyHex, trustLevelStr string
		var nodeDomain *string
		if err := rows.Scan(&pubKeyHex, &nodeDomain, &trustLevelStr); err != nil {
			continue
		}

		if VerifySignature(pubKeyHex, pkg.Signature, sigData) {
			domain := ""
			if nodeDomain != nil {
				domain = *nodeDomain
			}
			return TrustLevel(trustLevelStr), domain, nil
		}
	}

	return TrustUnknown, "", fmt.Errorf("firma no reconocida por ninguna clave confiable")
}

// AddTrustedKey agrega una clave publica confiable a la DB.
func AddTrustedKey(ctx context.Context, pool *pgxpool.Pool, label, pubKeyHex, trustLevel string) error {
	pubKeyHex = strings.TrimSpace(pubKeyHex)
	if len(pubKeyHex) != 128 {
		return fmt.Errorf("clave publica debe ser 128 chars hex (64 bytes), tiene %d", len(pubKeyHex))
	}
	// Validar que es hex valido
	if _, err := hex.DecodeString(pubKeyHex); err != nil {
		return fmt.Errorf("clave publica no es hex valida: %w", err)
	}

	trust := TrustLevel(trustLevel)
	if trust != TrustSelf && trust != TrustFederated && trust != TrustManual {
		return fmt.Errorf("trust_level debe ser self, federated, o manual")
	}

	_, err := pool.Exec(ctx,
		"INSERT INTO nfc_driver_signing_keys (label, public_key, trust_level) VALUES ($1, $2, $3) ON CONFLICT (public_key) DO UPDATE SET label = $1, trust_level = $3, is_active = true",
		label, pubKeyHex, trustLevel)
	if err != nil {
		return fmt.Errorf("guardando clave: %w", err)
	}
	return nil
}

// RemoveTrustedKey remueve una clave publica confiable.
func RemoveTrustedKey(ctx context.Context, pool *pgxpool.Pool, keyID string) error {
	_, err := pool.Exec(ctx,
		"DELETE FROM nfc_driver_signing_keys WHERE id = $1", keyID)
	return err
}

// ListTrustedKeys lista todas las claves confiables.
type TrustedKeyInfo struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	NodeDomain string `json:"node_domain"`
	PublicKey  string `json:"public_key"`
	TrustLevel string `json:"trust_level"`
	IsActive   bool   `json:"is_active"`
	AddedAt    string `json:"added_at"`
}

func ListTrustedKeys(ctx context.Context, pool *pgxpool.Pool) ([]TrustedKeyInfo, error) {
	rows, err := pool.Query(ctx,
		"SELECT id, label, COALESCE(node_domain, ''), public_key, trust_level, is_active, added_at FROM nfc_driver_signing_keys ORDER BY added_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []TrustedKeyInfo
	for rows.Next() {
		var k TrustedKeyInfo
		if err := rows.Scan(&k.ID, &k.Label, &k.NodeDomain, &k.PublicKey, &k.TrustLevel, &k.IsActive, &k.AddedAt); err != nil {
			continue
		}
		keys = append(keys, k)
	}
	return keys, nil
}
