# Guia: Como agregar una nueva tarjeta NFC al sistema modular

## Resumen

El sistema NFC usa una arquitectura modular de drivers. Cada tipo de tarjeta es
un modulo independiente que se auto-registra. **Agregar una nueva tarjeta no
requiere modificar codigo existente** — solo se agregan archivos nuevos.

Esta guia explica paso a paso como agregar una nueva tarjeta, usando como
ejemplo una tarjeta ficticia "MIFARE Plus X" (tipo `mifare_plus_x`).

---

## Arquitectura del sistema

```
docs/card-drivers/{tipo}.json              ← Manifiesto (capacidades, specs)
internal/payments/cards/{tipo}_driver.go   ← Driver Go (logica del servidor)
internal/db/migrations/NNN_{tipo}.sql      ← Migracion DB (tablas, columnas)
punto-de-venta-pos/.../data/nfc/{Tipo}Reader.kt  ← Reader Android (lectura/escritura fisica)
punto-de-venta-pos/.../data/api/PosApiModels.kt  ← Modelos API (Kotlin)
punto-de-venta-pos/.../data/api/PosApiService.kt ← Endpoints API (Kotlin)
punto-de-venta-pos/.../data/repository/PosRepository.kt ← Metodos del repositorio
internal/api/nfc_terminal.go               ← Handlers HTTP (Go)
internal/payments/nfc_terminal.go          ← Helpers en NFCTerminals (Go)
```

### Flujo de una transaccion

```
1. POS busca usuario → servidor responde con card_type
2. POS pide PIN (+ documento si RequiresDocument)
3. POS envia pre-auth encriptada al servidor
4. Servidor verifica usuario, PIN, saldo → genera nuevo certificado
5. Servidor guarda pre-aprobacion (TTL 30s) → responde con datos encriptados
6. POS lee certificado activo de la tarjeta fisica
7. POS escribe nuevo certificado en la tarjeta fisica
8. POS verifica escritura re-leyendo el slot
9. POS envia confirmacion (read_ok, write_ok, written_pages) al servidor
10. Servidor procesa pago solo si read_ok AND write_ok
11. Servidor rota slots activos/backups
12. Servidor responde con resultado del pago
```

---

## Paso 1: Crear el manifiesto JSON

**Archivo:** `docs/card-drivers/mifare_plus_x.json`

El manifiesto describe las capacidades de la tarjeta. Es la fuente de verdad
que el servidor y el POS consultan para saber como tratar la tarjeta.

```json
{
  "type": "mifare_plus_x",
  "display_name": "MIFARE Plus X",
  "description": "Tarjeta NFC con AES-128, migracion desde Classic. EAL4+.",
  "manufacturer": "NXP Semiconductors",
  "capacity": "full",
  "memory": {
    "total_bytes": 4096,
    "user_bytes": 4000,
    "page_size": 4,
    "total_pages": 1024,
    "user_pages": 1000
  },
  "security": {
    "level": "aes",
    "algorithm": "AES-128",
    "key_length_bits": 128,
    "key_count": 1,
    "mutual_auth": true,
    "secure_messaging": true,
    "crypto_per_slot": false,
    "originality_signature": true,
    "notes": "AES-128 real. No necesita certificados rotativos."
  },
  "compatibility": {
    "android": "full",
    "ios": "full",
    "esp32_pn532": "full",
    "phone_reader": true,
    "nfc_forum_type": 4,
    "notes": "Universal — funciona en todos los telefonos"
  },
  "protocol": {
    "slots": 0,
    "active_slots": 0,
    "backup_slots": 0,
    "certificate_size": 16,
    "auth_method": "AES-128_mutual",
    "rotation": "none",
    "pre_auth_ttl_seconds": 30,
    "notes": "No usa certificados rotativos. AES-128 es suficiente."
  },
  "availability": {
    "venezuela": false,
    "price_usd": 1.20,
    "notes": "Dificil de conseguir en Venezuela."
  },
  "endpoints": {
    "provision": "/api/nfc/cards/provision-mifare-plus-x",
    "pre_auth": "/api/nfc/terminal/mifare-plus-x/pre-auth",
    "confirm": "/api/nfc/terminal/mifare-plus-x/confirm"
  },
  "docs": [
    "docs/tarjeta-mifare-plus-x-protocolo.md"
  ],
  "status": ""
}
```

