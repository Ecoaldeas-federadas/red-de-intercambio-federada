# Dominios y Asignacion Automatica de Nodos

## Resumen

Este documento describe como se asignan dominios a los nodos y servicios de una aldea, como OpenWrt gestiona el DNS y los certificados, y que ocurre cuando se instalan nuevos nodos o se federan aldeas.

El objetivo es que cualquier administrador de red comunitario pueda instalar un nuevo nodo y obtener automaticamente un subdominio funcional (ej: `nodo2.aldea1.com`) sin manejar certificados ni configuracion DNS manual.

---

## 1. Arquitectura de dominios

La aldea tiene un dominio publico real (ej: `aldea1.com`). **OpenWrt** es el dueno de ese dominio y de todo lo relacionado con DNS y certificados.

```
[ OpenWrt (gateway de la aldea) ]
  |- Dominio publico: aldea1.com
  |- Certificado SSL wildcard: *.aldea1.com (Lets Encrypt, via acme.sh)
  |- DNS autoritativo de aldea1.com dentro de la aldea (dnsmasq)
  |- Asigna subdominios a nodos y servicios:
  |   |- nodo.aldea1.com    -> IPv6 ULA del nodo de la app
  |   |- nodo2.aldea1.com   -> IPv6 ULA del segundo nodo
  |   |- video.aldea1.com   -> IPv6 ULA del PeerTube
  |   |- tienda.aldea1.com  -> IPv6 ULA del servicio de tienda
  |   '- cualquier-servicio.aldea1.com
  '- Todos heredan SSL del wildcard

[ Nodo de la aplicacion ]
  |- Solicita su subdominio a OpenWrt
  |- NO maneja el dominio
  |- NO maneja el certificado SSL
  '- Recibe SSL automaticamente del wildcard de OpenWrt
```

### Principios

- **OpenWrt administra el dominio publico de la aldea** (ej: `aldea1.com`).
- **OpenWrt obtiene el certificado SSL wildcard** (`*.aldea1.com`) con `acme.sh` usando el challenge DNS-01.
- **Cada nodo o servicio obtiene un subdominio**: `nodo.aldea1.com`, `video.aldea1.com`, etc.
- **El nodo de la aplicacion NO maneja el dominio ni el certificado**. Solo conoce su IPv6 ULA y su nombre.
- **OpenWrt resuelve los subdominios via DNS** usando `dnsmasq`, que viene preinstalado en OpenWrt.

### Por que OpenWrt y no el nodo

1. OpenWrt es el gateway de Internet: tiene la conexion WAN.
2. OpenWrt corre el DNS: es quien resuelve nombres dentro de la aldea.
3. OpenWrt puede dar subdominios a cualquier servicio, no solo al nodo.
4. Si el nodo se cae, el dominio sigue funcionando para los demas servicios.
5. El nodo es solo un servicio mas de la aldea, no es especial.

---

## 2. Asignacion automatica de dominios a nuevos nodos

Cuando se instala un nuevo nodo en la aldea, este solicita un dominio a OpenWrt de forma automatica. El administrador no necesita crear entradas DNS a mano.

### Que envia el nuevo nodo

- **nombre deseado**: ej: `nodo2`
- **numero de nodo**: ej: `102`
- **IPv6 ULA**: ej: `fd12:3456:7890::10`
- **token de autorizacion**: credencial compartida con OpenWrt

### Que hace OpenWrt

1. Recibe la solicitud via la API RPC de LuCI.
2. Verifica si el subdominio `nodo2.aldea1.com` esta disponible.
3. **Si esta disponible**: crea la entrada DNS en `dnsmasq` y responde con el dominio asignado.
4. **Si ya existe**: sugiere un nombre alternativo (ej: `nodo2-2`, `nodo102`).

### Respuesta de OpenWrt

```json
{
  "status": "ok",
  "domain": "nodo2.aldea1.com",
  "ipv6": "fd12:3456:7890::10",
  "wildcard_cert": true
}
```

Si el nombre ya existe:

```json
{
  "status": "conflict",
  "requested": "nodo2.aldea1.com",
  "suggestions": ["nodo2-2.aldea1.com", "nodo102.aldea1.com"]
}
```

### Script de asignacion

El script que gestiona la asignacion del lado de OpenWrt es:

```
network/openwrt/domain-assign.sh
```

Este script:
- Lee el token de `/etc/aldea/domain-token`.
- Recibe los parametros del nodo (nombre, numero, IPv6).
- Verifica disponibilidad contra los registros actuales de `dnsmasq`.
- Crea el registro DNS en `/etc/dnsmasq.d/aldea-domains.conf`.
- Recarga `dnsmasq` para que el cambio surta efecto.
- Devuelve el dominio asignado al nodo.

