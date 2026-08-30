# Modelo de Datos

Este documento describe el modelo de datos completo: tablas del backend PostgreSQL/YugabyteDB, entidades Room de Android, y la representación monetaria.

---

## 1. Representación monetaria

### Unidad interna: centavos (micro-units)
- Todos los montos se almacenan como `BIGINT` / `int64` / `Long`.
- **1 TQ = 100 centavos**.
- Ejemplo: `12500` centavos = `125.00 TQ`.
- No se usa `float` ni `double` en ningún lado para montos.

### Modelo contable: crédito comunitario recíproco
- Las cuentas suman **cero** en toda la comunidad (sistema de suma cero).
- Balance positivo = crédito aportado a la comunidad.
- Balance negativo = obligación de contribuir con bienes/trabajo.
- Ni positivo ni negativo son inherentemente "buenos" o "malos".
- Los pagos se bloquean **solo** cuando se alcanza el `credit_limit` (límite negativo), no por "fondos insuficientes" convencional.

### Límites
- `credit_limit`: límite negativo máximo (ej: `-50000` = -500.00 TQ). Un pago se rechaza si `balance - amount < credit_limit`.
- `debit_limit`: límite positivo máximo (ej: `50000` = 500.00 TQ).
- `annual_budget_limit`: límite anual opcional.

---

## 2. Backend — Tablas principales (PostgreSQL/YugabyteDB)

### users (migración 001)
Cuentas de usuarios y organizaciones. Es la tabla central del sistema.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `node_domain` | TEXT | — | Dominio del nodo federado |
| `username` | TEXT | — | Nombre único por nodo |
| `display_name` | TEXT | — | Nombre visible |
| `account_type` | TEXT | `'individual'` | `individual`, `organization`, `public_institution`, `fund` |
| `organization_subtype` | TEXT | — | Subtipo de organización |
| `member_level_id` | TEXT | — | Nivel de membresía |
| `has_voice` | BOOLEAN | `true` | Tiene voz en asambleas |
| `has_vote` | BOOLEAN | `true` | Tiene voto |
| `counts_in_quorum` | BOOLEAN | `true` | Cuenta para quórum |
| `membership_status` | TEXT | `'pending'` | `pending`, `active`, `suspended` |
| `admitted_at` | TIMESTAMPTZ | — | Fecha de admisión |
| `balance` | BIGINT | `0` | Balance en centavos |
| `credit_limit` | BIGINT | `-50000` | Límite negativo |
| `debit_limit` | BIGINT | `50000` | Límite positivo |
| `annual_budget_limit` | BIGINT | — | Límite anual opcional |
| `tax_rate` | DECIMAL(5,4) | `0.0` | Tasa de impuesto |
| `is_approved` | BOOLEAN | `false` | Aprobado por asamblea |
| `approved_by` | UUID[] | — | Quiénes aprobaron |
| `public_key` | TEXT | — | Clave pública del usuario |
| `encrypted_private_key` | BYTEA | — | Clave privada cifrada |
| `encryption_key_salt` | BYTEA | — | Salt de cifrado |
| `required_signatures` | INT | `1` | Firmas requeridas para pagos |
| `authorized_signers` | UUID[] | `[]` | IDs de firmantes autorizados |
| `payment_pin_hash` | TEXT | — | Hash bcrypt del PIN de pago (migración 098) |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — |

**Constraint**: `UNIQUE(node_domain, username)`