### Campos del manifiesto

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `type` | string | Identificador unico (ej. `ntag215`, `mifare_plus_x`) |
| `display_name` | string | Nombre para mostrar en UI |
| `description` | string | Descripcion breve |
| `manufacturer` | string | Fabricante |
| `capacity` | string | `"full"` o `"low"` (baja capacidad como Ultralight C) |
| `memory` | object | Specs de memoria (bytes, paginas, sectores) |
| `security` | object | Modelo de seguridad (algoritmo, clave, auth mutua) |
| `compatibility` | object | Compatibilidad Android/iOS/ESP32 |
| `protocol` | object | Protocolo de certificados (slots, rotacion, TTL) |
| `availability` | object | Disponibilidad en Venezuela, precio |
| `endpoints` | object | URLs de los endpoints API |
| `docs` | array | Documentos relacionados |
| `status` | string | `""` = activo, `"future"` = futuro/no implementado |

---

## Paso 2: Crear el driver Go

**Archivo:** `internal/payments/cards/mifare_plus_x_driver.go`

El driver implementa la interfaz `CardDriver` y se auto-registra en `init()`.

```go
package cards

import (
    "context"
    "fmt"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5/pgxpool"
)

// MifarePlusXDriver implementa el protocolo para MIFARE Plus X.
type MifarePlusXDriver struct {
    manifest CardManifest
}

// Auto-registro: el driver se registra solo al importar el paquete.
func init() {
    Register(&MifarePlusXDriver{
        manifest: CardManifest{
            Type:         "mifare_plus_x",
            DisplayName:  "MIFARE Plus X",
            Description:  "Tarjeta NFC con AES-128.",
            Manufacturer: "NXP Semiconductors",
            Capacity:     "full",
            // ... llenar todos los campos del manifiesto aqui
            // (deben coincidir con docs/card-drivers/mifare_plus_x.json)
        },
    })
}

func (d *MifarePlusXDriver) GetType() string          { return "mifare_plus_x" }
func (d *MifarePlusXDriver) GetManifest() CardManifest { return d.manifest }
func (d *MifarePlusXDriver) RequiresDocument() bool   { return false }

// Provision registra la tarjeta en el servidor.
func (d *MifarePlusXDriver) Provision(
    ctx context.Context,
    pool *pgxpool.Pool,
    nodeDomain string,
    userID uuid.UUID,
    cardUID, initialPIN string,
) (*ProvisionResponse, error) {
    // 1. Hashear PIN con bcrypt
    // 2. Generar clave AES-128 (16 bytes) con crypto/rand
    // 3. Generar custom_card_id (8 bytes) aleatorio
    // 4. INSERT en nfc_cards con card_type = 'mifare_plus_x'
    // 5. Generar slots si el protocolo usa certificados rotativos
    // 6. Retornar ProvisionResponse con los datos para el POS
    return nil, fmt.Errorf("MIFARE Plus X provision no implementado aun")
}

// PreAuth valida usuario + PIN + saldo y prepara la transaccion.
func (d *MifarePlusXDriver) PreAuth(
    ctx context.Context,
    pool *pgxpool.Pool,
    nodeDomain, terminalID string,
    userID uuid.UUID,
    amount int64,
) (*PreAuthResponse, error) {
    // 1. Buscar tarjeta activa del usuario
    // 2. Verificar saldo (balance - amount >= credit_limit)
    // 3. Generar nuevo certificado con crypto/rand
    // 4. Elegir slot de escritura aleatorio
    // 5. INSERT en tabla pending con TTL 30s
    // 6. Retornar PreAuthResponse con datos encriptados para el POS
    return nil, fmt.Errorf("MIFARE Plus X pre-auth no implementado aun")
}

// Confirm confirma la lectura/escritura y procesa el pago.
func (d *MifarePlusXDriver) Confirm(
    ctx context.Context,
    pool *pgxpool.Pool,
    nodeDomain, terminalID, cardUID string,
    confirmData ConfirmData,
) (*NFCPaymentResult, error) {
    // 1. Buscar pre-aprobacion pendiente (no expirada)
    // 2. Si !ReadOK o !WriteOK → rechazar y borrar pending
    // 3. Debitar balance del usuario
    // 4. Rotar slots (desactivar leido, activar escrito, actualizar backup)
    // 5. Borrar pending
    // 6. Log transaccion
    // 7. Retornar NFCPaymentResult con nuevo balance
    return nil, fmt.Errorf("MIFARE Plus X confirm no implementado aun")
}

// CleanupExpired borra pre-aprobaciones expiradas.
func (d *MifarePlusXDriver) CleanupExpired(
    ctx context.Context,
    pool *pgxpool.Pool,
    nodeDomain string,
) error {
    _, err := pool.Exec(ctx,
        `DELETE FROM nfc_mifare_plus_x_pending WHERE expires_at < NOW()`)
    return err
}
```

