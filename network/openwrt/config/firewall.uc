# /etc/config/firewall - Plantilla OpenWrt para servidor de aldea
#
# Configuracion de firewall con zonas WAN, LAN y tunel WireGuard.
# Permite reenvio bidireccional entre LAN y tunel para que los
# dispositivos de una aldea puedan acceder a servicios de otra.
#
# Variables:
#   {{WG_PORT}}  = Puerto WireGuard (ej: 51820)

config defaults
	option input 'REJECT'
	option output 'ACCEPT'
	option forward 'REJECT'
	option synflood_protect '1'
	option flow_offloading '1'

# === Zona WAN: Internet comercial ===
config zone
	option name 'wan'
	list input 'ACCEPT'
	list output 'ACCEPT'
	list forward 'REJECT'
	option masq '1'
	option mtu_fix '1'
	option device 'eth0'

# === Zona LAN: Red local de la aldea ===
config zone
	option name 'lan'
	list input 'ACCEPT'
	list output 'ACCEPT'
	list forward 'ACCEPT'
	list device 'br-lan'

# === Zona WG: Tunel WireGuard federado ===
config zone
	option name 'wg'
	list input 'ACCEPT'
	list output 'ACCEPT'
	list forward 'ACCEPT'
	option device 'wg0'
	option masq '1'

# === Reenvio LAN <-> WG: permitir acceso entre aldeas ===
config forwarding
	option src 'lan'
	option dest 'wg'

config forwarding
	option src 'wg'
	option dest 'lan'

# === Reenvio LAN <-> WAN: Internet para la aldea ===
config forwarding
	option src 'lan'
	option dest 'wan'

# === Reenvio WG <-> WG: enrutar entre aldeas federadas ===
config forwarding
	option src 'wg'
	option dest 'wg'

# === Regla: permitir WireGuard entrante ===
config rule
	option name 'Allow-WireGuard'
	option src 'wan'
	option dest_port '{{WG_PORT}}'
	option proto 'udp'
	option target 'ACCEPT'

# === Reglas estandar: permitir ICMP (ping) ===
config rule
	option name 'Allow-ICMP-v4'
	option src 'wan'
	option proto 'icmp'
	option icmp_type 'echo-request'
	option target 'ACCEPT'

config rule
	option name 'Allow-ICMP-v6'
	option src 'wan'
	option proto 'icmp'
	list icmp_type 'echo-request'
	list icmp_type 'echo-reply'
	list icmp_type 'destination-unreachable'
	list icmp_type 'packet-too-big'
	list icmp_type 'time-exceeded'
	list icmp_type 'bad-header'
	list icmp_type 'unknown-header-type'
	option target 'ACCEPT'

# === Regla: permitir DNS desde el tunel ===
config rule
	option name 'Allow-DNS-from-WG'
	option src 'wg'
	option dest_port '53'
	option proto 'tcpudp'
	option target 'ACCEPT'

# === Regla: permitir DHCP desde el tunel ===
config rule
	option name 'Allow-DHCP-from-WG'
	option src 'wg'
	option dest_port '67-68'
	option proto 'udp'
	option target 'ACCEPT'

# === Regla: permitir HTTP/HTTPS al nodo de la aplicacion ===
config rule
	option name 'Allow-Node-HTTP'
	option src 'wg'
	option dest 'lan'
	option dest_port '8080'
	option proto 'tcp'
	option target 'ACCEPT'

config rule
	option name 'Allow-Node-HTTPS'
	option src 'wg'
	option dest 'lan'
	option dest_port '8443'
	option proto 'tcp'
	option target 'ACCEPT'
