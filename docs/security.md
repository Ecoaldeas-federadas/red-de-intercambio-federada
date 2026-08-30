# Seguridad y Criptografia

## Autenticacion: Passkeys (WebAuthn/FIDO2)

### Archivos
- `internal/crypto/passkey.go` - Gestor de Passkeys
- `internal/api/auth.go` - Handlers de auth y middleware JWT

### Flujo de Registro
1. **BeginRegistration**: Genera challenge aleatorio (32 bytes), crea opciones WebAuthn con RP ID, algoritmos soportados (-7 ES256, -257 RS256)
2. **VerifyRegistration**: Valida clientDataJSON (tipo, challenge, origin), decodifica attestationObject (CBOR), extrae clave publica
3. Almacena: credential_id, public_key, sign_count en tabla `user_passkeys`

### Flujo de Login
1. **BeginLogin**: Genera challenge, permite credenciales existentes
2. **VerifyLogin**: Valida clientDataJSON, verifica firma Ed25519 sobre (authData + clientData), valida sign_count (anti-replay)

### Registro de Segundo Dispositivo
- Usuario autenticado llama a BeginRegistration con `excludeCredentials` (credenciales existentes)
- El nuevo passkey se asocia al mismo user_id
- Se registra en `device_registrations` con tipo `additional`

## JWT (JSON Web Token)

- **Algoritmo**: HS256
- **Secret**: Variable de entorno `JWT_SECRET` (default: "change-me-in-production")
- **Claims**: user_id, username, node, exp (24h), iat
- **Middleware**: `RequireAuth` valida token en header `Authorization: Bearer <token>`

## Claves Ed25519

### Generacion
- Cada usuario genera par de claves Ed25519 al registrarse
- Clave privada encriptada con AES-256-GCM usando passphrase del usuario
- Clave publica almacenada en `users.public_key` (hex)

### Firma de Transacciones
- Transacciones se firman con clave privada del usuario
- `user_signature` almacenado en tabla `transactions`
- Verificacion con clave publica almacenada

### Multi-firma
- Organizaciones configuran `required_signatures` y `authorized_signers`
- Propuestas multi-firma acumulan firmas en `collected_signatures` (JSONB)
- Se ejecutan cuando se alcanza `required_signatures`

## Hash Chain (Cadena de Bloques)

### Estructura
- Cada transaccion tiene `prev_hash` y `current_hash`
- `current_hash = SHA256(prev_hash + tx_data_serializada)`
- Primera transaccion: `prev_hash = "genesis"` o vacio

### Verificacion
- Auditoria recorre todas las transacciones en orden
- Recalcula hashes y compara con almacenados
- Cualquier modificacion altera la cadena detectablemente

## Firma Dual (Transacciones Inter-Nodos)

### Archivos
- `internal/federation/reconcile.go` - Reconciliacion de cadenas
- Tabla `cross_node_tx_chain` - Cadena de transacciones inter-nodos

### Concepto
Las transacciones entre nodos federados requieren **firma dual**: ambos nodos
(Nodo A y Nodo B) firman cada transaccion con sus claves Ed25519. Esto asegura
que ningun nodo puede crear transacciones unilaterales.

### Flujo
1. Nodo A crea la transaccion y la firma con su clave privada.
2. Nodo B recibe la transaccion, verifica la firma de A, y la firma con su clave.
3. Ambas firmas se almacenan en `cross_node_tx_chain`.
4. Cualquier nodo puede verificar ambas firmas con las claves publicas de A y B.

## Hash Encadenado Inter-Nodos

### Tabla `cross_node_tx_chain`
Cada transaccion inter-nodos tiene:
- `prev_hash`: Hash de la transaccion anterior en la cadena
- `tx_hash`: Hash de la transaccion actual (`SHA256(prev_hash + tx_data + firmas)`)

### Reconciliacion
Cuando dos nodos se reconectan (despues de una desconexion), realizan una
reconciliacion automatica:
1. `POST /federation/reconcile/compare` — Comparan los ultimos hashes de sus cadenas.
2. `POST /federation/reconcile/chain` — Si hay discrepancia, solicitan la cadena completa.
3. `POST /federation/reconcile/import` — Importan las transacciones faltantes.

Esto asegura que ambos nodos tengan la misma cadena de transacciones verificable,
incluso despues de desconexiones prolongadas.

