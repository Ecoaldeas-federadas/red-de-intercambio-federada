// cmd/install/main.go — Instalador interactivo del nodo federado
//
// Compilar:
//   go build -o install ./cmd/install
//
// Uso:
//   ./install              # interactivo
//   ./install --name "Banco A" --domain mi-nodo.com  # no interactivo
//
// El instalador:
//   1. Verifica Docker
//   2. Pregunta nombre y dominio del nodo (unicos campos obligatorios)
//   3. Genera: DB password, JWT secret, claves Ed25519 del nodo, config.yaml, .env
//   4. Arranca docker-compose
//   5. Abre el navegador en la pagina de setup

package main

import (
	"bufio"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Colores
const (
	cyan    = "\033[0;36m"
	green   = "\033[0;32m"
	red     = "\033[0;31m"
	yellow  = "\033[1;33m"
	magenta = "\033[0;35m"
	white   = "\033[1;37m"
	gray    = "\033[0;90m"
	nc      = "\033[0m"
)

func step(msg string) { fmt.Printf("%s[*]%s %s\n", cyan, nc, msg) }
func ok(msg string)   { fmt.Printf("%s[OK]%s %s\n", green, nc, msg) }
func errExit(msg string) {
	fmt.Printf("%s[ERROR]%s %s\n", red, nc, msg)
	os.Exit(1)
}
func warn(msg string) { fmt.Printf("%s[!]%s %s\n", yellow, nc, msg) }

func main() {
	// Flags para modo no-interactivo
	var nodeName, nodeDomain string
	flag.StringVar(&nodeName, "name", "", "Nombre del nodo")
	flag.StringVar(&nodeDomain, "domain", "", "Dominio del nodo")
	flag.Parse()

	fmt.Println()
	fmt.Printf("%s========================================%s\n", magenta, nc)
	fmt.Printf("%s  Instalador de Nodo Federado%s\n", magenta, nc)
	fmt.Printf("%s  Red de Intercambio Comunitaria%s\n", magenta, nc)
	fmt.Printf("%s========================================%s\n", magenta, nc)
	fmt.Println()

	root, _ := os.Getwd()

	// 1. Verificar Docker
	step("Verificando Docker...")
	if _, err := exec.LookPath("docker"); err != nil {
		errExit("Docker no esta instalado. Instala Docker desde https://docker.com")
	}
	composeCmd := detectCompose()
	if composeCmd == "" {
		errExit("Docker Compose no esta instalado.")
	}
	ok(fmt.Sprintf("Docker encontrado (%s)", composeCmd))

	// 2. Preguntar datos
	reader := bufio.NewReader(os.Stdin)
	if nodeName == "" {
		fmt.Println()
		fmt.Printf("%sConfiguracion del nodo:%s\n", white, nc)
		fmt.Printf("%sSolo necesitas ingresar 2 datos. Todo lo demas se genera automaticamente.%s\n", gray, nc)
		fmt.Println()

		for {
			fmt.Printf("Nombre del nodo (ej: Banco Comunitario A): ")
			nodeName, _ = reader.ReadString('\n')
			nodeName = strings.TrimSpace(nodeName)
			if nodeName != "" {
				break
			}
			fmt.Println("El nombre es obligatorio")
		}
	}

	if nodeDomain == "" {
		for {
			fmt.Printf("Dominio del nodo (ej: mi-nodo.com): ")
			nodeDomain, _ = reader.ReadString('\n')
			nodeDomain = strings.TrimSpace(nodeDomain)
			if nodeDomain != "" {
				break
			}
			fmt.Println("El dominio es obligatorio")
		}
	}

	// Limpiar dominio
	nodeDomain = strings.TrimPrefix(nodeDomain, "http://")
	nodeDomain = strings.TrimPrefix(nodeDomain, "https://")
	nodeDomain = strings.TrimSuffix(nodeDomain, "/")

	fmt.Println()
	step("Generando configuracion segura...")

	// 3. Generar secrets
	dbPassword := generateSecureToken(24)
	jwtSecret := generateSecureToken(32)

	// 4. Generar claves Ed25519
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		errExit("Error generando claves Ed25519")
	}
	nodePublicKey := hex.EncodeToString(pubKey)
	nodePrivateKey := base64.StdEncoding.EncodeToString(privKey)
	ok("Claves Ed25519 del nodo generadas")

	// 5. Generar .env
	envContent := fmt.Sprintf(`# Generado automaticamente por install — no editar manualmente
# Fecha: %s
# Nodo: %s (%s)

DB_PASSWORD=%s
JWT_SECRET=%s
NODE_DOMAIN=%s
NODE_NAME=%s
`, time.Now().Format("2006-01-02 15:04:05"), nodeName, nodeDomain,
		dbPassword, jwtSecret, nodeDomain, nodeName)

	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(envContent), 0600); err != nil {
		errExit(fmt.Sprintf("Error escribiendo .env: %v", err))
	}
	ok("Archivo .env generado (con passwords y secrets aleatorios)")

	// 6. Generar config.yaml
	configContent := generateConfigYAML(nodeName, nodeDomain)
	if err := os.WriteFile(filepath.Join(root, "config.yaml"), []byte(configContent), 0644); err != nil {
		errExit(fmt.Sprintf("Error escribiendo config.yaml: %v", err))
	}
	ok("config.yaml generado")

	// 7. Guardar claves
	secretsDir := filepath.Join(root, "secrets")
	os.MkdirAll(secretsDir, 0700)
	keysContent := fmt.Sprintf(`# node_keys.txt — Claves del nodo para federacion
# MANTENER SEGURO. No compartir la clave privada.
# Nodo: %s (%s)
# Generado: %s

# CLAVE PUBLICA (compartir con otros nodos para federarse)
# Para federar dos nodos, cada uno debe registrar la clave publica del otro.
node_public_key: %s

# CLAVE PRIVADA (NO compartir, mantener segura)
node_private_key: %s
`, nodeName, nodeDomain, time.Now().Format("2006-01-02 15:04:05"), nodePublicKey, nodePrivateKey)

	if err := os.WriteFile(filepath.Join(secretsDir, "node_keys.txt"), []byte(keysContent), 0600); err != nil {
		warn(fmt.Sprintf("Error guardando claves: %v", err))
	} else {
		ok("Claves del nodo guardadas en secrets/node_keys.txt")
	}

	// 8. Construir y arrancar
	fmt.Println()
	step("Construyendo imagenes Docker (puede tardar varios minutos la primera vez)...")
	if err := runCompose(composeCmd, "build"); err != nil {
		errExit(fmt.Sprintf("Error construyendo imagenes: %v", err))
	}
	ok("Imagenes construidas")

	step("Arrancando servicios...")
	if err := runCompose(composeCmd, "up", "-d"); err != nil {
		errExit(fmt.Sprintf("Error arrancando servicios: %v", err))
	}
	ok("Servicios arrancados")

	// 9. Esperar al servidor
	step("Esperando a que el servidor este listo...")
	serverURL := "http://localhost:8080"
	maxWait := 60
	waited := 0
	for waited < maxWait {
		if checkServer(serverURL) {
			break
		}
		time.Sleep(2 * time.Second)
		waited += 2
		fmt.Printf("%s.%s", gray, nc)
	}
	fmt.Println()

	if waited >= maxWait {
		warn(fmt.Sprintf("El servidor no respondio en %d segundos.", maxWait))
		warn(fmt.Sprintf("Revisa con: %s logs", composeCmd))
	} else {
		ok("Servidor listo!")
	}

	// 10. Resumen
	fmt.Println()
	fmt.Printf("%s========================================%s\n", green, nc)
	fmt.Printf("%s  INSTALACION COMPLETADA%s\n", green, nc)
	fmt.Printf("%s========================================%s\n", green, nc)
	fmt.Println()
	fmt.Printf("%sNodo:%s %s\n", white, nc, nodeName)
	fmt.Printf("%sDominio:%s %s\n", white, nc, nodeDomain)
	fmt.Println()
	fmt.Printf("%sURL del nodo: %s%s\n", cyan, serverURL, nc)
	fmt.Println()
	fmt.Printf("%sPROXIMO PASO:%s\n", yellow, nc)
	fmt.Printf("%s  Abre el navegador en: %s%s\n", white, serverURL, nc)
	fmt.Printf("%s  Crea el usuario administrador en la pagina de setup.%s\n", white, nc)
	fmt.Println()
	fmt.Printf("%sCLAVES DE FEDERACION:%s\n", yellow, nc)
	fmt.Printf("%s  Tu clave publica (para registrar en otros nodos):%s\n", white, nc)
	fmt.Printf("%s  %s%s\n", gray, nodePublicKey, nc)
	fmt.Printf("%s  Guardada en: secrets/node_keys.txt%s\n", gray, nc)
	fmt.Println()
	fmt.Printf("%sCOMANDOS UTILES:%s\n", yellow, nc)
	fmt.Printf("%s  Ver logs:     %s logs -f%s\n", gray, composeCmd, nc)
	fmt.Printf("%s  Detener:      %s down%s\n", gray, composeCmd, nc)
	fmt.Printf("%s  Reiniciar:    %s restart%s\n", gray, composeCmd, nc)
	fmt.Println()

	// Abrir navegador
	openBrowser(serverURL)
	fmt.Printf("%sAbriendo navegador...%s\n", cyan, nc)
}

