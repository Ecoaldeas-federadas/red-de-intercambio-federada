package crypto

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/fxamacker/cbor/v2"
	"github.com/google/uuid"
)

type PasskeyManager struct {
	RPName  string
	RPID    string
	Origins []string
}

func NewPasskeyManager(rpName, rpID string, origins []string) *PasskeyManager {
	return &PasskeyManager{
		RPName:  rpName,
		RPID:    rpID,
		Origins: origins,
	}
}

type RegistrationChallenge struct {
	Challenge              string                 `json:"challenge"`
	RP                     RPData                 `json:"rp"`
	User                   UserData               `json:"user"`
	PubKeyCredParams       []PubKeyCredParam      `json:"pubKeyCredParams"`
	Timeout                int                    `json:"timeout"`
	Attestation            string                 `json:"attestation"`
	AuthenticatorSelection AuthenticatorSelection `json:"authenticatorSelection"`
	ExcludeCredentials     []CredentialDescriptor `json:"excludeCredentials,omitempty"`
}

type RPData struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}

type UserData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
}

type PubKeyCredParam struct {
	Type string `json:"type"`
	Alg  int    `json:"alg"`
}

type AuthenticatorSelection struct {
	AuthenticatorAttachment string `json:"authenticatorAttachment,omitempty"`
	UserVerification        string `json:"userVerification"`
	RequireResidentKey      bool   `json:"requireResidentKey"`
	ResidentKey             string `json:"residentKey,omitempty"`
}

type CredentialDescriptor struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type RegistrationResponse struct {
	ID       string                           `json:"id"`
	RawID    string                           `json:"rawId"`
	Type     string                           `json:"type"`
	Response AuthenticatorAttestationResponse `json:"response"`
}

type AuthenticatorAttestationResponse struct {
	AttestationObject string `json:"attestationObject"`
	ClientDataJSON    string `json:"clientDataJSON"`
}

type LoginChallenge struct {
	Challenge        string                 `json:"challenge"`
	RPID             string                 `json:"rpId"`
	Timeout          int                    `json:"timeout"`
	UserVerification string                 `json:"userVerification"`
	AllowCredentials []CredentialDescriptor `json:"allowCredentials,omitempty"`
}

type LoginResponse struct {
	ID       string                         `json:"id"`
	RawID    string                         `json:"rawId"`
	Type     string                         `json:"type"`
	Response AuthenticatorAssertionResponse `json:"response"`
}

type AuthenticatorAssertionResponse struct {
	AuthenticatorData string `json:"authenticatorData"`
	ClientDataJSON    string `json:"clientDataJSON"`
	Signature         string `json:"signature"`
	UserHandle        string `json:"userHandle,omitempty"`
}

type ClientData struct {
	Type      string `json:"type"`
	Challenge string `json:"challenge"`
	Origin    string `json:"origin"`
}

type StoredPasskey struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	CredentialID []byte
	PublicKey    []byte
	SignCount    int64
	DeviceType   string
	Label        string
}

