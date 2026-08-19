// cmd/installer/main.go — Servidor web del instalador temporal
//
// Abre una pagina web en el puerto 3001 que guia la instalacion del nodo.
// Una vez completada, genera todos los archivos y arranca docker-compose.
//
// Compilar: go build -o installer ./cmd/installer
// Uso:     ./installer  (o via Docker)

package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type InstallRequest struct {
	NodeName   string `json:"node_name"`
	NodeDomain string `json:"node_domain"`
}

type InstallResponse struct {
	Success       bool   `json:"success"`
	Message       string `json:"message"`
	NodeName      string `json:"node_name"`
	NodeDomain    string `json:"node_domain"`
	NodePublicKey string `json:"node_public_key"`
	ServerURL     string `json:"server_url"`
}

func main() {
	port := os.Getenv("INSTALLER_PORT")
	if port == "" {
		port = "3001"
	}

	http.HandleFunc("/", serveInstallerPage)
	http.HandleFunc("/api/install", handleInstall)
	http.HandleFunc("/api/check-docker", checkDocker)

	fmt.Printf("Instalador web escuchando en http://localhost:%s\n", port)
	fmt.Println("Abre esta URL en el navegador para instalar el nodo.")
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}

func checkDocker(w http.ResponseWriter, r *http.Request) {
	hasDocker := true
	if _, err := exec.LookPath("docker"); err != nil {
		hasDocker = false
	}
	compose := ""
	if _, err := exec.LookPath("docker-compose"); err == nil {
		compose = "docker-compose"
	} else {
		cmd := exec.Command("docker", "compose", "version")
		if cmd.Run() == nil {
			compose = "docker compose"
		}
	}
	writeJSON(w, 200, map[string]interface{}{
		"docker":         hasDocker,
		"docker_compose": compose,
	})
}

func handleInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeError(w, 405, "method not allowed")
		return
	}

	var req InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}

	if req.NodeName == "" || req.NodeDomain == "" {
		writeError(w, 400, "node_name y node_domain son obligatorios")
		return
	}

	// Limpiar dominio
	req.NodeDomain = strings.TrimPrefix(req.NodeDomain, "http://")
	req.NodeDomain = strings.TrimPrefix(req.NodeDomain, "https://")
	req.NodeDomain = strings.TrimSuffix(req.NodeDomain, "/")

	root, _ := os.Getwd()

	// Generar secrets
	dbPassword := generateSecureToken(24)
	jwtSecret := generateSecureToken(32)

	// Generar claves Ed25519
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		writeError(w, 500, "error generando claves")
		return
	}
	nodePublicKey := hex.EncodeToString(pubKey)
	nodePrivateKey := base64.StdEncoding.EncodeToString(privKey)

	// Escribir .env
	envContent := fmt.Sprintf(`# Generado por instalador web — no editar manualmente
# Fecha: %s
# Nodo: %s (%s)

DB_PASSWORD=%s
JWT_SECRET=%s
NODE_DOMAIN=%s
NODE_NAME=%s
`, time.Now().Format("2006-01-02 15:04:05"), req.NodeName, req.NodeDomain,
		dbPassword, jwtSecret, req.NodeDomain, req.NodeName)

	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(envContent), 0600); err != nil {
		writeError(w, 500, fmt.Sprintf("error escribiendo .env: %v", err))
		return
	}

	// Escribir config.yaml
	configContent := generateConfigYAML(req.NodeName, req.NodeDomain)
	if err := os.WriteFile(filepath.Join(root, "config.yaml"), []byte(configContent), 0644); err != nil {
		writeError(w, 500, fmt.Sprintf("error escribiendo config.yaml: %v", err))
		return
	}

	// Guardar claves
	secretsDir := filepath.Join(root, "secrets")
	os.MkdirAll(secretsDir, 0700)
	keysContent := fmt.Sprintf(`# node_keys.txt — Claves del nodo para federacion
# MANTENER SEGURO. No compartir la clave privada.
# Nodo: %s (%s)
# Generado: %s

node_public_key: %s
node_private_key: %s
`, req.NodeName, req.NodeDomain, time.Now().Format("2006-01-02 15:04:05"),
		nodePublicKey, nodePrivateKey)
	os.WriteFile(filepath.Join(secretsDir, "node_keys.txt"), []byte(keysContent), 0600)

	// Arrancar docker-compose (en background, no bloquear)
	go func() {
		compose := detectCompose()
		if compose == "" {
			return
		}
		parts := strings.Fields(compose)
		parts = append(parts, "up", "-d")
		cmd := exec.Command(parts[0], parts[1:]...)
		cmd.Dir = root
		cmd.Run()
	}()

	writeJSON(w, 200, InstallResponse{
		Success:       true,
		Message:       "Instalacion completada. El servidor esta arrancando. Abre la URL del nodo para crear el usuario admin.",
		NodeName:      req.NodeName,
		NodeDomain:    req.NodeDomain,
		NodePublicKey: nodePublicKey,
		ServerURL:     "http://localhost:8080",
	})
}

