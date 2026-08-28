# 02 — Arquitectura Interna del POS Android

> **Proyecto:** `punto-de-venta-pos/`
> **Package:** `com.example`
> **Stack:** Kotlin + Jetpack Compose + Coroutines + Room + Retrofit + BouncyCastle
> **Propósito:** Documentación técnica para consumo por IA y desarrolladores.

---

## 1. Estructura de Paquetes

```
com.example/
├── MainActivity.kt                      # Entry point, host del ViewModel y Composable raíz
├── data/
│   ├── api/
│   │   ├── PosApiClient.kt             # Cliente Retrofit + OkHttp, headers, construcción de URLs
│   │   ├── PosApiModels.kt             # Data classes de request/response (Moshi)
│   │   └── PosApiService.kt            # Interface Retrofit con todos los endpoints
│   ├── crypto/
│   │   ├── CryptoEngine.kt             # Ed25519, ECDH, AES-256-GCM, firma y verificación
│   │   └── KeystoreCrypto.kt           # Encriptación de clave privada via Android Keystore
│   ├── db/
│   │   └── AppDatabase.kt              # Room database, entidades, DAOs, migraciones
│   └── repository/
│       └── PosRepository.kt            # Capa de repositorio: orquesta API + DB + crypto
├── ui/
│   ├── screens/
│   │   ├── AdminScreen.kt              # Administración: tarjetas, terminales
│   │   ├── DashboardScreen.kt          # Pantalla principal post-login
│   │   ├── LoginScreen.kt              # Login del comerciante (usuario + contraseña)
│   │   ├── MultiVendorScreen.kt        # Pago comunitario (vendedor + comprador)
│   │   ├── NfcChargeScreen.kt          # Cobro NFC simple
│   │   ├── QrChargeScreen.kt           # Cobro QR con polling
│   │   ├── RegisterTerminalScreen.kt   # Emparejamiento/registro del terminal
│   │   ├── SettingsScreen.kt           # Configuración (URL, reset, multi-vendor)
│   │   ├── ShiftManagementScreen.kt    # Gestión de turnos (abrir/cerrar)
│   │   └── TransactionsScreen.kt       # Historial de transacciones locales
│   ├── components/
│   │   ├── DemoWatermarkOverlay.kt     # Overlay "MODO DEMO" cuando isDemoNode
│   │   ├── FeedbackModifier.kt         # Modifier para feedback háptico/visual
│   │   ├── KioskComponents.kt          # Componentes de modo kiosco (teclado, botones)
│   │   ├── NfcWaveAnimation.kt         # Animación de onda NFC al esperar tarjeta
│   │   └── MultisigCountdownHeader.kt  # Header con cuenta regresiva de multisig
│   ├── viewmodel/
│   │   └── PosViewModel.kt             # ViewModel central (StateFlow, lógica de negocio)
│   ├── util/
│   │   └── Formatters.kt               # CurrencyHelper, FormatConfig, QrCodeHelper, FeedbackHelper
│   └── theme/
│       ├── Color.kt                    # Paleta de colores
│       ├── Theme.kt                    # Material3 theme
│       └── Type.kt                     # Tipografía
```

---

## 2. Flujo de Datos

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│  UI Screen  │───▶│  PosViewModel│───▶│ PosRepository│───▶│  Retrofit │───▶│ Backend  │
│ (Composable)│    │ (StateFlow)  │    │              │    │  (OkHttp) │    │   (Go)   │
└─────────────┘    └──────────────┘    └──────────────┘    └───────────┘    └──────────┘
      ▲                   │                   │
      │                   │                   │
      └───────────────────┘                   ▼
     Compose recompone              ┌──────────────┐
     al cambiar StateFlow           │  Room (DB)   │
                                   │  AppDatabase │
                                   └──────────────┘
