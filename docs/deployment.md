# Despliegue

## Requisitos
- Go 1.21+
- Node.js 18+ (para frontend)
- PostgreSQL 14+ o YugabyteDB
- Docker y Docker Compose (opcional)

## Instalacion Rapida (Setup Wizard)

El nodo incluye un **asistente de configuracion inicial** que se muestra automaticamente
al primer arranque. No necesitas generar claves manualmente ni configurar usuarios por SQL.

### Flujo de primera instalacion

1. **Arrancar el nodo** — El servidor inicia, ejecuta migraciones y genera claves NFC automaticamente
2. **Abrir el navegador** — Ir a `http://localhost:8080` (o el puerto configurado)
3. **El frontend detecta que el nodo no esta inicializado** y redirige a `/setup`
4. **Completar el wizard de 4 pasos**:
   - Paso 1: Nombre y dominio del nodo
   - Paso 2: Usuario y nombre del administrador
   - Paso 3: Contrasena del administrador (min 8 caracteres)
   - Paso 4: Revision y confirmacion
5. **Al confirmar**, el backend automaticamente:
   - Genera el par de claves Ed25519 del administrador
   - Cifra la clave privada con AES-256-GCM (usando la contrasena)
   - Crea el usuario con nivel maximo y estado activo
   - Crea el departamento "Administracion" con rol "Administrador"
   - Asigna todos los permisos al rol administrador
   - Genera las claves del servidor NFC (para terminales ESP32)
   - Retorna un JWT token para iniciar sesion inmediatamente

### Endpoints del setup

| Metodo | Endpoint | Auth | Descripcion |
|--------|----------|------|-------------|
| GET | `/api/setup/status` | No | Verifica si el nodo esta inicializado |
| POST | `/api/setup/init` | No | Inicializa el nodo con el usuario admin |

### Login por contrasena

Despues del setup inicial, el administrador puede iniciar sesion con usuario y contrasena
desde la pagina de login (tab "Contrasena"). Tambien sigue disponible el login por Passkey.

| Metodo | Endpoint | Auth | Descripcion |
|--------|----------|------|-------------|
| POST | `/api/auth/login/password` | No | Login con usuario + contrasena (bcrypt) |

## Configuracion

### `config.yaml`
```yaml
node:
  name: "Nodo Trueque"
  domain: "nodo1.trueque.local"
api:
  port: 8080
  cors_origins:
    - "http://localhost:5173"
    - "https://nodo1.trueque.local"
database:
  host: localhost
  port: 5432
  name: trueque
  user: trueque
  password: trueque
```

### Variables de Entorno
| Variable | Default | Descripcion |
|----------|---------|-------------|
| `CONFIG_PATH` | `config.yaml` | Ruta del archivo de config |
| `JWT_SECRET` | `change-me-in-production` | Secret para JWT (configurar en produccion) |
| `MIGRATIONS_DIR` | `internal/db/migrations` | Directorio de migraciones |
| `DB_PASSWORD` | (vacio) | Password de la BD (si no esta en config.yaml) |

## Despliegue con Docker

### docker-compose.yml
```yaml
services:
  node:
    build: .
    ports:
      - "8080:8080"
    environment:
      CONFIG_PATH: /app/config.yaml
      JWT_SECRET: ${JWT_SECRET}
      MIGRATIONS_DIR: /app/internal/db/migrations
    volumes:
      - ./config.yaml:/app/config.yaml
    depends_on:
      - db

  db:
    image: yugabytedb/yugabyte:latest
    ports:
      - "5433:5433"  # YSQL
    volumes:
      - yugabyte-data:/var/yugabyte

  web:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - node

volumes:
  yugabyte-data:
```

## Instalacion de Nuevo Nodo

### 1. Arrancar el nodo
```bash
go run cmd/node/main.go
# Las migraciones se ejecutan automaticamente
# Las claves NFC se generan automaticamente
```

### 2. Abrir el navegador y completar el Setup Wizard
- Ir a `http://localhost:8080`
- El frontend redirige automaticamente a `/setup`
- Completar los 4 pasos del wizard
- Al finalizar, se inicia sesion automaticamente

### 3. (Opcional) Generar Certificados mTLS para Federacion
```bash
openssl req -x509 -newkey rsa:4096 -keyout node-key.pem -out node-cert.pem -days 365 -nodes -subj "/CN=nodo2.trueque.local"
```

### 4. Federar con Otro Nodo
- Intercambiar certificados
- Configurar limites bilaterales via asamblea
- Confirmar limites bilateralmente

## SSL / TLS en Intranet (sin internet)

El problema: en una red intranet pura sin acceso a internet, los navegadores
rechazan certificados auto-firmados.

### Como funciona la verificacion de certificados en el navegador

Es importante entender que **los navegadores no consultan a ninguna CA en tiempo
real**. No hacen ninguna peticion a internet para verificar el certificado.
El proceso es 100% local:

1. El navegador tiene una lista pre-instalada de CAs de confianza (trust store del SO)
2. Cuando recibe un certificado, verifica criptograficamente que fue firmado
   por una de esas CAs pre-instaladas
3. **No hay ninguna consulta de red** — todo es verificacion matematica local

Esto significa que **un certificado de Let's Encrypt funciona en intranet sin
internet**, porque la verificacion es local.

### Opcion 1: Let's Encrypt en intranet (recomendado — sin instalar nada en clientes)

Solo el **servidor** necesita internet (temporal, una vez cada 90 dias) para
obtener y renovar el certificado. Los **clientes de la intranet nunca necesitan
internet** — el navegador verifica el certificado localmente.

```
[Servidor] --internet temporal--> [Let's Encrypt]   obtener/renovar certificado
[Servidor] --intranet local-----> [Clientes]        HTTPS funciona sin internet en clientes
```

Se obtiene un certificado de Let's Encrypt (CA publica gratuita) mientras el
servidor tiene internet. El certificado se instala en el servidor. Los
navegadores de los clientes lo reconocen automaticamente porque Let's Encrypt
(ISRG Root X1) ya esta en el trust store de todos los sistemas operativos.

```
[Servidor con internet, una vez]  Obtener certificado de Let's Encrypt
[Servidor sin internet despues]   Sirve HTTPS a clientes de la intranet
[Cliente sin internet nunca]      Browser accede a https://nodo-a.org
                                  -> DNS local resuelve nodo-a.org -> 192.168.1.10
                                  -> Recibe certificado firmado por Let's Encrypt
                                  -> Verifica firma localmente contra ISRG Root X1
                                  -> CONFIAR — sin internet, sin instalar nada en clientes
```

#### Paso 1: Registrar dominio y configurar DNS

- Comprar un dominio real (ej. `nodo-a.org`, ~$10/ano)
- Configurar DNS en Cloudflare (gratis) u otro proveedor
- Crear registro A: `nodo-a.org -> 192.168.1.10` (IP de la intranet)

#### Paso 2: Obtener certificado (con internet temporal)

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-dns-cloudflare

# Configurar credenciales de DNS
cat > ~/.secrets/cloudflare.ini << EOF
dns_cloudflare_api_token = TU_TOKEN_AQUI
EOF
chmod 600 ~/.secrets/cloudflare.ini

# Obtener certificado via DNS-01 (no abre puertos, no necesita servidor online)
certbot certonly --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d nodo-a.org

# Certificados en:
# /etc/letsencrypt/live/nodo-a.org/fullchain.pem
# /etc/letsencrypt/live/nodo-a.org/privkey.pem
```

#### Paso 3: Configurar DNS local en la intranet

Para que los dispositivos de la intranet resuelvan el dominio sin internet:

**Opcion A — Servidor DNS local (dnsmasq):**
```bash
# Instalar dnsmasq en el servidor del nodo
sudo apt install dnsmasq

# Configurar /etc/dnsmasq.conf
echo "address=/nodo-a.org/192.168.1.10" | sudo tee -a /etc/dnsmasq.conf
echo "listen-address=192.168.1.10" | sudo tee -a /etc/dnsmasq.conf

sudo systemctl restart dnsmasq

# Configurar los dispositivos de la intranet para usar 192.168.1.10 como DNS
```

**Opcion B — Archivo hosts (por dispositivo):**
```
# Windows: C:\Windows\System32\drivers\etc\hosts
# Linux:   /etc/hosts
192.168.1.10  nodo-a.org
```

#### Paso 4: Instalar certificados en Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name nodo-a.org;

    ssl_certificate     /etc/letsencrypt/live/nodo-a.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nodo-a.org/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Paso 5: Renovacion (cada 90 dias, solo el servidor necesita internet)

Los certificados de Let's Encrypt expiran en 90 dias. Solo el servidor necesita
conexion a internet para renovar — los clientes no se enteran.

```bash
# Cron en el servidor que intenta renovar diariamente
# (falla sin internet, no es problema — lo lograra cuando haya conexion)
sudo crontab -e
# Agregar:
0 3 * * * certbot renew --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/cloudflare.ini --quiet
```

El servidor puede tener internet esporadico (ej. algunas horas al dia, o una
conexion telefonica temporal). La renovacion ocurrira automaticamente cuando
haya conexion. Los certificados son validos por 90 dias, asi que basta con que
el servidor tenga internet 1 dia cada 90.

**Los clientes de la intranet nunca necesitan internet para nada.**

#### Ventajas
- **Clientes sin internet** — los navegadores confian automaticamente, sin internet
- **Sin instalar nada en los clientes** — zero configuracion en dispositivos
- **Solo el servidor necesita internet** — y solo temporalmente cada 90 dias
- **Gratis** — Let's Encrypt no cobra
- **Certificados validos** — mismo nivel de confianza que cualquier sitio web

#### Desventajas
- Necesitas un dominio real (~$10/ano)
- El servidor necesita internet temporal para obtener y renovar (cada 90 dias)
- Necesitas configurar DNS local en la intranet (dnsmasq o archivo hosts)

### Opcion 2: CA Privada con instalacion automatizada

Si no se puede tener internet ni siquiera esporadicamente, se crea una CA
privada y se distribuye con un script automatizado.

#### Paso 1: Crear CA Root (una sola vez para toda la federacion)

```bash
openssl genrsa -out federation-ca.key 4096
openssl req -x509 -new -key federation-ca.key -out federation-ca.crt \
  -days 3650 -subj "/CN=Federacion Trueque CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"