### Interfaz CardDriver

```go
type CardDriver interface {
    GetType() string
    GetManifest() CardManifest
    RequiresDocument() bool
    Provision(ctx, pool, nodeDomain, userID, cardUID, initialPIN) (*ProvisionResponse, error)
    PreAuth(ctx, pool, nodeDomain, terminalID, userID, amount) (*PreAuthResponse, error)
    Confirm(ctx, pool, nodeDomain, terminalID, cardUID, confirmData) (*NFCPaymentResult, error)
    CleanupExpired(ctx, pool, nodeDomain) error
}
```

### Reglas criticas del driver

1. **NUNCA procesar el pago si `ReadOK` o `WriteOK` son false**
2. Usar `crypto/rand` para generar certificados (no `math/rand`)
3. Usar `bcrypt` para hashear el PIN
4. El TTL de pre-aprobacion debe ser 30 segundos
5. Guardar claves/secrets encriptados (no plaintext)
6. Logear cada transaccion en `nfc_transactions`

---

## Paso 3: Crear la migracion DB

**Archivo:** `internal/db/migrations/NNN_mifare_plus_x.sql`

El numero debe ser el siguiente disponible (ver el ultimo archivo en
`internal/db/migrations/`).

```sql
-- Migracion NNN: Soporte para MIFARE Plus X
--
-- MIFARE Plus X:
--   - 4096 bytes de memoria
--   - AES-128 con auth mutua
--   - No necesita certificados rotativos (AES es suficiente)
--   - Compatible con todos los telefonos

-- Columna para guardar la clave AES encriptada
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS mifare_plus_x_key_encrypted BYTEA;

-- Si el protocolo usa certificados rotativos, crear tabla de slots:
CREATE TABLE IF NOT EXISTS nfc_mifare_plus_x_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    slot_number INT NOT NULL,
    is_backup BOOLEAN NOT NULL DEFAULT false,
    backup_of_slot INT,
    start_page INT NOT NULL,
    end_page INT NOT NULL,
    certificate BYTEA,
    is_active BOOLEAN NOT NULL DEFAULT false,
    written_pages INT NOT NULL DEFAULT 0,
    needs_repair BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_uid, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_nfc_mifare_plus_x_slots_uid
    ON nfc_mifare_plus_x_slots(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_mifare_plus_x_slots_active
    ON nfc_mifare_plus_x_slots(card_uid, is_active) WHERE is_active = true;

-- Tabla de pre-aprobaciones pendientes (TTL 30s)
CREATE TABLE IF NOT EXISTS nfc_mifare_plus_x_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    read_slot INT NOT NULL,
    write_slot INT NOT NULL,
    backup_slot INT NOT NULL,
    new_certificate BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_mifare_plus_x_pending_card
    ON nfc_mifare_plus_x_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_mifare_plus_x_pending_expiry
    ON nfc_mifare_plus_x_pending(expires_at);
```

