#!/bin/sh
# do_update.sh - Runs in background from updater-controller.sh
# Does: git fetch + reset + docker build + restart node-app
# Writes status to /update-state/update.json, logs to /update-state/update.log

# Auto-fix CRLF line endings si este script fue checkouteado por git con autocrlf=true
# Esto es necesario porque el script se ejecuta en Linux pero puede venir de Windows
if grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0" /project/docker/updater-controller.sh 2>/dev/null
  exec sh "$0" "$@"
fi

STATE_DIR=/update-state
STATE_FILE=$STATE_DIR/update.json
LOG_FILE=$STATE_DIR/update.log

mkdir -p "$STATE_DIR"

write_state() {
  STATUS=$1; MESSAGE=$2; COMMIT=$3; STARTED=$4; COMPLETED=$5
  printf '{"status":"%s","message":"%s","commit":"%s","started_at":"%s","completed_at":"%s"}' \
    "$STATUS" "$MESSAGE" "$COMMIT" "$STARTED" "$COMPLETED" > "$STATE_FILE"
}

log() {
  echo "$1"
}

# Verificar si la actualizacion fue cancelada
check_cancelled() {
  if [ -f "$STATE_FILE" ]; then
    CANCEL_STATUS=$(grep -o '"status":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"status":"//;s/"//')
    if [ "$CANCEL_STATUS" = "cancelled" ]; then
      log "=== ACTUALIZACION CANCELADA - DETENIENDO ==="
      exit 0
    fi
  fi
}

STARTED=$(date -Iseconds 2>/dev/null || date)
: > "$LOG_FILE"
write_state "running" "Iniciando actualizacion..." "" "$STARTED" ""
log "=== INICIO ACTUALIZACION ==="

PROJECT_DIR=/project
COMPOSE_FILE=$PROJECT_DIR/docker-compose.yml

# Configure git auth with token
if [ -n "$GIT_TOKEN" ]; then
  git -C "$PROJECT_DIR" remote set-url origin "https://${GIT_TOKEN}@github.com/discapacidad5/red-de-intercambio-federada.git"
  log "Token configurado en remote origin"
fi

# Detect compose project name
# Priority: COMPOSE_PROJECT_NAME env var > container label > node-app label > default
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$(hostname)" 2>/dev/null)
fi
if [ -z "$PROJECT_NAME" ] || [ "$PROJECT_NAME" = "project" ]; then
  # Fallback: detect from node-app container name
  NODE_APP=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'node-app' | head -1)
  if [ -n "$NODE_APP" ]; then
    PROJECT_NAME=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$NODE_APP" 2>/dev/null)
  fi
fi
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="red-de-intercambio-federada"
fi
log "Project name detectado: $PROJECT_NAME"

# Show remote URL for debugging (token is masked by git in newer versions)
REMOTE_URL=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null)
log "Remote URL configurado"

# 1. git fetch origin main
check_cancelled
write_state "running" "Descargando cambios del repositorio (git fetch)..." "" "$STARTED" ""
log "--- git fetch ---"
if ! git -C "$PROJECT_DIR" fetch origin main 2>&1; then
  write_state "error" "Error en git fetch. Verifica GIT_TOKEN en .env" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: git fetch fallo"
  exit 1
fi
log "git fetch OK"

# 2. Abort any pending merge/rebase
git -C "$PROJECT_DIR" merge --abort 2>/dev/null || true
git -C "$PROJECT_DIR" rebase --abort 2>/dev/null || true

# 3. git reset --hard origin/main
check_cancelled
write_state "running" "Aplicando cambios del repositorio (git reset)..." "" "$STARTED" ""
log "--- git reset --hard origin/main ---"
if ! git -C "$PROJECT_DIR" reset --hard origin/main 2>&1; then
  write_state "error" "Error al aplicar cambios (git reset)" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: git reset fallo"
  exit 1
fi

# 4. Clean untracked files
git -C "$PROJECT_DIR" clean -fd 2>&1 || true
log "Cambios del repositorio aplicados"

