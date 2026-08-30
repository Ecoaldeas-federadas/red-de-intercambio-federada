# Guía de Inicio Rápido para Desarrolladores: Red de Intercambio Federada (Sistema TQ)

Bienvenido a la arquitectura técnica de la **Red de Intercambio Federada**, una plataforma unificada y de código abierto diseñada como el sistema operativo completo para la soberanía económica, gobernanza autónoma e infraestructura digital de ecoaldeas, comunidades rurales, cooperativas, ferias y organizaciones autónomas.

Esta guía está dirigida a arquitectos de software, desarrolladores y administradores de sistemas que deseen comprender la infraestructura, el stack de desarrollo y el protocolo de federación para colaborar de manera unificada en el repositorio principal del proyecto.

> **Antes de empezar a programar, lee [`PRINCIPIOS_INNEGOCIABLES.md`](./PRINCIPIOS_INNEGOCIABLES.md).**
> Ese documento define las 10 reglas básicas que no se negocian: código abierto, un código base único,
> ajustes para cambiar de nodo, qué requiere aprobación de todos los nodos, qué se puede modificar
> localmente, y cómo se comparten las mejoras con toda la red.

---

## 0. Por qué trabajar unificado, no separado

Nunca hemos avanzado por trabajar aislados. Cada quien creando su propio sistema por separado logra, quizás, unificar pequeños grupos dentro de su país, pero si queremos una unificación mundial, tiene que haber cosas que sean comunes.

Este software propone **tres niveles de gobernanza**:

- **Gobernanza de la Federación (mundial):** Pocas cosas que afectan a toda la red se deciden por votación igualitaria de todos los nodos. Por ejemplo: la canasta básica de la moneda trueque (que es la misma en todas partes), el protocolo de comunicación entre nodos, qué pasa cuando un nodo perjudica la red.
- **Gobernanza de la Aldea/Nodo (local):** Cada nodo es totalmente independiente. Cada comunidad decide sus propias reglas internas, sus leyes, sus catálogos de productos, sus comisiones, sus niveles de admisión, sus horas de trabajo, sus sueldos. El servidor corre físicamente en cada nodo. Cada quien es dueño de sus propios datos.
- **Gobernanza de Organizaciones (dentro de la aldea):** Un nodo puede tener varias organizaciones (cooperativas, parcelas, comisiones). Cada organización tiene sus propias reglas internas y departamentos, pero está sujeta a las reglas generales de la aldea.

La regla fundamental es: **un código central, abierto, auditable y modificable por todos.** Cualquiera puede proponer mejoras, agregar módulos, adaptar el software a las necesidades de su país. Pero la base —la comunicación entre nodos y la moneda de trueque— debe ser la misma para todos. Modificar esa base requiere aprobación de todos los nodos porque implica modificar todos los nodos.

Las mejoras que se implementan en el código central quedan disponibles para todos. Si Uruguay agrega una función, Venezuela la puede usar. Si Venezuela mejora algo, Uruguay se beneficia. Así construimos un software libre único para todo el mundo, donde todos participan en el desarrollo de forma igualitaria.

---

## 1. Filosofía de Arquitectura: Soberanía Descentralizada

A diferencia de las arquitecturas de la "nube" tradicional que centralizan los datos en monopolios corporativos (AWS, Google), o los sistemas blockchain que imponen altos costos de transacción y consumo energético, el sistema opera bajo un modelo de **Federación de Nodos Locales Autohospedados**:

- **Soberanía de datos (descentralización real):** Cada nodo corre su propia instancia física del servidor localmente. Los datos de los miembros, catálogos y gobernanza pertenecen exclusivamente a la comunidad local. Ningún nodo externo tiene acceso directo de lectura o escritura a tu base de datos.
- **Código único y adaptable:** Todo el software es 100% de código abierto, auditable y gratuito. Las adaptaciones locales no se hacen fragmentando el código, sino mediante un sistema de configuración modular y la co-creación directa sobre el núcleo principal.
- **La red es el protocolo:** Para que la interoperabilidad y el trueque inter-comunidades funcionen en la vida real, el motor contable, el ledger inmutable, el protocolo de cifrado NFC y las APIs de federación deben ser idénticos e innegociables en toda la red.

### El Trueque Digital no es dinero, es reciprocidad física

Las monedas locales tradicionales fallan porque imitan el comportamiento del dinero fiduciario: exigen "recargar" saldo y fomentan la acumulación de números abstractos. El Trueque TQ funciona bajo la doctrina de **Saldo Cero**.

