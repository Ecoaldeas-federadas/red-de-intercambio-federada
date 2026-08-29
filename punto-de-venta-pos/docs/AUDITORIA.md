# Auditoría de Documentación — Discrepancias con el Código

Fecha: 2026-08-28
Método: 4 agentes en paralelo (solo lectura) comparando docs vs código real.

---

## Resumen

| Agente | Docs auditadas | Problemas | Preguntas |
|--------|---------------|-----------|-----------|
| 1 | README + 01 + 02 | 5 | 3 |
| 2 | 03 + 04 | 20 | 1 |
| 3 | 05 + 06 | 4 | 3 |
| 4 | 07 + 08 + 09 + 10 | 2 | 1 |
| **Total** | | **31** | **8** |

---

## PREGUNTAS PARA EL USUARIO (8)

### P1. Componentes UI que no existen
`02-pos-android-arquitectura.md` documenta `NfcWaveAnimation.kt` y `MultisigCountdownHeader.kt` pero no existen en el código.
**¿La doc está adelantada o faltan implementar esos componentes?**

### P2. URL por defecto: ¿demo o main?
- `AppDatabase.kt` línea 46 → `https://feria.loanstly.com/demo`
- `PosApiClient.kt` línea 15 → `https://feria.loanstly.com/main`
- `PosViewModel.kt` línea 127 → `https://feria.loanstly.com/main`
**¿Cuál es la URL por defecto correcta? ¿demo o main?**

### P3. ¿Documentar el dominio real o seguir con placeholders?
El código tiene `feria.loanstly.com` hardcodeado. La doc ahora usa `<dominio-del-nodo>`.
**¿Debe documentarse el dominio real o seguir con placeholders?**

### P4. Unidad monetaria: ¿centavo, micro-units o centimos?
- README y docs → "centavo"
- `AppDatabase.kt` línea 19 → "micro-units TQ"
- `Formatters.kt` líneas 53/67 → "centimos"
**¿Cómo se llama la unidad? ¿Centavo, micro-unit o centimo?**

### P5. nfc_card_keys: ¿resumen intencional?
La doc solo describe columnas de la migración 004, pero faltan columnas de migraciones 118/119 (aes_key_encrypted, key_version, rotation_status, etc.).
**¿Es resumen intencional o falta documentar?**

### P6. nfc_cards: ¿omisión intencional?
La doc lista columnas iniciales pero faltan: card_type, crypto_enabled, pin_hash, pin_attempts, blocked_until, last_token_at, card_error, error_at.
**¿Omisión intencional o falta documentar?**

### P7. nfc_terminals: ¿columnas omitidas intencionalmente?
Faltan: chip_id, firmware_binary_path (005), device_model, device_manufacturer, android_version (127), web_session_expires_at, web_session_requested_at (130).
**¿Falta en la doc o es intencional?**

### P8. Formato del payload cifrado
La doc describe `{nonce, ciphertext, signature}` pero el backend espera un `EphemeralMessage` con `handshake` además de esos campos.
**¿Cuál es el formato real del payload cifrado?**

---

## PROBLEMAS CONFIRMADOS (31)

### Docs 01-02 (Arquitectura) — 5 problemas

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| 1 | 02-pos-android | 376 | Doc dice `signMultisigPayment(...)` pero el código tiene `signMultisigNfc(...)` |
| 2 | 02-pos-android | 716-720 | Doc usa `PosAppTheme`/`PosAppScreen` pero el código usa `MyApplicationTheme`/`PosMainContent` |
| 3 | 02-pos-android | 43 | Documenta `NfcWaveAnimation.kt` que no existe |
| 4 | 02-pos-android | 44 | Documenta `MultisigCountdownHeader.kt` que no existe |
| 5 | README | 7 | Dice "centavo" pero el código dice "micro-units"/"centimos" |

