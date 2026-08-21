# Arquitectura Tecnica

## Vision General

La red privada federada tiene 4 capas:

```
Capa 4: Servicios         (nodo de app, PeerTube, VoIP, etc.)
Capa 3: DNS + SSL         (dnsmasq + acme.sh wildcard)
Capa 2: Enrutamiento      (WireGuard + Babel + IPv6 ULA)
Capa 1: Transporte        (Internet comercial + tuneles cifrados)
```

## Capa 1: Transporte

- **Internet comercial**: la aldea se conecta a Internet normal (WAN)
- **Tuneles WireGuard**: cifran el trafico entre aldeas atravesando NAT/CGNAT
- **STUN/Lighthouse**: servidor con IP publica que ayuda a dos aldeas detras de NAT a encontrarse (solo apretón de manos, no ve el trafico)
- **PersistentKeepalive=25**: mantiene los tuneles abiertos detras de NAT enviando un paquete diminuto cada 25 segundos

## Capa 2: Enrutamiento

- **IPv6 ULA (fd00::/8)**: cada aldea tiene un prefijo /48 unico
- **Generacion sin colisiones**: hash SHA-256 del dominio + sal aleatoria
- **SLAAC**: los dispositivos obtienen su IPv6 automaticamente (sin DHCP)
- **DHCPv4**: compatibilidad con dispositivos que solo soportan IPv4 (192.168.X.0/24)
- **Babel**: protocolo de enrutamiento dinamico entre aldeas (alternativa a BGP, mas simple)
- **Dual stack**: IPv4 para compatibilidad, IPv6 ULA para la intranet federada

## Capa 3: DNS + SSL

- **dnsmasq**: DNS autoritativo del dominio de la aldea (ej: aldea1.com)
- **DNS federado**: reenvio condicional hacia otras aldeas por el tunel
- **acme.sh**: obtiene certificado wildcard *.aldea1.com de Lets Encrypt (gratis)
- **DNS challenge**: necesario porque el servidor puede estar detras de NAT
- **Split-horizon DNS**: en la intranet resuelve a IPv6 ULA, en Internet a IP publica

## Capa 4: Servicios

- **Nodo de la aplicacion**: se registra como nodo.aldea1.com en OpenWrt
- **Otros servicios**: cualquier habitante puede registrar su servicio (PeerTube, VoIP, etc.)
- **API REST**: OpenWrt expone /cgi-bin/luci/rpc/dns para registro automatico
- **SSL automatico**: todos los servicios heredan el wildcard *.aldea1.com

## Por que OpenWrt maneja el dominio y no el nodo?

1. OpenWrt es el gateway de Internet (tiene la conexion WAN)
2. OpenWrt corre el DNS de toda la aldea
3. OpenWrt puede dar subdominios a cualquier servicio, no solo al nodo
4. Si el nodo se cae, el dominio y los demas servicios siguen funcionando
5. El nodo es solo un servicio mas de la aldea

## Por que IPv6 ULA y no IPv4?

- IPv4 privada (192.168.0.0/16) tiene solo 65,536 direcciones -> colisiones seguras entre aldeas
- IPv6 ULA (fd00::/8) tiene billones de prefijos /48 -> colisiones practicamente imposibles
- IPv6 ULA no entra en conflicto con direcciones publicas IPv6
- SLAAC permite autoconfiguracion sin servidor DHCP

## NAT Traversal

```
Aldea A (CGNAT)          Lighthouse (IP publica)         Aldea B (CGNAT)
     |                          |                              |
     |--- "Hola, soy A" ------->|                              |
     |                          |<--- "Hola, soy B" -----------|
     |                          |                              |
     |<-- "B esta en IP:port" --|                              |
     |                          |-- "A esta en IP:port" ------>|
     |                          |                              |
     |======== tunel P2P directo ===============================|
     |  (el Lighthouse ya no participa)                        |
```

- El Lighthouse solo coordina el apretón de manos (unos KB)
- El trafico masivo fluye directamente entre las aldeas
- Si el hole punching falla (NAT simetrico), se usa TURN relay (caso extremo)
