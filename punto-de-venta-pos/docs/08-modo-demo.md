# 08 — Modo Demo

> **Proyecto:** Red de Intercambio Federada / Sistema TQ
> **Componente:** POS Android (`punto-de-venta-pos/`)
> **Archivos clave:**
> - `app/src/main/java/com/example/data/api/PosApiClient.kt` (isDemoNode)
> - `app/src/main/java/com/example/ui/components/DemoWatermarkOverlay.kt`
> - `app/src/main/java/com/example/data/repository/PosRepository.kt` (bloques de simulación)
> - `app/src/main/java/com/example/ui/viewmodel/PosViewModel.kt` (simulateQrApproval, etc.)
> - `app/src/main/java/com/example/ui/screens/QrChargeScreen.kt`
> - `app/src/main/java/com/example/ui/screens/MultiVendorScreen.kt`

---

## 1. Visión General

El modo demo permite **demostrar la funcionalidad completa del sistema** sin necesidad de un servidor real en ejecución y sin realizar transacciones reales. Cuando el POS está configurado con una URL de servidor que contiene `/demo`, se activan simulaciones locales que generan respuestas realistas para todos los flujos de pago.

**Propósito:**
- Demostraciones a usuarios sin riesgo de transacciones reales.
- Testing de UI/UX sin dependencia de servidor.
- Capacitación de operadores de POS.
- Funcionamiento **offline** (sin conexión a servidor).

**Garantía crítica:** En modo real (URL sin `/demo`), **NUNCA** se simula. Cualquier error del servidor se propaga como error real al usuario.

---

## 2. Detección del Modo Demo

### 2.1. isDemoNode en PosApiClient

**Archivo:** `PosApiClient.kt` líneas 27-28

```kotlin
/**
 * Returns true if the configured server URL points to a demo node (contains /demo).
 * Demo nodes show simulation buttons; real nodes (e.g. /main) do not.
 */
val isDemoNode: Boolean
    get() = serverUrl.contains("/demo")
```

**Criterio de detección:** Si la URL del servidor contiene el substring `"/demo"`, el terminal está en modo demo.

**Ejemplos:**

| URL | `isDemoNode` | Modo |
|-----|-------------|------|
| `https://<dominio>/demo` | `true` | Demo |
| `https://<dominio>/main` | `false` | Real |
| `https://<dominio>/demo/api/` | `true` | Demo |
| `https://midominio.org/demo` | `true` | Demo |
| `https://midominio.org/main` | `false` | Real |

> **Nota:** `<dominio>` es un placeholder. Cada nodo federado tiene su propio dominio. La URL real se configura en la pantalla de Settings del POS.

### 2.2. URL default del terminal

**Archivo:** `AppDatabase.kt` línea 46

```kotlin
val serverUrl: String = "https://<dominio-del-nodo>/demo" // valor por defecto, configurable
```

La URL por defecto del terminal es un nodo real (`/main`). Esto significa que la app arranca en modo real por defecto. Para usar modo demo, el usuario debe cambiar la URL en Settings a una URL que contenga `/demo`.

### 2.3. Propagación del estado isDemoNode

El estado `isDemoNode` se propaga a la UI a través del `PosViewModel` y el `uiState`:

```kotlin
// En PosViewModel, el uiState incluye isDemoNode
data class PosUiState(
    // ...
    val isDemoNode: Boolean = false,
    // ...
)
```

El ViewModel lee `apiClient.isDemoNode` y lo expone en el estado de la UI para que las pantallas puedan mostrar/ocultar botones de simulación.

---

## 3. DemoWatermarkOverlay — Marca de Agua Visual

### 3.1. Propósito

Cuando el terminal está en modo demo, se muestra una **marca de agua diagonal** sobre toda la pantalla, junto con un **banner de advertencia** en la parte superior. Esto garantiza que el usuario siempre sepa que está en modo demo y que las transacciones no son reales.

