# update.ps1 - Actualizar el nodo sin perder datos
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File update.ps1
#
# Este script:
#   1. Descarga el codigo del repositorio (el remoto SIEMPRE tiene prioridad)
#   2. Si el propio script cambio, se re-ejecuta con la nueva version
#   3. Limpia contenedores huerfanos de actualizaciones fallidas
#   4. Reconstruye las imagenes Docker (node-app, demo-app, updater-controller)
#   5. Arranca todos los servicios que deben estar corriendo
#   6. Detiene el demo-app si quedo corriendo por error (se arranca desde la web)
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

# Verificar que Docker Desktop este respondiendo
$dockerOk = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch { }
if (-not $dockerOk) {
    Write-Err "Docker no esta corriendo. Inicia Docker Desktop y vuelve a intentar."
    exit 1
}
Write-OK "Docker encontrado y corriendo"

# Verificar que el nodo ya este configurado
$envPath = Join-Path $ROOT ".env"
if (-not (Test-Path $envPath)) {
    Write-Err "No se encontro .env. Parece que el nodo no esta instalado."
    Write-Host "Ejecuta: .\install.ps1" -ForegroundColor Yellow
    exit 1
}

# Guardar hash del script actual para detectar si cambio despues del git pull
$scriptPath = $PSCommandPath
if (-not $scriptPath) { $scriptPath = Join-Path $ROOT "update.ps1" }
$scriptHashBefore = ""
if (Test-Path $scriptPath) {
    $scriptHashBefore = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
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

# 1b. Si el propio script cambio despues del git pull, re-ejecutar la nueva version
if (Test-Path $scriptPath) {
    $scriptHashAfter = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
    if ($scriptHashBefore -ne $scriptHashAfter) {
        Write-Host ""
        Write-Warn "El script update.ps1 cambio en esta actualizacion."
        Write-Step "Re-ejecutando con la nueva version..."
        Write-Host ""
        & $scriptPath
        exit $LASTEXITCODE
    }
}

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

# 3. Limpiar contenedores huerfanos de actualizaciones fallidas
Write-Host ""
Write-Step "Limpiando contenedores huerfanos de actualizaciones fallidas..."
$orphanContainers = docker ps -a --filter "label=com.docker.compose.project" --format "{{.Names}}" 2>$null | Where-Object { $_ -match "_red-de-intercambio-federada-" }
foreach ($orphan in $orphanContainers) {
    Write-Warn "Eliminando contenedor huerfano: $orphan"
    docker rm -f $orphan 2>$null
}
# Tambien limpiar contenedores sin nombre (creados por updates fallidos con project name equivocado)
$unnamedContainers = docker ps -a --format "{{.ID}} {{.Names}}" 2>$null | Where-Object { $_ -match "^[a-f0-9]{12} $" }
foreach ($unnamed in $unnamedContainers) {
    $unnamedId = ($unnamed -split " ")[0]
    Write-Warn "Eliminando contenedor huerfano sin nombre: $unnamedId"
    docker rm -f $unnamedId 2>$null
}
Write-OK "Limpieza de huerfanos completada"

# 4. Detener demo-app si quedo corriendo por error (debe arrancarse desde la web)
Write-Step "Verificando que demo-app no este corriendo..."
$demoRunning = docker ps --filter "name=demo-app" --format "{{.Names}}" 2>$null
if ($demoRunning) {
    Write-Warn "Demo-app estaba corriendo (no deberia). Deteniendolo..."
    docker stop $demoRunning 2>$null
    docker rm -f $demoRunning 2>$null
    Write-OK "Demo-app detenido (se arranca desde la web)"
} else {
    Write-OK "Demo-app no estaba corriendo (correcto)"
}

# 5. Reconstruir todas las imagenes
Write-Host ""
Write-Step "Reconstruyendo imagenes Docker (puede tardar varios minutos)..."
$buildCode = Invoke-Compose @("build", "node-app")
if ($buildCode -ne 0) {
    Write-Err "Error construyendo node-app (codigo $buildCode)"
    exit 1
}
# Construir updater-controller (nuevo servicio)
$updaterBuildCode = Invoke-Compose @("build", "updater-controller")
if ($updaterBuildCode -ne 0) {
    Write-Warn "No se pudo construir updater-controller (codigo $updaterBuildCode)"
    Write-Warn "Verifica que docker/Dockerfile.updater-controller exista"
}
# Tambien construir demo-app (tiene profile, no se construye solo)
$demoBuildCode = Invoke-Compose @("--profile", "demo", "build", "demo-app")
if ($demoBuildCode -ne 0) {
    Write-Warn "No se pudo construir la imagen demo-app (no es critico)"
}
Write-OK "Imagenes reconstruidas"

# 6. Arrancar todos los servicios que deben estar siempre corriendo
#    NO arrancar demo-app (se arranca desde la web con un boton)
Write-Host ""
Write-Step "Arrancando servicios principales..."
$servicesToStart = @("yugabytedb", "db-backup", "demo-controller", "demo-stopper", "updater-controller", "node-app")
$upCode = Invoke-Compose @("up", "-d", "--no-deps") + $servicesToStart
# Invoke-Compose no maneja arrays bien, usar ejecucion directa
$allUpArgs = $composeArgs + @("up", "-d", "--no-deps") + $servicesToStart
$outFile = Join-Path $env:TEMP "compose-up_$([guid]::NewGuid()).log"
$errFile = Join-Path $env:TEMP "compose-up-err_$([guid]::NewGuid()).log"
$p = Start-Process -FilePath $composeExe -ArgumentList $allUpArgs -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile -RedirectStandardOutput $outFile
Get-Content $outFile -ErrorAction SilentlyContinue | Out-Host
Get-Content $errFile -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue
$upExitCode = $p.ExitCode

if ($upExitCode -ne 0) {
    Write-Warn "Algunos servicios pudieron no arrancar (codigo $upExitCode)"
    Write-Warn "Intentando arrancar node-app individualmente..."
    $nodeUpCode = Invoke-Compose @("up", "-d", "--no-deps", "node-app")
    if ($nodeUpCode -ne 0) {
        Write-Err "Error arrancando node-app (codigo $nodeUpCode)"
        exit 1
    }
}
Write-OK "Servicios arrancados"

# 7. Esperar al servidor
Write-Step "Esperando al servidor..."
$serverUrl = "http://localhost:8080"
$maxWait = 90
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
    Write-Warn "Revisa con: docker compose logs -f node-app"
} else {
    Write-OK "Servidor listo!"
}

# 8. Mostrar commit actual
$commit = git rev-parse --short HEAD 2>$null
if ($commit) {
    Write-Host ""
    Write-Host "Commit actual: $commit" -ForegroundColor Cyan
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
