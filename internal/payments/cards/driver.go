// Package cards implementa el sistema modular de drivers de tarjetas NFC.
//
// Cada tipo de tarjeta (NTAG215, MIFARE Classic, DESFire, etc.) tiene su
// propio driver que implementa la interfaz CardDriver. Los drivers se
// auto-registran en init() y el sistema los descubre automáticamente.
//
// Para agregar un nuevo tipo de tarjeta:
//  1. Crear {tipo}_driver.go en este paquete
//  2. Implementar CardDriver
//  3. Auto-registrar en init()
//  4. Crear docs/card-drivers/{tipo}.json (manifiesto)
//  5. Crear migración DB si necesita tablas propias
//
// No se necesita modificar código existente.
package cards

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CardManifest describe las características de un tipo de tarjeta.
// Se carga desde docs/card-drivers/{tipo}.json.
type CardManifest struct {
	Type          string            `json:"type"`
	DisplayName   string            `json:"display_name"`
	Description   string            `json:"description"`
	Manufacturer  string            `json:"manufacturer"`
	Capacity      string            `json:"capacity"` // "full", "low"
	Memory        MemSpec           `json:"memory"`
	Security      SecuritySpec      `json:"security"`
	Compatibility CompatibilitySpec `json:"compatibility"`
	Protocol      ProtocolSpec      `json:"protocol"`
	Availability  AvailabilitySpec  `json:"availability"`
	Endpoints     EndpointsSpec     `json:"endpoints"`
	Docs          []string          `json:"docs"`
	Status        string            `json:"status"` // "" = activo, "future" = futuro
}

type MemSpec struct {
	TotalBytes    int `json:"total_bytes"`
	UserBytes     int `json:"user_bytes"`
	PageSize      int `json:"page_size"`
	TotalPages    int `json:"total_pages"`
	UserPages     int `json:"user_pages"`
	Sectors       int `json:"sectors"`
	UsableSectors int `json:"usable_sectors"`
}

type SecuritySpec struct {
	Level                 string `json:"level"`
	Algorithm             string `json:"algorithm"`
	KeyLengthBits         int    `json:"key_length_bits"`
	KeyCount              int    `json:"key_count"`
	MutualAuth            bool   `json:"mutual_auth"`
	SecureMessaging       bool   `json:"secure_messaging"`
	CryptoPerSlot         bool   `json:"crypto_per_slot"`
	OriginalitySignature  bool   `json:"originality_signature"`
	AuthLimitConfigurable bool   `json:"auth_limit_configurable"`
	SunMac                bool   `json:"sun_mac"`
	Certification         string `json:"certification"`
	Notes                 string `json:"notes"`
}

type CompatibilitySpec struct {
	Android      string `json:"android"`     // "full", "partial", "none"
	IOS          string `json:"ios"`         // "full", "partial", "none"
	ESP32PN532   string `json:"esp32_pn532"` // "full", "partial", "none"
	PhoneReader  bool   `json:"phone_reader"`
	NFCForumType int    `json:"nfc_forum_type"`
	Notes        string `json:"notes"`
}

type ProtocolSpec struct {
	Slots                int    `json:"slots"`
	ActiveSlots          int    `json:"active_slots"`
	BackupSlots          int    `json:"backup_slots"`
	CertificateSize      int    `json:"certificate_size"`
	Redundancy           int    `json:"redundancy"`
	PublicZonePages      int    `json:"public_zone_pages"`
	PublicZoneStartPage  int    `json:"public_zone_start_page"`
	PrivateZoneStartPage int    `json:"private_zone_start_page"`
	PrivateZoneEndPage   int    `json:"private_zone_end_page"`
	AuthMethod           string `json:"auth_method"`
	Rotation             string `json:"rotation"`
	PreAuthTTLSeconds    int    `json:"pre_auth_ttl_seconds"`
	Notes                string `json:"notes"`
}

type AvailabilitySpec struct {
	Venezuela bool    `json:"venezuela"`
	PriceUSD  float64 `json:"price_usd"`
	Notes     string  `json:"notes"`
}

type EndpointsSpec struct {
	Provision string `json:"provision"`
	PreAuth   string `json:"pre_auth"`
	Confirm   string `json:"confirm"`
}

// ProvisionResponse es la respuesta genérica de provisionamiento.
// Cada driver llena los campos específicos de su tipo.
type ProvisionResponse struct {
	CardUID      string          `json:"card_uid"`
	CardType     string          `json:"card_type"`
	CustomCardID string          `json:"custom_card_id,omitempty"`
	RawData      json.RawMessage `json:"raw_data,omitempty"` // datos específicos del driver
}

// PreAuthResponse es la respuesta genérica de pre-autenticación.
// Cada driver llena los campos específicos de su tipo.
type PreAuthResponse struct {
	PreApproved bool            `json:"pre_approved"`
	CardType    string          `json:"card_type"`
	CardUID     string          `json:"card_uid"`
	Message     string          `json:"message,omitempty"`
	RawData     json.RawMessage `json:"raw_data,omitempty"` // datos específicos del driver
}