### 3.2. DemoWatermarkOverlay Composable

**Archivo:** `DemoWatermarkOverlay.kt` líneas 31-58

```kotlin
@Composable
fun DemoWatermarkOverlay(
    isDemo: Boolean,
    modifier: Modifier = Modifier,
    onBannerClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier = modifier.fillMaxSize()) {
        // Screen Content
        content()

        if (isDemo) {
            // Diagonal Watermarks on canvas over/under (with non-blocking touch)
            DemoWatermarkCanvas(
                modifier = Modifier.fillMaxSize()
            )

            // Top Persistent Warning Badge / Banner
            DemoTopHeaderBanner(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars),
                onClick = onBannerClick
            )
        }
    }
}
```

**Estructura:**
1. **Contenido de la pantalla** — se renderiza normalmente.
2. **DemoWatermarkCanvas** — canvas con texto diagonal repetido sobre toda la pantalla.
3. **DemoTopHeaderBanner** — banner dorado en la parte superior con texto de advertencia.

**`onBannerClick`:** El banner es **clickeable** y navega a la pantalla de Settings, donde el usuario puede cambiar la URL del servidor a un nodo real.

### 3.3. DemoWatermarkCanvas — Texto Diagonal

**Archivo:** `DemoWatermarkOverlay.kt` líneas 61-119

```kotlin
@Composable
fun DemoWatermarkCanvas(modifier: Modifier = Modifier) {
    val watermarkPaint = remember {
        Paint().apply {
            color = android.graphics.Color.argb(22, 245, 158, 11) // Gold with subtle opacity
            textSize = 42f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.15f
        }
    }

    val smallWatermarkPaint = remember {
        Paint().apply {
            color = android.graphics.Color.argb(16, 239, 68, 68) // Red with subtle opacity
            textSize = 28f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.1f
        }
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height

        drawIntoCanvas { canvas ->
            withTransform({
                rotate(-28f, pivot = Offset(w / 2f, h / 2f))
            }) {
                // ... dibujar texto repetido en patrón de grilla
                // Filas pares: "⚡ MODO DEMO • SIMULACIÓN" (dorado, alpha=22)
                // Filas impares: "⚠️ NO ES TRANSACCIÓN REAL" (rojo, alpha=16)
            }
        }
    }
}
```

**Características visuales:**
- **Rotación:** -28 grados sobre el centro de la pantalla.
- **Patrón de grilla:** Texto repetido en filas, con offset alternado (efecto ladrillo).
- **Dos textos alternados:**
  - Filas pares: `"⚡ MODO DEMO • SIMULACIÓN"` — dorado, alpha 22/255 (sutil).
  - Filas impares: `"⚠️ NO ES TRANSACCIÓN REAL"` — rojo, alpha 16/255 (sutil).
- **No bloquea el touch:** El canvas no intercepta eventos táctiles; el contenido debajo sigue siendo interactivo.

### 3.4. DemoTopHeaderBanner — Banner Superior

**Archivo:** `DemoWatermarkOverlay.kt` líneas 122-161

```kotlin
@Composable
fun DemoTopHeaderBanner(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Surface(
        color = PosGold.copy(alpha = 0.95f),
        contentColor = PosNavyDark,
        shadowElevation = 4.dp,
        modifier = modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, PosGoldLight, RoundedCornerShape(10.dp))
            .then(
                if (onClick != null) Modifier.clickable { onClick() } else Modifier
            )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Science,
                contentDescription = "Demo Mode",
                tint = PosNavyDark,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "MODO DEMOSTRACIÓN — TRANSACCIONES SIMULADAS (NO REALES)",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Black,
                color = PosNavyDark,
                fontSize = 11.sp
            )
        }
    }
}
```

