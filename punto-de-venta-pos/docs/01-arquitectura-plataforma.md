# 01 — Arquitectura de la Plataforma

> **Sistema:** Red de Intercambio Federada / Sistema TQ
> **Propósito:** Documentación técnica para consumo por IA y desarrolladores.
> **Idioma:** Español técnico.

---

## 1. Visión General

La **Red de Intercambio Federada** es un sistema de **crédito mutuo comunitario** (estilo LETS / Mutual Credit) federado entre múltiples nodos independientes. Cada nodo es una instancia autónoma del backend en Go que gestiona una comunidad local de usuarios, tarjetas NFC, terminales POS y transacciones en una moneda comunitaria llamada **TQ**.

La plataforma consta de los siguientes componentes principales:

| Componente | Tecnología | Directorio |
|---|---|---|
| Backend (nodo federado) | Go (chi router, pgx/v5) | `internal/` |
| Web app (panel de usuario) | React + TypeScript (Vite) | `web/` |
| POS web app | React + TypeScript (Vite) | `pos/` |
| POS Android | Kotlin + Jetpack Compose | `punto-de-venta-pos/` |
| Firmware ESP32 | C++ / Arduino | `firmware/` |
| Base de datos | PostgreSQL / YugabyteDB | — |

---

## 2. Nodo Federado (Backend Go — `internal/`)

El backend de cada nodo está implementado en Go y organizado en los siguientes subdirectorios bajo `internal/`:

### 2.1 Subdirectorios del backend

| Subdirectorio | Responsabilidad |
|---|---|
| `accounts/` | Gestión de cuentas de usuario (individuos, organizaciones, instituciones públicas, fondo comunitario). Admisión, niveles de miembro, tipos de cuenta. |
| `api/` | Handlers HTTP y registro de rutas (chi router). Puntos de entrada de la API REST: autenticación, terminales NFC, pagos, POS, multisig, preferencias, federación, gobernanza, etc. |
| `assembly/` | Asambleas comunitarias: convocatorias, asistencia, quórum, votaciones, actas (generación de PDF). |
| `audit/` | Registro de auditoría y trazabilidad de acciones administrativas. |
| `config/` | Carga de configuración YAML (`config.yaml`, `config.demo.yaml`). Estructura `Config` con secciones: node, database, federation, limits, taxes, fund, api, network, cluster. |
| `crypto/` | Criptografía del nodo: claves Ed25519 del nodo, firmas, verificación, ECDH para terminales NFC. |
| `db/` | Conexión a PostgreSQL/YugabyteDB (pgxpool), migraciones SQL (`migrations/`), seed data, presets. |
| `external/` | Comercio exterior, puentes a monedas externas, factor de conversión (FC). |
| `federation/` | Federación entre nodos: gossip discovery, sincronización de saldos, límites bilaterales, gobernanza federada, claves de federación. |
| `ledger/` | Libro mayor de doble entrada (ledger entries). Cada transacción genera asientos contables. |
| `payments/` | Procesamiento de pagos: NFC terminal (`nfc_terminal.go`), multisig (`multisig.go`), pairing de terminales, sesiones web, compilación de firmware. |
| `pricing/` | Reglas de precios, catálogo de productos, cálculo de precios compuestos. |
| `taxes/` | Impuestos comunitarios: tasas por tipo de organización, cálculo de impuestos por transacción, junta de impuestos. |

### 2.2 Estructura de un nodo

Cada nodo se ejecuta como un proceso independiente con su propia base de datos, su propio dominio (`node_domain`), y sus propias claves criptográficas Ed25519. La configuración se carga desde `config.yaml`:

```yaml
node:
  domain: ""           # Dominio del nodo (ej: "nodo-a.mid-comunidad.org")
  name: ""             # Nombre humano del nodo
  private_key_path: "/secrets/node_private_key.ed25519"

database:
  host: "localhost"
  port: 5433           # Puerto YugabyteDB
  name: "fmc_node"
  user: "fmc"
  ssl_mode: "disable"

federation:
  listen_port: 8443
  mtls_required: true
  known_nodes: []
  gossip_interval: "60s"
  balance_sync_enabled: true

limits:
  default_individual_negative: -50000   # -500.00 TQ (en centavos)
  default_individual_positive: 50000     # +500.00 TQ
  default_organization_negative: -5000000
  default_organization_positive: 5000000

api:
  port: 8080
  cors_origins: ["http://localhost:3000"]
```

---

## 3. Aplicaciones Frontend

