# Pagos

## Archivos
- `internal/payments/payments.go` - Logica de pagos QR, NFC, manual
- `internal/payments/nfc_terminal.go` - Modulo de terminales NFC ESP32
- `internal/crypto/terminal_crypto.go` - Criptografia de terminales (Ed25519, ECDH, AES-GCM)
- `internal/api/payments.go` - Handlers API REST
- `internal/api/nfc_terminal.go` - Handlers API NFC terminales
- `web/src/pages/Payments.tsx` - Frontend con tabs QR/NFC/Manual
- `web/src/pages/NFCTerminals.tsx` - Frontend gestion terminales NFC
- `firmware/` - Firmware ESP32 para terminales NFC

## Tipos de Pago

### 1. Pago QR

#### Generacion
- `POST /api/payments/qr/generate`
- Parametros: display_name, amount, label
- Retorna: codigo QR (string) con datos de pago embebidos

#### Parseo y Procesamiento
- `POST /api/payments/qr/parse`
- Recibe: codigo QR escaneado
- Valida: formato, destinatario, monto
- Crea transaccion: debit del pagador, credit del receptor, impuesto si aplica

### 2. Pago NFC (Tarjetas)

#### Tarjetas NFC
- `nfc_cards`: vinculadas a usuarios (card_uid unico)
- `POST /api/payments/nfc/lookup`: busca usuario por card_uid
- `POST /api/nfc/terminal/{id}/assign`: asigna terminal a usuario (requiere permiso)

#### Flujo
1. Comercio lee tarjeta NFC del cliente
2. Sistema busca usuario asociado
3. Comercio ingresa monto
4. Sistema procesa transaccion

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
- `POST /api/nfc/terminal/classic/pre-auth` — Pre-autenticacion tarjeta Classic (cert dinamicos)
- `POST /api/nfc/terminal/classic/confirm` — Confirmar lectura/escritura tarjeta Classic

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

#### Flujo de pago con MIFARE Classic (certificados dinamicos)
1. Comerciante ingresa monto
2. Cliente ingresa documento de identidad + PIN (sin tarjeta)
3. POS envia pre-auth al servidor (cifrado)
4. Servidor valida usuario, PIN, saldo → bloquea monto
5. Servidor responde: sector a leer + Key A + cert esperado + sector a escribir + Key B + cert nuevo
6. POS muestra "ACERQUE SU TARJETA"
7. POS lee UID, lee sector con Key A, verifica cert (triple redundancia)
8. POS escribe nuevo cert en sector destino con Key B
9. POS confirma al servidor
10. Servidor procesa pago, rota sector activo

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
