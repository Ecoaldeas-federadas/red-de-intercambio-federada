# install.ps1 - Instalador del nodo de red de intercambio federada
#
# Uso:
#   .\install.ps1
#
# El instalador:
#   1. Verifica que Docker este instalado
#   2. Pregunta nombre del nodo y dominio (unicos campos obligatorios)
#   3. Genera automaticamente:
#      - Password seguro de la base de datos
#      - JWT secret aleatorio
#      - Claves Ed25519 del nodo (para federacion)
#      - config.yaml con todos los defaults
#   4. Arranca la base de datos y el servidor con docker-compose
#   5. Abre el navegador en la pagina de setup para crear el usuario admin
#
# No necesitas editar ningun archivo manualmente.

$ErrorActionPreference = "Stop"

# Colores
function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }

$ROOT = $PSScriptRoot
Set-Location $ROOT

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Instalador de Nodo Federado" -ForegroundColor Magenta
Write-Host "  Red de Intercambio Comunitaria" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# 1. Verificar Docker
Write-Step "Verificando Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker no esta instalado. Instala Docker Desktop desde https://docker.com"
    exit 1
}
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue) -and -not (Get-Command "docker compose" -ErrorAction SilentlyContinue)) {
    Write-Err "docker-compose no esta instalado. Instala Docker Compose."
    exit 1
}
Write-OK "Docker encontrado"

# 2. Preguntar datos del nodo
Write-Host ""
Write-Host "Configuracion del nodo:" -ForegroundColor White
Write-Host "Solo necesitas ingresar 2 datos. Todo lo demas se genera automaticamente." -ForegroundColor Gray
Write-Host ""
Write-Host "Si estas probando en desarrollo y no tienes un dominio real," -ForegroundColor Gray
Write-Host "puedes usar cualquier nombre como identificador (ej: localhost, mi-nodo, nodo-local)." -ForegroundColor Gray
Write-Host "El dominio es un identificador interno - no necesita resolver DNS." -ForegroundColor Gray
Write-Host ""

do {
    $nodeName = Read-Host "Nombre del nodo (ej: Banco Comunitario A)"
} while ([string]::IsNullOrWhiteSpace($nodeName))

do {
    $nodeDomain = Read-Host "Dominio del nodo (ej: nodo-a.org o localhost para desarrollo)"
} while ([string]::IsNullOrWhiteSpace($nodeDomain))

# Validar dominio (sin http://, sin https://, sin barras)
if ($nodeDomain -match "https?://") {
    Write-Warn "El dominio no debe incluir http:// o https://. Quitando el prefijo..."
    $nodeDomain = $nodeDomain -replace "https?://", ""
}
$nodeDomain = $nodeDomain.TrimEnd("/")

Write-Host ""
Write-Step "Generando configuracion segura..."

# 3. Generar secrets aleatorios
function New-SecureToken($numBytes = 32) {
    $bytes = New-Object byte[] $numBytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

$dbPassword = New-SecureToken 24
$jwtSecret = New-SecureToken 32

# 4. Generar claves Ed25519 del nodo
# Usamos Go (mas confiable en Windows) o openssl como fallback
$nodePublicKey = ""
$nodePrivateKey = ""

# Metodo 1: Go (preferido - el proyecto requiere Go de todas formas)
if (Get-Command go -ErrorAction SilentlyContinue) {
    $goScript = @'
package main
import (
    "crypto/ed25519"
    "crypto/rand"
    "encoding/hex"
    "encoding/base64"
    "fmt"
)
func main() {
    pub, priv, _ := ed25519.GenerateKey(rand.Reader)
    fmt.Println(hex.EncodeToString(pub))
    fmt.Println(base64.StdEncoding.EncodeToString(priv))
}
'@
    $goFile = Join-Path $env:TEMP "genkey_$([guid]::NewGuid()).go"
    $goScript | Out-File -FilePath $goFile -Encoding utf8
    $output = go run $goFile 2>&1
    $lines = $output -split "`n"
    if ($lines.Count -ge 2 -and $lines[0].Length -eq 64) {
        $nodePublicKey = $lines[0].Trim()
        $nodePrivateKey = $lines[1].Trim()
    }
    Remove-Item $goFile -Force -ErrorAction SilentlyContinue
}

# Metodo 2: openssl (fallback)
if ([string]::IsNullOrWhiteSpace($nodePublicKey) -and (Get-Command openssl -ErrorAction SilentlyContinue)) {
    $keyFile = Join-Path $env:TEMP "node_key_$([guid]::NewGuid())"
    $pubFile = Join-Path $env:TEMP "node_pub_$([guid]::NewGuid())"

    openssl genpkey -algorithm Ed25519 -out $keyFile 2>$null
    openssl pkey -in $keyFile -pubout -out $pubFile 2>$null

    # Extraer la clave publica en formato raw (32 bytes hex)
    # Usar -pubin para indicar que es una clave publica
    $pubDer = openssl pkey -pubin -in $pubFile -outform DER 2>$null
    if ($pubDer) {
        $pubBytes = [System.IO.File]::ReadAllBytes($pubFile)
        # El formato PEM tiene la clave base64. Decodificar el DER.
        # Para Ed25519 SubjectPublicKeyInfo: 44 bytes DER, ultimos 32 son la key
        $derBytes = openssl pkey -pubin -in $pubFile -outform DER 2>$null
        if ($derBytes -is [byte[]] -and $derBytes.Length -ge 32) {
            $rawPub = $derBytes[($derBytes.Length - 32)..($derBytes.Length - 1)]
            $nodePublicKey = [BitConverter]::ToString($rawPub).Replace("-", "").ToLower()
        }
    }

    $nodePrivateKey = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keyFile))
    Remove-Item $keyFile, $pubFile -Force -ErrorAction SilentlyContinue
}

