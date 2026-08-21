#!/bin/sh
# acme-setup.sh - Obtiene certificado SSL wildcard para la aldea
#
# Usa acme.sh para obtener un certificado wildcard *.{{ALDEA_DOMAIN}}
# gratis de Lets Encrypt via DNS challenge.
#
# Requisitos:
#   - acme.sh instalado (curl https://get.acme.sh | sh)
#   - Dominio publico configurado en un proveedor de DNS (Cloudflare, etc.)
#   - Variables de entorno del proveedor de DNS
#
# Uso:
#   ./acme-setup.sh aldea1.com admin@aldea1.com cloudflare
#   ./acme-setup.sh aldea1.com admin@aldea1.com digitalocean
#
# Variables de entorno necesarias (segun proveedor):
#   Cloudflare:    CF_Token, CF_Account_ID
#   DigitalOcean:  DO_API_TOKEN
#   Gandi:         GANDI_LIVE_KEY
#   Namecheap:     NAMECHEAP_API_USER, NAMECHEAP_API_KEY

set -e

DOMAIN="$1"
EMAIL="$2"
DNS_PROVIDER="${3:-cloudflare}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Uso: $0 <dominio> <email> [proveedor-dns]"
    echo "Ejemplo: $0 aldea1.com admin@aldea1.com cloudflare"
    exit 1
fi

# Verificar acme.sh
ACME_HOME="${ACME_HOME:-$HOME/.acme.sh}"
if [ ! -f "$ACME_HOME/acme.sh" ]; then
    echo "Instalando acme.sh..."
    curl https://get.acme.sh | sh -s email="$EMAIL"
    ACME_HOME="$HOME/.acme.sh"
fi

# Mapear proveedor a funcion DNS de acme.sh
case "$DNS_PROVIDER" in
    cloudflare)    DNS_FUNC="dns_cf" ;;
    digitalocean)  DNS_FUNC="dns_do" ;;
    gandi)         DNS_FUNC="dns_gandi_livedns" ;;
    namecheap)     DNS_FUNC="dns_namecheap" ;;
    *)             DNS_FUNC="dns_cf" ;;
esac

echo "=== Obteniendo certificado wildcard *.$DOMAIN ==="
echo "Proveedor DNS: $DNS_PROVIDER ($DNS_FUNC)"
echo "Email: $EMAIL"
echo ""

# Emitir certificado wildcard
"$ACME_HOME/acme.sh" --issue \
    --dns "$DNS_FUNC" \
    -d "*.$DOMAIN" \
    -d "$DOMAIN" \
    --keylength ec-256 \
    --accountemail "$EMAIL"

# Crear directorios para certificados
mkdir -p /etc/ssl/private /etc/ssl/certs

# Instalar certificado
"$ACME_HOME/acme.sh" --install-cert \
    -d "*.$DOMAIN" --ecc \
    --key-file /etc/ssl/private/aldea.key \
    --fullchain-file /etc/ssl/certs/aldea.crt \
    --reloadcmd "service uhttpd restart 2>/dev/null || /etc/init.d/uhttpd restart 2>/dev/null || true"

echo ""
echo "=== Certificado instalado ==="
echo "Cert: /etc/ssl/certs/aldea.crt"
echo "Key:  /etc/ssl/private/aldea.key"
echo ""
echo "El certificado wildcard *.$DOMAIN cubre todos los subdominios:"
echo "  - nodo.$DOMAIN"
echo "  - tienda.$DOMAIN"
echo "  - voip.$DOMAIN"
echo "  - Cualquier servicio que se registre en OpenWrt"
echo ""
echo "Renovacion automatica: acme.sh instala un cron job cada 60 dias"