### nfc_cards (migración 001)
Tarjetas NFC asignadas a usuarios.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `user_id` | UUID | — | FK → users(id) |
| `card_uid` | TEXT | — | UID único de la tarjeta |
| `is_active` | BOOLEAN | `true` | Activa |
| `issued_at` | TIMESTAMPTZ | `NOW()` | Fecha de emisión |
| `deactivated_at` | TIMESTAMPTZ | — | Fecha de desactivación |
| `card_type` | TEXT | `'uid_only'` | `uid_only`, `desfire`, `dual` (migración 004) |
| `crypto_enabled` | BOOLEAN | `false` | Crypto NFC habilitado (migración 119) |
| `pin_hash` | TEXT | — | Hash bcrypt del PIN (migración 004) |
| `pin_attempts` | INT | `0` | Intentos fallidos (migración 004) |
| `blocked_until` | TIMESTAMPTZ | — | Bloqueada hasta (migración 004) |
| `last_token_at` | TIMESTAMPTZ | — | Último token usado (migración 119) |
| `card_error` | TEXT | — | Error de tarjeta (migración 119) |
| `error_at` | TIMESTAMPTZ | — | Fecha del error (migración 119) |
| `has_dynamic_certs` | BOOLEAN | `false` | Tiene certificados dinámicos Classic (migración 138) |

**Constraint**: `UNIQUE(card_uid)`

### nfc_card_sectors (migración 138)
Certificados dinámicos rotativos para MIFARE Classic 1K. Un registro por sector por tarjeta.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `card_uid` | TEXT | — | UID de la tarjeta |
| `node_domain` | TEXT | — | Nodo |
| `sector_number` | INT | — | Número de sector (1-15) |
| `key_a_encrypted` | BYTEA | — | Key A (6 bytes, lectura) |
| `key_b_encrypted` | BYTEA | — | Key B (6 bytes, escritura) |
| `access_bits` | BYTEA | — | Access bits (4 bytes) |
| `certificate` | BYTEA | — | Certificado actual (16 bytes) |
| `is_active` | BOOLEAN | `false` | Sector con cert válido |
| `written_blocks` | INT | `0` | Bloques confirmados (0-3) |
| `needs_repair` | BOOLEAN | `false` | Necesita reparación |
| `created_at` | TIMESTAMPTZ | `NOW()` | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Fecha de actualización |

**Constraint**: `UNIQUE(card_uid, sector_number)`

### nfc_classic_pending (migración 138)
Pre-aprobaciones pendientes de confirmación de lectura/escritura en tarjeta Classic. TTL 30 segundos.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `card_uid` | TEXT | — | UID de la tarjeta |
| `terminal_id` | TEXT | — | Terminal que inició |
| `user_id` | UUID | — | FK → users(id) |
| `amount` | BIGINT | — | Monto a pagar |
| `read_sector` | INT | — | Sector a leer |
| `write_sector` | INT | — | Sector a escribir |
| `new_certificate` | BYTEA | — | Cert nuevo (16 bytes) |
| `expires_at` | TIMESTAMPTZ | `NOW() + 30s` | Expiración |
| `created_at` | TIMESTAMPTZ | `NOW()` | Fecha de creación |

### nfc_card_keys (migración 004)
Claves criptográficas de tarjetas NFC (DESFire).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `card_uid` | TEXT | — | UID único |
| `node_domain` | TEXT | — | Nodo |
| `user_id` | UUID | — | FK → users(id) |
| `card_type` | TEXT | `'uid_only'` | `uid_only`, `desfire` |
| `secret_key_encrypted` | BYTEA | — | Clave secreta cifrada |
| `hmac_counter` | BIGINT | `0` | Contador HMAC |
| `is_active` | BOOLEAN | `true` | Activa |
| `issued_at` | TIMESTAMPTZ | `NOW()` | — |
| `deactivated_at` | TIMESTAMPTZ | — | — |
| `aes_key_encrypted` | BYTEA | — | Clave AES cifrada (migración 118) |
| `key_version` | INT | `1` | Versión de clave (migración 119) |
| `rotation_status` | TEXT | — | Estado de rotación de clave (migración 119) |
| `crypto_blocked_until` | TIMESTAMPTZ | — | Bloqueo crypto (migración 118) |
| `auth_fail_count` | INT | `0` | Contador fallos auth (migración 118) |
| `sun_counter` | BIGINT | `0` | Contador SUN (migración 118) |
| `last_auth_at` | TIMESTAMPTZ | — | Última autenticación (migración 118) |
| `provisioned_at` | TIMESTAMPTZ | — | Fecha de provisión (migración 118) |