func (pm *PasskeyManager) GenerateChallenge() (string, error) {
	challenge := make([]byte, 32)
	_, err := rand.Read(challenge)
	if err != nil {
		return "", fmt.Errorf("generating challenge: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(challenge), nil
}

func (pm *PasskeyManager) BeginRegistration(userID uuid.UUID, username, displayName string, existingCredentialIDs [][]byte, rpID, rpName string) (*RegistrationChallenge, error) {
	challenge, err := pm.GenerateChallenge()
	if err != nil {
		return nil, err
	}

	if rpID == "" {
		rpID = pm.RPID
	}
	if rpName == "" {
		rpName = pm.RPName
	}

	userIDBytes := []byte(userID.String())

	excludeCreds := make([]CredentialDescriptor, 0, len(existingCredentialIDs))
	for _, credID := range existingCredentialIDs {
		excludeCreds = append(excludeCreds, CredentialDescriptor{
			Type: "public-key",
			ID:   base64.RawURLEncoding.EncodeToString(credID),
		})
	}

	return &RegistrationChallenge{
		Challenge: challenge,
		RP: RPData{
			Name: rpName,
			ID:   rpID,
		},
		User: UserData{
			ID:          base64.RawURLEncoding.EncodeToString(userIDBytes),
			Name:        username,
			DisplayName: displayName,
		},
		PubKeyCredParams: []PubKeyCredParam{
			{Type: "public-key", Alg: -7},
			{Type: "public-key", Alg: -257},
		},
		Timeout:     60000,
		Attestation: "none",
		AuthenticatorSelection: AuthenticatorSelection{
			UserVerification:   "preferred",
			RequireResidentKey: false,
		},
		ExcludeCredentials: excludeCreds,
	}, nil
}

func (pm *PasskeyManager) VerifyRegistration(response RegistrationResponse, expectedChallenge, expectedOrigin string) (*StoredPasskey, error) {
	clientDataBytes, err := base64.RawURLEncoding.DecodeString(response.Response.ClientDataJSON)
	if err != nil {
		return nil, fmt.Errorf("decoding clientDataJSON: %w", err)
	}

	var clientData ClientData
	if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
		return nil, fmt.Errorf("parsing clientDataJSON: %w", err)
	}

	if clientData.Type != "webauthn.create" {
		return nil, fmt.Errorf("unexpected client data type: %s", clientData.Type)
	}

	if clientData.Challenge != expectedChallenge {
		return nil, fmt.Errorf("challenge mismatch")
	}

	// Validar el origen: aceptar si esta en la lista configurada O si
	// el dominio del origen coincide con el RP ID configurado
	validOrigin := false
	for _, origin := range pm.Origins {
		if clientData.Origin == origin {
			validOrigin = true
			break
		}
	}
	// Tambien aceptar si el origen coincide con el expectedOrigin del request
	if !validOrigin && clientData.Origin == expectedOrigin {
		validOrigin = true
	}
	// Fallback: aceptar localhost para desarrollo local
	if !validOrigin {
		originHost := clientData.Origin
		originHost = strings.TrimPrefix(originHost, "https://")
		originHost = strings.TrimPrefix(originHost, "http://")
		if idx := strings.LastIndex(originHost, ":"); idx > 0 {
			originHost = originHost[:idx]
		}
		if originHost == "localhost" || originHost == "127.0.0.1" {
			validOrigin = true
		}
	}
	if !validOrigin {
		return nil, fmt.Errorf("invalid origin: %s (expected: %s)", clientData.Origin, expectedOrigin)
	}

	credentialID, err := base64.RawURLEncoding.DecodeString(response.ID)
	if err != nil {
		return nil, fmt.Errorf("decoding credential ID: %w", err)
	}

	attestationBytes, err := base64.RawURLEncoding.DecodeString(response.Response.AttestationObject)
	if err != nil {
		return nil, fmt.Errorf("decoding attestation object: %w", err)
	}

	pubKey, err := extractPublicKeyFromAttestation(attestationBytes)
	if err != nil {
		return nil, fmt.Errorf("extracting public key: %w", err)
	}

	return &StoredPasskey{
		CredentialID: credentialID,
		PublicKey:    pubKey,
		SignCount:    0,
	}, nil
}

func (pm *PasskeyManager) BeginLogin(credentialIDs [][]byte, rpID string) (*LoginChallenge, error) {
	challenge, err := pm.GenerateChallenge()
	if err != nil {
		return nil, err
	}

	if rpID == "" {
		rpID = pm.RPID
	}

	allowCreds := make([]CredentialDescriptor, 0, len(credentialIDs))
	for _, credID := range credentialIDs {
		allowCreds = append(allowCreds, CredentialDescriptor{
			Type: "public-key",
			ID:   base64.RawURLEncoding.EncodeToString(credID),
		})
	}

	return &LoginChallenge{
		Challenge:        challenge,
		RPID:             rpID,
		Timeout:          60000,
		UserVerification: "preferred",
		AllowCredentials: allowCreds,
	}, nil
}

func (pm *PasskeyManager) VerifyLogin(response LoginResponse, expectedChallenge string, storedPubKey []byte, storedSignCount int64) (int64, error) {
	clientDataBytes, err := base64.RawURLEncoding.DecodeString(response.Response.ClientDataJSON)
	if err != nil {
		return 0, fmt.Errorf("decoding clientDataJSON: %w", err)
	}

	var clientData ClientData
	if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
		return 0, fmt.Errorf("parsing clientDataJSON: %w", err)
	}

	if clientData.Type != "webauthn.get" {
		return 0, fmt.Errorf("unexpected client data type: %s", clientData.Type)
	}

	if clientData.Challenge != expectedChallenge {
		return 0, fmt.Errorf("challenge mismatch")
	}

	authDataBytes, err := base64.RawURLEncoding.DecodeString(response.Response.AuthenticatorData)
	if err != nil {
		return 0, fmt.Errorf("decoding authenticatorData: %w", err)
	}

	signatureBytes, err := base64.RawURLEncoding.DecodeString(response.Response.Signature)
	if err != nil {
		return 0, fmt.Errorf("decoding signature: %w", err)
	}

	// WebAuthn spec: los datos firmados son authenticatorData || SHA256(clientDataJSON)
	clientDataHash := sha256.Sum256(clientDataBytes)
	verifyData := append(authDataBytes, clientDataHash[:]...)

	// Determinar el tipo de clave y verificar la firma accordingly
	keyType, err := detectCOSEKeyType(storedPubKey)
	if err != nil {
		return 0, fmt.Errorf("detecting key type: %w", err)
	}

	switch keyType {
	case "ed25519":
		pubKey, err := parseEd25519PublicKey(storedPubKey)
		if err != nil {
			return 0, fmt.Errorf("parsing Ed25519 public key: %w", err)
		}
		// Ed25519 verifica el mensaje directamente (sin hashing adicional)
		if !ed25519.Verify(pubKey, verifyData, signatureBytes) {
			return 0, fmt.Errorf("signature verification failed (Ed25519)")
		}

	case "es256":
		pubKey, err := parseES256PublicKey(storedPubKey)
		if err != nil {
			return 0, fmt.Errorf("parsing ES256 public key: %w", err)
		}
		// ECDSA: hash de los datos firmados, luego verificar
		hash := sha256.Sum256(verifyData)
		if !ecdsa.VerifyASN1(pubKey, hash[:], signatureBytes) {
			// Fallback: algunos autenticadores usan formato raw r||s (64 bytes)
			// en vez de ASN.1 DER. Intentar convertir.
			if fixedSig, ok := fixECDSASignatureFormat(signatureBytes); ok {
				if ecdsa.VerifyASN1(pubKey, hash[:], fixedSig) {
					goto sigOK
				}
			}
			return 0, fmt.Errorf("signature verification failed (ES256)")
		}

	default:
		return 0, fmt.Errorf("unsupported key type: %s", keyType)
	}

sigOK:
	newSignCount := extractSignCount(authDataBytes)
	if newSignCount <= storedSignCount && storedSignCount != 0 {
		return 0, fmt.Errorf("sign count regression detected, possible replay attack")
	}

	return newSignCount, nil
}

