# Pagos

## Archivos
- `internal/payments/payments.go` - Logica de pagos QR, NFC, manual
- `internal/payments/nfc_terminal.go` - Modulo de terminales NFC ESP32
- `internal/crypto/terminal_crypto.go` - Criptografia de terminales (Ed25519, ECDH, AES-GCM)
- `internal/api/payments.go` - Handlers API REST
- `internal/api/nfc_terminal.go` - Handlers API NFC terminales
- `web/src/pages/Payments.tsx` - Frontend con tabs QR/NFC/Manual
- `web/src/pages/NFCTerminals.tsx` - Frontend gestion terminales NFC
- `pos/` - POS Web (React/Vite) — punto de venta web
- `punto-de-venta-pos/` - POS Android (Kotlin/Jetpack Compose) — punto de venta Android
- `firmware/` - Firmware ESP32 para terminales NFC

## Puntos de Venta

Hay **2 puntos de venta** (POS) en el sistema:

| | POS Android | POS Web |
|---|---|---|
| Directorio | `punto-de-venta-pos/` | `pos/` |
| Stack | Kotlin + Jetpack Compose | React + TypeScript + Vite |
| Auth | Emparejamiento por codigo corto (Ed25519 persistente) | 3 niveles (admin → dueno → sesion temporal) |
| NFC | Nativo (MIFARE Classic, DESFire, UID) | Web NFC API + lector Bluetooth |
| QR | Si | Si |
| Multisig | Si | Si |

**Importante:** El panel web (`web/`) **no** es un POS. Es el panel de gestion del usuario. El POS Web (`pos/`) es exclusivamente para cobros. La pagina `/pay?token=...` que se abre al escanear un QR no es un POS tampoco — es solo la pagina de confirmacion del pago.

## Tipos de Pago

### 1. Pago QR

#### Flujo de cargo QR (POS Android y POS Web)

El POS genera una carga (charge) y muestra un código QR. El cliente escanea el QR, abre la web, se autentica y confirma el pago.

**Endpoints:**
- `POST /api/pos/charge` — Crear carga
- `GET /api/pos/charge/{id}/status` — Consultar estado
- `GET /api/pos/charge/{token}/info` — Info pública por token
- `POST /api/pos/charge/{id}/cancel` — Cancelar carga

**Orden del flujo:**
1. POS crea la carga: `POST /api/pos/charge` con `{amount, description}`
2. Respuesta: `{charge_id, charge_token, amount, status: "pending", expires_at}`
3. POS genera URL QR: `{serverUrl}/pay?token={charge_token}`
4. **Cliente escanea QR** → abre URL en navegador → ve preview pública (monto, comerciante, concepto)
5. Cliente inicia sesión → ve página de confirmación con:
   - Identidad del pagador
   - Receptor
   - Balance actual y proyectado
   - Límites comunitarios (`credit_limit`, `debit_limit`)
   - Cuentas involucradas (debit y credit)
6. Cliente confirma → backend procesa pago (debit pagador, credit receptor, impuesto si aplica)
7. POS hace polling cada 2-3 segundos: `GET /api/pos/charge/{id}/status`
8. Cuando `status = "paid"` → POS muestra comprobante
9. Expiración: 3 minutos. Si no se paga, `status = "expired"`

**Importante:** En el pago QR, el pago lo emite el **comprador** (quien escanea el QR desde su app), no el vendedor. El POS solo genera el cargo y espera. La página web `/pay?token=...` es solo para confirmar el pago, no es un POS.

#### Generación y parseo directo (legacy)
- `POST /api/payments/qr/generate` — Genera código QR con datos embebidos
- `POST /api/payments/qr/parse` — Parsea QR escaneado, valida, crea transacción

### 2. Pago NFC (Tarjetas)

#### Tarjetas NFC
- `nfc_cards`: vinculadas a usuarios (card_uid unico)
- `POST /api/payments/nfc/lookup`: busca usuario por card_uid
- `POST /api/nfc/terminal/{id}/assign`: asigna terminal a usuario (requiere permiso)

#### Flujo unificado (username primero, documento solo para Classic)
1. Comercio ingresa monto
2. Cliente ingresa **username** (con `@nodo` opcional para usuarios remotos)
3. POS envia lookup al servidor (cifrado): `{terminal_id, username}`
4. Servidor responde con `card_type` y `requires_document`:
   - Si `requires_document = true` (Classic): pedir documento de identidad
   - Si `requires_document = false` (UID/DESFire): saltar documento
5. Si es Classic, cliente ingresa documento (tipo y numero). El tipo de documento debe coincidir con el configurado para la tarjeta
6. Cliente ingresa PIN (4 digitos)
7. POS envia pre-auth al servidor (cifrado):
   - Classic: `{terminal_id, username, doc_type, doc_number, pin, amount}`
   - UID/DESFire: `{terminal_id, username, pin, amount}`
