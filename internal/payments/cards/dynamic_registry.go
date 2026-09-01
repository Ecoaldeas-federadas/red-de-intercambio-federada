// Package cards — dynamic_registry.go
//
// Driver dinamico que implementa CardDriver pero delega la ejecucion
// al sandbox Goja (driver.js). Se registra en el registry existente
// cuando se instala un .nfcpkg.

package cards

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DynamicDriver es un driver que ejecuta driver.js via Goja sandbox.
// Implementa la interfaz CardDriver existente.
type DynamicDriver struct {
	manifest     CardManifest
	driverSource string
	requiresDoc  bool
	isActive     bool
}

// NewDynamicDriver crea un driver dinamico desde un paquete instalado.
func NewDynamicDriver(manifest CardManifest, driverSource string, requiresDoc bool) *DynamicDriver {
	return &DynamicDriver{
		manifest:     manifest,
		driverSource: driverSource,
		requiresDoc:  requiresDoc,
		isActive:     true,
	}
}

func (d *DynamicDriver) GetType() string          { return d.manifest.Type }
func (d *DynamicDriver) GetManifest() CardManifest { return d.manifest }
func (d *DynamicDriver) RequiresDocument() bool   { return d.requiresDoc }

// Provision ejecuta NfcDriver.provision() en el sandbox.
func (d *DynamicDriver) Provision(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
	result, err := ExecuteDriverProvision(ctx, d.manifest.Type, d.driverSource, pool, nodeDomain, userID.String(), cardUID, initialPIN)
	if err != nil {
		return nil, err
	}

	// Convertir resultado a ProvisionResponse
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("serializando resultado: %w", err)
	}

	var resp ProvisionResponse
	if err := json.Unmarshal(resultBytes, &resp); err != nil {
		// Si no coincide con ProvisionResponse, intentar como RawData
		resp = ProvisionResponse{
			CardType: d.manifest.Type,
			RawData:  resultBytes,
		}
	}
	if resp.CardType == "" {
		resp.CardType = d.manifest.Type
	}

	return &resp, nil
}

// PreAuth ejecuta NfcDriver.preAuth() en el sandbox.
func (d *DynamicDriver) PreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string, userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
	// Buscar username del userID
	var username string
	err := pool.QueryRow(ctx,
		"SELECT username FROM users WHERE id = $1", userID).Scan(&username)
	if err != nil {
		return nil, fmt.Errorf("buscando usuario: %w", err)
	}

	// Buscar PIN hash de la tarjeta activa
	var pinHash string
	err = pool.QueryRow(ctx,
		"SELECT pin_hash FROM nfc_cards WHERE user_id = $1 AND card_type = $2 AND is_active = true ORDER BY issued_at DESC LIMIT 1",
		userID, d.manifest.Type).Scan(&pinHash)
	if err != nil {
		return nil, fmt.Errorf("usuario no tiene tarjeta %s activa: %w", d.manifest.Type, err)
	}

	// El driver JS necesita el PIN, pero no lo tenemos aqui.
	// El pre-auth del terminal ya verifico el PIN antes de llamar al driver.
	// Pasamos un placeholder — el driver JS no debe re-verificar el PIN.
	result, err := ExecuteDriverPreAuth(ctx, d.manifest.Type, d.driverSource, pool, nodeDomain, terminalID, username, "", amount)
	if err != nil {
		return nil, err
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("serializando resultado: %w", err)
	}

	var resp PreAuthResponse
	if err := json.Unmarshal(resultBytes, &resp); err != nil {
		resp = PreAuthResponse{
			CardType: d.manifest.Type,
			RawData:  resultBytes,
		}
	}
	if resp.CardType == "" {
		resp.CardType = d.manifest.Type
	}

	return &resp, nil
}

// Confirm ejecuta NfcDriver.confirm() en el sandbox.
func (d *DynamicDriver) Confirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string, confirmData ConfirmData) (*NFCPaymentResult, error) {
	result, err := ExecuteDriverConfirm(ctx, d.manifest.Type, d.driverSource, pool, nodeDomain, terminalID, cardUID, confirmData.ReadOK, confirmData.WriteOK, confirmData.WrittenPages)
	if err != nil {
		return nil, err
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("serializando resultado: %w", err)
	}

	var resp NFCPaymentResult
	if err := json.Unmarshal(resultBytes, &resp); err != nil {
		return nil, fmt.Errorf("deserializando resultado de confirm: %w", err)
	}

	return &resp, nil
}

// CleanupExpired ejecuta NfcDriver.cleanupExpired() en el sandbox.
func (d *DynamicDriver) CleanupExpired(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) error {
	return ExecuteDriverCleanupExpired(ctx, d.manifest.Type, d.driverSource, pool, nodeDomain)
}

