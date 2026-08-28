# Flujos de Pago

Este documento describe todos los flujos de pago soportados por el POS Android y el backend Go, incluyendo pagos NFC simples, pagos comunitarios multi-vendedor, cargas QR, y pagos multi-firma (mancomunada).

---

## 1. Pago NFC Simple

El flujo más básico: un cliente acerca su tarjeta NFC al terminal y paga al comerciante asignado al terminal.

### Endpoint
```
POST /api/nfc/terminal/payment
```

### Payload cifrado (CommunityPaymentDecryptedPayload → NFCPaymentPayload)
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

### Lógica del backend (`ProcessNFCPayment` en `internal/payments/nfc_terminal.go`)

1. Verificar que el terminal existe y está activo
2. Buscar la tarjeta NFC por `card_uid`
3. **Verificar si la tarjeta está bloqueada** (`checkCardBlocked`): consulta `nfc_card_attempts.blocked_until` → si está en el futuro, rechazar con "tarjeta bloqueada por intentos de PIN"
4. Verificar PIN (bcrypt compare contra `pin_hash`): si falla → `incrementCardAttempt` (después de 3 intentos → bloqueo 15 min)
5. Si PIN correcto → `resetCardAttempts` (limpia contador y bloqueo)
6. Verificar documento de identidad si la tarjeta es `uid_only` y el nodo lo requiere
7. Obtener balance y `credit_limit` del usuario
8. Verificar límite de crédito: `balance - amount < credit_limit` → rechazado
9. **Verificar multifirma**: `checkAccountMultiSig(userID)` → si `required_signatures > 1`:
   - Crear `pending_multisig_payments` con `payment_type="nfc"`
   - Firmar con el primer firmante (el comprador que acercó la tarjeta)
   - Retornar `status="pending_multisig"` con `pending_id`, `required_sigs`, `collected_sigs=1`, `remaining_sigs`
8. Si no requiere multifirma: debitar de `card.UserID`, acreditar al `merchant_user_id` del terminal
9. Retornar `status="approved"` con `transaction_id` y `user_balance`

### Respuesta (NFCPaymentResult)
```json
{
  "status": "approved",
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
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
  "message": "Pago pendiente. Faltan 1 firma(s). Acerque las tarjetas de los firmantes autorizados.",
  "user_balance": 250000
}
```

### Diagrama de secuencia
```
POS Android          Backend Go              Base de datos
    │                   │                       │
    │  POST /payment    │                       │
    │  (cifrado AES)    │                       │
    ├──────────────────►│                       │
    │                   │  Decrypt payload      │
    │                   │  Lookup card          │
    │                   ├──────────────────────►│
    │                   │ ◄─────────────────────┤
    │                   │  Verify PIN (bcrypt)  │
    │                   │  Check credit_limit   │
    │                   │  Check required_sigs  │
    │                   ├──────────────────────►│
    │                   │ ◄─────────────────────┤
    │                   │                       │
    │                   │  if required_sigs > 1:│
    │                   │    Create pending     │
    │                   │    Sign first signer  │
    │                   │    Return pending     │
    │                   │  else:                │
    │                   │    Debit buyer        │
    │                   │    Credit merchant    │
    │                   ├──────────────────────►│
    │                   │  Encrypt response     │
    │  Response (cifrado)│                      │
    │◄──────────────────┤                       │
    │                   │                       │
    │  if pending_multisig:                     │
    │    Enter multisig flow                    │
    │  if approved:                             │
    │    Show receipt                           │
```

---

## 2. Pago Comunitario Multi-Vendedor

Flujo para ferias: un vendedor acerca su tarjeta, luego un comprador acerca la suya. El dinero va directamente del comprador al vendedor sin intermediario.

### Endpoint
```
POST /api/nfc/terminal/payment/community
```