### 3.1 Web App (`web/`)

- **Nombre:** `fmc-node-frontend`
- **Stack:** React 18 + TypeScript + Vite
- **Dependencias clave:** `react-router-dom`, `lucide-react`, `qrcode.react`, `html5-qrcode`, `jsqr`
- **Función:** Panel principal del usuario. Gestión de cuenta, transferencias, catálogo de productos, asambleas, gobernanza, administración del nodo, gestión de tarjetas NFC y terminales.

### 3.2 POS Web App (`pos/`)

- **Nombre:** `pos-web-federada`
- **Stack:** React 18 + TypeScript + Vite (puerto 3001)
- **Dependencias clave:** `react`, `qrcode`
- **Función:** Punto de venta web. Crea cargos QR, muestra el código QR al cliente, hace polling del estado del cargo hasta que se paga o expira. Es la versión web del POS Android.

### 3.3 POS Android (`punto-de-venta-pos/`)

- **Stack:** Kotlin + Jetpack Compose + Coroutines
- **Package:** `com.example`
- **Función:** Aplicación Android para punto de venta físico. Soporta pagos NFC (simple y comunitario/multi-vendor), pagos QR, gestión de turnos, multisig, emparejamiento por código corto.
- **Detalle completo:** Ver documento `02-pos-android-arquitectura.md`.

---

## 4. Firmware ESP32 (`firmware/`)

Terminales físicos basados en ESP32 que se conectan al backend via HTTP + Ed25519. El firmware se compila y flashea desde el panel web del nodo.

| Subdirectorio | Tipo de terminal | Descripción |
|---|---|---|
| `terminal-community/` | Community | Terminal comunitario con lector NFC + keypad. Pago entre dos tarjetas (vendedor + comprador). Archivo principal: `terminal-community.ino`, config en `config.h`. |
| `terminal-touch/` | Touch | Terminal con pantalla táctil. Interfaz gráfica para selección de montos y confirmación. |
| `terminal-web/` | Web | Terminal web POS embebido. Sesión temporal aprobada por el dueño del terminal. |
| `terminal-keypad/` | Keypad | Terminal básico con keypad numérico. |
| `terminal-ble-reader/` | BLE Reader | Lector NFC Bluetooth que se conecta a otro dispositivo. |
| `chip-id-reader/` | Chip ID Reader | Sketch auxiliar para leer el chip ID (MAC/efuse) del ESP32, necesario para provisionar terminales. |
| `shared/` | Shared | Código compartido entre variantes de firmware. |

### Flujo de provisión de firmware

1. El admin registra un terminal en el backend → se genera un `registration_token`.
2. El admin asocia el terminal a un `chip_id` (MAC del ESP32).
3. El backend compila el firmware con el `config.h` embebido (incluye URL del servidor, terminal_id, registration_token).
4. El admin descarga el `.bin` y lo flashea al ESP32.
5. El ESP32 arranca, completa el registro enviando su clave pública Ed25519, y recibe la `server_public_key`.

---

## 5. Federación Entre Nodos

La federación permite que múltiples nodos independientes operen como una red distribuida. Cada nodo es soberano pero puede comerciar con otros nodos federados.

### 5.1 Comunicación entre nodos

- **Protocolo:** HTTPS con mTLS (mutual TLS) opcional (`mtls_required: true` en producción).
- **Puerto de federación:** Configurable (`listen_port: 8443` por defecto).
- **Descubrimiento:** Gossip protocol — los nodos se descubren mutuamente y propagan información de la red (`gossip_interval: 60s`).
- **Sincronización de saldos:** `balance_sync_enabled: true` — los nodos sincronizan saldos bilaterales periódicamente.
- **Límites bilaterales:** Cada par de nodos federados tiene límites de crédito mutuo (`node_multilateral_negative` / `node_multilateral_positive`).

### 5.2 Gobernanza federada

- Propuestas públicas entre nodos (`internal/api/public_proposals.go`).
- Votación federada y reglas de gobernanza (`internal/api/federation_gov.go`).
- Descubrimiento de nodos por gossip + solicitudes de federación (`internal/api/node_discovery.go`).

### 5.3 Comercio inter-nodos

Los usuarios pueden comerciar con usuarios de otros nodos federados. Las transacciones inter-nodos se registran con `sender_node` y `receiver_node` en la tabla `transactions`.

---

## 6. Base de Datos (PostgreSQL / YugabyteDB)

