# Prompt: Native Android POS App for Federated Exchange Network

> **IMPORTANT INSTRUCTIONS FOR THE AI RECEIVING THIS PROMPT:**
> 1. **Always respond in Spanish** to the user.
> 2. **Develop the entire application UI and all user-facing strings in Spanish.**
> 3. This document is written in English for technical precision, but the app and your replies must be in Spanish.
> 4. Do NOT modify any backend code. This prompt describes the existing backend API. You are building a **native Android client** that talks to this backend.
> 5. If anything is unclear, ask the user in Spanish before implementing.

---

## 1. Project Context

This is a **Federated Exchange Network** for eco-villages, rural communities, cooperatives, and autonomous organizations. Each node (community) runs its own server with:

- **Go backend** (REST API)
- **PostgreSQL-compatible database** (YugabyteDB)
- **Local currency** called **TQ** (Trueque units), stored as integer micro-units
- **Federated identity** and signed/mTLS communication between nodes

Each community has its own members, organizations, governance, and local currency accounts. The server exposes a REST API under `/api/...`.

The Android app you will build is a **Point of Sale (POS) client** that connects to one node at a time. A user (merchant) logs in, opens a shift, and can charge customers via QR codes or NFC cards.

---

## 2. App Modes

The app must support **three operational modes**:

### Mode A: QR Payment (Comerciante generates QR)

- The merchant enters an amount and optionally a description.
- The app creates a **charge** on the backend and gets a `charge_token`.
- The app displays a QR code encoding the URL: `{server_url}/pay?t={charge_token}`
- The **customer** scans this QR with their own phone (their own app or the web app at `/pay?t=...`).
- The customer logs in (if not already) and confirms the payment on their own device.
- The merchant's app polls the charge status until it becomes `paid`, `expired`, or `cancelled`.
- **No multi-vendor needed in QR mode** — the customer pays from their own phone.

### Mode B: NFC Payment (Customer taps card on merchant's phone)

- The merchant's phone acts as an **NFC terminal**.
- The customer taps their NFC card on the merchant's phone.
- The app reads the card UID (and crypto token if it's a secure DESFire card).
- The app asks the customer for their **PIN** (entered on the merchant's phone).
- **NEW: If the card is UID-only (cheap/clonable), the app must also ask for the customer's ID document number** (cédula/DNI). See section 12.
- The app sends the encrypted payment to the backend.
- The backend verifies the card, PIN, and optionally the ID document, then debits the customer and credits the merchant.

### Mode C: Multi-Vendor NFC (Merchant lends phone to another vendor)

- The phone owner enables **multi-vendor mode** in the app.
- The **vendor** (the person who will receive the money) taps **their own NFC card** on the phone.
- The app identifies the vendor, shows their name and account.
- The vendor enters the **amount to charge**.
- The phone is passed to the **customer**, who taps their card, enters PIN (and ID document if UID-only).
- The payment debits the customer and credits the **vendor** (not the phone owner).
- The phone owner can end multi-vendor mode at any time.

---

## 3. Server URL & Base Path

The app must let the user configure the **server URL**. Examples:

- `https://aldea-semilla-viva.org` (normal node)
- `https://feria.loanstly.com/demo` (demo node with base path `/demo`)

### Base Path Handling

If the URL contains a base path (like `/demo`), all API calls must be prefixed:

```
{server_url}/api/...        → normal node
{server_url}{base_path}/api/...  → node with base path
```

The base path is everything after the domain. For `https://feria.loanstly.com/demo`, the base path is `/demo`.

### API Base Construction

```
API_BASE = server_url + base_path + "/api"
```

All endpoints in this document are relative to `API_BASE`. For example, `/auth/login/password` means `{API_BASE}/auth/login/password`.

### Headers

Every request must include:

```
Content-Type: application/json
X-Node-Domain: <the node's domain, e.g. "aldea-semilla-viva.org" or "feria.loanstly.com/demo">
Authorization: Bearer <jwt_token>   (for authenticated routes)
```

---

## 4. Authentication

### 4.1 User Login (JWT)

**POST `/auth/login/password`**

Request:
```json
{
  "username": "juan_perez",
  "password": "secret123"
}
```

Response (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "username": "juan_perez",
  "node": "aldea-semilla-viva.org",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

The `token` is a JWT (HS256, 7-day expiry). Store it securely and send it as `Authorization: Bearer {token}` on all authenticated requests.

**Error (401):** `{"error": "invalid credentials"}`

### 4.2 Terminal Authentication (Ed25519)

For NFC terminal operations, the app must register as a terminal and authenticate with Ed25519 signatures. This is separate from JWT auth. See section 6 for the full cryptographic protocol.

### 4.3 Passkey Login (Optional)

The backend also supports WebAuthn/Passkey login via:

- **POST `/auth/login/begin`** — begins passkey login
- **POST `/auth/login/finish`** — finishes passkey login

These follow the WebAuthn standard. On Android, you can use the Credential Manager API with Passkeys. The response includes a JWT token just like password login.

---

## 5. Complete API Endpoints

### 5.1 POS QR Endpoints

#### Create Charge (Merchant)

**POST `/pos/charge`** — Requires JWT auth

Headers:
```
Authorization: Bearer {jwt}
X-Terminal-ID: {optional terminal_id}
```

Request:
```json
{
  "amount": 50000,
  "description": "Compra de verduras"
}
```

Response (201):
```json
{
  "charge_id": "uuid-here",
  "charge_token": "uuid-token-here",
  "amount": 50000,
  "status": "pending",
  "expires_at": "2026-08-26T12:10:00Z"
}
```

The QR code should encode: `{server_url}{base_path}/pay?t={charge_token}`

#### Get Charge Status (Merchant polling)

**GET `/pos/charge/{id}/status`** — Requires JWT auth

Response (200):
```json
{
  "charge_id": "uuid",
  "amount": 50000,
  "status": "pending",
  "payment_method": "qr",
  "paid_at": "2026-08-26T12:05:00Z"
}
```

Statuses: `pending`, `paid`, `expired`, `cancelled`

#### Get Charge Info (Public, no auth needed)

**GET `/pos/charge/{token}/info`**

Response (200):
```json
{
  "amount": 50000,
  "status": "pending",
  "description": "Compra de verduras",
  "merchant_name": "Juan Perez",
  "expires_at": "2026-08-26T12:10:00Z"
}
```

#### Pay Charge (Customer confirms)

**POST `/pos/charge/{token}/pay`** — Requires JWT auth (customer's JWT)

Request:
```json
{
  "payment_method": "qr"
}
```

Response (200):
```json
{
  "status": "paid",
  "amount": 50000,
  "new_balance": 150000,
  "payment_method": "qr"
}
```

Errors:
- 400: `"saldo insuficiente"` (insufficient balance)
- 400: `"charge is already paid/expired/cancelled"`
- 400: `"cannot pay yourself"`
- 400: `"charge has expired"`

#### Cancel Charge

**POST `/pos/charge/{id}/cancel`** — Requires JWT auth

Response (200):
```json
{
  "status": "cancelled"
}
```

### 5.2 NFC Terminal Endpoints (Ed25519 auth, NOT JWT)

These endpoints use terminal Ed25519 authentication, not JWT. The app must first register as a terminal.

#### Complete Registration

**POST `/nfc/terminal/complete-registration`**

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "registration_token": "uuid-token-from-server",
  "terminal_public_key": "hex-encoded-32-byte-ed25519-public-key",
  "device_fingerprint": "android-device-fingerprint"
}
```

Response (200):
```json
{
  "server_public_key": "hex-encoded-32-byte-ed25519-public-key",
  "status": "registered"
}
```

#### Terminal Auth

**POST `/nfc/terminal/auth`**

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "signature": "hex-encoded-64-byte-ed25519-signature",
  "nonce": "hex-encoded-16-byte-random-nonce",
  "device_fingerprint": "android-device-fingerprint"
}
```

The signature is over the message: `{terminal_id}:{nonce}` (or `{terminal_id}:{nonce}:{device_fingerprint}` if fingerprint is set).

Response (200):
```json
{
  "session_token": "uuid-session-token",
  "signature": "hex-encoded-64-byte-server-signature-over-session_token"
}
```

Verify the server's signature over `session_token` using the server's public key.

#### Heartbeat

**POST `/nfc/terminal/heartbeat`**

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC"
}
```

Response (200):
```json
{
  "status": "ok",
  "active": true,
  "signature": "hex-encoded-signature"
}
```

If `active` is `false`, the terminal has been deactivated by the owner and should stop accepting payments.

#### Get Terminal Status

**GET `/nfc/terminal/{id}/status`**

Response (200): Terminal object (see below)

#### Create Session

**POST `/nfc/terminal/session`**

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "merchant_user_id": "uuid-of-merchant-user"
}
```

Response (201):
```json
{
  "id": "uuid",
  "terminal_id": "uuid",
  "session_token": "uuid-session-token",
  "merchant_user_id": "uuid-or-null",
  "current_amount": null,
  "status": "idle",
  "expires_at": "2026-08-26T12:05:00Z",
  "created_at": "2026-08-26T12:00:00Z"
}
```

#### Set Session Amount

**PUT `/nfc/terminal/session/amount`**

Request:
```json
{
  "session_token": "uuid-session-token",
  "amount": 50000
}
```

Response (200): Updated session object with `status: "waiting_card"`

#### Process NFC Payment (Single card)

**POST `/nfc/terminal/payment`**

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "encrypted_payload": {
    "nonce": "hex-12-bytes",
    "ciphertext": "hex-encrypted-payload",
    "signature": "hex-64-bytes-ed25519-signature-over-ciphertext"
  }
}
```

The decrypted payload (JSON) inside `encrypted_payload` is:
```json
{
  "card_uid": "AABBCCDDEEFF",
  "crypto_token": "desfire_auth_ok",
  "pin": "1234",
  "amount": 50000,
  "timestamp": 1234567890,
  "nonce": "random-string"
}
```

Response (200) — also encrypted with the shared key:
```json
{
  "nonce": "hex-12-bytes",
  "ciphertext": "hex-encrypted-response",
  "signature": "hex-64-bytes-server-signature"
}
```

After decryption, the response is:
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "message": "transaccion aprobada",
  "user_balance": 150000
}
```

Or on rejection:
```json
{
  "status": "rejected",
  "message": "PIN incorrecto"
}
```

Rejection messages: `"tarjeta no encontrada o inactiva"`, `"tarjeta bloqueada por intentos de PIN"`, `"PIN incorrecto"`, `"saldo insuficiente"`

#### Process Community Payment (Two cards: seller + buyer)

**POST `/nfc/terminal/payment/community`**

Same encrypted envelope format. Decrypted payload:
```json
{
  "seller_card_uid": "AABBCCDDEEFF",
  "seller_crypto_token": "desfire_auth_ok",
  "seller_pin": "1234",
  "buyer_card_uid": "112233445566",
  "buyer_crypto_token": "uid_only_token",
  "buyer_pin": "5678",
  "amount": 50000,
  "timestamp": 1234567890,
  "nonce": "random-string"
}
```

This is used for **multi-vendor mode**: the seller (vendor) taps first, then the buyer (customer) taps.

Response (decrypted):
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "message": "transaccion comunitaria aprobada",
  "user_balance": 150000
}
```

Rejection messages: `"tarjeta vendedora no encontrada"`, `"tarjeta compradora no encontrada"`, `"vendedor y comprador son la misma persona"`, `"PIN del vendedor incorrecto"`, `"PIN del comprador incorrecto"`, `"saldo insuficiente del comprador"`, `"tarjeta compradora bloqueada"`

#### Get Terminal Session

**GET `/nfc/terminal/{id}/session`**

Returns the current session for the terminal (used for polling pending amounts in web terminal mode).

### 5.3 NFC Terminal Management (JWT auth + permissions)

#### List Terminals

**GET `/nfc/terminals`** — Requires JWT

Response (200): Array of terminal objects:
```json
[
  {
    "id": "uuid",
    "node_domain": "aldea-semilla-viva.org",
    "terminal_id": "TERM-KEYPAD-AABBCC",
    "label": "Feria",
    "terminal_type": "keypad",
    "location": "Plaza",
    "is_active": true,
    "is_registered": true,
    "last_seen": "2026-08-26T12:00:00Z",
    "firmware_version": "",
    "created_at": "2026-08-20T10:00:00Z",
    "updated_at": "2026-08-26T12:00:00Z"
  }
]
```

#### List Terminal Types

**GET `/nfc/terminals/types`** — Requires JWT

Response (200): `["keypad", "web", "touch", "community"]`

#### Register Terminal

**POST `/nfc/terminal/register`** — Requires JWT + `nfc.register_terminal` permission

Request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "label": "Feria",
  "terminal_type": "keypad",
  "location": "Plaza",
  "wifi_ssid": "",
  "device_fingerprint": "android-fingerprint"
}
```

