# /etc/config/wireguard - Plantilla OpenWrt para tunel federado
#
# Configuracion de peers WireGuard para federar aldeas.
# Cada aldea federada se agrega como un peer aqui.
#
# Variables:
#   {{WG_PRIVATE_KEY}}  = Clave privada WireGuard de esta aldea
#   {{WG_PORT}}         = Puerto WireGuard (ej: 51820)
#   {{ULA_PREFIX}}      = Prefijo IPv6 ULA de esta aldea

config interface 'wg0'
	option proto 'wireguard'
	option private_key '{{WG_PRIVATE_KEY}}'
	option listen_port '{{WG_PORT}}'
	list addresses '{{ULA_PREFIX}}::2/128'

# === Peers federados ===
# Cada peer representa otra aldea federada.
# Se agregan automaticamente al federar desde el nodo de la aplicacion.
#
# config wireguard_wg0
#	option public_key 'CLAVE_PUBLICA_DE_ALDEA_B'
#	option endpoint 'aldea2.com:51820'
#	option persistent_keepalive '25'
#	list allowed_ips 'fdXX:aldeaB::/48'
#	option description 'Aldea B'
#
# config wireguard_wg0
#	option public_key 'CLAVE_PUBLICA_DE_ALDEA_C'
#	option endpoint 'aldea3.com:51820'
#	option persistent_keepalive '25'
#	list allowed_ips 'fdXX:aldeaC::/48'
#	option description 'Aldea C'

# === Notas ===
# - persistent_keepalive '25' mantiene el tunel abierto enviando un
#   paquete diminuto cada 25 segundos (necesario detras de NAT/CGNAT)
# - allowed_ips debe incluir el prefijo ULA completo de la aldea remota
# - endpoint puede ser dominio o IP:puerto
# - Si ambas aldeas estan detras de CGNAT, usar STUN/Lighthouse para
#   el apretón de manos inicial (ver network/stun/coturn.conf.tpl)