**Características:**
- Fondo dorado (`PosGold` con 95% opacidad).
- Texto navy oscuro (`PosNavyDark`), peso Black.
- Icono de ciencia (`Icons.Default.Science`).
- Borde dorado claro (`PosGoldLight`).
- **Clickeable** — navega a Settings para cambiar la URL del servidor.

---

## 4. Botones de Simulación en la UI

Los botones de simulación solo son visibles cuando `uiState.isDemoNode` es `true`. Aparecen en las pantallas de cobro QR y multi-vendedor.

### 4.1. QrChargeScreen

**Archivo:** `QrChargeScreen.kt`

Cuando `uiState.isDemoNode` es true, se muestran botones para:
- **Simular aprobación** → llama a `viewModel.simulateQrApproval()`
- **Simular firma multi-firma** → llama a `viewModel.simulateQrMultisigSignature()`
- **Simular rechazo** → llama a `viewModel.simulateQrRejection()`

### 4.2. MultiVendorScreen

**Archivo:** `MultiVendorScreen.kt`

Cuando `uiState.isDemoNode` es true, se muestran botones de simulación para el flujo de pago comunitario.

### 4.3. Patrón de visibilidad

```kotlin
if (uiState.isDemoNode) {
    // Botones de simulación visibles
    Button(onClick = { viewModel.simulateQrApproval() }) {
        Text("Simular Aprobación")
    }
    Button(onClick = { viewModel.simulateQrMultisigSignature() }) {
        Text("Simular Firma Multi-Firma")
    }
    Button(onClick = { viewModel.simulateQrRejection() }) {
        Text("Simular Rechazo")
    }
}
```

En modo real (`isDemoNode = false`), estos botones **no existen** en la UI.

---

## 5. Simulaciones en PosRepository

### 5.1. Principio Fundamental

> **TODAS las simulaciones están dentro de bloques `if (apiClient.isDemoNode)`.**
>
> En modo real, el código **nunca** entra en estos bloques. Los errores del servidor se propagan como errores reales al usuario.

### 5.2. createQrCharge() — Simulación de cobro QR

**Archivo:** `PosRepository.kt` líneas 342-380

```kotlin
suspend fun createQrCharge(amountMicroUnits: Long, description: String?):
    Result<CreateChargeResponse> = withContext(Dispatchers.IO) {
    try {
        val service = apiClient.getService()
        val response = service.createCharge(CreateChargeRequest(amountMicroUnits, description))
        if (response.isSuccessful && response.body()?.chargeToken != null) {
            Result.success(response.body()!!)
        } else if (apiClient.isDemoNode) {
            // Modo Demo: generar QR simulado si el backend demo responde con error
            val demoChargeId = "DEMO-CHG-${UUID.randomUUID().toString().take(8).uppercase()}"
            val demoToken = "DEMO-TOKEN-${UUID.randomUUID().toString().take(12)}"
            val simResp = CreateChargeResponse(
                chargeId = demoChargeId,
                chargeToken = demoToken,
                amount = amountMicroUnits,
                status = "pending",
                expiresIn = 180
            )
            Result.success(simResp)
        } else {
            val err = response.errorBody()?.string()
                ?: "Error al generar cobro QR en el nodo (${response.code()})"
            Result.failure(Exception(err))
        }
    } catch (e: Exception) {
        if (apiClient.isDemoNode) {
            // Simulación también en caso de error de red (offline)
            val demoChargeId = "DEMO-CHG-${UUID.randomUUID().toString().take(8).uppercase()}"
            val demoToken = "DEMO-TOKEN-${UUID.randomUUID().toString().take(12)}"
            val simResp = CreateChargeResponse(
                chargeId = demoChargeId,
                chargeToken = demoToken,
                amount = amountMicroUnits,
                status = "pending",
                expiresIn = 180
            )
            Result.success(simResp)
        } else {
            Result.failure(Exception("Error de conexión al generar cobro QR: ${e.localizedMessage}"))
        }
    }
}
```