Response (201):
```json
{
  "terminal": { ... },
  "registration_token": "uuid-token"
}
```

#### Provision Terminal (linked to hardware chip ID)

**POST `/nfc/terminal/provision`** — Requires JWT + `nfc.register_terminal` permission

Request:
```json
{
  "chip_id": "AABBCCDDEEFF",
  "terminal_type": "keypad",
  "label": "Feria",
  "location": "Plaza",
  "terminal_id": "optional-custom-id",
  "server_url": "optional-override"
}
```

Response (201):
```json
{
  "terminal": { ... },
  "registration_token": "uuid-token",
  "server_url": "https://aldea-semilla-viva.org",
  "config_h_url": "/api/nfc/terminal/TERM-KEYPAD-AABBCC/config.h"
}
```

#### Deactivate Terminal

**DELETE `/nfc/terminal/{id}`** — Requires JWT + `nfc.deactivate_terminal` permission

#### Assign Terminal to Organization

**POST `/nfc/terminal/{id}/assign`** — Requires JWT + `nfc.register_terminal` permission

### 5.4 My Terminals (User's assigned terminals)

#### List My Terminals

**GET `/nfc/my-terminals`** — Requires JWT

#### Toggle My Terminal

**POST `/nfc/my-terminals/{id}/toggle`** — Requires JWT

#### List My Terminal Transactions

**GET `/nfc/my-terminals/{id}/transactions`** — Requires JWT

#### Open Shift

**POST `/nfc/my-terminals/{id}/shift`** — Requires JWT

#### Close Shift

**POST `/nfc/my-terminals/{id}/shift/close`** — Requires JWT

### 5.5 NFC Cards

#### Issue Crypto Card

**POST `/nfc/cards/issue`** — Requires JWT + `nfc.issue_card` permission

Request:
```json
{
  "user_id": "uuid-of-user",
  "card_uid": "AABBCCDDEEFF",
  "card_type": "uid_only",
  "initial_pin": "1234"
}
```

Card types: `uid_only`, `desfire`

Response (201):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "card_uid": "AABBCCDDEEFF",
  "is_active": true,
  "issued_at": "2026-08-26T12:00:00Z",
  "deactivated_at": null
}
```

#### List Cards

**GET `/nfc/cards?user_id={uuid}`** — Requires JWT

#### Deactivate Card

**DELETE `/nfc/cards/{uid}`** — Requires JWT + `nfc.deactivate_card` permission

#### Change Card PIN

**PUT `/nfc/cards/pin`** — Requires JWT

Request:
```json
{
  "card_uid": "AABBCCDDEEFF",
  "old_pin": "1234",
  "new_pin": "5678"
}
```

#### Reset Card PIN

**PUT `/nfc/cards/{uid}/pin/reset`** — Requires JWT + `nfc.reset_pin` permission

Request:
```json
{
  "new_pin": "1234"
}
```

### 5.6 Card Crypto (Secure cards - DESFire/NTAG424)

#### Request Card Key

**POST `/nfc/cards/{uid}/request-key`**

The app requests the AES key for a card. The request body is encrypted (same envelope as payment). The terminal must be authenticated.

Decrypted request:
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC"
}
```

