#!/bin/sh
# updater-controller.sh - Handles one HTTP request per invocation.
# Called by socat for each incoming connection on port 9110.
# stdin = request from client, stdout = response to client.

STATE_DIR=/update-state
STATE_FILE=$STATE_DIR/update.json
LOG_FILE=$STATE_DIR/update.log

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
  printf 'Content-Length: %d\r\n' "$LEN"
  printf '\r\n'
  printf '%s' "$BODY"
}

# Escape string for JSON (handle newlines, quotes, backslashes)
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g'
}

if echo "$PATH_REQ" | grep -q '^/update$'; then
  # Check if already running
  CURRENT_STATUS=""
  if [ -f "$STATE_FILE" ]; then
    CURRENT_STATUS=$(grep -o '"status":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"status":"//;s/"//')
  fi
  if [ "$CURRENT_STATUS" = "running" ]; then
    send_response '{"success":false,"message":"Ya hay una actualizacion en curso"}'
  else
    # Start update in background. Usar nohup para que el proceso sobreviva
    # cuando socat cierre esta conexion. Sin nohup, socat enviaria SIGHUP
    # al proceso hijo al cerrar, matando do_update.sh.
    nohup /do_update.sh >> "$LOG_FILE" 2>&1 &
    # Guardar el PID para poder cancelar si es necesario
    echo "$!" > "$STATE_DIR/update.pid"
    # Darle un momento para que empiece y escriba el estado inicial
    sleep 2
    send_response '{"success":true,"message":"Actualizacion iniciada. El nodo se reiniciara automaticamente."}'
  fi

elif echo "$PATH_REQ" | grep -q '^/status$'; then
  STATUS="idle"
  MESSAGE=""
  COMMIT=""
  if [ -f "$STATE_FILE" ]; then
    STATUS=$(grep -o '"status":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"status":"//;s/"//')
    MESSAGE=$(grep -o '"message":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"message":"//;s/"//')
    COMMIT=$(grep -o '"commit":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"commit":"//;s/"//')
  fi
  LOG=""
  if [ -f "$LOG_FILE" ]; then
    LOG=$(json_escape "$(cat "$LOG_FILE")")
  fi
  send_response "{\"status\":\"$STATUS\",\"message\":\"$MESSAGE\",\"commit\":\"$COMMIT\",\"log\":\"$LOG\"}"

elif echo "$PATH_REQ" | grep -q '^/cancel$'; then
  # Marcar como cancelada. do_update.sh verifica el estado antes de cada paso.
  if [ -f "$STATE_FILE" ]; then
    STARTED=$(grep -o '"started_at":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"started_at":"//;s/"//')
    COMMIT=$(grep -o '"commit":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"commit":"//;s/"//')
    printf '{"status":"cancelled","message":"Actualizacion cancelada por el usuario","commit":"%s","started_at":"%s","completed_at":""}' \
      "$COMMIT" "$STARTED" > "$STATE_FILE"
    echo "=== CANCELACION SOLICITADA ===" >> "$LOG_FILE"
    # Matar el proceso do_update.sh si tenemos el PID
    if [ -f "$STATE_DIR/update.pid" ]; then
      PID=$(cat "$STATE_DIR/update.pid" 2>/dev/null)
      if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null || true
        # Matar procesos hijo tambien
        kill -9 "$PID" 2>/dev/null || true
      fi
      rm -f "$STATE_DIR/update.pid"
    fi
    send_response '{"success":true,"message":"Actualizacion cancelada"}'
  else
    send_response '{"success":false,"message":"No hay actualizacion en curso"}'
  fi

elif echo "$PATH_REQ" | grep -q '^/check$'; then
  PROJECT_DIR=/project
  CURRENT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
  if [ -n "$GIT_TOKEN" ]; then
    git -C "$PROJECT_DIR" remote set-url origin "https://${GIT_TOKEN}@github.com/discapacidad5/red-de-intercambio-federada.git" 2>/dev/null
  fi
  git -C "$PROJECT_DIR" fetch origin main 2>/dev/null
  NEW_COMMITS=$(git -C "$PROJECT_DIR" log --oneline HEAD..origin/main 2>/dev/null || echo "")
  UPDATES="false"
  if [ -n "$NEW_COMMITS" ]; then
    UPDATES="true"
  fi
  NEW_ESC=$(json_escape "$NEW_COMMITS")
  send_response "{\"updates_available\":$UPDATES,\"current_commit\":\"$CURRENT\",\"new_commits\":\"$NEW_ESC\"}"

else
  send_response '{"status":"updater-controller running"}'
fi