```

#### Paso 2: Firmar certificado de cada nodo

```bash
openssl genrsa -out nodo-a.key 2048
openssl req -new -key nodo-a.key -out nodo-a.csr \
  -subj "/CN=nodo-a.local" \
  -addext "subjectAltName=DNS:nodo-a.local,DNS:nodo-a,IP:192.168.1.10"
openssl x509 -req -in nodo-a.csr -CA federation-ca.crt -CAkey federation-ca.key \
  -CAcreateserial -out nodo-a.crt -days 365 \
  -extfile <(printf "subjectAltName=DNS:nodo-a.local,DNS:nodo-a,IP:192.168.1.10")
```

#### Paso 3: Instalar CA root en los clientes (una vez por dispositivo)

**Windows — script .bat (doble clic):**
```bat
@echo off
echo Instalando CA root de la Federacion Trueque...
certutil -addstore -f "ROOT" "%~dp0federation-ca.crt"
certutil -addstore -f "CA" "%~dp0federation-ca.crt"
echo CA instalada. Chrome, Edge y Firefox ahora confian en los certificados.
pause
```

Se instala en Windows (no por navegador) y **Chrome, Edge y Firefox lo reconocen**.
Se hace una sola vez por dispositivo y funciona por 10 anos.

**Windows — via GPO (toda la organizacion a la vez):**
1. `gpmc.msc` > GPO > Configuracion del equipo > Plantillas administrativas > Red > Estaciones de confianza
2. Importar `federation-ca.crt` — todos los PCs del dominio la instalan automaticamente

**Linux:**
```bash
sudo cp federation-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain federation-ca.crt
```

#### Paso 4: Configurar Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name nodo-a.local;
    ssl_certificate     /etc/ssl/nodo-a.crt;
    ssl_certificate_key /etc/ssl/nodo-a.key;
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
    }
}
```

### Opcion 3: HTTP plano en la LAN (sin SSL)

Si la red intranet es completamente local y aislada, el trafico no sale de
la LAN. HTTPS no es estrictamente necesario.

```
[Cliente] --HTTP:8080--> [Nodo Go en la misma LAN]
```

Acceder via `http://nodo-a.local:8080` o `http://192.168.1.10:8080`.

Aceptable si: red local aislada, switch administrado, sin WiFi abierto.
No aceptable si: WiFi compartido o la red tiene salida a internet.

### Comparacion de opciones para intranet

| Opcion | Internet requerido? | Instala en clientes? | Costo | Renovacion |
|--------|--------------------|---------------------|-------|------------|
| Let's Encrypt intranet | Temporal cada 90 dias | No | Dominio ~$10/ano | Automatica |
| CA privada + script | No | Si (una vez, .bat) | Gratis | Manual (10 anos) |
| HTTP plano | No | No | Gratis | N/A |

### Recomendacion

- **Si la intranet tiene internet esporadico**: **Let's Encrypt** — sin instalar nada
  en clientes, navegadores confian automaticamente, renovacion automatica
- **Si la intranet no tiene internet nunca**: **CA privada + script .bat** — se
  instala una vez por dispositivo con doble clic, funciona por 10 anos
- **Si la red es local y aislada**: **HTTP plano** — sin complicaciones

### Notas sobre mTLS entre nodos

Para la federacion entre nodos (comunicacion servidor-servidor), se usa mTLS
mutuo. Esto es independiente del TLS del navegador:

- Los certificados mTLS son para autenticacion entre nodos
- No necesitan ser validados por navegadores
- Pueden ser auto-firmados o firmados por la misma CA privada
- Cada nodo tiene su propio par de claves

```
[Nodo A] --mTLS--> [Nodo B]
  presenta: nodo-a.crt    verifica: federation-ca.crt
  verifica: nodo-b.crt    presenta: nodo-b.crt
```

## Build Manual

### Backend
```bash
go build -o bin/node ./cmd/node
./bin/node
```

### Frontend
```bash
cd web
npm install
npx vite build
# servir dist/ con nginx o similar
```

## Verificacion

### Health Check
- `GET /api/setup/status` — Verifica estado del nodo
- Verificar migraciones aplicadas: tablas en BD

### Logs
- Chi middleware logger: requests HTTP
- `log.Fatalf` para errores fatales
- `log.Println` para eventos de inicio/shutdown
- Warning si `JWT_SECRET` no esta configurado
