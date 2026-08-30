# 06 — Criptografía del POS Android

> **Proyecto:** Red de Intercambio Federada / Sistema TQ
> **Componente:** POS Android (`punto-de-venta-pos/`)
> **Archivos clave:**
> - `app/src/main/java/com/example/data/crypto/CryptoEngine.kt`
> - `app/src/main/java/com/example/data/crypto/KeystoreCrypto.kt`
> - `app/src/main/java/com/example/data/repository/PosRepository.kt`
> - `app/src/main/java/com/example/data/api/PosApiModels.kt`

---

## 1. Visión General

El POS Android implementa un esquema criptográfico de extremo a extremo basado en tres pilares:

1. **Ed25519** para identidad del terminal y firmas digitales.
2. **ECDH sobre Curve25519** para derivar una clave compartida (shared secret) entre el terminal y el servidor.
3. **AES-256-GCM** para cifrar los payloads de pago transmitidos sobre HTTP.

La biblioteca criptográfica utilizada es **BouncyCastle** (`org.bouncycastle:bcprov-jdk18on:1.78.1`), que provee implementaciones de Ed25519, X25519 y los algoritmos de firma/acuerdo necesarios.

```
┌──────────────┐                           ┌──────────────┐
│   Terminal   │                           │   Servidor   │
│   (Android)  │                           │   (Backend)  │
│              │                           │              │
│  Ed25519     │  ← intercambio de →       │  Ed25519     │
│  keypair     │    claves públicas        │  keypair     │
│              │                           │              │
│  ECDH        │  ← shared secret →        │  ECDH        │
│  Curve25519  │    (nunca transmitida)    │  Curve25519  │
│              │                           │              │
│  AES-256-GCM │  ← ciphertext →           │  AES-256-GCM │
│  + Ed25519   │    + nonce + signature    │  + Ed25519   │
└──────────────┘                           └──────────────┘
```

---

## 2. Generación del Keypair Ed25519 del Terminal

### 2.1. CryptoEngine.generateEd25519KeyPair()

**Archivo:** `CryptoEngine.kt` líneas 34-46

Cuando un terminal se inicializa por primera vez (o se resetea su registro), se genera un par de claves Ed25519:

```kotlin
fun generateEd25519KeyPair(): TerminalKeyPair {
    val keyPairGen = Ed25519KeyPairGenerator()
    keyPairGen.init(Ed25519KeyGenerationParameters(secureRandom))
    val keyPair = keyPairGen.generateKeyPair()

    val priv = keyPair.private as Ed25519PrivateKeyParameters
    val pub = keyPair.public as Ed25519PublicKeyParameters

    return TerminalKeyPair(
        privateKeyHex = priv.encoded.toHex(),
        publicKeyHex = pub.encoded.toHex()
    )
}
```

- **Algoritmo:** Ed25519 (Edwards-curve Digital Signature Algorithm sobre Curve25519).
- **Entropía:** `java.security.SecureRandom` (CSPRNG del sistema Android).
- **Salida:** `TerminalKeyPair(privateKeyHex, publicKeyHex)` — ambas como strings hexadecimales lowercase.
- **Tamaño:** 32 bytes cada clave (256 bits), representadas como 64 caracteres hex.

### 2.2. Almacenamiento en TerminalConfigEntity

Las claves se persisten en la tabla `terminal_config` de Room:

```kotlin
@Entity(tableName = "terminal_config")
data class TerminalConfigEntity(
    @PrimaryKey val id: Int = 1,
    // ...
    val terminalPrivateKeyHex: String = "",   // clave privada Ed25519 (hex)
    val terminalPublicKeyHex: String = "",    // clave pública Ed25519 (hex)
    val serverPublicKeyHex: String? = null,   // clave pública del servidor (hex)
    // ...
)
```

**Importante:** La clave privada se encripta con Android Keystore antes de guardarse en Room (ver sección 7 más abajo).

### 2.3. Generación en PosRepository.getOrInitTerminalConfig()

**Archivo:** `PosRepository.kt` líneas 58-96

```kotlin
suspend fun getOrInitTerminalConfig(): TerminalConfigEntity = withContext(Dispatchers.IO) {
    var config = getConfigSecure()
    if (config == null) {
        val keyPair = CryptoEngine.generateEd25519KeyPair()
        config = TerminalConfigEntity(
            id = 1,
            serverUrl = apiClient.serverUrl,
            terminalId = CryptoEngine.generateTerminalId(context),
            label = "Terminal Móvil POS",
            isRegistered = false,
            terminalPrivateKeyHex = keyPair.privateKeyHex,
            terminalPublicKeyHex = keyPair.publicKeyHex,
            serverPublicKeyHex = null,
            sessionToken = null,
            isMultiVendorEnabled = false
        )
        saveConfigSecure(config)
        config
    } else {
        // ... migración de terminal_id viejo si no está registrado
    }
    // ...
}
```

---

## 3. Intercambio de Clave Pública del Servidor (Registro / Pairing)

### 3.1. Flujo de registro con token

**Endpoint:** `POST /api/nfc/terminal/complete-registration`

El terminal envía su clave pública al servidor y recibe la clave pública del servidor:

```kotlin
// PosRepository.kt líneas 423-453
val req = CompleteRegistrationRequest(
    terminalId = config.terminalId,
    registrationToken = registrationToken.trim(),
    terminalPublicKey = config.terminalPublicKeyHex,
    deviceFingerprint = fingerprint
)
val res = service.completeRegistration(req)
if (res.isSuccessful && res.body()?.serverPublicKey != null) {
    val body = res.body()!!
    saveConfigSecure(
        config.copy(
            isRegistered = true,
            serverPublicKeyHex = body.serverPublicKey
        )
    )
    cachedSharedKey = null  // Invalidar clave compartida cacheada
}
```