---

## 3. Flujo de instalacion de un nuevo nodo

1. **Instalar el nodo de la aplicacion** (sin OpenWrt). El nodo puede instalarse en cualquier equipo: Raspberry Pi, mini PC, servidor, etc.
2. **El nodo funciona por Internet normal con su IP**. No necesita dominio para arrancar.
3. **Si OpenWrt esta disponible, el nodo solicita un dominio**:

   ```
   POST http://openwrt-ip/cgi-bin/luci/rpc/domain/assign
   Content-Type: application/json

   {
     "node_name": "nodo2",
     "node_number": 102,
     "ipv6": "fd12:3456:7890::10",
     "token": "TOKEN_COMPARTIDO"
   }
   ```

4. **OpenWrt asigna**: `nodo2.aldea1.com` -> `fd12:3456:7890::10`.
5. **El nodo ya es accesible por nombre dentro de la intranet**. Cualquier equipo de la aldea puede acceder a `https://nodo2.aldea1.com`.

### Notas

- El nodo guarda el dominio asignado en su configuracion local.
- Si el nodo se reinicia, recuerda su dominio y no necesita volver a solicitarlo.
- Si el nodo cambia de IPv6, puede solicitar una reasignacion con el mismo nombre.

---

## 4. DNS split-horizon

El DNS funciona diferente dentro y fuera de la aldea. Esto se llama **split-horizon DNS**.

### Dentro de la intranet

```
nodo.aldea1.com -> fd12:3456:7890::10  (IPv6 ULA del nodo)
```

El trafico va directamente por la LAN, sin salir a Internet. Es rapido y no consume ancho de banda.

### Desde Internet

```
nodo.aldea1.com -> 203.0.113.50  (IP publica de OpenWrt, si esta configurado)
```

OpenWrt hace proxy reverso al nodo por la LAN. El trafico si consume Internet.

### Certificado wildcard

El certificado wildcard `*.aldea1.com` **cubre ambos casos**. El mismo certificado sirve para la intranet y para Internet, porque el nombre del dominio es el mismo. Lo que cambia es solo la IP a la que resuelve.

### Resultado

- SSL funciona en ambos casos con el mismo certificado.
- Dentro de la aldea: rapido, no consume Internet.
- Fuera de la aldea: funciona pero consume ancho de banda.

---

## 5. Como configurar el token de autorizacion en OpenWrt

El token evita que cualquier equipo desconocido pueda registrar subdominios en la aldea. Es una credencial compartida entre OpenWrt y los nodos autorizados.

### Paso 1: Generar un token aleatorio

En OpenWrt (via SSH):

```bash
# Generar un token aleatorio de 32 caracteres
head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32
```

Ejemplo de resultado: `aB3xK9mP2nQ7vR4sT6wY1zA8cE5fG0hJ`

### Paso 2: Guardar el token en OpenWrt

```bash
mkdir -p /etc/aldea
echo -n "aB3xK9mP2nQ7vR4sT6wY1zA8cE5fG0hJ" > /etc/aldea/domain-token
chmod 600 /etc/aldea/domain-token
```

### Paso 3: Configurar el mismo token en el nodo

En la pagina de **Red Privada** del nodo de la aplicacion, introducir el mismo token en el campo correspondiente. El nodo lo usara al solicitar su dominio a OpenWrt.

### Recomendaciones

- Usar un token distinto por aldea.
- No compartir el token fuera de la aldea.
- Si se sospecha que el token se ha comprometido, regenerarlo y actualizarlo en todos los nodos.

---

## 6. Limitaciones de los certificados wildcard

### Que cubre el wildcard

Un certificado wildcard `*.aldea1.com` cubre **todos los subdominios de primer nivel**:

- `nodo.aldea1.com` - cubierto
- `video.aldea1.com` - cubierto
- `tienda.aldea1.com` - cubierto
- `cualquier-servicio.aldea1.com` - cubierto

### Que NO cubre el wildcard

El wildcard **no cubre subdominios de segundo nivel**:

- `nodo.otra.aldea1.com` - NO cubierto
- `app.video.aldea1.com` - NO cubierto
- `api.tienda.aldea1.com` - NO cubierto

### Como resolver multiples niveles

Si se necesitan subdominios de segundo nivel, hay dos opciones:

1. **Certificado de multiples dominios (SAN)**: incluir cada subdominio explicitamente en el certificado. Mas trabajo de mantenimiento.
2. **Wildcard mas amplio**: obtener un wildcard `*.otra.aldea1.com` adicional. Requiere un certificado por cada nivel.

### Recomendacion

Mantener la arquitectura simple: **un solo nivel de subdominios** (`servicio.aldea1.com`). Si se necesita organizar mejor, usar nombres descriptivos en un solo nivel (ej: `video-tienda.aldea1.com` en vez de `tienda.video.aldea1.com`).

