# 07 — Sistema de Formato Configurable

> **Proyecto:** Red de Intercambio Federada / Sistema TQ
> **Componente:** POS Android (`punto-de-venta-pos/`)
> **Archivos clave:**
> - `app/src/main/java/com/example/ui/util/Formatters.kt` (FormatConfig, CurrencyHelper)
> - `app/src/main/java/com/example/data/db/AppDatabase.kt` (TerminalConfigEntity, MIGRATION_2_3)
> - `app/src/main/java/com/example/data/api/PosApiModels.kt` (FormatSettings, TerminalAuthResponse)
> - `app/src/main/java/com/example/data/repository/PosRepository.kt` (authenticateTerminal)
> - `app/src/main/java/com/example/MainActivity.kt` (Room database builder)

---

## 1. Visión General

El POS Android implementa un sistema de formato configurable controlado por el **servidor como fuente de verdad**. Las preferencias de formato (locale, formato de números, fechas, horas, zona horaria) se reciben del servidor durante la autenticación del terminal, se persisten en Room, y se cargan en memoria al inicio para que todos los formateadores de la UI sean locale-aware.

```
┌─────────────────────────────────────────────────────┐
│                    Servidor (Backend)                │
│                                                      │
│  user_preferences table (migration 132)              │
│  GET/PUT /api/me/preferences                         │
│  format_settings en /api/config y /auth/me           │
│  format_settings en terminal auth response           │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ POST /api/nfc/terminal/auth
                       │ Response: { session_token, format_settings }
                       ▼
┌─────────────────────────────────────────────────────┐
│                    POS Android                       │
│                                                      │
│  TerminalAuthResponse.formatSettings                 │
│         │                                            │
│         ▼                                            │
│  TerminalConfigEntity (Room)                         │
│    fmtLocale, fmtNumberLocale, fmtDateFormat,        │
│    fmtTimeFormat, fmtFirstDayOfWeek, fmtTimezone     │
│         │                                            │
│         ▼                                            │
│  FormatConfig.updateFromEntity()                     │
│    (objeto singleton en memoria)                     │
│         │                                            │
│         ▼                                            │
│  CurrencyHelper.formatMicroUnits()                   │
│  CurrencyHelper.formatDateTime()                     │
│  CurrencyHelper.formatDate() / formatTime()          │
└─────────────────────────────────────────────────────┘
```

---

## 2. Modelo FormatSettings

### 2.1. Definición en el backend (servidor)

El servidor expone `format_settings` como un objeto JSON con 6 campos. La tabla `user_preferences` (migration 132 del backend) almacena estas preferencias por usuario.

### 2.2. Definición en Android (PosApiModels.kt)

**Archivo:** `PosApiModels.kt` líneas 138-146

```kotlin
@JsonClass(generateAdapter = true)
data class FormatSettings(
    @Json(name = "locale") val locale: String? = null,
    @Json(name = "number_locale") val numberLocale: String? = null,
    @Json(name = "date_format") val dateFormat: String? = null,
    @Json(name = "time_format") val timeFormat: String? = null,
    @Json(name = "first_day_of_week") val firstDayOfWeek: Int? = null,
    @Json(name = "timezone") val timezone: String? = null
)
```

Todos los campos son **nullable** — el servidor puede enviar solo los campos que el usuario ha personalizado, y el POS mantiene los defaults para los campos ausentes.

### 2.3. Campos y Valores

| Campo | Tipo | Valores posibles | Default |
|-------|------|------------------|---------|
| `locale` | String | `es`, `en`, `pt`, `fr`, ... | `es` |
| `number_locale` | String | `es-VE`, `en-US`, `pt-BR`, ... | `es-VE` |
| `date_format` | String | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` | `DD/MM/YYYY` |
| `time_format` | String | `24h`, `12h` | `24h` |
| `first_day_of_week` | Int | `0` = Domingo, `1` = Lunes | `1` |
| `timezone` | String | IANA timezone (ej: `America/Caracas`) | `America/Caracas` |

### 2.4. Defaults del sistema

Los defaults están pensados para Venezuela (`es-VE`, `America/Caracas`, formato de fecha europeo, 24h, lunes como primer día de la semana).

---

## 3. Precedencia de Configuración

La precedencia de las preferencias de formato es:

```
1. Preferencias del usuario (user_preferences en backend)
   ↓ (si no hay preferencia del usuario)
