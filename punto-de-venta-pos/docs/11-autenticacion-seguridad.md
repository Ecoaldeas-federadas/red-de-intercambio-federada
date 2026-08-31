# Autenticación y Seguridad del POS Android

## Resumen

Este documento describe el flujo completo de autenticación del POS Android: cómo se identifica el terminal, cómo se registra, cómo inicia sesión el comerciante, cómo se auto-renuevan las claves, y cómo se controla qué usuarios pueden usar cada terminal.

---

## 1. Identificación del Terminal

### Terminal ID

El `terminal_id` es determinista y se genera a partir del identificador único del dispositivo:

```
TERM-ANDROID-{primeros 12 caracteres en mayúscula de SHA-256("POS-ANDROID-" + ANDROID_ID)}
```

Esto asegura que el mismo dispositivo genere siempre el mismo `terminal_id`, incluso después de reinstalar la app.

### Claves criptográficas

- **Algoritmo:** Ed25519 (par de claves asimétrico).
- **Generación:** Al primer inicio, si no existe config local, se genera un par nuevo.
- **Almacenamiento:** La clave privada se encripta con Android Keystore (`KeystoreCrypto`) y se guarda en Room DB (`TerminalConfigEntity`).
- **Clave pública:** Se envía al servidor durante el emparejamiento/registro.
- **Server public key:** El servidor devuelve su clave pública, que se guarda localmente para cifrado ECDH.

### Headers HTTP

Cada petición del POS incluye:

| Header | Descripción |
|--------|-------------|
| `Content-Type: application/json` | Tipo de contenido |
| `X-Node-Domain: {host}` | Dominio del nodo |
| `Authorization: Bearer {JWT}` | Token de sesión del usuario (si hay) |
| `X-Terminal-ID: {terminalId}` | ID del terminal |
| `X-Terminal-Public-Key: {pubKey}` | Clave pública del terminal (si hay) |

---

## 2. Emparejamiento / Registro del Terminal

El terminal debe registrarse con el servidor antes de poder usarse. Hay tres métodos:

### 2.1 Emparejamiento por código corto

1. El POS genera un código de 6 caracteres.
2. El administrador del nodo aprueba el emparejamiento desde el panel web.
3. El POS hace polling cada 2s hasta aprobación (timeout 60s + grace period 30s).
4. Al aprobarse, el servidor guarda `terminal_public_key` y devuelve `server_public_key`.

### 2.2 Registro con token UUID

1. El administrador genera un `registration_token` (UUID) desde el panel.
2. El usuario ingresa el token manualmente en el POS.
3. El POS envía el token + `terminal_public_key` al servidor.
4. El servidor valida el token, guarda la clave y devuelve `server_public_key`.

### 2.3 Auto-registro con admin

1. El usuario ingresa credenciales de administrador en el POS.
2. El POS autentica con el backend y registra el terminal automáticamente.

### Estado después del registro

- `isRegistered = true` (local)
- `terminal_public_key` guardada en el servidor
- `server_public_key` guardada localmente
- El terminal aparece en el panel del admin para asignación

---

## 3. Asignación de Terminales

Un terminal puede asignarse a:

| Tipo | Campo en `nfc_terminals` | Quién puede usarlo |
|------|--------------------------|-------------------|
| **Persona específica** | `merchant_user_id` | Solo esa persona |
| **Personas adicionales** | `nfc_terminal_authorized_users` (tabla) | Personas en esa lista |
| **Departamento** | `department_id` (+ `organization_id`) | Miembros del departamento (`department_members`) |
| **Organización** | `organization_id` | Board members de la organización (`organization_board_members`) |
| **Sin asignar** | todos NULL | Cualquier usuario (el admin asigna después) |

### Gestión desde el panel web

Los administradores de la organización pueden:

- **Asignar terminal a una persona:** `POST /api/nfc/org-terminals/{orgID}/{terminalID}/assign-user`
- **Asignar terminal a un departamento:** `POST /api/nfc/org-terminals/{orgID}/{terminalID}/assign-dept`
- **Agregar persona autorizada:** `POST /api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users`
- **Quitar persona autorizada:** `DELETE /api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users/{userID}`
- **Listar personas autorizadas:** `GET /api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users`
- **Activar/desactivar terminal:** `POST /api/nfc/org-terminals/{orgID}/{terminalID}/toggle`

### Reasignación

- Se puede quitar el terminal a una persona y dárselo a otra en cualquier momento.
- Se pueden agregar múltiples personas al mismo terminal.
- Se puede asignar a un departamento completo (todos sus miembros pueden usarlo).
- La reasignación es inmediata — el próximo login verifica la autorización.

---

## 4. Login del Comerciante