// fixECDSASignatureFormat convierte una firma ECDSA de formato raw (r||s, 64 bytes)
// a formato ASN.1 DER si es necesario.
func fixECDSASignatureFormat(sig []byte) ([]byte, bool) {
	// Si ya es ASN.1 DER (empieza con 0x30), no convertir
	if len(sig) > 0 && sig[0] == 0x30 {
		return nil, false
	}
	// Formato raw: r (32 bytes) || s (32 bytes) = 64 bytes total
	if len(sig) != 64 {
		return nil, false
	}
	r := new(big.Int).SetBytes(sig[:32])
	s := new(big.Int).SetBytes(sig[32:])
	type ecdsaSig struct {
		R, S *big.Int
	}
	der, err := asn1.Marshal(ecdsaSig{r, s})
	if err != nil {
		return nil, false
	}
	return der, true
}

func extractPublicKeyFromAttestation(attestationObject []byte) ([]byte, error) {
	var attestation struct {
		Fmt      string                 `cbor:"fmt"`
		AttStmt  map[string]interface{} `cbor:"attStmt"`
		AuthData []byte                 `cbor:"authData"`
	}

	if err := cborUnmarshal(attestationObject, &attestation); err != nil {
		return nil, fmt.Errorf("decoding attestation CBOR: %w", err)
	}

	if len(attestation.AuthData) < 37 {
		return nil, fmt.Errorf("authData too short")
	}

	rpIDHash := attestation.AuthData[:32]
	flags := attestation.AuthData[32]
	counter := attestation.AuthData[33:37]

	_ = rpIDHash
	_ = counter

	if flags&0x40 == 0 {
		return nil, fmt.Errorf("attested credential flag not set")
	}

	if len(attestation.AuthData) < 37+2+32 {
		return nil, fmt.Errorf("authData too short for credential data")
	}

	aaguid := attestation.AuthData[37:53]
	credIDLen := int(attestation.AuthData[53])<<8 | int(attestation.AuthData[54])
	_ = aaguid

	if len(attestation.AuthData) < 55+credIDLen {
		return nil, fmt.Errorf("authData too short for credential ID")
	}

	credPublicKey := attestation.AuthData[55+credIDLen:]

	return credPublicKey, nil
}

// detectCOSEKeyType determina el tipo de clave COSE almacenada
func detectCOSEKeyType(keyBytes []byte) (string, error) {
	if len(keyBytes) == ed25519.PublicKeySize {
		return "ed25519", nil
	}

	var coseKey map[int]interface{}
	if err := cborUnmarshal(keyBytes, &coseKey); err != nil {
		return "", fmt.Errorf("parsing COSE key: %w", err)
	}

	kty, ok := coseKey[1]
	if !ok {
		return "", fmt.Errorf("missing key type in COSE key")
	}

	// CBOR puede decodificar enteros como int, int64, uint64, etc.
	ktyInt := toInt(kty)
	switch ktyInt {
	case 8: // OKP (Ed25519)
		return "ed25519", nil
	case 2: // EC2 (ECDSA)
		return "es256", nil
	default:
		return "", fmt.Errorf("unsupported key type: %v", kty)
	}
}

