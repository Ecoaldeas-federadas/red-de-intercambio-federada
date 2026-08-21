# peer-config.tpl - Plantilla de configuracion de peer WireGuard
#
# Se usa cuando se federan dos aldeas. Cada aldea agrega al otra
# como peer en su configuracion WireGuard.
#
# Variables:
#   {{PEER_PUBLIC_KEY}}   = Clave publica de la aldea remota
#   {{PEER_ENDPOINT}}     = Direccion de la aldea remota (dominio:puerto o IP:puerto)
#   {{PEER_ULA_PREFIX}}   = Prefijo IPv6 ULA de la aldea remota
#   {{PEER_NAME}}         = Nombre descriptivo de la aldea remota

# Agregar esta seccion a /etc/config/wireguard en OpenWrt:

config wireguard_wg0
	option public_key '{{PEER_PUBLIC_KEY}}'
	option endpoint '{{PEER_ENDPOINT}}'
	option persistent_keepalive '25'
	list allowed_ips '{{PEER_ULA_PREFIX}}::/48'
	option description '{{PEER_NAME}}'

# === Configuracion alternativa (formato wg-quick) ===
# Si se usa wg-quick en vez de OpenWrt UCI:
#
# [Peer]
# PublicKey = {{PEER_PUBLIC_KEY}}
# Endpoint = {{PEER_ENDPOINT}}
# PersistentKeepalive = 25
# AllowedIPs = {{PEER_ULA_PREFIX}}::/48
# # Comentario: {{PEER_NAME}}
