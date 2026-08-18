# Red de Intercambio Federada

Sistema de moneda comunitaria federada para redes de trueque y bancos comunitarios.
Cada nodo opera de forma independiente y se federa con otros nodos via protocolo mTLS.

## Caracteristicas

- **Moneda digital local**: cada nodo emite y gestiona su propia moneda comunitaria (TQ)
- **TQ no es dinero**: registra energia, contribuciones y compromisos. No es bancario, no genera intereses
- **Modelo energetico**: precios basados en energia incorporada por kg de material (estandar ICE Database)
- **Federacion entre nodos**: transferencias cross-node con limites bilaterales y globales
- **Federacion de productos**: productos aprobados por un nodo se distribuyen a otros para aprobacion individual
- **Productos compuestos**: cualquier usuario crea productos combinando materias primas aprobadas, precio automatico
- **Calculo por rendimiento**: especificas cuanto compraste y cuantos productos salen, el sistema calcula el costo por unidad
- **Grupos de productos**: items del mismo precio se agrupan en un contenedor padre (ej: Frutas de Temporada contiene Mango, Naranja, etc.)
- **Categorias jerarquicas**: 3 niveles controlados (padre > categoria > subcategoria), los vendedores no crean categorias
- **Buscador de componentes**: modal con busqueda de texto y filtro por categoria
- **Tienda comunitaria**: tipo Mercado Libre por nodo, cada usuario tiene su tienda personal
- **Pagos QR**: generar y escanear codigos QR con monto fijo o libre (como pago movil)
- **Terminales NFC ESP32**: pagos con tarjetas NFC, claves efimeras por transaccion (forward secrecy)
- **NFC federado**: tarjetas de otros nodos funcionan via consulta directa al nodo origen (BIN-style)
- **Gobernanza**: asambleas, organizaciones, departamentos con permisos granulares
- **Paridad**: calculo de paridad entre monedas de diferentes nodos
- **Comercio externo**: puente con moneda fiat externa
- **Recuperacion de cuentas**: via claves de recuperacion
- **Sitio web publico**: cada nodo tiene su pagina web publica configurable

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

## Modelo de Precios Energeticos

TQ registra energia, no dinero. Los precios se calculan segun la energia
incorporada en los productos, siguiendo el estandar internacional **ICE Database
(University of Bath)**:

- **Materias primas por kg**: arcilla, madera, tela, lana, fibra, vidrio
- **Trabajo por hora**: alfareria, carpinteria, costura, cesteria
- **Productos terminados**: precio = (material x energia/kg) + horas de trabajo
- **Productos compuestos**: precio automatico sumando componentes del catalogo

Ver [docs/pricing.md](docs/pricing.md) para detalles completos.

## Productos Compuestos

Cualquier usuario puede crear productos compuestos en su tienda seleccionando
materias primas y productos base del catalogo aprobado. El precio se calcula
automaticamente, no se ingresa manualmente. No requiere aprobacion de asamblea
porque usa componentes ya aprobados.

### Calculo por rendimiento

El productor especifica:
- **Cantidad que compro** (ej: 1 kg de naranjas)
- **Cuantos productos salen** (ej: 50 envases de 200ml)

El sistema calcula automaticamente el costo por producto:
```
Cantidad por producto = 1 kg / 50 = 0.02 kg
Costo por producto = 2 TQ/kg x 0.02 kg = 0.04 TQ
```

### Categorias jerarquicas

Los productos compuestos se ubican en una jerarquia de 3 niveles:
1. Categoria padre (ej: Alimentacion)
2. Categoria (ej: Bebidas)
3. Subcategoria (opcional, ej: Jugos Naturales)

Las categorias son controladas centralmente. Los vendedores no crean categorias.

### Buscador de componentes

Modal con campo de texto para buscar por nombre o descripcion, mas filtro
por categoria (materia_prima, producto_base, trabajo, embalaje, envio).

Ver [docs/composite_products.md](docs/composite_products.md) para detalles.

## Grupos de Productos

Los productos del mismo precio se agrupan en un contenedor padre. Por ejemplo,
"Frutas de Temporada" contiene Mango, Naranja, Papaya, etc., todas a 2 TQ/kg.

- El padre (`is_group = true`) es un contenedor visible
- Cada item individual tiene su propio ID, nombre y descripcion
- Si un item cambia de precio, se mueve a otro grupo cambiando su `group_id`
- Los items individuales son buscables y auditables

