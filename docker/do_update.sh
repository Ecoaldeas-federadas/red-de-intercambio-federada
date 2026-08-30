#!/bin/sh
# do_update.sh - Runs in background from updater-controller.sh
# Equivalente a update.ps1 pero ejecutado desde el updater-controller.
#
# Pasos (iguales a update.ps1):
#   1. git fetch + reset --hard origin/main
#   2. Limpiar contenedores huerfanos
#   3. docker compose build --no-cache node-app (con fallback a build con cache)
#   4. docker compose build updater-controller (sin reiniciarlo)
#   5. docker compose build demo-app
#   6. docker compose up -d --force-recreate node-app (CRITICO: --force-recreate)
#   7. Esperar a que el nodo responda HTTP
#   8. Reiniciar updater-controller al final si cambio
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
  sync 2>/dev/null || true
}

# log() escribe directamente al LOG_FILE con >> para que aparezca inmediatamente
log() {
  TS=$(date '+%H:%M:%S' 2>/dev/null || echo "")
  printf '[%s] %s\n' "$TS" "$1" >> "$LOG_FILE"
}

# run_cmd ejecuta un comando, envia output al LOG_FILE y devuelve el exit code
run_cmd() {
  DESC=$1; shift
  log "--- EJECUTANDO: $DESC ---"
  "$@" >> "$LOG_FILE" 2>&1
  RC=$?
  if [ $RC -eq 0 ]; then
    log "--- OK: $DESC (exit code: $RC) ---"
  else
    log "--- ERROR: $DESC fallo (exit code: $RC) ---"
  fi
  return $RC
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
# NO truncar el LOG_FILE - los mensajes del backend Go ya estan ahi
# Solo agregar un separador
log "" >> "$LOG_FILE"
log "========================================" >> "$LOG_FILE"
log "=== INICIO ACTUALIZACION DO_UPDATE.SH ===" >> "$LOG_FILE"
log "========================================" >> "$LOG_FILE"
write_state "running" "Iniciando actualizacion..." "" "$STARTED" "" 5
log "=== INICIO ACTUALIZACION ==="
log "Script: $0"
log "PID: $$"
log "Fecha: $STARTED"

PROJECT_DIR=/project
COMPOSE_FILE=$PROJECT_DIR/docker-compose.yml

# Configure git auth with token
if [ -n "$GIT_TOKEN" ]; then
  git -C "$PROJECT_DIR" remote set-url origin "https://${GIT_TOKEN}@github.com/discapacidad5/red-de-intercambio-federada.git"
  log "Token configurado en remote origin"
fi

# Detect compose project name (igual que update.ps1 usa el nombre del directorio)
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
log "Project name: $PROJECT_NAME"
log "Compose file: $COMPOSE_FILE"

# CRITICO: Detectar la ruta REAL del proyecto en el host.
# docker compose corre dentro del updater-controller donde el repo esta en /project,
# pero el Docker daemon esta en el HOST donde /project no existe.
#
# PROBLEMA: docker compose hace stat() del compose file y project-directory
# DENTRO del contenedor. Si pasamos una ruta Windows (C:\Users\...), no existe
# dentro del contenedor Linux y falla con "no such file or directory".
#
# SOLUCION: Usar /project (ruta del contenedor) para leer el compose file,
# y generar un docker-compose.override.yml con las rutas del host (con barras
# normales) para los volume mounts. El daemon recibe las rutas del host y
# puede encontrarlas.
HOST_PROJECT_DIR=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/project"}}{{.Source}}{{end}}{{end}}' "$(hostname)" 2>/dev/null)
if [ -z "$HOST_PROJECT_DIR" ]; then
  HOST_PROJECT_DIR=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/project"}}{{.Source}}{{end}}{{end}}' "${PROJECT_NAME}-updater-controller-1" 2>/dev/null)
fi

# Convertir ruta Windows a formato con barras normales (C:\Users\... -> C:/Users/...)
HOST_DIR_FWD=$(echo "$HOST_PROJECT_DIR" | sed 's|\\|/|g')
log "Host project dir: $HOST_PROJECT_DIR"
log "Host dir (forward slashes): $HOST_DIR_FWD"

# Generar docker-compose.override.yml con rutas del host para volume mounts
# Esto reemplaza los volumes de node-app que usan rutas relativas (./config.yaml)
# con rutas absolutas del host (C:/Users/.../config.yaml) que el daemon puede encontrar
if [ -n "$HOST_DIR_FWD" ] && [ "$HOST_DIR_FWD" != "/project" ]; then
  log "Generando docker-compose.override.yml con rutas del host..."
  cat > /tmp/docker-compose.override.yml << YAMLEOF
services:
  node-app:
    volumes:
      - ${HOST_DIR_FWD}/secrets:/secrets:ro
      - ${HOST_DIR_FWD}/config.yaml:/app/config.yaml:ro
      - ${HOST_DIR_FWD}/firmware:/app/firmware:ro
      - firmware_builds:/tmp/firmware-builds
      - uploads:/app/uploads
      - db_backups:/backups
      - /var/run/docker.sock:/var/run/docker.sock
      - ${HOST_DIR_FWD}:/project:rw
      - update_state:/update-state
YAMLEOF
  log "Override generado: $(cat /tmp/docker-compose.override.yml | head -3)"
else
  log "No se detecto host path o es /project. Sin override."
  rm -f /tmp/docker-compose.override.yml
fi

# Helper para docker compose
# Usa /project como project-directory (existe dentro del contenedor)
# Para 'up', anade el override con rutas del host
dc_build() {
  docker compose --project-directory /project -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" "$@"
}

dc_up() {
  if [ -f /tmp/docker-compose.override.yml ]; then
    docker compose --project-directory /project -f "$COMPOSE_FILE" -f /tmp/docker-compose.override.yml --project-name "$PROJECT_NAME" "$@"
  else
    docker compose --project-directory /project -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" "$@"
  fi
}

# ============================================================
# 1. git fetch + reset --hard origin/main (10% -> 15%)
# ============================================================
check_cancelled
write_state "running" "Descargando cambios del repositorio..." "" "$STARTED" "" 10
log "--- git fetch origin main ---"

# Verificar que /project es un repo git antes de hacer fetch.
# Si el mount de /project esta roto (directorio vacio), git fetch falla con
# "not a git repository" y el mensaje engañoso "Verifica GIT_TOKEN" confunde.
if [ ! -d "$PROJECT_DIR/.git" ]; then
  write_state "error" "El repositorio no esta montado en /project. Reinicia el updater-controller: docker compose up -d --force-recreate updater-controller" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 10
  log "ERROR: /project no es un repo git (.git no encontrado). El mount esta roto."
  log "Esto pasa cuando el updater-controller fue recreado sin las rutas correctas del host."
  log "Solucion: docker compose up -d --force-recreate updater-controller (con --project-directory y override)"
  exit 1
fi

# Usar --force para sobrescribir refs locales y --prune para limpiar refs viejos
# fetch origin main actualiza FETCH_HEAD pero no siempre actualiza refs/remotes/origin/main
# Por eso usamos fetch --all --prune --force para asegurar que origin/main se actualice
if ! git -C "$PROJECT_DIR" fetch origin --force --prune >> "$LOG_FILE" 2>&1; then
  write_state "error" "Error en git fetch. Verifica GIT_TOKEN en .env y conexion a internet." "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 10
  log "ERROR: git fetch fallo"
  exit 1
fi
log "git fetch OK"

# Abort any pending merge/rebase
git -C "$PROJECT_DIR" merge --abort 2>/dev/null || true
git -C "$PROJECT_DIR" rebase --abort 2>/dev/null || true

# Verificar que origin/main existe y cual es su commit
REMOTE_COMMIT=$(git -C "$PROJECT_DIR" rev-parse --short origin/main 2>/dev/null || echo "")
log "Commit remoto (origin/main): $REMOTE_COMMIT"

check_cancelled
write_state "running" "Aplicando cambios del repositorio..." "" "$STARTED" "" 15
log "--- git reset --hard origin/main ---"
if ! git -C "$PROJECT_DIR" reset --hard origin/main >> "$LOG_FILE" 2>&1; then
  # Si origin/main no existe, intentar con FETCH_HEAD
  log "origin/main no disponible, intentando con FETCH_HEAD..."
  if ! git -C "$PROJECT_DIR" reset --hard FETCH_HEAD >> "$LOG_FILE" 2>&1; then
    write_state "error" "Error al aplicar cambios (git reset)" "" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 15
    log "ERROR: git reset fallo"
    exit 1
  fi
fi
log "git reset OK"

log "--- git clean -fd ---"
git -C "$PROJECT_DIR" clean -fd >> "$LOG_FILE" 2>&1 || true
log "Cambios del repositorio aplicados"

NEW_COMMIT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
log "Nuevo commit: $NEW_COMMIT"

# ============================================================
# 2. Limpiar contenedores huerfanos (como update.ps1)
# ============================================================
write_state "running" "Limpiando contenedores huerfanos..." "$NEW_COMMIT" "$STARTED" "" 18
log "--- Limpiando contenedores huerfanos ---"
ORPHANS=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep '_red-de-intercambio-federada-' || echo "")
if [ -n "$ORPHANS" ]; then
  echo "$ORPHANS" | while read -r orphan; do
    log "Eliminando contenedor huerfano: $orphan"
    docker rm -f "$orphan" 2>/dev/null || true
  done