### nfc_terminals (migración 004 + 098)
Terminales NFC (POS Android, ESP32, POS web).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | PK |
| `node_domain` | TEXT | — | Nodo |
| `terminal_id` | TEXT | — | ID único del terminal |
| `label` | TEXT | — | Etiqueta visible |
| `terminal_type` | TEXT | `'keypad'` | `keypad`, `web_pos`, `esp32` |
| `location` | TEXT | — | Ubicación |
| `terminal_public_key` | TEXT | — | Clave pública Ed25519 del terminal |
| `server_public_key` | TEXT | — | Clave pública del servidor |
| `registration_token` | TEXT | — | Token de registro |
| `is_active` | BOOLEAN | `true` | Activo |
| `is_registered` | BOOLEAN | `false` | Registrado |
| `last_seen` | TIMESTAMPTZ | — | Último heartbeat |
| `firmware_version` | TEXT | — | Versión |
| `device_fingerprint` | TEXT | — | Huella de dispositivo (098) |
| `block_code_hash` | TEXT | — | Hash bcrypt código bloqueo (098) |
| `merchant_user_id` | UUID | — | Comerciante asignado (098) |
| `organization_id` | UUID | — | Organización dueña (098) |
| `department_id` | UUID | — | Departamento asignado (098) |
| `chip_id` | TEXT | — | ID del chip ESP32 (migración 005) |
| `firmware_binary_path` | TEXT | — | Ruta del firmware (migración 005) |
| `device_model` | TEXT | — | Modelo de dispositivo Android (migración 127) |
| `device_manufacturer` | TEXT | — | Fabricante del dispositivo (migración 127) |
| `android_version` | TEXT | — | Versión de Android (migración 127) |
| `web_session_expires_at` | TIMESTAMPTZ | — | Expiración sesión web (migración 130) |
| `web_session_requested_at` | TIMESTAMPTZ | — | Solicitud sesión web (migración 130) |
| `shift_pin_hash` | TEXT | — | Hash bcrypt del PIN del turno (migración 141). Lo configura el dueño desde el panel web. |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — |

**Constraint**: `UNIQUE(terminal_id)`

### nfc_server_keys (migración 004)
Claves del servidor para ECDH con terminales.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `node_domain` | TEXT | UNIQUE |
| `public_key` | TEXT | Clave pública Ed25519 del servidor |
| `private_key_encrypted` | BYTEA | Clave privada cifrada |
| `created_at` | TIMESTAMPTZ | — |

### nfc_terminal_sessions (migración 004)
Sesiones activas de terminales (para pagos comunitarios multi-vendedor).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `terminal_id` | UUID | — | FK → nfc_terminals(id) |
| `session_token` | TEXT | — | Token único |
| `merchant_user_id` | UUID | — | Comerciante |
| `current_amount` | BIGINT | — | Monto en proceso |
| `status` | TEXT | `'idle'` | `idle`, `waiting_seller`, `waiting_buyer`, `processing` |
| `seller_card_uid` | TEXT | — | Card UID vendedor |
| `seller_pin_verified` | BOOLEAN | `false` | PIN vendedor verificado |
| `buyer_card_uid` | TEXT | — | Card UID comprador |
| `expires_at` | TIMESTAMPTZ | `NOW() + 5 min` | Expiración |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |

### nfc_transactions (migración 004)
Log de transacciones NFC.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `terminal_id` | UUID | FK → nfc_terminals(id) |
| `card_uid` | TEXT | Card UID |
| `user_id` | UUID | FK → users(id) |
| `amount` | BIGINT | Monto |
| `status` | TEXT | Estado |
| `crypto_token` | TEXT | Token criptográfico |
| `pin_verified` | BOOLEAN | PIN verificado |
| `transaction_type` | TEXT | `single`, `community` |
| `seller_user_id` | UUID | Vendedor (community) |
| `buyer_user_id` | UUID | Comprador (community) |
| `server_response` | JSONB | Respuesta del servidor |
| `error_message` | TEXT | Error |
| `created_at` | TIMESTAMPTZ | — |