- **Motor:** PostgreSQL-compatible. YugabyteDB para alta disponibilidad y escalabilidad horizontal.
- **Puerto por defecto:** 5433 (YugabyteDB) / 5432 (PostgreSQL estándar).
- **Driver:** `pgx/v5` con connection pooling (`pgxpool`).
- **Migraciones:** Archivos SQL numerados en `internal/db/migrations/` (001–132+). Se ejecutan secuencialmente al iniciar el nodo.
- **Cluster YugabyteDB:** Configurable con `min_nodes`, `tablet_limit_per_node`, `alert_threshold`. Mínimo 2 nodos para HA en producción; 1 nodo para desarrollo.

### Tablas principales

- `users` — Cuentas (individuos, organizaciones, instituciones, fondo).
- `transactions` — Log de transacciones con hashes de cadena.
- `ledger_entries` — Asientos de doble entrada.
- `nfc_terminals` — Terminales NFC registrados.
- `nfc_cards` — Tarjetas NFC emitidas a usuarios.
- `nfc_transactions` — Log de transacciones NFC.
- `pending_multisig_payments` — Pagos multi-firma pendientes.
- `pos_charges` — Cargos QR del POS.
- `pos_shifts` — Turnos de POS.
- `multisig_config` — Configuración de multisig por nodo.
- `node_config` — Configuración del nodo (JSONB settings).
- `user_preferences` — Preferencias de formato por usuario.

> **Detalle completo de esquemas:** Ver documento `05-modelo-datos.md`.

---

## 7. Modelo de Crédito Comunitario (Moneda TQ)

### 7.1 La moneda TQ

- **TQ** es la moneda comunitaria del sistema.
- **Unidad interna:** Centavos (enteros). `1.00 TQ = 100 centavos`.
- **Tipo de dato:** `BIGINT` / `int64` (Go) / `Long` (Kotlin). Todos los montos se almacenan como enteros en centavos para evitar errores de punto flotante.
- **Conversión a display:** Se divide por 100.0 para mostrar al usuario. Ej: `50000` centavos → `500.00 TQ`.

### 7.2 Filosofía de moneda cero (LETS / Crédito Mutuo)

Este **no es un sistema bancario convencional**. Es un sistema de crédito mutuo de suma cero:

- **Los saldos pueden ser negativos o positivos.** Un saldo negativo significa que el miembro ha recibido más de lo que ha aportado (deuda con la comunidad). Un saldo positivo significa que ha aportado más de lo que ha recibido.
- **No existe "saldo insuficiente" en el sentido bancario.** El pago se rechaza solo cuando el miembro alcanza su **tope de crédito** (`credit_limit`), que es un valor negativo.
- **`credit_limit`** (BIGINT, negativo): El límite inferior del saldo. Ej: `-50000` significa que el usuario puede deber hasta `-500.00 TQ`.
- **`debit_limit`** (BIGINT, positivo): El límite superior del saldo. Ej: `50000` significa que el usuario puede acumular hasta `+500.00 TQ`.
- **Suma cero en la comunidad:** La suma de todos los saldos de los usuarios de un nodo es cero (o cercano a cero). El dinero no se "crea" ni se "destruye"; se transfiere entre miembros.

### 7.3 Verificación de saldo en transacciones

```go
// El pago se rechaza solo al llegar al tope de crédito (credit_limit),
// no por "saldo insuficiente" convencional.
if balance - amount < creditLimit {
    return rejected: "has llegado al tope de tu credito comunitario.
                      Debes aportar a la comunidad para poder pagar nuevamente."
}
```

### 7.4 Cuentas multi-firma (mancomunadas)

Las cuentas de organización pueden requerir múltiples firmas para autorizar pagos:

- `required_signatures` (INT): Número de firmas requeridas. `1` = firma simple. `>1` = multi-firma.
- `authorized_signers` (UUID[]): Lista de usuarios autorizados a firmar.
- Cuando `required_signatures > 1`, los pagos quedan pendientes hasta que todos los firmantes autorizados confirmen.

---

## 8. Sistema de Base Path (`/main`, `/demo`)

El sistema soporta múltiples nodos servidos desde el mismo dominio usando **base paths**:

### 8.1 Nodo principal (`/main`)

- `basePath = "/main"`
- Las URLs del frontend son (ejemplo): `https://<dominio-del-nodo>/main/`
- Las URLs de la API son (ejemplo): `https://<dominio-del-nodo>/main/api/*`
- El backend hace **strip** del basePath antes de procesar: `/main/api/users` → `/api/users`
- Actúa como **proxy reverso** para el nodo demo y servicios instalados.

