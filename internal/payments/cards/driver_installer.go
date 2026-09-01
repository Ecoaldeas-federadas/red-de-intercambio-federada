// Package cards — driver_installer.go
//
// Orquesta la instalacion de un .nfcpkg:
// 1. Parsear el ZIP
// 2. Verificar firma Ed25519
// 3. Validar manifest + driver.js + reader.json
// 4. Ejecutar migration.sql en transaccion
// 5. Compilar driver.js con Goja
// 6. Registrar en nfc_card_drivers (DB)
// 7. Registrar en el registry (memoria)
// 8. Retornar resultado

package cards

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// InstallResult es el resultado de instalar un .nfcpkg.
type InstallResult struct {
	Success      bool   `json:"success"`
	CardType     string `json:"card_type"`
	DisplayName  string `json:"display_name"`
	Version      string `json:"version"`
	SignedBy     string `json:"signed_by"`
	TrustLevel   string `json:"trust_level"`
	Message      string `json:"message"`
	MigrationRan bool   `json:"migration_ran"`
	Replaced     bool   `json:"replaced"` // true si reemplazo una version anterior
}

// InstallPackage instala un .nfcpkg en el servidor.
// Si signWithNodeKey es true, firma el paquete con la clave del nodo antes de instalar
// (para paquetes subidos sin firma por el admin local).
func InstallPackage(
	ctx context.Context,
	pool *pgxpool.Pool,
	nodeDomain string,
	pkgData []byte,
	signWithNodeKey bool,
) (*InstallResult, error) {
	// 1. Parsear el ZIP
	pkg, err := ParsePackage(pkgData)
	if err != nil {
		return nil, fmt.Errorf("parseando paquete: %w", err)
	}

	result := &InstallResult{
		CardType:    pkg.Manifest.Type,
		DisplayName: pkg.Manifest.DisplayName,
		Version:     pkg.Manifest.DriverVersion,
	}

	// 2. Verificar firma (o firmar con clave del nodo si no tiene)
	var trustLevel TrustLevel
	var signedBy string

	if pkg.Signature == "" && signWithNodeKey {
		// Firmar con la clave del nodo
		keyPair, err := GetOrCreateNodeSigningKey(ctx, pool, nodeDomain, nil)
		if err != nil {
			return nil, fmt.Errorf("obteniendo clave de firma del nodo: %w", err)
		}
		sigData := pkg.ComputeSignatureData()
		pkg.Signature = SignPackage(keyPair.PrivateKey, sigData)
		signedBy = nodeDomain
		trustLevel = TrustSelf
		result.SignedBy = signedBy
		result.TrustLevel = string(trustLevel)
	} else if pkg.Signature != "" {
		// Verificar firma contra claves confiables
		trustLevel, signedBy, err = VerifyPackageSignature(ctx, pool, pkg)
		if err != nil {
			return nil, fmt.Errorf("verificacion de firma: %w", err)
		}
		result.SignedBy = signedBy
		result.TrustLevel = string(trustLevel)

		if trustLevel == TrustUnknown {
			return nil, fmt.Errorf("firma no reconocida por ninguna clave confiable. Agrega la clave publica del firmante desde la UI")
		}
	} else {
		return nil, fmt.Errorf("paquete sin firma y signWithNodeKey=false")
	}

	// 3. Validar manifest + driver.js + reader.json
	if err := pkg.Validate(); err != nil {
		return nil, fmt.Errorf("validando paquete: %w", err)
	}

	// 4. Verificar si ya existe una version anterior
	var existingVersion string
	err = pool.QueryRow(ctx,
		"SELECT version FROM nfc_card_drivers WHERE type = $1", pkg.Manifest.Type).Scan(&existingVersion)
	if err == nil {
		result.Replaced = true
	}

	// 5. Ejecutar migration.sql (si existe)
	if pkg.MigrationSQL != "" {
		if err := RunMigration(ctx, pool, pkg.MigrationSQL); err != nil {
			return nil, fmt.Errorf("migracion SQL: %w", err)
		}
		result.MigrationRan = true
	}

	// 6. Compilar driver.js
	if _, err := CompileDriver(pkg.Manifest.Type, pkg.DriverJS); err != nil {
		return nil, fmt.Errorf("compilando driver.js: %w", err)
	}

	// 7. Convertir manifest a JSON para guardar
	manifestJSON, err := json.Marshal(pkg.Manifest)
	if err != nil {
		return nil, fmt.Errorf("serializando manifest: %w", err)
	}

	// 8. Guardar en DB (INSERT o UPDATE)
	if result.Replaced {
		// Desactivar driver antiguo y remover del registry
		UnregisterDynamicDriver(pkg.Manifest.Type)
		_, err = pool.Exec(ctx,
			`UPDATE nfc_card_drivers SET
				display_name = $2, version = $3, description = $4, manufacturer = $5,
				capacity = $6, manifest = $7, driver_js = $8, reader_json = $9,
				migration_sql = $10, signature = $11, signed_by = $12, trust_level = $13,
				is_active = true, updated_at = NOW(), package_hash = $14
			 WHERE type = $1`,
			pkg.Manifest.Type, pkg.Manifest.DisplayName, pkg.Manifest.DriverVersion,
			pkg.Manifest.Description, pkg.Manifest.Manufacturer, pkg.Manifest.Capacity,
			manifestJSON, pkg.DriverJS, pkg.ReaderJSON, pkg.MigrationSQL,
			pkg.Signature, signedBy, string(trustLevel), pkg.PackageHash)
	} else {
		_, err = pool.Exec(ctx,
			`INSERT INTO nfc_card_drivers
				(type, display_name, version, description, manufacturer, capacity,
				 manifest, driver_js, reader_json, migration_sql, signature,
				 signed_by, trust_level, is_active, is_builtin, package_hash)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, false, $14)`,
			pkg.Manifest.Type, pkg.Manifest.DisplayName, pkg.Manifest.DriverVersion,
			pkg.Manifest.Description, pkg.Manifest.Manufacturer, pkg.Manifest.Capacity,
			manifestJSON, pkg.DriverJS, pkg.ReaderJSON, pkg.MigrationSQL,
			pkg.Signature, signedBy, string(trustLevel), pkg.PackageHash)
	}
	if err != nil {
		return nil, fmt.Errorf("guardando driver en DB: %w", err)
	}

	// 9. Registrar en el registry (memoria)
	var manifest CardManifest
	json.Unmarshal(manifestJSON, &manifest)
	driver := NewDynamicDriver(manifest, pkg.DriverJS, false)
	RegisterDynamicDriver(driver)

	result.Success = true
	result.Message = fmt.Sprintf("Driver %s v%s instalado correctamente", pkg.Manifest.DisplayName, pkg.Manifest.DriverVersion)
	if result.Replaced {
		result.Message = fmt.Sprintf("Driver %s actualizado a v%s (reemplazo v%s)", pkg.Manifest.DisplayName, pkg.Manifest.DriverVersion, existingVersion)
	}

	return result, nil
}

