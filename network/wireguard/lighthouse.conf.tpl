# lighthouse.conf.tpl - Configuracion del servidor Lighthouse/STUN
#
# El Lighthouse es un servidor ligero con IP publica que ayuda
# a dos aldeas (ambas detras de NAT/CGNAT) a encontrarse para
# establecer un tunel P2P directo.
#
# Solo participa en el apretón de manos inicial (unos KB).
# El trafico masivo fluye directamente entre las aldeas.
#
# Se puede instalar en un VPS economico (~$3/mes) o en cualquier
# servidor con IP publica.
#
# Variables:
#   {{LIGHTHOUSE_IP}}     = IP publica del Lighthouse
#   {{WG_PORT}}           = Puerto WireGuard (ej: 51820)

# === Opcion 1: coturn (STUN/TURN server) ===
# Instalar: apt install coturn
# Configuracion: /etc/turnserver.conf

listening-port=3478
listening-ip={{LIGHTHOUSE_IP}}
relay-ip={{LIGHTHOUSE_IP}}
fingerprint
lt-cred-mech
# Credentials para TURN (opcional, solo si se necesita relay)
user=aldea:password-seguro-aqui
# Limites
max-bps=102400
no-loopback-peers
no-multicast-peers
# Logging
log-file=/var/log/turnserver.log
simple-log

# === Opcion 2: Lighthouse (Nebula) ===
# Si se prefiere usar Nebula como Lighthouse:
#
# lighthouse.yaml:
# ---
# lighthouse:
#   am_lighthouse: true
#   serve_dns: true
#   local_range: fd00::/8
# listen:
#   - 0.0.0.0:4242
# pki:
#   ca: /etc/nebula/ca.crt
#   cert: /etc/nebula/lighthouse.crt
#   key: /etc/nebula/lighthouse.key

# === Notas ===
# - El Lighthouse NO ve el trafico entre aldeas, solo coordina el apretón de manos
# - Un VPS de 512MB RAM puede coordinar miles de aldeas
# - Si las aldeas tienen IP publica o usan radioenlaces, no necesitan Lighthouse
# - El Lighthouse es opcional pero recomendado para aldeas detras de CGNAT
