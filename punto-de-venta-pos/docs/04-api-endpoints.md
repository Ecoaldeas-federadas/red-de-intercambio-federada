# Referencia de Endpoints de la API

Este documento lista todos los endpoints del backend Go que el POS Android (y otros clientes) utilizan. El backend usa el router `chi` y expone rutas bajo `/api/`. Los nodos federados pueden tener un prefijo de ruta base (por ejemplo `/main` o `/demo`).

> **Nota importante**: El proyecto Android **no incluye** el código fuente del backend Go ni de las web apps. Este documento es la fuente autoritativa del contrato API para cualquier IA que trabaje con el código Android.

---

## Autenticación y cabeceras

### Cabeceras comunes
| Cabecera | Descripción |
|----------|-------------|
| `Authorization: Bearer <jwt>` | Token JWT del usuario (web app) |
| `X-Terminal-ID: <terminal_id>` | Identificador del terminal NFC |
| `X-Terminal-Public-Key: <hex>` | Clave pública Ed25519 del terminal |
| `X-Node-Domain: <domain>` | Dominio del nodo federado |
| `X-User-ID: <uuid>` | ID del usuario autenticado (inyectado por middleware) |
| `Content-Type: application/json` | Tipo de contenido |

### Cifrado de payloads NFC
Los endpoints de pago NFC (`/api/nfc/terminal/payment`, `/api/nfc/terminal/payment/community`, `/api/nfc/terminal/payment/multisig-sign`) usan payloads cifrados con AES-256-GCM usando **claves efímeras** (EphemeralMessage con handshake). La estructura es:

```json
{
  "terminal_id": "TERM-001",
  "encrypted_payload": {
    "handshake": {
      "ephemeral_public_key": "<hex-clave-efimera-publica>",
      "identity_signature": "<hex-firma-ed25519-de-la-clave-efimera>",
      "nonce": "<hex-nonce-handshake>"
    },
    "nonce": "<hex-nonce-aes>",
    "ciphertext": "<hex-aes-256-gcm-ciphertext>",
    "signature": "<hex-ed25519-firma-del-ciphertext>"
  }
}
```

El `ciphertext` contiene el JSON real (por ejemplo `NFCPaymentPayload`) cifrado con AES-256-GCM usando una clave efímera derivada por ECDH. El `handshake` provee **perfect forward secrecy**: cada transacción usa una clave temporal única. Ver `06-criptografia.md` para detalles completos.

---

## 1. Terminal NFC — Registro y Autenticación

### POST /api/nfc/terminal/register
Registra un nuevo terminal NFC (requiere permiso `nfc.register_terminal`).

**Request** (`RegisterTerminalRequest`):
```json
{
  "terminal_id": "TERM-001",
  "label": "POS Feria",
  "terminal_type": "keypad",
  "location": "Feria San Juan",
  "device_fingerprint": "<fingerprint-hash>"
}
```

**Response** `201 Created`:
```json
{
  "terminal": { ... },
  "registration_token": "<token-para-complete-registration>"
}
```

### POST /api/nfc/terminal/complete-registration
Completa el registro tras recibir el `registration_token`.

**Request** (`CompleteRegistrationRequest`):
```json
{
  "terminal_id": "TERM-001",
  "registration_token": "<token-del-paso-anterior>",
  "terminal_public_key": "<ed25519-public-key-hex>",
  "device_fingerprint": "<fingerprint-hash>"
}
```

**Response** `200 OK`:
```json
{
  "server_public_key": "<ed25519-server-public-key-hex>",
  "status": "registered"
}
```

### POST /api/nfc/terminal/auth
Autentica el terminal y retorna un session token + format settings.

**Request** (`TerminalAuthRequest`):
```json
{
  "terminal_id": "TERM-001",
  "signature": "<ed25519-signature-hex>",
  "nonce": "<nonce-aleatorio>",
  "device_fingerprint": "<fingerprint-hash>"
}
```

**Response** `200 OK`:
```json
{
  "session_token": "<jwt-terminal>",
  "signature": "<ed25519-server-signature-hex>",
  "format_settings": {
    "locale": "es",
    "number_locale": "es-VE",
    "date_format": "DD/MM/YYYY",
    "time_format": "24h",
    "first_day_of_week": 1,
    "timezone": "America/Caracas"
  }
}
```