```

### Detalle del flujo

1. **UI Screen** (Composable) llama a funciones del `PosViewModel` (ej: `startQrCharge()`, `processNfcPayment()`).
2. **PosViewModel** actualiza `_uiState` (MutableStateFlow<PosUiState>) y lanza corrutinas en `viewModelScope`.
3. **PosRepository** orquesta la lógica: lee/escribe Room DB, encripta/desencripta con CryptoEngine, llama al API via Retrofit.
4. **Retrofit/OkHttp** envía la petición HTTP con headers de autenticación (Authorization, X-Node-Domain, X-Terminal-ID, X-Terminal-Public-Key).
5. **Backend Go** procesa la petición y responde.
6. El resultado se desencripta (si es un pago NFC) y se actualiza el StateFlow.
7. **Compose** recompone automáticamente las pantallas que observan el StateFlow.

---

## 3. Room Database (`AppDatabase.kt`)

### 3.1 Configuración

```kotlin
@Database(
    entities = [TransactionEntity::class, ShiftEntity::class,
                TerminalConfigEntity::class, ShiftPinEntity::class],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun shiftDao(): ShiftDao
    abstract fun shiftPinDao(): ShiftPinDao
    abstract fun terminalConfigDao(): TerminalConfigDao
}
```

- **Versión:** 3
- **exportSchema:** false

### 3.2 Entidades

#### TransactionEntity (tabla: `pos_transactions`)

```kotlin
@Entity(tableName = "pos_transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val amount: Long,              // en centavos (micro-units TQ)
    val paymentMethod: String,     // "qr", "nfc_single", "nfc_community", "multisig"
    val status: String,            // "approved", "rejected", "pending", "cancelled", "expired"
    val cardUid: String? = null,
    val customerName: String? = null,
    val vendorName: String? = null,
    val description: String? = null,
    val receiptNumber: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)