// toInt converte un valor CBOR decodificado a int de forma segura (sin panic)
func toInt(v interface{}) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case uint64:
		return int(n)
	case uint:
		return int(n)
	case float64:
		return int(n)
	default:
		return -1
	}
}

// parseEd25519PublicKey parsea una clave publica Ed25519 desde COSE
func parseEd25519PublicKey(keyBytes []byte) (ed25519.PublicKey, error) {
	if len(keyBytes) == ed25519.PublicKeySize {
		return ed25519.PublicKey(keyBytes), nil
	}

	var coseKey map[int]interface{}
	if err := cborUnmarshal(keyBytes, &coseKey); err != nil {
		return nil, fmt.Errorf("parsing COSE key: %w", err)
	}

	x, ok := coseKey[-2]
	if !ok {
		return nil, fmt.Errorf("missing x coordinate in COSE key")
	}

	xBytes, ok := x.([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid x coordinate type")
	}

	if len(xBytes) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key size: %d", len(xBytes))
	}

	return ed25519.PublicKey(xBytes), nil
}

// parseES256PublicKey parsea una clave publica ECDSA P-256 desde COSE
// COSE key para EC2 P-256:
//
//	 1 (kty): 2 (EC2)
//	-1 (crv): 1 (P-256)
//	-2 (x):   32 bytes (coordenada x)
//	-3 (y):   32 bytes (coordenada y)
func parseES256PublicKey(keyBytes []byte) (*ecdsa.PublicKey, error) {
	var coseKey map[int]interface{}
	if err := cborUnmarshal(keyBytes, &coseKey); err != nil {
		return nil, fmt.Errorf("parsing COSE key: %w", err)
	}

	// Verificar que es EC2 (kty=2)
	kty := toInt(coseKey[1])
	if kty != 2 {
		return nil, fmt.Errorf("not an EC2 key (kty=%d)", kty)
	}

	// Verificar que es P-256 (crv=1)
	crv := toInt(coseKey[-1])
	if crv != 1 {
		return nil, fmt.Errorf("not P-256 curve (crv=%d)", crv)
	}

	// Obtener coordenada x
	xVal, ok := coseKey[-2]
	if !ok {
		return nil, fmt.Errorf("missing x coordinate")
	}
	xBytes, ok := xVal.([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid x coordinate type")
	}

	// Obtener coordenada y
	yVal, ok := coseKey[-3]
	if !ok {
		return nil, fmt.Errorf("missing y coordinate")
	}
	yBytes, ok := yVal.([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid y coordinate type")
	}

	// Reconstruir la clave ECDSA
	pubKey := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}

	return pubKey, nil
}

func extractSignCount(authData []byte) int64 {
	if len(authData) < 37 {
		return 0
	}
	return int64(authData[33])<<24 | int64(authData[34])<<16 | int64(authData[35])<<8 | int64(authData[36])
}

func cborUnmarshal(data []byte, v interface{}) error {
	return cbor.Unmarshal(data, v)
}

type challengeStoreEntry struct {
	Challenge string
	UserID    uuid.UUID
	Expires   time.Time
}

type ChallengeStore struct {
	entries map[string]challengeStoreEntry
}

func NewChallengeStore() *ChallengeStore {
	return &ChallengeStore{entries: make(map[string]challengeStoreEntry)}
}

func (cs *ChallengeStore) Store(key, challenge string, userID uuid.UUID) {
	cs.entries[key] = challengeStoreEntry{
		Challenge: challenge,
		UserID:    userID,
		Expires:   time.Now().Add(5 * time.Minute),
	}
}

func (cs *ChallengeStore) Get(key string) (string, uuid.UUID, bool) {
	entry, ok := cs.entries[key]
	if !ok {
		return "", uuid.Nil, false
	}
	if time.Now().After(entry.Expires) {
		delete(cs.entries, key)
		return "", uuid.Nil, false
	}
	return entry.Challenge, entry.UserID, true
}

func (cs *ChallengeStore) Delete(key string) {
	delete(cs.entries, key)
}

func (cs *ChallengeStore) Cleanup() {
	for k, entry := range cs.entries {
		if time.Now().After(entry.Expires) {
			delete(cs.entries, k)
		}
	}
}