## Verificacion de 4 Opciones

### Emparejamiento federado y POS
Tanto el emparejamiento federado (nodo a nodo) como el emparejamiento de
terminales POS usan **verificacion de 4 opciones**:

1. El solicitante genera un codigo de emparejamiento.
2. El confirmador ve **4 codigos distintos** en su pantalla.
3. Debe seleccionar el codigo correcto.
4. El codigo **expira en 60 segundos**.

### Endpoints
- `GET /api/federation/pair/{code}/options` — 4 opciones para emparejamiento federado.
- `GET /api/nfc/terminal/pair/{code}/options` — 4 opciones para emparejamiento POS.

### Razon de seguridad
Con un solo codigo, cualquiera que lo intercepte puede confirmar. Con 4
opciones, solo quien ve la pantalla del solicitante sabe cual es el correcto.
Esto previene ataques de intermediario y confirmaciones por error.

## Rate-Limiting de Intentos Fallidos

### Emparejamiento
- Si se selecciona el codigo incorrecto en la verificacion de 4 opciones, el
  intento se registra.
- Despues de **5 intentos fallidos**, el codigo de emparejamiento se bloquea y
  se debe generar uno nuevo.

### PIN de tarjetas NFC
- Maximo 3 intentos antes de bloqueo temporal (15 minutos).
- El admin puede resetear el PIN con permiso `nfc.reset_pin`.

### Tarjetas MIFARE Classic con certificados dinamicos
- Las tarjetas MIFARE Classic 1K usan **6 capas de seguridad** para mitigar la clonacion:
  1. Claves A/B unicas por sector por tarjeta (30 claves unicas)
  2. Certificados dinamicos de 16 bytes con triple redundancia (45 copias, solo 1 valida)
  3. Rotacion aleatoria por transaccion (no secuencial)
  4. Documento de identidad OBLIGATORIO + PIN + tarjeta (2FA)
  5. Solo 2 claves enviadas por transaccion (encriptadas con EphemeralMessage)
  6. Aislamiento entre tarjetas (claves unicas por usuario)
- MIFARE Classic usa Crypto1 (debil), pero el diseño compensa porque el atacante no sabe
  cual sector es el activo, necesita PIN + documento, y el clon queda obsoleto tras una transaccion legitima.
- Para alta seguridad, se recomienda DESFire EV3 (AES-128).
- Ver `docs/tarjeta-classic-certificados.md` para detalles completos.

### Login
- Intentos fallidos de login se registran en `audit_log` con accion `login_failed`.
- El sistema puede aplicar rate-limiting configurable por IP y por usuario.

## Encriptacion de Claves Privadas

- **Algoritmo**: AES-256-GCM
- **Derivacion de clave**: Scrypt desde passphrase + salt
- **Almacenamiento**: `users.encrypted_private_key` (BYTEA), `users.encryption_key_salt` (BYTEA)
- **Passphrase**: Nunca se almacena, solo en memoria del usuario

## Recuperacion de Cuenta

### Principio Fundamental
**Ninguna persona sola puede restaurar el acceso a una cuenta.** Minimo 2 aprobaciones requeridas.

### Modos de Aprobacion Configurables
| Modo | Descripcion |
|------|-------------|
| `multi_sig` | N firmas de cualquier miembro con voz/voto |
| `council` | Grupo designado (member_group) |
| `assembly` | Votacion formal de asamblea |
| `department` | Jefes de departamento |

### Flujo
1. Solicitud publica con razon y verificacion de identidad
2. Acumulacion de aprobaciones (cada aprobador autenticado con JWT)
3. Auto-expiracion configurable (default 72h)
4. Al completarse: se eliminan passkeys antiguas, se reemplaza clave publica
5. Usuario registra nuevo dispositivo con nueva Passkey

## Codigos de Invitacion

- Miembros existentes generan codigos de invitacion
- Codigo hasheado con SHA256 (no se almacena en plano)
- Configurable: max_uses, nivel propuesto, expiracion
- Validacion antes de permitir registro

## Terminales NFC ESP32

### Archivos
- `internal/crypto/terminal_crypto.go` - Criptografia de terminales
- `internal/payments/nfc_terminal.go` - Logica de terminales NFC
- `firmware/shared/crypto_helper.h` - Cripto en ESP32 (mbedtls)