### Convenciones de nombres

| Concepto | Patron | Ejemplo |
|----------|--------|---------|
| Tabla de slots | `nfc_{tipo}_slots` | `nfc_ntag215_slots` |
| Tabla de pending | `nfc_{tipo}_pending` | `nfc_ntag215_pending` |
| Columna de clave | `{tipo}_key_encrypted` | `ntag215_pwd_encrypted` |
| Indice | `idx_nfc_{tipo}_{concepto}` | `idx_nfc_ntag215_slots_uid` |

---

## Paso 4: Agregar helpers en NFCTerminals

**Archivo:** `internal/payments/nfc_terminal.go`

Agregar metodos helper al final del archivo para que los handlers API puedan
llamar al driver:

```go
// ProvisionMifarePlusXCard delega al driver MIFARE Plus X.
func (nt *NFCTerminals) ProvisionMifarePlusXCard(
    ctx context.Context,
    userID uuid.UUID,
    cardUID, initialPIN string,
) (interface{}, error) {
    return cards.ProvisionMifarePlusX(ctx, nt.Pool, nt.NodeDomain, userID, cardUID, initialPIN)
}

// MifarePlusXPreAuth delega al driver.
func (nt *NFCTerminals) MifarePlusXPreAuth(
    ctx context.Context,
    terminalID string,
    userID uuid.UUID,
    amount int64,
) (interface{}, error) {
    return cards.MifarePlusXPreAuth(ctx, nt.Pool, nt.NodeDomain, terminalID, userID, amount)
}

// MifarePlusXConfirm delega al driver.
func (nt *NFCTerminals) MifarePlusXConfirm(
    ctx context.Context,
    terminalID, cardUID string,
    readOK, writeOK bool,
    writtenPages int,
) (*cards.NFCPaymentResult, error) {
    return cards.MifarePlusXConfirm(ctx, nt.Pool, nt.NodeDomain, terminalID, cardUID,
        cards.ConfirmData{ReadOK: readOK, WriteOK: writeOK, WrittenPages: writtenPages})
}
```

Tambien agregar funciones de conveniencia en `driver.go`:

```go
func ProvisionMifarePlusX(ctx context.Context, pool *pgxpool.Pool, nodeDomain string,
    userID uuid.UUID, cardUID, initialPIN string) (*ProvisionResponse, error) {
    d, err := GetDriver("mifare_plus_x")
    if err != nil {
        return nil, err
    }
    return d.Provision(ctx, pool, nodeDomain, userID, cardUID, initialPIN)
}

func MifarePlusXPreAuth(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID string,
    userID uuid.UUID, amount int64) (*PreAuthResponse, error) {
    d, err := GetDriver("mifare_plus_x")
    if err != nil {
        return nil, err
    }
    return d.PreAuth(ctx, pool, nodeDomain, terminalID, userID, amount)
}

func MifarePlusXConfirm(ctx context.Context, pool *pgxpool.Pool, nodeDomain, terminalID, cardUID string,
    confirmData ConfirmData) (*NFCPaymentResult, error) {
    d, err := GetDriver("mifare_plus_x")
    if err != nil {
        return nil, err
    }
    return d.Confirm(ctx, pool, nodeDomain, terminalID, cardUID, confirmData)
}
```

---

## Paso 5: Agregar handlers HTTP

**Archivo:** `internal/api/nfc_terminal.go`

### 5a. Registrar rutas

```go
// MIFARE Plus X (terminal-facing, Ed25519 auth)
r.Post("/api/nfc/terminal/mifare-plus-x/pre-auth", h.mifarePlusXPreAuth)
r.Post("/api/nfc/terminal/mifare-plus-x/pre-auth-document", h.mifarePlusXPreAuthWithDocument)
r.Post("/api/nfc/terminal/mifare-plus-x/confirm", h.mifarePlusXConfirm)

// Provisionamiento
r.With(am.RequirePermission("nfc.issue_card")).Post(
    "/api/nfc/cards/provision-mifare-plus-x", h.provisionMifarePlusXCard)
```

### 5b. Implementar handlers