// UninstallDriver desinstala un driver dinamico.
// No borra las tablas DB (por si hay datos), solo lo desactiva y remueve del registry.
func UninstallDriver(ctx context.Context, pool *pgxpool.Pool, cardType string) error {
	// Verificar que existe y no es builtin
	var isBuiltin bool
	err := pool.QueryRow(ctx,
		"SELECT is_builtin FROM nfc_card_drivers WHERE type = $1", cardType).Scan(&isBuiltin)
	if err != nil {
		return fmt.Errorf("driver no encontrado: %w", err)
	}
	if isBuiltin {
		return fmt.Errorf("no se puede desinstalar un driver built-in")
	}

	// Desactivar en DB
	_, err = pool.Exec(ctx,
		"UPDATE nfc_card_drivers SET is_active = false, updated_at = NOW() WHERE type = $1", cardType)
	if err != nil {
		return fmt.Errorf("desactivando driver: %w", err)
	}

	// Remover del registry
	UnregisterDynamicDriver(cardType)

	return nil
}

// ActivateDriver re-activa un driver desactivado.
func ActivateDriver(ctx context.Context, pool *pgxpool.Pool, cardType string) error {
	var driverJS string
	var manifestJSON []byte
	err := pool.QueryRow(ctx,
		"SELECT driver_js, manifest FROM nfc_card_drivers WHERE type = $1", cardType).
		Scan(&driverJS, &manifestJSON)
	if err != nil {
		return fmt.Errorf("driver no encontrado: %w", err)
	}

	// Recompilar
	if _, err := CompileDriver(cardType, driverJS); err != nil {
		return fmt.Errorf("compilando driver: %w", err)
	}

	// Activar en DB
	_, err = pool.Exec(ctx,
		"UPDATE nfc_card_drivers SET is_active = true, updated_at = NOW() WHERE type = $1", cardType)
	if err != nil {
		return fmt.Errorf("activando driver: %w", err)
	}

	// Registrar en memoria
	var manifest CardManifest
	json.Unmarshal(manifestJSON, &manifest)
	driver := NewDynamicDriver(manifest, driverJS, false)
	RegisterDynamicDriver(driver)

	return nil
}

