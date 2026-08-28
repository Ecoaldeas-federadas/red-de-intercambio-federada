# Build, Despliegue y Troubleshooting

Este documento describe cómo construir, firmar y desplegar la aplicación POS Android, los flujos de registro y emparejamiento de terminales, las migraciones de Room, y problemas conocidos.

---

## 1. Requisitos

### JDK
- **JDK 17+** recomendado (el proyecto usa Java 11 como sourceCompatibility pero Gradle 8 requiere JDK 17+)
- Verificar: `java -version`

### Android SDK
- **compileSdk = 36** (Android 16)
- **minSdk = 24** (Android 7.0 Nougat)
- **targetSdk = 36**
- Verificar: `sdkmanager --list`

### Gradle
- **Gradle 8+** (incluido via wrapper `./gradlew`)
- Verificar: `./gradlew --version`

### Android NDK
- No requerido (no hay código nativo en el proyecto)

---

## 2. Estructura del proyecto

```
punto-de-venta-pos/
├── app/
│   ├── build.gradle.kts          # Configuración del módulo app
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/example/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── data/
│   │   │   │   │   ├── api/       # PosApiClient.kt (Retrofit)
│   │   │   │   │   ├── crypto/    # CryptoEngine.kt, KeystoreCrypto.kt
│   │   │   │   │   ├── db/        # AppDatabase.kt (Room)
│   │   │   │   │   └── repository/ # PosRepository.kt
│   │   │   │   └── ui/
│   │   │   │       ├── components/  # FeedbackModifier.kt, KioskComponents.kt, etc.
│   │   │   │       ├── screens/     # DashboardScreen.kt, NfcChargeScreen.kt, etc.
│   │   │   │       ├── util/        # Formatters.kt (FormatConfig, FeedbackHelper, CurrencyHelper)
│   │   │   │       └── viewmodel/   # PosViewModel.kt
│   │   │   └── res/               # Recursos (layouts, strings, icons)
│   │   ├── test/                  # Tests unitarios
│   │   └── androidTest/           # Tests instrumentados
│   └── proguard-rules.pro
├── settings.gradle.kts
├── gradle/
│   └── libs.versions.toml        # Catálogo de versiones
├── gradlew, gradlew.bat
├── docs/                          # Esta documentación
└── .env, .env.example             # Variables de entorno (Secrets Gradle Plugin)
```

---

## 3. Configuración del build

### app/build.gradle.kts — puntos clave

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.devtools.ksp)    // Room, Moshi codegen
    alias(libs.plugins.roborazzi)              // Screenshot testing
    alias(libs.plugins.secrets)                // .env → BuildConfig
    alias(libs.plugins.google.services)        // Firebase
}