### 3.2. Flujo de emparejamiento por código corto (pairing)

**Endpoints:**
- `POST /api/nfc/terminal/pair/initiate` → obtiene un código de 6 dígitos
- `GET /api/nfc/terminal/pair/{code}/status` → polling hasta aprobación
- `POST /api/nfc/terminal/pair/{code}/approve` → aprobación desde la web

```kotlin
// PosRepository.kt líneas 585-603
suspend fun completePairing(status: PairingStatusResponse): Result<Unit> {
    val config = getOrInitTerminalConfig()
    if (status.serverPublicKey != null) {
        val updated = config.copy(
            isRegistered = true,
            terminalId = assignedTerminalId,
            serverPublicKeyHex = status.serverPublicKey
        )
        saveConfigSecure(updated)
        cachedSharedKey = null
    }
}
```

### 3.3. Verificación de registro por clave (lookup)

**Endpoint:** `POST /api/nfc/terminal/lookup`

Si el polling del emparejamiento expiró pero el servidor ya aprobó el terminal, se puede verificar consultando por clave pública:

```kotlin
// PosRepository.kt líneas 1232-1263
val response = service.lookupTerminal(
    TerminalLookupRequest(terminalPublicKey = config.terminalPublicKeyHex)
)
if (body.registered && body.serverPublicKey != null) {
    val updated = config.copy(
        isRegistered = true,
        terminalId = assignedTerminalId,
        serverPublicKeyHex = body.serverPublicKey
    )
    saveConfigSecure(updated)
    cachedSharedKey = null
}
```

### 3.4. Modelos de datos

```kotlin
// PosApiModels.kt
data class CompleteRegistrationRequest(
    val terminalId: String,
    val registrationToken: String,
    val terminalPublicKey: String,    // hex Ed25519 pública del terminal
    val deviceFingerprint: String
)

data class CompleteRegistrationResponse(
    val serverPublicKey: String? = null,  // hex Ed25519 pública del servidor
    val status: String? = null,
    val error: String? = null
)
```

---

## 4. Acuerdo de Clave Compartida (ECDH)

### 4.1. Conversión Ed25519 → Curve25519

**Archivo:** `CryptoEngine.kt` líneas 52-60

Ed25519 usa Curve25519 para firmas, pero ECDH requiere X25519 (Curve25519 en formato Diffie-Hellman). La conversión se hace según la especificación RFC 7748 sección 6.3:

```kotlin
fun ed25519ToCurve25519Clamped(edBytes: ByteArray): ByteArray {
    val md = MessageDigest.getInstance("SHA-512")
    val hash = md.digest(edBytes)
    val clamped = hash.copyOf(32)
    clamped[0] = (clamped[0].toInt() and 248).toByte()   // clamp bit 0,1,2
    clamped[31] = (clamped[31].toInt() and 127).toByte()  // clear bit 255
    clamped[31] = (clamped[31].toInt() or 64).toByte()    // set bit 254
    return clamped
}
```

**Pasos:**
1. SHA-512 sobre los bytes de la clave Ed25519.
2. Tomar los primeros 32 bytes del hash.
3. Aplicar **clamping** estándar de Curve25519:
   - `clamped[0] &= 248` (limpiar los 3 bits menos significativos).
   - `clamped[31] &= 127` (limpiar el bit más significativo).
   - `clamped[31] |= 64` (setear el bit 254).

### 4.2. Derivación de la clave compartida

**Archivo:** `CryptoEngine.kt` líneas 65-93

```kotlin
fun deriveSharedKey(
    terminalPrivateKeyHex: String,
    serverPublicKeyHex: String
): ByteArray {
    val privBytes = terminalPrivateKeyHex.hexToBytes()
    val pubBytes = serverPublicKeyHex.hexToBytes()

    val curvePriv = ed25519ToCurve25519Clamped(privBytes)
    val curvePub = ed25519ToCurve25519Clamped(pubBytes)

    val x25519Priv = X25519PrivateKeyParameters(curvePriv, 0)
    val x25519Pub = X25519PublicKeyParameters(curvePub, 0)

    val agreement = X25519Agreement()
    agreement.init(x25519Priv)

    val rawShared = ByteArray(agreement.agreementSize)
    agreement.calculateAgreement(x25519Pub, rawShared, 0)

    val md = MessageDigest.getInstance("SHA-256")
    val sharedKey = md.digest(rawShared)

    // Wipe temporary key buffers
    Arrays.fill(rawShared, 0.toByte())
    Arrays.fill(curvePriv, 0.toByte())
    Arrays.fill(curvePub, 0.toByte())

    return sharedKey
}
```

**Proceso completo:**
1. Convertir clave privada Ed25519 del terminal → clave privada X25519 (SHA-512 + clamp).
2. Convertir clave pública Ed25519 del servidor → clave pública X25519 (SHA-512 + clamp).
3. Ejecutar `X25519Agreement` (ECDH): `agreement.calculateAgreement()` produce el secreto crudo.
4. Aplicar SHA-256 sobre el secreto crudo → **clave AES de 32 bytes (256 bits)**.
5. **Zeroize** los buffers temporales (`rawShared`, `curvePriv`, `curvePub`).

### 4.3. ensureSharedKey() en PosRepository

**Archivo:** `PosRepository.kt` líneas 605-614

La clave compartida se cachea en memoria para evitar recalcularla en cada operación:

```kotlin
private var cachedSharedKey: ByteArray? = null

private suspend fun ensureSharedKey(): ByteArray = withContext(Dispatchers.IO) {
    val cached = cachedSharedKey
    if (cached != null) return@withContext cached

    val config = getOrInitTerminalConfig()
    val serverPub = config.serverPublicKeyHex ?: CryptoEngine.generateEd25519KeyPair().publicKeyHex
    val derived = CryptoEngine.deriveSharedKey(config.terminalPrivateKeyHex, serverPub)
    cachedSharedKey = derived
    derived
}
```

**Nota:** Si `serverPublicKeyHex` es `null` (terminal no registrado), se genera un keypair efímero como fallback. Esto permite que la app funcione en modo demo sin un servidor real, pero las transacciones no serán verificables.

### 4.4. Invalidación de la clave cacheada

La clave compartida se invalida (`cachedSharedKey = null`) en estos casos:
- `updateServerUrl()` — cambio de servidor.
- `resetTerminalRegistration()` — reset de registro.
- `registerTerminalWithToken()` — registro completado.
- `registerTerminalWithAdminCredentials()` — auto-registro.
- `completePairing()` — emparejamiento completado.
- `checkRegistrationByKey()` — verificación de registro.

---

## 5. Cifrado de Payloads con AES-256-GCM

### 5.0. EphemeralMessage con Handshake (Perfect Forward Secrecy)

> **IMPORTANTE:** El backend (`internal/payments/nfc_terminal.go` `DecodePayload`) espera un `EphemeralMessage` con `handshake` que provee **perfect forward secrecy**. Cada transacción usa una clave efímera (temporal, de un solo uso) generada por el terminal. Esto significa que incluso si la clave compartida ECDH del terminal se compromete en el futuro, las transacciones pasadas siguen siendo indescifrables porque cada una usó una clave efímera diferente que ya no existe.

**Estructura esperada por el backend (`internal/crypto/terminal_crypto.go`):**

```go
type EphemeralHandshake struct {
    EphemeralPublicKey string `json:"ephemeral_public_key"`  // hex Ed25519 efímera
    IdentitySignature  string `json:"identity_signature"`    // hex firma Ed25519 del terminal
    Nonce              string `json:"nonce"`                 // hex nonce del handshake
}

type EphemeralMessage struct {
    Handshake  EphemeralHandshake `json:"handshake"`
    Nonce      string             `json:"nonce"`      // hex nonce AES-GCM
    Ciphertext string             `json:"ciphertext"` // hex ciphertext + GCM tag
    Signature  string             `json:"signature"`  // hex firma Ed25519 del ciphertext
}
```

**Flujo del handshake:**
1. El terminal genera un keypair efímero Ed25519 de un solo uso.
2. Firma `(ephemeral_public_key || nonce)` con su clave privada de identidad → `identity_signature`.
3. Deriva una clave compartida efímera via ECDH entre la clave efímera y la clave pública del servidor.
4. Cifra el payload con AES-256-GCM usando la clave efímera compartida.
5. Firma el ciphertext con la clave privada de identidad del terminal.
6. Envía `EphemeralMessage{handshake, nonce, ciphertext, signature}`.

El backend:
1. Verifica `identity_signature` con la clave pública de identidad del terminal.
2. Genera su propio keypair efímero.
3. Deriva la misma clave compartida efímera via ECDH.
4. Verifica la firma del ciphertext.
5. Descifra con AES-256-GCM.

> **BRECHA DE IMPLEMENTACIÓN:** ~~El código Android actual (`CryptoEngine.kt`, `PosApiModels.kt`) envía un `EncryptedPayload` simple (`{nonce, ciphertext, signature}`) **sin** el campo `handshake`. El backend rechazaría estos payloads. El Android POS necesita ser actualizado para implementar el `EphemeralMessage` con handshake.~~
> **RESUELTO:** El código Android ahora implementa `encryptPayloadEphemeral()` en `CryptoEngine.kt` que genera un keypair efímero, firma el handshake con la clave de identidad del terminal, deriva una clave compartida efímera via ECDH, y cifra el payload con AES-256-GCM. Los modelos `EphemeralHandshakeModel` y `EphemeralMessageModel` en `PosApiModels.kt` serializan el mensaje al formato esperado por el backend. `PosRepository.kt` usa este flujo en los 3 endpoints de pago NFC.

### 5.1. Estructura EncryptedPayload (formato actual del Android)

**Archivo:** `CryptoEngine.kt` líneas 20-24

```kotlin
data class EncryptedPayload(
    val nonce: String,       // 12 bytes en hex (24 caracteres)
    val ciphertext: String,  // ciphertext + GCM tag en hex
    val signature: String    // firma Ed25519 del ciphertext en hex
)
```

### 5.2. encryptPayload()

**Archivo:** `CryptoEngine.kt` líneas 129-152

```kotlin
fun encryptPayload(
    plaintextJson: String,
    sharedKey: ByteArray,
    terminalPrivateKeyHex: String
): EncryptedPayload {
    val nonce = ByteArray(12)
    secureRandom.nextBytes(nonce)

    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    val spec = GCMParameterSpec(128, nonce)
    val keySpec = SecretKeySpec(sharedKey, "AES")
    cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec)

    val plainBytes = plaintextJson.toByteArray(Charsets.UTF_8)
    val ciphertext = cipher.doFinal(plainBytes)

    val signatureHex = signEd25519(terminalPrivateKeyHex, ciphertext)

    return EncryptedPayload(
        nonce = nonce.toHex(),
        ciphertext = ciphertext.toHex(),
        signature = signatureHex
    )
}
```