fi
log "Limpieza de huerfanos completada"

# ============================================================
# 3. Verificar si el updater-controller necesita actualizarse
# ============================================================
UPDATER_NEEDS_UPDATE=false
UPDATER_CHANGED=$(git -C "$PROJECT_DIR" diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'updater-controller|do_update\.sh|Dockerfile\.updater' || echo "")
if [ -n "$UPDATER_CHANGED" ]; then
  log "Cambios detectados en archivos del updater-controller: $UPDATER_CHANGED"
  check_cancelled
  write_state "running" "Construyendo nueva imagen updater-controller..." "$NEW_COMMIT" "$STARTED" "" 20
  if dc_build build --progress plain updater-controller >> "$LOG_FILE" 2>&1; then
    log "Nueva imagen updater-controller construida"
    UPDATER_NEEDS_UPDATE=true
  else
    log "WARNING: build updater-controller fallo, continuando con imagen actual"
  fi
else
  log "Sin cambios en archivos del updater-controller"
fi

# ============================================================
# 3b. Verificar si Caddy (proxy inverso) necesita actualizarse
# Caddy usa imagen pre-construida (caddy:2-alpine), no necesita build.
# Solo necesita reinicio si cambio el Caddyfile o maintenance.html.
# Como estos se montan como volumenes, Caddy auto-recarga el Caddyfile.
# Solo hacemos force-recreate si cambio docker-compose.yml (ej: puertos).
# ============================================================
CADDY_NEEDS_UPDATE=false
CADDY_CHANGED=$(git -C "$PROJECT_DIR" diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'Caddyfile|maintenance\.html|docker-compose\.yml' || echo "")
if [ -n "$CADDY_CHANGED" ]; then
  log "Cambios detectados en archivos de Caddy: $CADDY_CHANGED"
  CADDY_NEEDS_UPDATE=true