### POST /api/nfc/terminal/heartbeat
Heartbeat periódico del terminal. Retorna estado activo/registrado + firma del servidor.

**Request**:
```json
{
  "terminal_id": "TERM-001"
}
```

**Response** `200 OK`:
```json
{
  "status": "ok",
  "active": true,
  "registered": true,
  "signature": "<ed25519-server-signature-hex>"
}
```

Si el terminal no se encuentra:
```json
{
  "status": "ok",
  "active": false,
  "registered": false,
  "not_found": true
}
```

### GET /api/nfc/terminal/{id}/status
Consulta el estado de un terminal.

**Response** `200 OK`:
```json
{
  "terminal_id": "TERM-001",
  "is_active": true,
  "last_seen": "2026-08-28T22:00:00Z",
  "merchant_user_id": "uuid"
}
```

---

## 2. Terminal NFC — Emparejamiento

### POST /api/nfc/terminal/pair/initiate
Inicia el emparejamiento generando un código de 6 dígitos. No requiere auth.

**Request**:
```json
{
  "terminal_public_key": "<ed25519-public-key-hex>",
  "device_fingerprint": "<fingerprint-hash>",
  "terminal_id": "TERM-001",
  "terminal_label": "POS Feria",
  "chip_id": "",
  "device_model": "",
  "device_manufacturer": "",
  "android_version": "",
  "terminal_type": "keypad"
}
```

**Response** `201 Created`:
```json
{
  "pairing_code": "123456",
  "expires_in": 60,
  "message": "Pida al administrador que apruebe este codigo en su panel."
}
```

### GET /api/nfc/terminal/pair/{code}/status
Consulta el estado del emparejamiento.

**Response** `200 OK`:
```json
{
  "status": "pending|approved|rejected|expired",
  "terminal_id": "TERM-001"
}
```

---

## 3. Terminal NFC — Sesión de venta

### POST /api/nfc/terminal/session
Crea una sesión de venta (turno).

**Request**:
```json
{
  "terminal_id": "TERM-001",
  "initial_amount": 0
}
```

**Response** `200 OK`:
```json
{
  "session_id": "uuid",
  "terminal_id": "TERM-001",
  "started_at": "2026-08-28T22:00:00Z",
  "initial_amount": 0
}
```

### PUT /api/nfc/terminal/session/amount
Actualiza el monto inicial de la sesión.

**Request**:
```json
{
  "session_id": "uuid",
  "initial_amount": 5000
}
```

### GET /api/nfc/terminal/{id}/session
Consulta la sesión activa del terminal.

**Response** `200 OK`:
```json
{
  "session_id": "uuid",
  "terminal_id": "TERM-001",
  "started_at": "2026-08-28T22:00:00Z",
  "is_open": true,
  "initial_amount": 5000
}
```

---

## 4. Terminal NFC — Pagos

### POST /api/nfc/terminal/payment
Procesa un pago NFC simple (cliente → comerciante del terminal).

**Request** (payload cifrado, ver `06-criptografia.md`):
```json
{
  "terminal_id": "TERM-001",
  "encrypted_payload": {
    "nonce": "<hex>",
    "ciphertext": "<hex>",
    "signature": "<hex>"
  }
}
```

Payload descifrado (`NFCPaymentPayload`):
```json
{
  "card_uid": "04A3B2C1D2E3F4",
  "crypto_token": "desfire_auth_ok",
  "pin": "1234",
  "amount": 12500,
  "timestamp": 1696234567,
  "nonce": "a1b2c3d4e5f6...",
  "id_document_type": "cedula",
  "id_document_number": "V12345678"
}
```

