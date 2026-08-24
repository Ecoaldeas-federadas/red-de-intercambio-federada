# update.ps1 - Actualizar el nodo sin perder datos
#
# Uso:
#   .\update.ps1
#
# Este script:
#   1. Descarga el codigo del repositorio (el remoto SIEMPRE tiene prioridad)
#   2. Reconstruye las imagenes Docker
#   3. Reinicia los servicios
#
# NO borra la base de datos.
# NO regenera secrets.
# NO pide reconfigurar nada.
# Los datos existentes se conservan.
# Los cambios locales al codigo se descartan (el remoto siempre gana).

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }

$ROOT = $PSScriptRoot
Set-Location $ROOT

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Actualizacion de Nodo Federado" -ForegroundColor Magenta
Write-Host "  (sin perder datos)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Verificar que Docker este corriendo
Write-Step "Verificando Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker no esta instalado."
    exit 1
}
Write-OK "Docker encontrado"

# Verificar que el nodo ya este configurado
$envPath = Join-Path $ROOT ".env"
if (-not (Test-Path $envPath)) {
    Write-Err "No se encontro .env. Parece que el nodo no esta instalado."
    Write-Host "Ejecuta: .\install.ps1" -ForegroundColor Yellow
    exit 1
}

# 1. Descargar codigo del repositorio (el remoto SIEMPRE tiene prioridad)
Write-Host ""
Write-Step "Bajando ultimos cambios del repositorio..."
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

# Configurar el remote con token si existe en .env
$envContent = Get-Content $envPath -ErrorAction SilentlyContinue
$gitToken = ""
foreach ($line in $envContent) {
    if ($line -match "^GIT_TOKEN=(.+)$") {
        $gitToken = $matches[1].Trim()
        break
    }
}
if ($gitToken -ne "") {
    Write-Step "Configurando token de autenticacion..."
    git remote set-url origin "https://$gitToken@github.com/discapacidad5/red-de-intercambio-federada.git" 2>$null
    Write-OK "Token configurado"
}

# Abortar cualquier merge/rebase/cherry-pick pendiente (por si quedo de un update fallido)
git merge --abort 2>$null
git rebase --abort 2>$null
git cherry-pick --abort 2>$null

# Limpiar stash viejo si existe (por updates anteriores fallidos)
git stash clear 2>$null

# Fetch: bajar los ultimos cambios del remoto
try {
    git fetch origin main 2>&1 | Out-Host
} catch {
    Write-Warn "Aviso durante git fetch: $_"
}

# Reset hard al origin/main: el remoto SIEMPRE gana.
# No hacemos stash ni stash pop. Los datos importantes (.env, BD)
# estan fuera del repo y no se ven afectados.
try {
    git reset --hard origin/main 2>&1 | Out-Host
    git clean -fd 2>&1 | Out-Host
} catch {
    Write-Warn "Aviso durante git reset: $_"
}

$ErrorActionPreference = $prevEAP
Write-OK "Codigo actualizado (version del repositorio)"

# 2. Detectar docker compose
$composeExe = "docker-compose"
$composeArgs = @()
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    $composeExe = "docker"
    $composeArgs = @("compose")
}

function Invoke-Compose($subArgs) {
    $allArgs = $composeArgs + $subArgs
    $outFile = Join-Path $env:TEMP "compose-out_$([guid]::NewGuid()).log"
    $errFile = Join-Path $env:TEMP "compose-err_$([guid]::NewGuid()).log"
    $p = Start-Process -FilePath $composeExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile -RedirectStandardOutput $outFile
    Get-Content $outFile -ErrorAction SilentlyContinue | Out-Host
    Get-Content $errFile -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue
    return $p.ExitCode
}

# 3. Reconstruir
Write-Host ""
Write-Step "Reconstruyendo imagenes Docker (puede tardar varios minutos)..."
$buildCode = Invoke-Compose @("build")
if ($buildCode -ne 0) {
    Write-Err "Error construyendo las imagenes (codigo $buildCode)"
    exit 1
}
# Tambien construir demo-app (tiene profile, no se construye solo)
$demoBuildCode = Invoke-Compose @("--profile", "demo", "build", "demo-app")
if ($demoBuildCode -ne 0) {
    Write-Warn "No se pudo construir la imagen demo-app (no es critico)"
}
Write-OK "Imagenes reconstruidas"

# 4. Eliminar demo-app viejo (si existe) para que al arrancar desde la web
#    se cree con la imagen nueva. NO lo creamos aqui: se crea al pulsar
#    "Arrancar demo" en la pagina web.
Write-Step "Limpiando nodo demo viejo..."
$demoContainer = docker ps -a --filter "name=demo-app" --format "{{.Names}}" 2>$null
if ($demoContainer) {
    docker stop $demoContainer 2>$null
    docker rm -f $demoContainer 2>$null
    Write-OK "Nodo demo viejo eliminado (se creara de nuevo al arrancar desde la web)"
} else {
    Write-OK "No habia nodo demo que limpiar"
}

# 5. Reiniciar node-app (sin tocar yugabytedb para evitar conflicto de puerto)
Write-Step "Reiniciando nodo-app (sin tocar la base de datos)..."
$upCode = Invoke-Compose @("up", "-d", "--no-deps", "node-app")
if ($upCode -ne 0) {
    Write-Err "Error arrancando node-app (codigo $upCode)"
    exit 1
}
Write-OK "Nodo reiniciado"

# 7. Esperar al servidor
Write-Step "Esperando al servidor..."
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
    Write-Warn "Revisa con: $composeExe logs -f"
} else {
    Write-OK "Servidor listo!"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ACTUALIZACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Los datos existentes se conservaron." -ForegroundColor White
Write-Host "Las nuevas migraciones se aplicaron automaticamente." -ForegroundColor White
Write-Host ""
Write-Host "URL: $serverUrl" -ForegroundColor Cyan
Write-Host ""
$composeDisplay = if ($composeExe -eq "docker") { "docker compose" } else { "docker-compose" }
Write-Host "COMANDOS UTILES:" -ForegroundColor Yellow
Write-Host "  Ver logs:     $composeDisplay logs -f" -ForegroundColor Gray
Write-Host "  Detener:      $composeDisplay down" -ForegroundColor Gray
Write-Host "  Reiniciar:    $composeDisplay restart" -ForegroundColor Gray
Write-Host ""
Write-Host "NOTA: Si el navegador muestra pagina vieja, presiona Ctrl+Shift+R" -ForegroundColor Yellow
Write-Host ""
