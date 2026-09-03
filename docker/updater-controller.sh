#!/bin/sh
# updater-controller.sh - Handles one HTTP request per invocation.
# Called by socat for each incoming connection on port 9110.
# stdin = request from client, stdout = response to client.
# Los logs van a stderr para que aparezcan en `docker logs updater-controller`

STATE_DIR=/update-state
STATE_FILE=$STATE_DIR/update.json
LOG_FILE=$STATE_DIR/update.log

# Funcion de log a stderr (aparece en docker logs)
log_msg() {
  echo "[$(date '+%H:%M:%S')] $1" >&2
}

# Read entire HTTP request from stdin
REQUEST=""
while IFS= read -r line 2>/dev/null; do
  REQUEST="$REQUEST$line\n"
  # Detect end of headers (blank line)
  CLEAN=$(echo "$line" | tr -d '\r\n')
  if [ -z "$CLEAN" ]; then
    break
  fi
done

# Parse first line: METHOD PATH HTTP/1.1
REQUEST_LINE=$(echo "$REQUEST" | head -1 | tr -d '\r\n')
METHOD=$(echo "$REQUEST_LINE" | awk '{print $1}')
PATH_REQ=$(echo "$REQUEST_LINE" | awk '{print $2}')

send_response() {
  BODY="$1"
  LEN=$(printf '%s' "$BODY" | wc -c)
  printf 'HTTP/1.1 200 OK\r\n'
  printf 'Content-Type: application/json\r\n'
  printf 'Access-Control-Allow-Origin: *\r\n'
  printf 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
  printf 'Access-Control-Allow-Headers: Content-Type, Authorization\r\n'
  printf 'Content-Length: %d\r\n' "$LEN"
  printf '\r\n'
  printf '%s' "$BODY"
}

send_html() {
  BODY="$1"
  LEN=$(printf '%s' "$BODY" | wc -c)
  printf 'HTTP/1.1 200 OK\r\n'
  printf 'Content-Type: text/html; charset=utf-8\r\n'
  printf 'Access-Control-Allow-Origin: *\r\n'
  printf 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
  printf 'Access-Control-Allow-Headers: Content-Type, Authorization\r\n'
  printf 'Content-Length: %d\r\n' "$LEN"
  printf '\r\n'
  printf '%s' "$BODY"
}

# Escape string for JSON (handle newlines, quotes, backslashes)
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g'
}

# Detect compose project name
detect_project_name() {
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
  echo "$PROJECT_NAME"
}

# Check if demo-app container is running
check_node_status() {
  PROJECT_NAME=$(detect_project_name)
  # Intentar varios nombres posibles de contenedor demo
  DEMO_CONTAINER=""
  for CANDIDATE in "${PROJECT_NAME}-demo-app-1" "demo-app" "red-de-intercambio-federada-demo-app-1"; do
    if docker inspect -f '{{.State.Status}}' "$CANDIDATE" 2>/dev/null | grep -qE '^(running|created|exited|restarting|paused)$'; then
      DEMO_CONTAINER="$CANDIDATE"
      break
    fi
  done
  # Si no se encontro por nombre exacto, buscar por patron
  if [ -z "$DEMO_CONTAINER" ]; then
    DEMO_CONTAINER=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep 'demo-app' | grep -v 'controller\|stopper' | head -1)
  fi
  if [ -z "$DEMO_CONTAINER" ]; then
    echo '{"running":false,"status":"not-found","container":"not-found"}'
  else
    RUNNING=$(docker inspect -f '{{.State.Running}}' "$DEMO_CONTAINER" 2>/dev/null || echo "false")
    STATUS=$(docker inspect -f '{{.State.Status}}' "$DEMO_CONTAINER" 2>/dev/null || echo "not-found")
    echo '{"running":'"$RUNNING"',"status":"'"$STATUS"'","container":"'"$DEMO_CONTAINER"'"}'
  fi
}