Decrypted response:
```json
{
  "aes_key_hex": "32-char-hex-string-16-bytes"
}
```

**IMPORTANT:** The AES key must be kept in memory only, never written to disk. Clear it immediately after use.

#### Generate Challenge

**POST `/nfc/cards/{uid}/challenge`**

Server generates a random challenge for the card to respond to (anti-replay).

#### Verify Response

**POST `/nfc/cards/{uid}/verify-response`**

Terminal sends the card's HMAC/AES response to the challenge. Server verifies.

#### Verify SUN (NTAG424)

**POST `/nfc/cards/{uid}/verify-sun`**

For NTAG424 SUN cards, verify the MAC read from the card.

#### Key Rotation

- **POST `/nfc/cards/{uid}/rotate-key`** — Rotate the AES key (admin)
- **POST `/nfc/cards/{uid}/prepare-rotation`** — Prepare key rotation (terminal writes new key K' to card)
- **POST `/nfc/cards/{uid}/confirm-rotation`** — Confirm rotation succeeded
- **POST `/nfc/cards/{uid}/fail-rotation`** — Report rotation failure
- **POST `/nfc/cards/{uid}/recover`** — Recover from failed rotation
- **GET `/nfc/cards/{uid}/pending-rotation`** — Check if rotation is pending
- **GET `/nfc/cards/{uid}/rotations`** — Rotation history

#### Card Crypto Status

**GET `/nfc/cards/{uid}/crypto-status`**

#### Block Card Crypto

**POST `/nfc/cards/{uid}/block-crypto`** — Requires JWT + `nfc.register_terminal` permission

### 5.7 Card Type Configuration (Per Node)

#### Get Card Type Config

**GET `/nfc/card-type/config`** — Requires JWT

Response:
```json
{
  "node_domain": "aldea-semilla-viva.org",
  "card_type_mode": "dual",
  "require_crypto": false,
  "auto_rotate_key": true,
  "max_write_fails": 3,
  "uid_only_message": "Esta tarjeta no tiene seguridad criptografica. Usa PIN para proteger."
}
```

Modes:
- `uid_only` — Only accept cheap UID cards (UID + PIN)
- `desfire` — Only accept secure DESFire cards
- `dual` — Accept both (auto-detect)

**NEW FIELD needed:** The app should also check a new config field `require_id_document_for_uid_only` (boolean). If `true`, UID-only cards must also provide an ID document number. See section 12.

#### Update Card Type Config

**POST `/nfc/card-type/config`** — Requires JWT + `config.manage` permission

### 5.8 Transactions

#### List NFC Transactions

**GET `/nfc/transactions?limit=50`** — Requires JWT

Response (200): Array of transaction objects:
```json
[
  {
    "id": "uuid",
    "terminal_id": "uuid",
    "card_uid": "AABBCCDDEEFF",
    "user_id": "uuid",
    "amount": 50000,
    "status": "approved",
    "crypto_token": "desfire_auth_ok",
    "pin_verified": true,
    "transaction_type": "single",
    "seller_user_id": null,
    "buyer_user_id": null,
    "error_message": "",
    "created_at": "2026-08-26T12:00:00Z"
  }
]
```

### 5.9 User Documents (for ID verification)

The backend has these tables for user identity documents:

- `users.national_id` — National ID number (text)
- `users.national_id_type` — Type of ID (text, e.g. "cedula", "dni", "pasaporte")
- `users.national_id_country` — Country ISO2 code
- `user_documents` — Multiple documents per user
- `document_types` — Catalog of document types

#### Document Types (seeded in DB):

| code | spanish_name |
|------|-------------|
| cedula | Cédula de identidad |
| dni | Documento Nacional de Identidad |
| pasaporte | Pasaporte |
| rut | Registro Único Tributario |
| curp | Clave Única de Registro de Población |
| carnet_conducir | Carnet de Conducir |
| cedula_juridica | Cédula Jurídica |
| residencia | Permiso de Residencia |
| refugiado | Documento de Refugiado |
| otro | Otro |

**NEW ENDPOINT needed for ID verification:** The app needs to verify the ID document number matches the card owner. See section 12 for the proposed flow.

---

## 6. Cryptographic Protocol (Terminal NFC)

The NFC terminal communication uses **mutual Ed25519 authentication** with **ECDH key exchange** and **AES-256-GCM** encryption.

### 6.1 Key Generation

On first registration, the app generates an **Ed25519 keypair** (32-byte private key + 32-byte public key). Store the private key in **Android Keystore** (hardware-backed if available). Never write it to plain storage.

```
ed25519_private_key (32 bytes) → stored in Android Keystore
ed25519_public_key (32 bytes)  → can be stored in SharedPreferences (hex)
```

### 6.2 Registration Flow

1. Admin registers the terminal on the web admin panel → gets `terminal_id` and `registration_token`.
2. App sends `terminal_id`, `registration_token`, and `terminal_public_key` (hex) to `POST /nfc/terminal/complete-registration`.
3. Server responds with `server_public_key` (hex, 32 bytes).
4. App stores `server_public_key` securely.

### 6.3 ECDH Shared Key Derivation

The shared encryption key is derived using **ECDH on Curve25519**:

1. Convert Ed25519 private key → Curve25519 private key:
   - `hash = SHA-512(ed25519_private_key_seed)` (take first 32 bytes)
   - Clamp: `hash[0] &= 248; hash[31] &= 127; hash[31] |= 64`

2. Convert Ed25519 public key → Curve25519 public key:
   - `hash = SHA-512(ed25519_public_key)` (take first 32 bytes)
   - Clamp: same as above

3. Compute shared secret:
   - `raw_shared = X25519(curve25519_private, curve25519_public)`

4. Derive AES key:
   - `shared_key = SHA-256(raw_shared)` (32 bytes)

This `shared_key` is used for all AES-256-GCM encryption between terminal and server.

### 6.4 Authentication Flow

1. Generate a random 16-byte `nonce` (hex string).
2. Sign the message `{terminal_id}:{nonce}` (or `{terminal_id}:{nonce}:{device_fingerprint}`) with the terminal's Ed25519 private key.
3. Send `terminal_id`, `nonce`, `signature` (hex, 64 bytes), and `device_fingerprint` to `POST /nfc/terminal/auth`.
4. Server verifies the signature using the terminal's stored public key.
5. Server responds with `session_token` and a `signature` (server signs `session_token` with its private key).
6. App verifies the server's signature using `server_public_key`.
7. Store `session_token` for the session.

### 6.5 Encrypted Message Format

All payment payloads are encrypted. The format is:

**Request (terminal → server):**
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "encrypted_payload": {
    "handshake": {
      "ephemeral_public_key": "hex-32-bytes",
      "identity_signature": "hex-64-bytes",
      "nonce": "hex-string"
    },
    "nonce": "hex-12-bytes",
    "ciphertext": "hex-encrypted-data",
    "signature": "hex-64-bytes-ed25519-signature-over-ciphertext"
  }
}
```

**Simplified format (used by ESP32 firmware, recommended for Android too):**
```json
{
  "terminal_id": "TERM-KEYPAD-AABBCC",
  "encrypted_payload": {
    "nonce": "hex-12-bytes",
    "ciphertext": "hex-encrypted-data",
    "signature": "hex-64-bytes-ed25519-signature-over-ciphertext"
  }
}
```

### 6.6 Encryption Steps

1. Serialize the payment payload as JSON.
2. Generate a random 12-byte `nonce`.
3. Encrypt with **AES-256-GCM** using the `shared_key` and `nonce`:
   - `ciphertext = AES-256-GCM-Encrypt(shared_key, nonce, plaintext)`
   - The GCM tag (16 bytes) is appended to the ciphertext.
4. Sign the `ciphertext` (including GCM tag) with the terminal's Ed25519 private key:
   - `signature = Ed25519-Sign(terminal_private_key, ciphertext)`
5. Hex-encode `nonce`, `ciphertext`, and `signature`.

### 6.7 Decryption Steps (server response)

1. Parse `nonce`, `ciphertext`, `signature` from the response JSON.
2. Verify the server's Ed25519 signature over `ciphertext` using `server_public_key`.
3. Decrypt with AES-256-GCM:
   - `plaintext = AES-256-GCM-Decrypt(shared_key, nonce, ciphertext)`
   - The last 16 bytes of ciphertext are the GCM tag.
4. Parse the decrypted JSON.

### 6.8 Device Fingerprint

Generate a stable device fingerprint unique to this Android device:
- Use `Settings.Secure.ANDROID_ID` (or a combination of hardware identifiers).
- Hash it to produce a stable string.
- Send it during registration and authentication.
- The server uses it to detect terminal cloning.

---

## 7. NFC Payment Flow (Step by Step)

### 7.1 Single Payment (Standard NFC)

1. **Merchant opens shift** (optional but recommended):
   - `POST /nfc/my-terminals/{id}/shift` with JWT

2. **Merchant enters amount** in the app.

3. **App creates/updates terminal session**:
   - `POST /nfc/terminal/session` with `terminal_id` and `merchant_user_id`
   - `PUT /nfc/terminal/session/amount` with `session_token` and `amount`

4. **Customer taps NFC card** on the phone.

5. **App reads card**:
   - Read UID (hex string, uppercase)
   - Detect card type: `uid_only` or `desfire`
   - If DESFire: request AES key from server, authenticate with card, get `crypto_token = "desfire_auth_ok"`
   - If UID-only: `crypto_token = card.uid`

6. **App asks customer for PIN** (4 digits, entered on merchant's phone).

7. **NEW: If card is UID-only and node config requires ID document**:
   - App asks customer for ID document type (dropdown) and document number (text field)
   - See section 12 for details

8. **App encrypts payment payload**:
   ```json
   {
     "card_uid": "AABBCCDDEEFF",
     "crypto_token": "desfire_auth_ok",
     "pin": "1234",
     "amount": 50000,
     "timestamp": 1234567890,
     "nonce": "random-string"
   }
   ```
   (If ID document verification is needed, add `"id_document_type"` and `"id_document_number"` fields — see section 12)

9. **App sends encrypted payment** to `POST /nfc/terminal/payment`

10. **App decrypts response** and shows result:
    - `approved` → Show success, beep/vibrate, display new balance
    - `rejected` → Show error message, beep differently

11. **If DESFire and approved**: perform key rotation (see section 7.3)

12. **Clear AES key from memory** immediately.

### 7.2 Community Payment (Multi-Vendor NFC)

1. **Phone owner enables multi-vendor mode** in app settings.

2. **Vendor taps their card** on the phone.
   - App reads vendor's card UID.
   - App identifies vendor (the card is linked to a user account on the server).
   - App shows vendor's name and account.

3. **Vendor enters amount** to charge.

4. **Phone is passed to customer**.

5. **Customer taps their card** on the phone.
   - App reads customer's card UID.

6. **App asks customer for PIN** (and ID document if UID-only).

7. **App encrypts community payment payload**:
   ```json
   {
     "seller_card_uid": "AABBCCDDEEFF",
     "seller_crypto_token": "desfire_auth_ok",
     "seller_pin": "1234",
     "buyer_card_uid": "112233445566",
     "buyer_crypto_token": "uid_only_token",
     "buyer_pin": "5678",
     "amount": 50000,
     "timestamp": 1234567890,
     "nonce": "random-string"
   }
   ```
   (Add `buyer_id_document_type` and `buyer_id_document_number` if needed)

8. **App sends** to `POST /nfc/terminal/payment/community`

9. **App decrypts response** and shows result.
   - Money is debited from buyer (customer) and credited to seller (vendor).

10. **Phone owner can end multi-vendor mode** or process another sale.

### 7.3 DESFire Key Rotation (After Successful Payment)

If the card is DESFire and `auto_rotate_key` is `true` in the node config:

1. **Prepare rotation**: App generates a new AES key K', writes it to the card.
   - `POST /nfc/cards/{uid}/prepare-rotation` (encrypted, with new key)

2. **Confirm rotation**: If the card accepted the new key:
   - `POST /nfc/cards/{uid}/confirm-rotation`

3. **Fail rotation**: If the write failed:
   - `POST /nfc/cards/{uid}/fail-rotation`
   - Server reverts to the old key.

4. **Recovery**: If a rotation is stuck in `pending` state:
   - `POST /nfc/cards/{uid}/recover`

---

## 8. QR Payment Flow (Step by Step)

### 8.1 Merchant Side (Creating the charge)

1. **Merchant logs in** (JWT auth).

2. **Merchant enters amount** and optional description.

3. **App creates charge**:
   ```
   POST /pos/charge
   { "amount": 50000, "description": "Compra de verduras" }
   ```
   With header `X-Terminal-ID: {terminal_id}` (optional).

4. **App receives** `charge_token` and `expires_at` (10 minutes).

5. **App displays QR code** encoding: `{server_url}{base_path}/pay?t={charge_token}`
   - Use a QR code library (e.g., ZXing) to render the QR.
   - Show the amount and merchant name on screen.

6. **App polls charge status** every 2-3 seconds:
   ```
   GET /pos/charge/{charge_id}/status
   ```

7. **When status becomes `paid`**: Show success, play sound, vibrate.
   **When status becomes `expired`**: Show "Código QR expirado", allow creating a new one.
   **When status becomes `cancelled`**: Show "Pago cancelado".

8. **Merchant can cancel** the charge at any time:
   ```
   POST /pos/charge/{charge_id}/cancel
   ```

### 8.2 Customer Side (Paying the charge)

The customer does NOT use the merchant's app to pay. They use their own phone:

1. Customer scans the QR with their phone's camera (or the app's QR scanner).
2. The URL opens: `{server_url}{base_path}/pay?t={charge_token}`
3. The app (or web browser) calls `GET /pos/charge/{token}/info` to see the amount and merchant.
4. Customer logs in if not already authenticated.
5. Customer confirms payment:
   ```
   POST /pos/charge/{token}/pay
   { "payment_method": "qr" }
   ```
6. Customer sees success with their new balance.

**Note:** The QR mode does NOT require NFC. The customer pays from their own device. The merchant's app only creates the charge and polls for status.

---

## 9. Multi-Vendor NFC Flow (Detailed)

This mode allows a phone owner to lend their phone to another vendor.

### Setup

1. Phone owner logs in with their JWT.
2. Phone owner enables "Modo Multi-Vendedor" in app settings.
3. App enters multi-vendor state.

### Per-Sale Flow

1. **App shows "Acerque la tarjeta del vendedor"** (Tap vendor's card).

2. **Vendor taps their NFC card**.
   - App reads card UID.
   - App calls the backend to identify the user (the card UID is linked to a user via `nfc_cards` table).
   - App shows: "Vendedor: {name}, Cuenta: @{username}"

3. **Vendor enters amount** on the phone.
   - App shows numeric keypad.
   - Vendor enters the amount to charge.

4. **App shows "Acerque la tarjeta del cliente"** (Tap customer's card).

5. **Customer taps their NFC card**.
   - App reads card UID.
   - App verifies it's a different card from the vendor's.

6. **App asks customer for PIN** (on the phone).
   - **If UID-only card and node requires ID document**: also ask for ID document type and number.

7. **App sends community payment** (encrypted):
   ```
   POST /nfc/terminal/payment/community
   ```
   With `seller_card_uid` = vendor's card, `buyer_card_uid` = customer's card.

8. **App shows result**:
   - Approved: "Pago aprobado. {amount} TQ de {customer_name} a {vendor_name}"
   - Rejected: Show error message.

9. **App returns to step 1** (next sale) or phone owner ends multi-vendor mode.

### Ending Multi-Vendor Mode

- Phone owner taps "Salir de modo multi-vendedor" button.
- App returns to normal single-vendor mode.

---

## 10. Database Schema (Relevant Tables)

### `users`
```sql
id              UUID PRIMARY KEY
node_domain     TEXT
username        TEXT
display_name    TEXT
account_type    TEXT  -- 'individual' or 'organization'
balance         BIGINT  -- current balance in TQ micro-units
membership_status TEXT  -- 'active', 'pending', etc.
national_id     TEXT  -- ID document number
national_id_type TEXT -- 'cedula', 'dni', etc.
national_id_country TEXT -- ISO2 country code
payment_pin_hash TEXT  -- payment PIN (bcrypt hash)
```

### `nfc_terminals`
```sql
id                  UUID PRIMARY KEY
node_domain         TEXT
terminal_id         TEXT UNIQUE  -- human-readable ID like "TERM-KEYPAD-AABBCC"
label               TEXT
terminal_type       TEXT  -- 'keypad', 'web', 'touch', 'community'
location            TEXT
wifi_ssid           TEXT
chip_id             TEXT  -- hardware binding (ESP32 efuse MAC)
terminal_public_key TEXT  -- Ed25519 public key (hex)
server_public_key   TEXT
registration_token  TEXT  -- null after registration complete
device_fingerprint  TEXT
merchant_user_id    UUID  -- currently assigned merchant
organization_id     UUID  -- organization that owns the terminal
department_id       UUID
is_active           BOOLEAN
is_registered       BOOLEAN
last_seen           TIMESTAMPTZ
firmware_version    TEXT
block_code_hash     TEXT  -- local lock code (bcrypt)
```

### `nfc_terminal_sessions`
```sql
id                  UUID PRIMARY KEY
terminal_id         UUID REFERENCES nfc_terminals(id)
session_token       TEXT UNIQUE
merchant_user_id    UUID REFERENCES users(id)
current_amount      BIGINT
status              TEXT  -- 'idle', 'waiting_card', etc.
seller_card_uid     TEXT
seller_pin_verified BOOLEAN
buyer_card_uid      TEXT
expires_at          TIMESTAMPTZ  -- 5 minutes
created_at          TIMESTAMPTZ
```

### `nfc_cards`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
card_uid        TEXT UNIQUE
is_active       BOOLEAN
card_type       TEXT  -- 'uid_only', 'desfire'
crypto_enabled  BOOLEAN
pin_hash        TEXT  -- bcrypt hash of PIN
pin_attempts    INT
blocked_until   TIMESTAMPTZ
last_token_at   TIMESTAMPTZ
card_error      TEXT  -- 'write_fail', 'auth_fail', or null
error_at        TIMESTAMPTZ
issued_at       TIMESTAMPTZ
deactivated_at  TIMESTAMPTZ
```