### Autenticacion Mutual (Ed25519)
1. Terminal genera keypair Ed25519 de **identidad**, almacena clave privada en NVS
2. Terminal envia su clave publica de identidad al servidor (con token de registro)
3. Servidor responde con su clave publica de identidad
4. Terminal firma nonce con su clave de identidad, servidor verifica
5. Servidor firma session token con su clave de identidad, terminal verifica

### Claves Efimeras por Transaccion (Forward Secrecy)
- Por **cada mensaje**, ambos generan un nuevo par Ed25519 efimero
- Intercambian publicas efimeras firmadas con su clave de identidad
- Derivan shared key via ECDH efimero (no con claves de identidad)
- **Forward secrecy**: si alguien captura una clave efimera, solo compromete 1 transaccion
- Las claves publicas en el wire **cambian en cada transaccion**
- Un atacante que intercepta trafico no puede reutilizar nada

### Cifrado de Comunicacion (AES-256-GCM)
- Toda comunicacion cifrada con la shared key efimera de la transaccion
- Nonce aleatorio de 12 bytes por mensaje (anti-replay)
- Ciphertext firmado con clave de identidad Ed25519 por el emisor
- Receptor verifica firma de identidad antes de descifrar

### PIN de Tarjetas NFC
- 4 digitos, hasheado con bcrypt en el servidor
- Maximo 3 intentos antes de bloqueo temporal (15 minutos)
- Admin puede resetear PIN con permiso `nfc.reset_pin`
- Usuario puede cambiar PIN con PIN viejo

### Identificacion de Tarjetas NFC (BIN-style)
- Card UID tiene formato `nodocodigo:hexrandom` (ej: `nodo1trueque:a1b2c3d4e5f6a7b8`)
- Los primeros caracteres identifican el nodo origen (como los BINs de tarjetas bancarias)
- **No se busca en todos los nodos** — se identifica el nodo directamente por el prefijo
- Si la tarjeta es de otro nodo, se consulta via federation `/federation/card/lookup`
- El nodo origen responde con: userID, username, displayName, balance, isActive
- La transaccion se procesa via `CrossNodeTransfer` entre los nodos federados

## Pagos por Codigo QR

### Formato del QR (protocolo fmc/1.0)
```json
{
  "protocol": "fmc/1.0",
  "type": "PaymentRequest",
  "node": "nodo1.trueque.local",
  "user": "@usuario@nodo1.trueque.local",
  "user_id": "uuid",
  "display_name": "Juan Perez",
  "account": "usuario@nodo1.trueque.local",
  "amount": 5000,
  "label": "Pago de productos",
  "nonce": "aleatorio",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

### Tipos de QR
- **QR con monto fijo**: `amount` presente — para productos/POS, el que paga no puede cambiar el monto
- **QR sin monto (libre)**: `amount` null — el que escanea introduce el monto manualmente
- **QR P2P**: usuario genera QR en su app, otro lo escanea para transferir
- **QR POS**: software de negocio genera QR via API `/api/payments/qr/pos` con monto automatico

### Pago Cross-Node via QR
- Si el QR es de otro nodo (`is_local_node = false`), el pago se procesa via `CrossNodeTransfer`
- El nodo del pagador debita, el nodo del receptor acredita
- Se validan limites bilaterales y globales antes de procesar
- Equivalente a "pago movil": cedula = user_id, banco = node, telefono = account

### Endpoints API para integracion externa
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/payments/qr/generate` | Generar QR personalizado (con o sin monto) |
| POST | `/api/payments/qr/parse` | Escanear/validar QR |
| POST | `/api/payments/qr/pos` | Generar QR con monto fijo (para POS de negocios) |
| POST | `/api/payments/manual` | Pago manual con datos |
| POST | `/api/payments/nfc/lookup` | Buscar tarjeta NFC (local o federada) |

### Permisos
- Middleware `RequirePermission` verifica permisos del usuario via JWT
- Permisos provienen de roles de departamento + permisos directos
- Ver `departments.md` para lista completa de permisos

## TLS / SSL en Intranet (sin internet)

### Arquitectura de TLS

El nodo Go corre en HTTP plano (puerto 8080). Un reverse proxy (Nginx/Caddy)
maneja TLS en el frente. Esto separa la logica de negocio del manejo de certificados.