Cada handler sigue el mismo patron:
1. Decodificar `EncryptedPaymentRequest`
2. Desencriptar con `DecodePayload`
3. Parsear el payload
4. Validar campos
5. Buscar usuario / tarjeta / verificar PIN
6. Llamar al driver
7. Encriptar respuesta con `EncodeResponseWithSharedKey`

```go
func (h *NFCTerminalHandler) mifarePlusXPreAuth(w http.ResponseWriter, r *http.Request) {
    var req ProcessPaymentRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, 400, "invalid request body")
        return
    }

    plaintext, sharedKey, err := h.NFC.DecodePayload(r.Context(), req.TerminalID, req.EncryptedPayload)
    if err != nil {
        writeError(w, 400, err.Error())
        return
    }

    var payload struct {
        TerminalID string `json:"terminal_id"`
        Username   string `json:"username"`
        PIN        string `json:"pin"`
        Amount     int64  `json:"amount"`
    }
    if err := json.Unmarshal(plaintext, &payload); err != nil {
        writeError(w, 400, "invalid payload format")
        return
    }

    // Buscar usuario, verificar PIN, llamar al driver...
    // (ver ntag215PreAuth como ejemplo completo)

    respBytes, _ := json.Marshal(resp)
    encResp, err := h.NFC.EncodeResponseWithSharedKey(r.Context(), payload.TerminalID, respBytes, sharedKey)
    if err != nil {
        writeError(w, 500, err.Error())
        return
    }
    writeJSON(w, 200, encResp)
}
```

---

## Paso 6: Crear el reader Android (Kotlin)

**Archivo:** `punto-de-venta-pos/app/src/main/java/com/example/data/nfc/MifarePlusXReader.kt`

El reader implementa la interfaz `CardReader` y maneja la lectura/escritura
fisica de la tarjeta via Android NFC APIs.

```kotlin
package com.example.data.nfc

import android.nfc.Tag
import android.nfc.tech.IsoDep
import com.example.data.crypto.CryptoEngine

/**
 * Lector/escritor para MIFARE Plus X.
 *
 * MIFARE Plus X:
 * - NFC Forum Type 4, ISO/IEC 14443-A
 * - AES-128 con autenticacion mutua
 * - Compatible con todos los telefonos NFC
 */
class MifarePlusXReader : CardReader {

    override val cardType: String = "mifare_plus_x"
    override val displayName: String = "MIFARE Plus X"

    override fun canHandle(tag: Tag): Boolean {
        // Detectar por techList
        return tag.techList.any {
            it.contains("IsoDep", ignoreCase = true)
        }
        // Refinar con GET_VERSION si es necesario
    }

    override fun readUid(tag: Tag): String {
        return CryptoEngine.bytesToHex(tag.id)
    }

    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        // 1. Conectar IsoDep
        // 2. Autenticar con AES-128
        // 3. Leer slot via comandos APDU
        // 4. Retornar 16 bytes del certificado
        val isoDep = IsoDep.get(tag) ?: return null
        return try {
            isoDep.connect()
            // Enviar APDU de autenticacion
            // Enviar APDU de lectura
            isoDep.close()
            null // TODO: implementar
        } catch (e: Exception) {
            null
        } finally {
            try { isoDep.close() } catch (_: Exception) {}
        }
    }

    override fun writeCertificate(
        tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray
    ): Boolean {
        // 1. Conectar IsoDep
        // 2. Autenticar con AES-128
        // 3. Escribir certificado via APDU
        // Retornar true si se escribio correctamente
        return false // TODO: implementar
    }

    override fun verifyWrite(
        tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray
    ): Int {
        val read = readCertificate(tag, slot, authData) ?: return 0
        return if (read.contentEquals(expected)) 4 else 0
    }

    override fun writePublicData(
        tag: Tag, publicData: ByteArray, authData: ByteArray
    ): Boolean {
        // Escribir custom_card_id en zona publica
        return false // TODO: implementar
    }

    override fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean {
        // Configurar clave AES durante provisionamiento
        return false // TODO: implementar
    }

    override fun totalSlots(): Int = 0  // AES no necesita slots
    override fun activeSlots(): Int = 0
    override fun slotToStartPage(slot: Int): Int = 0
    override fun slotToEndPage(slot: Int): Int = 0
}
```