### `nfc_card_keys` (Cryptographic keys for secure cards)
```sql
id                      UUID PRIMARY KEY
card_uid                TEXT UNIQUE
node_domain             TEXT
user_id                 UUID REFERENCES users(id)
card_type               TEXT
secret_key_encrypted    BYTEA
aes_key_encrypted       BYTEA  -- AES-128 key encrypted with node master key
key_version             INT
card_public_key         TEXT
last_auth_at            TIMESTAMPTZ
auth_fail_count         INT
crypto_blocked_until    TIMESTAMPTZ
sun_counter             BIGINT  -- NTAG424 counter
pending_key_encrypted   BYTEA  -- key rotation: new key K'
rotation_status         TEXT  -- 'active', 'pending', 'error'
write_fail_count        INT
last_rotation_at        TIMESTAMPTZ
provisioned_by          UUID
provisioned_at          TIMESTAMPTZ
```

### `nfc_card_attempts` (PIN attempt tracking)
```sql
card_uid        TEXT PRIMARY KEY
attempt_count   INT
last_attempt_at TIMESTAMPTZ
blocked_until   TIMESTAMPTZ  -- blocked after 3 failed attempts for 15 minutes
```

### `nfc_transactions`
```sql
id                UUID PRIMARY KEY
terminal_id       UUID REFERENCES nfc_terminals(id)
card_uid          TEXT
user_id           UUID REFERENCES users(id)
amount            BIGINT
status            TEXT  -- 'approved', 'rejected'
crypto_token      TEXT
pin_verified      BOOLEAN
transaction_type  TEXT  -- 'single', 'community', 'pos_qr'
seller_user_id    UUID
buyer_user_id     UUID
server_response   JSONB
error_message     TEXT
created_at        TIMESTAMPTZ
```