```
[Cliente] --HTTPS--> [Nginx/Caddy] --HTTP:8080--> [Nodo Go]
```

### Certificados en intranet (sin internet permanente)

Los navegadores verifican certificados **localmente** — no consultan a ninguna
CA en tiempo real. Esto significa que un certificado de Let's Encrypt funciona
en intranet sin internet, porque la verificacion es matematica local contra
el trust store del sistema operativo.

Ver `deployment.md` > "SSL / TLS en Intranet (sin internet)" para la guia
completa con:

- **Let's Encrypt en intranet** (recomendado): obtener certificado con internet
  temporal, funciona sin internet despues. Sin instalar nada en clientes.
  Renovacion automatica cada 90 dias cuando hay internet esporadico.
- **CA privada + script .bat**: sin internet nunca. Se instala una vez por
  dispositivo (doble clic), funciona por 10 anos en todos los navegadores.
- **HTTP plano**: para LAN aislada sin requerimientos de seguridad.

### mTLS entre Nodos

La federacion servidor-servidor usa mTLS mutuo con la misma CA privada.
Cada nodo presenta su certificado y verifica el del par. Esto es independiente
del TLS del navegador.

### Login por Contrasena (Setup Wizard)

- El setup inicial crea el usuario admin con contrasena (bcrypt)
- La contrasena se usa para cifrar la clave privada Ed25519 (AES-256-GCM)
- Login por contrasena via `POST /api/auth/login/password`
- Login por Passkey (WebAuthn) sigue disponible como alternativa
- Ambos metodos retornan JWT con mismo formato

## Almacenamiento de Contrasenas

### Archivos
- `internal/api/auth.go` — Hash y verificacion de contrasenas de login
- `internal/api/system.go` — Hash de contrasena en solicitud de admision
- `internal/payments/nfc_terminal.go` — Hash de PIN de tarjetas NFC
- `internal/db/migrations/139_sanitize_custom_fields_passwords.sql` — Limpieza de datos

### Como se guardan las contrasenas

**NUNCA se almacenan en texto plano.** Todas las contrasenas se hashean con
**bcrypt** (`golang.org/x/crypto/bcrypt`) antes de guardarse en la base de datos.

| Ubicacion | Tabla | Columna | Algoritmo | Costo |
|-----------|-------|---------|-----------|-------|
| Login de usuario | `user_credentials` | `password_hash` | bcrypt | DefaultCost (10) |
| Solicitud de admision | `admission_requests` | `proposed_password` | bcrypt | DefaultCost (10) |
| PIN de tarjeta NFC | `nfc_cards` | `pin_hash` | bcrypt | DefaultCost (10) |

### Por que bcrypt es seguro

- **Unidireccional**: No se puede descifrar el hash para obtener la contrasena original.
- **Sal integrada**: bcrypt genera una sal aleatoria unica para cada contrasena.
- **Costo configurable**: El costo (10 por defecto) hace que cada hash tome ~100ms,
  dificultando ataques de fuerza bruta.
- **Verificacion**: El servidor compara con `bcrypt.CompareHashAndPassword()`,
  que recalcula el hash y lo compara en tiempo constante.

### Quien puede ver las contrasenas

**Nadie.** Ni el administrador, ni el servidor, ni nadie puede ver la contrasena
original de un usuario. El servidor solo puede *verificar* si una contrasena
es correcta, pero no puede *recuperarla*.

Si un usuario olvida su contrasena:
1. No se puede recuperar — no hay forma de "ver" la contrasena.
2. El administrador puede resetearla (generar una nueva) con el permiso adecuado.
3. El usuario puede usar el flujo de **Recuperacion de Cuenta** (ver seccion
   correspondiente arriba), que requiere multiples aprobaciones.

### Defensa en profundidad: sanitizacion de custom_fields

El formulario de admision dinamico permite campos personalizados. Antes, las
contrasenas propuestas (`proposed_password`, `proposed_password_confirm`) se
incluian en el JSON de `custom_fields`, donde el administrador podria verlas
en texto plano. Se implementaron **4 capas de defensa**:

| Capa | Archivo | Que hace |
|------|---------|----------|
| 1. Frontend (envio) | `web/src/components/public-site/DynamicAdmissionForm.tsx` | Excluye claves con `password`/`contrasena`/`clave` del objeto `custom_fields` antes de enviarlo al servidor |
| 2. Backend (guardado) | `internal/api/system.go` `sanitizeCustomFields()` | Elimina claves sensibles del JSON antes de guardarlo en la BD |
| 3. Frontend (visualizacion) | `web/src/pages/WebsiteAdmin.tsx` | Filtra claves con `password`/`contrasena`/`clave` al mostrar `custom_fields` |
| 4. Migracion (limpieza) | `internal/db/migrations/139_sanitize_custom_fields_passwords.sql` | Limpia registros existentes en la BD que ya contenian contrasenas en texto plano |

### Migracion 139: limpieza de datos existentes

La migracion `139_sanitize_custom_fields_passwords.sql` elimina de los
registros existentes en `admission_requests.custom_fields` cualquier clave
que contenga `password`, `contrasena`, `contraseña` o `clave` (case-insensitive),
usando `jsonb_object_agg` con filtro `ILIKE`.

## Permisos y Autorizacion

### Archivos
- `internal/api/auth.go` — Middleware de permisos (`RequirePermission`, `RequireActiveMembership`)
- `web/src/components/Layout.tsx` — Filtrado de menu por permisos y estado de membresia
- `web/src/App.tsx` — `PendingAdmissionGuard` para proteccion de rutas
- `web/src/hooks/usePermissions.ts` — Carga de permisos en el frontend

### Sistema de permisos

Los permisos se verifican en **dos niveles**:

1. **Backend (autoridad real)**: `RequirePermission(perm)` consulta la BD:
   - Permisos directos: `user_permissions` (con `expires_at` opcional)
   - Permisos por rol: `department_members` → `role_permissions` → `permissions`
   - Super admin: `is_super_admin = true AND super_admin_enabled = true` → bypass total
   - Si no tiene el permiso → HTTP 403

2. **Frontend (UX)**: `usePermissions()` carga `/api/users/me/permissions` y
   `Layout.tsx` filtra las pestanas del menu segun `item.perm`.
   - Esto es solo para UX — la seguridad real esta en el backend.
   - Un usuario sin permiso no ve la pestana, pero si navega por URL,
     el backend retorna 403.

### Estados de membresia

| Estado | Que puede hacer |
|--------|----------------|
| `active` | Acceso completo segun sus permisos |
| `pending_admission` | Solo ver su solicitud, perfil, notificaciones y ajustes |
| `unknown` (frontend) | Tratado como pendiente hasta que se confirme |

### Usuarios preliminares (`pending_admission`)

**Middleware backend** (`RequireActiveMembership` en `auth.go`):
- Usuarios con `membership_status = 'pending_admission'` solo pueden acceder
  a una whitelist de rutas:
  - `/api/auth/me`, `/api/auth/me/contacts`, `/api/auth/me/documents`
  - `/api/my/admission-status`, `/api/my/admission-defense`
  - `/api/notifications/*`
  - `/api/auth/passkey/*`
- Cualquier otra ruta API → HTTP 403 con mensaje "Tu cuenta esta pendiente
  de aprobacion."

**Guard frontend** (`PendingAdmissionGuard` en `App.tsx`):
- Redirige automaticamente a `/app/admission-status` si el usuario
  no es `active` e intenta acceder a una ruta no permitida.
- Rutas permitidas: `/app/admission-status`, `/app/profile`,
  `/app/notifications`, `/app/notifications/settings`, `/app/display-settings`

**Menu lateral** (`Layout.tsx`):
- Si `membershipStatus !== 'active'`, solo muestra 3 items:
  Mi Solicitud, Mi Perfil, Notificaciones.
- Valor por defecto `'unknown'` (no `'active'`) para no mostrar
  accidentalmente el menu completo si falla la carga.

### Orden critico del middleware

El middleware de stripping de basePath debe ejecutarse **ANTES** de
`RequireActiveMembership`. Si no, la whitelist compara
`/main/api/auth/me` contra `/api/auth/me` y nunca coincide, bloqueando
a los usuarios preliminares en todas las rutas.

```
Peticion: /main/api/auth/me
  → Strip basePath: /api/auth/me     (debe ejecutarse PRIMERO)
  → RequireActiveMembership: whitelist coincide  (despues)
  → RequireAuth: valida JWT
  → Handler: responde
```