```

#### ShiftEntity (tabla: `pos_shifts`)

```kotlin
@Entity(tableName = "pos_shifts")
data class ShiftEntity(
    @PrimaryKey val id: String,
    val status: String = "open",       // "open", "closed"
    val openedAt: Long = System.currentTimeMillis(),
    val closedAt: Long? = null,
    val openingAmount: Long = 0L,      // centavos
    val closingAmount: Long? = null,
    val totalSales: Long = 0L,
    val transactionsCount: Int = 0,
    val notes: String? = null
)
```

#### TerminalConfigEntity (tabla: `terminal_config`)

```kotlin
@Entity(tableName = "terminal_config")
data class TerminalConfigEntity(
    @PrimaryKey val id: Int = 1,       // Singleton (siempre id=1)
    val serverUrl: String = "https://feria.loanstly.com/demo",
    val terminalId: String = "TERM-POS-001",
    val label: String = "Terminal Kiosco POS",
    val isRegistered: Boolean = false,
    val terminalPrivateKeyHex: String = "",     // Encriptada con KeystoreCrypto
    val terminalPublicKeyHex: String = "",
    val serverPublicKeyHex: String? = null,
    val sessionToken: String? = null,
    val isMultiVendorEnabled: Boolean = false,
    // Format settings (recibidas del servidor)
    val fmtLocale: String = "es",
    val fmtNumberLocale: String = "es-VE",
    val fmtDateFormat: String = "DD/MM/YYYY",
    val fmtTimeFormat: String = "24h",
    val fmtFirstDayOfWeek: Int = 1,             // 0=Domingo, 1=Lunes
    val fmtTimezone: String = "America/Caracas"
)
```

#### ShiftPinEntity (tabla: `shift_pin`)

```kotlin
@Entity(tableName = "shift_pin")
data class ShiftPinEntity(
    @PrimaryKey val id: Int = 1,       // Singleton
    val pinHash: String                // SHA-256 hash del PIN de turno
)
```

### 3.3 DAOs

- **TransactionDao:** `getAllTransactions()` (Flow), `getApprovedTransactions()` (Flow), `insertTransaction()`, `clearTransactions()`.
- **ShiftDao:** `getLatestShiftFlow()` (Flow), `getOpenShift()`, `insertShift()`, `updateShift()`.
- **ShiftPinDao:** `getPin()`, `savePin()`, `clearPin()`.
- **TerminalConfigDao:** `getConfigFlow()` (Flow), `getConfig()`, `saveConfig()`.

### 3.4 Migración 2→3

La migración `MIGRATION_2_3` añade las columnas de formato a `terminal_config` sin perder datos existentes (preserva credenciales del terminal):

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

---

## 4. Capa de Criptografía

### 4.1 CryptoEngine (`CryptoEngine.kt`)

Object singleton que implementa toda la criptografía del terminal:

| Función | Descripción |
|---|---|
| `generateEd25519KeyPair()` | Genera par de claves Ed25519 (32 bytes cada una). Retorna `TerminalKeyPair(privateKeyHex, publicKeyHex)`. |
| `ed25519ToCurve25519Clamped(edBytes)` | Convierte clave Ed25519 a Curve25519 via SHA-512 + clamping (bits 0, 31, 31). |
| `deriveSharedKey(terminalPrivateKeyHex, serverPublicKeyHex)` | ECDH X25519 + SHA-256 → clave AES de 32 bytes. Wipea buffers temporales. |
| `signEd25519(privateKeyHex, data)` | Firma datos con Ed25519. Retorna hex string. |
| `verifyEd25519(publicKeyHex, data, signatureHex)` | Verifica firma Ed25519. |
| `encryptPayload(plaintextJson, sharedKey, terminalPrivateKeyHex)` | AES-256-GCM (nonce 12 bytes, tag 128 bits) + firma Ed25519 del ciphertext. Retorna `EncryptedPayload(nonce, ciphertext, signature)`. |
| `decryptPayload(encryptedPayload, sharedKey, serverPublicKeyHex)` | Verifica firma del servidor (opcional) + desencripta AES-256-GCM. |
| `generateRandomNonce(byteLength)` | Genera nonce aleatorio en hex. |
| `getDeviceFingerprint(context)` | SHA-256 de `"POS-ANDROID-$ANDROID_ID"`. |
| `generateTerminalId(context)` | `TERM-ANDROID-{SHA-256(ANDROID_ID)[:12].uppercase()}`. Determinista por dispositivo. |
| `zeroize(vararg byteArrays)` | Llena arrays con zeros para higiene de memoria. |

### 4.2 KeystoreCrypto (`KeystoreCrypto.kt`)

Encripta la clave privada del terminal usando Android Keystore:

- **Algoritmo:** AES-256-GCM (clave maestra en Keystore del dispositivo).
- **Key alias:** `pos_terminal_master_key`
- **Formato de salida:** `Base64(IV || ciphertext || GCM_TAG)`
- **Persistencia:** La clave maestra sobrevive actualizaciones de la app. Solo se pierde si se borran completamente los datos.
- **Fallback:** Si la desencriptación falla (datos viejos sin encriptar), devuelve el string original para no romper la app.
- **Funciones:** `encrypt(plaintext)`, `decrypt(encrypted)`, `isEncrypted(value)`, `deleteMasterKey()`.

### 4.3 Flujo criptográfico de un pago NFC

```
1. POS construye payload JSON (card_uid, pin, amount, timestamp, nonce)
2. POS deriva sharedKey = ECDH(terminalPrivateKey, serverPublicKey)
3. POS encripta: ciphertext = AES-256-GCM(payload, sharedKey, nonce)
4. POS firma: signature = Ed25519(terminalPrivateKey, ciphertext)
5. POS envía: { terminal_id, encrypted_payload: { nonce, ciphertext, signature } }
6. Servidor verifica firma, desencripta, procesa pago
7. Servidor encripta respuesta con sharedKey y firma con serverPrivateKey
8. POS verifica firma del servidor, desencripta respuesta
```

---

## 5. Capa de API (`data/api/`)

### 5.1 PosApiClient (`PosApiClient.kt`)

Gestiona la configuración del cliente HTTP:

- **URL base:** `serverUrl` (ej: `https://feria.loanstly.com/main`). Se sanitiza (añade `https://` si falta, quita trailing `/`).
- **API base URL:** `{serverUrl}/api/` (ej: `https://feria.loanstly.com/main/api/`).
- **nodeDomain:** Se extrae solo el host de la URL (sin path). Se envía en header `X-Node-Domain`.
- **isDemoNode:** `serverUrl.contains("/demo")`.
- **Headers inyectados (authInterceptor):**
  - `Content-Type: application/json`
  - `X-Node-Domain: {host}`
  - `Authorization: Bearer {authToken}` (si hay sesión)
  - `X-Terminal-ID: {terminalId}`
  - `X-Terminal-Public-Key: {terminalPublicKey}` (si hay)
- **Timeouts:** connect 15s, read 20s, write 20s.
- **Logging:** HttpLoggingInterceptor nivel BODY.
- **Moshi:** Con `KotlinJsonAdapterFactory` para soportar data classes de Kotlin.
- **Cache:** El servicio Retrofit se cachea y se invalida cuando cambia la URL (`cachedService = null`).

### 5.2 PosApiService (`PosApiService.kt`)

Interface Retrofit con todos los endpoints. Las rutas son relativas a `{serverUrl}/api/`:

```kotlin
interface PosApiService {
    // Auth
    @POST("auth/login/password")     suspend fun login(...)
    @GET("auth/me")                  suspend fun getMe()

    // POS QR
    @POST("pos/charge")              suspend fun createCharge(...)
    @GET("pos/charge/{id}/status")   suspend fun getChargeStatus(...)
    @GET("pos/charge/{token}/info")  suspend fun getChargeInfo(...)
    @POST("pos/charge/{id}/cancel")  suspend fun cancelCharge(...)

    // Terminal Registration & Auth
    @POST("nfc/terminal/register")              suspend fun registerTerminal(...)
    @POST("nfc/terminal/complete-registration")  suspend fun completeRegistration(...)
    @POST("nfc/terminal/pair/initiate")         suspend fun initiatePairing(...)
    @GET("nfc/terminal/pair/{code}/status")     suspend fun getPairingStatus(...)
    @GET("nfc/terminal/pair/{code}/options")    suspend fun getPairingOptions(...)
    @POST("nfc/terminal/pair/{code}/approve")   suspend fun approvePairing(...)
    @POST("nfc/terminal/auth")                  suspend fun terminalAuth(...)
    @POST("nfc/terminal/heartbeat")             suspend fun terminalHeartbeat(...)
    @POST("nfc/terminal/lookup")                suspend fun lookupTerminal(...)
    @POST("nfc/terminal/session")               suspend fun createTerminalSession(...)
    @PUT("nfc/terminal/session/amount")         suspend fun setSessionAmount(...)

    // NFC Payments (Encrypted)
    @POST("nfc/terminal/payment")               suspend fun processNfcPayment(...)
    @POST("nfc/terminal/payment/community")     suspend fun processCommunityPayment(...)
    @POST("nfc/terminal/payment/multisig-sign")  suspend fun signMultisigNfcPayment(...)
    @GET("nfc/terminal/payment/multisig/{pendingId}/status") suspend fun getMultisigPaymentStatus(...)

    // Multi-Sig Web
    @GET("multisig/payments")                   suspend fun listPendingMultisigPayments()

    // Shifts
    @GET("nfc/my-terminals")                    suspend fun listMyTerminals()
    @POST("nfc/my-terminals/{id}/shift")        suspend fun openShift(...)
    @POST("nfc/my-terminals/{id}/shift/close")  suspend fun closeShift(...)

    // Cards
    @GET("nfc/cards")               suspend fun listCards(...)
    @POST("nfc/cards/issue")        suspend fun issueCard(...)
    @PUT("nfc/cards/pin")           suspend fun changePin(...)
    @PUT("nfc/cards/{uid}/pin/reset") suspend fun resetPin(...)
    @DELETE("nfc/cards/{uid}")      suspend fun deactivateCard(...)

    // Card Type Config
    @GET("nfc/card-type/config")    suspend fun getCardTypeConfig()

    // Transactions
    @GET("nfc/transactions")        suspend fun listNfcTransactions(...)
}
```

### 5.3 PosApiModels (`PosApiModels.kt`)

Data classes para requests y responses, anotadas con `@JsonClass(generateAdapter = true)` y `@Json(name = "snake_case")`. Ver documento `05-modelo-datos.md` para el detalle de cada modelo.

Modelos principales:
- **Auth:** `LoginRequest`, `LoginResponse`, `UserMeResponse`
- **QR:** `CreateChargeRequest`, `CreateChargeResponse`, `ChargeStatusResponse`, `QrSignatureInfo`
- **Terminal:** `RegisterTerminalApiRequest`, `CompleteRegistrationRequest/Response`, `TerminalAuthRequest/Response`, `TerminalItem`, `TerminalLookupRequest/Response`
- **Pairing:** `PairingInitiateRequest/Response`, `PairingStatusResponse`, `PairingOptionsResponse`, `PairingApproveRequest`
- **Session:** `CreateTerminalSessionRequest`, `TerminalSessionResponse`, `SetSessionAmountRequest`
- **Encrypted:** `EncryptedPayloadModel`, `EncryptedPaymentRequest`, `EncryptedPaymentResponse`
- **Decrypted payloads:** `SinglePaymentDecryptedPayload`, `CommunityPaymentDecryptedPayload`, `MultisigSignDecryptedPayload`
- **Results:** `PaymentResultDecrypted`, `MultisigStatusResponse`
- **Cards:** `CardItem`, `IssueCardRequest`, `ChangePinRequest`, `ResetPinRequest`
- **Shifts:** `ShiftResponse`, `OpenShiftRequest`, `CloseShiftRequest`
- **Config:** `CardTypeConfigResponse`, `FormatSettings`
- **Transactions:** `TransactionApiItem`
- **Misc:** `GenericStatusResponse`, `HeartbeatResponse`, `DocumentTypeItem`, `DEFAULT_DOCUMENT_TYPES`

---