android {
    namespace = "com.example"
    compileSdk { version = release(36) { minorApiLevel = 1 } }

    defaultConfig {
        applicationId = "com.aistudio.posfederado.vxrtpa"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        compose = true
        buildConfig = true     // Necesario para Secrets Gradle Plugin
    }
}
```

### Signing configs
- **Release**: usa `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_PASSWORD` (env vars)
- **Debug**: usa `debug.keystore` con credenciales estándar de Android

### Secrets Gradle Plugin
```kotlin
secrets {
    propertiesFileName = ".env"
    defaultPropertiesFileName = ".env.example"
    ignoreList.add("FIREBASE_APPCHECK_DEBUG_TOKEN")
}
```
Las variables del archivo `.env` se inyectan en `BuildConfig`.

---

## 4. Dependencias principales

| Dependencia | Uso |
|-------------|-----|
| `androidx.compose.bom` | BOM de Compose |
| `androidx.compose.material3` | Material 3 |
| `androidx.activity.compose` | Activity Compose |
| `androidx.lifecycle.viewmodel.compose` | ViewModel Compose |
| `androidx.room.runtime`, `androidx.room.ktx` | Room database |
| `androidx.room.compiler` (ksp) | Room codegen |
| `retrofit` | HTTP client |
| `converter.moshi`, `moshi.kotlin` | JSON serialization |
| `okhttp`, `logging.interceptor` | HTTP client + logging |
| `bouncycastle` | Ed25519 cryptography |
| `zxing.core` | QR code generation |
| `kotlinx.coroutines` | Coroutines |
| `firebase.ai`, `firebase.appcheck.recaptcha` | Firebase |
| `roborazzi`, `robolectric` | Screenshot/unit testing |

---

## 5. Comandos de build

### Build debug APK
```bash
cd punto-de-venta-pos
./gradlew assembleDebug
```
Output: `app/build/outputs/apk/debug/app-debug.apk`

### Build release APK
```bash
# Requiere KEYSTORE_PATH, STORE_PASSWORD, KEY_PASSWORD en env
./gradlew assembleRelease
```
Output: `app/build/outputs/apk/release/app-release.apk`

### Build AAB (App Bundle para Play Store)
```bash
./gradlew bundleRelease
```
Output: `app/build/outputs/bundle/release/app-release.aab`

### Limpiar build
```bash
./gradlew clean
```

### Tests unitarios
```bash
./gradlew test
```

### Tests instrumentados (requiere dispositivo/emulador)
```bash
./gradlew connectedAndroidTest
```

---

## 6. Room Database — Migraciones

### Versión actual: 3
```kotlin
@Database(
    entities = [TransactionEntity::class, ShiftEntity::class, TerminalConfigEntity::class, ShiftPinEntity::class],
    version = 3,
    exportSchema = false
)
```

### MIGRATION_2_3
Añade 6 columnas de formato a `terminal_config` **sin perder datos**:

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

### Registro en DatabaseProvider (MainActivity.kt)
```kotlin
fun getDatabase(context: Context): AppDatabase {
    return instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "pos_terminal_db.db"
        )
        .addMigrations(MIGRATION_2_3)
        // fallback solo como ultima opcion para migraciones futuras no previstas,
        // pero MIGRATION_2_3 preserva los datos existentes al actualizar de v2 a v3.
        .fallbackToDestructiveMigration()
        .build().also { instance = it }
    }
}
```

### ⚠️ CRÍTICO: Nunca usar fallbackToDestructiveMigration() sin migración explícita

**El bug que causó pérdida de credenciales:**
- Se añadieron 6 campos a `TerminalConfigEntity` (campos `fmt*`)
- La versión de la BD cambió de 2 a 3
- `fallbackToDestructiveMigration()` estaba activa **sin** migración explícita
- Room **destruyó** toda la base de datos al detectar el cambio de versión
- Se perdieron: `terminalId`, `terminalPrivateKeyHex`, `terminalPublicKeyHex`, `serverPublicKeyHex`, `sessionToken`, `isRegistered`
- Los dispositivos tuvieron que **re-registrarse** manualmente

**La corrección:**
- Se añadió `MIGRATION_2_3` con `ALTER TABLE ADD COLUMN` (preserva filas existentes)
- Se registró con `.addMigrations(MIGRATION_2_3)` **antes** de `.fallbackToDestructiveMigration()`
- `fallbackToDestructiveMigration()` se mantiene como red de seguridad para migraciones futuras, pero la migración explícita se ejecuta primero

**Regla de oro**: Siempre que se modifique una `@Entity` (añadir/eliminar campos, cambiar tipos):
1. Incrementar `version` en `@Database`
2. Crear una `Migration(N, N+1)` con `ALTER TABLE` apropiado
3. Registrarla con `.addMigrations(...)`
4. **NUNCA** confiar solo en `fallbackToDestructiveMigration()`

---

## 7. Registro y emparejamiento de terminales

### Flujo de registro (primera vez)

1. **Generar keypair Ed25519** (en el POS Android):
   ```kotlin
   val keypair = CryptoEngine.generateKeyPair()
   // terminalPrivateKeyHex, terminalPublicKeyHex
   ```

2. **POST /api/nfc/terminal/register**:
   ```json
   {
     "terminal_id": "TERM-POS-001",
     "terminal_name": "POS Feria",
     "public_key_hex": "<ed25519-public-key-hex>",
     "merchant_user_id": "uuid-del-comerciante",
     "device_fingerprint": "<fingerprint-hash>"
   }
   ```

3. **Recibir server_public_key_hex**:
   ```json
   {
     "terminal_id": "TERM-POS-001",
     "server_public_key_hex": "<ed25519-server-public-key-hex>",
     "status": "registered"
   }
   ```

4. **Persistir en Room** (`TerminalConfigEntity`):
   - `terminalId`, `terminalPrivateKeyHex`, `terminalPublicKeyHex`, `serverPublicKeyHex`, `isRegistered = true`

5. **Autenticar** (POST /api/nfc/terminal/auth):
   - Firma Ed25519 del timestamp con la clave privada del terminal
   - Recibe `session_token` + `format_settings`
   - Persistir `sessionToken` y campos `fmt*`

### Flujo de emparejamiento (pairing con código de 6 dígitos)

1. **POST /api/nfc/terminal/pair/initiate**:
   ```json
   {
     "terminal_id": "TERM-POS-001",
     "public_key_hex": "<ed25519-public-key-hex>",
     "merchant_user_id": "uuid"
   }
   ```
   Respuesta: `{ "pairing_code": "123456", "expires_at": "..." }`

2. **Admin aprueba en la web app** usando el código de 6 dígitos

3. **Polling** — GET /api/nfc/terminal/pair/{code}/status:
   ```json
   { "status": "pending|approved|rejected|expired" }
   ```

4. **Si approved** — POST /api/nfc/terminal/complete-registration:
   ```json
   {
     "terminal_id": "TERM-POS-001",
     "pairing_code": "123456",
     "public_key_hex": "<ed25519-public-key-hex>"
   }
   ```

5. **Persistir credenciales** en Room

### Autenticación periódica
- El `session_token` JWT tiene expiración
- El POS debe re-autenticarse cuando el token expira
- Heartbeat: POST /api/nfc/terminal/heartbeat cada N minutos

---

## 8. Configuración del servidor

### URL del servidor
- Se configura en la pantalla de Settings
- Se persiste en `TerminalConfigEntity.serverUrl`
- Default: `https://feria.loanstly.com/demo`