## Flujo de Admision Seguro

### Archivos
- `internal/api/system.go` — `submitAdmissionRequest`, `getMyAdmissionStatus`
- `web/src/components/public-site/DynamicAdmissionForm.tsx` — Formulario publico
- `web/src/pages/AdmissionStatus.tsx` — Estado para el solicitante
- `web/src/pages/WebsiteAdmin.tsx` — Panel de admin para revisar solicitudes
- `internal/db/migrations/135_admission_flow_complete.sql` — Esquema

### Flujo completo

1. **Solicitante** llena el formulario publico (`/p/unirse`)
   - Datos: nombre, email, telefono, ubicacion, razon, habilidades
   - Campos personalizados del formulario dinamico
   - Usuario y contrasena propuestos
   - Las contrasenas se envian por separado (`proposed_password`),
     NO en `custom_fields`

2. **Backend** (`submitAdmissionRequest`):
   - Valida username unico
   - Hashea contrasena con bcrypt
   - Crea usuario preliminar con `membership_status = 'pending_admission'`
   - Crea credenciales (`user_credentials.password_hash`)
   - Crea `admission_requests` con `proposed_password` (hash bcrypt)
   - Sanitiza `custom_fields` (elimina claves de password)
   - **Notifica a los administradores** con permiso `admission.manage`

3. **Solicitante** puede iniciar sesion inmediatamente:
   - Login permite `pending_admission` (auth.go)
   - Ve solo "Mi Solicitud", "Mi Perfil", "Notificaciones"
   - Puede ver el estado: `pending_review` → `elevated_to_assembly` → `approved`/`rejected`

4. **Administrador** revisa en `/app/website?tab=admission`:
   - Ve las solicitudes recibidas
   - **No ve las contrasenas** (filtradas en 4 capas)
   - Puede "Elevar a Asamblea" o "Rechazar"

5. **Asamblea** vota (si fue elevada):
   - Aprobado → `membership_status` cambia a `active`, usuario tiene acceso completo
   - Rechazado → usuario puede enviar defensa (30 dias)

### Notificacion a administradores

Cuando llega una solicitud nueva, el backend busca usuarios con permiso
`admission.manage` y super_admins activos, y les envia una notificacion
in-app con `NotifyMany`:

```
Tipo: admission_request
Titulo: "Nueva solicitud de admision"
Mensaje: "Nueva solicitud de {nombre} ({username}). Revisa y evalua..."
Link: /app/website?tab=admission
```

## Demo vs Produccion

### Archivos
- `cmd/node/main.go` — Configuracion de modo demo
- `internal/api/routes.go` — basePath, proxy de servicios
- `internal/db/demo_seed.go` — Reset y seed de datos demo
- `web/src/hooks/useAuth.ts` — Separacion de sesiones por basePath

### Aislamiento de demo

| Aspecto | Demo | Produccion |
|---------|------|------------|
| basePath | `/demo` | `/main` o `` |
| JWT secret | `demo-jwt-secret` | Variable de entorno `JWT_SECRET` |
| Expiracion JWT | 2 horas | 7 dias |
| localStorage | `fmc_demo_*` | `fmc_main_*` o `fmc_*` |
| Reset automatico | Cada 24 horas | Nunca |
| CORS | `["*"]` | Configurado por `cors_origins` |
| Operaciones mutantes | Bloqueadas (`BlockDemo`) | Permitidas |

### Invariante de seguridad

**Los nodos de produccion NUNCA deben simular.** El modo demo se detecta
por `DEMO_MODE=true` en la configuracion. El middleware `BlockDemo`
impide operaciones mutantes (POST/PUT/PATCH/DELETE) a usuarios con
claim `is_demo = true`.

### Reset de demo

El reset automatico (`db.DemoReset`) limpia las tablas del dominio demo
y re-seedea con datos de ejemplo. Esto asegura que el demo siempre
tenga un estado limpio y predecible.

## Headers HTTP y CORS

### CORS

- Configurado via `config.yaml: cors_origins`
- Permite credenciales (`Access-Control-Allow-Credentials: true`)
- Responde a preflight OPTIONS
- **Demo**: `cors_origins: ["*"]` (permisivo para desarrollo)
- **Produccion**: debe configurarse con los dominios especificos del nodo

