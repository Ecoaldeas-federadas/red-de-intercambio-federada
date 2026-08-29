# Tareas Pendientes — Decisiones del Usuario

Este documento explica 4 temas detectados durante la auditoría de documentación que requieren decisión o explicación antes de proceder.

---

## 1. Componentes UI que no existen: NfcWaveAnimation.kt y MultisigCountdownHeader.kt

### Qué son estos componentes

La documentación (`02-pos-android-arquitectura.md`) menciona dos archivos de componentes Compose que **no existen** en el código actual:

#### NfcWaveAnimation.kt
**Qué sería:** Una animación visual de ondas NFC que se mostraría en la pantalla del POS cuando el terminal está esperando que el usuario acerque su tarjeta NFC. Similar a la animación de "ondas" que muestran los lectores de tarjetas en apps como Google Pay o Apple Pay.

**Dónde se mencionó:** En la lista de componentes UI de la arquitectura del POS Android.

**Por qué sería útil:** Mejora la experiencia visual del usuario indicando claramente que el terminal está en modo de espera de tarjeta. Actualmente la UI probablemente solo muestra un texto "Acerque su tarjeta" sin animación visual.

**Esfuerzo estimado:** Bajo-medio. Es un componente puramente visual en Jetpack Compose, no afecta lógica de negocio ni API.

#### MultisigCountdownHeader.kt
**Qué sería:** Un encabezado reutilizable que muestra un contador regresivo (countdown) durante un pago multi-firma pendiente. Mostraría:
- Tiempo restante antes de que expire el pago multi-firma
- Número de firmantes que faltan (ej: "Firmante 2 de 3")
- Indicador visual de urgencia (cambia de color cuando queda poco tiempo)

**Dónde se mencionó:** En la lista de componentes UI de la arquitectura del POS Android.

**Por qué sería útil:** Centraliza la lógica del countdown en un solo componente reutilizable. Actualmente esta lógica probablemente está duplicada o inline en `NfcChargeScreen.kt` y `MultiVendorScreen.kt`.

**Esfuerzo estimado:** Bajo. Es un componente de presentación, la lógica de countdown ya existe en el ViewModel.

### Decisión pendiente
- **Opción A:** Crear estos componentes (tarea de implementación futura)
- **Opción B:** Quitarlos de la documentación (no se van a implementar)
- **Opción C:** Dejarlos en la doc como "componentes planeados" con una nota

---

## 2. URL por defecto del POS Android: /demo vs /main

### El problema

Hay una contradicción en el código Android sobre qué URL usa el POS por defecto al arrancar por primera vez:

| Archivo | Línea | URL por defecto | Modo |
|---------|-------|-----------------|------|
| `AppDatabase.kt` | 46 | `https://feria.loanstly.com/demo` | Demo |
| `PosApiClient.kt` | 15 | `https://feria.loanstly.com/main` | Real |
| `PosViewModel.kt` | 127 | `https://feria.loanstly.com/main` | Real |
| `SettingsScreen.kt` | 170-171 | `https://feria.loanstly.com/main` | Real (botón "Modo Real") |
| `SettingsScreen.kt` | 192-193 | `https://feria.loanstly.com/demo` | Demo (botón "Modo Demo") |

### Qué significa
- `AppDatabase.kt` define el valor inicial que se guarda en la base de datos Room la primera vez que se instala la app.
- `PosApiClient.kt` y `PosViewModel.kt` definen el valor que se usa si no hay configuración guardada en Room.
- En la práctica, `AppDatabase.kt` gana porque Room se inicializa primero, pero hay inconsistencia.

### Tu decisión
Indicaste que **el POS Android debe arrancar en modo real (/main) por defecto**.

### Acción
- Cambiar `AppDatabase.kt` línea 46 de `/demo` a `/main`
- Asegurar que todos los archivos coincidan en `/main`
- La documentación debe reflejar que el default es `/main`

---

## 3. Nombre de la unidad fraccional: centavo, micro-unit o centimo

### El problema

La unidad fraccional de TQ (1 TQ = 100 unidades) se llama de 3 formas diferentes en el código:

| Archivo | Línea | Nombre usado |
|---------|-------|--------------|
| `README.md` (docs) | 7 | "centavo" |
| `AppDatabase.kt` | 19 | "micro-units TQ" |
| `Formatters.kt` | 53, 67 | "centimos" |

### Tu decisión
Indicaste que el nombre de la unidad fraccional debería ser **configurable desde los ajustes del nodo**, igual que el nombre de la moneda (TQ). Cada nodo puede adaptar el nombre a su cultura local, pero el valor sigue siendo el mismo (1 TQ = 100 unidades fraccionales).

### Qué habría que hacer
1. **Backend:** Añadir `fractional_unit_name` a `node_config.settings` (default: "centavo")
2. **Backend:** Incluir `fractional_unit_name` en `format_settings` de `/api/config` y `/api/auth/me`
3. **Android:** Añadir `fmtFractionalUnitName` a `TerminalConfigEntity` (migración Room 3→4)
4. **Android:** `FormatConfig.fractionalUnitName` se usa en `CurrencyHelper.formatMicroUnits()`
5. **Web:** Usar el nombre configurable en lugar de hardcoded

### Nota
Esto es una **tarea de implementación** mayor que requiere cambios en backend, Android y web. Por ahora, la documentación debería:
- Usar "centavo" como nombre genérico
- Notar que el nombre es configurable por nodo
- Documentar que el código actualmente usa nombres inconsistentes (a corregir)

---

## 4. Payload cifrado: EphemeralMessage con handshake

### Qué es esto

Cuando el POS Android envía un pago NFC al backend, el payload (datos del pago) va **cifrada** para que nadie pueda interceptar los datos sensibles (PIN, monto, card_uid). El sistema usa cifrado AES-256-GCM con una clave compartida entre el terminal y el servidor.

### El problema

La documentación (`04-api-endpoints.md`) describe el payload cifrado como:
```json
{
  "nonce": "...",
  "ciphertext": "...",
  "signature": "..."
}
```

Pero el código backend (`internal/payments/nfc_terminal.go`, función `DecodePayload`) espera un formato más complejo llamado `EphemeralMessage` que incluye además un **handshake**:
```json
{
  "handshake": {
    "ephemeral_public_key": "...",
    "nonce": "..."
  },
  "nonce": "...",
  "ciphertext": "...",
  "signature": "..."
}
```

### Qué es el handshake
El **handshake** es un intercambio criptográfico adicional donde el terminal genera una clave efímera (temporal, de un solo uso) para cada transacción. Esto proporciona **perfect forward secrecy** (secreto perfecto hacia adelante): incluso si la clave compartida del terminal se compromete en el futuro, las transacciones pasadas siguen siendo indescifrables porque cada una usó una clave efímera diferente que ya no existe.

### Importancia
- **Seguridad:** El handshake con clave efímera es una medida de seguridad avanzada que protege transacciones históricas.
- **Complejidad:** Añade un paso más al flujo criptográfico pero no cambia la API externa (el endpoint es el mismo).
- **Estado:** El backend ya lo implementa (`DecodePayload` en `nfc_terminal.go`), pero la documentación no lo refleja.

### Tu decisión
Indicaste que el backend está correcto (es más avanzado) y que la documentación está desactualizada. También pediste que se documente explicando qué es.

### Acción
- Actualizar `06-criptografia.md` para documentar el `EphemeralMessage` completo con handshake
- Actualizar `04-api-endpoints.md` para reflejar el formato real del payload
- Añadir explicación del handshake y perfect forward secrecy

---

## Resumen de acciones

| # | Tema | Acción | Estado |
|---|------|--------|--------|
| 1 | Componentes UI inexistentes | Ya existen en KioskComponents.kt — doc corregida | ✅ Resuelto |
| 2 | URL default /demo vs /main | Cambiar a /main en AppDatabase.kt | ✅ Corregido |
| 3 | Nombre unidad fraccional | Estandarizar "centavo" en todo el código Android | ✅ Corregido |
| 4 | Payload cifrado con handshake | Documentar EphemeralMessage en doc 06 | ✅ Documentado |
| 5 | BRECHA: Android no envía EphemeralMessage | Implementar handshake efímero en CryptoEngine.kt | ✅ Resuelto |
