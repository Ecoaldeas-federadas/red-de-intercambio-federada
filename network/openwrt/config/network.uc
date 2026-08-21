# /etc/config/network - Plantilla OpenWrt para servidor de aldea
#
# Configuracion de red para el gateway/router de frontera de la aldea.
# Reemplazar las variables entre llaves {{ }} con los valores de la aldea.
#
# Variables:
#   {{ULA_PREFIX}}      = Prefijo IPv6 ULA (ej: fd12:3456:7890)
#   {{WAN_PROTO}}       = Protocolo WAN (dhcp, static, pppoe)
#   {{WAN_IP}}          = IP estatica WAN (si proto=static)
#   {{WAN_NETMASK}}     = Mascara de red WAN
#   {{WAN_GATEWAY}}     = Gateway WAN
#   {{WAN_DNS}}         = DNS del ISP
#   {{LAN_IPv4}}        = IP IPv4 del gateway en LAN (ej: 192.168.1.1)
#   {{WG_PORT}}         = Puerto WireGuard (ej: 51820)
#   {{WG_PRIVATE_KEY}}  = Clave privada WireGuard del nodo

config interface 'loopback'
	option device 'lo'
	option proto 'static'
	option ipaddr '127.0.0.1'
	option netmask '255.0.0.0'

# === WAN: Conexion a Internet comercial ===
config interface 'wan'
	option device 'eth0'
	option proto '{{WAN_PROTO}}'
{{#WAN_STATIC}}
	option ipaddr '{{WAN_IP}}'
	option netmask '{{WAN_NETMASK}}'
	option gateway '{{WAN_GATEWAY}}'
	option dns '{{WAN_DNS}}'
{{/WAN_STATIC}}

config interface 'wan6'
	option device 'eth0'
	option proto 'dhcpv6'

# === LAN: Red local de la aldea ===
config interface 'lan'
	option device 'br-lan'
	option proto 'static'
	option ipaddr '{{LAN_IPv4}}'
	option netmask '255.255.255.0'
	option ip6assign '64'
	option ip6hint '0'
	option ip6ifaceid '1'

# === IPv6 ULA: Prefijo unico de la aldea ===
config interface 'ula'
	option proto 'static'
	option ip6addr '{{ULA_PREFIX}}::1/48'
	option device 'br-lan'

# Asignar prefijo ULA a la LAN para SLAAC
config interface 'lan6'
	option proto 'static'
	option ip6addr '{{ULA_PREFIX}}::1/64'
	option device 'br-lan'
	option ip6assign '64'
	option ip6hint '0'

# === WireGuard: Tunel federado entre aldeas ===
config interface 'wg0'
	option proto 'wireguard'
	option private_key '{{WG_PRIVATE_KEY}}'
	option listen_port '{{WG_PORT}}'
	list addresses '{{ULA_PREFIX}}::2/64'

# Bridge LAN (une los puertos ethernet + wifi en una sola red)
config device
	option name 'br-lan'
	option type 'bridge'
	list ports 'eth1'
	list ports 'eth2'

# === Peers WireGuard (una seccion por cada aldea federada) ===
# Ejemplo de peer - se agregan automaticamente al federar
# config wireguard_wg0
#	option public_key 'CLAVE_PUBLICA_DE_ALDEA_B'
#	option endpoint 'aldea2.com:51820'
#	option persistent_keepalive '25'
#	list allowed_ips 'fdXX:aldeaB::/48'
#	option description 'Aldea B'