El sistema registra digitalmente el flujo de transacciones físicas de suma cero. La meta óptima siempre es estar en cero: aportaste tanto como recibiste, sin deberle nada a nadie ni que nadie te deba a ti. El saldo positivo no es para guardarlo; te advierte que debes consumir para que la energía circule. El saldo negativo es tu compromiso ético de aportar de vuelta tu trabajo o cosechas al colectivo.

Por eso los límites son estrictos (topes bajos y altos simétricos). El sistema te impide seguir adquiriendo bienes si no has aportado nada de vuelta, forzando la reciprocidad real y evitando que nadie acumule números vacíos en una pantalla.

### La métrica de valor es universal: energía física

1 TQ equivale exactamente a 1 kWh de energía física real (3.6 MJ). La energía no tiene nacionalidad; las leyes de la termodinámica son las mismas en Montevideo que en Caracas. Un kilo de frijoles puede requerir más energía para ser producido en Uruguay debido al clima o suelo, elevando su costo real en TQ, pero la métrica de medición (el kWh) es la misma. Si cada país inventa su propia métrica, caemos en el mercado de divisas tradicional con especulación cambiaria.

---

## 2. El Stack Tecnológico

El ecosistema está construido utilizando tecnologías modernas, eficientes y 100% de código abierto y gratuitas (sin costos por licencia, sin puertas traseras):

```
                          [ Cliente Web React PWA ] <-\
                                                       \-- (JSON/REST APIs)
[ Tarjeta NFC ] ---> [ POS Android / POS Web ] ------> [ Backend en Go ] <---> [ YugabyteDB ]
                       [ Terminal ESP32 físico  ] ----/        |
                                                           (mTLS / WireGuard)
                                                                |
                                                          [ Otros Nodos ]
```

### Backend (Motor de Servicios)
- **Lenguaje:** **Go (Golang)**. Velocidad de ejecución, consumo mínimo de RAM, binarios estáticos sin dependencias externas.
- **Arquitectura:** API REST modular con paquetes separados: `accounts`, `api`, `assembly`, `audit`, `config`, `crypto`, `db`, `external`, `federation`, `ledger`, `payments`, `pricing`, `taxes`.
- **Compilación:** `cd cmd/node && go build` produce un binario único autoejecutable.

### Base de Datos (Persistencia Distribuida)
- **Motor:** **YugabyteDB** (100% Open Source y gratuita, compatible con PostgreSQL).
- **Por qué YugabyteDB:** Escalabilidad lineal horizontal y vertical. Al añadir un nuevo nodo físico al servidor, YugabyteDB redistribuye el almacenamiento y las consultas sin apagar el sistema. Tolerancia total a fallas de hardware en entornos rurales hostiles. Sin costos de licencia, sin "puertas traseras" corporativas.
- **Migraciones:** 130 migraciones SQL versionadas en `internal/db/migrations/`, compatibles con PostgreSQL estándar.

### Frontend Web
- **Aplicación Web:** **React + TypeScript + Vite** (PWA). Instalable en navegador de celular o computadora. Funciona en iPhone, Android, computadoras, o cualquier dispositivo con navegador.
- **Páginas principales:** Dashboard, Billetera, Transferencias, Productos, Tienda, Calculadora de energía, Asamblea, Gobernanza, Organizaciones, Terminales NFC, Servicios Federados, Federación, Auditoría, Configuración del Nodo, Sitio Web Público configurable.
- **Compilación:** `cd web && npm run build`

### Aplicación Android Nativa (POS)
- **Lenguaje:** **Kotlin** con Jetpack Compose, Moshi (JSON), Retrofit (API).
- **Ubicación:** `punto-de-venta-pos/`
- **Funcionalidades:**
  - Login del comerciante con usuario/contraseña.
  - Cobros por QR (genera código, cliente escanea y paga desde su celular).
  - Cobros por NFC (lee tarjeta del cliente con NFC nativo del teléfono).
  - Emparejamiento por código de 6 dígitos con el servidor del nodo.
  - Gestión de turnos (apertura/cierre de caja).
  - Transacciones con tarjetas DESFire (encriptadas, solo PIN), UID-only (sencillas, documento ID + PIN) y MIFARE Classic (certificados dinamicos rotativos, documento OBLIGATORIO + PIN + lectura/escritura de sectores).
  - Pantallas: Login, Dashboard, Cobro NFC, Cobro QR, Transacciones, Admin, Configuración, Registro de Terminal, Provisionar Tarjeta Classic.
  - Criptografía: Ed25519 para firmas, AES-256-GCM para cifrado, Curve25519/X25519 para ECDH, bcrypt para PIN, certificados dinamicos para MIFARE Classic.