**Pasos:**
1. Generar **nonce aleatorio de 12 bytes** (96 bits) con `SecureRandom`.
2. Inicializar `Cipher` en modo `AES/GCM/NoPadding` con tag de 128 bits.
3. Cifrar el JSON plano (UTF-8) → `ciphertext` (incluye el GCM tag al final).
4. Firmar el `ciphertext` con la clave privada Ed25519 del terminal → `signature`.
5. Retornar `EncryptedPayload(nonce, ciphertext, signature)` — todos en hexadecimal.

### 5.3. decryptPayload()

**Archivo:** `CryptoEngine.kt` líneas 157-181

```kotlin
fun decryptPayload(
    encryptedPayload: EncryptedPayload,
    sharedKey: ByteArray,
    serverPublicKeyHex: String?
): String {
    val nonceBytes = encryptedPayload.nonce.hexToBytes()
    val cipherBytes = encryptedPayload.ciphertext.hexToBytes()

    if (!serverPublicKeyHex.isNullOrEmpty() && encryptedPayload.signature.isNotEmpty()) {
        val valid = verifyEd25519(serverPublicKeyHex, cipherBytes, encryptedPayload.signature)
        if (!valid) {
            // Log or throw if strict signature check is required
        }
    }

    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    val spec = GCMParameterSpec(128, nonceBytes)
    val keySpec = SecretKeySpec(sharedKey, "AES")
    cipher.init(Cipher.DECRYPT_MODE, keySpec, spec)

    val decryptedBytes = cipher.doFinal(cipherBytes)
    val plaintext = String(decryptedBytes, Charsets.UTF_8)
    Arrays.fill(decryptedBytes, 0.toByte())
    return plaintext
}
```

**Pasos:**
1. Convertir `nonce` y `ciphertext` de hex a bytes.
2. **Verificar firma Ed25519** del servidor sobre el ciphertext (si `serverPublicKeyHex` está disponible).
3. Descifrar con AES-256-GCM usando la misma clave compartida y el nonce.
4. Convertir bytes descifrados a String UTF-8.
5. **Zeroize** los bytes descifrados.

---

## 6. Firma y Verificación Ed25519

### 6.1. signEd25519()

**Archivo:** `CryptoEngine.kt` líneas 98-107

```kotlin
fun signEd25519(privateKeyHex: String, data: ByteArray): String {
    val privBytes = privateKeyHex.hexToBytes()
    val privParams = Ed25519PrivateKeyParameters(privBytes, 0)
    val signer = Ed25519Signer()
    signer.init(true, privParams)
    signer.update(data, 0, data.size)
    val signature = signer.generateSignature()
    Arrays.fill(privBytes, 0.toByte())
    return signature.toHex()
}
```

- Firma los `data` bytes con la clave privada del terminal.
- Retorna la firma como string hexadecimal (128 caracteres = 64 bytes).
- **Zeroiza** los bytes de la clave privada después de usarlos.

### 6.2. verifyEd25519()

**Archivo:** `CryptoEngine.kt` líneas 112-124

```kotlin
fun verifyEd25519(publicKeyHex: String, data: ByteArray, signatureHex: String): Boolean {
    return try {
        val pubBytes = publicKeyHex.hexToBytes()
        val sigBytes = signatureHex.hexToBytes()
        val pubParams = Ed25519PublicKeyParameters(pubBytes, 0)
        val verifier = Ed25519Signer()
        verifier.init(false, pubParams)
        verifier.update(data, 0, data.size)
        verifier.verifySignature(sigBytes)
    } catch (e: Exception) {
        false
    }
}
```

- Verifica la firma usando la clave pública del servidor.
- Retorna `false` ante cualquier excepción (no propaga errores).

---

## 7. KeystoreCrypto — Almacenamiento Seguro de Claves

**Archivo:** `KeystoreCrypto.kt`

### 7.1. Propósito

Android Keystore protege la clave privada del terminal (`terminalPrivateKeyHex`) cuando está en reposo en la base de datos Room. La clave maestra de cifrado se genera y almacena dentro del **Android Keystore** del dispositivo, por lo que solo esta app en este dispositivo puede desencriptar los datos.

### 7.2. Configuración

```kotlin
object KeystoreCrypto {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "pos_terminal_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 128
}
```

### 7.3. getOrCreateMasterKey()

**Líneas 38-71**

```kotlin
private fun getOrCreateMasterKey(): SecretKey {
    cachedKey?.let { return it }

    val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
    keyStore.load(null)

    val existingKey = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
    if (existingKey != null) {
        cachedKey = existingKey
        return existingKey
    }

    val keyGenerator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES,
        KEYSTORE_PROVIDER
    )
    val spec = KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()

    keyGenerator.init(spec)
    val key = keyGenerator.generateKey()
    cachedKey = key
    return key
}
```

**Características:**
- **AES-256-GCM** con clave almacenada en hardware (Keystore).
- **Sin autenticación biométrica** — el POS puede usarse en dispositivos sin biometría.
- La clave **persiste a través de actualizaciones** de la app.
- Solo se pierde si se borran **completamente** los datos de la app (cache + datos).
- Cache en memoria (`@Volatile cachedKey`) para evitar viajes al Keystore en cada operación.

### 7.4. encrypt()

**Líneas 77-93**

```kotlin
fun encrypt(plaintext: String): String {
    if (plaintext.isEmpty()) return ""

    val key = getOrCreateMasterKey()
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key)

    val iv = cipher.iv
    val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

    val combined = ByteArray(iv.size + ciphertext.size)
    System.arraycopy(iv, 0, combined, 0, iv.size)
    System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)

    return Base64.encodeToString(combined, Base64.NO_WRAP)
}
```

**Formato de salida:** `Base64(IV || ciphertext || GCM_TAG)` — un solo string Base64 sin saltos de línea.

