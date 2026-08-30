# POS Web Federada (`pos/`)

Punto de venta web. Es la versión web del POS Android (`punto-de-venta-pos/`).

## Stack

- React 18 + TypeScript + Vite (puerto 3001)
- Dependencias: `react`, `qrcode`, `vite-plugin-pwa`

## Diferencia con el panel web (`web/`)

| | POS Web (`pos/`) | Panel web (`web/`) |
|---|---|---|
| Función | Cobros (POS) | Gestión de cuenta |
| Directorio | `pos/` | `web/` |
| Puerto | 3001 | 5173 |
| Auth | Terminal auth (Ed25519 + sesión temporal) | JWT de usuario |
| Pagos | QR + NFC | Transferencias manuales |

El POS Web **no** es el panel web. El POS Web es exclusivamente para cobros.

## Pantallas

| Pantalla | Archivo | Función |
|---|---|---|
| Login | `LoginScreen.tsx` | Autenticación de terminal (3 niveles) |
| Session Request | `SessionRequestScreen.tsx` | Solicitar sesión temporal al dueño del terminal |
| Setup | `SetupScreen.tsx` | Configuración inicial del terminal |
| Settings | `SettingsScreen.tsx` | Configuración del terminal |
| Keypad | `KeypadScreen.tsx` | Ingreso de monto |
| QR | `QRScreen.tsx` | Generar y mostrar código QR |
| NFC | `NFCScreen.tsx` | Pago NFC (flujo unificado) |
| Confirm Amount | `ConfirmAmountScreen.tsx` | Confirmar monto |
| Sales | `SalesScreen.tsx` | Historial de ventas |
| Shift | `ShiftScreen.tsx` | Gestión de turno |

## Flujo de pago QR

1. **Terminal autenticado** ingresa monto
2. POS Web crea cargo: `POST /api/pos/charge`
3. POS Web muestra QR con URL: `{serverUrl}/pay?token={charge_token}`
4. **Cliente escanea QR** desde su celular → abre URL
5. Cliente ve preview pública (monto, comerciante, concepto)
6. Cliente inicia sesión → ve página de confirmación con:
   - Identidad del pagador
   - Receptor
   - Balance actual y proyectado
   - Límites comunitarios
7. Cliente confirma → backend procesa pago
8. POS Web hace polling cada 2-3s: `GET /api/pos/charge/{id}/status`
9. Cuando `status = "paid"` → muestra comprobante
10. Expiración: 3 minutos

**Importante:** En el pago QR, el pago lo emite el **comprador** (quien escanea el QR), no el vendedor. El POS Web solo genera el cargo y espera.

## Flujo de pago NFC (unificado)

El POS Web sigue el mismo flujo que el POS Android:

1. **Terminal autenticado** ingresa monto
2. **Cliente ingresa documento + PIN** (siempre obligatorio, sin tarjeta)
3. POS Web envía pre-auth: `POST /api/nfc/terminal/classic/pre-auth`
4. Servidor valida documento + PIN, identifica tipo de tarjeta
5. Servidor responde con `card_type`:
   - `classic`: datos de sectores (certificados dinámicos)
   - `uid_only`/`desfire`: solo `card_uid`
6. POS Web muestra "ACERQUE SU TARJETA"
7. Cliente acerca tarjeta (Web NFC API o lector Bluetooth)
8. POS Web verifica UID contra pre-auth
9. Si es Classic: simula lectura/escritura (Web NFC no soporta MIFARE Classic sector read/write — requiere lector BLE)
10. Si es UID/DESFire: llama a `processNfcPayment`
11. POS Web muestra resultado

### Limitación Web NFC

La Web NFC API (`NDEFReader`) solo soporta lectura de NDEF, no autenticación de sectores MIFARE Classic. Para Classic con certificados dinámicos se requiere un lector Bluetooth que soporte lectura/escritura de sectores.

## Modo demo

Si `isDemoNode = true` (URL contiene `/demo`):
- Pre-auth se simula según el documento ingresado
- `MULTISIG`/`2SIG`/`FIRM` → DESFire con multifirma
- `3SIG`/`3F` → DESFire con multifirma (3 firmas)
- Otro → Classic con certificados dinámicos
- Confirm Classic se simula como `approved`

## Estructura

```
pos/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
└── src/
    ├── api.ts              # Cliente API
    ├── App.tsx             # Router principal
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── SessionRequestScreen.tsx
    │   ├── SetupScreen.tsx
    │   ├── SettingsScreen.tsx
    │   ├── KeypadScreen.tsx
    │   ├── QRScreen.tsx
    │   ├── NFCScreen.tsx
    │   ├── ConfirmAmountScreen.tsx
    │   ├── SalesScreen.tsx
    │   └── ShiftScreen.tsx
    └── utils/
        └── format.ts       # Formato de moneda
```

## Ver también

- [POS Android docs](../punto-de-venta-pos/docs/README.md) — Documentación completa del POS Android
- [Pagos](../docs/payments.md) — Tipos de pago, endpoints, validaciones
- [Tarjeta Classic](../docs/tarjeta-classic-certificados.md) — Certificados dinámicos MIFARE Classic
- [Criptografía POS Android](../punto-de-venta-pos/docs/06-criptografia.md) — Ed25519, ECDH, AES-256-GCM