### Interfaz CardReader

```kotlin
interface CardReader {
    val cardType: String
    val displayName: String

    fun canHandle(tag: Tag): Boolean
    fun readUid(tag: Tag): String
    fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray?
    fun writeCertificate(tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray): Boolean
    fun verifyWrite(tag: Tag, slot: Int, expected: ByteArray, authData: ByteArray): Int
    fun writePublicData(tag: Tag, publicData: ByteArray, authData: ByteArray): Boolean
    fun configureAuth(tag: Tag, authConfig: ByteArray): Boolean
    fun totalSlots(): Int
    fun activeSlots(): Int
    fun slotToStartPage(slot: Int): Int
    fun slotToEndPage(slot: Int): Int
}
```

---

## Paso 7: Registrar el reader en CardReaderRegistry

**Archivo:** `punto-de-venta-pos/app/src/main/java/com/example/data/nfc/CardReaderRegistry.kt`

Agregar una linea en el `init`:

```kotlin
object CardReaderRegistry {

    private val readers = mutableListOf<CardReader>()

    init {
        // Registrar todos los readers soportados
        register(MifareClassicCardReader())
        register(Ntag215Reader())
        register(UltralightCReader())
        register(DesfireCardReader())
        register(MifarePlusXReader())  // ← AGREGAR ESTA LINEA
    }

    // ... resto sin cambios
}
```

---

## Paso 8: Agregar modelos API (Kotlin)

**Archivo:** `punto-de-venta-pos/app/src/main/java/com/example/data/api/PosApiModels.kt`

```kotlin
// ============================================
// MIFARE Plus X
// ============================================

@JsonClass(generateAdapter = true)
data class MifarePlusXPreAuthResponse(
    @Json(name = "pre_approved") val preApproved: Boolean = false,
    @Json(name = "card_uid") val cardUid: String? = null,
    @Json(name = "card_type") val cardType: String? = null,
    @Json(name = "aes_key") val aesKey: String? = null, // hex 16 bytes
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class MifarePlusXConfirmDecryptedPayload(
    @Json(name = "terminal_id") val terminalId: String,
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "read_ok") val readOk: Boolean = true,
    @Json(name = "write_ok") val writeOk: Boolean = true,
    @Json(name = "written_pages") val writtenPages: Int = 4
)

@JsonClass(generateAdapter = true)
data class ProvisionMifarePlusXRequest(
    @Json(name = "user_id") val userId: String,
    @Json(name = "card_uid") val cardUid: String,
    @Json(name = "initial_pin") val initialPin: String
)

@JsonClass(generateAdapter = true)
data class ProvisionMifarePlusXResponse(
    @Json(name = "card_uid") val cardUid: String = "",
    @Json(name = "card_type") val cardType: String = "mifare_plus_x",
    @Json(name = "aes_key") val aesKey: String = "",
    @Json(name = "custom_card_id") val customCardId: String = ""
)
```

---

## Paso 9: Agregar endpoints API (Kotlin)

**Archivo:** `punto-de-venta-pos/app/src/main/java/com/example/data/api/PosApiService.kt`

```kotlin
// --- MIFARE Plus X (Encrypted) ---
@POST("nfc/terminal/mifare-plus-x/pre-auth")
suspend fun mifarePlusXPreAuth(
    @Body request: EncryptedPaymentRequest
): Response<EncryptedPaymentResponse>

@POST("nfc/terminal/mifare-plus-x/pre-auth-document")
suspend fun mifarePlusXPreAuthWithDocument(
    @Body request: EncryptedPaymentRequest
): Response<EncryptedPaymentResponse>

@POST("nfc/terminal/mifare-plus-x/confirm")
suspend fun mifarePlusXConfirm(
    @Body request: EncryptedPaymentRequest
): Response<EncryptedPaymentResponse>

@POST("nfc/cards/provision-mifare-plus-x")
suspend fun provisionMifarePlusXCard(
    @Body request: ProvisionMifarePlusXRequest
): Response<ProvisionMifarePlusXResponse>
```