**IDs simulados:**
- `chargeId`: `DEMO-CHG-{8 chars hex uppercase}` (ej: `DEMO-CHG-A1B2C3D4`)
- `chargeToken`: `DEMO-TOKEN-{UUID.take(12)}` (ej: `DEMO-TOKEN-a1b2c3d4-e5`)
- `status`: `"pending"`
- `expiresIn`: 180 segundos

**Funciona offline:** La simulación se activa tanto si el servidor responde con error como si hay error de red (excepción).

### 5.3. processNfcPayment() — Simulación de pago NFC

**Archivo:** `PosRepository.kt` líneas 617-806

La simulación de NFC tiene **dos niveles** de lógica:

#### 5.3.1. Detección de multi-firma por cardUid

```kotlin
if (apiClient.isDemoNode) {
    val isMultisig3 = cardUid.contains("3SIG") || cardUid.contains("3F")
    val isMultisig2 = cardUid.contains("MULTISIG") || cardUid.contains("2SIG") || cardUid.contains("FIRM")
    
    if (isMultisig3) {
        // Simular pending_multisig con 3 firmas requeridas
        val sim = PaymentResultDecrypted(
            status = "pending_multisig",
            transactionId = "TX-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
            pendingId = "PENDING-MS3-${UUID.randomUUID().toString().take(6).uppercase()}",
            requiredSigs = 3,
            collectedSigs = 1,
            remainingSigs = 2,
            message = "Cuenta multi-firma (3 Firmas requeridas). Firma 1 de 3 registrada...",
            userBalance = 250000L
        )
        Result.success(sim)
    } else if (isMultisig2) {
        // Simular pending_multisig con 2 firmas requeridas
        val sim = PaymentResultDecrypted(
            status = "pending_multisig",
            transactionId = "TX-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
            pendingId = "PENDING-MS2-${UUID.randomUUID().toString().take(6).uppercase()}",
            requiredSigs = 2,
            collectedSigs = 1,
            remainingSigs = 1,
            message = "Cuenta multi-firma (2 Firmas requeridas). Firma 1 de 2 registrada...",
            userBalance = 250000L
        )
        Result.success(sim)
    } else {
        // Simular aprobado (tarjeta normal)
        val simulatedResult = PaymentResultDecrypted(
            status = "approved",
            transactionId = UUID.randomUUID().toString(),
            message = "Transacción simulada aprobada (Modo Demo)",
            userBalance = 180000L
        )
        transactionDao.insertTransaction(...)
        Result.success(simulatedResult)
    }
}
```

#### 5.3.2. Patrones de cardUid para multi-firma

| Substring en `cardUid` | Comportamiento simulado |
|------------------------|------------------------|
| `MULTISIG` | pending_multisig, 2 firmas |
| `2SIG` | pending_multisig, 2 firmas |
| `FIRM` | pending_multisig, 2 firmas |
| `3SIG` | pending_multisig, 3 firmas |
| `3F` | pending_multisig, 3 firmas |
| (cualquier otro) | approved |

**Esto permite demostrar el flujo multi-firma** simplemente usando tarjetas NFC cuyo UID contenga estos substrings.

#### 5.3.3. Simulación en caso de error de red

La misma lógica de simulación se repite en el bloque `catch (e: Exception)`, permitiendo que el modo demo funcione **completamente offline**.

### 5.4. processCommunityPayment() — Simulación de pago comunitario

**Archivo:** `PosRepository.kt` líneas 809-945

```kotlin
if (apiClient.isDemoNode) {
    val simulated = PaymentResultDecrypted(
        status = "approved",
        transactionId = UUID.randomUUID().toString(),
        message = "Transacción comunitaria simulada aprobada (Modo Demo)",
        userBalance = 150000L
    )
    transactionDao.insertTransaction(
        TransactionEntity(
            id = simulated.transactionId!!,
            amount = amountMicroUnits,
            paymentMethod = "nfc_community",
            status = "approved",
            cardUid = buyerCardUid,
            vendorName = "Vendedor $sellerCardUid",
            receiptNumber = "COM-${UUID.randomUUID().toString().take(8).uppercase()}"
        )
    )
    Result.success(simulated)
}
```