### Firmware ESP32 (Terminales Físicos)
- **Lenguaje:** C/C++ con Arduino Framework.
- **Ubicación:** `firmware/`
- **Tipos de terminal:**

| Tipo | Hardware | Descripción | Carpeta |
|------|----------|-------------|---------|
| **Keypad** | ESP32 + PN532 + OLED + encoder rotativo | Terminal con encoder para monto y PIN | `terminal-keypad/` |
| **Touch** | TTGO T-Display + PN532 | Pantalla táctil para monto y PIN | `terminal-touch/` |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta (vendedor + comprador) para trueque comunitario | `terminal-community/` |
| **BLE Reader** | ESP32 + PN532 (sin pantalla/WiFi) | Lector NFC Bluetooth — accesorio del POS, no terminal independiente | `terminal-ble-reader/` |

- **Emparejamiento:** Dos opciones:
  1. **Por código corto (recomendado):** El ESP32 muestra un código de 6 dígitos en su pantalla, el admin lo aprueba desde la web. Firmware genérico, no requiere compilación por terminal.
  2. **Provision manual (mayor seguridad):** El admin provisiona con chip_id (MAC efuse), descarga config.h, compila firmware específico. Hardware binding anti-copia.
- **Seguridad:** Ed25519, AES-256-GCM, ECDH, SHA-256, chip_id de efuse (no modificable), NVS encriptado.
- **Código compartido:** `firmware/shared/` — crypto_helper.h, server_client.h, hardware_binding.h, nfc_reader.h, display_helper.h, wifi_provisioning.h, desfire_crypto.h, card_rotation.h.

### Punto de Venta Web (POS Web)
- **Ubicación:** `pos/` (proyecto separado, React/Vite, puerto 3001)
- **Para:** iPhone, computadoras, o cualquier dispositivo sin app Android. Ideal cuando no se puede instalar la app Android.
- **Funcionalidades:** Crear cobros QR, mostrar QR en pantalla, esperar pago del cliente vía polling. Pago NFC con flujo unificado (documento + PIN antes de tarjeta). Soporte para lector NFC Bluetooth (Web Bluetooth API, solo Chrome/Edge).
- **Autenticación:** 3 niveles (admin registra terminal → dueño aprueba sesión → sesión temporal expirable 1h/5h/24h).
- **Confirmación de pagos:**
  - **QR code:** Cliente escanea QR → va a `/pay?t=token` → confirma pago desde su sesión.
  - **NFC (todos los tipos):** Documento + PIN primero → servidor identifica tipo de tarjeta → cliente acerca tarjeta → POS procesa según tipo (Classic/UID/DESFire).
- **Documentación:** Ver `pos/README.md` para detalles completos.

---

## 3. Infraestructura, Redes e Internet Paralelo

Una comunidad debe ser capaz de resistir colapsos de telecomunicaciones, censuras o ataques cibernéticos externos. El sistema integra su propio esquema de infraestructura de red:

### Internet Paralelo Cifrado
- **Ubicación:** `network/wireguard/`
- Los servidores locales de los nodos se interconectan mediante un servidor central (lighthouse) que gestiona una **Red Privada Virtual basada en WireGuard**.
- Cada nodo tiene su propia dirección IP interna criptográficamente segura.
- Todo el tráfico inter-comunidades viaja encriptado y aislado de la red pública de internet.
- **Componentes:** `generate-keys.sh`, `lighthouse.conf.tpl`, `peer-config.tpl`.

### Intranet Local Off-Grid
- **Ubicación:** `network/openwrt/`
- En caso de corte total de telecomunicaciones, el nodo local sigue operando como una red Wi-Fi de largo alcance autogestionada con routers flasheados con OpenWrt.
- **Componentes:** configuración Luci, paquetes personalizados, image-builder, domain-assign.
- Los usuarios pueden transaccionar, enviar mensajería y usar los servicios locales sin un solo byte de conexión a internet externa.

### DNS y Nombres de Dominio Internos
- **Ubicación:** `network/dns/`
- Sistema de nombres de dominio interno (dnsmasq) para resolver direcciones locales dentro de la red cifrada.

### Panel de Aplicaciones "Un Solo Clic"
- **Ubicación:** `services/` — cada servicio tiene su propio `docker-compose.yml`.
- El panel de administración soberano permite instalar aplicaciones federadas de código libre:

| Servicio | Función | Reemplaza a |
|----------|---------|--------------|
| **Matrix (Synapse)** | Mensajería y chat federado | WhatsApp/Telegram |
| **Nextcloud** | Almacenamiento colaborativo de archivos | Google Drive |
| **Asterisk (VoIP)** | Central telefónica digital interna | Telefonía tradicional |
| **Jitsi** | Videoconferencias federadas | Zoom/Meet |
| **PeerTube** | Plataforma de video federada | YouTube |
| **Mastodon/Lemmy/Friendica** | Redes sociales federadas | Twitter/Reddit |
| **BookStack/BookWyrm** | Documentación colaborativa y libros | Notion/Goodreads |
| **Gitea** | Repositorio de código | GitHub |
| **Home Assistant** | Automatización del hogar | Smart home corporativo |
| **Vaultwarden** | Gestor de contraseñas | Bitwarden/1Password |
| **Jellyfin** | Servidor de medios | Netflix/Spotify |
| **Mumble** | Chat de voz de baja latencia | Discord |
| **BigBlueButton** | Aula virtual | Google Classroom |
| **Mobilizon** | Organización de eventos | Eventbrite/Facebook Events |
| **Collabora** | Suite ofimática colaborativa | Office 365 |
| **Pixelfed** | Compartir fotos federado | Instagram |
| **Funkwhale** | Compartir música federada | SoundCloud |
| **WriteFreely** | Blogging minimalista federado | Medium |
| **MediaWiki** | Wiki colaborativa | Wikipedia interna |

---

## 4. Estructura Contable, Criptografía y APIs

### El Ledger de Saldo Cero
La contabilidad interna no maneja conceptos bancarios tradicionales de "ahorro" ni "crédito con interés". Sigue el principio estricto de **crédito mutuo de suma cero**:

$$\sum (\text{Saldos de todos los usuarios}) = 0$$

- **Inmutabilidad criptográfica:** Cada transacción se registra en un libro contable (ledger) de doble entrada donde cada registro se encadena criptográficamente con el hash del registro anterior (`SHA256(prev_hash + transaction_details)`), firmado digitalmente con claves Ed25519.
- **Límites simétricos dinámicos:** El sistema restringe la capacidad de transaccionar de un usuario si supera su tope positivo o negativo establecido por la asamblea. Esto obliga a circular los saldos para volver siempre al equilibrio de cero (reciprocidad pura).

### Nuevas tablas de federación (migraciones 128-130)

| Tabla | Migracion | Descripcion |
|-------|-----------|-------------|
| `cross_node_tx_chain` | 128 | Cadena de transacciones inter-nodos con `prev_hash` y `tx_hash` |
| `federation_node_levels` | 129 | Definicion de niveles de nodo (Nuevo, Aceptado, Pleno) |
| `federation_node_membership` | 129 | Membresia de cada nodo en la federacion (nivel, fechas) |
| `federation_sponsorships` | 129 | Relaciones de padrino entre nodos |
| `federation_pairing_requests` | 130 | Solicitudes de emparejamiento federado con verificacion de 4 opciones |

### Nuevas columnas y categorias del ledger

- `ledger_entries.pool_type`: Indica si la transaccion es `'global'` o `'bilateral'`.
- Nuevas categorias: `node_bridge_global` (piscina global) y `node_bridge_bilateral` (pools bilaterales), ademas de `node_bridge` existente.

### Protocolo NFC Seguro
La interacción física mediante tarjetas o llaveros NFC utiliza tecnología **NTAG424 DNA** y **MIFARE DESFire**:

1. **DESFire (tarjeta segura):** Cifrado AES-128/256-GCM con claves rotativas. El terminal autentica la tarjeta criptográficamente. Solo pide PIN al usuario. No requiere documento de identidad porque la encriptación ya valida que la tarjeta es auténtica.
2. **UID-only (tarjeta sencilla/barata):** Solo lee el UID de la tarjeta. Como no hay encriptación que valide autenticidad, el sistema pide documento de identidad + PIN para verificar que la tarjeta pertenece a quien dice ser.
3. **Anti-clonación:** Cada lectura genera un token criptográfico único (SUN - Secure Unique NFC) que cambia en cada toque. El backend valida el token in situ, impidiendo clonación o reproducción de saldo.
4. **Rotación de claves:** El sistema soporta rotación automática de claves de tarjetas DESFire con dual-card (tarjeta activa + tarjeta de respaldo).

### Identificación de Terminales
Cada terminal tiene tres identidades separadas:

