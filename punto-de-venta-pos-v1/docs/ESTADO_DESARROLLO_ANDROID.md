# Documento de Verificación — POS Android, POS Web y Backend

## Propósito

Este documento describe **todo lo que se hizo** y **todo lo que se debía hacer** en el sistema, para que la plataforma que compile el proyecto Android pueda:

1. Verificar que cada item quedó bien hecho
2. Corregir lo que no haya quedado bien hecho
3. Entender cómo el servidor espera la información y cómo la manda

Como la otra plataforma no tiene acceso al código del servidor, este documento incluye **todos los endpoints, formatos de request/response, y comportamientos esperados**.

> **Documento maestro:** Este archivo es la fuente autoritativa del estado actual. Los documentos numerados (01-10) contienen la arquitectura de referencia; este archivo contiene los **cambios recientes** y la **verificación pendiente**.

---

## 1. PIN del Turno — El problema corregido

### Lo que estaba mal (ANTES)

- El POS Android **creaba su propio PIN local** (SHA-256 en `ShiftPinEntity`)
- Cada vez que entrabas, **te pedía crear un PIN nuevo** si no había uno local
- El PIN local **no tenía nada que ver** con el PIN del backend
- `openShift` y `closeShift` **no enviaban el PIN** al backend
- El turno se abría/cerraba **localmente sin importar** lo que dijera el backend
- El punto **funcionaba aunque no estuviera abierto**

### Lo que se corrigió (DESPUÉS)

- El POS Android **NO crea PIN local**
- Al entrar a "Abrir/Cerrar Punto", consulta al backend si el dueño configuró el PIN
- Si **no está configurado**: muestra mensaje "El dueño del terminal debe configurar el PIN del turno desde su panel web"
- Si **está configurado**: pide el PIN y lo **verifica contra el backend**
- Al abrir/cerrar turno, **envía el PIN al backend**
- Si el backend **rechaza** (PIN incorrecto, no configurado, ya hay turno abierto), **no se abre/cierra localmente**
- El POS ya no tiene `setShiftPin` — solo el dueño puede configurar el PIN desde el panel web

### Endpoints del backend para PIN del turno

#### `GET /api/nfc/my-terminals/{id}/shift-pin/configured`
- **Auth:** JWT del usuario
- **Response 200:** `{ "configured": true }` o `{ "configured": false }`
- **Uso:** El POS lo llama al entrar a la pantalla de turnos para saber si hay PIN

#### `POST /api/nfc/my-terminals/{id}/shift-pin/verify`
- **Auth:** JWT del usuario
- **Request body:** `{ "pin": "1234" }`
- **Response 200 (válido):** `{ "valid": true, "configured": true }`
- **Response 200 (incorrecto):** `{ "valid": false, "configured": true, "message": "PIN incorrecto" }`
- **Response 200 (no configurado):** `{ "valid": false, "configured": false, "message": "el dueño del terminal no ha configurado el PIN del turno" }`
- **Uso:** El POS verifica el PIN antes de mostrar las opciones de abrir/cerrar

#### `POST /api/nfc/my-terminals/{id}/shift-pin`
- **Auth:** JWT del usuario — **solo el dueño** (`merchant_user_id`)
- **Request body:** `{ "pin": "1234" }` (4-32 caracteres)
- **Response 200:** `{ "status": "configured", "message": "PIN del turno configurado correctamente" }`
- **Response 404:** `"terminal not found or you are not the owner"`
- **Uso:** Lo usa el panel web (`MyTerminals.tsx`), NO el POS Android

#### `POST /api/nfc/my-terminals/{id}/shift`
- **Auth:** JWT del usuario
- **Request body:** `{ "opening_amount": 50000, "notes": "Apertura", "pin": "1234" }`
- **Response 201:** `{ "shift_id": "uuid", "status": "open", "opening_amount": 50000 }`
- **Response 400:** `"el dueño del terminal debe configurar el PIN del turno desde su panel web"`
- **Response 400:** `"pin is required to open shift"`
- **Response 400:** `"there is already an open shift - close it first"`
- **Response 403:** `"PIN del turno incorrecto"`
- **Uso:** Abrir turno. El PIN se verifica con bcrypt contra `nfc_terminals.shift_pin_hash`