// RegisterDynamicDriver registra un driver dinamico en el registry existente.
// Si ya existe un driver con el mismo tipo, lo reemplaza.
func RegisterDynamicDriver(d *DynamicDriver) {
	registryMu.Lock()
	defer registryMu.Unlock()
	registry[d.GetType()] = d
}

// UnregisterDynamicDriver elimina un driver del registry.
func UnregisterDynamicDriver(cardType string) {
	registryMu.Lock()
	defer registryMu.Unlock()
	delete(registry, cardType)
	// Tambien remover del cache de compilacion
	RemoveCompiledDriver(cardType)
}

// LoadDynamicDriversFromDB carga todos los drivers dinamicos activos desde la DB.
// Se llama al iniciar el servidor.
func LoadDynamicDriversFromDB(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx,
		`SELECT type, display_name, manifest, driver_js, is_active
		 FROM nfc_card_drivers WHERE is_active = true AND is_builtin = false`)
	if err != nil {
		return fmt.Errorf("cargando drivers dinamicos: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var cardType, displayName, driverJS string
		var manifestJSON []byte
		var isActive bool
		if err := rows.Scan(&cardType, &displayName, &manifestJSON, &driverJS, &isActive); err != nil {
			continue
		}

		var manifest CardManifest
		if err := json.Unmarshal(manifestJSON, &manifest); err != nil {
			fmt.Printf("warning: no se pudo parsear manifest de %s: %v\n", cardType, err)
			continue
		}

		// Compilar y registrar
		if _, err := CompileDriver(cardType, driverJS); err != nil {
			fmt.Printf("warning: no se pudo compilar driver %s: %v\n", cardType, err)
			continue
		}

		driver := NewDynamicDriver(manifest, driverJS, false)
		RegisterDynamicDriver(driver)
		fmt.Printf("Driver dinamico cargado: %s\n", cardType)
	}

	return nil
}

// InstalledDriverInfo es la informacion de un driver instalado para la API.
type InstalledDriverInfo struct {
	ID              string      `json:"id"`
	Type            string      `json:"type"`
	DisplayName     string      `json:"display_name"`
	Version         string      `json:"version"`
	Description     string      `json:"description"`
	Manufacturer    string      `json:"manufacturer"`
	Capacity        string      `json:"capacity"`
	Manifest        CardManifest `json:"manifest"`
	IsActive        bool        `json:"is_active"`
	IsBuiltin       bool        `json:"is_builtin"`
	SignedBy        string      `json:"signed_by"`
	TrustLevel      string      `json:"trust_level"`
	InstalledAt     string      `json:"installed_at"`
	SharedWithFederation bool   `json:"shared_with_federation"`
	ReaderJSON      string      `json:"reader_json,omitempty"`
}

// ListInstalledDrivers lista todos los drivers instalados desde la DB.
func ListInstalledDrivers(ctx context.Context, pool *pgxpool.Pool, includeReader bool) ([]InstalledDriverInfo, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, type, display_name, version, description, manufacturer, capacity,
		         manifest, is_active, is_builtin, signed_by, trust_level,
		         installed_at, shared_with_federation, reader_json
		 FROM nfc_card_drivers ORDER BY is_builtin DESC, display_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []InstalledDriverInfo
	for rows.Next() {
		var d InstalledDriverInfo
		var manifestJSON []byte
		var readerJSON string
		if err := rows.Scan(&d.ID, &d.Type, &d.DisplayName, &d.Version, &d.Description,
			&d.Manufacturer, &d.Capacity, &manifestJSON, &d.IsActive, &d.IsBuiltin,
			&d.SignedBy, &d.TrustLevel, &d.InstalledAt, &d.SharedWithFederation,
			&readerJSON); err != nil {
			continue
		}
		json.Unmarshal(manifestJSON, &d.Manifest)
		if includeReader {
			d.ReaderJSON = readerJSON
		}
		drivers = append(drivers, d)
	}
	return drivers, nil
}

// GetInstalledDriver retorna la info de un driver especifico.
func GetInstalledDriver(ctx context.Context, pool *pgxpool.Pool, cardType string) (*InstalledDriverInfo, error) {
	var d InstalledDriverInfo
	var manifestJSON []byte
	var readerJSON string
	err := pool.QueryRow(ctx,
		`SELECT id, type, display_name, version, description, manufacturer, capacity,
		         manifest, is_active, is_builtin, signed_by, trust_level,
		         installed_at, shared_with_federation, reader_json
		 FROM nfc_card_drivers WHERE type = $1`, cardType).
		Scan(&d.ID, &d.Type, &d.DisplayName, &d.Version, &d.Description,
			&d.Manufacturer, &d.Capacity, &manifestJSON, &d.IsActive, &d.IsBuiltin,
			&d.SignedBy, &d.TrustLevel, &d.InstalledAt, &d.SharedWithFederation,
			&readerJSON)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(manifestJSON, &d.Manifest)
	d.ReaderJSON = readerJSON
	return &d, nil
}
