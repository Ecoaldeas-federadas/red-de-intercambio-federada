@echo off
REM watch-update.cmd - Ver el estado de la actualizacion en tiempo real
REM Uso: watch-update.cmd
REM Muestra el estado cada 3 segundos. Presiona Ctrl+C para salir.

:loop
cls
echo ========================================
echo   Estado de Actualizacion - %TIME%
echo ========================================
echo.

curl -s http://localhost:9110/status 2>nul | findstr /C:"status" /C:"message" /C:"commit" /C:"progress"

echo.
echo Presiona Ctrl+C para salir. Actualizando en 3 segundos...
timeout /t 3 /nobreak >nul
goto loop
