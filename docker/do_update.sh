#!/bin/sh
# do_update.sh - Runs in background from updater-controller.sh
# Does: git fetch + reset + docker build + restart node-app
# Writes status to /update-state/update.json, logs to /update-state/update.log
#
# CRITICO: Este script corre DENTRO del updater-controller.
# NUNCA debe reiniciar el updater-controller durante la actualizacion,
# porque eso mataria este proceso. El updater-controller se reinicia
# al FINAL, despues de que todo lo demas este completo.

# Auto-fix CRLF line endings si este script fue checkouteado por git con autocrlf=true
if grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0" /project/docker/updater-controller.sh 2>/dev/null
  exec sh "$0" "$@"
fi

STATE_DIR=/update-state
STATE_FILE=$STATE_DIR/update.json
LOG_FILE=$STATE_DIR/update.log

mkdir -p "$STATE_DIR"

write_state() {
  STATUS=$1; MESSAGE=$2; COMMIT=$3; STARTED=$4; COMPLETED=$5; PROGRESS=$6
  if [ -z "$PROGRESS" ]; then PROGRESS="0"; fi
  printf '{"status":"%s","message":"%s","commit":"%s","started_at":"%s","completed_at":"%s","progress":%s}' \
    "$STATUS" "$MESSAGE" "$COMMIT" "$STARTED" "$COMPLETED" "$PROGRESS" > "$STATE_FILE"
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
write_state "running" "Iniciando actualizacion..." "" "$STARTED" "" 5
log "=== INICIO ACTUALIZACION ==="

PROJECT_DIR=/project
COMPOSE_FILE=$PROJECT_DIR/docker-compose.yml

# Configure git auth with token
if [ -n "$GIT_TOKEN" ]; then
  git -C "$PROJECT_DIR" remote set-url origin "https://${GIT_TOKEN}@github.com/discapacidad5/red-de-intercambio-federada.git"
  log "Token configurado en remote origin"
fi

# Detect compose project name
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$(hostname)" 2>/dev/null)
fi
if [ -z "$PROJECT_NAME" ] || [ "$PROJECT_NAME" = "project" ]; then
  NODE_APP=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'node-app' | head -1)
  if [ -n "$NODE_APP" ]; then
    PROJECT_NAME=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$NODE_APP" 2>/dev/null)
  fi
fi
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="red-de-intercambio-federada"
fi
log "Project name detectado: $PROJECT_NAME"

REMOTE_URL=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null)
log "Remote URL configurado"

# 1. git fetch origin main (10%)
check_cancelled
write_state "running" "Descargando cambios del repositorio (git fetch)..." "" "$STARTED" "" 10
log "--- git fetch ---"
if ! git -C "$PROJECT_DIR" fetch origin main 2>&1; then
  write_state "error" "Error en git fetch. Verifica GIT_TOKEN en .env" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 10
  log "ERROR: git fetch fallo"
  exit 1
fi
log "git fetch OK"

# 2. Abort any pending merge/rebase
git -C "$PROJECT_DIR" merge --abort 2>/dev/null || true
git -C "$PROJECT_DIR" rebase --abort 2>/dev/null || true

# 3. git reset --hard origin/main (15%)
check_cancelled
write_state "running" "Aplicando cambios del repositorio (git reset)..." "" "$STARTED" "" 15
log "--- git reset --hard origin/main ---"
if ! git -C "$PROJECT_DIR" reset --hard origin/main 2>&1; then
  write_state "error" "Error al aplicar cambios (git reset)" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 15
  log "ERROR: git reset fallo"
  exit 1
fi

# 4. Clean untracked files
git -C "$PROJECT_DIR" clean -fd 2>&1 || true
log "Cambios del repositorio aplicados"

NEW_COMMIT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
log "Nuevo commit: $NEW_COMMIT"