## 6. Capa de Repositorio (`PosRepository.kt`)

El repositorio orquesta API, DB y criptografía:

### 6.1 Responsabilidades

- **Config segura:** Guarda/lee `TerminalConfigEntity` encriptando la clave privada con `KeystoreCrypto`.
- **Clave compartida ECDH:** Cachea `cachedSharedKey` para no recalcular en cada pago.
- **Login:** Autentica al comerciante, persiste el token, crea sesión de terminal.
- **Pagos NFC:** Encripta payload, envía, desencripta respuesta, guarda en Room.
- **Pagos QR:** Crea cargo, hace polling de estado, guarda transacción al pagarse.
- **Multisig:** Firma pagos pendientes, hace polling de estado.
- **Modo demo:** Si `isDemoNode` y el backend falla, simula respuestas (incluyendo multisig simulado para tarjetas con "MULTISIG"/"2SIG"/"3SIG" en el UID).
- **Pairing:** Inicia emparejamiento por código corto, hace polling, completa al aprobarse.
- **Format settings:** Aplica `FormatSettings` del servidor a `TerminalConfigEntity` y a `FormatConfig` en memoria.

### 6.2 Métodos principales

| Método | Descripción |
|---|---|
| `getOrInitTerminalConfig()` | Lee o crea config inicial (genera claves Ed25519 si no existe). Migra terminal_id viejo a determinista. |
| `authenticateTerminal()` | Autentica el terminal con Ed25519. Persiste session_token y format_settings. |
| `login(username, password)` | Login del comerciante. Persiste token. Crea sesión de terminal. Maneja 403 (terminal no registrado). |
| `processNfcPayment(cardUid, isDesfire, pin, amount, idDoc)` | Pago NFC simple encriptado. |
| `processCommunityPayment(sellerCard, sellerPin, buyerCard, buyerPin, amount, buyerIdDoc)` | Pago comunitario encriptado. |
| `signMultisigPayment(pendingId, cardUid, pin, idDoc)` | Firma un pago multisig pendiente. |
| `createQrCharge(amount, description)` | Crea cargo QR. Simula en modo demo. |
| `pollQrChargeStatus(chargeId)` | Polling de estado del cargo QR. |
| `initiatePairing()` | Inicia emparejamiento por código corto. |
| `pollPairingStatus(code)` | Polling de estado del emparejamiento. |
| `completePairing(status)` | Guarda server_public_key y marca como registrado. |
| `heartbeat()` | Verifica que el terminal sigue activo en el servidor. |
| `checkRegistrationByKey()` | Lookup por clave pública (descubre registro tardío). |
| `resetTerminalRegistration()` | Genera nuevas claves, resetea registro. |

---

## 7. Gestión de Estado UI (`PosViewModel.kt`)

### 7.1 PosScreen (enum sellado)

```kotlin
sealed class PosScreen {
    object RegisterTerminal : PosScreen()   // Emparejamiento/registro
    object Login : PosScreen()              // Login del comerciante
    object Dashboard : PosScreen()          // Pantalla principal
    object QrCharge : PosScreen()           // Cobro QR
    object NfcCharge : PosScreen()          // Cobro NFC simple
    object MultiVendor : PosScreen()        // Pago comunitario
    object Transactions : PosScreen()       // Historial
    object Admin : PosScreen()              # Administración
    object Settings : PosScreen()           // Configuración
    object ShiftManagement : PosScreen()    // Turnos
}
```

### 7.2 PosUiState (data class)

Estado central de la UI, expuesto como `StateFlow<PosUiState>`:

```kotlin
data class PosUiState(
    // Navegación
    val currentScreen: PosScreen = PosScreen.RegisterTerminal,
    val screenHistory: List<PosScreen> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,

    // Nodo y usuario
    val serverUrl: String = "https://feria.loanstly.com/main",
    val nodeDomain: String = "feria.loanstly.com/main",
    val currentUser: UserMeResponse? = null,
    val isLoggedIn: Boolean = false,
    val isRegistered: Boolean = false,
    val isDemoNode: Boolean = false,

    // Turno
    val activeShift: ShiftEntity? = null,

    // Input de monto
    val amountInput: String = "",
    val chargeDescription: String = "",

    // QR Charge Flow
    val qrChargeResponse: CreateChargeResponse? = null,
    val qrPayUrl: String? = null,
    val isQrPolling: Boolean = false,
    val qrStatus: String? = null,           // "pending", "partially_signed", "paid", "expired", "cancelled"
    val qrRemainingSeconds: Int = 180,
    val qrInitialSeconds: Int = 180,
    val qrRequiredSignatures: Int = 1,
    val qrCollectedSignatures: Int = 0,
    val qrSignaturesList: List<QrSignatureInfo> = emptyList(),

    // NFC Hardware
    val hasNfcHardware: Boolean = true,
    val isNfcEnabled: Boolean = true,

    // NFC Charge Flow
    val isNfcWaitingCard: Boolean = false,
    val detectedCardUid: String? = null,
    val detectedCardType: String = "uid_only",  // "uid_only" or "desfire"
    val customerPin: String = "",
    val requireIdVerification: Boolean = false,
    val selectedDocType: String = "cedula",
    val idDocNumber: String = "",
    val nfcPaymentResult: PaymentResultDecrypted? = null,

    // Multi-Vendor Flow
    val mvStep: Int = 1,                    // 1: Tap Seller, 2: Amount, 3: Tap Buyer, 4: Buyer PIN & ID, 5: Result
    val sellerCardUid: String? = null,
    val sellerName: String? = null,
    val sellerPin: String = "1234",
    val buyerCardUid: String? = null,
    val buyerPin: String = "",
    val buyerDocType: String = "cedula",
    val buyerDocNumber: String = "",
    val isSameCardError: Boolean = false,
    val isMultiVendorMultisig: Boolean = false,
    val mvMultisigRequired: Int = 1,
    val mvMultisigCollected: Int = 0,

    // Multi-Signature Flow
    val isMultisigActive: Boolean = false,
    val multisigPendingId: String? = null,
    val multisigRequiredSigs: Int = 1,
    val multisigCollectedSigs: Int = 0,
    val multisigRemainingSeconds: Long = 600L,
    val multisigMessage: String? = null,

    // Node config
    val cardTypeConfig: CardTypeConfigResponse? = null,

    // Admin
    val registeredTerminals: List<TerminalItem> = emptyList(),
    val userCards: List<CardItem> = emptyList(),

    // Terminal Pairing
    val pairingCode: String? = null,
    val pairingRemainingSeconds: Int = 60,
    val pairingStatus: String? = null,      // null, "pending", "approved", "expired", "rejected"
    val isPairingPolling: Boolean = false,
    val isInGracePeriod: Boolean = false    // Grace period de 30s tras expirar el tiempo visible
)
```

### 7.3 Navegación

#### `navigateTo(screen, addToHistory = true)`

- Cambia `currentScreen` al destino.
- Si `addToHistory`, añade la pantalla actual a `screenHistory`.
- Resetea estados transitorios (amountInput, customerPin, detectedCardUid, etc.).
- Detiene polling relevante al salir de pantallas (QR, multisig, pairing).

#### `handleBackPress(): Boolean`

- Si está en `MultiVendor` con `mvStep > 1`: retrocede un paso del wizard.
- Si es pantalla raíz (Dashboard, Login sin registro, RegisterTerminal sin registro): retorna `false` (dejar que el sistema maneje el back).
- Si hay historial: hace pop de la última pantalla y navega a ella.
- Si no hay historial: fallback a Dashboard si está logueado.

### 7.4 Corrutinas y polling

El ViewModel maneja varios jobs de corrutinas:

| Job | Propósito |
|---|---|
| `qrPollJob` | Polling cada 2s del estado del cargo QR. |
| `qrTimerJob` | Cuenta regresiva de 180s (3 min) para el QR. |
| `multisigPollJob` | Polling del estado de pago multisig pendiente. |
| `pairingPollJob` | Polling cada 2s del estado de emparejamiento + cuenta regresiva de 60s + grace period de 30s. |

### 7.5 Verificación de terminal antes de transacciones

```kotlin
private suspend fun verifyTerminalStatus(): Boolean
```

Antes de iniciar una transacción, el ViewModel hace un heartbeat. Si el servidor responde `notFound=true`, resetea el registro y vuelve a `RegisterTerminal`. Si `active=false`, muestra error. Si hay error de red, permite continuar (no bloquea por problemas temporales).

---

## 8. Pantallas (UI Screens)

### 8.1 RegisterTerminalScreen

Pantalla inicial cuando el terminal no está registrado. Ofrece tres métodos:
1. **Emparejamiento por código corto:** Genera un código de 6 caracteres, el admin lo aprueba desde el panel web. Polling de 60s + grace period de 30s.
2. **Registro con token UUID:** El admin genera un `registration_token` y lo ingresa manualmente.
3. **Auto-registro con admin:** Ingresa credenciales de administrador, el POS registra el terminal automáticamente.