8. Servidor valida, busca tarjeta activa, identifica tipo
9. Servidor responde con datos para leer/escribir (Classic) o solo `card_uid` (UID/DESFire)
10. POS muestra "ACERQUE SU TARJETA"
11. Cliente acerca tarjeta
12. POS verifica UID coincide con `card_uid` del pre-auth
13. Si es Classic: lee/escribe sectores, confirma al servidor
14. Si es UID/DESFire: llama a `processNfcPayment` con card_uid + PIN + amount
15. Servidor procesa pago, responde con resultado

**Endpoints NFC unificados:**
- `POST /api/nfc/terminal/user-lookup` — Buscar usuario por username (cifrado)
- `POST /api/nfc/terminal/classic/pre-auth` — Pre-auth para UID/DESFire (username + PIN, cifrado)
- `POST /api/nfc/terminal/classic/pre-auth-document` — Pre-auth para Classic (username + doc + PIN, cifrado)
- `POST /api/nfc/terminal/classic/confirm` — Confirmar lectura/escritura tarjeta Classic

### 3. Pago NFC (Terminales ESP32)

#### Terminales
- 4 tipos: keypad, web, touch, community
- Autenticacion mutual: Ed25519 + ECDH (Curve25519)
- Cifrado: AES-256-GCM
- PIN de 4 digitos con bcrypt, max 3 intentos, bloqueo 15 min

#### Endpoints del terminal
- `POST /api/nfc/terminal/complete-registration` — Registro mutual
- `POST /api/nfc/terminal/auth` — Autenticacion con firma Ed25519
- `POST /api/nfc/terminal/heartbeat` — Heartbeat
- `POST /api/nfc/terminal/payment` — Pago individual (cifrado)
- `POST /api/nfc/terminal/payment/community` — Pago comunitario (doble tarjeta)
- `POST /api/nfc/terminal/classic/pre-auth` — Pre-autenticacion unificada (todos los tipos de tarjeta)
- `POST /api/nfc/terminal/classic/confirm` — Confirmar lectura/escritura tarjeta Classic (cert dinamicos)

#### Endpoints de gestion (JWT + permisos)
- `POST /api/nfc/terminal/register` — Registrar terminal (permiso: `nfc.register_terminal`)
- `GET /api/nfc/terminals` — Listar terminales
- `DELETE /api/nfc/terminal/{id}` — Desactivar (permiso: `nfc.deactivate_terminal`)
- `POST /api/nfc/cards/issue` — Emitir tarjeta (permiso: `nfc.issue_card`)
- `POST /api/nfc/cards/provision-classic` — Provisionar tarjeta MIFARE Classic con cert dinamicos (permiso: `nfc.issue_card`)
- `PUT /api/nfc/cards/pin` — Cambiar PIN
- `PUT /api/nfc/cards/{uid}/pin/reset` — Resetear PIN (permiso: `nfc.reset_pin`)
- `GET /api/nfc/transactions` — Listar transacciones

#### Flujo de pago individual
1. Terminal lee tarjeta NFC (PN532)
2. Usuario ingresa PIN (encoder/touch/web)
3. Terminal cifra payload (AES-256-GCM), firma (Ed25519)
4. Servidor verifica firma, descifra, valida PIN (bcrypt)
5. Servidor debita, cifra respuesta, firma
6. Terminal descifra, muestra resultado

#### Flujo de pago unificado (MIFARE Classic, UID-only, DESFire)
1. Comerciante ingresa monto
2. Cliente ingresa **username** (con `@nodo` para remotos)
3. POS hace lookup de usuario (cifrado) → servidor responde con `card_type` y `requires_document`
4. Si `requires_document` (Classic): cliente ingresa documento (tipo configurado para la tarjeta) + PIN
5. Si no (UID/DESFire): cliente ingresa solo PIN
6. POS envia pre-auth al servidor (cifrado)
7. Servidor valida usuario, PIN, saldo → bloquea monto, identifica tipo de tarjeta
8. Servidor responde con `card_type`:
   - `classic`: sector a leer + Key A + cert esperado + sector a escribir + Key B + cert nuevo
   - `uid_only`/`desfire`: solo `card_uid` para verificar
9. POS muestra "ACERQUE SU TARJETA"
10. Si es Classic: POS lee UID, lee sector con Key A, verifica cert (triple redundancia), escribe nuevo cert con Key B
11. Si es UID/DESFire: POS verifica UID, llama a `processNfcPayment`
12. POS confirma al servidor (solo Classic)
13. Servidor procesa pago, rota sector activo (solo Classic)

Ver `docs/tarjeta-classic-certificados.md` para detalles completos.