### Payload cifrado (CommunityPaymentDecryptedPayload)
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
  "nonce": "a1b2c3d4e5f6...",
  "buyer_id_document_type": "cedula",
  "buyer_id_document_number": "V12345678"
}
```

### Lógica del backend (`ProcessCommunityPayment` en `internal/payments/nfc_terminal.go`)

1. Verificar terminal activo
2. Buscar tarjeta vendedora y compradora
3. Verificar que vendedor ≠ comprador (mismo `user_id`)
4. Verificar PIN del vendedor (bcrypt)
5. Verificar PIN del comprador (bcrypt) + bloqueo por intentos (3 intentos → 15 min bloqueo, hardcodeado)
6. Verificar documento de identidad del comprador si es `uid_only`
7. Obtener balance y `credit_limit` del comprador
8. Verificar límite de crédito
9. **Verificar multifirma del comprador** (NUEVO): `checkAccountMultiSig(buyerCard.UserID)` → si `required_signatures > 1`:
   - Crear `pending_multisig_payments` con `payment_type="nfc_community"`, `from_account=buyerCard.UserID`, `to_account=sellerCard.UserID`
   - Firmar con el primer firmante (comprador)
   - Retornar `status="pending_multisig"` con `pending_id`, `required_sigs`, `collected_sigs=1`, `remaining_sigs`
10. Si no requiere multifirma: debitar comprador, acreditar vendedor
11. Retornar `status="approved"`

### Diagrama de secuencia
```
POS Android          Backend Go              Base de datos
    │                   │                       │
    │  POST /community  │                       │
    │  (seller + buyer) │                       │
    ├──────────────────►│                       │
    │                   │  Lookup seller card   │
    │                   │  Lookup buyer card    │
    │                   │  Verify seller PIN    │
    │                   │  Verify buyer PIN     │
    │                   │  Verify buyer ID doc  │
    │                   │  Check credit_limit   │
    │                   │  Check buyer          │
    │                   │    required_sigs      │
    │                   ├──────────────────────►│
    │                   │ ◄─────────────────────┤
    │                   │                       │
    │                   │  if required_sigs > 1:│
    │                   │    Create pending     │
    │                   │    (nfc_community)    │
    │                   │    Sign first signer  │
    │                   │    Return pending     │
    │                   │  else:                │
    │                   │    Debit buyer        │
    │                   │    Credit seller      │
    │                   ├──────────────────────►│
    │  Response         │                       │
    │◄──────────────────┤                       │
```

---

## 3. Pago QR

El POS genera una carga (charge) y muestra un código QR. El cliente escanea el QR, abre la web, se autentica y confirma el pago.

### Endpoints
```
POST /api/pos/charge          — Crear carga
GET  /api/pos/charge/{id}/status  — Consultar estado
GET  /api/pos/charge/{token}/info — Info pública por token
POST /api/pos/charge/{id}/cancel  — Cancelar carga
```

### Flujo

1. **POS crea la carga**:
   ```
   POST /api/pos/charge
   { "amount_micro_units": 12500, "description": "Compra de productos" }
   ```
   Respuesta:
   ```json
   {
     "charge_id": "chg-uuid",
     "charge_token": "token-uuid",
     "amount": 12500,
     "status": "pending",
     "expires_in": 180
   }
   ```

2. **POS genera URL QR**: `{serverUrl}/pay?token={charge_token}`

3. **Cliente escanea QR** → abre URL en navegador → ve preview pública (monto, comerciante, concepto)

4. **Cliente inicia sesión** → ve página de confirmación con:
   - Identidad del pagador
   - Receptor
   - Balance actual
   - Balance proyectado
   - Límites comunitarios
   - Cuentas involucradas

5. **Cliente confirma** → web app llama al backend para procesar el pago

6. **POS hace polling** cada 2-3 segundos:
   ```
   GET /api/pos/charge/{charge_id}/status
   ```
   Hasta que `status` sea `"paid"` o `"expired"` o `"cancelled"`.

7. **Expiración**: 3 minutos. Si no se paga, el POS muestra "Tiempo agotado".

### Diagrama de secuencia
```
POS Android          Backend Go           Web App (cliente)
    │                   │                      │
    │  POST /charge     │                      │
    ├──────────────────►│                      │
    │  charge_token     │                      │
    │◄──────────────────┤                      │
    │                   │                      │
    │  Display QR       │                      │
    │  (URL con token)  │                      │
    │                   │                      │
    │                   │   GET /pay?token=... │
    │                   │◄─────────────────────┤
    │                   │   Preview pública    │
    │                   ├─────────────────────►│
    │                   │                      │
    │                   │   Login + confirm    │
    │                   │◄─────────────────────┤
    │                   │   Process payment    │
    │                   │   Debit / Credit     │
    │                   ├─────────────────────►│
    │                   │                      │
    │  GET /status      │                      │
    ├──────────────────►│                      │
    │  status="paid"    │                      │
    │◄──────────────────┤                      │
    │                   │                      │
    │  Show receipt     │                      │