El pago comunitario siempre se simula como **aprobado** en modo demo (no hay multi-firma en este flujo).

### 5.5. signMultisigNfc() — Simulación de firma multi-firma

**Archivo:** `PosRepository.kt` líneas 948-1105

```kotlin
if (apiClient.isDemoNode) {
    val is3SigsFlow = pendingPaymentId.contains("MS3")
        || cardUid.contains("3SIG") || cardUid.contains("3F")
    val isFirm2Of3 = is3SigsFlow && (cardUid.contains("2")
        || cardUid.contains("FIRM2") || cardUid.contains("SIG2"))
    
    if (isFirm2Of3) {
        // Simular: firma 2 de 3 → todavía pendiente
        Result.success(
            PaymentResultDecrypted(
                status = "pending_multisig",
                transactionId = pendingPaymentId,
                pendingId = pendingPaymentId,
                requiredSigs = 3,
                collectedSigs = 2,
                remainingSigs = 1,
                message = "Firma 2 de 3 validada por el servidor. Acerque la tarjeta del 3er firmante."
            )
        )
    } else {
        // Simular: última firma → aprobado
        val finalRes = PaymentResultDecrypted(
            status = "approved",
            transactionId = pendingPaymentId,
            message = "¡Todas las firmas requeridas han sido validadas por el servidor! "
                + "Pago multi-firma aprobado con éxito.",
            remainingSigs = 0,
            requiredSigs = if (is3SigsFlow) 3 else 2,
            collectedSigs = if (is3SigsFlow) 3 else 2
        )
        transactionDao.insertTransaction(...)
        Result.success(finalRes)
    }
}
```

**Lógica de progresión de firmas:**
- Si el `cardUid` contiene `2`, `FIRM2`, o `SIG2` (y es flujo de 3 firmas): simula firma 2 de 3 → `pending_multisig`.
- En cualquier otro caso: simula la firma final → `approved`.

### 5.6. getMultisigStatus() — Simulación de estado multi-firma

**Archivo:** `PosRepository.kt` líneas 1107-1147

```kotlin
if (apiClient.isDemoNode) {
    Result.success(
        MultisigStatusResponse(
            id = pendingId,
            status = "pending",
            requiredSignatures = 2,
            collectedCount = 1,
            remainingSigs = 1,
            remainingSeconds = 480L
        )
    )
}
```

Siempre simula estado `pending` con 1 firma de 2 recolectadas y 480 segundos restantes.

---

## 6. Métodos de Simulación en PosViewModel

### 6.1. simulateQrApproval()

**Archivo:** `PosViewModel.kt` líneas 1045-1073

```kotlin
fun simulateQrApproval(requiredSignatures: Int = 1) {
    val chargeId = _uiState.value.qrChargeResponse?.chargeId ?: "DEMO-CHG-SIM"
    val microUnits = CurrencyHelper.parseInputToMicroUnits(_uiState.value.amountInput)
    stopQrPolling()
    stopQrTimer()
    FeedbackHelper.playSuccess(getApplication())

    viewModelScope.launch {
        repository.transactionDao.insertTransaction(
            TransactionEntity(
                id = chargeId,
                amount = microUnits,
                paymentMethod = "qr",
                status = "approved",
                receiptNumber = "QR-${chargeId.take(8).uppercase()}"
            )
        )
    }

    _uiState.update {
        it.copy(
            qrStatus = "paid",
            qrCollectedSignatures = requiredSignatures,
            qrRequiredSignatures = requiredSignatures,
            isQrPolling = false,
            successMessage = "¡Pago QR simulado aprobado exitosamente!"
        )
    }
}
```

