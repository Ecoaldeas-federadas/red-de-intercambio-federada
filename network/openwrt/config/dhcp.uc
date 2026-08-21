# /etc/config/dhcp - Plantilla OpenWrt para servidor de aldea
#
# Configuracion DHCPv4 + SLAAC IPv6 para entregar IPs automaticamente
# a todos los dispositivos de la aldea (telefonos, PCs, tablets, etc.)
#
# Variables:
#   {{ULA_PREFIX}}      = Prefijo IPv6 ULA (ej: fd12:3456:7890)
#   {{LAN_IPv4}}        = IP IPv4 del gateway (ej: 192.168.1.1)
#   {{ALDEA_DOMAIN}}    = Dominio de la aldea (ej: aldea1.com)

config dnsmasq
	option domainneeded '1'
	option boguspriv '1'
	option filterwin2k '0'
	option localise_queries '1'
	option rebind_protection '1'
	option rebind_localhost '1'
	option local '/{{ALDEA_DOMAIN}}/'
	option domain '{{ALDEA_DOMAIN}}'
	option expandhosts '1'
	option nonegcache '0'
	option cachesize '1000'
	option authoritative '1'
	option readethers '1'
	option leasefile '/tmp/dhcp.leases'
	option resolvfile '/tmp/resolv.conf.d/resolv.conf.auto'
	option nonwildcard '1'
	option localservice '1'
	option ednspacket_max '1232'
	option localise_queries '1'

	# DNS federado: reenviar consultas de otras aldeas por el tunel
	# Se agregan automaticamente al federar con otra aldea
	# list server '/aldea2.com/' '[fdXX:aldeaB::1]#53'
	# list server '/aldea3.com/' '[fdXX:aldeaC::1]#53'

	# Registrar hostname automatico via SLAAC + DHCP
	option noresolv '0'

# === DHCPv4: Entregar IPs IPv4 locales a dispositivos ===
config dhcp 'lan'
	option interface 'lan'
	option start '100'
	option limit '150'
	option leasetime '12h'
	option dhcpv4 'server'
	option ra 'server'
	option ra_management '1'
	option ra_default '1'

# === SLAAC: Entregar IPv6 ULA automaticamente ===
config dhcp 'lan6'
	option interface 'lan6'
	option ra 'server'
	option dhcpv6 'server'
	option ra_management '1'
	option ra_default '1'
	option dns_service '1'
	list dhcp_option 'option6:dns-server,[{{ULA_PREFIX}}::1]'

# === Configuracion RA (Router Advertisement) ===
config ra 'lan6_ra'
	option interface 'lan6'
	option router_lifetime '1800'
	option reachable_time '0'
	option retransmit_time '0'
	option hop_limit '64'
	option mtu '0'
	option preference 'high'
	option managed '0'
	option other '0'
	list prefix '{{ULA_PREFIX}}::/64'
	option prefix_lifetime '1800'
	option prefix_preferred_lifetime '900'

# WAN: no servir DHCP en la interfaz de Internet
config dhcp 'wan'
	option interface 'wan'
	option ignore '1'

config dhcp 'wan6'
	option interface 'wan6'
	option ignore '1'