**Response** `200 OK` (`NFCPaymentResult`):
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "message": "transaccion aprobada",
  "user_balance": 175000
}
```

O si requiere multifirma:
```json
{
  "status": "pending_multisig",
  "transaction_id": "pending-uuid",
  "pending_id": "pending-uuid",
  "required_sigs": 2,
  "collected_sigs": 1,
  "remaining_sigs": 1,
  "message": "Pago pendiente. Faltan 1 firma(s).",
  "user_balance": 250000
}
```

**Errores**:
- `400`: monto inválido, payload inválido
- `401`: terminal no autenticado
- `403`: tarjeta bloqueada
- `406`: saldo insuficiente (excede credit_limit)
- `409`: PIN incorrecto

### POST /api/nfc/terminal/payment/community
Procesa un pago comunitario multi-vendedor (comprador → vendedor).

**Request** (payload cifrado):
Payload descifrado (`CommunityPaymentDecryptedPayload`):
```json
{
  "seller_card_uid": "04A1B2C1D2E3F4",
  "seller_crypto_token": "desfire_auth_ok",
  "seller_pin": "5678",
  "buyer_card_uid": "04E5F6G7H8I9J0",
  "buyer_crypto_token": "uid_only_token",
  "buyer_pin": "1234",
  "amount": 5000,
  "timestamp": 1696234567,
  "nonce": "...",
  "buyer_id_document_type": "cedula",
  "buyer_id_document_number": "V12345678"
}
```

**Response**: igual que `/payment`, incluyendo `pending_multisig` si el comprador requiere multifirma.

### POST /api/nfc/terminal/payment/multisig-sign
Firma un pago multifirma pendiente con la tarjeta del siguiente firmante.

**Request** (payload cifrado):
Payload descifrado:
```json
{
  "pending_payment_id": "pending-uuid",
  "card_uid": "04B2C3D4E5F6G7",
  "pin": "4321",
  "timestamp": 1696234600,
  "nonce": "...",
  "id_document_type": "cedula",
  "id_document_number": "V87654321"
}
```

**Response** `200 OK`:
```json
{
  "status": "pending_multisig",
  "pending_id": "pending-uuid",
  "required_sigs": 2,
  "collected_sigs": 2,
  "remaining_sigs": 0,
  "message": "Firma registrada. Ejecutando pago..."
}
```

O si se completó:
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "message": "pago aprobado",
  "user_balance": 165000
}
```

**Errores**:
- `403`: firmante no autorizado, ya firmó, PIN incorrecto
- `410`: pago expirado o cancelado

### GET /api/nfc/terminal/payment/multisig/{pendingId}/status
Consulta el estado de un pago multifirma pendiente.

**Response** `200 OK`:
```json
{
  "id": "pending-uuid",
  "status": "pending",
  "amount": 12500,
  "payment_type": "nfc",
  "required_signatures": 2,
  "collected_count": 1,
  "remaining_sigs": 1,
  "expires_at": "2026-08-28T22:35:00Z",
  "remaining_seconds": 145,
  "collected_signatures": [
    {
      "signer_id": "uuid",
      "method": "nfc_card",
      "card_uid": "04A3B2C1D2E3F4",
      "timestamp": "2026-08-28T22:30:00Z"
    }
  ]
}
```

Estados posibles: `pending`, `executed`, `expired`, `cancelled`.

---

## 5. Terminal NFC — Administración

### POST /api/nfc/terminal/lookup
Busca un terminal por su clave pública (para validación cruzada).

### POST /api/nfc/terminal/{id}/block
Bloquea un terminal (admin).

### POST /api/nfc/terminal/{id}/unblock
Desbloquea un terminal (admin).

---

## 5.1. Tarjetas NFC — Administración

### GET /api/nfc/cards
Lista las tarjetas NFC registradas (requiere auth).

### POST /api/nfc/cards/issue
Emite una nueva tarjeta NFC crypto (requiere permiso `nfc.issue_card`).

### POST /api/nfc/cards/provision-classic
Provisiona una tarjeta MIFARE Classic 1K con certificados dinámicos (requiere permiso `nfc.issue_card`).

Genera 15 sectores con claves A/B únicas y certificados (14 basura + 1 real).

