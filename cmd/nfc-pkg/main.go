// cmd/nfc-pkg/main.go
//
// CLI para crear, firmar, verificar e inspeccionar paquetes .nfcpkg.
//
// Uso:
//   nfc-pkg build <dir>                  — crea .nfcpkg desde un directorio
//   nfc-pkg sign <file> --key <keyfile>  — firma el paquete con Ed25519
//   nfc-pkg verify <file> --pubkey <pub> — verifica la firma
//   nfc-pkg inspect <file>               — muestra el contenido del paquete
//   nfc-pkg genkey --out <prefix>        — genera un par de claves Ed25519

package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"federated-credit-node/internal/payments/cards"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]
	args := os.Args[2:]

	switch command {
	case "build":
		cmdBuild(args)
	case "sign":
		cmdSign(args)
	case "verify":
		cmdVerify(args)
	case "inspect":
		cmdInspect(args)
	case "genkey":
		cmdGenKey(args)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Comando desconocido: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`nfc-pkg — Herramienta para paquetes .nfcpkg de drivers NFC

Uso:
  nfc-pkg build <dir>                     Crea .nfcpkg desde un directorio
  nfc-pkg sign <file> --key <keyfile>     Firma el paquete con Ed25519
  nfc-pkg verify <file> --pubkey <pub>    Verifica la firma
  nfc-pkg inspect <file>                  Muestra el contenido del paquete
  nfc-pkg genkey --out <prefix>           Genera un par de claves Ed25519

Ejemplo completo:
  nfc-pkg genkey --out mykey
  nfc-pkg build ./mi-driver/
  nfc-pkg sign mi-driver-ntag216-1.0.0.nfcpkg --key mykey.key
  nfc-pkg verify mi-driver-ntag216-1.0.0.nfcpkg --pubkey mykey.pub
  nfc-pkg inspect mi-driver-ntag216-1.0.0.nfcpkg`)
}

func cmdBuild(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Error: directorio requerido")
		fmt.Fprintln(os.Stderr, "Uso: nfc-pkg build <dir>")
		os.Exit(1)
	}
	dir := args[0]

	// Leer archivos del directorio
	manifestData, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo manifest.json: %v\n", err)
		os.Exit(1)
	}

	var manifest cards.PackageManifest
	if err := json.Unmarshal(manifestData, &manifest); err != nil {
		fmt.Fprintf(os.Stderr, "Error parseando manifest.json: %v\n", err)
		os.Exit(1)
	}

	driverJS, err := os.ReadFile(filepath.Join(dir, "driver.js"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo driver.js: %v\n", err)
		os.Exit(1)
	}

	readerJSON, err := os.ReadFile(filepath.Join(dir, "reader.json"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo reader.json: %v\n", err)
		os.Exit(1)
	}

	migrationSQL := ""
	if data, err := os.ReadFile(filepath.Join(dir, "migration.sql")); err == nil {
		migrationSQL = string(data)
	}

	protocolDoc := ""
	if data, err := os.ReadFile(filepath.Join(dir, "protocol.md")); err == nil {
		protocolDoc = string(data)
	}

	iconSVG := ""
	if data, err := os.ReadFile(filepath.Join(dir, "icon.svg")); err == nil {
		iconSVG = string(data)
	}

	// Validar driver.js
	if err := cards.ValidateDriverSource(string(driverJS)); err != nil {
		fmt.Fprintf(os.Stderr, "Error: driver.js invalido: %v\n", err)
		os.Exit(1)
	}

	// Crear el paquete
	pkgData, err := cards.BuildPackage(string(manifestData), string(driverJS), string(readerJSON), migrationSQL, protocolDoc, iconSVG)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creando paquete: %v\n", err)
		os.Exit(1)
	}

	// Nombre del archivo de salida
	filename := fmt.Sprintf("%s-%s.nfcpkg", manifest.Type, manifest.DriverVersion)
	outputPath := filename
	if len(args) >= 2 {
		outputPath = args[1]
	}

	if err := os.WriteFile(outputPath, pkgData, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error escribiendo %s: %v\n", outputPath, err)
		os.Exit(1)
	}

	fmt.Printf("Paquete creado: %s (%d bytes)\n", outputPath, len(pkgData))
	fmt.Printf("  Tipo:    %s\n", manifest.Type)
	fmt.Printf("  Version: %s\n", manifest.DriverVersion)
	fmt.Printf("  Nombre:  %s\n", manifest.DisplayName)
	fmt.Println()
	fmt.Println("NOTA: El paquete no esta firmado. Usa 'nfc-pkg sign' para firmarlo.")
}

