# coturn.conf.tpl - Configuracion del servidor STUN/TURN para NAT traversal
#
# coturn ayuda a las aldeas detras de NAT/CGNAT a encontrarse
# para establecer tuneles WireGuard P2P directos.
#
# Instalar en un VPS con IP publica:
#   apt install coturn
#   cp coturn.conf.tpl /etc/turnserver.conf
#   systemctl enable coturn
#   systemctl start coturn
#
# Variables:
#   {{LIGHTHOUSE_IP}}    = IP publica del servidor
#   {{TURN_USER}}        = Usuario para TURN (cambiar!)
#   {{TURN_PASSWORD}}    = Password para TURN (cambiar!)

listening-port=3478
tls-listening-port=5349
listening-ip={{LIGHTHOUSE_IP}}
relay-ip={{LIGHTHOUSE_IP}}
external-ip={{LIGHTHOUSE_IP}}

# Fingerprint y credenciales
fingerprint
lt-cred-mech
user={{TURN_USER}}:{{TURN_PASSWORD}}

# Limites de ancho de banda (el relay solo se usa en casos extremos)
max-bps=102400
bps-capacity=1024000

# Seguridad
no-loopback-peers
no-multicast-peers
no-tlsv1
no-tlsv1_1

# Logging
log-file=/var/log/turnserver.log
simple-log
verbose

# Solo STUN (no relay a menos que sea necesario)
# Si todas las aldeas pueden hacer hole-punching, descomentar:
# no-relay