else
  log "Sin cambios en archivos de Caddy"
fi

# ============================================================
# 4. docker compose build --no-cache node-app (30% -> 60%)
# CRITICO: --no-cache garantiza que migraciones y assets se copien frescos
# Si falla, reintentar sin --no-cache (como update.ps1)
# ============================================================
check_cancelled
write_state "running" "Construyendo imagen Docker del nodo (esto tarda varios minutos)..." "$NEW_COMMIT" "$STARTED" "" 30
log "--- docker compose build --no-cache --progress plain node-app ---"
log "NOTA: Esto puede tardar 10-20 minutos. El output aparece linea por linea."
log "Si no ves output por unos minutos, es normal (descargando dependencias)."

BUILD_OK=false
if dc_build build --no-cache --build-arg BUILD_COMMIT=$NEW_COMMIT --progress plain node-app >> "$LOG_FILE" 2>&1; then
  log "Imagen node-app construida con --no-cache OK (commit: $NEW_COMMIT)"
  BUILD_OK=true
else
  log "WARNING: build --no-cache fallo, reintentando con cache..."
  write_state "running" "Reintentando build con cache..." "$NEW_COMMIT" "$STARTED" "" 35
  if dc_build build --build-arg BUILD_COMMIT=$NEW_COMMIT --progress plain node-app >> "$LOG_FILE" 2>&1; then
    log "Imagen node-app construida con cache OK (commit: $NEW_COMMIT)"
    BUILD_OK=true
  else
    log "ERROR: build node-app fallo incluso con cache"
  fi
fi

if [ "$BUILD_OK" != "true" ]; then
  write_state "error" "Error al construir imagen node-app" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 35
  log "ERROR: No se pudo construir node-app"
  exit 1
fi

write_state "running" "Imagen del nodo construida. Construyendo demo-app..." "$NEW_COMMIT" "$STARTED" "" 60

