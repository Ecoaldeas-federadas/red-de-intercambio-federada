# Red Privada Federada para Ecoaldeas

Sistema de red privada federada que permite a las aldeas comunicarse entre si sin depender de Internet publico, usando OpenWrt + WireGuard + IPv6 ULA + DNS federado.

## Que es esto?

Un sistema que crea una **Internet privada** entre aldeas. Cada aldea tiene su propio servidor OpenWrt que:

- Conecta a la aldea a Internet comercial (WAN)
- Crea una red local (LAN) con WiFi y cable para todos los habitantes
- Establece tuneles cifrados con otras aldeas federadas (WireGuard)
- Asigna direcciones IPv6 unicas sin colisiones (ULA)
- Resuelve nombres de dominio locales (DNS federado)
- Maneja certificados SSL wildcard para todos los servicios

## Es opcional

El **nodo de la aplicacion** (sistema de intercambio federado) funciona **sin OpenWrt** desde el dia 1, por Internet normal. OpenWrt se instala **despues**, cuando la aldea quiere tener su propia red privada federada.

## Componentes

```
network/
├── ula/generate-ula.sh           # Genera prefijo IPv6 ULA unico
├── openwrt/
│   ├── image-builder.sh          # Genera imagen OpenWrt preconfigurada
│   ├── packages.txt              # Lista de paquetes a instalar
│   ├── config/
│   │   ├── network.uc            # Interfaces WAN, LAN, ULA, WireGuard
│   │   ├── dhcp.uc               # DHCPv4 + SLAAC IPv6
│   │   ├── firewall.uc           # Zonas y reglas de firewall
│   │   ├── wireguard.uc          # Tuneles P2P entre aldeas
│   │   ├── dns.uc                # DNS federado
│   │   ├── ssl.uc                # Certificado wildcard Lets Encrypt
│   │   └── api.uc                # API REST para registro de servicios
│   └── luci/dns-api.lua          # Endpoint API para subdominios
├── dns/
│   ├── dnsmasq.conf.tpl          # Plantilla DNS
│   └── acme-setup.sh             # Script certificado SSL wildcard
├── wireguard/
│   ├── generate-keys.sh          # Genera claves WireGuard
│   ├── peer-config.tpl           # Plantilla de peer federado
│   └── lighthouse.conf.tpl       # Servidor coordinador (STUN)
├── stun/coturn.conf.tpl          # Servidor STUN/TURN
└── docs/                         # Documentacion completa
```

## Flujo "Llave en Mano"

1. **Aldea A** instala el nodo de la aplicacion (funciona por Internet)
2. En Ajustes > Red Privada, configura su dominio y genera su IPv6 ULA
3. Hace clic en "Generar instalador para nueva aldea"
4. El nodo genera una imagen OpenWrt preconfigurada (con claves, IPs, DNS)
5. Aldea A entrega el archivo a Aldea B
6. Aldea B flashea la imagen en su servidor OpenWrt
7. Aldea B enciende -> se conecta automaticamente a Aldea A por tunel cifrado
8. Aldea B instala el nodo de la aplicacion -> se federan por intranet

## Documentacion

- [Arquitectura tecnica](docs/ARCHITECTURE.md)
- [Guia de instalacion](docs/INSTALL.md)
- [Como federar aldeas](docs/FEDERATION.md)
- [Hardware recomendado](docs/HARDWARE.md)
- [Dominios y certificados SSL](docs/SSL-DOMAINS.md)