Ver [docs/pricing.md](docs/pricing.md) para detalles del modelo energetico.

## Federacion entre nodos

Para que dos nodos se comuniquen, **ambos deben registrarse mutuamente**:

1. Cada nodo tiene su clave publica (en `secrets/node_keys.txt`)
2. En el nodo A: registrar la clave publica del nodo B
3. En el nodo B: registrar la clave publica del nodo A
4. Solo cuando ambos se han registrado, la federacion esta activa

Esto se hace desde la seccion "Federacion" en la web app del nodo.

### Federacion de productos

Cuando un nodo aprueba un producto base por asamblea, se distribuye a los demas
nodos federados. Cada nodo debe aprobarlo individualmente. Un producto no
aprobado en un nodo no se puede usar para producir, comprar ni como componente.

Ver [docs/federation.md](docs/federation.md) para detalles.

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
| `powershell -ExecutionPolicy Bypass -File update.ps1` | Actualizar despues de git pull |

## Estructura del proyecto

```
red-de-intercambio-federada/
├── cmd/node/              # Punto de entrada (main.go)
├── cmd/install/           # Instalador CLI
├── cmd/installer/         # Instalador web
├── internal/
│   ├── api/               # Handlers HTTP (REST API)
│   ├── accounts/          # Cuentas, usuarios, organizaciones
│   ├── crypto/            # Criptografia (Ed25519, ECDH, AES-GCM)
│   ├── db/migrations/     # Migraciones SQL (001-045)
│   ├── external/          # DEX, tienda comunitaria, productos compuestos
│   ├── federation/        # Protocolo de federacion (mTLS, gossip, productos)
│   ├── ledger/            # Libro contable, transacciones, limites
│   └── payments/          # Pagos QR, NFC, manual
├── web/                   # Frontend React + Vite + Tailwind
├── firmware/              # Firmware ESP32 para terminales NFC
├── docs/                  # Documentacion completa
├── docker/                # Dockerfile
├── config.yaml            # Configuracion del nodo
└── docker-compose.yml     # Orquestacion Docker
```

## API REST

Ver [docs/api.md](docs/api.md) para la lista completa de endpoints.

### Endpoints principales

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/auth/login/password` | Login con usuario + contrasena |
| POST | `/api/auth/register` | Registrar Passkey (WebAuthn) |
| GET | `/api/setup/status` | Estado del setup inicial |
| GET | `/api/products` | Lista productos (con paginacion) |
| POST | `/api/products` | Crea producto (requiere aprobacion) |
| POST | `/api/products/{id}/approve` | Aprueba producto |
| GET | `/api/products/categories` | Jerarquia de 3 niveles para selectores |
| GET | `/api/products/components` | Lista componentes (con ?category= y ?search=) |
| POST | `/api/store/composite` | Crea producto compuesto |
| POST | `/api/store/purchase` | Compra en tienda |
| GET | `/api/federation/products/pending` | Productos federados pendientes |
| POST | `/api/federation/products/{id}/approve` | Aprueba producto federado |
| POST | `/api/payments/qr/generate` | Generar QR de pago |
| POST | `/api/payments/nfc/lookup` | Buscar tarjeta NFC |
| GET | `/api/transactions` | Historial de transacciones |

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

- [docs/INDEX.md](docs/INDEX.md) — Indice completo de documentacion
- [docs/architecture.md](docs/architecture.md) — Arquitectura del sistema
- [docs/api.md](docs/api.md) — API REST completa
- [docs/pricing.md](docs/pricing.md) — Modelo de precios energeticos
- [docs/composite_products.md](docs/composite_products.md) — Productos compuestos
- [docs/currency_exchange.md](docs/currency_exchange.md) — Sistema de intercambio y moneda TQ
- [docs/feria_conuquera.md](docs/feria_conuquera.md) — Feria Conuquera Agroecologica
- [docs/federation.md](docs/federation.md) — Federacion entre nodos
- [docs/database.md](docs/database.md) — Esquema de base de datos
- [docs/security.md](docs/security.md) — Modelo de seguridad
- [docs/deployment.md](docs/deployment.md) — Guia de despliegue
- [docs/frontend.md](docs/frontend.md) — Frontend PWA
- [firmware/README.md](firmware/README.md) — Firmware ESP32 para terminales NFC

## Licencia

Este proyecto es software libre.