**Request**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "card_uid": "AABBCCDD",
  "initial_pin": "1234"
}
```

**Response**:
```json
{
  "card_uid": "AABBCCDD",
  "sectors": [
    {
      "sector_number": 1,
      "key_a": "a1b2c3d4e5f6",
      "key_b": "f6e5d4c3b2a1",
      "access_bits": "78778869",
      "certificate": "00112233445566778899aabbccddeeff",
      "is_active": true
    },
    ...
  ]
}
```

### POST /api/nfc/terminal/classic/pre-auth
Pre-autenticación para tarjeta MIFARE Classic (terminal-facing, Ed25519 auth).

El usuario ingresa documento + PIN. El servidor valida y responde con el sector a leer y escribir.

**Payload cifrado**:
```json
{
  "terminal_id": "TERM-ANDROID-XXXXXXXXXXXX",
  "doc_type": "cedula",
  "doc_number": "12345678",
  "pin": "1234",
  "amount": 5000
}
```

**Response cifrada**:
```json
{
  "pre_approved": true,
  "card_uid": "AABBCCDD",
  "read_sector": 3,
  "read_key_a": "a1b2c3d4e5f6",
  "expected_certificate": "00112233445566778899aabbccddeeff",
  "write_sector": 9,
  "write_key_b": "f6e5d4c3b2a1",
  "new_certificate": "ffeeddccbbaa99887766554433221100"
}
```

### POST /api/nfc/terminal/classic/confirm
Confirma la lectura/escritura de la tarjeta Classic (terminal-facing, Ed25519 auth).

**Payload cifrado**:
```json
{
  "terminal_id": "TERM-ANDROID-XXXXXXXXXXXX",
  "card_uid": "AABBCCDD",
  "read_ok": true,
  "write_ok": true,
  "written_blocks": 3
}
```

**Response cifrada**: `PaymentResultDecrypted` (status, transaction_id, user_balance)

### DELETE /api/nfc/cards/{uid}
Desactiva una tarjeta NFC (requiere permiso `nfc.deactivate_card`).

### PUT /api/nfc/cards/pin
Cambia el PIN de una tarjeta (requiere auth — el usuario debe conocer el PIN anterior).

**Request**:
```json
{
  "card_uid": "04A3B2C1D2E3F4",
  "old_pin": "1234",
  "new_pin": "5678"
}
```

### PUT /api/nfc/cards/{uid}/pin/reset
Resetea el PIN de una tarjeta (requiere permiso `nfc.reset_pin`).

**Importante**: Este endpoint **también desbloquea la tarjeta** si estaba bloqueada por intentos fallidos, ya que `ResetCardPIN` limpia `attempt_count = 0` y `blocked_until = NULL` en `nfc_card_attempts`. **No hay un endpoint dedicado para desbloquear una tarjeta sin resetear el PIN.**

**Request**:
```json
{
  "new_pin": "1234"
}
```

**Response** `200 OK`:
```json
{ "status": "pin_reset" }
```

### Bloqueo automático por intentos de PIN

El bloqueo es **automático** y está **hardcodeado** en el backend:

| Parámetro | Valor | Ubicación | ¿Configurable? |
|-----------|-------|-----------|----------------|
| Máximo de intentos | 3 | `incrementCardAttempt()` en `internal/payments/nfc_terminal.go` | **No** |
| Duración del bloqueo | 15 minutos | `incrementCardAttempt()` en `internal/payments/nfc_terminal.go` | **No** |
| Tabla | `nfc_card_attempts` | Migración 004 | — |
| Reset automático | Sí, al acertar PIN | `resetCardAttempts()` | — |
| Reset manual | `PUT /api/nfc/cards/{uid}/pin/reset` | Requiere permiso `nfc.reset_pin` | — |

**Limitación conocida**: No hay UI ni API para configurar el número máximo de intentos o la duración del bloqueo. Tampoco hay un endpoint para desbloquear sin resetear el PIN. Si se necesita desbloquear manteniendo el PIN actual, habría que resetearlo al mismo valor.

---

## 6. POS Web — Cargas QR

### POST /api/pos/charge
Crea una carga QR (requiere auth del merchant).

**Request** (`CreateChargeRequest`):
```json
{
  "amount": 12500,
  "description": "Compra de productos"
}
```

**Response** `201 Created` (`ChargeResponse`):
```json
{
  "charge_id": "uuid",
  "charge_token": "token-uuid",
  "amount": 12500,
  "status": "pending",
  "expires_at": "2026-08-28T22:05:00Z"
}
```

> **Nota:** `expires_at` es RFC3339 (timestamp absoluto). El timeout es de 3 minutos.

### GET /api/pos/charge/{id}/status
Consulta el estado de una carga (requiere auth del merchant).

**Response** `200 OK`:
```json
{
  "charge_id": "uuid",
  "amount": 12500,
  "status": "pending|paid|expired|cancelled",
  "payment_method": "qr",
  "paid_at": "2026-08-28T22:03:00Z"
}
```

### POST /api/pos/charge/{id}/cancel
Cancela una carga (merchant).

### GET /api/pos/charge/{token}/info
Info pública de la carga (sin auth — el cliente ve esto antes de iniciar sesión).

**Response** `200 OK`:
```json
{
  "amount": 12500,
  "status": "pending",
  "description": "Compra de productos",
  "merchant_name": "Feria San Juan",
  "expires_at": "2026-08-28T22:05:00Z"
}
```

### POST /api/pos/charge/{token}/pay
Paga la carga (requiere auth del cliente/pagador).

**Request** (`PayChargeRequest`):
```json
{
  "payment_method": "qr"
}
```

**Response** `200 OK`:
```json
{
  "status": "paid",
  "amount": 12500,
  "new_balance": 175000,
  "payment_method": "qr"
}
```

### POST /api/pos/charge/{token}/cancel
Cancela la carga usando el token (requiere auth del cliente).

---

## 7. POS Web — Sesión web

### POST /api/pos-web/request-session
Solicita una sesión web para el POS web.

### GET /api/pos-web/session-status/{reqId}
Consulta el estado de la solicitud de sesión web.

---

## 8. Autenticación de usuarios (web app)

### POST /api/auth/register
Inicia registro de usuario con passkey (WebAuthn).

### POST /api/auth/passkey/finish
Completa el registro WebAuthn.

### POST /api/auth/login/begin
Inicia login con passkey.

### POST /api/auth/login/finish
Completa el login WebAuthn.

### POST /api/auth/login/password
Login con contraseña (fallback).

### GET /api/auth/me
Retorna el usuario autenticado + `format_settings`.

**Response** `200 OK`:
```json
{
  "user": {
    "id": "uuid",
    "username": "usuario",
    "display_name": "Usuario Demo",
    "balance": 250000,
    "credit_limit": -500000,
    "required_signatures": 1,
    "authorized_signers": []
  },
  "format_settings": { ... }
}
```

### PUT /api/auth/me/contacts
Actualiza contactos del usuario.

### GET /api/me/preferences
Obtiene preferencias del usuario (incluye format settings override).

### PUT /api/me/preferences
Actualiza preferencias del usuario.

**Request**:
```json
{
  "locale": "es",
  "number_locale": "es-VE",
  "date_format": "DD/MM/YYYY",
  "time_format": "24h",
  "first_day_of_week": 1,
  "timezone": "America/Caracas"
}
```

### Passkeys
- `GET /api/auth/passkey/list` — lista passkeys
- `POST /api/auth/passkey/add/begin` — inicia añadir passkey
- `POST /api/auth/passkey/add/finish` — completa añadir passkey
- `DELETE /api/auth/passkey/{id}` — elimina passkey

---

## 9. Sistema y configuración

### GET /api/config
Configuración pública del nodo (incluye `format_settings` con defaults del nodo).

**Response** `200 OK`:
```json
{
  "node_domain": "<dominio-del-nodo>",
  "node_name": "Feria San Juan",
  "currency_name": "TQ",
  "currency_full_name": "Trueque",
  "app_name": "Red de Intercambio",
  "format_settings": {
    "locale": "es",
    "number_locale": "es-VE",
    "date_format": "DD/MM/YYYY",
    "time_format": "24h",
    "first_day_of_week": 1,
    "timezone": "America/Caracas"
  }
}
```

### GET /api/health
Health check del nodo.

### GET /api/public/products
Lista pública de productos.

### GET /api/favicon
Favicon del nodo.

---

## 10. Cuentas y transferencias

### GET /api/accounts/{id}
Obtiene una cuenta por ID.

### GET /api/accounts/{id}/balance
Obtiene el balance de una cuenta.

**Response** `200 OK`:
```json
{
  "balance": 250000
}
```

### GET /api/accounts/{id}/history
Historial de transacciones de una cuenta.

### POST /api/transfer
Transferencia entre cuentas (P2P).

**Request** (`TransferRequest`):
```json
{
  "receiver_id": "uuid",
  "amount": 5000
}
```

---

## 11. Federación

### GET /api/federation/config
Configuración de federación del nodo.

### GET /api/federation/nodes
Lista de nodos federados conocidos.

### GET /api/federation/balances
Balances con todos los nodos federados.

### GET /api/federation/balance/{remoteNode}
Balance bilateral con un nodo específico.

### GET /api/federation/peers
Lista de peers federados.

### POST /api/federation/peers
Registra un nuevo peer federado (admin).

### DELETE /api/federation/peers/{peerDomain}
Elimina un peer federado (admin).

### GET /api/federation/parity
Lista de reportes de paridad.

### GET /api/federation/parity/{remoteNode}
Reporte de paridad con un nodo específico.

### GET /api/federation/warnings
Alertas activas de federación.

### POST /api/federation/pair/initiate
Inicia emparejamiento federado entre nodos.

### GET /api/federation/pair/pending
Lista emparejamientos federados pendientes.

### POST /api/federation/pair/request/{reqId}/confirm
Confirma emparejamiento federado.

### POST /api/federation/pair/request/{reqId}/reject
Rechaza emparejamientos federado.

---

## 12. Gobernanza federada

### GET /api/federation-gov/constants
Lista constantes de gobernanza federada.

### GET /api/federation-gov/constants/{key}
Obtiene una constante específica.

---

## 13. Endpoints adicionales no documentados en detalle

> **Nota:** El backend expone muchos más endpoints de los listados arriba. Los siguientes grupos de endpoints existen en el código pero no están documentados en detalle aquí porque el POS Android no los usa directamente. Para una referencia completa, revisa `internal/api/federation.go`, `internal/api/system.go`, `internal/api/nfc_terminal.go` y `internal/api/handlers.go`.

- **Federación bilateral:** `/api/federation/bilateral`, `/api/federation/bilateral/{remoteNode}`, `/api/federation/bilateral/propose`, `/api/federation/bilateral/{remoteNode}/confirm`, `/api/federation/bilateral/{remoteNode}/history`
- **Federación volumen/paridad:** `/api/federation/volume`, `/api/federation/parity`, `/api/federation/parity/{remoteNode}`
- **Federación peers:** `/api/federation/peers` (GET/POST/DELETE)
- **Federación node-levels:** `/api/federation/node-levels`, `/api/federation/nodes/{domain}/membership`, `/api/federation/nodes/{domain}/check-upgrade`
- **Federación sponsorships:** `/api/federation/sponsorships`
- **Páginas públicas:** `/api/public/pages`, `/api/public/pages/{slug}`, `/api/public/page/{slug}/html`
- **Productos públicos:** `/api/public/products`
- **Solicitudes de admisión:** `/api/public/admission-form` (GET), `/api/public/admission-request` (POST), `/api/admission/apply`, `/api/admission/requests`
- **POS Web sesiones:** `/api/pos-web/request-session`, `/api/pos-web/session-status/{reqId}`, `/api/pos-web/pending-sessions`
- **NFC tarjetas (admin):** `/api/nfc/cards` (GET), `/api/nfc/cards/issue` (POST), `/api/nfc/cards/{uid}` (DELETE), `/api/nfc/cards/pin` (PUT), `/api/nfc/cards/{uid}/pin/reset` (PUT)
- **NFC transacciones:** `/api/nfc/transactions` (GET)
- **NFC mis terminales:** `/api/nfc/my-terminals/*`
- **NFC terminales de organización:** `/api/nfc/org-terminals/*`
- **Calculadora:** `/api/calculator/internal`, `/api/calculator/external`, `/api/calculator/labor`

---

## 13. Códigos de estado HTTP

| Código | Significado |
|--------|-------------|
| `200` | OK |
| `400` | Bad Request (payload inválido, monto inválido) |
| `401` | No autenticado |
| `403` | Prohibido (tarjeta bloqueada, firmante no autorizado) |
| `404` | No encontrado |
| `406` | Saldo insuficiente (excede credit_limit) |
| `409` | Conflicto (PIN incorrecto, estado inválido) |
| `410` | Gone (pago expirado, carga expirada) |
| `500` | Error interno del servidor |

---

## 14. Modelos de datos principales

### NFCPaymentPayload
```go
type NFCPaymentPayload struct {
    CardUID         string `json:"card_uid"`
    CryptoToken     string `json:"crypto_token"`
    PIN             string `json:"pin"`
    Amount          int64  `json:"amount"`
    Timestamp       int64  `json:"timestamp"`
    Nonce           string `json:"nonce"`
    IDDocumentType  string `json:"id_document_type,omitempty"`
    IDDocumentNumber string `json:"id_document_number,omitempty"`
}
```

### CommunityPaymentDecryptedPayload
```go
type CommunityPaymentDecryptedPayload struct {
    SellerCardUID      string `json:"seller_card_uid"`
    SellerCryptoToken  string `json:"seller_crypto_token"`
    SellerPIN          string `json:"seller_pin"`
    BuyerCardUID       string `json:"buyer_card_uid"`
    BuyerCryptoToken   string `json:"buyer_crypto_token"`
    BuyerPIN           string `json:"buyer_pin"`
    Amount             int64  `json:"amount"`
    Timestamp          int64  `json:"timestamp"`
    Nonce              string `json:"nonce"`
    BuyerIDDocumentType   string `json:"buyer_id_document_type,omitempty"`
    BuyerIDDocumentNumber string `json:"buyer_id_document_number,omitempty"`
}
```

### NFCPaymentResult
```go
type NFCPaymentResult struct {
    Status        string `json:"status"`           // "approved" | "pending_multisig" | "rejected"
    TransactionID string `json:"transaction_id"`
    PendingID     string `json:"pending_id,omitempty"`
    RequiredSigs  int    `json:"required_sigs,omitempty"`
    CollectedSigs int    `json:"collected_sigs,omitempty"`
    RemainingSigs int    `json:"remaining_sigs,omitempty"`
    Message       string `json:"message"`
    UserBalance   int64  `json:"user_balance,omitempty"`
}
```

### EphemeralHandshake
```go
type EphemeralHandshake struct {
    EphemeralPublicKey string `json:"ephemeral_public_key"`
    IdentitySignature  string `json:"identity_signature"`
    Nonce              string `json:"nonce"`
}
```

### EphemeralMessage
```go
type EphemeralMessage struct {
    Handshake  EphemeralHandshake `json:"handshake"`
    Nonce      string             `json:"nonce"`
    Ciphertext string             `json:"ciphertext"`
    Signature  string             `json:"signature"`
}
```

### EncryptedPaymentRequest
```go
type EncryptedPaymentRequest struct {
    TerminalID       string          `json:"terminal_id"`
    EncryptedPayload EphemeralMessage `json:"encrypted_payload"`
}
```

### FormatSettings
```go
type FormatSettings struct {
    Locale          string `json:"locale"`
    NumberLocale    string `json:"number_locale"`
    DateFormat      string `json:"date_format"`
    TimeFormat      string `json:"time_format"`
    FirstDayOfWeek  int    `json:"first_day_of_week"`
    Timezone        string `json:"timezone"`
}
```

### ChargeResponse
```go
type ChargeResponse struct {
    ChargeID    string `json:"charge_id"`
    ChargeToken string `json:"charge_token"`
    Amount      int64  `json:"amount"`
    Status      string `json:"status"`
    ExpiresAt   string `json:"expires_at"`
}
```

### TerminalAuthResponse
```go
type TerminalAuthResponse struct {
    Status        string         `json:"status"`
    SessionToken  string         `json:"session_token"`
    Terminal      TerminalInfo   `json:"terminal"`
    FormatSettings FormatSettings `json:"format_settings"`
}
```