# Verificar token de acceso si UPDATER_TOKEN esta configurado
# Si no hay token configurado, acceso libre (backwards compatible)
check_token() {
  if [ -z "$UPDATER_TOKEN" ]; then
    return 0
  fi
  # Extraer token de query string
  QUERY_TOKEN=$(echo "$PATH_REQ" | sed -n 's/.*token=\([^&]*\).*/\1/p')
  # Extraer token de Authorization header
  AUTH_TOKEN=""
  if echo "$REQUEST" | grep -qi 'Authorization: Bearer '; then
    AUTH_TOKEN=$(echo "$REQUEST" | grep -i 'Authorization: Bearer ' | sed 's/.*Authorization: Bearer \([^[:space:]]*\).*/\1/' | tr -d '\r\n')
  fi
  if [ "$QUERY_TOKEN" = "$UPDATER_TOKEN" ] || [ "$AUTH_TOKEN" = "$UPDATER_TOKEN" ]; then
    return 0
  fi
  return 1
}

# === RUTAS ===

# Manejar OPTIONS preflight de CORS
if [ "$METHOD" = "OPTIONS" ]; then
  printf 'HTTP/1.1 204 No Content\r\n'
  printf 'Access-Control-Allow-Origin: *\r\n'
  printf 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
  printf 'Access-Control-Allow-Headers: Content-Type, Authorization\r\n'
  printf 'Access-Control-Max-Age: 86400\r\n'
  printf '\r\n'
  exit 0
fi

# Pagina HTML de control (GET /)
if [ "$METHOD" = "GET" ] && { [ "$PATH_REQ" = "/" ] || [ "$PATH_REQ" = "/index.html" ] || [ "$(echo "$PATH_REQ" | sed 's/\?.*//')" = "/" ]; }; then
  # Verificar token si esta configurado
  if ! check_token; then
    log_msg "Acceso denegado: token invalido o ausente"
    printf 'HTTP/1.1 401 Unauthorized\r\n'
    printf 'Content-Type: text/html; charset=utf-8\r\n'
    printf 'Access-Control-Allow-Origin: *\r\n'
    printf '\r\n'
    printf '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Acceso denegado</title></head>'
    printf '<body style="font-family:system-ui;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">'
    printf '<div style="background:#fff;border-radius:1rem;padding:2rem;max-width:400px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,.1);border:1px solid #d1fae5">'
    printf '<h1 style="color:#991b1b;font-size:1.25rem">Acceso denegado</h1>'
    printf '<p style="color:#6b7280;font-size:.8rem;margin-top:.5rem">Se requiere un token de acceso para usar el panel de control del nodo.</p>'
    printf '<p style="color:#9ca3af;font-size:.7rem;margin-top:1rem">Accede con: /updater/?token=TU_TOKEN</p>'
    printf '</div></body></html>'
    exit 0
  fi
  log_msg "Sirviendo pagina de control HTML"
  # El HTML se sirve desde un archivo separado para evitar el problema de
  # comillas simples del JavaScript dentro de un string de shell.
  # Buscar en volume mount primero (hot-reload), luego en Docker copy.
  HTML_FILE=""
  for CANDIDATE in /project/docker/updater.html /updater.html; do
    if [ -f "$CANDIDATE" ]; then
      HTML_FILE="$CANDIDATE"
      break
    fi
  done
  if [ -n "$HTML_FILE" ]; then
    LEN=$(wc -c < "$HTML_FILE")
    printf 'HTTP/1.1 200 OK\r\n'
    printf 'Content-Type: text/html; charset=utf-8\r\n'
    printf 'Access-Control-Allow-Origin: *\r\n'
    printf 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
    printf 'Access-Control-Allow-Headers: Content-Type, Authorization\r\n'
    printf 'Content-Length: %d\r\n' "$LEN"
    printf '\r\n'
    cat "$HTML_FILE"
  else
    send_html '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Error: updater.html no encontrado</h1></body></html>'
  fi
  exit 0
fi

# === API endpoints ===

# Verificar token para todos los endpoints de API (excepto OPTIONS ya manejado)
if ! check_token; then
  log_msg "API: acceso denegado - token invalido"
  send_response '{"success":false,"message":"Token requerido"}'
  exit 0
fi