### Docs 03-04 (Flujos + API) — 20 problemas

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| 6 | 04-api | 41 | POST /register: doc pide `public_key_hex`+`merchant_user_id` pero el struct no los tiene |
| 7 | 04-api | 55 | POST /register response: doc espera `server_public_key_hex`+`status` pero retorna `terminal`+`registration_token` |
| 8 | 04-api | 64 | POST /complete-registration: doc pide `public_key_hex` pero el código usa `terminal_public_key`+`registration_token`+`device_fingerprint` |
| 9 | 04-api | 88 | POST /auth: doc pide `timestamp`+`signature_hex` pero el código usa `signature`+`nonce`+`device_fingerprint` (sin timestamp) |
| 10 | 04-api | 97 | POST /auth response: doc espera `status`+`terminal` pero retorna `session_token`+`signature`+`format_settings` |
| 11 | 04-api | 120 | POST /heartbeat: doc pide `timestamp`+response `server_time` pero el código pide solo `terminal_id` y retorna `active`/`registered`/`signature` |
| 12 | 04-api | 153 | POST /pair/initiate: doc pide `merchant_user_id` pero el código no lo recibe |
| 13 | 04-api | 169 | POST /pair/initiate response: doc espera `expires_at` pero el código retorna `expires_in` |
| 14 | 04-api | 379 | GET /multisig/status: doc dice `collected_signatures` con `signer_user_id`+`signed_at` pero el código usa `signer_id`+`method`+`card_uid`+`timestamp` |
| 15 | 04-api | 388 | Estados multisig: doc incluye `ready` pero el comentario del código no lo menciona |
| 16 | 03-flujos | 211 | POST /pos/charge: doc dice response `expires_in: 180` pero el código retorna `expires_at` (RFC3339) |
| 17 | 04-api | 491 | GET /pos/charge/{id}/status: doc espera `transaction_id` pero el código no lo retorna |
| 18 | 04-api | 508 | GET /pos/charge/{token}/info: doc espera `charge_token` en response pero el código no lo incluye |
| 19 | 04-api | 521 | POST /pos/charge/{token}/pay: doc pide `id_document_type`+`id_document_number` pero el código solo tiene `payment_method` |
| 20 | 04-api | 528 | POST /pos/charge/{token}/pay response: doc espera `transaction_id`+`message` pero retorna `new_balance`+`payment_method` |
| 21 | 04-api | 620 | GET /api/config: doc dice `currency_code`+`currency_symbol` pero el código retorna `currency_name`+`currency_full_name` |
| 22 | 04-api | 643 | GET /api/public/settings: no existe en el código |
| 23 | 04-api | 662 | GET /accounts/{id}/balance: doc espera `account_id`+`credit_limit`+`debit_limit` pero retorna solo `{"balance": ...}` |
| 24 | 04-api | 678 | POST /api/transfer: doc pide `to_account_id`+`description` pero el código usa `receiver_id` sin `description` |
| 25 | 04-api | — | Faltan decenas de endpoints: `/api/federation/bilateral`, `/api/federation/volume`, `/api/public/pages`, `/api/pos-web/pending-sessions`, `/api/nfc/my-terminals/*`, `/api/nfc/org-terminals/*`, etc. |

### Docs 05-06 (Modelo datos + Crypto) — 4 problemas

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| 26 | 05-modelo | 345 | Doc dice tabla `multisig_expiration_config` pero se llama `multisig_config` (migración 124) |
| 27 | 05-modelo | 250 | Doc dice `expires_at` default 24h pero la migración 124 lo cambia a 10 minutos |
| 28 | 05-modelo | 178 | Doc dice PK de `nfc_card_attempts` es `card_uid` pero es `id UUID` (card_uid es UNIQUE) |
| 29 | 05-modelo | 107 | Doc incluye `wifi_ssid` en `nfc_terminals` pero la migración 126 lo eliminó |

### Docs 07-10 (Formato + Demo + Feedback + Build) — 2 problemas

| # | Archivo | Línea | Problema |
|---|---------|-------|----------|
| 30 | 08-demo | 66 | Doc dice "preconfigurada en modo demo" pero PosApiClient/PosViewModel usan `/main` |
| 31 | 08-demo | 339 | Doc dice `DEMO-TOKEN-{12 chars hex}` pero el código usa `UUID.take(12)` que incluye guiones |

---

## Prioridad sugerida de corrección

### Alta (errores que pueden confundir a otra IA)
- Problemas 6-15: API endpoints con campos incorrectos (docs 03-04)
- Problemas 26-29: Modelo de datos con nombres/valores incorrectos
- Problema 30: Contradicción sobre modo demo por defecto

### Media
- Problemas 1-2: Nombres de funciones/componentes incorrectos
- Problemas 3-4: Componentes que no existen
- Problemas 16-24: Endpoints POS QR con campos incorrectos
- Problema 25: Endpoints faltantes

### Baja
- Problema 5: Nombre de unidad monetaria
- Problema 31: Formato de token demo