**Acciones:**
1. Detiene el polling y el timer del QR.
2. Reproduce sonido de éxito (`playSuccess`).
3. Inserta la transacción en Room como `approved`.
4. Actualiza el estado: `qrStatus = "paid"`, muestra mensaje de éxito.

### 6.2. simulateQrMultisigSignature()

**Archivo:** `PosViewModel.kt` líneas 1075-1097

```kotlin
fun simulateQrMultisigSignature() {
    val currentCollected = _uiState.value.qrCollectedSignatures
    val required = 2
    val nextCollected = currentCollected + 1

    if (nextCollected >= required) {
        simulateQrApproval(requiredSignatures = required)
    } else {
        FeedbackHelper.playCardDetected(getApplication())
        startQrTimer(180)
        _uiState.update {
            it.copy(
                qrStatus = "partially_signed",
                qrRequiredSignatures = required,
                qrCollectedSignatures = nextCollected,
                qrSignaturesList = listOf(
                    QrSignatureInfo(
                        signerName = "Firma 1 / Comprador",
                        signedAt = "Confirmado",
                        status = "signed"
                    )
                ),
                successMessage = "Firma $nextCollected de $required completada. "
                    + "Esperando siguiente firmante (3 minutos)..."
            )
        }
    }
}
```

**Lógica:**
- Incrementa el contador de firmas recolectadas.
- Si `nextCollected >= 2` (required): llama a `simulateQrApproval()` → pago aprobado.
- Si no: actualiza estado a `"partially_signed"`, reinicia timer (180s), reproduce sonido de tarjeta detectada.

### 6.3. simulateQrRejection()

**Archivo:** `PosViewModel.kt` líneas 1099-1110

```kotlin
fun simulateQrRejection() {
    stopQrPolling()
    stopQrTimer()
    FeedbackHelper.playError(getApplication())
    _uiState.update {
        it.copy(
            qrStatus = "expired",
            isQrPolling = false,
            errorMessage = "El pago QR fue rechazado o anulado por el usuario."
        )
    }
}
```

**Acciones:**
1. Detiene polling y timer.
2. Reproduce sonido de error (`playError`).
3. Actualiza estado: `qrStatus = "expired"`, muestra mensaje de rechazo.

### 6.4. simulateClassicTapDemo() — Simulación de tap Classic

**Archivo:** `PosViewModel.kt`

```kotlin
fun simulateClassicTapDemo() {
    val state = _uiState.value
    val preAuth = state.classicPreAuth ?: return
    if (state.classicStep != "tap_card") return

    classicTimeoutJob?.cancel()

    viewModelScope.launch {
        _uiState.update {
            it.copy(isWritingCard = true, classicStep = "writing", writeProgress = "Leyendo tarjeta...")
        }
        // Simular lectura de sector
        kotlinx.coroutines.delay(500)
        _uiState.update { it.copy(writeProgress = "Verificando certificado...") }
        kotlinx.coroutines.delay(500)
        _uiState.update { it.copy(writeProgress = "Escribiendo nuevo certificado...") }
        kotlinx.coroutines.delay(500)
        _uiState.update { it.copy(writeProgress = "Confirmando transacción...") }

        val confirmResult = repository.confirmClassicTransaction(
            cardUid = preAuth.cardUid!!,
            readOk = true,
            writeOk = true,
            writtenBlocks = 16
        )
        // ... manejo de resultado (approved/error)
    }
}
```

**Acciones:**
1. Cancela el timeout del tap.
2. Simula progreso visual de lectura/escritura de sectores (4 pasos con delay de 500ms).
3. Llama a `confirmClassicTransaction` (que en modo demo retorna aprobado).
4. Muestra resultado al cliente.

### 6.5. onCardTappedForVerification() — Simulación de tap UID/DESFire

**Archivo:** `PosViewModel.kt`

