# /etc/config/dns - Plantilla OpenWrt para DNS federado
#
# Configuracion del DNS de la aldea con dnsmasq.
# OpenWrt es el DNS autoritativo de {{ALDEA_DOMAIN}} dentro de la aldea.
#
# Variables:
#   {{ALDEA_DOMAIN}}    = Dominio de la aldea (ej: aldea1.com)
#   {{ULA_PREFIX}}      = Prefijo IPv6 ULA (ej: fd12:3456:7890)
#   {{NODE_IPV6}}       = IPv6 ULA del nodo de la aplicacion (ej: fd12:3456:7890::10)

# === Zona local: resolver nombres dentro de la aldea ===
# dnsmasq maneja esto en /etc/config/dhcp, pero aqui van
# los registros estaticos (servicios registrados via API)

# Registros estaticos de servicios de la aldea
# Se agregan automaticamente cuando un servicio se registra via API
#
# config domain
#	option name 'nodo'
#	option ip '{{NODE_IPV6}}'
#	# Resultado: nodo.aldea1.com -> {{NODE_IPV6}}
#
# config domain
#	option name 'tienda'
#	option ip 'fd12:3456:7890::20'
#	# Resultado: tienda.aldea1.com -> IPv6 del servicio
#
# config domain
#	option name 'voip'
#	option ip 'fd12:3456:7890::30'
#	# Resultado: voip.aldea1.com -> IPv6 del servicio

# === Reenvio federado: resolver nombres de otras aldeas ===
# Cuando llega una peticion *.aldea2.com, reenviar al DNS de Aldea B
# por el tunel WireGuard
#
# config server
#	option server '[fdXX:aldeaB::1]'
#	option domain 'aldea2.com'
#
# config server
#	option server '[fdXX:aldeaC::1]'
#	option domain 'aldea3.com'

# === DNS publico: resolver nombres de Internet ===
# Para nombres que no son de ninguna aldea, usar DNS publico
config server
	option server '1.1.1.1'
	option domain ''

config server
	option server '8.8.8.8'
	option domain ''