### Headers de seguridad (recomendacion)

Actualmente no se envian headers de seguridad HTTP. Se recomienda anadir
en el reverse proxy (Nginx/Caddy) o en un middleware dedicado:

| Header | Funcion |
|--------|---------|
| `Strict-Transport-Security` | Forzar HTTPS |
| `X-Frame-Options: DENY` | Prevenir clickjacking |
| `X-Content-Type-Options: nosniff` | Prevenir MIME sniffing |
| `Content-Security-Policy` | Prevenir XSS y inyeccion |
| `Referrer-Policy` | Controlar referrer |

## Rate Limiting

### Implementado
- **Emparejamiento POS**: 3 solicitudes / 5 min por fingerprint
- **Emparejamiento federado**: 5 intentos fallidos expiran el codigo
- **PIN NFC**: 3 intentos → bloqueo 15 minutos
- **Login**: Intentos fallidos registrados en `audit_log`

### Pendiente
- Rate limiting general de API (`api.rate_limit` en config, no aplicado
  actualmente en middleware global). Se recomienda implementar con
  `golang.org/x/time/rate`.

## Auditoria

### Tabla `audit_log`

Cada evento importante se registra con:
- `actor_id`: Quien realizo la accion
- `action`: Tipo de accion (ej: `admission_approve`, `login_failed`)
- `target_id`: A quien afecta
- `details`: JSONB con detalles del evento
- `ip`, `user_agent`: Metadatos de la peticion
- `created_at`: Timestamp

### Eventos auditados

- Aprobacion/rechazo de admision
- Transferencias entre cuentas
- Toggle de super admin
- Emparejamiento de terminales
- Intentos fallidos de login
- Operaciones de recuperacion de cuenta
- Elevacion a asamblea

### Hash Chain de transacciones

Las transacciones forman una cadena inmutable:
- Cada transaccion tiene `prev_hash` y `current_hash`
- `current_hash = SHA256(prev_hash + tx_data_serializada)`
- Cualquier modificacion altera la cadena y es detectable en auditoria

## Limitaciones Conocidas y Recomendaciones

### Limitaciones actuales

1. **JWT sin revocacion del lado servidor**: El token sigue siendo valido
   hasta su expiracion (7 dias). El logout del frontend solo limpia
   localStorage. Se recomienda implementar una lista de revocacion o
   usar tokens de corta duracion + refresh tokens.

2. **Rate limiting global no implementado**: El campo `api.rate_limit`
   existe en config pero no se aplica en middleware. Solo hay rate
   limit en endpoints especificos (pairing, PIN).

3. **Headers HTTP de seguridad ausentes**: No se envian CSP, HSTS,
   X-Frame-Options, etc. Se recomienda configurarlos en el reverse proxy.

4. **SSL/TLS a BD deshabilitado por defecto**: `ssl_mode=disable` en
   la configuracion por defecto. En produccion se debe usar
   `ssl_mode=require` o `verify-full`.

5. **Sin RLS en la BD**: Toda la autorizacion esta en la aplicacion.
   Se recomienda habilitar Row-Level Security en tablas criticas como
   capa adicional.

6. **Backups sin cifrado**: Los archivos de backup son SQL plano.
   Se recomienda cifrarlos o almacenarlos en ubicacion encriptada.

7. **MIFARE Classic es inherentemente debil**: Crypto1 es vulnerable.
   Los certificados dinamicos mitigan pero no eliminan el riesgo.
   Para alta seguridad, usar DESFire EV3 (AES-128).

### Recomendaciones de produccion

1. **Cambiar `JWT_SECRET`** por un valor aleatorio de >=256 bits.
2. **Habilitar SSL/TLS** en la conexion a la base de datos.
3. **Configurar CORS** con los dominios especificos (no `*`).
4. **Anadir headers de seguridad** en el reverse proxy.
5. **Implementar rate limiting** global de API.
6. **Cifrar backups** antes de almacenarlos.
7. **Rotar claves** del nodo y de terminales periodicamente.
8. **Monitorear `audit_log`** para detectar actividad sospechosa.
9. **Usar DESFire EV3** en lugar de MIFARE Classic cuando sea posible.
10. **Configurar expiracion de sesion** adecuada al contexto de la comunidad.
