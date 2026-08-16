#!/bin/bash
# install.sh — Instalador del nodo de red de intercambio federada
#
# Uso:
#   ./install.sh
#
# El instalador:
#   1. Verifica que Docker este instalado
#   2. Pregunta nombre del nodo y dominio (unicos campos obligatorios)
#   3. Genera automaticamente:
#      - Password seguro de la base de datos
#      - JWT secret aleatorio
#      - Claves Ed25519 del nodo (para federacion)
#      - config.yaml con todos los defaults
#   4. Arranca la base de datos y el servidor con docker-compose
#   5. Abre el navegador en la pagina de setup para crear el usuario admin
#
# No necesitas editar ningun archivo manualmente.

set -e

# Colores
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'

step()  { echo -e "${CYAN}[*]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  Instalador de Nodo Federado${NC}"
echo -e "${MAGENTA}  Red de Intercambio Comunitaria${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""

# 1. Verificar Docker
step "Verificando Docker..."
if ! command -v docker &>/dev/null; then
    err "Docker no esta instalado. Instala Docker desde https://docker.com"
    exit 1
fi
# Detectar docker compose v2 o v1
if docker compose version &>/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
else
    err "Docker Compose no esta instalado."
    exit 1
fi
ok "Docker encontrado ($COMPOSE)"

# 2. Preguntar datos del nodo
echo ""
echo -e "${WHITE}Configuracion del nodo:${NC}"
echo -e "${GRAY}Solo necesitas ingresar 2 datos. Todo lo demas se genera automaticamente.${NC}"
echo ""

while true; do
    read -p "Nombre del nodo (ej: Banco Comunitario A): " NODE_NAME
    [ -n "$NODE_NAME" ] && break
    echo "El nombre es obligatorio"
done

while true; do
    read -p "Dominio del nodo (ej: nodo-a.org): " NODE_DOMAIN
    [ -n "$NODE_DOMAIN" ] && break
    echo "El dominio es obligatorio"
done

# Limpiar dominio
NODE_DOMAIN=$(echo "$NODE_DOMAIN" | sed 's|https\?://||' | sed 's|/$||')

echo ""
step "Generando configuracion segura..."

# 3. Generar secrets aleatorios
DB_PASSWORD=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | xxd -p | tr -d '\n')
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n')

# 4. Generar claves Ed25519 del nodo
NODE_PUBLIC_KEY=""
NODE_PRIVATE_KEY=""

if command -v openssl &>/dev/null; then
    KEY_FILE=$(mktemp)
    PUB_FILE=$(mktemp)
    openssl genpkey -algorithm Ed25519 -out "$KEY_FILE" 2>/dev/null
    openssl pkey -in "$KEY_FILE" -pubout -out "$PUB_FILE" 2>/dev/null
    # Extraer clave publica raw (32 bytes)
    PUB_DER=$(openssl pkey -in "$PUB_FILE" -outform DER 2>/dev/null | xxd -p | tr -d '\n')
    # Para Ed25519 SubjectPublicKeyInfo, los ultimos 32 bytes (64 hex chars) son la key
    NODE_PUBLIC_KEY=$(echo "$PUB_DER" | tail -c 64)
    NODE_PRIVATE_KEY=$(openssl pkey -in "$KEY_FILE" -outform DER 2>/dev/null | base64 | tr -d '\n')
    rm -f "$KEY_FILE" "$PUB_FILE"
fi

# Fallback con Go
if [ -z "$NODE_PUBLIC_KEY" ] && command -v go &>/dev/null; then
    GO_FILE=$(mktemp --suffix=.go)
    cat > "$GO_FILE" << 'GOEOF'
package main
import (
    "crypto/ed25519"
    "crypto/rand"
    "encoding/hex"
    "encoding/base64"
    "fmt"
)
func main() {
    pub, priv, _ := ed25519.GenerateKey(rand.Reader)
    fmt.Println(hex.EncodeToString(pub))
    fmt.Println(base64.StdEncoding.EncodeToString(priv))
}
GOEOF
    OUTPUT=$(go run "$GO_FILE" 2>/dev/null)
    NODE_PUBLIC_KEY=$(echo "$OUTPUT" | head -1)
    NODE_PRIVATE_KEY=$(echo "$OUTPUT" | tail -1)
    rm -f "$GO_FILE"
fi

if [ -z "$NODE_PUBLIC_KEY" ]; then
    warn "No se pudieron generar claves Ed25519 (instala openssl o Go). Se generaran en el primer arranque."
    NODE_PUBLIC_KEY="PENDIENTE"
    NODE_PRIVATE_KEY="PENDIENTE"
else
    ok "Claves Ed25519 del nodo generadas"
fi

# 5. Generar archivo .env
cat > "$ROOT/.env" << EOF
# Generado automaticamente por install.sh — no editar manualmente
# Fecha: $(date '+%Y-%m-%d %H:%M:%S')
# Nodo: $NODE_NAME ($NODE_DOMAIN)

DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
NODE_DOMAIN=$NODE_DOMAIN
NODE_NAME=$NODE_NAME
EOF
ok "Archivo .env generado (con passwords y secrets aleatorios)"

# 6. Generar config.yaml
cat > "$ROOT/config.yaml" << EOF
# config.yaml — Generado por install.sh
# NO EDITAR MANUALMENTE. Usa la pagina de ajustes del nodo.
# Fecha: $(date '+%Y-%m-%d %H:%M:%S')

node:
  domain: "$NODE_DOMAIN"
  name: "$NODE_NAME"

database:
  host: "yugabytedb"
  port: 5433
  name: "fmc_node"
  user: "fmc"
  password: ""
  ssl_mode: "disable"

api:
  port: 8080
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:8080"
    - "http://$NODE_DOMAIN"

federation:
  listen_port: 8443
  mtls_required: true
  known_nodes: []
  gossip_interval: "60s"
  balance_sync_enabled: true

limits:
  node_multilateral_negative: -10000000
  node_multilateral_positive: 10000000
  default_individual_negative: -50000
  default_individual_positive: 50000
  default_organization_negative: -5000000
  default_organization_positive: 5000000

taxes:
  individual:
    rate: 0.0
    enabled: false
  organization:
    default_rate: 0.05
    by_type:
      commerce: 0.05
      services: 0.03
      public_service: 0.0
      cooperative: 0.02

fund:
  account_username: "fund"
  multisig_required: 3
  multisig_authorizers: []
EOF
ok "config.yaml generado"

# 7. Guardar claves del nodo
mkdir -p "$ROOT/secrets"
cat > "$ROOT/secrets/node_keys.txt" << EOF
# node_keys.txt — Claves del nodo para federacion
# MANTENER SEGURO. No compartir la clave privada.
# Nodo: $NODE_NAME ($NODE_DOMAIN)
# Generado: $(date '+%Y-%m-%d %H:%M:%S')

# CLAVE PUBLICA (compartir con otros nodos para federarse)
# Para federar dos nodos, cada uno debe registrar la clave publica del otro.
node_public_key: $NODE_PUBLIC_KEY

# CLAVE PRIVADA (NO compartir, mantener segura)
node_private_key: $NODE_PRIVATE_KEY
EOF
ok "Claves del nodo guardadas en secrets/node_keys.txt"

# 8. Construir y arrancar
echo ""
step "Construyendo imagenes Docker (puede tardar varios minutos la primera vez)..."
$COMPOSE build
ok "Imagenes construidas"

step "Arrancando servicios..."
$COMPOSE up -d
ok "Servicios arrancados"

# 9. Esperar al servidor
step "Esperando a que el servidor este listo..."
SERVER_URL="http://localhost:8080"
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s "$SERVER_URL/api/setup/status" >/dev/null 2>&1; then
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    printf "${GRAY}.${NC}"
done
echo ""

if [ $WAITED -ge $MAX_WAIT ]; then
    warn "El servidor no respondio en $MAX_WAIT segundos."
    warn "Puede que aun este iniciando. Revisa con: $COMPOSE logs"
else
    ok "Servidor listo!"
fi

# 10. Resumen
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  INSTALACION COMPLETADA${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${WHITE}Nodo:${NC} $NODE_NAME"
echo -e "${WHITE}Dominio:${NC} $NODE_DOMAIN"
echo ""
echo -e "${CYAN}URL del nodo: $SERVER_URL${NC}"
echo ""
echo -e "${YELLOW}PROXIMO PASO:${NC}"
echo -e "${WHITE}  Abre el navegador en: $SERVER_URL${NC}"
echo -e "${WHITE}  Crea el usuario administrador en la pagina de setup.${NC}"
echo ""
echo -e "${YELLOW}CLAVES DE FEDERACION:${NC}"
echo -e "${WHITE}  Tu clave publica (para registrar en otros nodos):${NC}"
echo -e "${GRAY}  $NODE_PUBLIC_KEY${NC}"
echo -e "${GRAY}  Guardada en: secrets/node_keys.txt${NC}"
echo ""
echo -e "${YELLOW}COMANDOS UTILES:${NC}"
echo -e "${GRAY}  Ver logs:     $COMPOSE logs -f${NC}"
echo -e "${GRAY}  Detener:      $COMPOSE down${NC}"
echo -e "${GRAY}  Reiniciar:    $COMPOSE restart${NC}"
echo ""

# Abrir navegador si es posible
if command -v xdg-open &>/dev/null; then
    xdg-open "$SERVER_URL" 2>/dev/null || true
elif command -v open &>/dev/null; then
    open "$SERVER_URL" 2>/dev/null || true
fi

echo -e "${CYAN}Abriendo navegador...${NC}"
