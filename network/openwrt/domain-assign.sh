#!/bin/sh
# domain-assign.sh - Servicio de asignacion de dominios para nuevos nodos
#
# Este script corre en OpenWrt y atiende peticiones de nuevos nodos
# que solicitan un subdominio dentro del dominio de la aldea.
#
# Endpoint: POST /cgi-bin/luci/rpc/domain/assign
# Body: {"node_name": "nodo2", "node_number": 102, "ipv6": "fd12::10", "token": "..."}
#
# Respuesta exitosa:
# {"success": true, "domain": "nodo2.aldea1.com", "ip": "fd12::10"}
#
# Respuesta si el dominio ya existe:
# {"success": false, "error": "domain_taken", "suggestion": "nodo2-b.aldea1.com"}

. /lib/functions.sh

TOKEN_FILE="/etc/aldea/domain-token"
DNSMASQ_DIR="/etc/dnsmasq.d"

# Leer token de autorizacion
if [ -f "$TOKEN_FILE" ]; then
	VALID_TOKEN=$(cat "$TOKEN_FILE")
else
	echo '{"success": false, "error": "no_token_configured"}'
	exit 1
fi

# Parsear JSON del stdin (simplificado para OpenWrt busybox)
read -r REQUEST

# Extraer campos (usando sed por compatibilidad con busybox)
NODE_NAME=$(echo "$REQUEST" | sed -n 's/.*"node_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
NODE_NUMBER=$(echo "$REQUEST" | sed -n 's/.*"node_number"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
NODE_IPV6=$(echo "$REQUEST" | sed -n 's/.*"ipv6"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
TOKEN=$(echo "$REQUEST" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Verificar token
if [ "$TOKEN" != "$VALID_TOKEN" ]; then
	echo '{"success": false, "error": "invalid_token"}'
	exit 1
fi

# Verificar que el nombre no este vacio
if [ -z "$NODE_NAME" ]; then
	echo '{"success": false, "error": "node_name_required"}'
	exit 1
fi

# Obtener dominio de la aldea
ALDEA_DOMAIN=$(uci get aldea.domain 2>/dev/null || echo "")
if [ -z "$ALDEA_DOMAIN" ]; then
	echo '{"success": false, "error": "no_domain_configured"}'
	exit 1
fi

FULL_DOMAIN="${NODE_NAME}.${ALDEA_DOMAIN}"

# Verificar si el dominio ya existe
DNS_FILE="${DNSMASQ_DIR}/${NODE_NAME}.conf"
if [ -f "$DNS_FILE" ]; then
	# Verificar si es la misma IP (re-registro)
	EXISTING_IP=$(grep -o 'fd[0-9a-f:]*' "$DNS_FILE" | head -1)
	if [ "$EXISTING_IP" = "$NODE_IPV6" ]; then
		# Mismo nodo re-registrandose, OK
		echo "{\"success\": true, \"domain\": \"${FULL_DOMAIN}\", \"ip\": \"${NODE_IPV6}\", \"message\": \"re_registered\"}"
		exit 0
	fi
	# Dominio tomado por otro nodo
	echo "{\"success\": false, \"error\": \"domain_taken\", \"suggestion\": \"${NODE_NAME}-2.${ALDEA_DOMAIN}\"}"
	exit 1
fi

# Crear entrada DNS en dnsmasq
mkdir -p "$DNSMASQ_DIR"
echo "host-record=${FULL_DOMAIN},${NODE_IPV6}" > "$DNS_FILE"

# Recargar dnsmasq
/etc/init.d/dnsmasq reload

# Registrar en el firewall si es necesario
# (OpenWrt puede necesitar reglas adicionales para el nuevo nodo)

# Responder exitosamente
echo "{\"success\": true, \"domain\": \"${FULL_DOMAIN}\", \"ip\": \"${NODE_IPV6}\", \"node_number\": ${NODE_NUMBER:-0}}"

# Log
logger -t domain-assign "Dominio asignado: ${FULL_DOMAIN} -> ${NODE_IPV6} (nodo ${NODE_NUMBER})"
