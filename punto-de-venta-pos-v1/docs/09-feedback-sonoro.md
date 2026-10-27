# Sistema de Feedback Sonoro y Háptico

Este documento describe el sistema de feedback auditivo y vibratorio del POS Android, incluyendo la síntesis PCM, los tipos de sonidos, el control de volumen, y la integración con los componentes de UI.

---

## 1. Visión general

El POS Android proporciona feedback sonoro y háptico (vibración) para todas las interacciones del usuario. El sistema está diseñado para ser:

- **Sin dependencias externas**: todos los sonidos se sintetizan en tiempo real con PCM (Pulse Code Modulation), sin archivos de audio externos.
- **Configurable**: el usuario puede activar/desactivar sonido y vibración, y ajustar el volumen.
- **Diferenciado**: el teclado numérico usa un sonido distinto al de los botones de acción.
- **Contextual**: diferentes sonidos para pagos aprobados, errores de pago, errores de tarjeta, etc.

---

## 2. FeedbackHelper (object)

Ubicación: `app/src/main/java/com/example/ui/util/Formatters.kt` (líneas 164-565)

Es un `object` singleton que gestiona todo el feedback del sistema.

### Preferencias (SharedPreferences)
```kotlin
private const val PREFS_NAME = "pos_feedback_prefs"
private const val KEY_SOUND_ENABLED = "sound_enabled"
private const val KEY_SOUND_VOLUME = "sound_volume"
private const val KEY_VIBRATION_ENABLED = "vibration_enabled"
```

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `sound_enabled` | Boolean | `true` | Sonido activado |
| `sound_volume` | Int (0-100) | `80` | Volumen del sonido |
| `vibration_enabled` | Boolean | `true` | Vibración activada |

### Estado interno
```kotlin
var isSoundEnabled: Boolean = true       // private set
var soundVolume: Int = 80                // 0 to 100, private set
var isVibrationEnabled: Boolean = true   // private set
private var isInitialized = false
private val audioExecutor = Executors.newSingleThreadExecutor()
private const val SAMPLE_RATE = 44100
```

### Inicialización
```kotlin
fun initPreferences(context: Context) {
    if (!isInitialized) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        isSoundEnabled = prefs.getBoolean(KEY_SOUND_ENABLED, true)
        soundVolume = prefs.getInt(KEY_SOUND_VOLUME, 80).coerceIn(0, 100)
        isVibrationEnabled = prefs.getBoolean(KEY_VIBRATION_ENABLED, true)
        toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, soundVolume)
        isInitialized = true
    }
}
```

### Setters
- `setSoundEnabled(context, enabled)` — activa/desactiva sonido
- `setSoundVolume(context, volume)` — ajusta volumen (0-100), recrea `ToneGenerator`
- `setVibrationEnabled(context, enabled)` — activa/desactiva vibración

---

## 3. Sonidos disponibles

### playKeyClick — Teclado numérico
```kotlin
fun playKeyClick(context: Context)
```
- **Uso**: teclas 0-9, DEL, C del teclado numérico (KioskComponents.kt)
- **Sonido**: `ToneGenerator.TONE_DTMF_1`, 28ms
- **Vibración**: 16ms
- **Por qué es diferente**: el teclado numérico necesita un sonido más corto y táctil, similar a un DTMF de teléfono, para feedback rápido al ingresar montos y PINs.

### playButtonClick — Botones de acción
```kotlin
fun playButtonClick(context: Context)
```
- **Uso**: todos los botones de acción, navegación, confirmar, cancelar, tabs, etc. (76+ botones)
- **Sonido**: PCM sintetizado, 35ms, tono descendente 1350Hz → 825Hz
- **Vibración**: 14ms
- **Síntesis**: ver sección 4

### playCardDetected — Tarjeta NFC detectada
```kotlin
fun playCardDetected(context: Context)
```
- **Uso**: cuando una tarjeta NFC se acerca al lector
- **Sonido**: `ToneGenerator.TONE_PROP_BEEP`, 90ms
- **Vibración**: 75ms

### playCardScanError — Error de escaneo NFC
```kotlin
fun playCardScanError(context: Context)
```
- **Uso**: tarjeta inválida, tarjeta duplicada, tarjeta no reconocida, error de lectura
- **Sonido**: PCM sintetizado, 300ms, doble chirp de advertencia
- **Vibración**: patrón `[0, 50, 40, 50]`
- **Síntesis**: ver sección 4

### playPaymentApprovedCoins — Pago aprobado
```kotlin
fun playPaymentApprovedCoins(context: Context)
```
- **Uso**: transacción aprobada con éxito
- **Sonido**: PCM sintetizado, 950ms — caja registradora abriéndose + cascada de monedas
- **Vibración**: patrón `[0, 80, 50, 90, 40, 150]`
- **Síntesis**: ver sección 4
- **Alias**: `playSuccess(context)` es un alias de esta función