# Show new commit
NEW_COMMIT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
log "Nuevo commit: $NEW_COMMIT"

# 5. docker compose build updater-controller PRIMERO
# Esto es critico: si hay cambios en el updater-controller, se actualiza primero.
# Si solo hay cambios en el updater-controller y no en node-app, se actualiza
# el updater-controller y se reinicia, luego continúa con node-app.
# Si hay cambios en ambos, se actualiza updater-controller primero, se reinicia,
# y luego continua con node-app (el proceso do_update.sh se pierde al reiniciar
# updater-controller, pero el estado ya queda guardado).
check_cancelled
write_state "running" "Construyendo imagen updater-controller..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose build updater-controller ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" build updater-controller 2>&1; then
  write_state "error" "Error al construir imagen updater-controller" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: docker build updater-controller fallo"
  exit 1
fi
log "Imagen updater-controller construida"

# Reiniciar updater-controller con la nueva imagen
# Nota: al reiniciar updater-controller, este proceso (do_update.sh) puede
# ser asesinado. Pero el estado ya esta guardado en el volumen compartido.
# Si el updater-controller se reinicia, el proceso do_update.sh se pierde
# y la actualizacion se interrumpe. Para manejar esto, verificamos si hay
# cambios en los archivos del updater-controller antes de reiniciarlo.
UPDATER_CHANGED=$(git -C "$PROJECT_DIR" diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'updater-controller|do_update\.sh|Dockerfile\.updater' || echo "")
if [ -n "$UPDATER_CHANGED" ]; then
  log "Cambios detectados en updater-controller. Reiniciando..."
  write_state "running" "Reiniciando updater-controller con nueva imagen..." "$NEW_COMMIT" "$STARTED" ""
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps --force-recreate updater-controller 2>&1 || true
  log "Updater-controller reiniciado. Esperando 3 segundos..."
  sleep 3
  # Continuar con la actualizacion - el proceso puede haber sobrevivido
  # si el updater-controller se reinicio rapidamente
else
  log "Sin cambios en updater-controller. No es necesario reiniciarlo."
  # Asegurarse de que este corriendo
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps updater-controller 2>&1 || true
fi

# 6. docker compose build node-app
check_cancelled
write_state "running" "Construyendo imagen Docker del nodo (esto tarda varios minutos)..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose build node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" build node-app 2>&1; then
  write_state "error" "Error al construir imagen node-app" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: docker build node-app fallo"
  exit 1
fi
log "Imagen node-app construida"

# 7. docker compose build demo-app (has profile, doesn't build alone)
write_state "running" "Construyendo imagen demo-app..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose build demo-app ---"
docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" --profile demo build demo-app 2>&1 || true
log "Imagen demo-app construida (o cacheada)"

# 8. Restart node-app
check_cancelled
write_state "running" "Reiniciando nodo..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose up -d node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps node-app 2>&1; then
  write_state "error" "Error al reiniciar nodo" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: docker up node-app fallo"
  exit 1
fi
log "Nodo reiniciado"

# 9. Recreate demo-app if it was running (leave it stopped)
DEMO_CONTAINER="${PROJECT_NAME}-demo-app-1"
DEMO_RUNNING=$(docker inspect -f '{{.State.Running}}' "$DEMO_CONTAINER" 2>/dev/null || echo "false")
if [ "$DEMO_RUNNING" = "true" ]; then
  log "Demo-app estaba corriendo, recreando con nueva imagen..."
  docker stop "$DEMO_CONTAINER" 2>/dev/null || true
  docker rm -f "$DEMO_CONTAINER" 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" --profile demo up -d --no-deps demo-app 2>&1 || true
  docker stop "$DEMO_CONTAINER" 2>/dev/null || true
  log "Demo-app recreado (detenido, listo para arrancar desde la web)"
fi

log "=== ACTUALIZACION COMPLETADA ==="
write_state "completed" "Nodo actualizado y reiniciado correctamente" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