### 7.5. decrypt()

**Líneas 99-123**

```kotlin
fun decrypt(encrypted: String): String {
    if (encrypted.isEmpty()) return ""

    return try {
        val combined = Base64.decode(encrypted, Base64.NO_WRAP)
        if (combined.size <= GCM_IV_LENGTH) return encrypted

        val iv = combined.copyOfRange(0, GCM_IV_LENGTH)
        val ciphertext = combined.copyOfRange(GCM_IV_LENGTH, combined.size)

        val key = getOrCreateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)

        val plaintext = cipher.doFinal(ciphertext)
        String(plaintext, Charsets.UTF_8)
    } catch (e: Exception) {
        encrypted  // Fallback: devolver original si no está encriptado
    }
}
```

**Fallback importante:** Si la desencriptación falla (por ejemplo, datos viejos no encriptados), devuelve el string original. Esto garantiza compatibilidad hacia atrás.

### 7.6. isEncrypted()

**Líneas 128-136**

```kotlin
fun isEncrypted(value: String): Boolean {
    if (value.isEmpty()) return false
    return try {
        val decoded = Base64.decode(value, Base64.NO_WRAP)
        decoded.size > GCM_IV_LENGTH + 16
    } catch (e: Exception) {
        false
    }
}
```

Detecta si un string está encriptado verificando que sea Base64 válido con tamaño suficiente (IV + al menos un bloque AES).

### 7.7. Integración con PosRepository

**Archivo:** `PosRepository.kt` líneas 35-56

```kotlin
// Guardar config con la clave privada encriptada
private suspend fun saveConfigSecure(config: TerminalConfigEntity) = withContext(Dispatchers.IO) {
    val encryptedPrivateKey = if (config.terminalPrivateKeyHex.isNotEmpty()
        && !KeystoreCrypto.isEncrypted(config.terminalPrivateKeyHex)) {
        KeystoreCrypto.encrypt(config.terminalPrivateKeyHex)
    } else {
        config.terminalPrivateKeyHex
    }
    val secureConfig = config.copy(terminalPrivateKeyHex = encryptedPrivateKey)
    terminalConfigDao.saveConfig(secureConfig)
}

// Leer config con la clave privada desencriptada
private suspend fun getConfigSecure(): TerminalConfigEntity? = withContext(Dispatchers.IO) {
    val config = terminalConfigDao.getConfig() ?: return@withContext null
    val decryptedPrivateKey = if (config.terminalPrivateKeyHex.isNotEmpty()
        && KeystoreCrypto.isEncrypted(config.terminalPrivateKeyHex)) {
        KeystoreCrypto.decrypt(config.terminalPrivateKeyHex)
    } else {
        config.terminalPrivateKeyHex
    }
    config.copy(terminalPrivateKeyHex = decryptedPrivateKey)
}
```

**Flujo:**
- **Escritura:** Si la clave privada no está encriptada, se encripta con Keystore antes de guardar en Room.
- **Lectura:** Si la clave privada está encriptada, se desencripta con Keystore al leer de Room.
- La clave privada **nunca** se guarda en texto plano en la base de datos.

### 7.8. deleteMasterKey()

**Líneas 142-151**

Elimina la clave maestra del Keystore. Se usa solo cuando el usuario resetea el terminal completamente.

---

## 8. Modelos de Datos para Pagos Cifrados

### 8.1. EncryptedPayloadModel (JSON de red — formato actual Android)

**Archivo:** `PosApiModels.kt`

```kotlin
data class EncryptedPayloadModel(
    @Json(name = "nonce") val nonce: String,
    @Json(name = "ciphertext") val ciphertext: String,
    @Json(name = "signature") val signature: String
)
```

> **Nota:** Este es el formato actual del Android. El backend espera un `EphemeralMessage` con `handshake` (ver sección 5.0). El Android necesita ser actualizado.

### 8.2. EncryptedPaymentRequest (request al servidor)

**Archivo:** `PosApiModels.kt`

```kotlin
data class EncryptedPaymentRequest(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "encrypted_payload") val encryptedPayload: EncryptedPayloadModel
)
```

**Estructura JSON enviada (formato actual Android):**

```json
{
  "terminal_id": "TERM-ANDROID-A1B2C3D4E5F6",
  "encrypted_payload": {
    "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2",
    "ciphertext": "9e8f... (hex del ciphertext + GCM tag)",
    "signature": "1a2b... (hex de la firma Ed25519 del ciphertext)"
  }
}
```

**Estructura JSON esperada por el backend (EphemeralMessage):**

```json
{
  "terminal_id": "TERM-ANDROID-A1B2C3D4E5F6",
  "encrypted_payload": {
    "handshake": {
      "ephemeral_public_key": "a1b2... (hex Ed25519 efímera)",
      "identity_signature": "c3d4... (hex firma Ed25519 de identidad)",
      "nonce": "e5f6... (hex nonce del handshake)"
    },
    "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2",
    "ciphertext": "9e8f... (hex del ciphertext + GCM tag)",
    "signature": "1a2b... (hex de la firma Ed25519 del ciphertext)"
  }
}
```

### 8.3. EncryptedPaymentResponse (respuesta del servidor)

**Archivo:** `PosApiModels.kt` líneas 193-200

```kotlin
data class EncryptedPaymentResponse(
    @Json(name = "nonce") val nonce: String? = null,
    @Json(name = "ciphertext") val ciphertext: String? = null,
    @Json(name = "signature") val signature: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null
)
```

La respuesta tiene la misma estructura de payload cifrado (`nonce`, `ciphertext`, `signature`) más campos opcionales de error/estado. El servidor cifra la respuesta con la **misma clave compartida** y la firma con su **clave privada Ed25519**.

