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

- **Go** 1.21+
- **Node.js** 18+ y npm
- **PostgreSQL** o **YugabyteDB** (compatible con protocolo PG)
- **Git**

## Instalacion desde cero (desde otro computador)

### 1. Clonar el repositorio

```bash
git clone https://github.com/discapacidad5/red-de-intercambio-federada.git
cd red-de-intercambio-federada
```

### 2. Levantar la base de datos (con Docker)

```bash
docker compose up -d yugabytedb
```

Esto levanta YugabyteDB en el puerto `5433`. Esperar ~30 segundos a que inicie.

### 3. Configurar

Editar `config.yaml` con los datos de tu nodo:

```yaml
node:
  domain: "nodo-a.org"          # dominio o IP de tu nodo
  name: "Banco Comunitario A"   # nombre para mostrar

database:
  host: "localhost"
  port: 5433
  name: "fmc_node"
  user: "fmc"
  password: "fmcpassword"       # password de la BD

api:
  port: 8080
  cors_origins: ["http://localhost:3000"]
```

### 4. Ejecutar migraciones e iniciar el servidor

**Opcion A — Con Docker (todo junto):**

```bash
docker compose up -d
```

Esto levanta la BD + el nodo + el frontend.

**Opcion B — Manual (recomendado para desarrollo):**

```bash
# Backend: migrar + iniciar
go run ./cmd/node

# Frontend (en otra terminal):
cd web
npm install
npm run dev
```

El backend corre en `http://localhost:8080` y el frontend en `http://localhost:3000`.

### 5. Setup inicial

Abrir `http://localhost:3000` en el navegador. La primera vez redirige a `/setup` para:

1. Crear el usuario administrador
2. Configurar Passkey (WebAuthn) o contrasena
3. Configurar el nodo (nombre, dominio)

Despues del setup, puedes iniciar sesion normalmente.

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