func detectCompose() string {
	if _, err := exec.LookPath("docker-compose"); err == nil {
		return "docker-compose"
	}
	// Probar docker compose v2
	cmd := exec.Command("docker", "compose", "version")
	if err := cmd.Run(); err == nil {
		return "docker compose"
	}
	return ""
}

func runCompose(composeCmd string, args ...string) error {
	parts := strings.Fields(composeCmd)
	parts = append(parts, args...)
	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func generateSecureToken(numBytes int) string {
	b := make([]byte, numBytes)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateConfigYAML(nodeName, nodeDomain string) string {
	return fmt.Sprintf(`# config.yaml — Generado por install
# NO EDITAR MANUALMENTE. Usa la pagina de ajustes del nodo.
# Fecha: %s

node:
  domain: "%s"
  name: "%s"

database:
  host: "yugabytedb"
  port: 5433
  name: "fmc_node"
  user: "fmc"
  password: ""
  ssl_mode: "disable"

api:
  port: 8080
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:8080"
    - "http://%s"

federation:
  listen_port: 8443
  mtls_required: true
  known_nodes: []
  gossip_interval: "60s"
  balance_sync_enabled: true

limits:
  node_multilateral_negative: -10000000
  node_multilateral_positive: 10000000
  default_individual_negative: -50000
  default_individual_positive: 50000
  default_organization_negative: -5000000
  default_organization_positive: 5000000

taxes:
  individual:
    rate: 0.0
    enabled: false
  organization:
    default_rate: 0.05
    by_type:
      commerce: 0.05
      services: 0.03
      public_service: 0.0
      cooperative: 0.02

fund:
  account_username: "fund"
  multisig_required: 3
  multisig_authorizers: []
`, time.Now().Format("2006-01-02 15:04:05"), nodeDomain, nodeName, nodeDomain)
}

func checkServer(url string) bool {
	cmd := exec.Command("curl", "-s", "-o", "/dev/null", url+"/api/setup/status")
	return cmd.Run() == nil
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "windows":
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		exec.Command("open", url).Start()
	default:
		exec.Command("xdg-open", url).Start()
	}
}
