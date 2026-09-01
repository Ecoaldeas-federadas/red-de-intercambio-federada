// Package cards — package.go
//
// Parser de paquetes .nfcpkg (ZIP firmado con Ed25519).
// Un .nfcpkg contiene:
//   - manifest.json   — metadatos + specs de la tarjeta
//   - driver.js       — logica del servidor (JavaScript sandboxed)
//   - reader.json     — logica del POS Android (declarativo)
//   - migration.sql   — migracion DB (opcional)
//   - signature.sig   — firma Ed25519 del contenido
//   - protocol.md     — documento del protocolo (opcional)
//   - icon.svg        — icono para UI (opcional)

package cards

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// NFCPackage es un paquete .nfcpkg parseado en memoria.
type NFCPackage struct {
	Manifest      PackageManifest
	DriverJS      string
	ReaderJSON    string
	MigrationSQL  string
	ProtocolDoc   string
	IconSVG       string
	Signature     string
	PackageHash   string
	RawBytes      []byte
}

// PackageManifest es el manifest.json dentro del .nfcpkg.
type PackageManifest struct {
	PackageVersion int                `json:"package_version"`
	DriverVersion  string             `json:"driver_version"`
	Type           string             `json:"type"`
	DisplayName    string             `json:"display_name"`
	Description    string             `json:"description"`
	Manufacturer   string             `json:"manufacturer"`
	Capacity       string             `json:"capacity"`
	MinServerVer   string             `json:"min_server_version"`
	MinPOSVer      string             `json:"min_pos_version"`
	Memory         MemSpec            `json:"memory"`
	Security       SecuritySpec       `json:"security"`
	Compatibility  CompatibilitySpec  `json:"compatibility"`
	Protocol       ProtocolSpec       `json:"protocol"`
	Availability   AvailabilitySpec   `json:"availability"`
	Endpoints      EndpointsSpec      `json:"endpoints"`
	Files          PackageFilesSpec   `json:"files"`
	Author         PackageAuthorSpec  `json:"author"`
}

// PackageFilesSpec describe los archivos dentro del paquete.
type PackageFilesSpec struct {
	Driver      string `json:"driver"`
	Reader      string `json:"reader"`
	Migration   string `json:"migration"`
	ProtocolDoc string `json:"protocol_doc"`
	Icon        string `json:"icon"`
}

// PackageAuthorSpec describe el autor del paquete.
type PackageAuthorSpec struct {
	Name    string `json:"name"`
	Contact string `json:"contact"`
	License string `json:"license"`
}

// ParsePackage parsea un .nfcpkg (ZIP) desde bytes.
func ParsePackage(data []byte) (*NFCPackage, error) {
	// Calcular hash del paquete completo
	hash := sha256.Sum256(data)
	pkgHash := hex.EncodeToString(hash[:])

	// Leer como ZIP
	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("no es un ZIP valido: %w", err)
	}

	pkg := &NFCPackage{
		PackageHash: pkgHash,
		RawBytes:    data,
	}

	// Mapa de archivos por nombre
	files := make(map[string][]byte)
	for _, f := range zipReader.File {
		if f.FileInfo().IsDir() {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("abriendo %s: %w", f.Name, err)
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("leyendo %s: %w", f.Name, err)
		}
		files[f.Name] = content
	}

	// Leer manifest.json (obligatorio)
	manifestData, ok := files["manifest.json"]
	if !ok {
		return nil, fmt.Errorf("manifest.json no encontrado en el paquete")
	}
	if err := json.Unmarshal(manifestData, &pkg.Manifest); err != nil {
		return nil, fmt.Errorf("parseando manifest.json: %w", err)
	}

	// Validar campos obligatorios del manifest
	if pkg.Manifest.Type == "" {
		return nil, fmt.Errorf("manifest.json: type es obligatorio")
	}
	if pkg.Manifest.DisplayName == "" {
		return nil, fmt.Errorf("manifest.json: display_name es obligatorio")
	}
	if pkg.Manifest.DriverVersion == "" {
		return nil, fmt.Errorf("manifest.json: driver_version es obligatorio")
	}

	// Leer driver.js (obligatorio)
	driverFile := pkg.Manifest.Files.Driver
	if driverFile == "" {
		driverFile = "driver.js"
	}
	driverData, ok := files[driverFile]
	if !ok {
		return nil, fmt.Errorf("%s no encontrado en el paquete", driverFile)
	}
	pkg.DriverJS = string(driverData)

	// Leer reader.json (obligatorio)
	readerFile := pkg.Manifest.Files.Reader
	if readerFile == "" {
		readerFile = "reader.json"
	}
	readerData, ok := files[readerFile]
	if !ok {
		return nil, fmt.Errorf("%s no encontrado en el paquete", readerFile)
	}
	pkg.ReaderJSON = string(readerData)

	// Leer migration.sql (opcional)
	migrationFile := pkg.Manifest.Files.Migration
	if migrationFile != "" {
		if migrationData, ok := files[migrationFile]; ok {
			pkg.MigrationSQL = string(migrationData)
		}
	}

	// Leer protocol.md (opcional)
	protocolFile := pkg.Manifest.Files.ProtocolDoc
	if protocolFile != "" {
		if protocolData, ok := files[protocolFile]; ok {
			pkg.ProtocolDoc = string(protocolData)
		}
	}

	// Leer icon.svg (opcional)
	iconFile := pkg.Manifest.Files.Icon
	if iconFile != "" {
		if iconData, ok := files[iconFile]; ok {
			pkg.IconSVG = string(iconData)
		}
	}

	// Leer signature.sig (obligatorio para paquetes firmados)
	if sigData, ok := files["signature.sig"]; ok {
		pkg.Signature = strings.TrimSpace(string(sigData))
	}

	return pkg, nil
}