```

---

## 4. Pago Multi-Firma (Mancomunada)

Cuando una cuenta tiene `required_signatures > 1` en la tabla `users`, los pagos desde esa cuenta requieren múltiples firmas autorizadas. Cada firmante debe acercar su tarjeta NFC e ingresar su PIN.

### Endpoints
```
POST /api/nfc/terminal/payment/multisig-sign     — Firmar pago pendiente
GET  /api/nfc/terminal/payment/multisig/{pendingId}/status  — Consultar estado
```

### Flujo

#### Paso 1: Primera firma (incluida en el pago inicial)

Cuando se hace un pago NFC simple o comunitario y la cuenta del comprador requiere multifirma:
1. El backend crea un registro en `pending_multisig_payments`:
   - `status = "pending"`
   - `required_signatures` = valor de `users.required_signatures`
   - `authorized_signers` = array de UUIDs de `users.authorized_signers`
   - `collected_signatures = []`
   - `expires_at = NOW() + 3 minutos`
2. El primer firmante (el comprador que acercó su tarjeta) firma automáticamente
3. Se retorna `status="pending_multisig"` con:
   - `pending_id`: UUID del pago pendiente
   - `required_sigs`: número total de firmas necesarias
   - `collected_sigs`: 1
   - `remaining_sigs`: `required_sigs - 1`

#### Paso 2: Firmas siguientes

Cada firmante autorizado:
1. Acerca su tarjeta NFC al terminal
2. Ingresa su PIN de 4 dígitos
3. El POS envía:
   ```
   POST /api/nfc/terminal/payment/multisig-sign
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

4. El backend (`SignMultisigPaymentWithCard` en `internal/payments/multisig.go`):
   - Verifica que el pago existe y está `pending`
   - Verifica que no ha expirado
   - Busca la tarjeta del firmante
   - Verifica PIN
   - Verifica documento de identidad si es `uid_only`
   - Verifica que el firmante está en `authorized_signers`
   - Verifica que no haya firmado ya
   - Agrega la firma a `collected_signatures`
   - **Resetea el timeout**: `expires_at = NOW() + 3 minutos` (cada firma da 3 minutos más)
   - Calcula `remaining = required_signatures - len(collected)`
   - Si `remaining == 0`: cambia status a `"ready"` y ejecuta el pago automáticamente
   - Retorna `pending_multisig` con `remaining_sigs` actualizado, o `approved` si se completó

#### Paso 3: Ejecución automática

Cuando `remaining_sigs == 0`:
1. `ExecutePendingPayment` en `multisig.go`:
   - Verifica que `status == "ready"`
   - Verifica saldo nuevamente (puede haber cambiado)
   - Si `balance - amount < credit_limit`: marca como `cancelled`
   - Debita `from_account`, acredita `to_account`
   - Registra transacción con `tx_type = "multisig_" + payment_type`
   - Marca como `executed` con `executed_at = NOW()`
2. Retorna `status="approved"` con `user_balance` actualizado

#### Polling de estado

El POS hace polling cada 2.5 segundos:
```
GET /api/nfc/terminal/payment/multisig/{pendingId}/status
```