// ConfirmData son los datos que el POS envía al confirmar.
type ConfirmData struct {
	ReadOK       bool `json:"read_ok"`
	WriteOK      bool `json:"write_ok"`
	WrittenPages int  `json:"written_pages"`
}

// CardDriver es la interfaz que implementa cada tipo de tarjeta.
type CardDriver interface {
	// GetType retorna el identificador del tipo (ej. "ntag215", "classic").
	GetType() string

	// GetManifest retorna el manifiesto con las specs de la tarjeta.
	GetManifest() CardManifest

	// RequiresDocument indica si el protocolo requiere documento de identidad.
	RequiresDocument() bool

	// Provision registra la tarjeta en el servidor y genera los datos
	// para que el POS escriba físicamente.
	Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error)

	// PreAuth valida usuario + PIN + saldo y prepara la rotación del certificado.
	// NO procesa el pago hasta que el POS confirme la escritura.
	PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error)

	// Confirm confirma la lectura/escritura de la tarjeta y procesa el pago
	// si todo fue exitoso.
	Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error)

	// CleanupExpired borra las pre-aprobaciones expiradas.
	CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error
}

// NFCPaymentResult es el resultado de un pago NFC.
// (Duplicado intencionalmente del paquete payments para evitar import circular.)
type NFCPaymentResult struct {
	Status        string `json:"status"`
	TransactionID string `json:"transaction_id,omitempty"`
	Message       string `json:"message,omitempty"`
	UserBalance   *int64 `json:"user_balance,omitempty"`
}

// Registry mantiene el registro de todos los drivers disponibles.
var (
	registryMu sync.RWMutex
	registry   = map[string]CardDriver{}
)

// Register registra un driver. Se llama desde init() en cada driver.
func Register(d CardDriver) {
	registryMu.Lock()
	defer registryMu.Unlock()
	registry[d.GetType()] = d
}

// GetDriver retorna el driver para un tipo de tarjeta.
func GetDriver(cardType string) (CardDriver, error) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	d, ok := registry[cardType]
	if !ok {
		return nil, fmt.Errorf("driver no encontrado para tipo de tarjeta: %s", cardType)
	}
	return d, nil
}

// ListDrivers retorna los manifiestos de todos los drivers registrados.
func ListDrivers() []CardManifest {
	registryMu.RLock()
	defer registryMu.RUnlock()
	manifests := make([]CardManifest, 0, len(registry))
	for _, d := range registry {
		manifests = append(manifests, d.GetManifest())
	}
	return manifests
}

// ListAvailableCardTypes retorna los tipos de tarjeta disponibles (no "future").
func ListAvailableCardTypes() []string {
	registryMu.RLock()
	defer registryMu.RUnlock()
	types := make([]string, 0, len(registry))
	for _, d := range registry {
		m := d.GetManifest()
		if m.Status != "future" {
			types = append(types, d.GetType())
		}
	}
	return types
}

// IsSupportedCardType verifica si un tipo de tarjeta está soportado.
func IsSupportedCardType(cardType string) bool {
	registryMu.RLock()
	defer registryMu.RUnlock()
	_, ok := registry[cardType]
	return ok
}

// LoadManifestFromFile carga un manifiesto desde un archivo JSON.
func LoadManifestFromFile(path string) (*CardManifest, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("leyendo manifiesto %s: %w", path, err)
	}
	var m CardManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parseando manifiesto %s: %w", path, err)
	}
	return &m, nil
}

// ===== Funciones de conveniencia para drivers específicos =====
// Estas funciones delegan al driver correspondiente del registry.
// Permiten que el paquete payments las llame sin importar el driver específico.

// ProvisionNTAG215 delega al driver NTAG215.
func ProvisionNTAG215(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	d, err := GetDriver("ntag215")
	if err != nil {
		return nil, err
	}
	return d.Provision(ctx, pool, nodeDomain, userID, cardUID, initialPIN)
}

// NTAG215PreAuth delega al driver NTAG215.
func NTAG215PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	d, err := GetDriver("ntag215")
	if err != nil {
		return nil, err
	}
	return d.PreAuth(ctx, pool, nodeDomain, terminalID, userID, amount)
}

// NTAG215Confirm delega al driver NTAG215.
func NTAG215Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	d, err := GetDriver("ntag215")
	if err != nil {
		return nil, err
	}
	return d.Confirm(ctx, pool, nodeDomain, terminalID, cardUID, confirmData)
}

// ProvisionUltralightC delega al driver Ultralight C.
func ProvisionUltralightC(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	d, err := GetDriver("ultralight_c")
	if err != nil {
		return nil, err
	}
	return d.Provision(ctx, pool, nodeDomain, userID, cardUID, initialPIN)
}

// UltralightCPreAuth delega al driver Ultralight C.
func UltralightCPreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	d, err := GetDriver("ultralight_c")
	if err != nil {
		return nil, err
	}
	return d.PreAuth(ctx, pool, nodeDomain, terminalID, userID, amount)
}

// UltralightCConfirm delega al driver Ultralight C.
func UltralightCConfirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	d, err := GetDriver("ultralight_c")
	if err != nil {
		return nil, err
	}
	return d.Confirm(ctx, pool, nodeDomain, terminalID, cardUID, confirmData)
}
