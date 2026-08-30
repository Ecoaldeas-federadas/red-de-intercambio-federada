# watch-update.ps1 - Ver el estado de la actualizacion en tiempo real
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File watch-update.ps1
#
# Muestra el estado de la actualizacion cada 2 segundos, en vivo.
# Presiona Ctrl+C para salir.

$ErrorActionPreference = "Continue"
$base = "http://localhost:9110"

function Get-UpdateStatus {
    try {
        $resp = Invoke-RestMethod -Uri "$base/status" -TimeoutSec 3 -ErrorAction Stop
        return $resp
    } catch {
        return $null
    }
}

function Format-Status($s) {
    if (-not $s) {
        Write-Host "[ERROR] No se puede conectar con el updater-controller (puerto 9110)" -ForegroundColor Red
        return
    }

    $now = Get-Date -Format "HH:mm:ss"
    $status = $s.status
    $message = $s.message
    $commit = $s.commit
    $progress = $s.progress

    # Color segun estado
    $color = "Gray"
    switch ($status) {
        "running"   { $color = "Cyan" }
        "completed" { $color = "Green" }
        "error"     { $color = "Red" }
        "cancelled" { $color = "Yellow" }
        "idle"      { $color = "DarkGray" }
    }

    # Barra de progreso visual
    $barLen = 30
    if ($progress -gt 0) {
        $filled = [math]::Floor($progress / 100 * $barLen)
        $empty = $barLen - $filled
        $bar = ("#" * $filled) + ("-" * $empty)
    } else {
        $bar = "-" * $barLen
    }

    Clear-Host
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Estado de Actualizacion - $now" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  Estado:    " -NoNewline
    Write-Host "$status" -ForegroundColor $color
    if ($message) {
        Write-Host "  Mensaje:   $message"
    }
    if ($commit) {
        Write-Host "  Commit:    $commit"
    }
    if ($progress -gt 0) {
        Write-Host "  Progreso:  [$bar] $progress%"
    }
    Write-Host ""

    # Mostrar ultimas lineas del log
    if ($s.log) {
        $logLines = $s.log -split "\\n" | Where-Object { $_ -ne "" } | Select-Object -Last 15
        Write-Host "  --- Ultimas lineas del log ---" -ForegroundColor DarkGray
        foreach ($line in $logLines) {
            # Limpiar escapes
            $clean = $line -replace "\\r", "" -replace "\\", ""
            Write-Host "  $clean" -ForegroundColor DarkGray
        }
    }

    Write-Host ""
    Write-Host "  Presiona Ctrl+C para salir" -ForegroundColor DarkGray

    # Mensaje especial segun estado
    if ($status -eq "running") {
        Write-Host ""
        Write-Host "  [Actualizando...] No cierres esta ventana." -ForegroundColor Cyan
    } elseif ($status -eq "completed") {
        Write-Host ""
        Write-Host "  [COMPLETADO] El nodo se actualizo correctamente." -ForegroundColor Green
        Write-Host "  Puedes cerrar esta ventana." -ForegroundColor Green
    } elseif ($status -eq "error") {
        Write-Host ""
        Write-Host "  [ERROR] La actualizacion fallo." -ForegroundColor Red
        Write-Host "  Para reintentar: curl -X POST http://localhost:9110/reset" -ForegroundColor Yellow
        Write-Host "  Luego:            curl -X POST http://localhost:9110/update" -ForegroundColor Yellow
    } elseif ($status -eq "cancelled") {
        Write-Host ""
        Write-Host "  [CANCELADA] La actualizacion fue cancelada." -ForegroundColor Yellow
        Write-Host "  Para reintentar: curl -X POST http://localhost:9110/reset" -ForegroundColor Yellow
        Write-Host "  Luego:            curl -X POST http://localhost:9110/update" -ForegroundColor Yellow
    }
}

Write-Host "Conectando al updater-controller en $base..." -ForegroundColor Cyan

# Loop principal: actualizar cada 2 segundos
while ($true) {
    $status = Get-UpdateStatus
    Format-Status $status

    # Si termino (completed, error, cancelled), salir despues de 5 segundos
    if ($status -and $status.status -ne "running" -and $status.status -ne "idle") {
        Start-Sleep -Seconds 5
        # Verificar una vez mas por si cambio
        $status = Get-UpdateStatus
        if ($status -and $status.status -ne "running") {
            break
        }
    }

    Start-Sleep -Seconds 2
}