### Detección de modo demo
```kotlin
val isDemoNode: Boolean
    get() = serverUrl.contains("/demo")
```
- Si la URL contiene `/demo` → modo demo (simulaciones locales)
- Si no → modo real (siempre contacta al servidor)

### Cambiar de servidor
1. Ir a Settings → Server URL
2. Ingresar nueva URL (ej: `https://feria.loanstly.com/main` para modo real)
3. Guardar
4. Si el servidor cambió, puede ser necesario re-registrar el terminal

---

## 9. Permisos de Android

### AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.VIBRATE" />

<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

- `INTERNET`: comunicación con el backend
- `ACCESS_NETWORK_STATE`: verificar conectividad
- `NFC`: leer tarjetas NFC
- `VIBRATE`: feedback háptico
- `NFC` feature es `required="false"` → la app funciona en dispositivos sin NFC (modo QR)

---

## 10. OTA Updates (updater-controller)

El sistema incluye un mecanismo de actualización OTA (Over-The-Air) para terminales ESP32, controlado por `updater-controller` y `docker/do_update.sh`.

### Para el POS Android
- Las actualizaciones se distribuyen como APK
- No hay OTA automático para Android — se instala manualmente o via Play Store
- El updater-controller es para firmware ESP32, no para Android

---

## 11. Troubleshooting

### El terminal pierde credenciales después de una actualización
**Causa**: Se modificó una `@Entity` sin migración explícita, y `fallbackToDestructiveMigration()` borró la BD.

**Solución**:
1. Verificar que `.addMigrations(MIGRATION_2_3)` esté presente
2. Si se añadieron nuevos campos, crear `MIGRATION_3_4` con `ALTER TABLE`
3. Re-registrar el terminal una vez (irreversible si ya se borró)

### Error: "not a git repository"
**Causa**: El updater-controller se reinició sin el bind mount correcto del directorio del proyecto.

**Solución**: Verificar que el volumen `/project` esté montado correctamente en el contenedor Docker.

### El POS no conecta al servidor
1. Verificar URL en Settings (¿tiene `/demo` o `/main`?)
2. Verificar conectividad de red
3. Verificar que el servidor Go esté corriendo
4. Si es modo real, verificar que el terminal esté registrado y activo

### El pago NFC falla con "saldo insuficiente"
- En modo real, el servidor verifica `balance - amount < credit_limit`
- El `credit_limit` es negativo (ej: `-50000` = -500.00 TQ)
- Un pago se rechaza si el balance resultante sería menor que `credit_limit`
- **No es "fondos insuficientes" convencional** — es un límite comunitario

### El pago multifirma expira
- Cada firma tiene 3 minutos de timeout
- Cada firma válida resetea el timer a 3 minutos
- Si nadie firma en 3 minutos, el pago se anula automáticamente
- Verificar que los firmantes autorizados estén en `authorized_signers`

### El modo demo no funciona
- El modo demo funciona **offline** (sin servidor)
- Verificar que `serverUrl` contenga `/demo`
- Las simulaciones son locales en `PosRepository` dentro de `if (apiClient.isDemoNode)`
- Si el servidor demo está caído, el modo demo **sigue funcionando** (es local)

### Build falla con error de KSP
- Verificar que `ksp` plugin esté aplicado
- Verificar versión de Kotlin compatible con KSP
- Limpiar: `./gradlew clean`
- Invalidar caches: borrar `build/` y `.gradle/`

### Error de Firebase / google-services
- El plugin `google.services` usa `MissingGoogleServicesStrategy.WARN`
- Si no hay `google-services.json`, el build continúa con warning
- Para Firebase completo, añadir `google-services.json` en `app/`

---

## 12. Limitaciones conocidas

- **No hay OTA para Android**: las actualizaciones son manuales (APK) o via Play Store
- **Room exportSchema = false**: no se exportan esquemas JSON (no se puede validar migraciones automáticamente)
- **No hay tests de integración**: los tests existentes son unitarios (Robolectric) y screenshot (Roborazzi)
- **El POS no genera QR visualmente**: usa `zxing.core` para generar la matriz, pero la UI la renderiza con Compose
- **No hay cifrado de la BD Room**: las credenciales se almacenan en texto plano en Room (la clave privada Ed25519 en hex). Para mayor seguridad, considerar SQLCipher.
- **El NFC es `required="false"`**: la app funciona sin NFC (modo QR), pero los pagos NFC no estarán disponibles