Respuesta:
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
  "collected_signatures": [...]
}
```

El polling detecta:
- `"executed"` → pago completado, mostrar recibo
- `"expired"` → tiempo agotado, mostrar error
- `"cancelled"` → anulado, mostrar error
- `"pending"` → actualizar contador y firmas recolectadas

### Expiración

- **3 minutos** por firma (configurable en `multisig_config.expiration_minutes`)
- Cada firma válida **resetea** el timer a 3 minutos
- Si nadie firma en 3 minutos, el pago se anula automáticamente
- El endpoint de status auto-anula si detecta que ya expiró

### Diagrama de secuencia (2 firmas)
```
Firmante 1          POS Android          Backend Go           DB
    │                   │                   │                  │
    │  Tap card + PIN   │                   │                  │
    ├──────────────────►│                   │                  │
    │                   │  POST /payment    │                  │
    │                   │  (o /community)   │                  │
    │                   ├──────────────────►│                  │
    │                   │                   │  Check req_sigs  │
    │                   │                   │  Create pending  │
    │                   │                   ├─────────────────►│
    │                   │                   │  Sign firmante 1 │
    │                   │                   ├─────────────────►│
    │                   │  pending_multisig │                  │
    │                   │  remaining=1      │                  │
    │◄──────────────────┤◄──────────────────┤                  │
    │                   │                   │                  │
    │                   │  Start polling    │                  │
    │                   ├──────────────────►│                  │
    │                   │  pending, 145s    │                  │
    │                   │◄──────────────────┤                  │
    │                   │                   │                  │
Firmante 2              │                   │                  │
    │  Tap card + PIN   │                   │                  │
    ├──────────────────►│                   │                  │
    │                   │  POST /multisig-  │                  │
    │                   │    sign           │                  │
    │                   ├──────────────────►│                  │
    │                   │                   │  Verify card     │
    │                   │                   │  Verify PIN      │
    │                   │                   │  Verify auth     │
    │                   │                   │  Add signature   │
    │                   │                   ├─────────────────►│
    │                   │                   │  remaining=0     │
    │                   │                   │  Execute payment │
    │                   │                   │  Debit / Credit  │
    │                   │                   ├─────────────────►│
    │                   │  approved         │                  │
    │                   │  user_balance     │                  │
    │◄──────────────────┤◄──────────────────┤                  │
    │                   │                   │                  │
    │                   │  Show receipt     │                  │
```

---

## 5. Modo Demo vs Modo Real

### Detección
```kotlin
val isDemoNode: Boolean
    get() = serverUrl.contains("/demo")
```

### Modo Demo (`isDemoNode = true`)
- **NO se comunica con el servidor** para simulaciones
- Las simulaciones son locales en `PosRepository` dentro de bloques `if (apiClient.isDemoNode)`
- Botones de simulación visibles en la UI
- `DemoWatermarkOverlay` muestra banner de demo
- Funciona offline (no requiere servidor encendido)
- Genera IDs ficticios: `DEMO-CHG-*`, `DEMO-TOKEN-*`
- Simula `pending_multisig` basándose en el `card_uid` (contiene `MULTISIG`, `2SIG`, `3SIG`, `3F`)

### Modo Real (`isDemoNode = false`)
- **Siempre** se comunica con el servidor
- **NUNCA** ejecuta simulaciones locales
- Si el servidor falla, retorna errores reales al usuario
- Sin botones de simulación
- El servidor decide si una cuenta requiere multifirma (no el cliente)

### Simulaciones en PosRepository (todas dentro de `if (apiClient.isDemoNode)`)
| Método | Simulación |
|--------|-----------|
| `createQrCharge` | Genera `DEMO-CHG-*` / `DEMO-TOKEN-*` |
| `processNfcPayment` | Simula `approved` o `pending_multisig` según cardUid |
| `processCommunityPayment` | Simula `approved` |
| `signMultisigNfc` | Simula `pending_multisig` o `approved` según cardUid |
| `getMultisigStatus` | Simula estado `pending` |

### Métodos de simulación en PosViewModel
| Método | Acción |
|--------|--------|
| `simulateQrApproval(sigs)` | Simula pago QR aprobado |
| `simulateQrMultisigSignature()` | Simula firma adicional QR |
| `simulateQrRejection()` | Simula rechazo/anulación QR |

Estos métodos solo se llaman desde botones de simulación que solo son visibles cuando `isDemoNode = true`.