### 8.2 Nodo demo (`/demo`)

- `basePath = "/demo"`
- `config.demo.yaml`: `node.domain: "demo"`, `api.port: 9091`
- Las URLs del frontend son (ejemplo): `https://<dominio-del-nodo>/demo/`
- Las URLs de la API son (ejemplo): `https://<dominio-del-nodo>/demo/api/*`
- **Se reinicia cada 24 horas** con datos de demostración.
- El POS Android detecta el modo demo cuando la URL contiene `/demo` (`isDemoNode = serverUrl.contains("/demo")`).
- En modo demo, el POS simula transacciones localmente si el backend no responde.

### 8.3 Strip de basePath en el router

```go
// internal/api/routes.go
if basePath != "" {
    r.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if strings.HasPrefix(r.URL.Path, basePath+"/api/") {
                r.URL.Path = strings.TrimPrefix(r.URL.Path, basePath)
            }
            next.ServeHTTP(w, r)
        })
    })
}
```

### 8.4 Proxy reverso dinámico

El nodo principal (`/main`) actúa como proxy reverso:

- `/demo/*` → `demo-app:9091` (nodo demo, sin strip de prefix)
- `/{service_id}/*` → Puerto del servicio instalado (POS, PeerTube, etc.) desde `installed_services`
- `/api/*`, `/uploads/*`, `/images/*`, `/federation/*` → Se procesan localmente (no se proxyan)

---

## 9. Estructura de Rutas de la API (chi router)

### 9.1 Prefijo

Todas las rutas de la API usan el prefijo `/api/`. Cuando hay basePath, la URL completa es `{basePath}/api/*`.

### 9.2 Router principal

```go
// internal/api/routes.go
func NewRouterWithAuthAndBasePath(...) http.Handler {
    r := chi.NewRouter()
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.Timeout(60 * time.Second))
    r.Use(corsMiddleware(corsOrigins))

    // Strip basePath si existe
    // Proxy reverso si es nodo principal

    // Registro de handlers:
    sh.RegisterRoutes(r)           // Setup (no auth)
    ah.RegisterRoutes(r)           // Auth
    h.RegisterRoutesWithAuth(r, am) // Handler principal
    fh.RegisterRoutesWithAuth(r, am) // Federation
    oh.RegisterRoutesWithAuth(r, am) // Organization
    ph.RegisterRoutes(r, am)       // Payments
    nh.RegisterRoutes(r, am)       // NFC Terminal
    posH.RegisterRoutes(r, am)     // POS QR
    // ... + multisig, preferences, etc.
}
```

### 9.3 Autenticación

- **JWT (Bearer token):** Para usuarios web/app. Header `Authorization: Bearer {token}`.
- **Ed25519 mutual auth:** Para terminales NFC/POS. El terminal firma un mensaje con su clave privada Ed25519; el servidor verifica con la clave pública registrada.
- **Headers comunes:**
  - `X-Node-Domain`: Dominio del nodo (solo el host, sin path).
  - `X-Terminal-ID`: ID del terminal.
  - `X-Terminal-Public-Key`: Clave pública del terminal.
  - `X-User-ID`: ID del usuario autenticado (seteado por el middleware).

### 9.4 Middleware

- `RequireAuth`: Verifica JWT válido.
- `RequirePermission("permiso")`: Verifica que el usuario tiene un permiso específico.
- `BlockDemo`: Bloquea operaciones de escritura para usuarios del nodo demo.

> **Referencia completa de endpoints:** Ver documento `04-api-endpoints.md`.

---

## 10. Diagrama de Arquitectura