### `nfc_server_keys` (Server Ed25519 keypair)
```sql
id                       UUID PRIMARY KEY
node_domain              TEXT UNIQUE
public_key               TEXT  -- Ed25519 public key (hex)
private_key_encrypted    BYTEA
created_at               TIMESTAMPTZ
```

### `nfc_card_type_config` (Per-node card type settings)
```sql
node_domain             TEXT UNIQUE
card_type_mode          TEXT  -- 'uid_only', 'desfire', 'dual'
require_crypto          BOOLEAN
auto_rotate_key         BOOLEAN
max_write_fails         INT
uid_only_message        TEXT
```

### `pos_charges` (QR payment charges)
```sql
id                  UUID PRIMARY KEY
node_domain         TEXT
terminal_id         UUID REFERENCES nfc_terminals(id)
merchant_id         UUID NOT NULL REFERENCES users(id)
charge_token        TEXT UNIQUE
amount              BIGINT
status              TEXT  -- 'pending', 'paid', 'expired', 'cancelled'
payer_id            UUID REFERENCES users(id)
paid_at             TIMESTAMPTZ
payment_method      TEXT  -- 'qr', 'nfc'
description         TEXT
terminal_signature  TEXT
shift_id            UUID REFERENCES pos_shifts(id)
created_at          TIMESTAMPTZ
expires_at          TIMESTAMPTZ  -- 10 minutes
```

### `pos_shifts` (Terminal shifts)
```sql
id                UUID PRIMARY KEY
terminal_id       UUID REFERENCES nfc_terminals(id)
user_id           UUID REFERENCES users(id)
organization_id   UUID
department_id     UUID
status            TEXT  -- 'open', 'closed'
opened_at         TIMESTAMPTZ
closed_at         TIMESTAMPTZ
opening_amount    BIGINT
closing_amount    BIGINT
total_sales       BIGINT
transactions_count INT
notes             TEXT
```

### `user_documents` (ID documents)
```sql
id                  UUID PRIMARY KEY
user_id             UUID REFERENCES users(id)
document_type_code  TEXT REFERENCES document_types(code)
document_number     TEXT
country_iso2        CHAR(2)
country_name        TEXT
photo_url           TEXT
is_verified         BOOLEAN
verified_at         TIMESTAMPTZ
```

### `document_types` (Catalog)
```sql
code            TEXT UNIQUE  -- 'cedula', 'dni', 'pasaporte', etc.
name            TEXT
spanish_name    TEXT
is_international BOOLEAN
sort_order      INT
```

