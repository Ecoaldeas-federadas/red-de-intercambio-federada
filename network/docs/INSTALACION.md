# Guia de Instalacion

## Requisitos

### Hardware necesario

- **Servidor de aldea**: Mini-PC x86_64 con 2 tarjetas de red (ej: Intel NUC, Protectli Vault)
- **Switch** (opcional): para conectar mas dispositivos por cable
- **Access point WiFi** (opcional): para conectar dispositivos inalambricos
- **Conexion a Internet**: fibra, cable, ADSL, o radioenlace
- **VPS con IP publica** (opcional): ~$3/mes para STUN/Lighthouse

### Software necesario

- **Nodo de la aplicacion**: ya instalado y funcionando (ver README del repositorio)
- **BalenaEtcher o Rufus**: para flashear la imagen OpenWrt en el servidor
- **Acceso al dominio DNS**: para configurar el dominio publico de la aldea

## Paso 1: Instalar el nodo de la aplicacion (sin OpenWrt)

El nodo funciona desde el dia 1 por Internet normal, sin OpenWrt.

```powershell
git clone https://github.com/discapacidad5/red-de-intercambio-federada.git
cd red-de-intercambio-federada
# Seguir las instrucciones del README principal
powershell -ExecutionPolicy Bypass -File update.ps1
```

Abrir `http://localhost:8080` y completar el setup wizard con:
- Nombre del nodo
- Dominio del nodo

El nodo queda funcionando. **No se necesita OpenWrt para esto.**

## Paso 2: Comprar dominio publico (opcional, para SSL)

1. Comprar un dominio (ej: `aldea1.com`) en Cloudflare, Gandi, Namecheap, etc.
2. Configurar el DNS del dominio para apuntar a la IP publica de la aldea
3. Si la aldea esta detras de CGNAT, usar DNS dinamico (DDNS)

## Paso 3: Instalar OpenWrt en el servidor de aldea

### Opcion A: Generar imagen desde el nodo (recomendado)

1. En el nodo de la aplicacion, ir a **Ajustes > Red Privada**
2. Configurar:
   - Dominio de la aldea: `aldea1.com`
   - Generar IPv6 ULA automaticamente
   - Generar claves WireGuard automaticamente
3. Hacer clic en **"Descargar imagen OpenWrt"**
4. El nodo genera un archivo `openwrt-aldea1.com.img.gz`

### Opcion B: Generar imagen manualmente

```bash
# En Linux o WSL2
cd network/openwrt

# Generar claves WireGuard
../wireguard/generate-keys.sh /tmp/keys.txt

# Generar prefijo ULA
../ula/generate-ula.sh aldea1.com

# Generar imagen
./image-builder.sh aldea1.com fd12:3456:7890 <clave-privada> 51820
```

### Flashear la imagen

1. Descargar [BalenaEtcher](https://etcher.balena.io/) o [Rufus](https://rufus.ie/)
2. Abrir BalenaEtcher
3. Seleccionar el archivo `openwrt-aldea1.com.img.gz`
4. Seleccionar el disco/USB del servidor de aldea
5. Hacer clic en **Flash**
6. Conectar el USB al servidor de aldea y encender

## Paso 4: Configurar OpenWrt

### Conexiones fisicas

```
[ Internet ] --eth0--> [ Servidor OpenWrt ] --eth1--> [ Switch/AP WiFi ] -- [ dispositivos ]
```

- **eth0 (WAN)**: conectar al modem/router del ISP
- **eth1 (LAN)**: conectar al switch o access point WiFi

### Configuracion inicial

1. Desde un dispositivo conectado a la LAN, abrir `http://192.168.1.1`
2. Iniciar sesion en LuCI (panel web de OpenWrt)
3. Verificar que:
   - La WAN tiene Internet
   - La LAN entrega IPs por DHCP
   - WireGuard esta activo
   - El DNS resuelve `nodo.aldea1.com`

### Certificado SSL

```bash
# En el servidor OpenWrt (via SSH)
export CF_Token="tu_api_token_de_cloudflare"
export CF_Account_ID="tu_account_id"
sh /root/dns/acme-setup.sh aldea1.com admin@aldea1.com cloudflare
```

El certificado wildcard `*.aldea1.com` se instala automaticamente y se renueva cada 60 dias.

## Paso 5: Registrar el nodo en OpenWrt

1. En el nodo de la aplicacion, ir a **Ajustes > Red Privada**
2. Hacer clic en **"Registrar en OpenWrt"**
3. El nodo se registra como `nodo.aldea1.com` en el DNS de OpenWrt
4. Verificar: desde cualquier dispositivo de la aldea, abrir `https://nodo.aldea1.com`

## Paso 6: Federar con otra aldea

Ver [FEDERACION.md](FEDERACION.md) para instrucciones detalladas.

## Solucion de problemas

### El servidor OpenWrt no arranca

- Verificar que la imagen sea para x86_64 (no ARM)
- Verificar que el disco/USB este flasheado correctamente
- Probar con otro USB si persiste

### No hay Internet en la LAN

- Verificar conexion WAN (eth0 al modem)
- Verificar que el ISP entrega IP por DHCP
- Si IP estatica, configurar manualmente en LuCI > Network > WAN

### WireGuard no conecta

- Verificar que el puerto 51820 este abierto en el firewall del ISP
- Si detras de CGNAT, configurar STUN/Lighthouse (ver ARQUITECTURA.md)
- Verificar claves publicas de ambos lados

### DNS no resuelve

- Verificar que dnsmasq este activo: `/etc/init.d/dnsmasq status`
- Verificar registros: `nslookup nodo.aldea1.com 127.0.0.1`
- Revisar logs: `logread | grep dnsmasq`

### SSL no funciona

- Verificar que acme.sh obtuvo el certificado: `acme.sh --list`
- Verificar DNS challenge: el dominio debe estar en Cloudflare u otro proveedor soportado
- Revisar logs: `cat /var/log/acme.sh.log`
