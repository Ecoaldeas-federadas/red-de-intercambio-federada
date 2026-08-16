# Red de Intercambio Federada

Sistema de moneda comunitaria federada para redes de trueque y bancos comunitarios.
Cada nodo opera de forma independiente y se federa con otros nodos via protocolo mTLS.

## Caracteristicas

- **Moneda digital local**: cada nodo emite y gestiona su propia moneda comunitaria
- **Federacion entre nodos**: transferencias cross-node con limites bilaterales y globales
- **Pagos QR**: generar y escanear codigos QR con monto fijo o libre (como pago movil)
- **Terminales NFC ESP32**: pagos con tarjetas NFC, claves efimeras por transaccion (forward secrecy)
- **NFC federado**: tarjetas de otros nodos funcionan via consulta directa al nodo origen (BIN-style)
- **Gobernanza**: asambleas, organizaciones, departamentos con permisos granulares
- **Paridad**: calculo de paridad entre monedas de diferentes nodos
- **Comercio externo**: puente con moneda fiat externa
- **Recuperacion de cuentas**: via claves de recuperacion

## Requisitos

- **Docker** y **Docker Compose** (recomendado — instala todo automaticamente)
- **Go** 1.21+ (solo si compilas manualmente, no necesario con Docker)
- **Git**

## Instalacion rapida (recomendado)

### Opcion A — Script de instalacion (1 comando)

**Windows (PowerShell):**
```powershell
git clone https://github.com/discapacidad5/red-de-intercambio-federada.git
cd red-de-intercambio-federada
.\install.ps1
```

**Linux/Mac:**
```bash
git clone https://github.com/discapacidad5/red-de-intercambio-federada.git
cd red-de-intercambio-federada
chmod +x install.sh
./install.sh
```

El script te pregunta solo 2 cosas:
1. **Nombre del nodo** (ej: "Banco Comunitario A")
2. **Dominio del nodo** (ej: "nodo-a.org")

Todo lo demas se genera automaticamente:
- Password seguro de la base de datos (aleatorio)
- JWT secret (aleatorio)
- Claves Ed25519 del nodo (para federacion)
- config.yaml con defaults seguros
- Arranque de Docker

Al terminar, abre el navegador automaticamente en la pagina de setup
para crear el usuario administrador.

### Opcion B — Binario instalador (Go)

```bash
go build -o install ./cmd/install
./install
# o no-interactivo:
./install --name "Banco Comunitario A" --domain nodo-a.org
```

### Opcion C — Instalador web (Docker)

```bash
docker build -f docker/Dockerfile.installer -t fmc-installer .
docker run -p 3001:3001 -v /var/run/docker.sock:/var/run/docker.sock -v $(pwd):/app fmc-installer
```

Abrir `http://localhost:3001` en el navegador y seguir los pasos.

### Opcion D — Manual (desarrollo)

```bash
# 1. Levantar la base de datos
docker compose up -d yugabytedb

# 2. El servidor arranca sin config.yaml (usa defaults seguros)
go run ./cmd/node

# 3. Frontend (en otra terminal)
cd web
npm install
npm run dev
```

El backend corre en `http://localhost:8080` y el frontend en `http://localhost:3000`.
La primera vez redirige a `/setup` para crear el usuario administrador.

## Que se genera automaticamente

El instalador genera estos archivos sin que tengas que editar nada:

| Archivo | Contenido | Seguro por defecto |
|---------|-----------|-------------------|
| `.env` | DB_PASSWORD, JWT_SECRET | Passwords aleatorios de 24-32 bytes |
| `config.yaml` | Configuracion completa del nodo | Defaults seguros, solo falta nombre y dominio |
| `secrets/node_keys.txt` | Claves Ed25519 del nodo | Clave publica + privada generadas con crypto/rand |

**No necesitas editar ningun archivo manualmente.** El unico campo obligatorio
es el nombre y dominio del nodo, que se ingresan en el instalador.