### `nfc_card_challenges` (Anti-replay)
```sql
card_uid        TEXT
challenge       TEXT  -- random nonce sent to card
expected_response TEXT  -- HMAC of challenge
terminal_id     TEXT
used            BOOLEAN
expires_at      TIMESTAMPTZ  -- 60 seconds
```

### `card_key_sessions` (Key distribution audit)
```sql
card_uid            TEXT
terminal_id         TEXT
session_token       TEXT UNIQUE
key_delivered       BOOLEAN
challenge_verified  BOOLEAN
expires_at          TIMESTAMPTZ  -- 5 minutes
```

### `card_key_rotations` (Key rotation history)
```sql
card_uid        TEXT
node_domain     TEXT
old_key_version INT
new_key_version INT
status          TEXT  -- 'pending', 'confirmed', 'failed', 'recovered'
terminal_id     TEXT
error_message   TEXT
duration_ms     INT
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
```

---

## 11. Card Types

### UID-Only Cards (Cheap, clonable)

- **Card types:** MIFARE Classic, standard UID cards
- **Security:** UID + PIN only
- **Vulnerability:** UID can be cloned. Security relies on PIN.
- **NEW:** When node config requires it, also ask for ID document number (see section 12).
- **Crypto token sent to server:** `card.uid` (the UID hex string itself)
- **Detection:** Does NOT respond to DESFire `GetVersion` command (0x60)

### DESFire EV3 Cards (Secure)

- **Card type:** NXP DESFire EV3
- **Security:** AES-128 challenge-response authentication
- **Key rotation:** Server can rotate the AES key after each transaction
- **Crypto token sent to server:** `"desfire_auth_ok"` (after successful authentication)
- **Detection:** Responds to DESFire `GetVersion` command (0x60) with SW1=0x91

### NTAG424 SUN Cards (Secure)

- **Card type:** NTAG424
- **Security:** SUN MAC (AES) generated on each tap
- **Crypto token:** MAC read from NDEF message
- **Detection:** (Placeholder in current firmware — fallback to UID)

### Node Configuration

Each node configures which card types to accept via `nfc_card_type_config`:

| Mode | Accepts |
|------|---------|
| `uid_only` | Only UID-only cards |
| `desfire` | Only DESFire/NTAG424 cards |
| `dual` | Both (auto-detect, recommended) |

If `require_crypto` is `true`, the node rejects UID-only cards entirely.

If `auto_rotate_key` is `true`, DESFire cards rotate their AES key after each successful payment.

---

## 12. NEW FEATURE: ID Document Verification for UID-Only Cards

### Rationale

UID-only cards are cheap and their UID can be cloned. To add a layer of security, when a UID-only card is used, the app should also ask the customer for their **ID document number** (cédula, DNI, passport, etc.). This verifies that the person holding the card is the legitimate owner, since they must know the document number registered in the system.

### When to Apply

- **Only for UID-only cards** (not for DESFire secure cards)
- **Only if the node has it configured** — add a new config field `require_id_document_for_uid_only` (boolean, default `false`) to `nfc_card_type_config`
- The app should call `GET /nfc/card-type/config` and check this field

### Flow

1. Customer taps UID-only card.
2. App asks for PIN (as usual).
3. **App also asks for ID document type** (dropdown with `document_types` values) and **document number** (text field).
4. App sends the payment payload with additional fields:
   ```json
   {
     "card_uid": "AABBCCDDEEFF",
     "crypto_token": "AABBCCDDEEFF",
     "pin": "1234",
     "id_document_type": "cedula",
     "id_document_number": "V12345678",
     "amount": 50000,
     "timestamp": 1234567890,
     "nonce": "random-string"
   }
   ```
5. **Backend verifies** that the `id_document_number` matches the `national_id` (or `user_documents`) of the user who owns the card.
6. If it doesn't match, the payment is rejected with: `"documento de identidad no coincide"`.

### Backend Changes Needed (describe to the user, do NOT implement)

The backend needs to:
1. Add `require_id_document_for_uid_only BOOLEAN DEFAULT false` to `nfc_card_type_config` table.
2. In `ProcessNFCPayment` (Go), when `card_type == "uid_only"` and the node config has `require_id_document_for_uid_only == true`, verify that the provided `id_document_number` matches the card owner's `national_id` or any `user_documents.document_number`.
3. If verification fails, return `{"status": "rejected", "message": "documento de identidad no coincide"}`.
4. The same applies to `ProcessCommunityPayment` for the buyer's card.

> **UPDATE: This feature is now IMPLEMENTED in the backend.** The migration `123_multisig_payments_and_id_verification.sql` adds the `require_id_document_for_uid_only` column. The `ProcessNFCPayment` and `ProcessCommunityPayment` functions now verify the ID document when the card is UID-only and the node config requires it. The `GET /api/nfc/card-type/config` endpoint now returns the `require_id_document_for_uid_only` field. The `POST /api/nfc/card-type/config` endpoint now accepts it.

### UI Design

- Show a dropdown for document type (cedula, dni, pasaporte, etc.)
- Show a text field for document number
- Show a note: "Esta tarjeta requiere verificación de identidad adicional"
- The document number should be masked after entry (show only last 4 digits)

---

## 13. Permissions

The backend uses a permission system. Relevant permissions for the POS app:

| Permission | Description | Needed for |
|-----------|-------------|------------|
| `nfc.register_terminal` | Register/provision terminals | Terminal registration, provisioning, firmware |
| `nfc.deactivate_terminal` | Deactivate terminals | Deactivating a terminal |
| `nfc.issue_card` | Issue NFC cards to users | Issuing new cards |
| `nfc.deactivate_card` | Deactivate cards | Deactivating a card |
| `nfc.reset_pin` | Reset card PIN | Resetting a forgotten PIN |
| `nfc.view_transactions` | View NFC transactions | Viewing transaction history |
| `config.manage` | Manage node config | Changing card type config |

The app should call `GET /auth/me` or similar to get the user's permissions and show/hide UI elements accordingly.

---

## 14. Security Considerations

### Key Storage

- **Terminal Ed25519 private key:** Store in **Android Keystore** (hardware-backed if available). Never write to plain SharedPreferences or files.
- **Server public key:** Can be stored in SharedPreferences (it's public).
- **Shared AES key:** Derive on-the-fly when needed. Do NOT persist it. Clear from memory after each transaction.
- **Card AES keys:** Request from server per-transaction. Keep in memory only. Clear immediately after use with a zero-fill.

### Anti-Cloning

- **Device fingerprint:** Generate a stable fingerprint and send it with every auth request. The server rejects auth if the fingerprint doesn't match.
- **Hardware binding:** On ESP32, the firmware is bound to the chip ID. On Android, use ANDROID_ID + other hardware identifiers.

### Anti-Replay

- Every payment payload includes a `timestamp` and `nonce`. The server can reject stale or repeated payloads.
- DESFire cards use challenge-response with server-generated challenges (60-second expiry).

### PIN Security

- PINs are 4 digits.
- After 3 failed attempts, the card is blocked for 15 minutes (`nfc_card_attempts.blocked_until`).
- PINs are stored as bcrypt hashes in the database.
- The app should NOT cache PINs. Enter fresh each time.

### Communication Security

- All terminal-server communication is encrypted with AES-256-GCM.
- All messages are signed with Ed25519.
- Use HTTPS (TLS) for all HTTP communication.
- Verify the server's Ed25519 signature on every response.

### Memory Hygiene

- After processing a payment, zero-fill all sensitive buffers:
  - `shared_key` (if cached)
  - `card_aes_key`
  - `pin` strings
  - `id_document_number` strings
- Use `Arrays.fill(byteArray, (byte) 0)` or equivalent.

---

## 15. Non-Functional Requirements

### Offline Resilience

- The app should gracefully handle network errors and timeouts.
- If a payment fails due to network issues, show a clear error and allow retry.
- Do NOT mark a payment as successful if the server didn't confirm it.
- Cache the terminal's Ed25519 keys and server public key locally (they don't change often).