1. **Etiqueta visible (editable):** Nombre humano para reconocimiento del operador. Ej: "Ferretería Don José".
2. **Identidad de hardware (estable):** Chip ID del ESP32 (MAC efuse, no modificable) o fingerprint del dispositivo Android (SHA-256 de ANDROID_ID). Se usa para detectar re-registros.
3. **Identidad criptográfica:** Par de claves Ed25519. La clave pública es la credencial de autenticación actual. La clave privada nunca sale del terminal. Rotación de claves sin perder la identidad del dispositivo.

Cuando un terminal se re-registra (rotación de claves), el servidor detecta que el dispositivo ya existe por su fingerprint/chip_id y le pregunta al administrador: "¿Reemplazar la clave del terminal existente o crear uno nuevo?" Esto preserva el historial y la configuración del terminal.

### Límites Inter-Nodos (Federación Real)

La federación tiene dos mecanismos de intercambio inter-nodos:

1. **Piscina global multilateral real:** Un pool compartido donde el balance
   ganado con el Nodo B se puede gastar con el Nodo C. No es solo una
   verificación de límites, sino un pool real separado de los bilaterales. Las
   transacciones de la piscina global se registran con `pool_type = 'global'` y
   categoría `node_bridge_global` en el ledger.

2. **Pools bilaterales:** Limites de crédito mutuo entre cada par de nodos. Si
   los miembros del Nodo B consumen bienes del Nodo A superando ese límite
   bilateral, el sistema bloquea nuevas transacciones bilaterales. Las
   transacciones bilaterales se registran con `pool_type = 'bilateral'` y
   categoría `node_bridge_bilateral`.

La única forma de desbloquear no es con transferencias financieras vacías, sino
con **reciprocidad física**: los productores del Nodo B deben aportar valor real
(semillas, herramientas, trabajo) al Nodo A para saldar la deuda inter-nodo y
reactivar el intercambio.

### Niveles de Nodo Federado

Cada nodo federado tiene un nivel que determina sus capacidades:

| Nivel | Nombre | Límite TQ | Antigüedad mínima | Voto | Padrino |
|-------|--------|-----------|-------------------|------|---------|
| 1 | Nodo Nuevo | 1.000 | 90 días | No | No |
| 2 | Nodo Aceptado | 5.000 | 180 días | Sí | Sí |
| 3 | Nodo Pleno | 20.000 | - | Sí | Sí |

El **sistema de padrino** permite que un nodo nivel 2+ respalde a un nodo nuevo.
El límite del padrino se reduce por el monto del nodo apadrinado. Si el
apadrinado entra en default, la deuda pasa al padrino. Al alcanzar nivel 2, el
límite del padrino se libera.

### Integridad Distribuida

Las transacciones inter-nodos usan **firma dual** (ambos nodos firman) y
**hashes encadenados** (`prev_hash`, `tx_hash` en la tabla `cross_node_tx_chain`).
Cuando los nodos se reconectan, se realiza una reconciliación automática para
detectar discrepancias en la cadena.

### Integración de API Federada (El Estándar Unificado)
Para federar dos nodos independientes, los servidores realizan un apretón de manos seguro (mTLS con certificados cruzados) y consumen endpoints unificados:

- `POST /api/v1/federation/handshake`: Intercambio de claves públicas y firma de límites de confianza inter-nodos.
- `POST /api/v1/federation/payments/lookup`: Validación en tiempo real del saldo y límites de un miembro del Nodo A que intenta pagar físicamente en el Nodo B.
- `POST /api/v1/federation/catalog/sync`: Sincronización de productos autorizados para comercio internacional de trueque.
- `GET /api/v1/federation/peers`: Lista de nodos federados y sus estados.
- Node discovery por gossip protocol para encontrar nuevos nodos automáticamente.

### Nuevos endpoints de federación (niveles, padrinos, emparejamiento)

- `GET /api/federation/node-levels` — Lista los niveles de nodo federado.
- `GET /api/federation/nodes/{domain}/membership` — Membresía de un nodo (nivel, fecha de ingreso).
- `GET /api/federation/nodes/{domain}/check-upgrade` — Verifica si un nodo puede ascender de nivel.
- `GET /api/federation/sponsorships` — Lista de padrinos y nodos apadrinados.
- `POST /api/federation/pair/initiate` — Inicia emparejamiento federado (body: `requesting_domain`, `requesting_public_key`, `requesting_endpoint`).
- `GET /api/federation/pair/{code}/options` — Devuelve 4 opciones de código para verificación (body: `options[]`, `message`).
- `POST /api/federation/pair/{code}/confirm` — Confirma emparejamiento (body: `selected_code`, `sponsor_domain`).
- `GET /api/nfc/terminal/pair/{code}/options` — Devuelve 4 opciones de código para emparejamiento POS.
- `POST /api/nfc/terminal/pair/{code}/approve` — Aprueba emparejamiento POS (acepta `selected_code` opcional).