### playPaymentError — Error de pago
```kotlin
fun playPaymentError(context: Context)
```
- **Uso**: rechazo de transacción, límites superados, saldo insuficiente
- **Sonido**: PCM sintetizado, 520ms — dos pulsos descendentes disonantes
- **Vibración**: patrón `[0, 160, 80, 220]`
- **Síntesis**: ver sección 4
- **Alias**: `playError(context)` es un alias de esta función

---

## 4. Síntesis PCM

Todos los sonidos complejos se sintetizan en tiempo real como `ShortArray` (PCM 16-bit, mono, 44100Hz). Los buffers se crean con `by lazy` para evitar overhead en el inicio.

### buttonClickPcm (35ms)
```kotlin
private val buttonClickPcm: ShortArray by lazy {
    val duration = 0.035 // 35ms
    val totalSamples = (SAMPLE_RATE * duration).toInt()
    val buffer = ShortArray(totalSamples)
    val twoPi = 2.0 * Math.PI

    for (i in 0 until totalSamples) {
        val t = i.toDouble() / SAMPLE_RATE
        val env = exp(-t / 0.007)                    // envelope exponencial
        val freq = 1350.0 - (t * 15000.0)            // 1350Hz → 825Hz (descendente)
        val sample = (sin(twoPi * freq * t) * 0.75 + 
                      sin(twoPi * (freq * 1.8) * t) * 0.25) * env
        buffer[i] = (sample * 25000.0).coerceIn(-32767.0, 32767.0).toInt().toShort()
    }
    buffer
}
```
- Frecuencia: 1350Hz descendiendo a 825Hz
- Envelope: exponencial, decay 7ms
- Armónicos: fundamental (0.75) + 1.8x (0.25)
- Amplitud max: 25000/32767

### paymentApprovedCoinsPcm (950ms)
El sonido más complejo: simula una caja registradora + cascada de monedas.

**Tres capas:**
1. **Latch/Drawer Snap** (0-120ms): thump a 135Hz + click a 2400Hz/3800Hz, envelope 25ms
2. **Bell Chime / Cha-Ching** (80ms-650ms): acorde de 4 frecuencias (1760, 2640, 3520, 5280Hz), envelope 220ms
3. **Falling Coins Shower**: 8 coin clinks en tiempos `[0.12, 0.18, 0.25, 0.32, 0.40, 0.49, 0.58, 0.68]`s con frecuencias `[3136, 3729, 2793, 4186, 3520, 4699, 5274, 4400]`Hz, cada uno con envelope 55ms y armónicos 1.52x y 2.31x

### paymentErrorPcm (520ms)
Dos pulsos disonantes descendentes:
- **Pulso 1** (0-200ms): 185Hz + 233Hz (disonante) + 370Hz, envelope lineal descendente
- **Pulso 2** (240-480ms): 138Hz descendiendo + 174Hz descendiendo + 276Hz, envelope lineal descendente

### cardScanErrorPcm (300ms)
Doble chirp de advertencia agudo:
- **Chirp 1** (0-90ms): 988Hz + 1976Hz, envelope lineal
- **Chirp 2** (130-260ms): 659Hz + 1318Hz, envelope lineal

---

## 5. Reproducción PCM

### playPcm(pcm: ShortArray)
```kotlin
private fun playPcm(pcm: ShortArray) {
    if (!isSoundEnabled || soundVolume <= 0) return
    val volFactor = (soundVolume.toFloat() / 100f).coerceIn(0f, 1f)
    val scaledPcm = if (volFactor >= 0.99f) {
        pcm
    } else {
        ShortArray(pcm.size) { (pcm[it] * volFactor).toInt().toShort() }
    }

    audioExecutor.execute {
        try {
            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(scaledPcm.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            audioTrack.write(scaledPcm, 0, scaledPcm.size)
            audioTrack.play()
            val durationMs = (scaledPcm.size.toDouble() / SAMPLE_RATE * 1000).toLong() + 40
            Thread.sleep(durationMs)
            audioTrack.stop()
            audioTrack.release()
        } catch (e: Exception) {
            try { toneGen?.startTone(ToneGenerator.TONE_PROP_ACK, 200) } catch (t: Exception) {}
        }
    }
}
```

### Control de volumen
- `volFactor = soundVolume / 100` (0.0 a 1.0)
- Si `volFactor >= 0.99`: usa el buffer original sin escalar
- Si no: escala cada muestra multiplicando por `volFactor`
- El `ToneGenerator` se recrea con el volumen al cambiarlo

### Thread de audio
- `audioExecutor = Executors.newSingleThreadExecutor()` — un solo thread para evitar solapamientos
- Cada reproducción se ejecuta en este thread
- `AudioTrack` en modo `MODE_STATIC` (buffer pre-cargado)
- Se hace `Thread.sleep(durationMs)` para esperar a que termine antes de `stop()` y `release()`