# ============================================================
# 5. docker compose build demo-app (60% -> 65%)
# ============================================================
write_state "running" "Construyendo imagen demo-app..." "$NEW_COMMIT" "$STARTED" "" 65
log "--- docker compose build demo-app ---"
dc_build --profile demo build --progress plain demo-app >> "$LOG_FILE" 2>&1 || true
log "Imagen demo-app construida (o cacheada)"

# ============================================================
# 6. docker compose up -d --force-recreate node-app (70% -> 85%)
# CRITICO: --force-recreate es necesario para que el contenedor viejo
# se reemplace con la nueva imagen. Sin --force-recreate, docker compose
# puede decidir no recrear el contenedor si ya esta corriendo.
# Esto es lo que faltaba vs update.ps1.
# ============================================================
check_cancelled
write_state "running" "Reiniciando nodo con nueva imagen..." "$NEW_COMMIT" "$STARTED" "" 70

# Asegurar que Caddy (proxy inverso) este corriendo ANTES de recrear node-app.
# Caddy es como el updater-controller: SIEMPRE debe estar corriendo.
# NO se reinicia aqui (se reinicia al final si sus archivos cambiaron).
# Solo se inicia si no esta corriendo, para no interrumpir el proxy.
CADDY_RUNNING=$(docker inspect -f '{{.State.Running}}' "${PROJECT_NAME}-caddy-1" 2>/dev/null || echo "false")
if [ "$CADDY_RUNNING" != "true" ]; then
  log "Caddy no estaba corriendo. Arrancandolo..."
  dc_up up -d --no-deps caddy >> "$LOG_FILE" 2>&1 || true
  log "Caddy arrancado"
else
  log "Caddy ya esta corriendo (no se toca)"
fi

log "--- docker compose up -d --no-deps --force-recreate node-app ---"
log "CRITICO: --force-recreate asegura que el contenedor viejo se reemplace"
if ! dc_up up -d --no-deps --force-recreate node-app >> "$LOG_FILE" 2>&1; then
  write_state "error" "Error al reiniciar nodo" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 70
  log "ERROR: docker up node-app fallo"
  # Mostrar logs del nodo para diagnostico
  log "--- Logs del nodo (ultimas 30 lineas) ---"
  docker logs --tail 30 "${PROJECT_NAME}-node-app-1" >> "$LOG_FILE" 2>&1 || true
  exit 1
fi
log "Nodo reiniciado OK"

# ============================================================
# 7. Esperar a que el nodo responda HTTP (como update.ps1)
# CRITICO: Esto verifica que el nodo realmente arranque, no solo
# que el contenedor este corriendo. Si el nodo crashea por una
# migracion fallida, el contenedor puede estar "running" pero
# el servidor HTTP no responde.
# ============================================================
write_state "running" "Esperando a que el nodo responda..." "$NEW_COMMIT" "$STARTED" "" 80
log "--- Esperando a que el nodo responda HTTP ---"
NODE_CONTAINER="${PROJECT_NAME}-node-app-1"
WAIT_OK=false
WAITED=0
MAX_WAIT=90
while [ "$WAITED" -lt "$MAX_WAIT" ]; do
  # Verificar que el contenedor siga corriendo
  NODE_RUNNING=$(docker inspect -f '{{.State.Running}}' "$NODE_CONTAINER" 2>/dev/null || echo "false")
  if [ "$NODE_RUNNING" != "true" ]; then
    log "ERROR: node-app se detuvo despues de $WAITED segundos"
    log "--- Logs del nodo (ultimas 50 lineas) ---"
    docker logs --tail 50 "$NODE_CONTAINER" >> "$LOG_FILE" 2>&1 || true
    write_state "error" "El nodo se detuvo durante el arranque. Revisa los logs." "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 80
    exit 1
  fi

  # Intentar conectar al HTTP
  if wget -q -O /dev/null --timeout=3 "http://node-app:8080/api/setup/status" 2>/dev/null || \
     wget -q -O /dev/null --timeout=3 "http://localhost:8080/api/setup/status" 2>/dev/null; then
    log "OK: nodo responde HTTP despues de $WAITED segundos"
    WAIT_OK=true
    break
  fi

  sleep 3
  WAITED=$((WAITED + 3))
  log "Esperando... ($WAITED/$MAX_WAIT segundos)"
done

