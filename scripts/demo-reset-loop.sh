#!/bin/sh
# demo-reset-loop.sh
# Bucle infinito que resetea el nodo demo cada N horas.
# Borra todos los datos del dominio "demo" y re-seedea.
# NO toca ningun otro dominio (no toca el nodo principal).

set -e

INTERVAL_HOURS="${DEMO_RESET_INTERVAL_HOURS:-24}"
INTERVAL_SECONDS=$((INTERVAL_HOURS * 3600))
DEMO_DOMAIN="${DEMO_DOMAIN:-demo}"

echo "Demo resetter: iniciando. Reset cada ${INTERVAL_HOURS} horas."

while true; do
  # Esperar el intervalo
  echo "Demo resetter: proximo reset en ${INTERVAL_HOURS} horas..."
  sleep "$INTERVAL_SECONDS"

  echo "Demo resetter: iniciando reset del dominio ${DEMO_DOMAIN}..."

  # Ejecutar el reset usando el binary fmc-node con flag especial
  /app/fmc-node --demo-reset --demo-domain="$DEMO_DOMAIN" 2>&1 || {
    echo "Demo resetter: error en reset, reintentando en 60s..."
    sleep 60
    continue
  }

  echo "Demo resetter: reset completado. Reiniciando demo-app..."
  # No reiniciamos el demo-app aqui, el reset borra y re-seedea la BD
  # El demo-app vera los nuevos datos en la siguiente peticion
done