2. Defaults del nodo (configuración del nodo federado)
   ↓ (si no hay default del nodo)
3. Defaults del sistema (hardcoded en Android)
```

**En la práctica:**
- El backend resuelve la precedencia `usuario > nodo > sistema` y envía el resultado final en `format_settings`.
- Android recibe el resultado ya resuelto y lo aplica. Si un campo es `null` en la respuesta, Android mantiene el valor anterior (o el default si es la primera vez).

---

## 4. Backend: Endpoints y Integración

### 4.1. Tabla user_preferences (migration 132)

El backend tiene una tabla `user_preferences` que almacena las preferencias por usuario. Esta tabla se creó en la migration 132 del backend.

### 4.2. Endpoints del backend

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/me/preferences` | `GET` | Obtiene las preferencias del usuario autenticado |
| `/api/me/preferences` | `PUT` | Actualiza las preferencias del usuario autenticado |
| `/api/config` | `GET` | Configuración del nodo (incluye `format_settings`) |
| `/auth/me` | `GET` | Datos del usuario autenticado (incluye `format_settings`) |
| `/api/nfc/terminal/auth` | `POST` | Autenticación del terminal (response incluye `format_settings`) |

### 4.3. format_settings en la respuesta de autenticación del terminal

**Archivo:** `PosApiModels.kt` líneas 148-154

```kotlin
@JsonClass(generateAdapter = true)
data class TerminalAuthResponse(
    @Json(name = "session_token") val sessionToken: String? = null,
    @Json(name = "signature") val signature: String? = null,
    @Json(name = "format_settings") val formatSettings: FormatSettings? = null,
    @Json(name = "error") val error: String? = null
)
```

El campo `format_settings` está presente en la respuesta de autenticación del terminal. Es el mecanismo principal por el cual el POS recibe su configuración de formato.

---

## 5. Android: FormatConfig (Objeto Singleton en Memoria)

### 5.1. Definición

**Archivo:** `Formatters.kt` líneas 33-49

```kotlin
object FormatConfig {
    var locale: String = "es"
    var numberLocale: String = "es-VE"
    var dateFormat: String = "DD/MM/YYYY"
    var timeFormat: String = "24h"
    var firstDayOfWeek: Int = 1
    var timezone: String = "America/Caracas"

    fun updateFromEntity(config: TerminalConfigEntity) {
        locale = config.fmtLocale
        numberLocale = config.fmtNumberLocale
        dateFormat = config.fmtDateFormat
        timeFormat = config.fmtTimeFormat
        firstDayOfWeek = config.fmtFirstDayOfWeek
        timezone = config.fmtTimezone
    }
}
```

**Características:**
- Es un `object` (singleton) — una sola instancia en memoria durante toda la vida de la app.
- Los campos son `var` (mutables) — se actualizan cuando llega nueva configuración del servidor.
- Los defaults coinciden con los de `TerminalConfigEntity`.
- `updateFromEntity()` copia los 6 campos desde la entidad de Room al singleton.

### 5.2. Cuándo se llama updateFromEntity()

Se llama en `PosRepository.authenticateTerminal()` después de persistir la configuración actualizada:

```kotlin
// PosRepository.kt líneas 188-205
val fs = body.formatSettings
val updated = if (fs != null) {
    config.copy(
        sessionToken = sessionToken,
        fmtLocale = fs.locale ?: config.fmtLocale,
        fmtNumberLocale = fs.numberLocale ?: config.fmtNumberLocale,
        fmtDateFormat = fs.dateFormat ?: config.fmtDateFormat,
        fmtTimeFormat = fs.timeFormat ?: config.fmtTimeFormat,
        fmtFirstDayOfWeek = fs.firstDayOfWeek ?: config.fmtFirstDayOfWeek,
        fmtTimezone = fs.timezone ?: config.fmtTimezone
    )
} else {
    config.copy(sessionToken = sessionToken)
}
saveConfigSecure(updated)

// Actualizar el FormatConfig en memoria
FormatConfig.updateFromEntity(updated)
```

**Lógica de merge:** Si un campo de `FormatSettings` es `null`, se mantiene el valor existente en `config`. Esto significa que el servidor puede enviar solo los campos que cambiaron.

---

## 6. Android: TerminalConfigEntity (Persistencia en Room)

### 6.1. Campos fmt en la entidad

**Archivo:** `AppDatabase.kt` líneas 43-62