### Endpoints mTLS de federación (reconciliación y auditoría)

- `POST /federation/reconcile/compare` — Compara cadenas de transacciones inter-nodos.
- `POST /federation/reconcile/chain` — Solicita la cadena de transacciones de un nodo.
- `POST /federation/reconcile/import` — Importa transacciones faltantes durante reconciliación.
- `GET /federation/audit/chain` — Auditoría federada de la cadena de transacciones.

---

## 5. Gobernanza y Asambleas — Tres Niveles

El sistema tiene **tres niveles de gobernanza**, cada uno independiente internamente pero sujeto al nivel superior:

```
┌─────────────────────────────────────────────────────────┐
│  NIVEL 1: FEDERACIÓN (mundial)                          │
│  Decisiones que afectan a TODOS los nodos del mundo.     │
│  Se deciden por votación igualitaria de todos los nodos. │
│  Ej: canasta básica TQ, protocolo, expulsión de nodos.  │
├─────────────────────────────────────────────────────────┤
│  NIVEL 2: ALDEA / NODO (local)                          │
│  Decisiones que afectan a toda la comunidad local.       │
│  Se deciden por asamblea del nodo.                       │
│  Ej: horarios, sueldos, tasas, admisión, catálogo.      │
├─────────────────────────────────────────────────────────┤
│  NIVEL 3: ORGANIZACIONES (dentro de la aldea)           │
│  Decisiones que afectan solo dentro de la organización.  │
│  Se deciden por la asamblea de la organización.          │
│  Ej: reglas internas, departamentos, parcelas.          │
└─────────────────────────────────────────────────────────┘
```

### Nivel 1: Gobernanza Federada (mundial)

Pocas cosas afectan a toda la red. Estas son las decisiones que se toman por votación igualitaria de **todos los nodos federados**:

- **Canasta básica TQ:** Es la misma en todos los nodos. La moneda trueque no tiene inflación, así que la canasta básica tiene que ser exactamente la misma en todas partes. Si un país tiene una canasta más alta y otro más baja, se crea riqueza en un lado y pobreza en el otro, rompiendo el principio de igualdad.
- **Límite de crédito global:** El tope máximo de crédito mutuo entre nodos.
- **Expulsión de un nodo:** Si un nodo perjudica la red, los demás votan su expulsión.
- **Umbral de aprobación:** Qué porcentaje de nodos se necesita para aprobar cambios (por defecto 100%).
- **Protocolo de comunicación:** La API federada, el protocolo criptográfico, el formato del ledger.

**Importante:** La canasta básica federada **no tiene nada que ver** con el comercio exterior. El comercio exterior es directo, en cada nodo, con su moneda local (UYU, VES, ARS, etc.). El Factor de Conversión (FC) calcula el equivalente entre TQ y la moneda local para el comercio externo, pero eso es interno de cada nodo y no afecta la canasta básica federada.

### Nivel 2: Gobernanza de la Aldea / Nodo (local)

Cada nodo es soberano. La asamblea del nodo decide todo lo que afecta a su comunidad:

- **Asambleas locales:** Creación de sesiones, propuestas, votaciones, asistencia, quórum configurable (10% a 90%).
- **Reglas de gobernanza dinámicas:** Tipos de propuesta, niveles de aprobación, plazos de votación.
- **Horas de trabajo y sueldos:** Cuánto necesita una persona para comer en un día, cuántas horas trabaja, cuánto gana. Esto se maneja directamente en el nodo.
- **Catálogo de productos y precios locales.**
- **Tasas, comisiones, horarios de comercio.**
- **Admisión de miembros y recuperación de cuentas.**
- **Configuración del sitio web público** (colores, logo, textos, páginas).
- **Adaptaciones culturales y de idioma.**
- **Comercio exterior con su moneda local** (FC, canasta local para cálculo del FC).

**Lo que decide la aldea no puede afectar la canasta básica federada.** Las horas de trabajo, los sueldos y el comercio exterior son internos del nodo.

### Nivel 3: Gobernanza de Organizaciones (dentro de la aldea)

Un nodo puede tener **varias organizaciones**. Cada organización puede ser:
- Una cooperativa encargada de tareas específicas.
- Un grupo de parcelas individuales con sus propias reglas internas.
- Una comisión o departamento con autonomía operativa.

Cada organización es **independiente dentro de su propio terreno**, pero está sujeta a las reglas generales de la aldea. Dentro de cada organización puede haber **departamentos** para dividirse internamente.