### 8.2 LoginScreen

Login del comerciante con usuario + contraseña. Al éxito, navega a Dashboard. Si el servidor responde 403 (terminal no registrado), vuelve a RegisterTerminal.

### 8.3 DashboardScreen

Pantalla principal post-login. Muestra:
- Saldo del comerciante.
- Botones de cobro: QR, NFC, Multi-Vendor.
- Acceso a transacciones, turnos, admin, settings.
- Estado del turno actual.

### 8.4 QrChargeScreen

- Input de monto + descripción.
- Genera cargo QR → muestra código QR.
- Cuenta regresiva de 3 minutos.
- Polling cada 2s del estado.
- Soporta multisig: muestra progreso de firmas.
- Estados: pending → partially_signed → paid / expired / cancelled.

### 8.5 NfcChargeScreen

- Input de monto.
- Espera tarjeta NFC (animación de onda).
- Al detectar tarjeta: input de PIN (+ documento si requiere).
- Envía pago encriptado.
- Resultado: approved / rejected / pending_multisig.
- Si multisig: inicia polling de estado.

### 8.6 MultiVendorScreen

Wizard de 5 pasos para pago comunitario (vendedor → comprador):
1. **Tap Seller:** Acerca tarjeta del vendedor + PIN.
2. **Amount:** Ingresa monto.
3. **Tap Buyer:** Acerca tarjeta del comprador.
4. **Buyer PIN & ID:** PIN del comprador + documento si requiere.
5. **Result:** Resultado del pago.

### 8.7 TransactionsScreen

Historial de transacciones locales (Room DB). Lista ordenada por timestamp descendente.

### 8.8 AdminScreen

Gestión de tarjetas NFC y terminales:
- Listar tarjetas del usuario.
- Emitir nueva tarjeta.
- Cambiar PIN de tarjeta.
- Resetear PIN.
- Desactivar tarjeta.
- Listar terminales asignados.

### 8.9 SettingsScreen

- Cambiar URL del servidor.
- Resetear registro del terminal (genera nuevas claves).
- Activar/desactivar modo multi-vendor.
- Actualizar ID de terminal.
- Información del dispositivo.

### 8.10 ShiftManagementScreen

- Abrir turno (con monto inicial y notas).
- Cerrar turno (con monto final y notas).
- Ver turno activo.
- PIN de turno (protección para abrir/cerrar).

---

## 9. Componentes UI (`ui/components/`)

| Componente | Archivo | Descripción |
|---|---|---|
| `DemoWatermarkOverlay` | `DemoWatermarkOverlay.kt` | Overlay semitransparente con texto "MODO DEMO" cuando `isDemoNode` es true. |
| `KioskComponents` | `KioskComponents.kt` | Componentes de modo kiosco: teclado numérico personalizado, botones grandes, barras de progreso. |
| `FeedbackModifier` | `FeedbackModifier.kt` | Modifier de Compose que añade feedback háptico/visual al tocar. |
| `NfcWaveAnimation` | `NfcWaveAnimation.kt` | Animación de ondas concéntricas mientras se espera la tarjeta NFC. |
| `MultisigCountdownHeader` | `MultisigCountdownHeader.kt` | Header con cuenta regresiva y progreso de firmas para pagos multisig. |

---

## 10. Utilidades (`ui/util/Formatters.kt`)

### 10.1 FormatConfig (object)

Holds las preferencias de formato en memoria (actualizadas desde el servidor):

```kotlin
object FormatConfig {
    var locale: String = "es"
    var numberLocale: String = "es-VE"
    var dateFormat: String = "DD/MM/YYYY"
    var timeFormat: String = "24h"
    var firstDayOfWeek: Int = 1
    var timezone: String = "America/Caracas"

    fun updateFromEntity(config: TerminalConfigEntity)
}
```

### 10.2 CurrencyHelper (object)

```kotlin
object CurrencyHelper {
    // Convierte centavos a string TQ: 50000 → "500.00 TQ"
    fun formatMicroUnits(microUnits: Long): String

    // Convierte input del keypad a centavos: "12345" → 12345 (123.45 TQ)
    // El input representa centavos directamente (estilo POS real)
    fun parseInputToMicroUnits(input: String): Long

    fun formatDateTime(timestamp: Long): String
    fun formatDate(timestamp: Long): String
    fun formatTime(timestamp: Long): String
}
```

### 10.3 QrCodeHelper (object)

Genera Bitmap de código QR usando ZXing:
```kotlin
fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap?
```

