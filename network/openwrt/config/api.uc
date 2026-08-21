# /etc/config/api - Plantilla OpenWrt para API REST de registro de servicios
#
# OpenWrt expone una API REST para que los servicios de la aldea
# (nodo de la aplicacion, PeerTube, VoIP, etc.) puedan registrar
# sus subdominios automaticamente en el DNS.
#
# La API se implementa via rpcd (OpenWrt RPC daemon) y LuCI.
#
# Variables:
#   {{ALDEA_DOMAIN}}    = Dominio de la aldea (ej: aldea1.com)
#   {{API_TOKEN}}       = Token de autenticacion para la API

# === Configuracion de rpcd ===
# rpcd escucha en /var/run/rpcd.socket (Unix socket)
# LuCI expone la API via CGI en /cgi-bin/luci/rpc/

# === Endpoints disponibles ===
#
# POST /cgi-bin/luci/rpc/dns
#   Registra un subdominio en el DNS de la aldea
#   Body: { "name": "nodo", "ipv6": "fd12:3456:7890::10", "token": "{{API_TOKEN}}" }
#   Resultado: nodo.aldea1.com -> fd12:3456:7890::10
#
# DELETE /cgi-bin/luci/rpc/dns
#   Elimina un subdominio del DNS
#   Body: { "name": "nodo", "token": "{{API_TOKEN}}" }
#
# GET /cgi-bin/luci/rpc/dns
#   Lista todos los subdominios registrados
#   Body: { "token": "{{API_TOKEN}}" }
#
# GET /cgi-bin/luci/rpc/network/status
#   Estado de la red: peers conectados, tuneles activos, IPv6 ULA
#   Body: { "token": "{{API_TOKEN}}" }
#
# POST /cgi-bin/luci/rpc/wireguard/peer
#   Agrega un peer WireGuard (federar con otra aldea)
#   Body: { "public_key": "...", "endpoint": "...", "allowed_ips": "...", "token": "{{API_TOKEN}}" }

# === Autenticacion ===
# Todos los endpoints requieren un token API que se genera al instalar OpenWrt
# El token se guarda en /etc/config/api y se comparte con los servicios autorizados

# === Implementacion ===
# El endpoint se implementa en /usr/share/luci/dns-api.lua
# (ver network/openwrt/luci/dns-api.lua)