func cmdSign(args []string) {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	keyFile := fs.String("key", "", "Archivo con la clave privada Ed25519 (hex)")
	if err := fs.Parse(args); err != nil {
		os.Exit(1)
	}

	if fs.NArg() < 1 || *keyFile == "" {
		fmt.Fprintln(os.Stderr, "Uso: nfc-pkg sign <file.nfcpkg> --key <keyfile>")
		os.Exit(1)
	}

	pkgFile := fs.Arg(0)

	// Leer clave privada
	keyHex, err := os.ReadFile(*keyFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo clave: %v\n", err)
		os.Exit(1)
	}

	privKey, err := hex.DecodeString(strings.TrimSpace(string(keyHex)))
	if err != nil || len(privKey) != ed25519.PrivateKeySize {
		fmt.Fprintf(os.Stderr, "Clave privada invalida (debe ser hex de 128 chars)\n")
		os.Exit(1)
	}

	// Leer paquete
	pkgData, err := os.ReadFile(pkgFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo paquete: %v\n", err)
		os.Exit(1)
	}

	// Parsear paquete
	pkg, err := cards.ParsePackage(pkgData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parseando paquete: %v\n", err)
		os.Exit(1)
	}

	// Firmar
	sigData := pkg.ComputeSignatureData()
	signature := cards.SignPackage(ed25519.PrivateKey(privKey), sigData)

	// Reconstruir paquete con firma
	signedData, err := cards.BuildPackageWithSignature(
		stringifyManifest(pkg.Manifest), pkg.DriverJS, pkg.ReaderJSON,
		pkg.MigrationSQL, pkg.ProtocolDoc, pkg.IconSVG, signature)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error firmando paquete: %v\n", err)
		os.Exit(1)
	}

	// Sobreescribir el archivo
	if err := os.WriteFile(pkgFile, signedData, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error escribiendo paquete firmado: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Paquete firmado: %s\n", pkgFile)
	fmt.Printf("  Firma: %s...\n", signature[:32])
}

func cmdVerify(args []string) {
	fs := flag.NewFlagSet("verify", flag.ExitOnError)
	pubKeyFile := fs.String("pubkey", "", "Archivo con la clave publica Ed25519 (hex)")
	if err := fs.Parse(args); err != nil {
		os.Exit(1)
	}

	if fs.NArg() < 1 || *pubKeyFile == "" {
		fmt.Fprintln(os.Stderr, "Uso: nfc-pkg verify <file.nfcpkg> --pubkey <pubfile>")
		os.Exit(1)
	}

	pkgFile := fs.Arg(0)

	// Leer clave publica
	pubHex, err := os.ReadFile(*pubKeyFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo clave publica: %v\n", err)
		os.Exit(1)
	}

	// Leer paquete
	pkgData, err := os.ReadFile(pkgFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo paquete: %v\n", err)
		os.Exit(1)
	}

	// Parsear paquete
	pkg, err := cards.ParsePackage(pkgData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parseando paquete: %v\n", err)
		os.Exit(1)
	}

	if pkg.Signature == "" {
		fmt.Fprintln(os.Stderr, "Error: paquete no tiene firma")
		os.Exit(1)
	}

	// Verificar
	sigData := pkg.ComputeSignatureData()
	valid := cards.VerifySignature(strings.TrimSpace(string(pubHex)), pkg.Signature, sigData)

	if valid {
		fmt.Printf("Firma VALIDA ✓\n")
		fmt.Printf("  Tipo:    %s\n", pkg.Manifest.Type)
		fmt.Printf("  Version: %s\n", pkg.Manifest.DriverVersion)
	} else {
		fmt.Printf("Firma INVALIDA ✗\n")
		os.Exit(1)
	}
}