if echo "$PATH_REQ" | grep -q '^/update$'; then
  log_msg "Peticion /update recibida"
  CURRENT_STATUS=""
  if [ -f "$STATE_FILE" ]; then
    CURRENT_STATUS=$(grep -o '"status":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"status":"//;s/"//')
  fi
  if [ "$CURRENT_STATUS" = "running" ]; then
    log_msg "Rechazado: ya hay actualizacion en curso"
    send_response '{"success":false,"message":"Ya hay una actualizacion en curso"}'
  else
    # CRITICO: Escribir 'running' al state file ANTES de iniciar do_update.sh
    # Si no, el frontend puede hacer polling y ver el estado 'completed' de la
    # actualizacion anterior, marcando prematuramente como completada.
    STARTED_TS=$(date -Iseconds 2>/dev/null || date)
    echo "{\"status\":\"running\",\"message\":\"Iniciando actualizacion...\",\"commit\":\"\",\"started\":\"$STARTED_TS\",\"ended\":\"\",\"progress\":2}" > "$STATE_FILE"
    log_msg "Estado 'running' escrito antes de iniciar do_update.sh"
    # do_update.sh escribe directamente al LOG_FILE con >>
    # stdout va a /dev/null para evitar duplicacion
    nohup /do_update.sh > /dev/null 2>&1 &
    UPDATE_PID=$!
    echo "$UPDATE_PID" > "$STATE_DIR/update.pid"
    # tail -f muestra el LOG_FILE en docker logs (stderr)
    nohup tail -f "$LOG_FILE" >&2 &
    log_msg "do_update.sh iniciado en background (PID=$UPDATE_PID)"
    sleep 2
    send_response '{"success":true,"message":"Actualizacion iniciada. El nodo se reiniciara automaticamente."}'
  fi