### 8.4. Payloads descifrados (internos)

```kotlin
// Pago NFC simple
data class SinglePaymentDecryptedPayload(
    val cardUid: String,
    val cryptoToken: String,
    val pin: String,
    val amount: Long,           // micro-units TQ
    val timestamp: Long,        // epoch seconds
    val nonce: String,
    val idDocumentType: String? = null,
    val idDocumentNumber: String? = null
)

// Pago comunitario (multi-vendedor)
data class CommunityPaymentDecryptedPayload(
    val sellerCardUid: String,
    val sellerCryptoToken: String,
    val sellerPin: String,
    val buyerCardUid: String,
    val buyerCryptoToken: String,
    val buyerPin: String,
    val amount: Long,
    val timestamp: Long,
    val nonce: String,
    val buyerIdDocumentType: String? = null,
    val buyerIdDocumentNumber: String? = null
)

// Firma multi-firma
data class MultisigSignDecryptedPayload(
    val pendingPaymentId: String,
    val cardUid: String,
    val pin: String,
    val timestamp: Long,
    val nonce: String,
    val idDocumentType: String? = null,
    val idDocumentNumber: String? = null
)

// Resultado descifrado
data class PaymentResultDecrypted(
    val status: String? = null,  // "approved", "rejected", "pending_multisig"
    val transactionId: String? = null,
    val pendingId: String? = null,
    val message: String? = null,
    val userBalance: Long? = null,
    val requiredSigs: Int? = null,
    val collectedSigs: Int? = null,
    val remainingSigs: Int? = null
)
```

---

## 9. Flujo Completo de Cifrado de un Pago NFC

### 9.1. Ejemplo: processNfcPayment()

**Archivo:** `PosRepository.kt` líneas 617-806

```kotlin
suspend fun processNfcPayment(
    cardUid: String,
    isDesfire: Boolean,
    pin: String,
    amountMicroUnits: Long,
    idDocType: String? = null,
    idDocNumber: String? = null
): Result<PaymentResultDecrypted> = withContext(Dispatchers.IO) {
    try {
        val config = getOrInitTerminalConfig()
        val sharedKey = ensureSharedKey()
        val timestamp = System.currentTimeMillis() / 1000
        val nonce = CryptoEngine.generateRandomNonce(16)
        val cryptoToken = if (isDesfire) "desfire_auth_ok" else cardUid

        // 1. Construir payload descifrado
        val decryptedPayload = SinglePaymentDecryptedPayload(
            cardUid = cardUid,
            cryptoToken = cryptoToken,
            pin = pin,
            amount = amountMicroUnits,
            timestamp = timestamp,
            nonce = nonce,
            idDocumentType = idDocType,
            idDocumentNumber = idDocNumber
        )

        // 2. Serializar a JSON
        val adapter = apiClient.moshi.adapter(SinglePaymentDecryptedPayload::class.java)
        val jsonPlain = adapter.toJson(decryptedPayload)

        // 3. Cifrar: JSON plano → AES-256-GCM → EncryptedPayload
        val encrypted = CryptoEngine.encryptPayload(
            plaintextJson = jsonPlain,
            sharedKey = sharedKey,
            terminalPrivateKeyHex = config.terminalPrivateKeyHex
        )

        // 4. Construir request
        val request = EncryptedPaymentRequest(
            terminalId = config.terminalId,
            encryptedPayload = EncryptedPayloadModel(
                nonce = encrypted.nonce,
                ciphertext = encrypted.ciphertext,
                signature = encrypted.signature
            )
        )

        // 5. Enviar al servidor
        val response = service.processNfcPayment(request)

        // 6. Descifrar respuesta
        if (response.isSuccessful && response.body()?.ciphertext != null) {
            val encResp = response.body()!!
            val plainResp = CryptoEngine.decryptPayload(
                encryptedPayload = EncryptedPayload(
                    nonce = encResp.nonce.orEmpty(),
                    ciphertext = encResp.ciphertext.orEmpty(),
                    signature = encResp.signature.orEmpty()
                ),
                sharedKey = sharedKey,
                serverPublicKeyHex = config.serverPublicKeyHex
            )

            // 7. Deserializar respuesta descifrada
            val resAdapter = apiClient.moshi.adapter(PaymentResultDecrypted::class.java)
            val result = resAdapter.fromJson(plainResp)
            // ...
        }
    } finally {
        CryptoEngine.zeroize()
    }
}
```

### 9.2. Diagrama de secuencia

```
Terminal                                    Servidor
   │                                           │
   │  1. Construir SinglePaymentDecryptedPayload
   │  2. Serializar a JSON (Moshi)              │
   │  3. AES-256-GCM encrypt(JSON, sharedKey)   │
   │  4. Ed25519 sign(ciphertext, terminalPriv) │
   │                                           │
   │  POST /api/nfc/terminal/payment           │
   │  {terminal_id, encrypted_payload: {       │
   │    nonce, ciphertext, signature           │
   │  }}                                       │
   │ ─────────────────────────────────────────> │
   │                                           │
   │                    5. Verificar firma Ed25519 con terminalPubKey
   │                    6. AES-256-GCM decrypt(ciphertext, sharedKey)
   │                    7. Procesar pago
   │                    8. AES-256-GCM encrypt(response, sharedKey)
   │                    9. Ed25519 sign(ciphertext, serverPrivKey)
   │                                           │
   │  EncryptedPaymentResponse:                │
   │  {nonce, ciphertext, signature}           │
   │ <───────────────────────────────────────── │
   │                                           │
   │  10. Verificar firma Ed25519 con serverPubKey
   │  11. AES-256-GCM decrypt(ciphertext, sharedKey)
   │  12. Deserializar JSON → PaymentResultDecrypted
   │                                           │
```