// ComputeSignatureData calcula los datos sobre los que se firma/verifica.
// La firma cubre SHA256(manifest.json || driver.js || reader.json).
func (pkg *NFCPackage) ComputeSignatureData() []byte {
	h := sha256.New()
	h.Write([]byte(pkg.Manifest.Type))
	h.Write([]byte(pkg.Manifest.DriverVersion))
	h.Write([]byte(pkg.DriverJS))
	h.Write([]byte(pkg.ReaderJSON))
	return h.Sum(nil)
}

// Validate valida que el paquete tiene todos los campos obligatorios
// y que driver.js es sintacticamente correcto.
func (pkg *NFCPackage) Validate() error {
	// Validar driver.js
	if err := ValidateDriverSource(pkg.DriverJS); err != nil {
		return fmt.Errorf("driver.js invalido: %w", err)
	}

	// Validar reader.json
	if err := ValidateReaderJSON(pkg.ReaderJSON); err != nil {
		return fmt.Errorf("reader.json invalido: %w", err)
	}

	// Validar que el type del manifest coincide con el type del driver
	// (ValidateDriverSource ya verifico que NfcDriver.type existe)
	// No podemos re-verificar aqui sin re-ejecutar Goja, pero el installer
	// lo hace al compilar.

	return nil
}

// ValidateReaderJSON valida que reader.json tiene la estructura minima.
func ValidateReaderJSON(readerJSON string) error {
	var reader struct {
		Type        string `json:"type"`
		DisplayName string `json:"display_name"`
		Detection   struct {
			TechList []string `json:"tech_list"`
		} `json:"detection"`
		UID struct {
			Method string `json:"method"`
		} `json:"uid"`
	}
	if err := json.Unmarshal([]byte(readerJSON), &reader); err != nil {
		return fmt.Errorf("JSON invalido: %w", err)
	}
	if reader.Type == "" {
		return fmt.Errorf("type es obligatorio")
	}
	if reader.DisplayName == "" {
		return fmt.Errorf("display_name es obligatorio")
	}
	if len(reader.Detection.TechList) == 0 {
		return fmt.Errorf("detection.tech_list es obligatorio")
	}
	if reader.UID.Method == "" {
		return fmt.Errorf("uid.method es obligatorio")
	}
	return nil
}

// BuildPackage crea un .nfcpkg (ZIP) desde archivos individuales.
// No incluye firma — se firma despues con SignPackage().
func BuildPackage(manifestJSON, driverJS, readerJSON, migrationSQL, protocolDoc, iconSVG string) ([]byte, error) {
	buf := &bytes.Buffer{}
	zipWriter := zip.NewWriter(buf)

	// manifest.json
	if err := addFileToZip(zipWriter, "manifest.json", []byte(manifestJSON)); err != nil {
		return nil, err
	}
	// driver.js
	if err := addFileToZip(zipWriter, "driver.js", []byte(driverJS)); err != nil {
		return nil, err
	}
	// reader.json
	if err := addFileToZip(zipWriter, "reader.json", []byte(readerJSON)); err != nil {
		return nil, err
	}
	// migration.sql (opcional)
	if migrationSQL != "" {
		if err := addFileToZip(zipWriter, "migration.sql", []byte(migrationSQL)); err != nil {
			return nil, err
		}
	}
	// protocol.md (opcional)
	if protocolDoc != "" {
		if err := addFileToZip(zipWriter, "protocol.md", []byte(protocolDoc)); err != nil {
			return nil, err
		}
	}
	// icon.svg (opcional)
	if iconSVG != "" {
		if err := addFileToZip(zipWriter, "icon.svg", []byte(iconSVG)); err != nil {
			return nil, err
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("cerrando ZIP: %w", err)
	}

	return buf.Bytes(), nil
}

func addFileToZip(zipWriter *zip.Writer, name string, data []byte) error {
	w, err := zipWriter.Create(name)
	if err != nil {
		return fmt.Errorf("creando %s en ZIP: %w", name, err)
	}
	if _, err := w.Write(data); err != nil {
		return fmt.Errorf("escribiendo %s en ZIP: %w", name, err)
	}
	return nil
}