### 10.4 FeedbackHelper (object)

Feedback sonoro y háptico:
- **Sonidos sintetizados PCM:** click de botón, pago aprobado (caja registradora + monedas), error de pago (buzz), error de tarjeta (chirp doble).
- **Vibración:** patrones de vibración para cada evento.
- **Preferencias:** sonido on/off, volumen, vibración on/off (persistidos en SharedPreferences).

---

## 11. Listado Completo de Archivos .kt

| Archivo | Propósito |
|---|---|
| `MainActivity.kt` | Activity principal. Inicializa Room DB, ViewModel, setContent con Compose. |
| `data/api/PosApiClient.kt` | Cliente HTTP (Retrofit + OkHttp). Gestiona URL, headers, nodeDomain, isDemoNode. |
| `data/api/PosApiModels.kt` | ~40 data classes para requests/responses (Moshi). |
| `data/api/PosApiService.kt` | Interface Retrofit con todos los endpoints API. |
| `data/crypto/CryptoEngine.kt` | Ed25519, ECDH X25519, AES-256-GCM, firma/verificación, device fingerprint. |
| `data/crypto/KeystoreCrypto.kt` | Encriptación de clave privada con Android Keystore (AES-256-GCM). |
| `data/db/AppDatabase.kt` | Room DB v3: 4 entidades, 4 DAOs, MIGRATION_2_3. |
| `data/repository/PosRepository.kt` | Repositorio: orquesta API + DB + crypto. ~850 líneas. |
| `ui/viewmodel/PosViewModel.kt` | ViewModel central con PosUiState, navegación, polling, lógica de negocio. ~1000+ líneas. |
| `ui/screens/AdminScreen.kt` | Pantalla de administración (tarjetas, terminales). |
| `ui/screens/DashboardScreen.kt` | Pantalla principal post-login. |
| `ui/screens/LoginScreen.kt` | Login del comerciante. |
| `ui/screens/MultiVendorScreen.kt` | Wizard de pago comunitario (5 pasos). |
| `ui/screens/NfcChargeScreen.kt` | Cobro NFC simple. |
| `ui/screens/QrChargeScreen.kt` | Cobro QR con polling. |
| `ui/screens/RegisterTerminalScreen.kt` | Emparejamiento/registro del terminal. |
| `ui/screens/SettingsScreen.kt` | Configuración del terminal. |
| `ui/screens/ShiftManagementScreen.kt` | Gestión de turnos. |
| `ui/screens/TransactionsScreen.kt` | Historial de transacciones. |
| `ui/components/DemoWatermarkOverlay.kt` | Overlay de modo demo. |
| `ui/components/FeedbackModifier.kt` | Modifier de feedback háptico. |
| `ui/components/KioskComponents.kt` | Componentes de modo kiosco. |
| `ui/components/NfcWaveAnimation.kt` | Animación de onda NFC. |
| `ui/components/MultisigCountdownHeader.kt` | Header de cuenta regresiva multisig. |
| `ui/util/Formatters.kt` | FormatConfig, CurrencyHelper, QrCodeHelper, FeedbackHelper. |
| `ui/theme/Color.kt` | Paleta de colores Material3. |
| `ui/theme/Theme.kt` | Theme de Compose (dark/light). |
| `ui/theme/Type.kt` | Tipografía Material3. |

---

## 12. Inicialización de la App

```
1. MainActivity.onCreate()
   ├── Crea AppDatabase (Room)
   ├── Crea PosViewModel(application, database)
   └── setContent { PosAppTheme { PosAppScreen(viewModel) } }

2. PosViewModel.init
   ├── getOrInitTerminalConfig()
   │   ├── Si no existe config: genera claves Ed25519, crea TerminalConfigEntity
   │   └── Si existe: carga config, desencripta clave privada, actualiza apiClient
   ├── Apply FormatConfig desde la config
   ├── Determina pantalla inicial:
   │   ├── !isRegistered → RegisterTerminal
   │   ├── hasActiveSession → Dashboard
   │   └── else → Login
   ├── loadCardTypeConfig()
   ├── Si isRegistered: heartbeat() para verificar con servidor
   │   └── Si notFound: resetear a RegisterTerminal
   └── Si !isRegistered: checkRegistrationByKey() (lookup por public_key)
       └── Si el servidor confirma registro: marcar como registrado

3. UI observa uiState (StateFlow) y muestra la pantalla inicial
```

---

*Fin del documento 02 — Arquitectura Interna del POS Android.*