Para tarjetas UID-only/DESFire en el flujo unificado, el modo demo usa el botón "Simular Tap UID/DESFire" que llama a `onCardTappedForVerification` con el `expectedCardUid` del pre-auth. Esta función:

1. Verifica que el UID coincida con el esperado (siempre coincide en demo).
2. Llama a `processNfcPayment` con card_uid + PIN + amount.
3. `processNfcPayment` en modo demo retorna aprobado (o pending_multisig según el card_uid).

### 6.6. Simulación de pre-auth unificada (PosRepository)

**Archivo:** `PosRepository.kt` — `classicPreAuth()`

En modo demo, `classicPreAuth` retorna una respuesta simulada sin llamar al servidor:

```kotlin
if (apiClient.isDemoNode) {
    val isMultisig3 = docNumber.contains("3SIG") || docNumber.contains("3F")
    val isMultisig2 = docNumber.contains("MULTISIG") || docNumber.contains("2SIG") || docNumber.contains("FIRM")
    if (isMultisig3 || isMultisig2) {
        // Simular tarjeta DESFire con multifirma
        return@withContext Result.success(ClassicPreAuthResponse(
            preApproved = true,
            cardType = "desfire",
            cardUid = if (isMultisig3) "CARD-MULTISIG-3F-FIRM1" else "CARD-MULTISIG-2F-FIRM1"
        ))
    }
    // Simular tarjeta Classic con certificados dinamicos
    return@withContext Result.success(ClassicPreAuthResponse(
        preApproved = true,
        cardType = "classic",
        cardUid = "DEMO-CLASSIC-${docNumber.take(6)}",
        readSector = 5,
        readKeyA = "aabbccddeeff",
        expectedCertificate = "11223344556677889900aabbccddeeff",
        writeSector = 10,
        writeKeyB = "112233445566",
        newCertificate = "ffeeddccbbaa99887766554433221100"
    ))
}
```

**Patrones de documento para multi-firma:**

| Substring en `docNumber` | Comportamiento simulado |
|--------------------------|------------------------|
| `MULTISIG`, `2SIG`, `FIRM` | DESFire con multifirma (2 firmas) |
| `3SIG`, `3F` | DESFire con multifirma (3 firmas) |
| (cualquier otro) | Classic con certificados dinámicos |

### 6.7. Simulación de confirm Classic (PosRepository)

**Archivo:** `PosRepository.kt` — `confirmClassicTransaction()`

```kotlin
if (apiClient.isDemoNode) {
    val simulatedResult = PaymentResultDecrypted(
        status = "approved",
        transactionId = "TX-CLASSIC-DEMO-${UUID.randomUUID().toString().take(6).uppercase()}",
        message = "Transacción Classic simulada aprobada (Modo Demo)",
        userBalance = 180000L
    )
    transactionDao.insertTransaction(...)
    return@withContext Result.success(simulatedResult)
}
```

Siempre simula `approved` para el flujo Classic.

---

## 7. Modo Demo Offline

### 7.1. Funcionamiento sin servidor

El modo demo **no requiere un servidor en ejecución**. Todas las simulaciones están en bloques `if (apiClient.isDemoNode)` que se activan tanto en:
- **Respuesta HTTP con error** (ej: 404, 500, timeout).
- **Excepción de red** (sin conexión, DNS no resuelve, etc.).

### 7.2. Flujos que funcionan offline en modo demo