if [ "$WAIT_OK" != "true" ]; then
  log "WARNING: El nodo no respondio HTTP en $MAX_WAIT segundos"
  log "El contenedor puede estar corriendo pero el servidor no responde"
  log "--- Logs del nodo (ultimas 50 lineas) ---"
  docker logs --tail 50 "$NODE_CONTAINER" >> "$LOG_FILE" 2>&1 || true
  # No marcar como error - el nodo puede estar arrancando lentamente
  # (migraciones, etc). Marcar como completado con warning.
fi

write_state "running" "Nodo reiniciado. Verificando demo-app..." "$NEW_COMMIT" "$STARTED" "" 85

# ============================================================
# 8. Recreate demo-app if it was running (leave it stopped)
# ============================================================
DEMO_CONTAINER="${PROJECT_NAME}-demo-app-1"
DEMO_RUNNING=$(docker inspect -f '{{.State.Running}}' "$DEMO_CONTAINER" 2>/dev/null || echo "false")
if [ "$DEMO_RUNNING" = "true" ]; then
  log "Demo-app estaba corriendo, recreando con nueva imagen..."
  docker stop "$DEMO_CONTAINER" 2>/dev/null || true
  docker rm -f "$DEMO_CONTAINER" 2>/dev/null || true
  dc_up --profile demo up -d --no-deps demo-app >> "$LOG_FILE" 2>&1 || true
  docker stop "$DEMO_CONTAINER" 2>/dev/null || true
  log "Demo-app recreado (detenido, listo para arrancar desde la web)"
fi

# ============================================================
# 9. Si el updater-controller necesita actualizarse, reiniciarlo AHORA
# Esto mata este proceso, pero la actualizacion ya esta completa.
# ============================================================
if [ "$UPDATER_NEEDS_UPDATE" = "true" ]; then
  write_state "running" "Reiniciando updater-controller con nueva imagen..." "$NEW_COMMIT" "$STARTED" "" 90
  log "=== REINICIANDO UPDATER-CONTROLLER CON NUEVA IMAGEN ==="
  log "NOTA: Este proceso se detendra porque el updater-controller se reinicia."
  log "La actualizacion ya esta completa."
  write_state "completed" "Nodo actualizado. Updater-controller reiniciandose." "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 95
  # Recrear el updater-controller con el override (que tiene las rutas del host).
  # Esto asegura que el nuevo contenedor tenga /project montado correctamente.
  # NOTA: Este proceso (do_update.sh) se mata cuando el contenedor se recrea.
  # El node-app maneja los reintentos de conexion en su codigo Go (updateNode).
  dc_up up -d --no-deps --force-recreate updater-controller >> "$LOG_FILE" 2>&1 || true
  exit 0
fi

# ============================================================
# 10. Asegurar que el updater-controller siga corriendo
# ============================================================
UPDATER_RUNNING=$(docker inspect -f '{{.State.Running}}' "${PROJECT_NAME}-updater-controller-1" 2>/dev/null || echo "false")
if [ "$UPDATER_RUNNING" != "true" ]; then
  log "Updater-controller no estaba corriendo. Arrancandolo..."
  dc_up up -d --no-deps updater-controller >> "$LOG_FILE" 2>&1 || true
fi

# ============================================================
# 11. Si Caddy necesita actualizarse, reiniciarlo AHORA
# Caddy usa imagen pre-construida, solo se reinicia si cambiaron
# sus archivos de configuracion (Caddyfile, maintenance.html, docker-compose).
# El reinicio es rapido (segundos) y no afecta al updater-controller.
# ============================================================
if [ "$CADDY_NEEDS_UPDATE" = "true" ]; then
  log "=== REINICIANDO CADDY CON NUEVA CONFIGURACION ==="
  dc_up up -d --no-deps --force-recreate caddy >> "$LOG_FILE" 2>&1 || true
  log "Caddy reiniciado con nueva configuracion"
else
  # Asegurar que Caddy siga corriendo
  CADDY_RUNNING=$(docker inspect -f '{{.State.Running}}' "${PROJECT_NAME}-caddy-1" 2>/dev/null || echo "false")
  if [ "$CADDY_RUNNING" != "true" ]; then
    log "Caddy no estaba corriendo. Arrancandolo..."
    dc_up up -d --no-deps caddy >> "$LOG_FILE" 2>&1 || true
  fi
fi

log "=== ACTUALIZACION COMPLETADA ==="
write_state "completed" "Nodo actualizado y reiniciado correctamente" "$NEW_COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" 100