if ([string]::IsNullOrWhiteSpace($nodePublicKey)) {
    Write-Warn "No se pudieron generar claves Ed25519 (instala openssl o Go). Las claves se generaran en el primer arranque del servidor."
    $nodePublicKey = "PENDIENTE"
    $nodePrivateKey = "PENDIENTE"
} else {
    Write-OK "Claves Ed25519 del nodo generadas"
}

# 5. Generar archivo .env
$envContent = @"
# Generado automaticamente por install.ps1 - no editar manualmente
# Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Nodo: $nodeName ($nodeDomain)

DB_PASSWORD=$dbPassword
JWT_SECRET=$jwtSecret
NODE_DOMAIN=$nodeDomain
NODE_NAME=$nodeName
"@

$envPath = Join-Path $ROOT ".env"
$envContent | Out-File -FilePath $envPath -Encoding utf8 -Force
Write-OK "Archivo .env generado (con passwords y secrets aleatorios)"

# 6. Generar config.yaml
$configContent = @"
# config.yaml - Generado por install.ps1
# NO EDITAR MANUALMENTE. Usa la pagina de ajustes del nodo.
# Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

node:
  domain: "$nodeDomain"
  name: "$nodeName"

database:
  host: "yugabytedb"
  port: 5433
  name: "fmc_node"
  user: "fmc"
  password: ""  # viene del archivo .env (DB_PASSWORD)
  ssl_mode: "disable"

api:
  port: 8080
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:8080"
    - "http://$nodeDomain"

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
"@

$configPath = Join-Path $ROOT "config.yaml"
$configContent | Out-File -FilePath $configPath -Encoding utf8 -Force
Write-OK "config.yaml generado"

# 7. Guardar claves del nodo en archivo seguro
$keysContent = @"
# node_keys.txt - Claves del nodo para federacion
# MANTENER SEGURO. No compartir la clave privada.
# Nodo: $nodeName ($nodeDomain)
# Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# CLAVE PUBLICA (compartir con otros nodos para federarse)
# Para federar dos nodos, cada uno debe registrar la clave publica del otro.
node_public_key: $nodePublicKey

# CLAVE PRIVADA (NO compartir, mantener segura)
node_private_key: $nodePrivateKey
"@

$keysPath = Join-Path $ROOT "secrets\node_keys.txt"
$secretsDir = Join-Path $ROOT "secrets"
if (-not (Test-Path $secretsDir)) {
    New-Item -ItemType Directory -Path $secretsDir -Force | Out-Null
}
$keysContent | Out-File -FilePath $keysPath -Encoding utf8 -Force
Write-OK "Claves del nodo guardadas en secrets/node_keys.txt"

# 8. Construir y arrancar con docker-compose
Write-Host ""
Write-Step "Construyendo imagenes Docker (puede tardar varios minutos la primera vez)..."

# Detectar si docker compose (v2) o docker-compose (v1)
$composeCmd = "docker-compose"
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    $composeCmd = "docker compose"
}

Invoke-Expression "$composeCmd build 2>&1" | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Err "Error construyendo las imagenes Docker"
    exit 1
}
Write-OK "Imagenes construidas"

Write-Step "Arrancando servicios..."
Invoke-Expression "$composeCmd up -d 2>&1" | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Err "Error arrancando los servicios"
    exit 1
}
Write-OK "Servicios arrancados"

# 9. Esperar a que el servidor este listo
Write-Step "Esperando a que el servidor este listo..."
$serverUrl = "http://localhost:8080"
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "$serverUrl/api/setup/status" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}
Write-Host ""

if ($waited -ge $maxWait) {
    Write-Warn "El servidor no respondio en $maxWait segundos."
    Write-Warn "Puede que aun este iniciando. Revisa con: docker-compose logs"
} else {
    Write-OK "Servidor listo!"
}

# 10. Mostrar resumen y abrir navegador
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nodo: $nodeName" -ForegroundColor White
Write-Host "Dominio: $nodeDomain" -ForegroundColor White
Write-Host ""
Write-Host "URL del nodo: $serverUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "PROXIMO PASO:" -ForegroundColor Yellow
Write-Host "  Abre el navegador en: $serverUrl" -ForegroundColor White
Write-Host "  Crea el usuario administrador en la pagina de setup." -ForegroundColor White
Write-Host ""
Write-Host "CLAVES DE FEDERACION:" -ForegroundColor Yellow
Write-Host "  Tu clave publica (para registrar en otros nodos):" -ForegroundColor White
Write-Host "  $nodePublicKey" -ForegroundColor Gray
Write-Host "  Guardada en: secrets/node_keys.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "COMANDOS UTILES:" -ForegroundColor Yellow
Write-Host "  Ver logs:     $composeCmd logs -f" -ForegroundColor Gray
Write-Host "  Detener:      $composeCmd down" -ForegroundColor Gray
Write-Host "  Reiniciar:    $composeCmd restart" -ForegroundColor Gray
Write-Host ""

# Abrir navegador automaticamente
Start-Process $serverUrl

Write-Host "Abriendo navegador..." -ForegroundColor Cyan