### nfc_card_attempts (migración 004)
Contador de intentos fallidos de PIN y bloqueo temporal de tarjetas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK (`gen_random_uuid()`) |
| `card_uid` | TEXT | UID de la tarjeta (UNIQUE) |
| `attempt_count` | INT | Número de intentos fallidos |
| `last_attempt_at` | TIMESTAMPTZ | Timestamp del último intento |
| `blocked_until` | TIMESTAMPTZ | Bloqueada hasta esta fecha (NULL = no bloqueada) |

**Comportamiento** (hardcodeado en `internal/payments/nfc_terminal.go`):
- Después de **3 intentos fallidos** → `blocked_until = NOW() + 15 minutos`
- Al acertar el PIN → `attempt_count = 0, blocked_until = NULL` (`resetCardAttempts`)
- Al resetear el PIN via API → `attempt_count = 0, blocked_until = NULL` (`ResetCardPIN`)
- **No es configurable** desde la UI ni la API
- `nfc_cards` también tiene columnas `pin_attempts` y `blocked_until` (migración 004) pero el código usa principalmente `nfc_card_attempts`

### transactions (migración 001)
Transacciones del libro mayor (hash-chain ledger).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `tx_type` | TEXT | — | Tipo: `transfer`, `nfc`, `nfc_community`, `multisig_nfc`, `pos_qr`, etc. |
| `sender_id` | UUID | — | FK → users(id) |
| `receiver_id` | UUID | — | FK → users(id) |
| `sender_node` | TEXT | — | Nodo emisor (federación) |
| `receiver_node` | TEXT | — | Nodo receptor |
| `amount` | BIGINT | — | Monto |
| `tax_amount` | BIGINT | `0` | Impuesto |
| `tax_target_account` | UUID | — | Cuenta de impuesto |
| `user_signature` | TEXT | — | Firma del usuario |
| `node_signature` | TEXT | — | Firma del nodo |
| `multi_sig_signatures` | JSONB | `'[]'` | Firmas multi-sig |
| `multi_sig_required` | INT | `1` | Firmas requeridas |
| `prev_hash` | TEXT | — | Hash anterior (cadena) |
| `current_hash` | TEXT | — | Hash actual |
| `external_id` | TEXT | — | ID externo |
| `status` | TEXT | `'pending'` | `pending`, `confirmed`, `failed` |
| `metadata` | JSONB | — | Metadata adicional |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |
| `confirmed_at` | TIMESTAMPTZ | — | — |

### ledger_entries (migración 001)
Entradas del libro mayor (doble entrada).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | BIGSERIAL | PK |
| `transaction_id` | UUID | FK → transactions(id) |
| `account_id` | UUID | FK → users(id) |
| `entry_type` | TEXT | `debit`, `credit` |
| `amount` | BIGINT | Monto |
| `account_category` | TEXT | Categoría |
| `counterpart_node` | TEXT | Nodo contraparte (federación) |
| `created_at` | TIMESTAMPTZ | — |

### pending_multisig_payments (migración 123)
Pagos pendientes de multi-firma.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `node_domain` | TEXT | — | Nodo |
| `payment_type` | TEXT | — | `transfer`, `nfc`, `nfc_community`, `pos_qr` |
| `from_account` | UUID | — | Cuenta que envía (requiere multi-sig) |
| `to_account` | UUID | — | Cuenta que recibe |
| `amount` | BIGINT | — | Monto |
| `required_signatures` | INT | `1` | Firmas requeridas |
| `authorized_signers` | UUID[] | `[]` | Firmantes autorizados |
| `collected_signatures` | JSONB | `'[]'` | Firmas recolectadas |
| `status` | TEXT | `'pending'` | `pending`, `ready`, `executed`, `expired`, `cancelled` |
| `payment_method` | TEXT | — | `nfc`, `qr`, `transfer` |
| `terminal_id` | UUID | — | FK → nfc_terminals(id) |
| `pos_charge_id` | UUID | — | FK → pos_charges(id) |
| `description` | TEXT | — | Concepto |
| `metadata` | JSONB | — | Metadata |
| `expires_at` | TIMESTAMPTZ | `NOW() + 10 min` | Expiración (reset por firma, migración 124 cambia de 24h a 10min) |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — |
| `executed_at` | TIMESTAMPTZ | — | Fecha de ejecución |

