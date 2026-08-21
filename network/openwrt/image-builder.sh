#!/bin/sh
# image-builder.sh - Genera imagen OpenWrt preconfigurada para una aldea
#
# Este script usa el OpenWrt Image Builder para crear una imagen .img
# lista para flashear en un servidor de aldea (mini-PC, x86_64).
#
# Requisitos:
#   - Linux (o WSL2/Docker en Windows)
#   - OpenWrt Image Builder descargado
#   - Paquetes: wget, tar, xz-utils
#
# Uso:
#   ./image-builder.sh <aldea-domain> <ula-prefix> <wg-private-key> <wg-port>
#
# Ejemplo:
#   ./image-builder.sh aldea1.com fd12:3456:7890 <wg-private-key> 51820
#
# Salida:
#   openwrt-aldea1.com.img.gz (imagen lista para flashear con BalenaEtcher)

set -e

ALDEA_DOMAIN="$1"
ULA_PREFIX="$2"
WG_PRIVATE_KEY="$3"
WG_PORT="${4:-51820}"

if [ -z "$ALDEA_DOMAIN" ] || [ -z "$ULA_PREFIX" ] || [ -z "$WG_PRIVATE_KEY" ]; then
    echo "Uso: $0 <aldea-domain> <ula-prefix> <wg-private-key> [wg-port]"
    echo "Ejemplo: $0 aldea1.com fd12:3456:7890 abc123... 51820"
    exit 1
fi

# Configuracion
OPENWRT_VERSION="23.05.5"
TARGET="x86"
SUBTARGET="64"
IMAGEBUILDER_DIR="openwrt-imagebuilder-${OPENWRT_VERSION}-${TARGET}-${SUBTARGET}"

echo "=== Generador de imagen OpenWrt para $ALDEA_DOMAIN ==="
echo "Prefijo ULA: $ULA_PREFIX"
echo "Puerto WireGuard: $WG_PORT"
echo ""

# Descargar Image Builder si no existe
if [ ! -d "$IMAGEBUILDER_DIR" ]; then
    echo "Descargando OpenWrt Image Builder ${OPENWRT_VERSION}..."
    URL="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/${SUBTARGET}/${IMAGEBUILDER_DIR}.Linux-x86_64.tar.xz"
    wget -q "$URL" -O imagebuilder.tar.xz
    tar xf imagebuilder.tar.xz
    rm imagebuilder.tar.xz
fi

cd "$IMAGEBUILDER_DIR"

# Leer lista de paquetes
PACKAGES=$(grep -v '^#' ../../openwrt/packages.txt | grep -v '^$' | tr '\n' ' ')

# Generar directorio de archivos personalizados
CUSTOM_FILES="files"
mkdir -p "$CUSTOM_FILES/etc/config"
mkdir -p "$CUSTOM_FILES/etc/ssl/private"
mkdir -p "$CUSTOM_FILES/etc/ssl/certs"
mkdir -p "$CUSTOM_FILES/usr/share/luci"

# Generar configuracion desde plantillas
sed "s|{{ULA_PREFIX}}|$ULA_PREFIX|g; s|{{WG_PORT}}|$WG_PORT|g; s|{{WG_PRIVATE_KEY}}|$WG_PRIVATE_KEY|g; s|{{ALDEA_DOMAIN}}|$ALDEA_DOMAIN|g; s|{{WAN_PROTO}}|dhcp|g; s|{{LAN_IPv4}}|192.168.1.1|g" \
    ../../openwrt/config/network.uc > "$CUSTOM_FILES/etc/config/network"

sed "s|{{ULA_PREFIX}}|$ULA_PREFIX|g; s|{{ALDEA_DOMAIN}}|$ALDEA_DOMAIN|g" \
    ../../openwrt/config/dhcp.uc > "$CUSTOM_FILES/etc/config/dhcp"

sed "s|{{WG_PORT}}|$WG_PORT|g" \
    ../../openwrt/config/firewall.uc > "$CUSTOM_FILES/etc/config/firewall"

sed "s|{{WG_PRIVATE_KEY}}|$WG_PRIVATE_KEY|g; s|{{WG_PORT}}|$WG_PORT|g; s|{{ULA_PREFIX}}|$ULA_PREFIX|g" \
    ../../openwrt/config/wireguard.uc > "$CUSTOM_FILES/etc/config/wireguard"

sed "s|{{ALDEA_DOMAIN}}|$ALDEA_DOMAIN|g" \
    ../../openwrt/config/dns.uc > "$CUSTOM_FILES/etc/config/dns"

sed "s|{{ALDEA_DOMAIN}}|$ALDEA_DOMAIN|g" \
    ../../openwrt/config/ssl.uc > "$CUSTOM_FILES/etc/config/ssl"

# API de registro de servicios
cp ../../openwrt/luci/dns-api.lua "$CUSTOM_FILES/usr/share/luci/dns-api.lua"

# Script de inicio que configura WireGuard peers dinamicamente
cat > "$CUSTOM_FILES/etc/init.d/aldea-setup" << 'INITSCRIPT'
#!/bin/sh /etc/rc.common
START=99
start() {
    # Esperar a que la red este lista
    sleep 5
    # Iniciar babeld para enrutamiento automatico
    /etc/init.d/babeld start 2>/dev/null || true
    # Registrar el nodo en el DNS si existe
    # (el nodo de la aplicacion se registra via API)
}
INITSCRIPT
chmod +x "$CUSTOM_FILES/etc/init.d/aldea-setup"

# Generar imagen
echo "Construyendo imagen..."
make image \
    PROFILE="generic" \
    PACKAGES="$PACKAGES" \
    FILES="$CUSTOM_FILES" \
    BIN_DIR="bin"

# Buscar imagen generada
IMAGE=$(find bin/ -name "*combined-efi*.img.gz" | head -1)
if [ -z "$IMAGE" ]; then
    IMAGE=$(find bin/ -name "*combined*.img.gz" | head -1)
fi

if [ -z "$IMAGE" ]; then
    echo "Error: no se encontro la imagen generada"
    exit 1
fi

# Copiar imagen con nombre descriptivo
OUTPUT="../openwrt-${ALDEA_DOMAIN}.img.gz"
cp "$IMAGE" "$OUTPUT"

echo ""
echo "=== Imagen generada ==="
echo "Archivo: $OUTPUT"
echo ""
echo "Para instalar:"
echo "  1. Descargar BalenaEtcher o Rufus"
echo "  2. Flashear $OUTPUT en un USB o disco"
echo "  3. Conectar el servidor de aldea con 2 tarjetas de red"
echo "  4. Encender el servidor desde el USB/disco"
echo "  5. La aldea se configura automaticamente"