#### `POST /api/nfc/my-terminals/{id}/shift/close`
- **Auth:** JWT del usuario
- **Request body:** `{ "closing_amount": null, "notes": "Cierre", "pin": "1234" }`
- **Response 200:** `{ "status": "closed", "opening_amount": ..., "total_sales": ..., "transactions_count": ..., "expected_close": ... }`
- **Response 400:** `"el dueño del terminal no ha configurado el PIN del turno"`
- **Response 403:** `"PIN del turno incorrecto"`
- **Uso:** Cerrar turno. El PIN se verifica con bcrypt

#### `GET /api/nfc/my-terminals/{id}/shift`
- **Auth:** JWT del usuario
- **Response 200 (con turno activo):** `{ "active": true, "shift_id": "...", "status": "open", "opened_at": "...", "opening_amount": ..., "total_sales": ..., "transactions_count": ..., "expected_close": ... }`
- **Response 200 (sin turno):** `{ "active": false }`
- **Uso:** Consultar turno activo

#### `GET /api/nfc/my-terminals/{id}/shifts?from=2024-01-01&to=2024-12-31`
- **Auth:** JWT del usuario
- **Query params:** `from` (YYYY-MM-DD, opcional), `to` (YYYY-MM-DD, opcional)
- **Response 200:** Array de `ShiftHistoryItem`
- **Sin LIMIT artificial** — devuelve todos los turnos en el rango (máximo 1 año por defecto)
- **Uso:** Historial de turnos del terminal

### ShiftHistoryItem (formato JSON)
```json
{
  "id": "uuid",
  "user_name": "juan",
  "status": "closed",
  "opened_at": "2024-01-15T10:30:00Z",
  "closed_at": "2024-01-15T18:00:00Z",
  "opening_amount": 50000,
  "closing_amount": 55000,
  "total_sales": 5000,
  "transactions_count": 3,
  "notes": "Apertura de punto"
}
```

---

## 2. Exportación/Importación CSV — Solo backend

### Lo que se debía hacer

- La **exportación CSV** se hace desde el **backend** (panel web), NO desde el POS Android
- El POS Android **solo muestra el historial** consultando al backend
- El POS Android **no exporta archivos CSV**

### Lo que se corrigió

- Se **eliminaron** los endpoints CSV de `PosApiService.kt`
- Se **eliminaron** los métodos `exportTransactionsCsv`, `exportShiftsCsv` de `PosRepository.kt`
- Se **eliminaron** los métodos `exportTransactionsCsv`, `exportShiftsCsv` de `PosViewModel.kt`
- Se **eliminaron** los botones de exportación de `ShiftManagementScreen.kt`
- El POS Android solo tiene **visor de historial** (consulta al backend)

### Endpoints CSV del backend (para el panel web, NO Android)

#### `GET /api/nfc/my-terminals/{id}/export/transactions?from=&to=`
- **Auth:** JWT del usuario
- **Response:** CSV plano (text/csv)
- **Campos:** ID, UID tarjeta, monto (centavos), estado, PIN verificado, tipo, error, fecha/hora

#### `GET /api/nfc/my-terminals/{id}/export/shifts?from=&to=`
- **Auth:** JWT del usuario
- **Response:** CSV plano (text/csv)
- **Campos:** ID, usuario, estado, apertura, cierre, monto apertura, monto cierre, ventas, transacciones, notas

---

## 3. Flujo NFC Username-First

### Lo que se debía hacer

Cambiar el flujo de "documento + PIN primero para todos" a:

1. **Monto**
2. **Username** (con `@nodo` para usuarios remotos)
3. **Lookup de usuario** → servidor responde si requiere documento
4. **Documento** — **solo si** `requires_document = true` (tarjeta Classic)
5. **PIN**
6. **Tap card** (NFC)
7. **Classic**: leer sector, verificar certificado, escribir nuevo certificado, confirmar
8. **UID/DESFire**: procesar pago normal

### Endpoints del backend para NFC

#### `POST /api/nfc/terminal/user-lookup`
- **Auth:** Terminal auth (cifrado Ed25519 + AES-GCM)
- **Request (cifrado):** `{ "terminal_id": "...", "username": "juan" }`
- **Response (cifrado):**
```json
{
  "found": true,
  "user_id": "uuid",
  "card_type": "classic",
  "requires_document": true,
  "required_doc_type": "cedula",
  "document_types": ["cedula", "dni"],
  "display_name": "Juan Pérez",
  "is_remote": false
}
```
- Si `requires_document = false` (UID/DESFire): no pedir documento
- Si `requires_document = true` (Classic): pedir documento del tipo `required_doc_type`
- Soporta usuarios remotos con `@nodo` (federation user lookup)

#### `POST /api/nfc/terminal/classic/pre-auth`
- **Auth:** Terminal auth (cifrado)
- **Request (cifrado):** `{ "terminal_id": "...", "username": "juan", "pin": "1234", "amount": 50000 }`
- **Para:** UID-only y DESFire (sin documento)
- **Response (cifrado):**
```json
{
  "pre_approved": true,
  "card_uid": "04A3B2C1",
  "card_type": "uid_only",
  "message": ""
}
```
- Si `pre_approved = false`: mostrar `message` y volver al PIN

#### `POST /api/nfc/terminal/classic/pre-auth-document`
- **Auth:** Terminal auth (cifrado)
- **Request (cifrado):** `{ "terminal_id": "...", "username": "juan", "doc_type": "cedula", "doc_number": "12345678", "pin": "1234", "amount": 50000 }`
- **Para:** Classic (con documento)
- **Response (cifrado):**
```json
{
  "pre_approved": true,
  "card_uid": "04A3B2C1",
  "card_type": "classic",
  "read_sector": 5,
  "read_key_a": "aabbccddeeff",
  "expected_certificate": "11223344556677889900aabbccddeeff",
  "write_sector": 10,
  "write_key_b": "112233445566",
  "new_certificate": "ffeeddccbbaa99887766554433221100",
  "message": ""
}
```

#### `POST /api/nfc/terminal/classic/confirm`
- **Auth:** Terminal auth (cifrado)
- **Request (cifrado):** `{ "terminal_id": "...", "card_uid": "04A3B2C1", "read_ok": true, "write_ok": true, "written_blocks": 3 }`
- **Response (cifrado):** `{ "status": "approved", "transaction_id": "...", "message": "..." }`
- **Importante:** Si `read_ok` o `write_ok` son false, el backend **NO finaliza** el pago