---

## Paso 10: Agregar metodos en PosRepository

**Archivo:** `punto-de-venta-pos/app/src/main/java/com/example/data/repository/PosRepository.kt`

```kotlin
suspend fun mifarePlusXPreAuth(
    username: String,
    pin: String,
    amountCentavos: Long
): Result<MifarePlusXPreAuthResponse> = withContext(Dispatchers.IO) {
    // Mismo patron que ntag215PreAuth:
    // 1. getOrInitTerminalConfig()
    // 2. Crear payload
    // 3. encryptPayloadEphemeral
    // 4. Llamar service.mifarePlusXPreAuth(request)
    // 5. decryptResponseEphemeral
    // 6. Retornar Result.success(result)
    // ... (ver ntag215PreAuth como ejemplo completo)
}

suspend fun confirmMifarePlusXTransaction(
    cardUid: String,
    readOk: Boolean,
    writeOk: Boolean,
    writtenPages: Int
): Result<PaymentResultDecrypted> = withContext(Dispatchers.IO) {
    // Mismo patron que confirmNTAG215Transaction
    // ...
}

suspend fun provisionMifarePlusXCard(
    userId: String,
    cardUid: String,
    initialPin: String
): Result<ProvisionMifarePlusXResponse> = withContext(Dispatchers.IO) {
    // Mismo patron que provisionNTAG215Card
    // ...
}
```

---

## Paso 11: Documentar el protocolo

**Archivo:** `docs/tarjeta-mifare-plus-x-protocolo.md`

Crear un documento detallado del protocolo, similar a
`docs/tarjeta-ntag215-protocolo.md`. Debe incluir:

1. Especificaciones de la tarjeta (memoria, seguridad)
2. Layout de memoria (zonas publica/privada)
3. Protocolo de provisionamiento
4. Protocolo de transaccion (pre-auth, lectura, escritura, confirmacion)
5. Ejemplos de payloads JSON
6. Consideraciones de seguridad
7. Limitaciones conocidas

---

## Paso 12: Actualizar INDEX.md

**Archivo:** `docs/INDEX.md`

Agregar el nuevo documento a la lista:

```markdown
37. [Protocolo MIFARE Plus X](tarjeta-mifare-plus-x-protocolo.md) - AES-128, compatible con todos los telefonos
```

---

## Checklist final

- [ ] `docs/card-drivers/{tipo}.json` — manifiesto creado
- [ ] `internal/payments/cards/{tipo}_driver.go` — driver Go creado
- [ ] `internal/db/migrations/NNN_{tipo}.sql` — migracion DB creada
- [ ] `internal/payments/nfc_terminal.go` — helpers agregados
- [ ] `internal/payments/cards/driver.go` — funciones de conveniencia agregadas
- [ ] `internal/api/nfc_terminal.go` — rutas + handlers agregados
- [ ] `punto-de-venta-pos/.../data/nfc/{Tipo}Reader.kt` — reader Android creado
- [ ] `punto-de-venta-pos/.../data/nfc/CardReaderRegistry.kt` — reader registrado
- [ ] `punto-de-venta-pos/.../data/api/PosApiModels.kt` — modelos agregados
- [ ] `punto-de-venta-pos/.../data/api/PosApiService.kt` — endpoints agregados
- [ ] `punto-de-venta-pos/.../data/repository/PosRepository.kt` — metodos agregados
- [ ] `docs/tarjeta-{tipo}-protocolo.md` — documento de protocolo creado
- [ ] `docs/INDEX.md` — documento agregado al indice
- [ ] `go build ./...` — compila sin errores
- [ ] `npm run build` (pos web) — compila sin errores
- [ ] Commit con mensaje `feat(nfc): agregar driver {tipo}`

---

## Tarjetas actualmente soportadas