- **Asambleas de organización:** Sesiones, propuestas y votaciones con scope limitado a la organización.
- **Reglas internas:** Cada organización define cómo se gobierna internamente.
- **Departamentos:** Subdivisión interna con roles y permisos específicos.
- **Permisos granulares:** Cada acción (emitir tarjeta, registrar terminal, aprobar admisión, etc.) tiene un permiso configurable que puede requerir multisig.

### Modos de aprobación configurables (en cualquier nivel)

- Votación de asamblea.
- Una persona autorizada.
- Cualquier persona u organización de un grupo.
- Múltiples firmas simultáneas (multisig).
- Una organización/comisión/departamento.

### Resumen de los tres niveles

| Nivel | Qué decide | Quién decide | Ejemplos |
|-------|-----------|-------------|----------|
| **Federación** | Cosas que afectan a todo el mundo | Todos los nodos por votación | Canasta TQ, protocolo, expulsión |
| **Aldea/Nodo** | Cosas que afectan a toda la comunidad | Asamblea del nodo | Sueldos, horarios, catálogo, tasas |
| **Organización** | Cosas que afectan solo a la organización | Asamblea de la organización | Reglas internas, departamentos |

Las reglas más grandes (las de la aldea) engloban las cosas más comunes entre todos. Las reglas de cada organización solo afectan dentro de su terreno. Las reglas universales afectan al mundo entero.

---

## 6. Comercio Exterior y Moneda Local

El sistema soporta **20 monedas externas** para mostrar precios referenciales en la moneda local de cada país, mientras el núcleo sigue procesando la energía real en TQ:

- **Factor de Conversión (FC):** Calcula el equivalente entre TQ y la moneda local (UYU, VES, ARS, COP, MXN, etc.).
- **Canasta básica local:** Cada nodo configura su propia canasta de productos para calcular el FC.
- **Comercio externo:** Ventas al público externo (no miembros) se manejan por separado del trueque interno. No se mezclan las ventas al público con el trueque.
- **Propuestas de comercio exterior:** Aprobación por gobernanza para operaciones externas.
- **Cuentas bancarias externas:** Campos opcionales para registrar cuentas bancarias de organizaciones (no conecta con bancos, solo informativo).

---

## 7. Estructura del Repositorio

```
red-de-intercambio-federada/
├── cmd/                          # Binarios de Go
│   ├── node/                     # Servidor principal del nodo
│   ├── install/                  # Instalador automático
│   └── installer/                # Instalador con interfaz
├── internal/                     # Lógica del backend (Go)
│   ├── accounts/                 # Gestión de cuentas y miembros
│   ├── api/                      # Handlers HTTP (REST API)
│   ├── assembly/                 # Asambleas y votaciones
│   ├── audit/                    # Auditoría
│   ├── config/                   # Configuración del nodo
│   ├── crypto/                   # Criptografía del servidor
│   ├── db/                       # Migraciones y conexión a BD
│   ├── external/                 # Comercio exterior
│   ├── federation/               # Federación entre nodos
│   │   ├── reconcile.go          # Reconciliación de cadenas inter-nodos
│   │   ├── node_levels.go        # Niveles de nodo federado y padrinos
│   │   └── pairing.go            # Emparejamiento federado con verificación de 4 opciones
│   ├── ledger/                   # Ledger contable inmutable
│   ├── payments/                 # Pagos NFC, terminales, emparejamiento
│   ├── pricing/                  # Cálculo de precios por energía
│   └── taxes/                    # Impuestos y comisiones
├── web/                          # Frontend React + TypeScript + Vite
│   └── src/pages/                # 42 páginas (Dashboard, POS, Asamblea, etc.)
├── punto-de-venta-pos/           # App Android POS (Kotlin + Jetpack Compose)
├── firmware/                     # Firmware ESP32 (C/C++)
│   ├── shared/                   # Código compartido (crypto, NFC, display, server)
│   ├── terminal-keypad/          # Terminal con encoder rotativo
│   ├── terminal-touch/           # Terminal con pantalla táctil
│   ├── terminal-community/       # Terminal doble tarjeta (trueque comunitario)
│   ├── terminal-ble-reader/      # Lector NFC Bluetooth (accesorio del POS)
│   └── chip-id-reader/           # Lector de chip ID para provisioning
├── services/                     # Aplicaciones federadas "un solo clic" (Docker)
│   ├── matrix/                   # Mensajería federada
│   ├── nextcloud/                # Archivos colaborativos
│   ├── voip/                     # Telefonía interna
│   ├── pos-web/                  # POS web adicional
│   └── ... (20+ servicios más)
├── network/                      # Infraestructura de red cifrada
│   ├── wireguard/                # VPN inter-nodos
│   ├── openwrt/                  # Routers flasheados para intranet off-grid
│   └── dns/                      # DNS interno
├── docker/                       # Dockerfiles
├── docker-compose.yml            # Orquestación completa del nodo
├── docs/                         # Documentación
└── scripts/                      # Scripts de utilidad
```

