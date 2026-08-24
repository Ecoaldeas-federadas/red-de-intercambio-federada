#!/bin/sh
# do_update.sh - Runs in background from updater-controller.sh
# Does: git fetch + reset + docker build + restart node-app
# Writes status to /update-state/update.json, logs to /update-state/update.log

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

# Detect compose project name from own container labels
PROJECT_NAME=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$(hostname)" 2>/dev/null)
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

# 5. docker compose build node-app
write_state "running" "Construyendo imagen Docker (esto tarda varios minutos)..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose build node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" build node-app 2>&1; then
  write_state "error" "Error al construir imagen node-app" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: docker build node-app fallo"
  exit 1
fi
log "Imagen node-app construida"

# 6. docker compose build demo-app (has profile, doesn't build alone)
write_state "running" "Construyendo imagen demo-app..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose build demo-app ---"
docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" --profile demo build demo-app 2>&1 || true
log "Imagen demo-app construida (o cacheada)"

# 7. Restart node-app
write_state "running" "Reiniciando nodo..." "$NEW_COMMIT" "$STARTED" ""
log "--- docker compose up -d node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps node-app 2>&1; then
  write_state "error" "Error al reiniciar nodo" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)"
  log "ERROR: docker up node-app fallo"
  exit 1
fi
log "Nodo reiniciado"

# 8. Recreate demo-app if it was running (leave it stopped)
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