### multisig_payment_signatures (migración 123)
Firmas individuales de pagos multi-sig (auditoría).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `pending_payment_id` | UUID | — | FK → pending_multisig_payments(id) |
| `signer_id` | UUID | — | FK → users(id) |
| `method` | TEXT | `'nfc_card'` | `nfc_card`, `web`, `pin` |
| `card_uid` | TEXT | — | Card UID usado |
| `pin_verified` | BOOLEAN | `false` | PIN verificado |
| `id_document_verified` | BOOLEAN | `false` | Documento verificado |
| `signature` | TEXT | — | Firma criptográfica |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |

**Constraint**: `UNIQUE(pending_payment_id, signer_id)` — un firmante no puede firmar dos veces.

### pos_charges (migración 098)
Cargas QR del POS.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `node_domain` | TEXT | — | Nodo |
| `terminal_id` | UUID | — | FK → nfc_terminals(id) |
| `merchant_id` | UUID | — | FK → users(id) |
| `charge_token` | TEXT | — | Token único (para QR) |
| `amount` | BIGINT | — | Monto |
| `status` | TEXT | `'pending'` | `pending`, `paid`, `expired`, `cancelled` |
| `payer_id` | UUID | — | FK → users(id) |
| `paid_at` | TIMESTAMPTZ | — | Fecha de pago |
| `payment_method` | TEXT | — | Método |
| `description` | TEXT | — | Descripción |
| `terminal_signature` | TEXT | — | Firma del terminal |
| `shift_id` | UUID | — | FK → pos_shifts(id) |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |
| `expires_at` | TIMESTAMPTZ | `NOW() + 10 min` | Expiración |

### pos_shifts (migración 098)
Turnos del POS.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | UUID | — | PK |
| `terminal_id` | UUID | — | FK → nfc_terminals(id) |
| `user_id` | UUID | — | FK → users(id) |
| `organization_id` | UUID | — | FK → users(id) |
| `department_id` | UUID | — | Departamento |
| `status` | TEXT | `'open'` | `open`, `closed` |
| `opened_at` | TIMESTAMPTZ | `NOW()` | — |
| `closed_at` | TIMESTAMPTZ | — | — |
| `opening_amount` | BIGINT | `0` | Monto inicial |
| `closing_amount` | BIGINT | — | Monto final |
| `total_sales` | BIGINT | `0` | Total ventas |
| `transactions_count` | INT | `0` | Número de transacciones |
| `notes` | TEXT | — | Notas |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |

### user_preferences (migración 132)
Preferencias de formato por usuario.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `user_id` | UUID | — | PK, FK → users(id) |
| `locale` | TEXT | `'es'` | Idioma |
| `number_locale` | TEXT | `'es-VE'` | Locale de números |
| `date_format` | TEXT | `'DD/MM/YYYY'` | Formato de fecha |
| `time_format` | TEXT | `'24h'` | Formato de hora |
| `first_day_of_week` | INT | `1` | 0=domingo, 1=lunes |
| `timezone` | TEXT | `'America/Caracas'` | Zona horaria IANA |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — |

### user_passkeys (migración 001)
Passkeys WebAuthn de usuarios.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users(id) |
| `credential_id` | BYTEA | Credential ID WebAuthn |
| `public_key` | BYTEA | Clave pública |
| `sign_count` | BIGINT | Contador de firmas |
| `device_type` | TEXT | Tipo de dispositivo |
| `label` | TEXT | Etiqueta |
| `created_at` | TIMESTAMPTZ | — |
| `last_used_at` | TIMESTAMPTZ | — |

### terminal_pairing_requests (migración 125)
Solicitudes de emparejamiento de terminales.

