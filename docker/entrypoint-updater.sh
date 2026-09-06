#!/bin/sh
# entrypoint-updater.sh - Wrapper que usa el script del volume mount si existe.
# Esto permite actualizar el script con git pull + restart sin rebuild.
# Si el volume mount no existe, usa el script copiado en el Docker image.

# Strip CRLF de los scripts del volume mount (Windows -> Linux)
if [ -f /project/docker/updater-controller.sh ]; then
  sed -i 's/\r$//' /project/docker/updater-controller.sh 2>/dev/null
  chmod +x /project/docker/updater-controller.sh 2>/dev/null
  SCRIPT=/project/docker/updater-controller.sh
else
  SCRIPT=/updater-controller.sh
fi

exec socat TCP-LISTEN:9110,reuseaddr,fork "EXEC:$SCRIPT"