```kotlin
@Entity(tableName = "terminal_config")
data class TerminalConfigEntity(
    @PrimaryKey val id: Int = 1,
    val serverUrl: String = "https://feria.loanstly.com/demo",
    val terminalId: String = "TERM-POS-001",
    val label: String = "Terminal Kiosco POS",
    val isRegistered: Boolean = false,
    val terminalPrivateKeyHex: String = "",
    val terminalPublicKeyHex: String = "",
    val serverPublicKeyHex: String? = null,
    val sessionToken: String? = null,
    val isMultiVendorEnabled: Boolean = false,
    // Format settings (received from server)
    val fmtLocale: String = "es",
    val fmtNumberLocale: String = "es-VE",
    val fmtDateFormat: String = "DD/MM/YYYY",
    val fmtTimeFormat: String = "24h",
    val fmtFirstDayOfWeek: Int = 1,
    val fmtTimezone: String = "America/Caracas"
)
```

Los 6 campos `fmt*` se almacenan en la tabla `terminal_config` junto con las credenciales del terminal. Tienen valores default que coinciden con los defaults del sistema.

### 6.2. Recepción durante la autenticación del terminal

Durante `authenticateTerminal()` en `PosRepository`, los `format_settings` de la respuesta se mapean a los campos `fmt*` de `TerminalConfigEntity`:

```kotlin
val updated = config.copy(
    fmtLocale = fs.locale ?: config.fmtLocale,
    fmtNumberLocale = fs.numberLocale ?: config.fmtNumberLocale,
    fmtDateFormat = fs.dateFormat ?: config.fmtDateFormat,
    fmtTimeFormat = fs.timeFormat ?: config.fmtTimeFormat,
    fmtFirstDayOfWeek = fs.firstDayOfWeek ?: config.fmtFirstDayOfWeek,
    fmtTimezone = fs.timezone ?: config.fmtTimezone
)
saveConfigSecure(updated)
FormatConfig.updateFromEntity(updated)
```

### 6.3. Carga al inicio

Al iniciar la app, `FormatConfig.updateFromEntity()` se llama con la configuración persistida en Room. Esto asegura que los formateadores usen la última configuración recibida del servidor, incluso antes de una nueva autenticación.

---

## 7. Migración de Base de Datos: MIGRATION_2_3

### 7.1. Problema

La versión 2 de la base de datos no tenía los campos `fmt*`. La versión 3 los añade. Sin una migración explícita, Room ejecutaría `fallbackToDestructiveMigration()`, que **destruye toda la base de datos** y la recrea desde cero.

### 7.2. Solución: MIGRATION_2_3

**Archivo:** `AppDatabase.kt` líneas 124-137

```kotlin
// Migracion de v2 a v3: anade columnas de formato SIN perder datos existentes.
// Esto preserva las credenciales del terminal (terminalId, privateKey, sessionToken, etc.)
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // ALTER TABLE ADD COLUMN conserva todas las filas existentes.
        // Los defaults coinciden con los de TerminalConfigEntity.
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtLocale TEXT NOT NULL DEFAULT 'es'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtNumberLocale TEXT NOT NULL DEFAULT 'es-VE'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtDateFormat TEXT NOT NULL DEFAULT 'DD/MM/YYYY'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimeFormat TEXT NOT NULL DEFAULT '24h'")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtFirstDayOfWeek INTEGER NOT NULL DEFAULT 1")
        database.execSQL("ALTER TABLE terminal_config ADD COLUMN fmtTimezone TEXT NOT NULL DEFAULT 'America/Caracas'")
    }
}
```

### 7.3. Características de la migración

- **No destructiva:** Usa `ALTER TABLE ADD COLUMN`, que preserva todas las filas existentes.
- **Defaults consistentes:** Los `DEFAULT` de cada columna coinciden con los defaults de `TerminalConfigEntity`.
- **Preserva credenciales:** El `terminalId`, `terminalPrivateKeyHex`, `terminalPublicKeyHex`, `serverPublicKeyHex`, `sessionToken` y todos los demás campos existentes se mantienen intactos.

### 7.4. Registro de la migración en Room

**Archivo:** `MainActivity.kt` líneas 48-57

```kotlin
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
```

### 7.5. ⚠️ CRÍTICO: fallbackToDestructiveMigration()

> **NUNCA usar `fallbackToDestructiveMigration()` sin migraciones explícitas.**

