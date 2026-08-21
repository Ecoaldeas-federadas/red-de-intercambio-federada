# dnsmasq.conf.tpl - Plantilla DNS federado para OpenWrt
#
# Configuracion de dnsmasq como DNS autoritativo de la aldea
# y reenviador federado hacia otras aldeas.
#
# Variables:
#   {{ALDEA_DOMAIN}}    = Dominio de la aldea (ej: aldea1.com)
#   {{ULA_PREFIX}}      = Prefijo IPv6 ULA (ej: fd12:3456:7890)
#   {{NODE_IPV6}}       = IPv6 ULA del nodo de la aplicacion

# === Configuracion general ===
domain-needed
bogus-priv
no-resolv
expand-hosts
localise-queries
authoritative
cache-size=1000
dns-forward-max=1000

# === Zona local: la aldea es autoritativa de su dominio ===
local=/{{ALDEA_DOMAIN}}/
domain={{ALDEA_DOMAIN}}

# === DNS upstream: resolver nombres de Internet ===
server=1.1.1.1
server=8.8.8.8

# === DNS federado: reenviar consultas de otras aldeas ===
# Se agregan automaticamente al federar con otra aldea
# server=/aldea2.com/[fdXX:aldeaB::1]
# server=/aldea3.com/[fdXX:aldeaC::1]

# === Registros estaticos de servicios ===
# El nodo de la aplicacion se registra aqui automaticamente
# address=/nodo.{{ALDEA_DOMAIN}}/{{NODE_IPV6}}

# Otros servicios se registran via API REST de OpenWrt:
# address=/tienda.{{ALDEA_DOMAIN}}/fd12:3456:7890::20
# address=/voip.{{ALDEA_DOMAIN}}/fd12:3456:7890::30
# address=/video.{{ALDEA_DOMAIN}}/fd12:3456:7890::40

# === DHCP IPv4 ===
dhcp-range=192.168.1.100,192.168.1.250,12h
dhcp-option=option:dns-server,192.168.1.1
dhcp-option=option:router,192.168.1.1

# === SLAAC IPv6 ===
enable-ra
dhcp-range=::,constructor:br-lan,ra-stateless,12h
dhcp-option=option6:dns-server,[{{ULA_PREFIX}}::1]

# === Registro automatico de hostnames ===
# Los dispositivos que se conectan por DHCP/SLAAC se registran
# automaticamente como hostname.{{ALDEA_DOMAIN}}