```
                          ┌─────────────────────────────────────┐
                          │         NODO FEDERADO (Go)          │
                          │                                     │
                          │  ┌──────────┐  ┌──────────┐        │
                          │  │  api/    │  │ accounts/│        │
                          │  │ (chi)    │  │          │        │
                          │  └────┬─────┘  └──────────┘        │
                          │       │                            │
                          │  ┌────▼──────────────────────┐     │
                          │  │     payments/              │     │
                          │  │  ├─ nfc_terminal.go       │     │
                          │  │  ├─ multisig.go           │     │
                          │  │  ├─ pairing.go            │     │
                          │  │  └─ web_session.go        │     │
                          │  └────┬──────────────────────┘     │
                          │       │                            │
                          │  ┌────▼─────┐  ┌──────────┐        │
                          │  │ ledger/  │  │ crypto/  │        │
                          │  └──────────┘  └──────────┘        │
                          │       │                            │
                          │  ┌────▼──────────────────────┐     │
                          │  │  PostgreSQL / YugabyteDB   │     │
                          │  │  (pgxpool)                 │     │
                          │  └────────────────────────────┘     │
                          └──────────┬──────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐
              │  Web App  │   │  POS Web    │  │ POS Android │
              │ (React)   │   │  (React)    │  │ (Kotlin)    │
              │ web/      │   │  pos/       │  │ punto-de-   │
              └───────────┘   └─────────────┘  │ venta-pos/  │
                                               └─────────────┘
              ┌─────────────────────────────────────┐
              │        Terminales ESP32              │
              │  ┌──────────┐ ┌────────┐ ┌────────┐ │
              │  │community │ │ touch  │ │  web   │ │
              │  └──────────┘ └────────┘ └────────┘ │
              └─────────────────────────────────────┘

     ◄──── Federación (mTLS + gossip) ────►
     NODO A                          NODO B
```

---

## 11. Comunicación POS Android ↔ Backend

```
POS Android (Kotlin)
    │
    │  Retrofit + OkHttp
    │  Headers: Authorization, X-Node-Domain, X-Terminal-ID, X-Terminal-Public-Key
    │
    ▼
{serverUrl}/api/*  (ej: https://<dominio-del-nodo>/main/api/)
    │
    │  chi router → strip basePath → handler
    │
    ▼
Backend Go (internal/api/)
```

### Construcción de URLs en el POS Android

```kotlin
// PosApiClient.kt
fun getApiBaseUrl(): String {
    val clean = serverUrl.trimEnd('/')
    return "$clean/api/"
    // ej: https://<dominio-del-nodo>/main → https://<dominio-del-nodo>/main/api/
}

fun getPayQrUrl(chargeToken: String): String {
    val clean = serverUrl.trimEnd('/')
    return "$clean/pay?t=$chargeToken"
    // ej: https://<dominio-del-nodo>/main/pay?t=abc123
}
```

### Detección de modo demo

```kotlin
val isDemoNode: Boolean
    get() = serverUrl.contains("/demo")
```

Cuando `isDemoNode` es true, el POS muestra un watermark de demostración y simula transacciones si el backend no responde.

---

## 12. Seguridad

### 12.1 Criptografía de terminales

- **Ed25519:** Cada terminal genera un par de claves Ed25519 al registrarse. La clave privada se almacena encriptada con Android Keystore (en POS Android) o en flash del ESP32.
- **ECDH (X25519):** Se deriva una clave compartida entre el terminal y el servidor convirtiendo las claves Ed25519 a Curve25519 (SHA-512 + clamping) y haciendo ECDH.
- **AES-256-GCM:** Los payloads de pago se encriptan con AES-256-GCM usando la clave compartida ECDH.
- **Firma Ed25519:** El ciphertext se firma con la clave privada del terminal; el servidor verifica con la clave pública registrada.

### 12.2 Autenticación de tarjetas NFC

- **PIN:** Las tarjetas tienen un PIN de 4 dígitos hasheado con bcrypt (`pin_hash`).
- **Bloqueo por intentos:** Después de **3 intentos fallidos** de PIN, la tarjeta se bloquea temporalmente por **15 minutos** (`nfc_card_attempts` tabla). Estos valores están **hardcodeados** en `internal/payments/nfc_terminal.go` (`incrementCardAttempt`), **no son configurables** desde la UI ni desde la API actualmente. Para desbloquear una tarjeta antes de que expire el timeout, un admin con permiso `nfc.reset_pin` debe usar `PUT /api/nfc/cards/{uid}/pin/reset` para resetear el PIN (lo cual también limpia los intentos y el bloqueo). No hay un endpoint dedicado de "desbloquear tarjeta" sin resetear el PIN.
- **Documento de identidad:** Para tarjetas UID-only (clonables), el nodo puede requerir verificación de documento de identidad además del PIN.
- **Tipos de tarjeta:** `uid_only` (sin crypto), `desfire` (con crypto AES), `dual` (ambos).

### 12.3 Device fingerprint

- El POS Android genera un fingerprint del dispositivo basado en `ANDROID_ID` + SHA-256.
- El backend verifica que el fingerprint coincida con el registrado para prevenir clonación de terminales.
- El `terminal_id` es determinista: `TERM-ANDROID-{hash(ANDROID_ID)[:12]}`.

---

*Fin del documento 01 — Arquitectura de la Plataforma.*
