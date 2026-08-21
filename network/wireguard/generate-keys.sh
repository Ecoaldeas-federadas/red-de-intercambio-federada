#!/bin/sh
# generate-keys.sh - Genera claves WireGuard para una aldea
#
# Uso:
#   ./generate-keys.sh                    # Genera par de claves
#   ./generate-keys.sh /path/to/output    # Genera y guarda en archivo
#
# Salida:
#   Private key: <clave_privada_base64>
#   Public key:  <clave_publica_base64>

set -e

# Verificar que wg este instalado
if ! command -v wg >/dev/null 2>&1; then
    echo "Error: wireguard-tools no esta instalado"
    echo "Instalar con: apt install wireguard-tools (Linux) o brew install wireguard-tools (macOS)"
    exit 1
fi

# Generar clave privada
PRIVATE_KEY=$(wg genkey)

# Derivar clave publica desde la privada
PUBLIC_KEY=$(echo "$PRIVATE_KEY" | wg pubkey)

# Mostrar claves
echo "Private key: $PRIVATE_KEY"
echo "Public key:  $PUBLIC_KEY"

# Guardar a archivo si se especifica
if [ -n "$1" ]; then
    cat > "$1" << EOF
# Claves WireGuard - MANTENER SEGURO
# No compartir la clave privada
# Generado: $(date)

private_key: $PRIVATE_KEY
public_key: $PUBLIC_KEY
EOF
    chmod 600 "$1"
    echo "Claves guardadas en $1"
fi
