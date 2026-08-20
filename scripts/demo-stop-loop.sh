#!/bin/sh
# demo-stop-loop.sh
# Corre siempre. Cada N horas detiene el contenedor demo-app si esta corriendo.
# Asi el nodo demo no gasta recursos cuando nadie lo esta usando.
# El nodo demo se vuelve a iniciar cuando alguien pulsa el boton en la pagina web.

set -e

INTERVAL_HOURS="${DEMO_AUTO_STOP_HOURS:-24}"
INTERVAL_SECONDS=$((INTERVAL_HOURS * 3600))

echo "Demo stopper: iniciando. Detendra demo-app cada ${INTERVAL_HOURS} horas."

while true; do
  echo "Demo stopper: esperando ${INTERVAL_HOURS} horas..."
  sleep "$INTERVAL_SECONDS"

  echo "Demo stopper: deteniendo demo-app..."
  docker stop demo-app 2>/dev/null || true
  echo "Demo stopper: demo-app detenido."
done
