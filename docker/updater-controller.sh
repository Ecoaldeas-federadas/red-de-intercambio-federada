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
  printf 'Content-Length: %d\r\n' "$LEN"
  printf '\r\n'
  printf '%s' "$BODY"
}

send_html() {
  BODY="$1"
  LEN=$(printf '%s' "$BODY" | wc -c)
  printf 'HTTP/1.1 200 OK\r\n'
  printf 'Content-Type: text/html; charset=utf-8\r\n'
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

# Check if node-app container is running
check_node_status() {
  PROJECT_NAME=$(detect_project_name)
  NODE_CONTAINER="${PROJECT_NAME}-node-app-1"
  RUNNING=$(docker inspect -f '{{.State.Running}}' "$NODE_CONTAINER" 2>/dev/null || echo "false")
  STATUS=$(docker inspect -f '{{.State.Status}}' "$NODE_CONTAINER" 2>/dev/null || echo "not-found")
  if [ "$STATUS" = "not-found" ]; then
    echo '{"running":false,"status":"not-found","container":"'"$NODE_CONTAINER"'"}'
  else
    echo '{"running":'"$RUNNING"',"status":"'"$STATUS"'","container":"'"$NODE_CONTAINER"'"}'
  fi
}

# === RUTAS ===

# Pagina HTML de control (GET /)
if [ "$METHOD" = "GET" ] && { [ "$PATH_REQ" = "/" ] || [ "$PATH_REQ" = "/index.html" ]; }; then
  log_msg "Sirviendo pagina de control HTML"
  HTML='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Control del Nodo</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f0fdf4;color:#064e3b;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.card{background:#fff;border-radius:1rem;padding:2rem;max-width:480px;width:100%;box-shadow:0 4px 6px rgba(0,0,0,.1);border:1px solid #d1fae5}
h1{font-size:1.25rem;margin-bottom:.5rem;text-align:center}
.subtitle{text-align:center;color:#6b7280;font-size:.8rem;margin-bottom:1.5rem}
.status-box{padding:1rem;border-radius:.5rem;margin-bottom:1rem;text-align:center;font-weight:600}
.status-running{background:#d1fae5;color:#065f46}
.status-stopped{background:#fee2e2;color:#991b1b}
.status-created{background:#fef3c7;color:#92400e}
.status-loading{background:#dbeafe;color:#1e40af}
.btn{display:block;width:100%;padding:.75rem 1rem;border:none;border-radius:.5rem;font-weight:700;cursor:pointer;margin-bottom:.5rem;transition:all .15s;font-size:.9rem}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-start{background:#059669;color:#fff}
.btn-start:hover{background:#047857}
.btn-stop{background:#dc2626;color:#fff}
.btn-stop:hover{background:#b91c1c}
.btn-restart{background:#d97706;color:#fff}
.btn-restart:hover{background:#b45309}
.btn-update{background:#2563eb;color:#fff}
.btn-update:hover{background:#1d4ed8}
.btn-cancel{background:#6b7280;color:#fff}
.btn-cancel:hover{background:#4b5563}
.log-box{margin-top:1rem;background:#1e293b;color:#a7f3d0;padding:1rem;border-radius:.5rem;font-family:monospace;font-size:.7rem;max-height:200px;overflow-y:auto;white-space:pre-wrap;display:none}
.log-box.visible{display:block}
.msg{padding:.75rem;border-radius:.5rem;margin-bottom:.5rem;font-size:.8rem;text-align:center}
.msg-success{background:#d1fae5;color:#065f46}
.msg-error{background:#fee2e2;color:#991b1b}
.msg-info{background:#dbeafe;color:#1e40af}
.update-section{margin-top:1rem;padding-top:1rem;border-top:1px solid #e5e7eb}
label{display:block;font-size:.8rem;font-weight:600;margin-bottom:.25rem}
input[type=text],input[type=password]{width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.25rem;font-size:.8rem;margin-bottom:.5rem}
.info{font-size:.7rem;color:#9ca3af;margin-top:.5rem;text-align:center}
</style></head><body>
<div class="card">
<h1>Control del Nodo</h1>
<p class="subtitle">Gestor de actualizaciones - acceso directo</p>
<div id="status" class="status-box status-loading">Verificando estado...</div>
<div id="msg"></div>
<button class="btn btn-start" id="btnStart" onclick="doAction(\"start\")">Arrancar Nodo</button>
<button class="btn btn-stop" id="btnStop" onclick="doAction(\"stop\")">Detener Nodo</button>
<button class="btn btn-restart" id="btnRestart" onclick="doAction(\"restart\")">Reiniciar Nodo</button>
<div class="update-section">
<button class="btn btn-update" id="btnUpdate" onclick="doAction(\"update\")">Actualizar Nodo</button>
<button class="btn btn-cancel" id="btnCancel" onclick="doAction(\"cancel\")" style="display:none">Cancelar Actualizacion</button>
</div>
<div class="log-box" id="logBox"></div>
<p class="info">Puerto 9110 - updater-controller</p>
</div>
<script>
async function api(path,opts){
  try{
    const r=await fetch(path,opts||{});
    return await r.json();
  }catch(e){return{success:false,message:err.toString()};}
}
function showMsg(t,c){var m=document.getElementById("msg");m.innerHTML=\"<div class=\\\"msg \"+c+\"\\\">\"+t+\"</div>\";}
function setStatus(r){
  var s=document.getElementById("status");
  var bs=document.getElementById("btnStart"),bh=document.getElementById("btnStop");
  if(r.running){s.className="status-box status-running";s.textContent="Nodo: ARRANCADO ("+r.status+")";bs.disabled=true;bh.disabled=false;}
  else if(r.status==="created"){s.className="status-box status-created";s.textContent="Nodo: CREADO pero no arrancado";bs.disabled=false;bh.disabled=true;}
  else if(r.status==="not-found"){s.className="status-box status-stopped";s.textContent="Nodo: no encontrado";bs.disabled=false;bh.disabled=true;}
  else{s.className="status-box status-stopped";s.textContent="Nodo: DETENIDO ("+r.status+")";bs.disabled=false;bh.disabled=true;}
}
async function refreshStatus(){
  var r=await api("/node-status");
  setStatus(r);
  // Tambien verificar estado de actualizacion
  var u=await api("/status");
  if(u.status==="running"){
    document.getElementById("btnUpdate").disabled=true;
    document.getElementById("btnCancel").style.display="block";
    showMsg("Actualizacion en curso: "+(u.message||""),"msg-info");
    document.getElementById("logBox").className="log-box visible";
    document.getElementById("logBox").textContent=u.log||"";
  }else{
    document.getElementById("btnUpdate").disabled=false;
    document.getElementById("btnCancel").style.display="none";
    if(u.status==="completed"){showMsg("Ultima actualizacion completada: "+(u.commit||""),"msg-success");}
    else if(u.status==="error"){showMsg("Ultima actualizacion fallo: "+(u.message||""),"msg-error");}
    else if(u.status==="cancelled"){showMsg("Actualizacion cancelada","msg-info");}
  }
}
async function doAction(a){
  var conf={start:"Arrancar",stop:"Detener",restart:"Reiniciar",update:"Actualizar",cancel:"Cancelar actualizacion"};
  if(a==="update"&&!confirm("Confirmas que quieres actualizar el nodo? Se reiniciara automaticamente."))return;
  if(a==="stop"&&!confirm("Confirmas que quieres detener el nodo?"))return;
  showMsg(conf[a]+"...","msg-info");
  var r=await api("/"+a,{method:"POST"});
  if(r.success){showMsg(conf[a]+": "+(r.message||"OK"),"msg-success");}
  else{showMsg(conf[a]+" fallo: "+(r.message||"error"),"msg-error");}
  setTimeout(refreshStatus,1000);
  if(a==="update"){setTimeout(refreshStatus,3000);setInterval(refreshStatus,3000);}
}
refreshStatus();
setInterval(refreshStatus,5000);
</script></body></html>'
  send_html "$HTML"
  exit 0
fi

# === API endpoints ===

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
    nohup /do_update.sh >> "$LOG_FILE" 2>&1 &
    UPDATE_PID=$!
    echo "$UPDATE_PID" > "$STATE_DIR/update.pid"
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
  fi
  LOG=""
  if [ -f "$LOG_FILE" ]; then
    LOG=$(json_escape "$(cat "$LOG_FILE")")
  fi
  send_response "{\"status\":\"$STATUS\",\"message\":\"$MESSAGE\",\"commit\":\"$COMMIT\",\"progress\":$PROGRESS,\"log\":\"$LOG\"}"

elif echo "$PATH_REQ" | grep -q '^/node-status$'; then
  RESULT=$(check_node_status)
  log_msg "Node status: $RESULT"
  send_response "$RESULT"

elif echo "$PATH_REQ" | grep -q '^/start$'; then
  log_msg "Peticion /start - arrancando node-app"
  PROJECT_NAME=$(detect_project_name)
  COMPOSE_FILE=/project/docker-compose.yml
  OUTPUT=$(docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps node-app 2>&1)
  CODE=$?
  log_msg "start output: $OUTPUT"
  if [ $CODE -eq 0 ]; then
    send_response '{"success":true,"message":"Nodo arrancado"}'
  else
    send_response "{\"success\":false,\"message\":\"Error: $(json_escape "$OUTPUT")\"}"
  fi

elif echo "$PATH_REQ" | grep -q '^/stop$'; then
  log_msg "Peticion /stop - deteniendo node-app"
  PROJECT_NAME=$(detect_project_name)
  COMPOSE_FILE=/project/docker-compose.yml
  OUTPUT=$(docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" stop node-app 2>&1)
  CODE=$?
  log_msg "stop output: $OUTPUT"
  if [ $CODE -eq 0 ]; then
    send_response '{"success":true,"message":"Nodo detenido"}'
  else
    send_response "{\"success\":false,\"message\":\"Error: $(json_escape "$OUTPUT")\"}"
  fi

elif echo "$PATH_REQ" | grep -q '^/restart$'; then
  log_msg "Peticion /restart - reiniciando node-app"
  PROJECT_NAME=$(detect_project_name)
  COMPOSE_FILE=/project/docker-compose.yml
  OUTPUT=$(docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" restart node-app 2>&1)
  CODE=$?
  log_msg "restart output: $OUTPUT"
  if [ $CODE -eq 0 ]; then
    send_response '{"success":true,"message":"Nodo reiniciado"}'
  else
    send_response "{\"success\":false,\"message\":\"Error: $(json_escape "$OUTPUT")\"}"
  fi

elif echo "$PATH_REQ" | grep -q '^/cancel$'; then
  log_msg "Peticion /cancel recibida"
  if [ -f "$STATE_FILE" ]; then
    STARTED=$(grep -o '"started_at":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"started_at":"//;s/"//')
    COMMIT=$(grep -o '"commit":"[^"]*"' "$STATE_FILE" | head -1 | sed 's/"commit":"//;s/"//')
    printf '{"status":"cancelled","message":"Actualizacion cancelada por el usuario","commit":"%s","started_at":"%s","completed_at":""}' \
      "$COMMIT" "$STARTED" > "$STATE_FILE"
    echo "=== CANCELACION SOLICITADA ===" >> "$LOG_FILE"
    if [ -f "$STATE_DIR/update.pid" ]; then
      PID=$(cat "$STATE_DIR/update.pid" 2>/dev/null)
      if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null || true
        kill -9 "$PID" 2>/dev/null || true
      fi
      rm -f "$STATE_DIR/update.pid"
    fi
    send_response '{"success":true,"message":"Actualizacion cancelada"}'
  else
    send_response '{"success":false,"message":"No hay actualizacion en curso"}'
  fi

elif echo "$PATH_REQ" | grep -q '^/check$'; then
  log_msg "Peticion /check (verificar actualizaciones)"
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
  send_response '{"status":"updater-controller running","endpoints":["/","/update","/status","/node-status","/start","/stop","/restart","/cancel","/check"]}'
fi