| Flujo | Método | Simulación |
|-------|--------|------------|
| Crear cobro QR | `createQrCharge()` | Genera `DEMO-CHG-*` / `DEMO-TOKEN-*` |
| Pago NFC simple | `processNfcPayment()` | Aprobado o pending_multisig según cardUid |
| Pago comunitario | `processCommunityPayment()` | Aprobado |
| Firma multi-firma | `signMultisigNfc()` | pending_multisig o approved |
| Estado multi-firma | `getMultisigStatus()` | pending |
| Aprobación QR | `simulateQrApproval()` | Aprobado (via ViewModel) |
| Firma QR multi-sig | `simulateQrMultisigSignature()` | Parcial o completo (via ViewModel) |
| Rechazo QR | `simulateQrRejection()` | Expired (via ViewModel) |
| Pre-auth unificado | `classicPreAuth()` | Classic con sectores o DESFire con multifirma según docNumber |
| Confirm Classic | `confirmClassicTransaction()` | Aprobado |
| Tap Classic demo | `simulateClassicTapDemo()` | Progreso visual + confirm (via ViewModel) |
| Tap UID/DESFire demo | `onCardTappedForVerification()` | Verifica UID + processNfcPayment (via ViewModel) |

### 7.3. Flujos que NO funcionan offline

- **Autenticación de terminal** (`authenticateTerminal()`) — requiere servidor para verificar firma Ed25519.
- **Login de usuario** (`login()`) — requiere servidor para validar credenciales.
- **Registro/emparejamiento de terminal** — requiere servidor para intercambiar claves públicas.

Sin embargo, el terminal puede usar los botones de simulación de la UI sin estar autenticado, ya que los métodos `simulateQr*` del ViewModel no hacen llamadas al servidor.

---

## 8. Garantías de Seguridad del Modo Real

### 8.1. Ausencia total de simulación en modo real

En modo real (`isDemoNode = false`), el código **nunca** entra en los bloques `if (apiClient.isDemoNode)`. Esto significa:

- **Errores del servidor** → se propagan como `Result.failure(Exception(...))` al usuario.
- **Errores de red** → se propagan como `Result.failure(Exception("Error de conexión..."))`.
- **No se generan IDs falsos** — no hay `DEMO-CHG-*` ni `DEMO-TOKEN-*`.
- **No se insertan transacciones simuladas** en Room.
- **No se simulan aprobaciones** — el estado del pago depende exclusivamente de la respuesta del servidor.

### 8.2. Ejemplo: processNfcPayment() en modo real

```kotlin
// Si el servidor responde con error y NO es demo:
} else {
    val errorBodyStr = response.errorBody()?.string().orEmpty()
    val serverMsg = try {
        val jsonObj = org.json.JSONObject(errorBodyStr)
        jsonObj.optString("error",
            jsonObj.optString("message",
                jsonObj.optString("detail", "Error del servidor (HTTP ${response.code()})")))
    } catch (e: Exception) {
        if (errorBodyStr.isNotBlank()) errorBodyStr
        else "Error al procesar cobro en el nodo (HTTP ${response.code()})"
    }
    Result.failure(Exception(serverMsg))
}

// Si hay excepción de red y NO es demo:
} else {
    Result.failure(Exception("Error al procesar cobro NFC: ${e.localizedMessage}"))
}
```

### 8.3. Botones de simulación ausentes en modo real

Los botones de simulación en `QrChargeScreen` y `MultiVendorScreen` están condicionados a `uiState.isDemoNode`. En modo real, **no existen** en la UI — el usuario no tiene forma de simular transacciones.

---

## 9. Resumen

| Aspecto | Modo Demo | Modo Real |
|---------|-----------|-----------|
| Detección | URL contiene `/demo` | URL no contiene `/demo` |
| Marca de agua | Visible (diagonal + banner) | No visible |
| Botones de simulación | Visibles en UI | No existen |
| Simulación de pagos | Sí (offline) | Nunca |
| IDs generados | `DEMO-CHG-*`, `DEMO-TOKEN-*` | IDs reales del servidor |
| Multi-firma por cardUid | Detectada por substrings | Determinada por el servidor |
| Errores de servidor | Simulación como fallback | Propagados al usuario |
| Errores de red | Simulación como fallback | Propagados al usuario |
| Requiere servidor | No (funciona offline) | Sí |
| Transacciones en Room | Simuladas (aprobadas) | Reales (según servidor) |
