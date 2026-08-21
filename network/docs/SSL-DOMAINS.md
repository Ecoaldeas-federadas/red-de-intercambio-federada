# Dominios y Certificados SSL

## Resumen

Cada aldea tiene un **dominio publico real** (ej: `aldea1.com`) con un **certificado SSL wildcard** (`*.aldea1.com`) que cubre todos los servicios de la aldea.

**OpenWrt** es el dueno del dominio y del certificado. El nodo de la aplicacion y cualquier otro servicio de la aldea obtienen su subdominio + SSL automaticamente de OpenWrt.

## Arquitectura de dominios

```
[ OpenWrt (gateway de la aldea) ]
  ├─ Dominio publico: aldea1.com
  ├─ Certificado wildcard: *.aldea1.com (Lets Encrypt, gratis)
  ├─ DNS autoritativo de aldea1.com dentro de la aldea
  ├─ Asigna subdominios:
  │   ├─ nodo.aldea1.com     -> IPv6 ULA del nodo de la app
  │   ├─ tienda.aldea1.com   -> IPv6 ULA del servicio de tienda
  │   ├─ voip.aldea1.com     -> IPv6 ULA del servidor Asterisk
  │   ├─ video.aldea1.com    -> IPv6 ULA del PeerTube
  │   └─ cualquier-servicio.aldea1.com
  └─ Todos heredan SSL del wildcard

[ Nodo de la aplicacion ]
  ├─ Se registra en OpenWrt: "Soy el nodo, dame nodo.aldea1.com"
  ├─ No maneja certificados
  └─ Recibe SSL automaticamente del wildcard
```

## Por que un certificado wildcard?

Un certificado wildcard `*.aldea1.com` cubre **todos** los subdominios:
- `nodo.aldea1.com` ✓
- `tienda.aldea1.com` ✓
- `voip.aldea1.com` ✓
- Cualquier servicio nuevo que se registre ✓

Sin wildcard, habria que obtener un certificado separado para cada servicio. Con wildcard, es automatico.

## Por que OpenWrt maneja el dominio y no el nodo?

1. **OpenWrt es el gateway de Internet**: tiene la conexion WAN
2. **OpenWrt corre el DNS**: es quien resuelve nombres dentro de la aldea
3. **OpenWrt puede dar subdominios a cualquier servicio**: no solo al nodo
4. **Si el nodo se cae, el dominio sigue funcionando**: los demas servicios no se ven afectados
5. **El nodo es solo un servicio mas**: no es especial, es uno mas de la aldea

## Obtener el certificado SSL

### Requisitos

1. Un dominio publico (ej: `aldea1.com`) comprado en Cloudflare, Gandi, etc.
2. El dominio configurado en un proveedor de DNS que soporte API (Cloudflare recomendado)
3. OpenWrt instalado y conectado a Internet

### Proceso automatico

```bash
# En OpenWrt (via SSH)
export CF_Token="tu_api_token_de_cloudflare"
export CF_Account_ID="tu_account_id"
sh /root/dns/acme-setup.sh aldea1.com admin@aldea1.com cloudflare
```

El script:
1. Registra una cuenta en Lets Encrypt
2. Crea un registro TXT en Cloudflare para validar el dominio (DNS-01 challenge)
3. Obtiene el certificado wildcard `*.aldea1.com`
4. Lo instala en `/etc/ssl/certs/aldea.crt` y `/etc/ssl/private/aldea.key`
5. Configura renovacion automatica cada 60 dias

### Por que DNS-01 challenge y no HTTP-01?

- **HTTP-01**: requiere que el servidor sea alcanzable en el puerto 80 desde Internet
- **DNS-01**: solo requiere acceso a la API del proveedor de DNS
- Las aldeas detras de CGNAT no pueden usar HTTP-01 (no son alcanzables desde Internet)
- DNS-01 funciona en cualquier escenario, incluyendo CGNAT

## Split-horizon DNS

El DNS funciona diferente dentro y fuera de la aldea:

### Dentro de la aldea (intranet)

```
nodo.aldea1.com -> fd12:3456:7890::10 (IPv6 ULA del nodo)
```

El trafico va directamente por la LAN, sin salir a Internet.

### Fuera de la aldea (Internet)

```
nodo.aldea1.com -> 203.0.113.50 (IP publica de OpenWrt)
```

OpenWrt hace proxy reverso al nodo por la LAN.

### Resultado

- SSL funciona en ambos casos (mismo certificado wildcard)
- Dentro de la aldea: rapido, no consume Internet
- Fuera de la aldea: funciona pero consume ancho de banda

## Nombres internos vs publicos

### Nombres publicos (certificados por Lets Encrypt)

- `aldea1.com` - dominio base
- `*.aldea1.com` - wildcard para todos los subdominios
- `nodo.aldea1.com` - nodo de la aplicacion
- `tienda.aldea1.com` - servicio de tienda

### Nombres privados (NO certificados publicamente)

- `aldea1.red` - dominio interno de la intranet (opcional)
- Los nombres `.red` o `.priv` no son certificables publicamente
- Si se quieren usar, se necesita una CA interna (mas complejo)
- **Recomendacion**: usar subdominios del dominio publico (`nodo.aldea1.com`) en vez de nombres `.priv`

## Renovacion automatica

- Los certificados de Lets Encrypt duran 90 dias
- acme.sh instala un cron job que renueva cada 60 dias
- La renovacion usa DNS-01 (no requiere que el servidor sea alcanzable)
- Si la renovacion falla, acme.sh reintenta automaticamente

## Si no se quiere comprar un dominio

El nodo de la aplicacion funciona **sin dominio publico** por IP o por nombre local.

OpenWrt tambien puede funcionar sin dominio publico, pero:
- No habra SSL wildcard automatico
- Los servicios usaran IPs en vez de nombres
- Se puede usar una CA interna (mas complejo de mantener)

**Recomendacion**: comprar un dominio (~$10/ano) para tener SSL automatico y nombres amigables.
