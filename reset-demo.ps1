# reset-demo.ps1 - Resetear el nodo demo con datos frescos
#
# Uso:
#   .\reset-demo.ps1
#
# Este script:
#   1. Detiene el nodo demo
#   2. Borra todos los datos del dominio demo
#   3. Reinicia el nodo demo (que hace auto-setup + seed)
#
# Util cuando se hacen cambios al seed y se quiere ver los datos nuevos.

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }

$ROOT = $PSScriptRoot
Set-Location $ROOT

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  Reset del Nodo Demo" -ForegroundColor Magenta
Write-Host "  (borra y regenera datos)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Verificar Docker
Write-Step "Verificando Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker no esta instalado."
    exit 1
}
Write-OK "Docker encontrado"

# 1. Detener demo-app
Write-Step "Deteniendo nodo demo..."
$demoContainer = docker ps -a --filter "name=demo-app" --format "{{.Names}}" 2>$null
if ($demoContainer) {
    docker stop $demoContainer 2>$null
    docker rm -f $demoContainer 2>$null
    Write-OK "Nodo demo detenido y eliminado"
} else {
    Write-OK "No habia nodo demo corriendo"
}

# 2. Borrar datos del dominio demo directamente en la BD
Write-Step "Borrando datos del dominio demo..."

# Lista de tablas a limpiar (orden importa por foreign keys)
$cleanupSQL = @"
-- Borrar tablas con node_domain (orden importa por foreign keys)
DELETE FROM assembly_votes WHERE decision_id IN (SELECT id FROM assembly_decisions WHERE assembly_id IN (SELECT id FROM assembly_sessions WHERE node_domain = 'demo'));
DELETE FROM assembly_attendance WHERE session_id IN (SELECT id FROM assembly_sessions WHERE node_domain = 'demo');
DELETE FROM assembly_decisions WHERE assembly_id IN (SELECT id FROM assembly_sessions WHERE node_domain = 'demo');
DELETE FROM assembly_sessions WHERE node_domain = 'demo';
DELETE FROM assembly_votes_scoped WHERE decision_id IN (SELECT id FROM assembly_decisions_scoped WHERE session_id IN (SELECT id FROM assembly_sessions_scoped WHERE node_domain = 'demo'));
DELETE FROM assembly_attendance_scoped WHERE session_id IN (SELECT id FROM assembly_sessions_scoped WHERE node_domain = 'demo');
DELETE FROM assembly_decisions_scoped WHERE session_id IN (SELECT id FROM assembly_sessions_scoped WHERE node_domain = 'demo');
DELETE FROM assembly_sessions_scoped WHERE node_domain = 'demo';
DELETE FROM assembly_quorum_config WHERE node_domain = 'demo';
DELETE FROM assembly_quorum_config_scoped WHERE node_domain = 'demo';
DELETE FROM assembly_frequency_config WHERE node_domain = 'demo';
DELETE FROM assembly_config WHERE node_domain = 'demo';
DELETE FROM assembly_notifications WHERE node_domain = 'demo';
DELETE FROM board_members WHERE node_domain = 'demo';
DELETE FROM tax_config WHERE node_domain = 'demo';
DELETE FROM tax_distributions WHERE node_domain = 'demo';
DELETE FROM external_bridge_operations WHERE node_domain = 'demo';
DELETE FROM admission_requests WHERE node_domain = 'demo';
DELETE FROM store_items WHERE node_domain = 'demo';
DELETE FROM governance_rules WHERE node_domain = 'demo';
DELETE FROM department_members WHERE department_id IN (SELECT id FROM departments WHERE node_domain = 'demo');
DELETE FROM department_roles WHERE department_id IN (SELECT id FROM departments WHERE node_domain = 'demo');
DELETE FROM departments WHERE node_domain = 'demo';
DELETE FROM organization_levels WHERE node_domain = 'demo';
DELETE FROM member_levels WHERE node_domain = 'demo';
DELETE FROM product_compositions WHERE product_id IN (SELECT id FROM products WHERE node_domain = 'demo');
DELETE FROM products WHERE node_domain = 'demo';
DELETE FROM notifications WHERE node_domain = 'demo';
DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM user_documents WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM user_permissions WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM user_passkeys WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM user_credentials WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM membership_history WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM device_registrations WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM nfc_cards WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM nfc_transactions WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo') OR seller_user_id IN (SELECT id FROM users WHERE node_domain = 'demo') OR buyer_user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM nfc_terminal_sessions WHERE merchant_user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM multi_sig_approvals WHERE from_account IN (SELECT id FROM users WHERE node_domain = 'demo') OR to_account IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM approval_signatures WHERE signer_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM recovery_approvals WHERE approver_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM recovery_requests WHERE target_user_id IN (SELECT id FROM users WHERE node_domain = 'demo') OR requester_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM invitation_codes WHERE created_by IN (SELECT id FROM users WHERE node_domain = 'demo') OR used_by IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM organization_board_members WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo') OR appointed_by IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM member_group_members WHERE user_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM member_groups WHERE institution_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM node_federation_keys WHERE added_by IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM node_merge_conflicts WHERE user_a_id IN (SELECT id FROM users WHERE node_domain = 'demo') OR user_b_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM uploaded_images WHERE uploaded_by IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM ledger_entries WHERE account_id IN (SELECT id FROM users WHERE node_domain = 'demo');
DELETE FROM transactions WHERE sender_node = 'demo' OR receiver_node = 'demo';
DELETE FROM users WHERE node_domain = 'demo';
DELETE FROM node_balance WHERE remote_node IN ('aldea-semilla-viva', 'comunidad-rio-claro', 'ecoaldea-cerro-verde', 'cooperativa-pueblo-nuevo');
DELETE FROM bilateral_limits WHERE local_node = 'demo';
DELETE FROM node_federation_keys WHERE peer_domain IN ('aldea-semilla-viva', 'comunidad-rio-claro', 'ecoaldea-cerro-verde', 'cooperativa-pueblo-nuevo');
DELETE FROM public_pages WHERE node_domain = 'demo';
DELETE FROM public_settings WHERE node_domain = 'demo';
DELETE FROM node_config WHERE node_domain = 'demo';
DELETE FROM conversion_factor WHERE node_domain = 'demo';
"@