---

## 8. Cómo Colaborar en el Código Unificado

Para evitar la atomización tecnológica y robustecer el sistema en beneficio de todas las comunidades, el flujo de desarrollo se unifica:

### Pasos para empezar

1. **Clonar el repositorio central:** Obtén acceso al código madre que unifica el Backend (Go), Frontend (React), la app Android (Kotlin), el firmware ESP32 (C/C++), los servicios federados (Docker) y la infraestructura de red (WireGuard/OpenWrt).

2. **Configurar entorno Dockerizado:** El repositorio cuenta con `docker-compose.yml` que levanta un nodo completo: YugabyteDB, API de Go, frontend de React, y todos los servicios necesarios.

3. **Compilar y verificar:**
   ```bash
   # Backend
   cd cmd/node && go build

   # Frontend
   cd web && npm install && npm run build

   # App Android (requiere Android Studio)
   cd punto-de-venta-pos && gradlew assembleDebug

   # Firmware ESP32 (requiere Arduino IDE o PlatformIO)
   # Abrir firmware/terminal-keypad/terminal-keypad.ino
   ```

4. **Proponer mejoras vía Pull Requests:**
   - Si desarrollas una nueva característica para tu país (por ejemplo, un módulo de bloqueo automático para una comunidad religiosa, o un tipo de terminal específico), prográmalo de manera genérica, limpia e integrada en el núcleo.
   - Sube la propuesta mediante un Pull Request al repositorio central.
   - Una vez auditado el código por los desarrolladores de la federación, la función se aprueba y se integra al software maestro.
   - **El beneficio:** Cualquier comunidad o país que descargue o actualice la plataforma tendrá acceso a esa mejora.

### Qué se puede modificar localmente sin aprobación

- Catálogo de productos y precios locales.
- Reglas de gobernanza interna (quórum, niveles de admisión, permisos).
- Configuración del sitio web público (colores, logo, textos, páginas).
- Moneda de referencia para mostrar precios externos (UYU, VES, ARS, etc.).
- Servicios federados instalados (Matrix, Nextcloud, VoIP, etc.).
- Adaptaciones culturales y de idioma.
- Horarios de comercio, comisiones, tasas locales.

### Qué requiere aprobación de todos los nodos

- Protocolo de comunicación entre nodos (API federada).
- Métrica de valor de la moneda trueque (cálculo por energía).
- Protocolo criptográfico de tarjetas NFC y terminales.
- Estructura del ledger contable.
- Reglas de expulsión de nodos de la red.

> **Ver [`PRINCIPIOS_INNEGOCIABLES.md`](./PRINCIPIOS_INNEGOCIABLES.md) para el detalle completo
> de las 10 reglas innegociables, incluyendo: todo código debe tener ajustes para cambiar de nodo,
> las implementaciones locales deben pensarse para poder expandirse mundialmente, y las decisiones
> se explican en lenguaje humano para que todos puedan participar.**

---

## 9. Instalación de un Nuevo Nodo

El sistema está diseñado para que un nuevo nodo se configure completamente a través de pantallas de instalación y ajustes administrativos, sin editar código fuente ni páginas web manualmente:

1. **Instalar el servidor:** `docker-compose up -d` levanta YugabyteDB, el backend en Go, y el frontend en React.
2. **Asistente de instalación:** La primera vez, un asistente web (`/setup`) guía la configuración inicial: nombre del nodo, dominio, datos del super administrador.
3. **Configuración por ajustes:** Todo lo demás se configura desde el panel admin: gobernanza, productos, terminales NFC, servicios federados, sitio web público, moneda local, límites, etc.
4. **Modo demo:** Existe un `docker-compose.demo.yml` para nodos demo que se resetean automáticamente cada 24 horas.

---

**Trabajar en un solo código es la garantía de que seremos capaces de interconectarnos de verdad, manteniendo la soberanía total de nuestros datos pero compartiendo una misma inteligencia colectiva. La fuente de la fuerza de esta red no está en el código desarrollado —el código puede ser completamente modificable— sino en que sea un único código para todo el mundo, abierto, auditable y mejorado por todos de forma igualitaria.**