#### Flujo de pago comunitario
1. Vendedor acerca tarjeta + PIN
2. Vendedor ingresa monto
3. Comprador acerca tarjeta + PIN
4. Servidor valida ambos PINs, debita comprador, acredita vendedor

Ver `nfc_hardware.md` y `firmware/` para mas detalles.

### 4. Pago Manual

- `POST /api/payments/manual`
- Parametros: receiver_id (uuid), amount, reference (string opcional)
- Transaccion directa entre usuarios autenticados
- Valida limites de credito/debito

## Validaciones Comunes

### Limites
- Credito del remitente (no exceder credit_limit)
- Debito del receptor (no exceder debit_limit)
- Limite por transaccion (si configurado en nivel)
- Limite diario (si configurado)
- Limite mensual (si configurado)

### Impuestos
- Calculado segun `tax_rate` del remitente
- Debitado adicionalmente al remitente
- Acreditado al fondo comunitario o cuenta de impuestos

### Hash Chain
- Cada pago genera transaccion con hash chain
- prev_hash + datos -> current_hash
- Inmutable y auditable

## Gestion de Turnos (Shift Management)

### PIN del Turno
- El **dueno del terminal** configura el PIN del turno desde su panel web (`MyTerminals.tsx`)
- El PIN se almacena como **hash bcrypt** en `nfc_terminals.shift_pin_hash`
- El POS lo sincroniza localmente para permitir abrir/cerrar turnos **sin internet**
- Los **empleados** no pueden abrir/cerrar turnos ni acceder a la configuracion del terminal
- Endpoints:
  - `POST /api/nfc/my-terminals/{id}/shift-pin` — Configurar PIN (solo dueno)
  - `POST /api/nfc/my-terminals/{id}/shift-pin/verify` — Verificar PIN
  - `GET /api/nfc/my-terminals/{id}/shift-pin/configured` — Consultar si hay PIN configurado

### Historial de Turnos
- Los turnos se almacenan tanto en el **POS local** como en el **backend**
- No hay limite de 100 registros — se soporta **al menos un ano** de historial
- Filtro por rango de fechas (`from`, `to` en formato YYYY-MM-DD)
- Detalle por turno: usuario, hora de apertura, monto inicial, ventas, transacciones, cierre, notas
- Endpoints:
  - `GET /api/nfc/my-terminals/{id}/shifts?from=&to=` — Listar turnos por rango
  - `GET /api/nfc/org-terminals/{orgID}/{terminalID}/shifts?from=&to=` — Listar turnos (organizacion)

### Exportacion CSV
- Exportacion de transacciones y turnos en formato CSV (compatible con Excel, Google Sheets, LibreOffice)
- Endpoints:
  - `GET /api/nfc/my-terminals/{id}/export/transactions?from=&to=` — CSV de transacciones
  - `GET /api/nfc/my-terminals/{id}/export/shifts?from=&to=` — CSV de turnos
- Campos exportados: ID, UID tarjeta, monto (centavos), estado, PIN verificado, tipo, error, fecha/hora
- No se exportan secretos (PINs, claves de tarjeta, tokens cifrados)

### Retencion y Purga
- Retencion por defecto: **365 dias**
- Configurable via `pos_retention_config` (tabla de migracion 143)
- Purga automatica cada **24 horas** (goroutine `StartRetentionPurger`)
- Purga manual disponible para administradores
- La purga solo borra transacciones/turnos cerrados mayores al periodo de retencion
- El usuario puede **exportar datos antes de la purga** para preservarlos
- La eliminacion de historial local en el POS **no afecta** el historial del backend
- Endpoints:
  - `GET /api/nfc/retention/config` — Ver configuracion
  - `PUT /api/nfc/retention/config` — Actualizar (admin)
  - `POST /api/nfc/retention/purge` — Purga manual (admin)

## Transacciones Cross-Node

### Flujo de debito/credito entre nodos
1. El **comprador remoto** es debitado en su **nodo de origen** (`user_balance`)
2. El **pool de federacion** del nodo de origen es acreditado (`node_bridge_global` o `node_bridge_bilateral`)
3. El nodo de origen envia un mensaje `Transfer` al nodo receptor (firma dual Ed25519)
4. El **nodo receptor** recibe el mensaje y:
   - Debita el pool de federacion (`node_bridge`)
   - Acredita al **receptor local** (`user_balance`)
   - Aplica el tax del nodo receptor si corresponde
5. Ambos nodos guardan la transaccion en `cross_node_tx_chain` (hash encadenado, firma dual)
6. Si el nodo de origen **no puede ser contactado** despues de 3 intentos, la transaccion **no se completa**

### Verificacion de permisos
- El usuario debe tener `can_cross_node_trade = true` (verificado en `ledger/limits.go`)
- Los limites bilaterales/global se verifican antes de procesar