---

## 7. Federacion de dominios

Cuando dos aldeas se federan, intercambian informacion sobre sus dominios para que los nodos de una aldea puedan resolver los nombres de la otra.

### Como funciona

1. **La aldea A** tiene el dominio `aldea1.com`.
2. **La aldea B** tiene el dominio `aldea2.com`.
3. Al federarse, cada aldea le indica a la otra cual es su dominio.
4. El **nodo A** sabe que el **nodo B** esta en `aldea2.com`.
5. **DNS federado**: el nodo A puede resolver nombres de `aldea2.com` via la intranet federada.
6. **Para Internet**: cada aldea publica su propio DNS de forma independiente.

### Ejemplo

```
[ Aldea A - aldea1.com ]          [ Aldea B - aldea2.com ]
  |- nodo.aldea1.com                |- nodo.aldea2.com
  |- video.aldea1.com               |- video.aldea2.com
  |- tienda.aldea1.com              |- tienda.aldea2.com

Federacion:
  |- nodo.aldea1.com puede resolver nodo.aldea2.com
  |- nodo.aldea2.com puede resolver video.aldea1.com
```

### Consideraciones

- La federacion de DNS requiere que los OpenWrt de cada aldea se conozcan entre si (IPs y dominios).
- El trafico entre aldeas federadas puede ir por la intranet federada o por Internet, segun la topologia.
- Los certificados wildcard de cada aldea son independientes: `*.aldea1.com` y `*.aldea2.com`.

---

## 8. Que pasa si OpenWrt se cae

OpenWrt es el punto central de DNS y certificados. Si se cae, hay consecuencias, pero el sistema no deja de funcionar.

### Que deja de funcionar

- **Los dominios dejan de resolver por nombre**. `nodo.aldea1.com` ya no resuelve porque el DNS esta caido.
- No se pueden asignar nuevos dominios a nuevos nodos.
- La renovacion del certificado SSL no se ejecuta mientras OpenWrt este caido.

### Que sigue funcionando

- **El nodo sigue funcionando por IP**. Las aplicaciones pueden usar la IPv6 ULA directamente (ej: `https://[fd12:3456:7890::10]`).
- **Las aplicaciones pueden usar la IP directamente**. No dependen del DNS para funcionar.
- Los servicios instalados en el nodo siguen accesibles por IP:puerto.

### Al restaurar OpenWrt

- `dnsmasq` vuelve a resolver los nombres.
- Los dominios asignados previamente siguen configurados (se guardan en `/etc/dnsmasq.d/aldea-domains.conf`).
- Todo vuelve a la normalidad sin intervencion manual.

### Recomendacion

Tener un OpenWrt de respaldo configurado, o al menos una copia de seguridad de:
- `/etc/aldea/domain-token`
- `/etc/dnsmasq.d/aldea-domains.conf`
- Los certificados en `/etc/ssl/certs/aldea.crt` y `/etc/ssl/private/aldea.key`

---

## 9. Como agregar un nuevo servicio con subdominio

Cualquier servicio instalado en la aldea puede obtener su propio subdominio.

### Pasos

1. **Instalar el servicio desde la pagina "Servicios Federados"** del nodo de la aplicacion. Ejemplos de servicios: PeerTube, Nextcloud, Tienda, VoIP, etc.
2. **El nodo registra el subdominio en OpenWrt automaticamente**. El nodo envia la solicitud a OpenWrt con el nombre del servicio y su IPv6 ULA.
3. **OpenWrt crea la entrada DNS** y el servicio queda accesible por nombre.

### Ejemplo

```
Servicio: PeerTube
Nombre deseado: video
IPv6 ULA del servicio: fd12:3456:7890::20

Resultado:
  video.aldea1.com -> fd12:3456:7890::20
  SSL: cubierto por *.aldea1.com
  Acceso: https://video.aldea1.com
```

### Si OpenWrt no esta disponible

- El servicio **funciona por IP:puerto** (ej: `https://[fd12:3456:7890::20]:9000`).
- El subdominio se registra automaticamente cuando OpenWrt vuelva a estar disponible.
- El servicio no se bloquea: sigue operativo por IP mientras tanto.

---

## Referencias

- `DOMINIOS-SSL.md` - Detalles sobre la obtencion y renovacion del certificado wildcard con acme.sh.
- `ARQUITECTURA.md` - Vision general de la arquitectura de la red.
- `FEDERACION.md` - Detalles sobre la federacion entre aldeas.
- `INSTALACION.md` - Guia de instalacion de nodos.
- `network/openwrt/domain-assign.sh` - Script de asignacion de dominios en OpenWrt.