#### `POST /api/nfc/terminal/payment`
- **Auth:** Terminal auth (cifrado)
- **Request (cifrado):** `{ "terminal_id": "...", "card_uid": "...", "pin": "1234", "amount": 50000, "card_type": "uid_only", "id_doc_type": "cedula", "id_doc_number": "12345678" }`
- **Response (cifrado):**
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "message": "Pago aprobado"
}
```
- Otros estados: `"pending_multisig"` (con `required_sigs`, `collected_sigs`, `pending_id`), `"rejected"`

### Step numbering en Android

**Classic (requiresDocument = true):**
- Step 1: Monto
- Step 2: Username
- Step 3: Documento
- Step 4: PIN
- Step 5: Tap card

**UID/DESFire (requiresDocument = false):**
- Step 1: Monto
- Step 2: Username
- Step 3: PIN
- Step 4: Tap card

---

## 4. Aislamiento Demo por Nodo

### Lo que se debía hacer

- El modo demo **solo se activa** cuando la URL del servidor contiene `/demo`
- El nodo real (`/main`) **nunca** muestra botones de simulación
- Las simulaciones **no tocan el servidor real**

### Cómo funciona

- `PosApiClient.isDemoNode` → `serverUrl.contains("/demo")`
- `PosUiState.isDemoNode` se setea al cambiar la URL
- En `PosViewModel`:
  - `submitUserLookup()`: si `isDemoNode`, llama a `simulateUserLookup()` en vez del backend
  - `submitUnifiedPreAuth()`: si `isDemoNode`, llama a `simulatePreAuth()` en vez del backend
  - `onCardTapped()`: si `isDemoNode` y es Classic, llama a `simulateClassicCardWrite()`
  - `submitMultiVendorPayment()`: si `isDemoNode` y falla, simula éxito
- En `NfcChargeScreen.kt`: botones "Simular" solo si `uiState.isDemoNode`
- En `DashboardScreen.kt`: banner "Modo Demostración" solo si `uiState.isDemoNode`

**Esto ya estaba correctamente implementado. No requiere cambios.**

---

## 5. Retención de datos (backend)

### Endpoints del backend (admin, requiere permiso `config.manage`)

#### `GET /api/nfc/retention/config`
- **Response 200:** `{ "retention_days": 365, "enabled": true, "last_purge_at": "..." }`

#### `PUT /api/nfc/retention/config`
- **Request:** `{ "retention_days": 180, "enabled": true }`
- **Response 200:** `{ "retention_days": 180, "enabled": true }`

#### `POST /api/nfc/retention/purge`
- **Response 200:** `{ "status": "purged", "cutoff_date": "..." }`

El retention purger está iniciado en `cmd/node/main.go` y purge automático cada 24 horas.

---

## 6. Archivos modificados en Android

### `PosApiService.kt`
- **Eliminados:** endpoints CSV (`exportTransactionsCsv`, `exportShiftsCsv`), imports `ResponseBody` y `Streaming`
- **Existentes:** `openShift`, `closeShift` (con campo `pin`), `verifyShiftPin`, `getShiftPinConfigured`, `listShifts`

### `PosRepository.kt`
- **Modificado `openShift`:** ahora recibe `pin: String`, envía al backend, si el backend rechaza no abre localmente
- **Modificado `closeShift`:** ahora recibe `pin: String`, envía al backend, si el backend rechaza no cierra localmente
- **Modificado `verifyShiftPin`:** ahora verifica contra el backend (no hash local)
- **Modificado `hasShiftPin`:** ahora consulta `getShiftPinConfigured` al backend
- **Eliminado `setShiftPin`:** el POS no puede crear PIN (solo el dueño desde el web)
- **Eliminados:** `exportTransactionsCsv`, `exportShiftsCsv`, `exportTransactionsForCurrentTerminal`, `exportShiftsForCurrentTerminal`, `hashPin`
- **Mantenido:** `listShiftsForCurrentTerminal` (consulta al backend)

### `PosViewModel.kt`
- **Modificado `openShift`:** ahora recibe `pin: String` y lo pasa al repository
- **Modificado `closeShift`:** ahora recibe `pin: String` y lo pasa al repository
- **Modificado `verifyShiftPin`:** ahora recibe `callback: (Boolean, String?)` (success + error message)
- **Eliminado `setShiftPin`:** ya no existe
- **Eliminados:** `exportTransactionsCsv`, `exportShiftsCsv`
- **Mantenido:** `loadShiftHistory` (consulta al backend)

### `ShiftManagementScreen.kt`
- **Reescrito completamente:**
  - Al entrar, consulta al backend si hay PIN configurado (`hasShiftPin`)
  - Si no hay PIN: muestra mensaje "El dueño debe configurar el PIN desde el panel web"
  - Si hay PIN: pide el PIN y lo verifica contra el backend (`verifyShiftPin`)
  - Al abrir turno: pide monto + PIN, envía ambos al backend
  - Al cerrar turno: pide PIN, lo envía al backend
  - Botón "Historial": consulta turnos al backend con filtro de fechas
  - Vista de detalle de turno seleccionado
  - **Sin exportación CSV** (eso es del backend)
  - **Sin crear PIN local**

---

## 7. Posibles errores de compilación

### Imports innecesarios
Si el compilador marca imports no usados, eliminar:
- `import com.example.data.db.ShiftPinEntity` (si ya no se usa)
- `import com.example.data.db.ShiftPinDao` (si ya no se usa)
- Cualquier import de `ResponseBody` o `Streaming`

### `shiftPinDao` no usado
Si `PosRepository` ya no usa `shiftPinDao` (porque se eliminó `setShiftPin` y `hashPin`), puede marcarlo como no usado. Se puede dejar (no causa error) o eliminar la línea:
```kotlin
val shiftPinDao: ShiftPinDao = database.shiftPinDao()
```

### Colores del tema
Todos los colores usados existen en `Color.kt`:
`PosNavyDark`, `PosSlate900`, `PosSlate800`, `PosSlate100`, `PosSlate300`, `PosSlate400`, `PosSlate600`, `PosGoldLight`, `PosPrimaryBlue`, `PosPrimaryLight`, `PosErrorRed`, `PosErrorRedLight`, `PosSuccessGreen`

### `KioskNumericKeypad`
Existe en `com.example.ui.components.KioskComponents.kt`

### `ShiftHistoryItem`
Existe en `com.example.data.api.PosApiModels.kt` (package `com.example.data.api`)

---

## 8. Verificación recomendada

Al compilar en la otra plataforma:

1. **Compilar** — `./gradlew assembleDebug` o equivalente
2. **Corregir imports** — eliminar imports no usados
3. **Probar flujo de PIN:**
   - Sin PIN configurado en el backend → debe mostrar "El dueño debe configurar el PIN"
   - Con PIN configurado → debe pedir PIN y verificar contra el backend
   - PIN incorrecto → debe mostrar "PIN incorrecto"
   - PIN correcto → debe mostrar opciones de abrir/cerrar
4. **Probar abrir turno:**
   - Ingresar monto + PIN
   - Si el backend acepta → turno se abre localmente
   - Si el backend rechaza (PIN incorrecto) → NO se abre localmente, mostrar error
5. **Probar cerrar turno:**
   - Ingresar PIN
   - Si el backend acepta → turno se cierra localmente
   - Si el backend rechaza → NO se cierra localmente, mostrar error
6. **Probar historial:**
   - Botón "Historial" → debe cargar turnos del backend
   - Filtrar por fechas → debe funcionar
   - Seleccionar un turno → debe mostrar detalle
7. **Probar aislamiento demo:**
   - Conectar a `/demo` → simulaciones activadas
   - Conectar a `/main` → sin simulaciones

---

## 9. Estado del backend (Go)

El backend ya tiene todos los endpoints implementados y `go build ./...` pasa correctamente:

- `POST /api/nfc/my-terminals/{id}/shift` — abrir turno con PIN (bcrypt)
- `POST /api/nfc/my-terminals/{id}/shift/close` — cerrar turno con PIN (bcrypt)
- `GET /api/nfc/my-terminals/{id}/shift` — turno activo
- `POST /api/nfc/my-terminals/{id}/shift-pin` — configurar PIN (solo dueño)
- `POST /api/nfc/my-terminals/{id}/shift-pin/verify` — verificar PIN
- `GET /api/nfc/my-terminals/{id}/shift-pin/configured` — consultar si hay PIN
- `GET /api/nfc/my-terminals/{id}/shifts?from=&to=` — historial de turnos
- `GET /api/nfc/my-terminals/{id}/export/transactions?from=&to=` — CSV transacciones
- `GET /api/nfc/my-terminals/{id}/export/shifts?from=&to=` — CSV turnos
- `POST /api/nfc/terminal/user-lookup` — lookup de usuario (cifrado)
- `POST /api/nfc/terminal/classic/pre-auth` — pre-auth UID/DESFire (cifrado)
- `POST /api/nfc/terminal/classic/pre-auth-document` — pre-auth Classic (cifrado)
- `POST /api/nfc/terminal/classic/confirm` — confirmar Classic (cifrado)
- `GET /api/nfc/retention/config` — configuración de retención
- `PUT /api/nfc/retention/config` — actualizar retención (admin)
- `POST /api/nfc/retention/purge` — purga manual (admin)

Migraciones de base de datos:
- `140_classic_required_doc_type.sql` — campo `required_doc_type` en `nfc_cards`
- `141_terminal_shift_pin.sql` — campo `shift_pin_hash` en `nfc_terminals`
- `142_shift_transaction_indexes.sql` — índices para `pos_shifts` y `nfc_transactions`
- `143_pos_retention_config.sql` — tabla `pos_retention_config`

El retention purger está iniciado en `cmd/node/main.go` y purge automático cada 24 horas.

Las transacciones cross-node ahora registran entradas en el nodo receptor (débito del pool + crédito al receptor local + tax).

---

## 10. Estado del POS Web (`pos/`)

Compila correctamente (`npm run build` pasa):
- `NFCScreen.tsx` — flujo username-first completo
- `ShiftScreen.tsx` — gestión de turnos con PIN, historial, export CSV
- `api.ts` — todos los endpoints

---

## 11. Estado del panel web (`web/`)

Compila correctamente (`npm run build` pasa):
- `MyTerminals.tsx` — configuración de PIN del turno, historial, export CSV
- `OrganizationDetail.tsx` — historial de turnos y transacciones

---

## Resumen de lo que NO debe hacer el POS Android

1. **NO crear PIN local** — el PIN lo configura el dueño desde el panel web
2. **NO exportar CSV** — la exportación es del backend/panel web
3. **NO abrir/cerrar turno sin PIN** — el backend requiere PIN (online) o el hash local (offline)
4. **NO ignorar la respuesta del backend** — si el backend rechaza, no abrir/cerrar localmente
5. **NO mostrar simulaciones en nodo real** — solo en `/demo`

---

## 12. Modo offline — PIN del turno y cierre de punto

### Diseño

El POS Android soporta operación limitada sin conexión a internet:

| Operación | Online | Offline |
|-----------|--------|---------|
| Verificar PIN del turno | Backend (bcrypt) + actualiza caché local | Hash local caché (SHA-256) |
| Abrir punto | Backend autoriza (requiere PIN) | **NO permitido** |
| Cerrar punto | Backend autoriza (requiere PIN) | **Permitido** — guarda local, sincroniza después |
| Ver transacciones locales | Room DB | Room DB |
| Ver historial de turnos (backend) | Backend | **NO disponible** (sin conexión) |
| Reabrir punto | Permitido (si no hay pendiente) | **Bloqueado** hasta sincronizar cierre pendiente |

### Caché del hash del PIN

- Cuando la verificación online es exitosa, el POS computa `SHA-256(salt + pin)` y lo guarda en Room (`ShiftPinEntity`)
- Cuando no hay conexión, el POS verifica el PIN contra este hash local
- El hash se actualiza **cada vez** que la verificación online es exitosa (por si el dueño cambió el PIN)
- El PIN original **nunca** se guarda — solo el hash

### Cierre offline

1. El operador ingresa el PIN
2. El POS verifica el PIN contra el hash local (offline)
3. Si es válido: marca el turno como `status = "closed"`, `pendingSync = true`, `closedOffline = true` en Room
4. Los datos del cierre (timestamp, monto, notas) se guardan localmente

### Sincronización de cierre offline

Cuando se recupera la conexión:
1. El POS llama a `POST /api/nfc/my-terminals/{id}/shift/sync-close` (no requiere PIN, usa JWT auth)
2. El backend cierra el turno en la base de datos con el timestamp del cierre offline
3. El POS marca `pendingSync = false` en Room

### Resolución de conflictos: doble cierre

**Escenario:** El POS cierra offline a la hora T1, y un admin cierra desde el panel web a la hora T2. Ninguno sabe del otro porque no hay conexión.

**Regla:** El cierre del POS **prevalece** porque el POS es donde están las transacciones.

**Cómo funciona:**

1. **POS cerró offline, backend todavía abierto:**
   - Al sincronizar, el backend cierra el turno con los datos del POS (timestamp, monto, notas)
   - Respuesta: `"synced": true, "conflict_resolved": false`

2. **POS cerró offline, backend ya cerró (conflicto):**
   - Al sincronizar, el backend **reemplaza** sus datos de cierre con los del POS
   - El `closed_at`, `closing_amount`, `notes` del POS reemplazan los del backend
   - Respuesta: `"synced": true, "conflict_resolved": true, "message": "Cierre del POS prevaleció sobre el cierre del backend"`

3. **Backend cerró primero, POS todavía abierto (sin cierre pendiente):**
   - Al recuperar conexión, el POS detecta que el backend ya cerró (`checkBackendShiftStatus`)
   - El POS descarga los datos de cierre del backend y actualiza su estado local
   - El turno local se marca como cerrado con los datos del backend

**Endpoint del backend para sync-close (con resolución de conflictos):**

#### `POST /api/nfc/my-terminals/{id}/shift/sync-close`
- **Auth:** JWT del usuario
- **No requiere PIN** — usa la autenticación JWT del terminal
- **Resolución de conflictos:** Si el turno ya fue cerrado en el backend, los datos del POS prevalecen
- **Request body:**
```json
{
  "closed_at": 1705320000,
  "closing_amount": 55000,
  "notes": "Cierre offline"
}
```
- **Response 200 (sin conflicto):**
```json
{
  "status": "closed",
  "opening_amount": 50000,
  "total_sales": 5000,
  "transactions_count": 3,
  "expected_close": 55000,
  "synced": true,
  "conflict_resolved": false
}
```
- **Response 200 (conflicto resuelto — POS prevaleció):**
```json
{
  "status": "closed",
  "opening_amount": 50000,
  "total_sales": 5000,
  "transactions_count": 3,
  "expected_close": 55000,
  "synced": true,
  "conflict_resolved": true,
  "message": "Cierre del POS prevaleció sobre el cierre del backend"
}
```
- **Response 400:** `"no shift found for this terminal"`

- Si hay un turno con `pendingSync = true`, el botón "Abrir Punto" está deshabilitado
- El operador debe sincronizar el cierre pendiente antes de poder abrir un nuevo turno
- Hay un botón "Sincronizar ahora" en la pantalla de turnos

### Endpoint del backend para sync-close

#### `POST /api/nfc/my-terminals/{id}/shift/sync-close`
- **Auth:** JWT del usuario
- **No requiere PIN** — usa la autenticación JWT del terminal
- **Request body:**
```json
{
  "closed_at": 1705320000,
  "closing_amount": 55000,
  "notes": "Cierre offline"
}
```
- **Response 200:**
```json
{
  "status": "closed",
  "opening_amount": 50000,
  "total_sales": 5000,
  "transactions_count": 3,
  "expected_close": 55000,
  "synced": true
}
```
- **Response 400:** `"no open shift to sync"` (el turno ya fue cerrado en el backend)

### Cambios en Room (migración 3→4)

`ShiftEntity` tiene dos campos nuevos:
- `pendingSync: Boolean` — true si el cierre se hizo offline y falta sincronizar
- `closedOffline: Boolean` — true si el cierre se hizo sin conexión

```kotlin
val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 0")
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN closedOffline INTEGER NOT NULL DEFAULT 0")
    }
}
```

Versión de Room: **4** (era 3)
