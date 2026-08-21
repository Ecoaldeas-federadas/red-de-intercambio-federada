# /etc/config/ssl - Plantilla OpenWrt para certificados SSL wildcard
#
# Configuracion de acme.sh para obtener certificados wildcard
# gratis de Lets Encrypt para *.{{ALDEA_DOMAIN}}
#
# Variables:
#   {{ALDEA_DOMAIN}}    = Dominio publico de la aldea (ej: aldea1.com)
#   {{ALDEA_EMAIL}}     = Email para registro en Lets Encrypt

# === Certificado wildcard con Lets Encrypt ===
# acme.sh obtiene *.aldea1.com automaticamente
# Todos los subdominios (nodo.aldea1.com, tienda.aldea1.com, etc.)
# heredan este certificado sin configuracion adicional

# Comando para obtener el certificado (se ejecuta automaticamente):
# acme.sh --issue --dns dns_cf -d '*.{{ALDEA_DOMAIN}}' -d '{{ALDEA_DOMAIN}}' \
#   --keylength ec-256 --accountemail '{{ALDEA_EMAIL}}'

# Variables de entorno necesarias para DNS challenge:
# export CF_Token="tu_api_token_de_cloudflare"
# export CF_Account_ID="tu_account_id"
# (o las variables del proveedor de DNS correspondiente)

# === Instalacion del certificado ===
# acme.sh --install-cert -d '*.{{ALDEA_DOMAIN}}' --ecc \
#   --key-file /etc/ssl/private/aldea.key \
#   --fullchain-file /etc/ssl/certs/aldea.crt \
#   --reloadcmd "service uhttpd restart"

# === Renovacion automatica ===
# acme.sh instala un cron job que renueva cada 60 dias
# Los certificados de Lets Encrypt duran 90 dias

# === Configuracion de uhttpd para servir con SSL ===
config uhttpd 'main'
	list listen_http '0.0.0.0:80'
	list listen_http '[::]:80'
	list listen_https '0.0.0.0:443'
	list listen_https '[::]:443'
	option cert '/etc/ssl/certs/aldea.crt'
	option key '/etc/ssl/private/aldea.key'
	option home '/www'
	option index_page 'index.html'
	option max_requests '20'
	option timeout '60'

# Redirect HTTP -> HTTPS
config redirect
	option name 'HTTP-to-HTTPS'
	option src 'wan'
	option src_dport '80'
	option dest 'wan'
	option dest_dport '443'
	option proto 'tcp'
	option target 'ACCEPT'