### multisig_config (migración 124)
Configuración de expiración de multi-sig. (Nota: la migración se llama `124_multisig_expiration_config.sql` pero la tabla se llama `multisig_config`.)

### node_config (migración 006)
Configuración del nodo (key-value, JSONB settings).

### pos_retention_config (migración 143)
Configuración de retención de datos del POS.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `node_domain` | TEXT | — | PK, nodo |
| `retention_days` | INT | `365` | Días de retención |
| `enabled` | BOOLEAN | `true` | Purga automática activada |
| `last_purge_at` | TIMESTAMPTZ | — | Última purga ejecutada |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — |

### Migraciones recientes (140-143)

| Migración | Descripción |
|-----------|-------------|
| `140_classic_required_doc_type.sql` | Añade `required_doc_type` a `nfc_cards` (tipo de documento exigido por tarjeta Classic) |
| `141_terminal_shift_pin.sql` | Añade `shift_pin_hash` a `nfc_terminals` (PIN del turno, bcrypt) |
| `142_shift_transaction_indexes.sql` | Añade índices a `pos_shifts` y `nfc_transactions` para consultas por rango de fechas |
| `143_pos_retention_config.sql` | Crea tabla `pos_retention_config` para retención de datos |

---

## 3. Android — Entidades Room

### TerminalConfigEntity (tabla: `terminal_config`)
Configuración del terminal, persistida localmente. **Es la entidad más crítica** — contiene las credenciales del terminal.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | Int | `1` | PK (singleton, siempre id=1) |
| `serverUrl` | String | `https://<dominio-del-nodo>/demo` | URL del servidor (valor por defecto, configurable) |
| `terminalId` | String | `TERM-POS-001` | ID del terminal |
| `label` | String | `Terminal Kiosco POS` | Etiqueta |
| `isRegistered` | Boolean | `false` | Registrado |
| `terminalPrivateKeyHex` | String | `""` | Clave privada Ed25519 (hex) |
| `terminalPublicKeyHex` | String | `""` | Clave pública Ed25519 (hex) |
| `serverPublicKeyHex` | String? | `null` | Clave pública del servidor (hex) |
| `sessionToken` | String? | `null` | Token de sesión JWT |
| `isMultiVendorEnabled` | Boolean | `false` | Multi-vendedor activo |
| `fmtLocale` | String | `"es"` | Locale (migración 2→3) |
| `fmtNumberLocale` | String | `"es-VE"` | Locale de números |
| `fmtDateFormat` | String | `"DD/MM/YYYY"` | Formato de fecha |
| `fmtTimeFormat` | String | `"24h"` | Formato de hora |
| `fmtFirstDayOfWeek` | Int | `1` | Primer día de semana |
| `fmtTimezone` | String | `"America/Caracas"` | Zona horaria |

> **CRÍTICO**: Esta entidad se preserva con `MIGRATION_2_3`. **NUNCA** usar `fallbackToDestructiveMigration()` sin migración explícita — borra las credenciales y obliga a re-registrar el terminal.

### TransactionEntity (tabla: `pos_transactions`)
Transacciones locales del POS (para historial y recibos).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | String | PK |
| `amount` | Long | Monto en centavos |
| `paymentMethod` | String | `qr`, `nfc_single`, `nfc_community`, `multisig` |
| `status` | String | `approved`, `rejected`, `pending`, `cancelled`, `expired` |
| `cardUid` | String? | UID de tarjeta |
| `customerName` | String? | Nombre del cliente |
| `vendorName` | String? | Nombre del vendedor |
| `description` | String? | Descripción |
| `receiptNumber` | String? | Número de recibo |
| `timestamp` | Long | Epoch millis |

### ShiftEntity (tabla: `pos_shifts`)
Turnos del POS (locales).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | String | PK |
| `status` | String | `open`, `closed` |
| `openedAt` | Long | Epoch millis |
| `closedAt` | Long? | Epoch millis |
| `openingAmount` | Long | Monto inicial |
| `closingAmount` | Long? | Monto final |
| `totalSales` | Long | Total ventas |
| `transactionsCount` | Int | Número de transacciones |
| `notes` | String? | Notas |
| `pendingSync` | Boolean | true si se cerró offline y falta sincronizar (migración 3→4) |
| `closedOffline` | Boolean | true si el cierre se hizo sin conexión (migración 3→4) |