func serveInstallerPage(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.New("installer").Parse(installerHTML))
	tmpl.Execute(w, nil)
}

func detectCompose() string {
	if _, err := exec.LookPath("docker-compose"); err == nil {
		return "docker-compose"
	}
	cmd := exec.Command("docker", "compose", "version")
	if cmd.Run() == nil {
		return "docker compose"
	}
	return ""
}

func generateSecureToken(numBytes int) string {
	b := make([]byte, numBytes)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateConfigYAML(nodeName, nodeDomain string) string {
	return fmt.Sprintf(`# config.yaml — Generado por instalador web
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

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

const installerHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Instalador de Nodo Federado</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.container { background: white; border-radius: 16px; padding: 40px; max-width: 560px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
h1 { color: #2d3748; font-size: 24px; margin-bottom: 8px; text-align: center; }
.subtitle { color: #718096; text-align: center; margin-bottom: 32px; font-size: 14px; }
.form-group { margin-bottom: 20px; }
label { display: block; font-weight: 600; color: #2d3748; margin-bottom: 6px; font-size: 14px; }
input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
input:focus { outline: none; border-color: #4299e1; }
.hint { font-size: 12px; color: #a0aec0; margin-top: 4px; }
.btn { width: 100%; padding: 14px; background: #4299e1; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
.btn:hover { background: #3182ce; }
.btn:disabled { background: #a0aec0; cursor: not-allowed; }
.error { color: #e53e3e; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 14px; }
.success { color: #276749; background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 14px; }
.success h3 { margin-bottom: 8px; }
.key-box { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 8px 0; }
.key-box code { word-break: break-all; font-size: 12px; color: #2d3748; }
.key-box .label { font-size: 11px; color: #718096; text-transform: uppercase; margin-bottom: 4px; }
.steps { margin-top: 24px; padding: 16px; background: #ebf8ff; border-radius: 8px; }
.steps ol { padding-left: 20px; color: #2c5282; font-size: 13px; }
.steps li { margin-bottom: 4px; }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
  <h1>Configuracion Inicial del Nodo</h1>
  <p class="subtitle">Solo necesitas ingresar 2 datos. Todo lo demas se genera automaticamente.</p>

  <div id="error" class="error" style="display:none;"></div>
  <div id="success" class="success" style="display:none;"></div>

  <div id="form">
    <div class="form-group">
      <label>Nombre del nodo</label>
      <input type="text" id="node_name" placeholder="Banco Comunitario A" />
      <p class="hint">Nombre visible de tu organizacion</p>
    </div>
    <div class="form-group">
      <label>Dominio del nodo</label>
      <input type="text" id="node_domain" placeholder="tu-dominio.com" />
      <p class="hint">Dominio unico para federacion (no se puede cambiar despues)</p>
    </div>
    <button class="btn" id="installBtn" onclick="doInstall()">Instalar Nodo</button>
  </div>

  <div class="steps">
    <ol>
      <li>Ingresa nombre y dominio del nodo</li>
      <li>El instalador genera: passwords, claves, config</li>
      <li>Arranca la base de datos y el servidor</li>
      <li>Abre la URL del nodo para crear el usuario admin</li>
    </ol>
  </div>
</div>

<script>
async function doInstall() {
  const name = document.getElementById('node_name').value.trim();
  const domain = document.getElementById('node_domain').value.trim();
  const errEl = document.getElementById('error');
  const successEl = document.getElementById('success');
  const btn = document.getElementById('installBtn');

  errEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!name || !domain) {
    errEl.textContent = 'Nombre y dominio son obligatorios';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Instalando...';

  try {
    const res = await fetch('/api/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_name: name, node_domain: domain })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Error en la instalacion';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Instalar Nodo';
      return;
    }

    document.getElementById('form').style.display = 'none';
    successEl.innerHTML = '<h3>Instalacion completada!</h3>' +
      '<p>El servidor esta arrancando. En unos segundos abre:</p>' +
      '<p><a href="' + data.server_url + '">' + data.server_url + '</a></p>' +
      '<div class="key-box"><div class="label">Tu clave publica (para federar con otros nodos)</div><code>' + data.node_public_key + '</code></div>' +
      '<p style="margin-top:8px;">Guarda esta clave. La necesitaras para federarte con otros nodos.</p>';
    successEl.style.display = 'block';
  } catch (err) {
    errEl.textContent = 'Error de conexion: ' + err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Instalar Nodo';
  }
}
</script>
</body>
</html>`
