# Como Federar Aldeas

## Que significa federar?

Federar dos aldeas significa conectarlas por un tunel cifrado WireGuard para que:
- Los dispositivos de una aldea puedan acceder a servicios de la otra
- Los nodos de la aplicacion puedan federarse por la intranet (no por Internet)
- El DNS de una aldea resuelva nombres de la otra

## Federacion paso a paso

### Escenario: Aldea A quiere federar con Aldea B

#### Paso 1: Aldea A genera instalador para Aldea B

1. En el nodo de Aldea A, ir a **Ajustes > Red Privada > Peers**
2. Hacer clic en **"Generar instalador para nueva aldea"**
3. El nodo genera:
   - Nuevo prefijo IPv6 ULA para Aldea B (sin colisiones con Aldea A)
   - Nuevas claves WireGuard para Aldea B
   - Imagen OpenWrt preconfigurada con:
     - Datos de Aldea B (ULA, claves)
     - Peer WireGuard de Aldea A ya configurado
     - DNS federado ya configurado
4. Descargar el archivo `openwrt-aldeaB.com.img.gz`

#### Paso 2: Aldea B instala la imagen

1. Aldea B recibe el archivo `openwrt-aldeaB.com.img.gz`
2. Flashear en su servidor OpenWrt (ver [INSTALACION.md](INSTALACION.md))
3. Conectar el servidor OpenWrt de Aldea B a Internet y a su LAN
4. Encender el servidor

#### Paso 3: Conexion automatica

Al encender, el servidor OpenWrt de Aldea B:
1. Se conecta a Internet (WAN)
2. Establece tunel WireGuard con Aldea A (PersistentKeepalive=25)
3. Inicia DNS federado (reenvia consultas de aldeaA.com a Aldea A)
4. Inicia SLAAC para entregar IPv6 ULA a sus dispositivos

#### Paso 4: Aldea B instala el nodo de la aplicacion

1. Aldea B instala el nodo de la aplicacion (igual que Aldea A)
2. En Ajustes > Red Privada, configura:
   - Direccion de su OpenWrt
   - Subdominio: `nodo`
3. El nodo se registra en OpenWrt: `nodo.aldeaB.com`
4. El nodo detecta que Aldea A esta en la intranet y se federa por IPv6 ULA

#### Paso 5: Verificacion

Desde Aldea A:
- `nslookup nodo.aldeaB.com` debe resolver a la IPv6 ULA del nodo de Aldea B
- `https://nodo.aldeaB.com` debe cargar el nodo de Aldea B (con SSL valido)

Desde Aldea B:
- `nslookup nodo.aldeaA.com` debe resolver a la IPv6 ULA del nodo de Aldea A
- `https://nodo.aldeaA.com` debe cargar el nodo de Aldea A (con SSL valido)

## Federacion manual (sin instalador automatico)

Si las dos aldeas ya tienen OpenWrt instalado:

### 1. Intercambiar claves publicas

Aldea A:
```bash
# En OpenWrt de Aldea A
wg show wg0 public-key
# Resultado: clave publica de Aldea A
```

Aldea B:
```bash
# En OpenWrt de Aldea B
wg show wg0 public-key
# Resultado: clave publica de Aldea B
```

### 2. Agregar peer en Aldea A

En LuCI > Network > WireGuard > wg0 > Peers:
- Public key: `<clave publica de Aldea B>`
- Endpoint: `aldeaB.com:51820` (o IP publica de Aldea B)
- Allowed IPs: `fdXX:aldeaB::/48` (prefijo ULA de Aldea B)
- Persistent Keepalive: `25`

### 3. Agregar peer en Aldea B

En LuCI > Network > WireGuard > wg0 > Peers:
- Public key: `<clave publica de Aldea A>`
- Endpoint: `aldeaA.com:51820` (o IP publica de Aldea A)
- Allowed IPs: `fdXX:aldeaA::/48` (prefijo ULA de Aldea A)
- Persistent Keepalive: `25`

### 4. Configurar DNS federado

En Aldea A, agregar a /etc/config/dhcp:
```
list server '/aldeaB.com/' '[fdXX:aldeaB::1]'
```

En Aldea B, agregar a /etc/config/dhcp:
```
list server '/aldeaA.com/' '[fdXX:aldeaA::1]'
```

Reiniciar dnsmasq en ambas:
```bash
/etc/init.d/dnsmasq restart
```

## Federacion detras de CGNAT

Si ambas aldeas estan detras de CGNAT (sin IP publica):

1. Instalar un Lighthouse/STUN en un VPS con IP publica (ver [ARQUITECTURA.md](ARQUITECTURA.md))
2. Configurar ambas aldeas para usar el Lighthouse
3. El Lighthouse coordina el apretón de manos
4. El trafico fluye directamente entre las aldeas (P2P)
5. Si el hole punching falla, se usa TURN relay (caso extremo)

## Revocar federacion

Para dejar de federar con una aldea:

1. En LuCI > Network > WireGuard, eliminar el peer
2. En /etc/config/dhcp, eliminar el reenvio DNS de esa aldea
3. Reiniciar WireGuard y dnsmasq:
   ```bash
   /etc/init.d/network restart
   /etc/init.d/dnsmasq restart
   ```
4. En el nodo de la aplicacion, eliminar el peer de la intranet en Ajustes > Red Privada