### Shifts

- The app should support opening and closing shifts.
- Opening a shift records the start time and opening amount.
- Closing a shift records the end time, closing amount, total sales, and transaction count.
- Use `POST /nfc/my-terminals/{id}/shift` to open and `POST /nfc/my-terminals/{id}/shift/close` to close.

### Display

- Show the current amount prominently during a transaction.
- Show card type detected (secure vs. normal).
- Show transaction results with clear success/failure indicators.
- Show the merchant's name and balance.

### Feedback

- **Vibration** on card tap, payment success, and payment failure.
- **Sound** (beep) on card tap, success (double beep), and failure (long beep).
- Use different vibration patterns for success vs. failure.

### NFC Reading

- Use Android's `IsoDep` for DESFire cards (ISO 14443-4).
- Use `NfcAdapter` with `TECH_DISCOVERED` intent filter for `isoDep` tech.
- For UID-only cards, read the UID from the tag's ID.
- Handle card removal gracefully (don't crash if the card is removed mid-read).

### QR Code Generation

- Use ZXing or a similar library to generate QR codes.
- QR should encode the URL: `{server_url}{base_path}/pay?t={charge_token}`
- QR should be large enough to scan from a reasonable distance.
- Show the amount below the QR.

### QR Code Scanning (Customer Mode)

- If the app also supports customer mode (scanning QR to pay), use ZXing or Google ML Kit for scanning.
- Parse the URL, extract the token, call `GET /pos/charge/{token}/info`, then `POST /pos/charge/{token}/pay`.

---

## 16. Suggested Technology Stack

### Language & Framework

- **Kotlin** with **Jetpack Compose** for UI
- **Minimum SDK:** Android 8.0 (API 26) — needed for good Keystore support
- **Target SDK:** Latest stable

### Cryptography Libraries

- **Bouncy Castle** (`org.bouncycastle:bcprov-jdk15on`) — for Ed25519, X25519, AES-GCM
- Or **Google Tink** (`com.google.crypto.tink:tink-android`) — simpler API, well-maintained
- **Android Keystore** — for storing the terminal's Ed25519 private key

### NFC

- `android.nfc.NfcAdapter` with `IsoDep` for DESFire communication
- `tech.nfc.f` and `tech.nfc.iso.dep` intent filters

### HTTP

- **OkHttp** (`com.squareup.okhttp3:okhttp`) with **Retrofit** for type-safe API calls
- Or **Ktor Client** if using Kotlin Coroutines heavily

### QR Codes

- **ZXing** (`com.google.zxing:core`) for generation
- **Google ML Kit Scanning** (`com.google.mlkit:barcode-scanning`) for scanning

### State Management

- **ViewModel** + **StateFlow** for reactive state
- **Room** for local caching (terminal config, last-known server public key)

### Dependency Injection

- **Hilt** (Dagger Hilt) for DI

### Storage

- **Android Keystore** — Ed25519 private key
- **EncryptedSharedPreferences** (AndroidX Security) — server public key, terminal ID, registration token
- **Room** — transaction history cache, shift data

### Testing

- **JUnit 5** for unit tests
- **MockK** for mocking
- **Espresso** for UI tests

---

## 17. App Screen Structure (Suggested)

### Login Screen
- Server URL input
- Username + password fields
- Login button
- (Optional) Passkey login button

### Main Dashboard
- Current balance display
- Quick actions: "Cobrar con QR", "Cobrar con NFC", "Modo Multi-Vendedor"
- Shift status (open/closed) with open/close buttons
- Recent transactions list

### QR Payment Screen
- Amount input
- Description input (optional)
- "Generar QR" button
- QR code display
- Status polling indicator
- "Cancelar" button

### NFC Payment Screen
- Amount input
- "Esperando tarjeta..." indicator
- Card detected → show card type
- PIN input (4 digits)
- (If UID-only + node requires) ID document type dropdown + number input
- "Procesando..." indicator
- Result display (approved/rejected)

### Multi-Vendor NFC Screen
- "Acerque tarjeta del vendedor" → vendor identified
- Vendor info display (name, username)
- Amount input (vendor enters)
- "Acerque tarjeta del cliente" → customer card read
- PIN input (customer enters)
- (If UID-only + node requires) ID document input
- Result display
- "Siguiente venta" / "Salir de modo multi-vendedor" buttons

### Terminal Management Screen
- List of terminals
- Register new terminal
- Terminal details (status, last seen, assigned merchant)
- Deactivate terminal

### Card Management Screen
- List user's cards
- Issue new card (admin)
- Change PIN
- Reset PIN (admin)
- Deactivate card (admin)

### Settings Screen
- Server URL configuration
- Terminal ID configuration
- Multi-vendor mode toggle
- Card type config display (read-only for non-admins)
- Logout

### Transactions History Screen
- List of recent NFC and QR transactions
- Filter by date, status, type
- Transaction details (amount, card UID, status, timestamp)

---

## 18. Summary of What the AI Needs to Build

1. A **native Android app** in **Kotlin + Jetpack Compose**.
2. All UI strings in **Spanish**.
3. **JWT authentication** (username/password login).
4. **QR payment mode** (merchant creates charge, displays QR, polls status).
5. **NFC payment mode** (reads card, asks PIN, encrypts payload, sends to server).
6. **Multi-vendor NFC mode** (vendor taps card first, then customer).
7. **Ed25519 + ECDH + AES-256-GCM** cryptographic protocol for terminal communication.
8. **ID document verification** for UID-only cards when the node requires it.
9. **Multi-signature payments** for organization accounts (multiple authorized signers tap their cards one by one).
10. **Shift management** (open/close).
11. **Transaction history**.
12. **Terminal and card management** (for admin users).
13. **Android Keystore** for private key storage.
14. **Vibration and sound** feedback.
15. **Offline error handling** with clear messages.

---

## 19. Multi-Signature (Multi-Sig) Payments for Organization Accounts

### Overview

Organization accounts can be configured to require **multiple signatures** before a payment is executed. This is controlled by two fields on the `users` table:

- `required_signatures` (INT, default 1) — number of signatures needed
- `authorized_signers` (UUID[]) — list of user IDs who can sign

When `required_signatures > 1`, any payment from that account (transfer, NFC, or QR) creates a **pending multi-sig payment** instead of executing immediately. Each authorized signer must confirm the payment. When all required signatures are collected, the payment executes automatically.

### Multi-Sig in Transfers (Web/App)

When a user from a multi-sig organization initiates a transfer:

1. User calls `POST /api/transfer` as usual.
2. Backend detects `required_signatures > 1` and creates a pending payment.
3. Backend responds with `202 Accepted`:
   ```json
   {
     "status": "pending_multisig",
     "pending_id": "uuid",
     "required_sigs": 3,
     "collected_sigs": 1,
     "remaining_sigs": 2,
     "message": "Pago pendiente. Faltan 2 firma(s) para completar."
   }
   ```
4. Other authorized signers confirm via `POST /api/multisig/payments/{id}/sign` (from web or app).
5. When all signatures are collected, the payment executes automatically.

### Multi-Sig in NFC Payments (POS Terminal)

When a customer taps their card at an NFC terminal and their account requires multi-sig:

1. Customer taps card + enters PIN (and ID document if UID-only).
2. Backend creates a pending multi-sig payment.
3. Backend responds with `pending_multisig` status:
   ```json
   {
     "status": "pending_multisig",
     "transaction_id": "pending-payment-uuid",
     "message": "Pago pendiente. Faltan 2 firma(s). Acerque las tarjetas de los firmantes autorizados.",
     "user_balance": 150000
   }
   ```
4. The app displays: "Esperando firmas de los autorizados. Faltan N firma(s)."
5. **Each authorized signer approaches their card one by one.**
6. For each signer, the app reads their card, asks for their PIN (and ID document if UID-only).
7. The app sends a multi-sig sign request to `POST /api/nfc/terminal/payment/multisig-sign` with the encrypted payload:
   ```json
   {
     "pending_payment_id": "uuid",
     "card_uid": "AABBCCDDEEFF",
     "pin": "1234",
     "id_document_type": "cedula",
     "id_document_number": "V12345678",
     "timestamp": 1234567890,
     "nonce": "random-string"
   }
   ```
8. Backend verifies the card, PIN, and that the signer is authorized.
9. Backend responds with:
   - `pending_multisig` + remaining count (if more signatures needed)
   - `approved` (if all signatures collected and payment executed)
10. The app shows the remaining count after each tap.
11. **Signers can tap in any order.** The only requirement is that all required signers tap their cards.
12. When all signatures are collected, the payment executes automatically and the app shows success.

### Multi-Sig in QR Payments

When a customer pays a QR charge and their account requires multi-sig:

1. Customer scans QR and confirms payment via `POST /api/pos/charge/{token}/pay`.
2. Backend detects multi-sig and creates a pending payment.
3. Backend responds with `202 Accepted`:
   ```json
   {
     "status": "pending_multisig",
     "pending_id": "uuid",
     "charge_id": "uuid",
     "remaining_sigs": 2,
     "message": "Pago pendiente. Faltan 2 firma(s) para completar."
   }
   ```
4. Other authorized signers confirm via:
   - Web/app: `POST /api/multisig/payments/{id}/sign`
   - NFC terminal: `POST /api/nfc/terminal/payment/multisig-sign`
5. When all signatures are collected, the payment executes and the QR charge is marked as paid.

### Multi-Sig API Endpoints

#### List Pending Multi-Sig Payments

**GET `/multisig/payments`** — Requires JWT auth

Returns pending payments where the user is the sender or receiver:
```json
[
  {
    "id": "uuid",
    "payment_type": "transfer",
    "from_account": "uuid",
    "to_account": "uuid",
    "amount": 50000,
    "required_signatures": 3,
    "authorized_signers": ["uuid1", "uuid2", "uuid3"],
    "collected_signatures": [
      {"signer_id": "uuid1", "method": "web", "timestamp": "..."}
    ],
    "status": "pending",
    "expires_at": "2026-08-27T12:00:00Z",
    "created_at": "2026-08-26T12:00:00Z"
  }
]
```

#### Get Pending Payment

**GET `/multisig/payments/{id}`** — Requires JWT auth

#### Sign Pending Payment (Web/App)

**POST `/multisig/payments/{id}/sign`** — Requires JWT auth

Request:
```json
{
  "method": "web",
  "card_uid": "",
  "pin_verified": false,
  "id_document_verified": false
}
```

Response (200):
```json
{
  "status": "pending",
  "pending_id": "uuid",
  "remaining_sigs": 1,
  "message": "Firma registrada. Faltan 1 firma(s)."
}
```

Or when all signatures are collected:
```json
{
  "status": "executed",
  "pending_id": "uuid",
  "remaining_sigs": 0,
  "message": "Pago ejecutado correctamente"
}
```

#### Execute Pending Payment

**POST `/multisig/payments/{id}/execute`** — Requires JWT auth

(Usually not needed — payment executes automatically when all signatures are collected.)

#### Cancel Pending Payment

**POST `/multisig/payments/{id}/cancel`** — Requires JWT auth

#### Get Multi-Sig Config

**GET `/multisig/config`** — Requires JWT auth

Response:
```json
{
  "node_domain": "aldea-semilla-viva.org",
  "expiration_minutes": 10,
  "notify_signers": true,
  "notification_message": "Tienes un pago pendiente que requiere tu firma. Ingresa al sistema para confirmar."
}
```

#### Update Multi-Sig Config

**POST `/multisig/config`** — Requires JWT + `config.manage` permission

Request:
```json
{
  "expiration_minutes": 5,
  "notify_signers": true,
  "notification_message": "Tienes un pago pendiente que requiere tu firma. Ingresa al sistema para confirmar."
}
```

The app should:
- Call `GET /multisig/config` on startup to know the expiration time.
- Show a **countdown timer** during multi-sig signing.
- If the timer expires, show "Tiempo agotado. El pago ha sido cancelado."

#### Sign Pending Payment via NFC Terminal

**POST `/nfc/terminal/payment/multisig-sign`** — Terminal Ed25519 auth

Same encrypted envelope format as other NFC payment endpoints. Decrypted payload:
```json
{
  "pending_payment_id": "uuid",
  "card_uid": "AABBCCDDEEFF",
  "pin": "1234",
  "id_document_type": "cedula",
  "id_document_number": "V12345678",
  "timestamp": 1234567890,
  "nonce": "random-string"
}
```

Decrypted response:
```json
{
  "status": "pending_multisig",
  "transaction_id": "pending-payment-uuid",
  "message": "Firma registrada. Faltan 1 firma(s)."
}
```

Or when complete:
```json
{
  "status": "approved",
  "transaction_id": "pending-payment-uuid",
  "message": "Pago multi-firma completado y ejecutado",
  "user_balance": 150000
}
```

### Multi-Sig App UI Flow (NFC)

1. Customer taps card → app shows "Cuenta multi-firma. Se requieren N firmas."
2. Customer enters PIN (and ID document if UID-only).
3. App sends payment → backend creates pending payment.
4. App shows: "Firma 1 de N completada. Acerque la tarjeta del siguiente firmante."
5. Next authorized signer taps their card.
6. App asks for their PIN (and ID document if UID-only).
7. App sends multi-sig sign request.
8. App shows: "Firma 2 de N completada. Faltan N-2 firma(s)."
9. Repeat until all signers have tapped.
10. When all signatures are collected: "Pago aprobado. {amount} TQ."
11. App clears state and returns to main screen.

### Important Notes

- **Signers can tap in ANY order.** There is no required sequence.
- **Each signer uses their OWN card + their OWN PIN.** The app must not reuse the first signer's card.
- **The same signer cannot sign twice.** The backend rejects duplicate signatures.
- **Pending payments expire after 10 minutes by default** (configurable per node via `multisig_config.expiration_minutes`, max 1440 minutes = 24 hours). The app must show a countdown timer. If the timer expires, the payment is cancelled automatically.
- **Pending payments can be cancelled** by any authorized signer.
- **The app must display the remaining signature count** clearly after each tap.
- **If a signer's card is UID-only and the node requires ID document**, each signer must also enter their ID document number.
- **The app must handle the `pending_multisig` status** in all payment responses (NFC, QR, transfer) and transition to the multi-sig signing flow.

---

## 20. Key Reminders

- **Respond in Spanish** to the user.
- **App UI in Spanish.**
- **Do NOT modify backend code.** This document describes the existing API.
- **The `amount` field is in micro-units** (integer). For display, divide by 100 to show TQ with 2 decimal places. Example: `50000` → `500.00 TQ`.
- **PINs are 4 digits.**
- **Card UIDs are hex strings, uppercase.** Example: `AABBCCDDEEFF`
- **All encrypted payloads use the format:** `{nonce, ciphertext, signature}` where signature is Ed25519 over the ciphertext.
- **The shared key is derived once** (from terminal + server Ed25519 keys via ECDH) and reused for all transactions in the session.
- **Clear all sensitive data from memory** after each transaction.
- **The node domain** must be sent as `X-Node-Domain` header on every request.
- **Demo node:** If testing against `https://feria.loanstly.com/demo`, the base path is `/demo` and all API calls go to `https://feria.loanstly.com/demo/api/...`.