func cmdInspect(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Uso: nfc-pkg inspect <file.nfcpkg>")
		os.Exit(1)
	}

	pkgFile := args[0]

	pkgData, err := os.ReadFile(pkgFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error leyendo paquete: %v\n", err)
		os.Exit(1)
	}

	pkg, err := cards.ParsePackage(pkgData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parseando paquete: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== Contenido del paquete .nfcpkg ===")
	fmt.Printf("Archivo: %s (%d bytes)\n", pkgFile, len(pkgData))
	fmt.Printf("Hash:    %s\n", pkg.PackageHash[:32]+"...")
	fmt.Println()
	fmt.Println("--- Manifest ---")
	fmt.Printf("Tipo:          %s\n", pkg.Manifest.Type)
	fmt.Printf("Display name:  %s\n", pkg.Manifest.DisplayName)
	fmt.Printf("Version:       %s\n", pkg.Manifest.DriverVersion)
	fmt.Printf("Descripcion:   %s\n", pkg.Manifest.Description)
	fmt.Printf("Fabricante:    %s\n", pkg.Manifest.Manufacturer)
	fmt.Printf("Capacidad:     %s\n", pkg.Manifest.Capacity)
	fmt.Println()
	fmt.Println("--- Memoria ---")
	fmt.Printf("Total bytes:   %d\n", pkg.Manifest.Memory.TotalBytes)
	fmt.Printf("User bytes:    %d\n", pkg.Manifest.Memory.UserBytes)
	fmt.Printf("Page size:     %d\n", pkg.Manifest.Memory.PageSize)
	fmt.Printf("Total pages:   %d\n", pkg.Manifest.Memory.TotalPages)
	fmt.Println()
	fmt.Println("--- Seguridad ---")
	fmt.Printf("Nivel:         %s\n", pkg.Manifest.Security.Level)
	fmt.Printf("Algoritmo:     %s\n", pkg.Manifest.Security.Algorithm)
	fmt.Printf("Key bits:      %d\n", pkg.Manifest.Security.KeyLengthBits)
	fmt.Println()
	fmt.Println("--- Protocolo ---")
	fmt.Printf("Slots:         %d (%d activos + %d backups)\n",
		pkg.Manifest.Protocol.Slots, pkg.Manifest.Protocol.ActiveSlots, pkg.Manifest.Protocol.BackupSlots)
	fmt.Printf("Cert size:     %d bytes\n", pkg.Manifest.Protocol.CertificateSize)
	fmt.Printf("Auth method:   %s\n", pkg.Manifest.Protocol.AuthMethod)
	fmt.Println()
	fmt.Println("--- Compatibilidad ---")
	fmt.Printf("Android:       %s\n", pkg.Manifest.Compatibility.Android)
	fmt.Printf("iOS:           %s\n", pkg.Manifest.Compatibility.IOS)
	fmt.Printf("ESP32:         %s\n", pkg.Manifest.Compatibility.ESP32PN532)
	fmt.Println()
	fmt.Println("--- Archivos ---")
	fmt.Printf("driver.js:     %d bytes\n", len(pkg.DriverJS))
	fmt.Printf("reader.json:   %d bytes\n", len(pkg.ReaderJSON))
	if pkg.MigrationSQL != "" {
		fmt.Printf("migration.sql: %d bytes\n", len(pkg.MigrationSQL))
	}
	if pkg.ProtocolDoc != "" {
		fmt.Printf("protocol.md:   %d bytes\n", len(pkg.ProtocolDoc))
	}
	if pkg.IconSVG != "" {
		fmt.Printf("icon.svg:      %d bytes\n", len(pkg.IconSVG))
	}
	fmt.Println()
	fmt.Println("--- Firma ---")
	if pkg.Signature != "" {
		fmt.Printf("Firma:         %s...\n", pkg.Signature[:32])
		fmt.Println("Estado:        FIRMADO")
	} else {
		fmt.Println("Estado:        SIN FIRMAR")
	}
}

func cmdGenKey(args []string) {
	fs := flag.NewFlagSet("genkey", flag.ExitOnError)
	outPrefix := fs.String("out", "nfc-key", "Prefijo para los archivos de clave")
	if err := fs.Parse(args); err != nil {
		os.Exit(1)
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generando claves: %v\n", err)
		os.Exit(1)
	}

	pubFile := *outPrefix + ".pub"
	keyFile := *outPrefix + ".key"

	pubHex := hex.EncodeToString(pub)
	privHex := hex.EncodeToString(priv)

	if err := os.WriteFile(pubFile, []byte(pubHex), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error escribiendo clave publica: %v\n", err)
		os.Exit(1)
	}
	if err := os.WriteFile(keyFile, []byte(privHex), 0600); err != nil {
		fmt.Fprintf(os.Stderr, "Error escribiendo clave privada: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Par de claves Ed25519 generado:\n")
	fmt.Printf("  Publica:  %s (%s)\n", pubFile, pubHex[:32]+"...")
	fmt.Printf("  Privada:  %s (%s)\n", keyFile, privHex[:32]+"...")
	fmt.Println()
	fmt.Println("IMPORTANTE: Guarda el archivo .key en un lugar seguro.")
	fmt.Println("            NO lo subas al repositorio ni lo compartas.")
	fmt.Println("            El archivo .pub se puede compartir libremente.")
}

func stringifyManifest(m cards.PackageManifest) string {
	b, _ := json.MarshalIndent(m, "", "  ")
	return string(b)
}