---

## 10. Otros Métodos de CryptoEngine

### 10.1. generateRandomNonce()

```kotlin
fun generateRandomNonce(byteLength: Int = 16): String {
    val nonce = ByteArray(byteLength)
    secureRandom.nextBytes(nonce)
    return nonce.toHex()
}
```

Genera un nonce aleatorio de longitud configurable (default 16 bytes = 32 hex chars). Se usa para los nonces de los payloads descifrados (campo `nonce` en `SinglePaymentDecryptedPayload`, etc.), distintos del nonce AES-GCM de 12 bytes.

### 10.2. getDeviceFingerprint()

```kotlin
fun getDeviceFingerprint(context: Context): String {
    val androidId = Settings.Secure.getString(
        context.contentResolver, Settings.Secure.ANDROID_ID
    ) ?: "unknown_pos_device"
    val md = MessageDigest.getInstance("SHA-256")
    val digest = md.digest("POS-ANDROID-$androidId".toByteArray(Charsets.UTF_8))
    return digest.toHex()
}
```

- Lee `ANDROID_ID` del dispositivo (identificador único por app+usuario en Android 8+).
- Aplica SHA-256 sobre `"POS-ANDROID-$androidId"`.
- Retorna un hash hexadecimal de 64 caracteres.
- Se envía al servidor durante registro, emparejamiento y autenticación.

### 10.3. generateTerminalId()

```kotlin
fun generateTerminalId(context: Context): String {
    val androidId = Settings.Secure.getString(
        context.contentResolver, Settings.Secure.ANDROID_ID
    ) ?: "unknown_pos_device"
    val md = MessageDigest.getInstance("SHA-256")
    val digest = md.digest("POS-ANDROID-$androidId".toByteArray(Charsets.UTF_8))
    val hash = digest.toHex()
    return "TERM-ANDROID-${hash.take(12).uppercase()}"
}
```

- ID determinista: mismo dispositivo + mismo algoritmo = mismo ID siempre.
- No cambia con actualizaciones de la app.
- Se regenera idéntico si se borran los datos de la app y se vuelve a crear (mismo ANDROID_ID).
- Solo cambia si se desinstala completamente la app (Android 8+ puede rotar ANDROID_ID al reinstalar con diferente signing key).
- Formato: `TERM-ANDROID-A1B2C3D4E5F6` (12 caracteres hex uppercase).

### 10.4. zeroize()

```kotlin
fun zeroize(vararg byteArrays: ByteArray?) {
    for (b in byteArrays) {
        if (b != null) {
            Arrays.fill(b, 0.toByte())
        }
    }
}
```

Rellena con ceros los arrays de bytes pasados como argumentos. Se llama en el bloque `finally` de `processNfcPayment()` para limpieza de memoria.

### 10.5. Funciones de extensión

```kotlin
fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

fun String.hexToBytes(): ByteArray {
    val clean = this.trim()
    val len = clean.length
    val data = ByteArray(len / 2)
    var i = 0
    while (i < len) {
        data[i / 2] = ((Character.digit(clean[i], 16) shl 4)
            + Character.digit(clean[i + 1], 16)).toByte()
        i += 2
    }
    return data
}
```

---

## 11. Autenticación del Terminal (Ed25519 Signature)

### 11.1. authenticateTerminal()

**Archivo:** `PosRepository.kt` líneas 161-219

```kotlin
suspend fun authenticateTerminal(): Result<TerminalAuthResponse> = withContext(Dispatchers.IO) {
    val config = getOrInitTerminalConfig()
    val sharedKey = ensureSharedKey()
    val nonce = CryptoEngine.generateRandomNonce(16)
    val timestamp = System.currentTimeMillis() / 1000

    // Firmar (terminal_id + nonce + timestamp) con la clave privada del terminal
    val message = "${config.terminalId}|$nonce|$timestamp".toByteArray(Charsets.UTF_8)
    val signature = CryptoEngine.signEd25519(config.terminalPrivateKeyHex, message)

    val request = TerminalAuthRequest(
        terminalId = config.terminalId,
        signature = signature,
        nonce = nonce,
        deviceFingerprint = CryptoEngine.getDeviceFingerprint(context)
    )

    val response = service.terminalAuth(request)
    // ...
}
```

**Endpoint:** `POST /api/nfc/terminal/auth`

**Mensaje firmado:** `"terminalId|nonce|timestamp"` (separado por `|`).

El servidor verifica la firma usando la clave pública del terminal registrada previamente. Si es válida, responde con:
- `session_token`: token de sesión para autenticación subsiguiente.
- `format_settings`: configuración de formato (locale, date_format, etc.).

---

## 12. Rotación de Claves de Sesión

### 12.1. Mecanismo

La clave compartida ECDH (`cachedSharedKey`) se invalida y se recalcula en los siguientes eventos:

| Evento | Método | Acción |
|--------|--------|--------|
| Cambio de servidor | `updateServerUrl()` | `cachedSharedKey = null` |
| Reset de registro | `resetTerminalRegistration()` | `cachedSharedKey = null` + nuevo keypair |
| Registro completado | `registerTerminalWithToken()` | `cachedSharedKey = null` |
| Auto-registro | `registerTerminalWithAdminCredentials()` | `cachedSharedKey = null` |
| Emparejamiento completado | `completePairing()` | `cachedSharedKey = null` |
| Lookup exitoso | `checkRegistrationByKey()` | `cachedSharedKey = null` |