### Flujo

1. El usuario ingresa **usuario** y **contraseña** en la pantalla de Login.
2. El POS envía `POST /api/auth/login/password` con:
   - Body: `{"username": "...", "password": "..."}`
   - Headers: `X-Terminal-ID`, `X-Terminal-Public-Key`
3. El backend verifica:
   - **Credenciales:** username (case-insensitive) + password (bcrypt).
   - **Terminal registrado:** el `terminal_id` existe y está activo.
   - **Claves del terminal:** la `terminal_public_key` del header coincide con la BD.
   - **Autorización:** el usuario tiene permiso para usar este terminal.
4. Si todo es válido, devuelve `{"token": "JWT", "user_id": "...", ...}`.
5. El POS guarda el JWT en Room (`sessionToken`) y en memoria (`apiClient.authToken`).

### Verificación de autorización

El backend verifica si el usuario está autorizado en este orden:

1. `merchant_user_id == userID` → **autorizado**
2. Existe en `nfc_terminal_authorized_users` → **autorizado**
3. `department_id` no es NULL y el usuario está en `department_members` → **autorizado**
4. `organization_id` no es NULL y el usuario está en `organization_board_members` → **autorizado**
5. Todos los campos de asignación son NULL → **autorizado** (sin asignar, admin asigna después)
6. Ninguno de los anteriores → **403 `not_authorized_for_terminal`**

### Respuestas de error

| Código | Error | Significado |
|--------|-------|-------------|
| 401 | `invalid credentials` | Usuario o contraseña incorrectos |
| 403 | `terminal_not_registered` | El terminal no existe o está inactivo |
| 403 | `not_authorized_for_terminal` | El usuario no tiene permiso para este terminal |
| 403 | `web_session_expired` | Sesión web expirada (solo terminales web) |

---

## 5. Auto-renovación de Claves del Terminal

### Cuándo ocurre

Cuando las claves del terminal se pierden (app reinstalada, datos borrados, migración de dispositivo) pero el terminal sigue registrado en el servidor.

### Detección

El backend detecta el mismatch cuando la `X-Terminal-Public-Key` del header no coincide con la `terminal_public_key` de la BD.

### Flujo seguro de auto-renovación durante login

1. El usuario ingresa usuario + contraseña en el POS.
2. El POS envía el login con la nueva `terminal_public_key` (generada localmente).
3. El backend detecta **key mismatch** pero **NO rechaza inmediatamente**.
4. El backend verifica las credenciales (username + password).
5. El backend verifica la autorización (merchant_user_id, authorized_users, departamento, organización).
6. Si el usuario está autorizado:
   - **Auto-renueva:** `UPDATE nfc_terminals SET terminal_public_key = nueva_clave`
   - Devuelve `{"token": "JWT", "keys_renewed": true, "server_public_key": "..."}`
7. Si no está autorizado → **403 `not_authorized_for_terminal`**

### Flujo de auto-renovación con sesión activa (endpoint `/auto-renew`)

Si el usuario ya está logueado y el heartbeat detecta key mismatch:

1. El POS llama `POST /api/nfc/terminal/auto-renew` con JWT.
2. El backend verifica:
   - **JWT válido** (usuario logueado)
   - **`merchant_user_id == userID`** o usuario en `nfc_terminal_authorized_users`
   - **`device_fingerprint`** coincide
3. Si todo es válido, actualiza `terminal_public_key` y devuelve `server_public_key`.
4. Si no → 401 (sin JWT) o 403 (no autorizado).

### Requisitos de seguridad

- **Siempre** se verifica la contraseña (bcrypt) antes de renovar.
- **Siempre** se verifica la autorización del usuario.
- Un terminal falsificado sin credenciales válidas **no puede** renovar claves.
- Un usuario no autorizado **no puede** renovar claves.
- El `device_fingerprint` es una verificación adicional en el endpoint `/auto-renew`.

---

## 6. Sesión JWT

### Persistencia

- El JWT se guarda en Room DB (`TerminalConfigEntity.sessionToken`).
- Al reiniciar la app, se restaura automáticamente desde Room.
- El `apiClient.authToken` (en memoria) se sincroniza con `sessionToken`.

### Verificación al iniciar la app

1. Se lee `sessionToken` de Room.
2. Si existe, se restaura `apiClient.authToken`.
3. Se llama `fetchCurrentUser()` para verificar con el servidor que el JWT sigue válido.
4. Si el servidor responde **401** → sesión expirada → mostrar pantalla de Login.
5. Si el servidor responde **OK** → `isLoggedIn = true` → mostrar Dashboard.

### Verificación periódica

Cada 60 segundos, el heartbeat periódico:

1. Si `isLoggedIn` → llama `fetchCurrentUser()`.
2. Si 401 → `isLoggedIn = false`, `currentScreen = Login`, "Sesión expirada".
3. Si OK → mantiene estado.

### Logout

- Borra `sessionToken` de Room.
- Limpia `apiClient.authToken` (memoria).
- Limpia `currentUser`.
- Envía a pantalla de Login.

---

## 7. Heartbeat Periódico

Cada 60 segundos, si el terminal está registrado:

1. **Verificar sesión JWT** (si hay usuario logueado):
   - `fetchCurrentUser()` → si 401, sesión expirada → Login.
2. **Verificar terminal**:
   - `heartbeat()` envía `terminal_id` + `terminal_public_key`.
   - Si `notFound = true` → terminal eliminado del servidor → RegisterTerminal.
   - Si `keyMatches = false` → key mismatch → `handleKeyMismatch()`.
   - Si `active = false` → terminal desactivado → mostrar error.

---

## 8. Matriz de Decisiones

| Terminal registrado | Claves válidas | Sesión JWT válida | Pantalla mostrada |
|---------------------|----------------|-------------------|-------------------|
| No | — | — | RegisterTerminal |
| Sí | Sí | Sí | Dashboard |
| Sí | Sí | No | Login |
| Sí | No | Sí | Auto-renovar vía `/auto-renew` → Dashboard |
| Sí | No | No | Login (al iniciar sesión, auto-renueva) |
| Sí | No | No (renovación falla) | RegisterTerminal |

---

## 9. Seguridad

### Prevención de falsificación de terminal

- Un terminal falsificado no tiene el `terminal_id` correcto → `terminal_not_registered`.
- Un terminal falsificado con `terminal_id` correcto pero clave incorrecta → key mismatch.
- Key mismatch sin credenciales válidas → no se puede auto-renovar.
- Key mismatch con credenciales válidas pero usuario no autorizado → `not_authorized_for_terminal`.

### Defensa en profundidad

1. **JWT** — verifica identidad del usuario.
2. **Autorización** — verifica que el usuario tiene permiso para el terminal.
3. **Claves del terminal** — verifica identidad criptográfica del terminal.
4. **Device fingerprint** — verifica identidad física del dispositivo (en `/auto-renew`).
5. **Bcrypt** — verifica contraseña del usuario.

### Lo que NO se expone

- Claves privadas del terminal (encriptadas con Keystore, nunca salen del dispositivo).
- JWT (solo se envía en header `Authorization`, nunca se loguea).
- Contraseñas (solo se envían al login, nunca se persisten).
- Payloads desencriptados (solo en memoria durante la transacción).

---

## 10. Nota sobre el POS ESP32

El POS ESP32 es diferente:

- El usuario se **pre-graba** al flashear el dispositivo.
- **No vence** — no hay JWT ni sesión que expira.
- El dispositivo físico se **presta** de una persona a otra.
- No tiene controles de login/logout.
- Está diseñado para ser **súper sencillo**.

El ESP32 POS está en desarrollo y no se ha probado en producción todavía. Los cambios descritos en este documento aplican **solo al POS Android**.

---

## Endpoints Relevantes

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login/password` | Login del comerciante | Público |
| GET | `/api/auth/me` | Obtener usuario actual | JWT |
| POST | `/api/nfc/terminal/auto-renew` | Auto-renovar claves del terminal | JWT |
| POST | `/api/nfc/terminal/heartbeat` | Heartbeat del terminal | Público |
| POST | `/api/nfc/org-terminals/{orgID}/{terminalID}/assign-user` | Asignar terminal a persona | JWT |
| POST | `/api/nfc/org-terminals/{orgID}/{terminalID}/assign-dept` | Asignar terminal a departamento | JWT |
| GET | `/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users` | Listar personas autorizadas | JWT |
| POST | `/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users` | Agregar persona autorizada | JWT |
| DELETE | `/api/nfc/org-terminals/{orgID}/{terminalID}/authorized-users/{userID}` | Quitar persona autorizada | JWT |
| POST | `/api/nfc/org-terminals/{orgID}/{terminalID}/toggle` | Activar/desactivar terminal | JWT |

## Tablas de Base de Datos Relevantes

| Tabla | Descripción |
|-------|-------------|
| `nfc_terminals` | Terminales registrados |
| `nfc_terminal_authorized_users` | Personas adicionales autorizadas por terminal |
| `nfc_terminal_sessions` | Sesiones activas de terminal |
| `department_members` | Miembros de departamentos |
| `organization_board_members` | Board members de organizaciones |
| `user_credentials` | Credenciales (password hash) de usuarios |