### ShiftPinEntity (tabla: `shift_pin`) — Caché offline del PIN del turno

> **Propósito:** Esta entidad ahora se usa como **caché local** para verificación offline del PIN del turno. Cuando la verificación online es exitosa, el POS computa `SHA-256(salt + pin)` y lo guarda aquí. Cuando no hay conexión, el POS verifica el PIN contra este hash. El PIN original nunca se guarda.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | Int | PK (singleton, id=1) |
| `pinHash` | String | SHA-256(salt + pin) — caché para verificación offline |

---

## 4. Room — DAOs

### TransactionDao
```kotlin
@Query("SELECT * FROM pos_transactions ORDER BY timestamp DESC")
fun getAllTransactions(): Flow<List<TransactionEntity>>

@Query("SELECT * FROM pos_transactions WHERE status = 'approved' ORDER BY timestamp DESC")
fun getApprovedTransactions(): Flow<List<TransactionEntity>>

@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun insertTransaction(transaction: TransactionEntity)

@Query("DELETE FROM pos_transactions")
suspend fun clearTransactions()
```

### ShiftDao
```kotlin
@Query("SELECT * FROM pos_shifts ORDER BY openedAt DESC LIMIT 1")
fun getLatestShiftFlow(): Flow<ShiftEntity?>

@Query("SELECT * FROM pos_shifts WHERE status = 'open' LIMIT 1")
suspend fun getOpenShift(): ShiftEntity?

@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun insertShift(shift: ShiftEntity)

@Update
suspend fun updateShift(shift: ShiftEntity)
```

### ShiftPinDao
```kotlin
@Query("SELECT * FROM shift_pin WHERE id = 1")
suspend fun getPin(): ShiftPinEntity?

@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun savePin(pin: ShiftPinEntity)

@Query("DELETE FROM shift_pin")
suspend fun clearPin()
```

### TerminalConfigDao
```kotlin
@Query("SELECT * FROM terminal_config WHERE id = 1")
fun getConfigFlow(): Flow<TerminalConfigEntity?>

@Query("SELECT * FROM terminal_config WHERE id = 1")
suspend fun getConfig(): TerminalConfigEntity?

@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun saveConfig(config: TerminalConfigEntity)
```

---

## 5. Room — Migraciones

### MIGRATION_2_3 (versión 2 → 3)
Añade las 6 columnas de formato a `terminal_config` **sin perder datos**:

```kotlin
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtLocale TEXT NOT NULL DEFAULT 'es'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtNumberLocale TEXT NOT NULL DEFAULT 'es-VE'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtDateFormat TEXT NOT NULL DEFAULT 'DD/MM/YYYY'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimeFormat TEXT NOT NULL DEFAULT '24h'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtFirstDayOfWeek INTEGER NOT NULL DEFAULT 1")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimezone TEXT NOT NULL DEFAULT 'America/Caracas'")
    }
}
```

### Registro en MainActivity
```kotlin
val db = Room.databaseBuilder(context, AppDatabase::class.java, "pos.db")
    .addMigrations(MIGRATION_2_3)
    .fallbackToDestructiveMigration()  // solo para migraciones futuras no previstas
    .build()
```

> **Nota**: `fallbackToDestructiveMigration()` se mantiene como red de seguridad para migraciones futuras, pero `MIGRATION_2_3` se ejecuta primero y preserva los datos. **Nunca** quitar `.addMigrations(MIGRATION_2_3)` — sin él, Room destruiría la base de datos al actualizar.

### Versión actual: 4
```kotlin
@Database(
    entities = [TransactionEntity::class, ShiftEntity::class, TerminalConfigEntity::class, ShiftPinEntity::class],
    version = 4,
    exportSchema = false
)
```