### Fallback
Si `AudioTrack` falla, se usa `ToneGenerator.TONE_PROP_ACK` como fallback simple.

---

## 6. Vibración

### vibrate(context, durationMs)
Vibración simple de un pulso:
```kotlin
private fun vibrate(context: Context, durationMs: Long) {
    if (!isVibrationEnabled) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator?.vibrate(
            VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
        )
    } else {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        vibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
    }
}
```

### vibratePattern(context, timings)
Vibración con patrón (waveform):
```kotlin
private fun vibratePattern(context: Context, timings: LongArray) {
    if (!isVibrationEnabled) return
    // Usa VibrationEffect.createWaveform(timings, -1) — sin repetición
}
```

### Patrones por evento
| Evento | Patrón (ms) |
|--------|-------------|
| playKeyClick | 16 (simple) |
| playButtonClick | 14 (simple) |
| playCardDetected | 75 (simple) |
| playCardScanError | `[0, 50, 40, 50]` |
| playPaymentApprovedCoins | `[0, 80, 50, 90, 40, 150]` |
| playPaymentError | `[0, 160, 80, 220]` |

### Compatibilidad
- API 31+ (Android S): usa `VibratorManager`
- API 26+ (Android O): usa `Vibrator` con `VibrationEffect`
- API < 26: usa `Vibrator.vibrate(ms)` (deprecated)

---

## 7. FeedbackModifier

Ubicación: `app/src/main/java/com/example/ui/components/FeedbackModifier.kt`

### Modifier.feedbackClickable(onClick)
Modificador de Compose que envuelve `clickable` con `playButtonClick`:
```kotlin
fun Modifier.feedbackClickable(onClick: () -> Unit): Modifier = composed {
    val context = LocalContext.current
    this.clickable {
        FeedbackHelper.playButtonClick(context)
        onClick()
    }
}
```

Uso:
```kotlin
Box(modifier = Modifier.feedbackClickable { /* acción */ }) { ... }
```

### rememberFeedbackClick()
Helper para botones Material3 que usan `onClick` como parámetro:
```kotlin
@Composable
fun rememberFeedbackClick(): (context: Context, action: () -> Unit) -> Unit {
    return { context, action ->
        FeedbackHelper.playButtonClick(context)
        action()
    }
}
```

Uso:
```kotlin
val feedbackClick = rememberFeedbackClick()
Button(onClick = { feedbackClick(context) { doAction() } }) { ... }
```

---

## 8. Integración en pantallas

### Pantallas con feedback (76+ botones)
| Pantalla | Archivo | Botones con feedback |
|----------|---------|---------------------|
| Dashboard | `DashboardScreen.kt` | 4 |
| Login | `LoginScreen.kt` | 5 |
| RegisterTerminal | `RegisterTerminalScreen.kt` | 12 |
| Admin | `AdminScreen.kt` | 4 |
| Settings | `SettingsScreen.kt` | 22 |
| Transactions | `TransactionsScreen.kt` | 3 |
| ShiftManagement | `ShiftManagementScreen.kt` | 7 |
| QrCharge | `QrChargeScreen.kt` | 9 |
| MultiVendor | `MultiVendorScreen.kt` | 18 |
| NfcCharge | `NfcChargeScreen.kt` | 17 |

### Teclado numérico (KioskComponents.kt)
El teclado numérico usa `playKeyClick` directamente (no `playButtonClick`):
```kotlin
// En KioskComponents.kt
FeedbackHelper.playKeyClick(context)  // sonido DTMF, no PCM
```

### Pantalla de Settings
La pantalla de Settings (`SettingsScreen.kt`) incluye:
- Toggle de sonido (activar/desactivar)
- Slider de volumen (0-100%)
- Toggle de vibración
- Botones de prueba para cada sonido

---

## 9. Permisos necesarios

### AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

No se requieren permisos especiales para `AudioTrack` o `ToneGenerator`.

---

## 10. Resumen de sonidos

| Función | Duración | Tipo | Uso |
|---------|----------|------|-----|
| `playKeyClick` | 28ms | ToneGenerator DTMF | Teclado numérico |
| `playButtonClick` | 35ms | PCM sintetizado | Botones de acción (76+) |
| `playCardDetected` | 90ms | ToneGenerator BEEP | Tarjeta NFC detectada |
| `playCardScanError` | 300ms | PCM sintetizado | Error de escaneo NFC |
| `playPaymentApprovedCoins` | 950ms | PCM sintetizado | Pago aprobado |
| `playPaymentError` | 520ms | PCM sintetizado | Error de pago |
| `playSuccess` | — | alias de `playPaymentApprovedCoins` | — |
| `playError` | — | alias de `playPaymentError` | — |
