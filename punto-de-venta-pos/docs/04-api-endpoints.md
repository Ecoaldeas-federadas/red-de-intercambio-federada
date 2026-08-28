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
Los endpoints de pago NFC (`/api/nfc/terminal/payment`, `/api/nfc/terminal/payment/community`, `/api/nfc/terminal/payment/multisig-sign`) usan payloads cifrados con AES-256-GCM. La estructura es:

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

El `ciphertext` contiene el JSON real (por ejemplo `NFCPaymentPayload`) cifrado con la clave compartida ECDH. Ver `06-criptografia.md` para detalles.

---

## 1. Terminal NFC — Registro y Autenticación

### POST /api/nfc/terminal/register
Registra un nuevo terminal NFC generando su identidad Ed25519.

**Request** (no cifrado):
```json
{
  "terminal_id": "TERM-001",
  "terminal_name": "POS Feria",
  "public_key_hex": "<ed25519-public-key-hex>",
  "merchant_user_id": "uuid-del-comerciante",
  "device_fingerprint": "<fingerprint-hash>"
}
```

**Response** `200 OK`:
```json
{
  "terminal_id": "TERM-001",
  "server_public_key_hex": "<ed25519-server-public-key-hex>",
  "status": "registered"
}
```

### POST /api/nfc/terminal/complete-registration
Completa el registro tras el emparejamiento con código de 6 dígitos.

**Request**:
```json
{
  "terminal_id": "TERM-001",
  "pairing_code": "123456",
  "public_key_hex": "<ed25519-public-key-hex>"
}
```

**Response** `200 OK`:
```json
{
  "status": "active",
  "terminal_id": "TERM-001",
  "server_public_key_hex": "..."
}
```

### POST /api/nfc/terminal/auth
Autentica el terminal y retorna un session token + format settings.

**Request** (con firma Ed25519):
```json
{
  "terminal_id": "TERM-001",
  "timestamp": 1696234567,
  "signature_hex": "<ed25519-signature-hex>"
}
```

**Response** `200 OK`:
```json
{
  "status": "ok",
  "session_token": "<jwt-terminal>",
  "terminal": {
    "id": "uuid",
    "terminal_id": "TERM-001",
    "terminal_name": "POS Feria",
    "is_active": true,
    "merchant_user_id": "uuid"
  },
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
Heartbeat periódico del terminal.

**Request**:
```json
{
  "terminal_id": "TERM-001",
  "timestamp": 1696234567
}
```

**Response** `200 OK`:
```json
{ "status": "ok", "server_time": 1696234567 }
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
Inicia el emparejamiento generando un código de 6 dígitos.

**Request**:
```json
{
  "terminal_id": "TERM-001",
  "public_key_hex": "<ed25519-public-key-hex>",
  "merchant_user_id": "uuid"
}
```

**Response** `200 OK`:
```json
{
  "pairing_code": "123456",
  "expires_at": "2026-08-28T22:10:00Z"
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
      "signer_user_id": "uuid",
      "signed_at": "2026-08-28T22:30:00Z"
    }
  ]
}
```

Estados posibles: `pending`, `ready`, `executed`, `expired`, `cancelled`.

---

## 5. Terminal NFC — Administración

### POST /api/nfc/terminal/lookup
Busca un terminal por su clave pública (para validación cruzada).

### POST /api/nfc/terminal/{id}/block
Bloquea un terminal (admin).

### POST /api/nfc/terminal/{id}/unblock
Desbloquea un terminal (admin).

---

## 6. POS Web — Cargas QR

### POST /api/pos/charge
Crea una carga QR (requiere auth del merchant).

**Request**:
```json
{
  "amount": 12500,
  "description": "Compra de productos"
}
```

**Response** `200 OK` (`ChargeResponse`):
```json
{
  "charge_id": "chg-uuid",
  "charge_token": "token-uuid",
  "amount": 12500,
  "status": "pending",
  "expires_at": "2026-08-28T22:05:00Z"
}
```

### GET /api/pos/charge/{id}/status
Consulta el estado de una carga (requiere auth del merchant).

**Response** `200 OK`:
```json
{
  "charge_id": "chg-uuid",
  "status": "pending|paid|expired|cancelled",
  "amount": 12500,
  "paid_at": "2026-08-28T22:03:00Z",
  "transaction_id": "uuid"
}
```

### POST /api/pos/charge/{id}/cancel
Cancela una carga (merchant).

### GET /api/pos/charge/{token}/info
Info pública de la carga (sin auth — el cliente ve esto antes de iniciar sesión).

**Response** `200 OK`:
```json
{
  "charge_token": "token-uuid",
  "amount": 12500,
  "description": "Compra de productos",
  "merchant_name": "Feria San Juan",
  "status": "pending",
  "expires_at": "2026-08-28T22:05:00Z"
}
```

### POST /api/pos/charge/{token}/pay
Paga la carga (requiere auth del cliente/pagador).

**Request**:
```json
{
  "id_document_type": "cedula",
  "id_document_number": "V12345678"
}
```

**Response** `200 OK`:
```json
{
  "status": "paid",
  "transaction_id": "uuid",
  "message": "pago procesado"
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
  "node_domain": "feria.loanstly.com",
  "node_name": "Feria San Juan",
  "currency_code": "TQ",
  "currency_symbol": "TQ",
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

### GET /api/public/settings
Settings públicos (no requieren auth).

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
  "account_id": "uuid",
  "balance": 250000,
  "credit_limit": -500000,
  "debit_limit": 1000000
}
```

### GET /api/accounts/{id}/history
Historial de transacciones de una cuenta.

### POST /api/transfer
Transferencia entre cuentas (P2P).

**Request**:
```json
{
  "to_account_id": "uuid",
  "amount": 5000,
  "description": "Transferencia"
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

### EncryptedPayloadModel
```go
type EncryptedPayloadModel struct {
    Nonce      string `json:"nonce"`
    Ciphertext string `json:"ciphertext"`
    Signature  string `json:"signature"`
}
```

### EncryptedPaymentRequest
```go
type EncryptedPaymentRequest struct {
    TerminalID       string                `json:"terminal_id"`
    EncryptedPayload EncryptedPayloadModel `json:"encrypted_payload"`
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