$sqlFile = Join-Path $env:TEMP "demo_reset_$([guid]::NewGuid()).sql"
$cleanupSQL | Out-File -FilePath $sqlFile -Encoding UTF8

$yugaContainer = docker ps --filter "name=yugabytedb" --format "{{.Names}}" 2>$null
if ($yugaContainer) {
    # Obtener la IP interna del contenedor de YugabyteDB
    $yugaIP = (docker inspect $yugaContainer --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" 2>$null | Out-String).Trim()
    if (-not $yugaIP) {
        # Fallback: intentar con el nombre del contenedor como host
        $yugaIP = $yugaContainer
    }
    Write-Step "Conectando a YugabyteDB en $yugaIP`:5433..."
    Get-Content $sqlFile | docker exec -i $yugaContainer /home/yugabyte/bin/ysqlsh -h $yugaIP -p 5433 -d fmc_demo 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Error borrando datos (codigo $LASTEXITCODE)"
        # Continuamos de todos modos: el seed puede funcionar con datos existentes
    }
    Write-OK "Datos del dominio demo borrados"
} else {
    Write-Err "No se encontro el contenedor de YugabyteDB"
    exit 1
}

Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

# 3. Reconstruir demo-app con la imagen actualizada
Write-Step "Reconstruyendo imagen demo-app..."
$composeExe = "docker-compose"
$composeArgs = @()
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    $composeExe = "docker"
    $composeArgs = @("compose")
}

$allArgs = $composeArgs + @("--profile", "demo", "build", "demo-app")
$p = Start-Process -FilePath $composeExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) {
    Write-Err "Error construyendo demo-app (codigo $($p.ExitCode))"
    exit 1
}
Write-OK "Imagen demo-app reconstruida"

# 4. Arrancar demo-app (hara auto-setup + seed con datos frescos)
Write-Step "Arrancando nodo demo (con datos frescos)..."
$allArgs = $composeArgs + @("--profile", "demo", "up", "-d", "--no-deps", "demo-app")
$p = Start-Process -FilePath $composeExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) {
    Write-Err "Error arrancando demo-app (codigo $($p.ExitCode))"
    exit 1
}

# 5. Esperar a que el seed termine
Write-Step "Esperando a que el seed termine (puede tardar 30-60 segundos)..."
Start-Sleep -Seconds 10

$maxWait = 90
$waited = 10
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9091/api/setup/status" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}
Write-Host ""

if ($waited -ge $maxWait) {
    Write-Warn "El nodo demo no respondio en $maxWait segundos."
    Write-Warn "Revisa con: docker logs -f red-de-intercambio-federada-demo-app-1"
} else {
    Write-OK "Nodo demo listo!"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  RESET COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: http://localhost:9091/demo" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usuario: demo" -ForegroundColor Yellow
Write-Host "Contrasena: demo123" -ForegroundColor Yellow
Write-Host ""
Write-Host "NOTA: Presiona Ctrl+Shift+R en el navegador para limpiar cache" -ForegroundColor Yellow
Write-Host ""