elif echo "$PATH_REQ" | grep -q '^/status$'; then
  STATUS="idle"
  MESSAGE=""
  COMMIT=""
  PROGRESS="0"
  if [ -f "$STATE_FILE" ]; then
    STATUS=$(grep -o '"status":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"status":"//;s/"//')
    MESSAGE=$(grep -o '"message":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"message":"//;s/"//')
    COMMIT=$(grep -o '"commit":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"commit":"//;s/"//')
    PROGRESS=$(grep -o '"progress":[0-9]*' "$STATE_FILE" | head -1 | sed 's/"progress"://' )
    if [ -z "$PROGRESS" ]; then PROGRESS="0"; fi

    # DETECTAR ESTADO STALE: si status=running pero el proceso murio,
    # el estado es stale (quedo pegado de una actualizacion fallida).
    # Esto pasa cuando el updater-controller fue recreado o el proceso murio.
    if [ "$STATUS" = "running" ]; then
      PID_ALIVE=false
      if [ -f "$STATE_DIR/update.pid" ]; then
        PID=$(cat "$STATE_DIR/update.pid" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
          PID_ALIVE=true
        fi
      fi
      if [ "$PID_ALIVE" != "true" ]; then
        # El proceso murio pero el estado dice running -> stale
        log_msg "Estado stale detectado: status=running pero PID no existe. Marcando como error."
        STARTED=$(grep -o '"started_at":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"started_at":"//;s/"//')
        printf '{"status":"error","message":"Actualizacion interrumpida (proceso murio). Click en Reset para limpiar.","commit":"%s","started_at":"%s","completed_at":"%s","progress":0}' \
          "$COMMIT" "$STARTED" "$(date -Iseconds 2>/dev/null || date)" > "$STATE_FILE"
        STATUS="error"
        MESSAGE="Actualizacion interrumpida (proceso murio). Click en Reset para limpiar."
        rm -f "$STATE_DIR/update.pid"
      fi
    fi
  fi
  LOG=""
  if [ -f "$LOG_FILE" ]; then
    LOG=$(json_escape "$(cat "$LOG_FILE")")
  fi
  send_response "{\"status\":\"$STATUS\",\"message\":\"$MESSAGE\",\"commit\":\"$COMMIT\",\"progress\":$PROGRESS,\"log\":\"$LOG\"}"

elif echo "$PATH_REQ" | grep -q '^/reset$'; then
  log_msg "Peticion /reset - limpiando estado de actualizacion"
  # Matar el PID guardado
  if [ -f "$STATE_DIR/update.pid" ]; then
    PID=$(cat "$STATE_DIR/update.pid" 2>/dev/null)
    if [ -n "$PID" ]; then
      kill "$PID" 2>/dev/null || true
      kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$STATE_DIR/update.pid"
  fi
  # Matar TODOS los procesos do_update.sh residuales (pkill -f)
  # Esto es critico: puede haber procesos do_update.sh huerfanos
  # que siguen escribiendo "running" al archivo de estado
  pkill -f do_update.sh 2>/dev/null || true
  kill -9 $(pgrep -f do_update.sh 2>/dev/null) 2>/dev/null || true
  # Resetear estado a idle
  printf '{"status":"idle","message":"","commit":"","started_at":"","completed_at":"","progress":0}' > "$STATE_FILE"
  # Limpiar log
  : > "$LOG_FILE"
  log_msg "Estado reseteado OK"
  send_response '{"success":true,"message":"Estado reseteado. Ya puedes actualizar de nuevo."}'

elif echo "$PATH_REQ" | grep -q '^/node-status$'; then
  RESULT=$(check_node_status)
  log_msg "Node status: $RESULT"
  send_response "$RESULT"

elif echo "$PATH_REQ" | grep -q '^/start$'; then
  log_msg "Peticion /start - arrancando demo-app"
  PROJECT_NAME=$(detect_project_name)
  COMPOSE_FILE=/project/docker-compose.yml
  # demo-app usa profile "demo", hay que pasar --profile demo
  OUTPUT=$(docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" --profile demo up -d --no-deps demo-app 2>&1)
  CODE=$?
  log_msg "start output: $OUTPUT"
  if [ $CODE -eq 0 ]; then
    send_response '{"success":true,"message":"Nodo Demo arrancado"}'
  else
    # Intentar docker start directo si ya existe el contenedor
    OUTPUT2=$(docker start "${PROJECT_NAME}-demo-app-1" 2>/dev/null || docker start "demo-app" 2>/dev/null || echo "")
    if [ -n "$OUTPUT2" ]; then
      send_response '{"success":true,"message":"Nodo Demo arrancado (docker start)"}'
    else
      send_response "{\"success\":false,\"message\":\"Error: $(json_escape "$OUTPUT")\"}"
    fi
  fi

elif echo "$PATH_REQ" | grep -q '^/stop$'; then
  log_msg "Peticion /stop - deteniendo demo-app"
  PROJECT_NAME=$(detect_project_name)
  OUTPUT=$(docker stop "${PROJECT_NAME}-demo-app-1" 2>/dev/null || docker stop "demo-app" 2>/dev/null || echo "no encontrado")
  CODE=$?
  log_msg "stop output: $OUTPUT"
  if echo "$OUTPUT" | grep -q "no encontrado"; then
    send_response '{"success":false,"message":"Nodo Demo no encontrado"}'
  else
    send_response '{"success":true,"message":"Nodo Demo detenido"}'
  fi

elif echo "$PATH_REQ" | grep -q '^/restart$'; then
  log_msg "Peticion /restart - reiniciando demo-app"
  PROJECT_NAME=$(detect_project_name)
  OUTPUT=$(docker restart "${PROJECT_NAME}-demo-app-1" 2>/dev/null || docker restart "demo-app" 2>/dev/null || echo "no encontrado")
  CODE=$?
  log_msg "restart output: $OUTPUT"
  if echo "$OUTPUT" | grep -q "no encontrado"; then
    send_response '{"success":false,"message":"Nodo Demo no encontrado. Arrancalo primero."}'
  else
    send_response '{"success":true,"message":"Nodo Demo reiniciado"}'
  fi

elif echo "$PATH_REQ" | grep -q '^/cancel$'; then
  log_msg "Peticion /cancel recibida"
  if [ -f "$STATE_FILE" ]; then
    STARTED=$(grep -o '"started_at":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"started_at":"//;s/"//')
    COMMIT=$(grep -o '"commit":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"commit":"//;s/"//')
    printf '{"status":"cancelled","message":"Actualizacion cancelada por el usuario","commit":"%s","started_at":"%s","completed_at":""}' \
      "$COMMIT" "$STARTED" > "$STATE_FILE"
    echo "=== CANCELACION SOLICITADA ===" >> "$LOG_FILE"
    # Matar el PID guardado
    if [ -f "$STATE_DIR/update.pid" ]; then
      PID=$(cat "$STATE_DIR/update.pid" 2>/dev/null)
      if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null || true
        kill -9 "$PID" 2>/dev/null || true
      fi
      rm -f "$STATE_DIR/update.pid"
    fi
    # Matar TODOS los procesos do_update.sh residuales
    pkill -f do_update.sh 2>/dev/null || true
    kill -9 $(pgrep -f do_update.sh 2>/dev/null) 2>/dev/null || true
    send_response '{"success":true,"message":"Actualizacion cancelada"}'
  else
    send_response '{"success":false,"message":"No hay actualizacion en curso"}'
  fi

elif echo "$PATH_REQ" | grep -q '^/check$'; then
  log_msg "Peticion /check (verificar actualizaciones)"
  PROJECT_DIR=/project
  CURRENT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
  # Leer el commit instalado (con el que se construyo el node-app)
  INSTALLED=""
  if [ -f /update-state/installed-node-commit.txt ]; then
    INSTALLED=$(cat /update-state/installed-node-commit.txt | tr -d '[:space:]')
  fi
  # Si no hay commit instalado conocido, leer BUILD_COMMIT del contenedor
  if [ -z "$INSTALLED" ] || [ "$INSTALLED" = "unknown" ]; then
    PROJECT_NAME=$(detect_project_name)
    NODE_CONTAINER="${PROJECT_NAME}-node-app-1"
    BUILD_COMMIT=$(docker exec "$NODE_CONTAINER" cat /app/BUILD_COMMIT 2>/dev/null | tr -d '[:space:]')
    if [ -n "$BUILD_COMMIT" ] && [ "$BUILD_COMMIT" != "unknown" ]; then
      INSTALLED="$BUILD_COMMIT"
    fi
  fi
  # Si sigue sin conocerse, NO usar HEAD como fallback (HEAD se mueve al
  # actualizar servicios). Asumir que hay actualizaciones para forzar rebuild.
  if [ -z "$INSTALLED" ] || [ "$INSTALLED" = "unknown" ]; then
    INSTALLED="unknown"
  fi
  if [ -n "$GIT_TOKEN" ]; then
    git -C "$PROJECT_DIR" remote set-url origin "https://${GIT_TOKEN}@github.com/discapacidad5/red-de-intercambio-federada.git" 2>/dev/null
  fi
  git -C "$PROJECT_DIR" fetch origin main 2>/dev/null
  REMOTE=$(git -C "$PROJECT_DIR" rev-parse --short origin/main 2>/dev/null || echo "")
  NEW_COMMITS=""
  if [ "$INSTALLED" != "unknown" ] && [ -n "$REMOTE" ]; then
    NEW_COMMITS=$(git -C "$PROJECT_DIR" log --oneline "$INSTALLED..origin/main" 2>/dev/null || echo "")
  fi
  UPDATES="false"
  if [ "$INSTALLED" = "unknown" ]; then
    UPDATES="true"
  elif [ -n "$NEW_COMMITS" ] || [ "$INSTALLED" != "$REMOTE" -a -n "$REMOTE" ]; then
    UPDATES="true"
  fi
  NEW_ESC=$(json_escape "$NEW_COMMITS")
  send_response "{\"updates_available\":$UPDATES,\"current_commit\":\"$CURRENT\",\"installed_commit\":\"$INSTALLED\",\"remote_commit\":\"$REMOTE\",\"new_commits\":\"$NEW_ESC\"}"

else
  send_response '{"status":"updater-controller running","endpoints":["/","/update","/status","/node-status","/start","/stop","/restart","/cancel","/check","/reset"]}'
fi