# 5. Verificar si el updater-controller necesita actualizarse
# CRITICO: Solo construir si hay cambios reales en sus archivos.
# NUNCA reiniciar el updater-controller durante la actualizacion -
# eso mataria este proceso. Si hay cambios, se reinicia al FINAL.
UPDATER_NEEDS_UPDATE=false
UPDATER_CHANGED=$(git -C "$PROJECT_DIR" diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'updater-controller|do_update\.sh|Dockerfile\.updater' || echo "")
if [ -n "$UPDATER_CHANGED" ]; then
  log "Cambios detectados en archivos del updater-controller: $UPDATER_CHANGED"
  check_cancelled
  write_state "running" "Construyendo nueva imagen updater-controller (sin reiniciarlo aun)..." "$NEW_COMMIT" "$STARTED" "" 20
  log "--- docker compose build updater-controller (sin reiniciar) ---"
  if docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" build updater-controller 2>&1; then
    log "Nueva imagen updater-controller construida (se reiniciara al final)"
    UPDATER_NEEDS_UPDATE=true
  else
    log "WARNING: build updater-controller fallo, continuando con imagen actual"
  fi
else
  log "Sin cambios en archivos del updater-controller. No se construye ni se reinicia."
fi

# 6. docker compose build node-app (30% -> 60%)
check_cancelled
write_state "running" "Construyendo imagen Docker del nodo (esto tarda varios minutos)..." "$NEW_COMMIT" "$STARTED" "" 30
log "--- docker compose build node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" build node-app 2>&1; then
  write_state "error" "Error al construir imagen node-app" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 30
  log "ERROR: docker build node-app fallo"
  exit 1
fi
log "Imagen node-app construida"
write_state "running" "Imagen del nodo construida. Construyendo demo-app..." "$NEW_COMMIT" "$STARTED" "" 60

# 7. docker compose build demo-app (65%)
write_state "running" "Construyendo imagen demo-app..." "$NEW_COMMIT" "$STARTED" "" 65
log "--- docker compose build demo-app ---"
docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" --profile demo build demo-app 2>&1 || true
log "Imagen demo-app construida (o cacheada)"

# 8. Restart node-app (70% -> 85%)
check_cancelled
write_state "running" "Reiniciando nodo..." "$NEW_COMMIT" "$STARTED" "" 70
log "--- docker compose up -d node-app ---"
if ! docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps node-app 2>&1; then
  write_state "error" "Error al reiniciar nodo" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 70
  log "ERROR: docker up node-app fallo"
  exit 1
fi
log "Nodo reiniciado"
write_state "running" "Nodo reiniciado. Verificando demo-app..." "$NEW_COMMIT" "$STARTED" "" 85

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

# 10. Si el updater-controller necesita actualizarse, reiniciarlo AHORA (al final)
# Esto mata este proceso, pero la actualizacion ya esta completa.
if [ "$UPDATER_NEEDS_UPDATE" = "true" ]; then
  write_state "running" "Reiniciando updater-controller con nueva imagen (ultimo paso)..." "$NEW_COMMIT" "$STARTED" "" 90
  log "=== REINICIANDO UPDATER-CONTROLLER CON NUEVA IMAGEN ==="
  log "NOTA: Este proceso se detendra porque el updater-controller se reinicia."
  log "La actualizacion ya esta completa. El updater-controller arrancara con la nueva imagen."
  # Marcar como completado ANTES de reiniciar, porque este proceso morira
  write_state "completed" "Nodo actualizado. Updater-controller reiniciandose con nueva imagen." "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 95
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps --force-recreate updater-controller 2>&1 || true
  # Este proceso muere aqui. El estado ya dice "completed".
  exit 0
fi

# 11. Asegurar que el updater-controller siga corriendo (sin forzar recreate)
# Solo lo arranca si esta detenido, no lo recrea si ya esta corriendo
UPDATER_RUNNING=$(docker inspect -f '{{.State.Running}}' "${PROJECT_NAME}-updater-controller-1" 2>/dev/null || echo "false")
if [ "$UPDATER_RUNNING" != "true" ]; then
  log "Updater-controller no estaba corriendo. Arrancandolo..."
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps updater-controller 2>&1 || true
fi

log "=== ACTUALIZACION COMPLETADA ==="
write_state "completed" "Nodo actualizado y reiniciado correctamente" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 100