| Tipo | Driver Go | Reader Kotlin | Estado |
|------|-----------|---------------|--------|
| `ntag215` | `ntag215_driver.go` | `Ntag215Reader.kt` | Activo |
| `ultralight_c` | `ultralight_c_driver.go` | `UltralightCReader.kt` | Activo (baja capacidad) |
| `classic` | `classic_driver.go` | `MifareClassicCardReader.kt` | Activo (wrapper) |
| `desfire` | `desfire_driver.go` | `DesfireCardReader.kt` | Placeholder |
| `ntag424` | `ntag424_driver.go` | — | Placeholder |
| `ntag216` | — | — | Futuro |
| `mifare_plus` | — | — | Futuro |

---

## Ejemplo completo: NTAG215

Para ver un ejemplo completo y funcional, consultar estos archivos:

| Componente | Archivo |
|------------|---------|
| Manifiesto | `docs/card-drivers/ntag215.json` |
| Driver Go | `internal/payments/cards/ntag215_driver.go` |
| Migracion | `internal/db/migrations/150_ntag215_ultralight_c.sql` |
| Reader Kotlin | `punto-de-venta-pos/.../data/nfc/Ntag215Reader.kt` |
| Modelos API | `punto-de-venta-pos/.../data/api/PosApiModels.kt` (buscar `NTAG215`) |
| Endpoints API | `punto-de-venta-pos/.../data/api/PosApiService.kt` (buscar `ntag215`) |
| Repository | `punto-de-venta-pos/.../data/repository/PosRepository.kt` (buscar `ntag215`) |
| Handlers HTTP | `internal/api/nfc_terminal.go` (buscar `ntag215PreAuth`) |
| Documento | `docs/tarjeta-ntag215-protocolo.md` |

---

## Preguntas frecuentes

### ¿Puedo agregar una tarjeta sin certificados rotativos?

Si. Tarjetas con AES real (DESFire, NTAG424, MIFARE Plus) no necesitan
certificados rotativos porque el AES ya es seguro. En el manifiesto, poner
`"slots": 0` y en el driver, `PreAuth` solo verifica saldo y `Confirm` procesa
el pago sin rotar slots.

### ¿Como manejo tarjetas que no funcionan en todos los telefonos?

En el manifiesto, poner `"compatibility.android": "partial"` y agregar notas.
El POS Android detecta la tarjeta via `CardReaderRegistry.detectReader(tag)` y
si no encuentra un reader, muestra un mensaje de "tarjeta no soportada en este
dispositivo".

### ¿Puedo reutilizar tablas existentes?

Si tu tarjeta usa el mismo modelo de slots que NTAG215 o Ultralight C, puedes
reutilizar esas tablas. Pero si tiene un modelo diferente, crea tablas nuevas
con el patron `nfc_{tipo}_slots` y `nfc_{tipo}_pending`.

### ¿Como pruebo el driver sin una tarjeta fisica?

Usa el modo demo del POS (`isDemoNode = true`). En modo demo, el POS simula
la lectura/escritura de la tarjeta sin hardware real. Ve
`simulateClassicCardWrite()` en `PosViewModel.kt` como ejemplo.

### ¿Que pasa si la escritura de la tarjeta falla a mitad de camino?

El driver verifica `WrittenPages` en `Confirm`. Si es menor que el esperado,
marca el slot como `needs_repair = true`. La proxima transaccion puede usar
otro slot. El slot danado se repara en el proximo provisionamiento o
manualmente.

### ¿Como se encriptan las claves de la tarjeta?

Las claves (PWD, 3DES, AES) se guardan en columnas `BYTEA` en `nfc_cards`.
El codigo Go debe encriptarlas con la master key del nodo antes de guardarlas
y desencriptarlas al leerlas. **Nunca guardar claves en plaintext.**

### ¿Puedo tener multiples tarjetas del mismo tipo para un usuario?

Si. La tabla `nfc_cards` permite multiples tarjetas activas por usuario.
`FindActiveCardByType` retorna la mas reciente. Si necesitas soportar
multiples simultaneamente, modifica la logica de seleccion.