## Federacion entre nodos

Para que dos nodos se comuniquen, **ambos deben registrarse mutuamente**:

1. Cada nodo tiene su clave publica (en `secrets/node_keys.txt`)
2. En el nodo A: registrar la clave publica del nodo B
3. En el nodo B: registrar la clave publica del nodo A
4. Solo cuando ambos se han registrado, la federacion esta activa

Esto se hace desde la seccion "Federacion" en la web app del nodo.

## Comandos utiles

| Comando | Descripcion |
|---------|-------------|
| `go run ./cmd/node` | Iniciar servidor backend (migraciones + API) |
| `go build -o bin/fmc-node ./cmd/node` | Compilar binario |
| `go test ./... -v` | Ejecutar tests |
| `go vet ./...` | Linter |
| `cd web && npm run dev` | Frontend en modo desarrollo |
| `cd web && npm run build` | Compilar frontend para produccion |
| `docker compose up -d` | Levantar todo con Docker |
| `docker compose down` | Detener todo |

## Estructura del proyecto

```
red-de-intercambio-federada/
├── cmd/node/              # Punto de entrada (main.go)
├── internal/
│   ├── api/               # Handlers HTTP (REST API)
│   ├── accounts/          # Cuentas, usuarios, organizaciones
│   ├── crypto/            # Criptografia (Ed25519, ECDH, AES-GCM)
│   ├── db/migrations/     # Migraciones SQL
│   ├── federation/        # Protocolo de federacion (mTLS, gossip)
│   ├── ledger/            # Libro contable, transacciones, limites
│   └── payments/          # Pagos QR, NFC, manual
├── web/                   # Frontend React + Vite + Tailwind
├── firmware/              # Firmware ESP32 para terminales NFC
├── docs/                  # Documentacion (security.md, deployment.md)
├── docker/                # Dockerfile
├── config.yaml            # Configuracion del nodo
└── docker-compose.yml     # Orquestacion Docker
```

## API REST

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/auth/login/password` | Login con usuario + contrasena |
| POST | `/api/auth/register` | Registrar Passkey (WebAuthn) |
| GET | `/api/setup/status` | Estado del setup inicial |
| POST | `/api/payments/qr/generate` | Generar QR de pago (con o sin monto) |
| POST | `/api/payments/qr/parse` | Escanear/validar QR |
| POST | `/api/payments/qr/pos` | Generar QR con monto fijo (POS) |
| POST | `/api/payments/manual` | Pago manual |
| POST | `/api/payments/nfc/issue` | Emitir tarjeta NFC |
| POST | `/api/payments/nfc/lookup` | Buscar tarjeta NFC |
| POST | `/api/nfc/terminal/register` | Registrar terminal NFC |
| POST | `/api/nfc/terminal/provision` | Provisionar terminal con chip ID (genera config.h) |
| GET | `/api/nfc/terminal/{id}/config.h` | Descargar config.h generado por el servidor |
| POST | `/api/nfc/terminal/payment` | Procesar pago NFC |
| GET | `/api/transactions` | Historial de transacciones |
| POST | `/api/transfer` | Transferencia entre cuentas |

## Federation (entre nodos)

Los nodos se comunican via mTLS en el puerto `8443`:

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/federation/inbox` | Recibir mensaje de otro nodo |
| GET | `/federation/limits` | Consultar limites |
| GET | `/federation/balance` | Consultar balance bilateral |
| POST | `/federation/card/lookup` | Buscar tarjeta NFC de otro nodo |
| GET | `/federation/health` | Health check |

## Documentacion

- `docs/security.md` — Modelo de seguridad, criptografia, NFC, QR
- `docs/deployment.md` — Guia de despliegue, Docker, SSL/TLS
- `firmware/README.md` — Firmware ESP32 para terminales NFC

## Licencia

Este proyecto es software libre.