### MIGRATION_3_4 (versión 3 → 4)
Añade las columnas de cierre offline a `pos_shifts` **sin perder datos**:

```kotlin
val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 0")
        database.execSQL("ALTER TABLE pos_shifts ADD COLUMN closedOffline INTEGER NOT NULL DEFAULT 0")
    }
}
```

---

## 6. Modelo FormatSettings

### En el backend (Go)
```go
type FormatSettings struct {
    Locale         string `json:"locale"`
    NumberLocale   string `json:"number_locale"`
    DateFormat     string `json:"date_format"`
    TimeFormat     string `json:"time_format"`
    FirstDayOfWeek int    `json:"first_day_of_week"`
    Timezone       string `json:"timezone"`
}
```

### En Android (Kotlin)
```kotlin
object FormatConfig {
    var numberLocale: String = "es-VE"
    var dateFormat: String = "DD/MM/YYYY"
    var timeFormat: String = "24h"
    var firstDayOfWeek: Int = 1
    var timezone: String = "America/Caracas"
    var locale: String = "es"

    fun updateFromEntity(entity: TerminalConfigEntity) { ... }
}
```

### Precedencia (mayor a menor)
1. **Preferencias del usuario** (`user_preferences` tabla, migración 132)
2. **Defaults del nodo** (`node_config.settings->'format_settings'` JSONB)
3. **Defaults del sistema** (hardcodeados: `es`, `es-VE`, `DD/MM/YYYY`, `24h`, `1`, `America/Caracas`)

### Dónde se reciben en Android
- `TerminalAuthResponse.format_settings` al autenticar el terminal (`POST /api/nfc/terminal/auth`)
- Se persisten en `TerminalConfigEntity` (campos `fmt*`)
- Se cargan al inicio con `FormatConfig.updateFromEntity()`

---

## 7. Relaciones principales

```
users (1) ──── (N) nfc_cards
users (1) ──── (N) nfc_card_keys
users (1) ──── (N) user_passkeys
users (1) ──── (1) user_preferences
users (1) ──── (N) transactions (como sender_id o receiver_id)
users (1) ──── (N) ledger_entries
users (1) ──── (N) pending_multisig_payments (como from_account o to_account)
users (1) ──── (N) multisig_payment_signatures (como signer_id)
users (1) ──── (N) pos_charges (como merchant_id o payer_id)
users (1) ──── (N) pos_shifts (como user_id)
users (1) ──── (N) nfc_terminals (como merchant_user_id u organization_id)

nfc_terminals (1) ──── (N) nfc_terminal_sessions
nfc_terminals (1) ──── (N) nfc_transactions
nfc_terminals (1) ──── (N) pos_charges
nfc_terminals (1) ──── (N) pos_shifts
nfc_terminals (1) ──── (N) pending_multisig_payments

transactions (1) ──── (N) ledger_entries
pending_multisig_payments (1) ──── (N) multisig_payment_signatures
pos_shifts (1) ──── (N) pos_charges
```

---

## 8. Tipos de cuenta (`account_type`)

| Tipo | Descripción | ¿Requiere multi-sig? |
|------|-------------|---------------------|
| `individual` | Persona natural | Generalmente no (`required_signatures=1`) |
| `organization` | Organización/cooperativa | Puede requerir (`required_signatures>1`) |
| `public_institution` | Institución pública | Puede requerir |
| `fund` | Fondo comunitario | Puede requerir |

---

## 9. Tipos de transacción (`tx_type`)

| Tipo | Descripción |
|------|-------------|
| `transfer` | Transferencia P2P interna |
| `nfc` | Pago NFC simple |
| `nfc_community` | Pago NFC comunitario multi-vendedor |
| `multisig_nfc` | Pago NFC multi-firma ejecutado |
| `multisig_nfc_community` | Pago comunitario multi-firma ejecutado |
| `pos_qr` | Pago QR del POS |
| `federation_transfer` | Transferencia federada (entre nodos) |
| `admission` | Admisión de miembro |
| `tax` | Pago de impuesto |