`fallbackToDestructiveMigration()` elimina **toda la base de datos** y la recrea desde cero. Esto borra:
- `terminalId` — el terminal pierde su identidad
- `terminalPrivateKeyHex` — pierde su clave privada Ed25519
- `terminalPublicKeyHex` — pierde su clave pública
- `serverPublicKeyHex` — pierde la clave pública del servidor
- `sessionToken` — pierde la sesión activa
- Todas las transacciones históricas
- Todos los turnos
- El PIN del turno

**Esto causó un bug real:** Los teléfonos tenían que re-registrarse después de cada actualización de la app porque `fallbackToDestructiveMigration()` destruía las credenciales del terminal.

**Patrón correcto:**

```kotlin
Room.databaseBuilder(context, AppDatabase::class.java, "pos_terminal_db.db")
    .addMigrations(MIGRATION_2_3)           // ← migración explícita primero
    .fallbackToDestructiveMigration()        // ← fallback SOLO para migraciones futuras no previstas
    .build()
```

La migración explícita se ejecuta primero. El fallback solo se activa si hay una migración futura (v3 → v4) que no tiene un objeto `Migration` definido. En ese caso, es preferible destruir la DB a que la app crashee, pero **siempre** se debe escribir la migración explícita para preservar los datos del usuario.

---

## 8. CurrencyHelper: Formateo Locale-Aware

### 8.1. formatMicroUnits()

**Archivo:** `Formatters.kt` líneas 55-63

```kotlin
fun formatMicroUnits(microUnits: Long): String {
    val locale = parseLocale(FormatConfig.numberLocale)
    val formatter = NumberFormat.getNumberInstance(locale).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }
    val amount = microUnits / 100.0
    return "${formatter.format(amount)} TQ"
}
```

**Comportamiento según `numberLocale`:**

| `numberLocale` | `microUnits = 50000` | Resultado |
|----------------|---------------------|-----------|
| `es-VE` | 50000 | `500,00 TQ` |
| `en-US` | 50000 | `500.00 TQ` |
| `pt-BR` | 50000 | `500,00 TQ` |
| `de-DE` | 50000 | `500,00 TQ` |

Usa `FormatConfig.numberLocale` para obtener el `Locale` y `NumberFormat.getNumberInstance(locale)` para el formateo. Los micro-units (enteros) se dividen entre 100 para obtener el valor decimal en TQ.

### 8.2. parseInputToMicroUnits()

**Archivo:** `Formatters.kt` líneas 75-79

```kotlin
fun parseInputToMicroUnits(input: String): Long {
    val clean = input.replace(Regex("[^0-9]"), "").trim()
    if (clean.isEmpty()) return 0L
    return clean.toLongOrNull() ?: 0L
}
```

Convierte la entrada del teclado numérico del POS a micro-units. El input representa **centimos directamente**:
- `"1"` → 1 centimo → 0.01 TQ → 1 micro-unit
- `"100"` → 100 centimos → 1.00 TQ → 100 micro-units
- `"12345"` → 123.45 TQ → 12345 micro-units

Este comportamiento es independiente del locale (siempre entrada numérica directa).

### 8.3. parseLocale()

**Archivo:** `Formatters.kt` líneas 124-127

```kotlin
private fun parseLocale(localeStr: String): Locale {
    val parts = localeStr.split("-")
    return if (parts.size >= 2) Locale(parts[0], parts[1]) else Locale(parts[0])
}
```

Convierte un string de locale (`es-VE`, `en-US`) a un objeto `java.util.Locale`.

---

## 9. Formateo de Fechas y Horas

### 9.1. formatDateTime()

**Archivo:** `Formatters.kt` líneas 81-87

```kotlin
fun formatDateTime(timestamp: Long): String {
    val d = Date(timestamp)
    val pattern = buildDateTimePattern(FormatConfig.dateFormat, FormatConfig.timeFormat)
    val locale = parseLocale(FormatConfig.locale)
    val sdf = SimpleDateFormat(pattern, locale)
    return sdf.format(d)
}
```

### 9.2. formatDate() y formatTime()

```kotlin
fun formatDate(timestamp: Long): String {
    val d = Date(timestamp)
    val pattern = buildDatePattern(FormatConfig.dateFormat)
    val locale = parseLocale(FormatConfig.locale)
    val sdf = SimpleDateFormat(pattern, locale)
    return sdf.format(d)
}

fun formatTime(timestamp: Long): String {
    val d = Date(timestamp)
    val pattern = buildTimePattern(FormatConfig.timeFormat)
    val locale = parseLocale(FormatConfig.locale)
    val sdf = SimpleDateFormat(pattern, locale)
    return sdf.format(d)
}
```