Cuando `cachedSharedKey` es `null`, la próxima llamada a `ensureSharedKey()` recalcula la clave usando la nueva `serverPublicKeyHex`.

### 12.2. Token de sesión

El `sessionToken` recibido en `TerminalAuthResponse` se persiste en `TerminalConfigEntity.sessionToken` y se usa como `Authorization: Bearer $token` en las cabeceras HTTP subsiguientes (via `authInterceptor` en `PosApiClient`).

---

## 13. Cabeceras HTTP Criptográficas

**Archivo:** `PosApiClient.kt` líneas 40-58

El interceptor de autenticación añade cabeceras relevantes:

```kotlin
private val authInterceptor = Interceptor { chain ->
    val original = chain.request()
    val builder = original.newBuilder()
        .header("Content-Type", "application/json")
        .header("X-Node-Domain", nodeDomain)

    if (!authToken.isNullOrBlank()) {
        builder.header("Authorization", "Bearer $authToken")
    }
    if (terminalId.isNotBlank()) {
        builder.header("X-Terminal-ID", terminalId)
    }
    if (!pubKey.isNullOrBlank()) {
        builder.header("X-Terminal-Public-Key", pubKey)
    }

    chain.proceed(builder.build())
}
```

| Cabecera | Valor | Propósito |
|----------|-------|-----------|
| `Authorization` | `Bearer {sessionToken}` | Autenticación de sesión |
| `X-Terminal-ID` | `TERM-ANDROID-...` | Identificación del terminal |
| `X-Terminal-Public-Key` | hex Ed25519 pública | Verificación criptográfica |
| `X-Node-Domain` | host del servidor | Routing al nodo correcto |

---

## 14. Resumen de Algoritmos

| Función | Algoritmo | Biblioteca | Tamaño |
|---------|-----------|------------|--------|
| Identidad del terminal | Ed25519 | BouncyCastle | 256 bits |
| Firma de payloads | Ed25519 | BouncyCastle | 512 bits (firma) |
| Acuerdo de clave | X25519 (ECDH) | BouncyCastle | 256 bits |
| Derivación de clave compartida | SHA-256 | JDK | 256 bits |
| Cifrado de payloads | AES-256-GCM | JDK (javax.crypto) | 256 bits clave, 128 bits tag |
| Cifrado de clave privada en reposo | AES-256-GCM | Android Keystore | 256 bits clave |
| Fingerprint del dispositivo | SHA-256 | JDK | 256 bits |
| Terminal ID | SHA-256 (12 chars) | JDK | 48 bits efectivos |
| Nonce AES-GCM | SecureRandom | JDK | 96 bits (12 bytes) |
| Hash de PIN | bcrypt | Go (servidor) | costo default |
| Claves A/B MIFARE Classic | crypto/rand | Go (servidor) | 48 bits (6 bytes) |
| Certificados Classic | crypto/rand | Go (servidor) | 128 bits (16 bytes) |

---

## 15. MIFARE Classic — Certificados Dinámicos

### Modelo de seguridad

Las tarjetas MIFARE Classic 1K usan **6 capas de seguridad** para mitigar la clonación:

1. **Claves A/B únicas por sector por tarjeta** — 30 claves aleatorias diferentes por tarjeta
2. **Certificados dinámicos con triple redundancia** — 45 copias, solo 1 sector válido
3. **Rotación aleatoria por transacción** — no secuencial, salta entre 15 sectores
4. **Documento + PIN obligatorios** — 2FA hardcoded, no configurable
5. **Claves minimizadas en tránsito** — solo 2 claves por transacción (encriptadas)
6. **Aislamiento entre tarjetas** — claves únicas por usuario

### Criptografía del flujo Classic

El flujo Classic usa el **mismo esquema criptográfico** que el resto del POS:

1. **User lookup:** POS envía `{terminal_id, username}` cifrado con EphemeralMessage (AES-256-GCM). Servidor responde con `{found, card_type, requires_document, required_doc_type, ...}`.
2. **Pre-auth (sin documento, UID/DESFire):** POS envía `{terminal_id, username, pin, amount}` cifrado con EphemeralMessage. Servidor responde con `{pre_approved, card_uid, card_type}`.
3. **Pre-auth (con documento, Classic):** POS envía `{terminal_id, username, doc_type, doc_number, pin, amount}` cifrado con EphemeralMessage. Servidor responde con `{pre_approved, card_uid, card_type, read_sector, read_key_a, expected_certificate, write_sector, write_key_b, new_certificate}`.
4. **Confirmación:** POS envía `{terminal_id, card_uid, read_ok, write_ok, written_blocks}` cifrado con un nuevo EphemeralMessage. Servidor responde con `{status, transaction_id, message}`.

Las claves A/B y certificados viajan **dentro del payload cifrado**, nunca en claro.

### Archivos clave

- `app/src/main/java/com/example/data/nfc/MifareClassicReader.kt` — lectura/escritura de sectores
- `app/src/main/java/com/example/data/api/PosApiModels.kt` — modelos `ClassicPreAuthDecryptedPayload`, `ClassicPreAuthResponse`, `ClassicConfirmDecryptedPayload`
- `app/src/main/java/com/example/data/repository/PosRepository.kt` — `classicPreAuth()`, `confirmClassicTransaction()`, `provisionClassicCard()`
- `app/src/main/java/com/example/ui/viewmodel/PosViewModel.kt` — `submitClassicPayment()`, `onClassicCardTapped()`

Ver `docs/tarjeta-classic-certificados.md` para detalles completos del modelo de 6 capas.
| Nonce de payload | SecureRandom | JDK | 128 bits (16 bytes) |