// DeactivateDriver desactiva un driver sin desinstalarlo.
func DeactivateDriver(ctx context.Context, pool *pgxpool.Pool, cardType string) error {
	_, err := pool.Exec(ctx,
		"UPDATE nfc_card_drivers SET is_active = false, updated_at = NOW() WHERE type = $1", cardType)
	if err != nil {
		return fmt.Errorf("desactivando driver: %w", err)
	}
	UnregisterDynamicDriver(cardType)
	return nil
}

// ShareDriverWithFederation marca un driver para compartir con nodos federados.
func ShareDriverWithFederation(ctx context.Context, pool *pgxpool.Pool, cardType string) error {
	_, err := pool.Exec(ctx,
		"UPDATE nfc_card_drivers SET shared_with_federation = true, updated_at = NOW() WHERE type = $1",
		cardType)
	return err
}

// GetDriversForFederation retorna los drivers marcados para sharing.
func GetDriversForFederation(ctx context.Context, pool *pgxpool.Pool) ([]FederationDriverInfo, error) {
	rows, err := pool.Query(ctx,
		`SELECT type, version, display_name, package_hash, signed_by, signature
		 FROM nfc_card_drivers WHERE is_active = true AND shared_with_federation = true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []FederationDriverInfo
	for rows.Next() {
		var d FederationDriverInfo
		if err := rows.Scan(&d.Type, &d.Version, &d.DisplayName, &d.PackageHash, &d.SignedBy, &d.Signature); err != nil {
			continue
		}
		drivers = append(drivers, d)
	}
	return drivers, nil
}

// FederationDriverInfo es la info de un driver para compartir via gossip.
type FederationDriverInfo struct {
	Type        string `json:"type"`
	Version     string `json:"version"`
	DisplayName string `json:"display_name"`
	PackageHash string `json:"package_hash"`
	SignedBy    string `json:"signed_by"`
	Signature   string `json:"signature"`
}

// GetPackageForFederation retorna el .nfcpkg completo para descargar via federation.
func GetPackageForFederation(ctx context.Context, pool *pgxpool.Pool, cardType string) ([]byte, string, error) {
	// Reconstruir el paquete desde los componentes guardados en la DB
	var manifestJSON, driverJS, readerJSON, migrationSQL string
	var displayName, version string
	err := pool.QueryRow(ctx,
		"SELECT manifest::text, driver_js, reader_json, COALESCE(migration_sql, ''), display_name, version FROM nfc_card_drivers WHERE type = $1 AND is_active = true",
		cardType).Scan(&manifestJSON, &driverJS, &readerJSON, &migrationSQL, &displayName, &version)
	if err != nil {
		return nil, "", fmt.Errorf("driver no encontrado: %w", err)
	}

	// Reconstruir ZIP
	pkgData, err := BuildPackage(manifestJSON, driverJS, readerJSON, migrationSQL, "", "")
	if err != nil {
		return nil, "", fmt.Errorf("reconstruyendo paquete: %w", err)
	}

	// Obtener firma de la DB
	var signature string
	pool.QueryRow(ctx, "SELECT signature FROM nfc_card_drivers WHERE type = $1", cardType).Scan(&signature)

	// Si hay firma, agregarla al ZIP
	if signature != "" {
		// Reconstruir con firma
		pkgData, err = buildPackageWithSignature(manifestJSON, driverJS, readerJSON, migrationSQL, signature)
		if err != nil {
			return nil, "", err
		}
	}

	filename := fmt.Sprintf("%s-%s.nfcpkg", cardType, version)
	return pkgData, filename, nil
}

// buildPackageWithSignature crea un ZIP con la firma incluida.
func buildPackageWithSignature(manifestJSON, driverJS, readerJSON, migrationSQL, signature string) ([]byte, error) {
	// Primero crear el paquete sin firma
	pkgData, err := BuildPackage(manifestJSON, driverJS, readerJSON, migrationSQL, "", "")
	if err != nil {
		return nil, err
	}

	// Agregar signature.sig al ZIP
	return addSignatureToZip(pkgData, signature)
}

// addSignatureToZip agrega un archivo signature.sig a un ZIP existente.
func addSignatureToZip(zipData []byte, signature string) ([]byte, error) {
	// Re-crear el ZIP con todos los archivos + signature.sig
	// Leer el ZIP original
	pkg, err := ParsePackage(zipData)
	if err != nil {
		return nil, err
	}

	// Crear nuevo ZIP con signature
	return BuildPackageWithSignature(
		stringifyManifest(pkg.Manifest),
		pkg.DriverJS,
		pkg.ReaderJSON,
		pkg.MigrationSQL,
		pkg.ProtocolDoc,
		pkg.IconSVG,
		signature,
	)
}

func stringifyManifest(m PackageManifest) string {
	b, _ := json.MarshalIndent(m, "", "  ")
	return string(b)
}

// BuildPackageWithSignature crea un ZIP completo con todos los archivos + firma.
func BuildPackageWithSignature(manifestJSON, driverJS, readerJSON, migrationSQL, protocolDoc, iconSVG, signature string) ([]byte, error) {
	// Crear paquete base
	baseData, err := BuildPackage(manifestJSON, driverJS, readerJSON, migrationSQL, protocolDoc, iconSVG)
	if err != nil {
		return nil, err
	}

	// Re-leer y agregar signature.sig
	// Usar archive/zip para agregar el archivo
	return rebuildZipWithSignature(baseData, strings.TrimSpace(signature))
}

// rebuildZipWithSignature lee un ZIP y crea uno nuevo identico + signature.sig.
func rebuildZipWithSignature(baseData []byte, signature string) ([]byte, error) {
	zipReader, err := zip.NewReader(bytes.NewReader(baseData), int64(len(baseData)))
	if err != nil {
		return nil, fmt.Errorf("leyendo ZIP base: %w", err)
	}

	buf := &bytes.Buffer{}
	zipWriter := zip.NewWriter(buf)

	// Copiar todos los archivos existentes
	for _, f := range zipReader.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		if err := addFileToZip(zipWriter, f.Name, content); err != nil {
			return nil, err
		}
	}

	// Agregar signature.sig
	if err := addFileToZip(zipWriter, "signature.sig", []byte(signature)); err != nil {
		return nil, err
	}

	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