### 9.3. Construcción de patrones

**Archivo:** `Formatters.kt` líneas 105-122

```kotlin
private fun buildDatePattern(format: String): String {
    return when (format) {
        "MM/DD/YYYY" -> "MM/dd/yyyy"
        "YYYY-MM-DD" -> "yyyy-MM-dd"
        else -> "dd/MM/yyyy"  // DD/MM/YYYY (default)
    }
}

private fun buildTimePattern(format: String): String {
    return when (format) {
        "12h" -> "hh:mm a"
        else -> "HH:mm"  // 24h (default)
    }
}

private fun buildDateTimePattern(dateFormat: String, timeFormat: String): String {
    return "${buildDatePattern(dateFormat)} ${buildTimePattern(timeFormat)}"
}
```

### 9.4. Ejemplos de formateo

| `dateFormat` | `timeFormat` | `locale` | `timestamp = 1700000000000` | Resultado |
|--------------|--------------|----------|---------------------------|-----------|
| `DD/MM/YYYY` | `24h` | `es` | | `15/11/2023 06:13` |
| `MM/DD/YYYY` | `12h` | `en` | | `11/15/2023 06:13 AM` |
| `YYYY-MM-DD` | `24h` | `es` | | `2023-11-15 06:13` |

---

## 10. Flujo Completo: Servidor → Room → FormatConfig → UI

```
1. Terminal envía POST /api/nfc/terminal/auth
   con firma Ed25519

2. Servidor responde:
   {
     "session_token": "abc123...",
     "format_settings": {
       "locale": "en",
       "number_locale": "en-US",
       "date_format": "MM/DD/YYYY",
       "time_format": "12h",
       "first_day_of_week": 0,
       "timezone": "America/New_York"
     }
   }

3. PosRepository.authenticateTerminal():
   - Merge: fs.locale ?: config.fmtLocale  →  "en"
   - Merge: fs.numberLocale ?: config.fmtNumberLocale  →  "en-US"
   - ... (para los 6 campos)
   - saveConfigSecure(updated)  →  persistir en Room
   - FormatConfig.updateFromEntity(updated)  →  actualizar memoria

4. UI usa FormatConfig:
   - CurrencyHelper.formatMicroUnits(50000)
     → NumberFormat.getInstance(Locale("en", "US"))
     → "500.00 TQ"

   - CurrencyHelper.formatDateTime(timestamp)
     → SimpleDateFormat("MM/dd/yyyy hh:mm a", Locale("en"))
     → "11/15/2023 06:13 AM"
```

---

## 11. Versión de la Base de Datos

**Archivo:** `AppDatabase.kt` líneas 139-143

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

- **Versión actual:** 3
- **Entidades:** 4 (`pos_transactions`, `pos_shifts`, `terminal_config`, `shift_pin`)
- `exportSchema = false` — no exporta el esquema JSON (no se usa para migraciones automáticas).

---

## 12. Resumen de Campos y Defaults

| Campo FormatSettings | Campo TerminalConfigEntity | Campo FormatConfig | Default |
|----------------------|---------------------------|-------------------|---------|
| `locale` | `fmtLocale` | `locale` | `es` |
| `number_locale` | `fmtNumberLocale` | `numberLocale` | `es-VE` |
| `date_format` | `fmtDateFormat` | `dateFormat` | `DD/MM/YYYY` |
| `time_format` | `fmtTimeFormat` | `timeFormat` | `24h` |
| `first_day_of_week` | `fmtFirstDayOfWeek` | `firstDayOfWeek` | `1` |
| `timezone` | `fmtTimezone` | `timezone` | `America/Caracas` |

**Mapeo JSON → Kotlin:**

```
format_settings.locale           → fmtLocale           → FormatConfig.locale
format_settings.number_locale    → fmtNumberLocale     → FormatConfig.numberLocale
format_settings.date_format      → fmtDateFormat       → FormatConfig.dateFormat
format_settings.time_format      → fmtTimeFormat       → FormatConfig.timeFormat
format_settings.first_day_of_week → fmtFirstDayOfWeek  → FormatConfig.firstDayOfWeek
format_settings.timezone         → fmtTimezone         → FormatConfig.timezone
```
