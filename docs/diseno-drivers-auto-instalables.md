# Sistema de Drivers NFC Auto-Instalables

## Diseno tecnico completo

> **Objetivo:** Permitir que cualquier persona de la comunidad, sin saber
> programar, pueda instalar soporte para un nuevo tipo de tarjeta NFC
> simplemente subiendo un archivo `.nfcpkg` desde la pagina admin web.
> El driver se auto-instala, se valida, y se comparte con los demados nodos
> federados para que tambien puedan usarlo sin intervention manual.

---

## 1. Problema actual

El sistema modular actual requiere un programador para cada nueva tarjeta:

1. Escribir codigo Go (`internal/payments/cards/{tipo}_driver.go`)
2. Escribir codigo Kotlin (`.../data/nfc/{Tipo}Reader.kt`)
3. Escribir migracion SQL
4. Compilar el backend
5. Compilar la app Android
6. Hacer deploy

**Esto no sirve para gente comunitaria.** Una persona que consigue un lote
de tarjetas NTAG216 en MercadoLibre no puede esperar a que un programador
haga todo eso. Necesita instalar el driver ella misma, como cuando instalas
un driver de impresora en Windows: doble click y listo.

---

## 2. Solucion: Paquetes `.nfcpkg`

Un archivo `.nfcpkg` es un ZIP firmado que contiene todo lo necesario para
que el servidor y el POS Android soporten una nueva tarjeta:

```
mi-tarjeta-ntag216.nfcpkg  (ZIP)
├── manifest.json          ← Metadatos + specs de la tarjeta
├── driver.js              ← Logica del servidor (JavaScript sandboxed)
├── reader.json            ← Logica del POS Android (declarativa)
├── migration.sql          ← Migracion DB (opcional)
├── protocol.md            ← Documento del protocolo (opcional)
├── icon.svg               ← Icono para UI (opcional)
└── signature.sig          ← Firma Ed25519 del manifest + driver.js + reader.json
```

### Flujo de instalacion

```
1. Admin de un nodo consigue un archivo .nfcpkg
   (descargado de internet, compartado por otra comunidad, o creado
   por un programador del proyecto)

2. Entra a la pagina admin → NFC → "Drivers de Tarjetas" → "Subir driver"

3. Selecciona el archivo .nfcpkg

4. El servidor:
   a. Descomprime el ZIP
   b. Verifica la firma Ed25519
   c. Valida el manifest.json
   d. Ejecuta migration.sql en una transaccion (rollback si falla)
   e. Compila driver.js con Goja (sandbox JS) y lo cachea
   f. Registra el driver en nfc_card_drivers (DB)
   g. Responde "Driver instalado correctamente"

5. El driver aparece en la lista de tipos de tarjeta soportados

6. El POS Android descarga reader.json automaticamente al sincronizar
   y lo usa para leer/escribir esa tarjeta

7. El nodo comparte el .nfcpkg con los demas nodos federados via gossip

8. Los demas nodos pueden auto-instalarlo con un click
```

---

## 3. Formato del paquete `.nfcpkg`

### 3.1 manifest.json

```json
{
  "package_version": 1,
  "driver_version": "1.0.0",
  "type": "ntag216",
  "display_name": "NTAG216",
  "description": "Tarjeta NFC Type 2 con 888 bytes de usuario. Compatible con todos los telefonos.",
  "manufacturer": "NXP Semiconductors",
  "capacity": "full",
  "min_server_version": "1.0.0",
  "min_pos_version": "1.0.0",

  "memory": {
    "total_bytes": 924,
    "user_bytes": 888,
    "page_size": 4,
    "total_pages": 231,
    "user_pages": 222
  },

  "security": {
    "level": "password",
    "algorithm": "PWD-32bit",
    "key_length_bits": 32,
    "key_count": 1,
    "mutual_auth": false,
    "secure_messaging": false,
    "originality_signature": true,
    "auth_limit_configurable": true
  },

  "compatibility": {
    "android": "full",
    "ios": "full",
    "esp32_pn532": "full",
    "phone_reader": true,
    "nfc_forum_type": 2,
    "notes": "Universal — funciona en todos los telefonos NFC"
  },

  "protocol": {
    "slots": 55,
    "active_slots": 27,
    "backup_slots": 28,
    "certificate_size": 16,
    "auth_method": "PWD_AUTH",
    "rotation": "random_per_transaction",
    "pre_auth_ttl_seconds": 30,
    "public_zone_start_page": 4,
    "public_zone_end_page": 9,
    "private_zone_start_page": 10,
    "private_zone_end_page": 229
  },

  "availability": {
    "venezuela": false,
    "price_usd": 0.25,
    "notes": "Dificil de conseguir en Venezuela pero mas capacidad que NTAG215."
  },

  "endpoints": {
    "provision": "/api/nfc/cards/provision-ntag216",
    "pre_auth": "/api/nfc/terminal/ntag216/pre-auth",
    "confirm": "/api/nfc/terminal/ntag216/confirm"
  },

  "files": {
    "driver": "driver.js",
    "reader": "reader.json",
    "migration": "migration.sql",
    "protocol_doc": "protocol.md",
    "icon": "icon.svg"
  },

  "author": {
    "name": "Proyecto Red de Intercambio Federada",
    "contact": "soporte@redfederada.org",
    "license": "LPF-1.0"
  }
}
```

### 3.2 driver.js (logica del servidor)

El driver se escribe en JavaScript (ES5.1, ejecutado por Goja en el backend
Go). El sandbox expone una API limitada y segura:

```javascript
// driver.js — Driver NTAG216 para el servidor

var NfcDriver = {
  type: "ntag216",
  requiresDocument: false,

  // Provision: registra la tarjeta en el servidor
  provision: function(ctx, userId, cardUid, initialPin) {
    // 1. Hashear PIN
    var pinHash = ctx.bcrypt.hash(initialPin);

    // 2. Generar PWD aleatoria (4 bytes)
    var pwd = ctx.crypto.randomBytes(4);
    var pack = ctx.crypto.randomBytes(2);

    // 3. Generar custom_card_id (8 bytes)
    var customCardId = ctx.crypto.randomBytes(8);

    // 4. INSERT en nfc_cards
    ctx.db.execute(
      "INSERT INTO nfc_cards (user_id, card_uid, card_type, is_active, pin_hash, " +
      "ntag215_pwd_encrypted, ntag215_pack, custom_card_id, ntag215_auth0, issued_at) " +
      "VALUES ($1, $2, 'ntag216', true, $3, $4, $5, $6, 10, NOW())",
      [userId, cardUid, pinHash, pwd, pack, customCardId]
    );

    // 5. Generar 55 slots (27 activos + 28 backups)
    var slots = [];
    for (var i = 0; i < 55; i++) {
      var cert = ctx.crypto.randomBytes(16);
      var isActive = i < 27;
      var backupOf = isActive ? null : (i - 27);

      ctx.db.execute(
        "INSERT INTO nfc_ntag216_slots " +
        "(card_uid, node_domain, slot_number, is_backup, backup_of_slot, " +
        "start_page, end_page, certificate, is_active) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [cardUid, ctx.nodeDomain, i, !isActive, backupOf,
         10 + (i * 4), 10 + (i * 4) + 3, cert, isActive]
      );

      slots.push({
        slot_number: i,
        certificate: ctx.crypto.toHex(cert),
        is_active: isActive,
        is_backup: !isActive,
        backup_of_slot: backupOf
      });
    }

    // 6. Retornar respuesta para el POS
    return {
      card_uid: cardUid,
      card_type: "ntag216",
      pwd: ctx.crypto.toHex(pwd),
      pack: ctx.crypto.toHex(pack),
      custom_card_id: ctx.crypto.toHex(customCardId),
      auth0: 10,
      slots: slots
    };
  },

  // PreAuth: valida usuario + PIN + saldo, prepara rotacion
  preAuth: function(ctx, username, pin, amount) {
    // 1. Buscar usuario (case-insensitive)
    var user = ctx.db.queryOne(
      "SELECT id, balance, credit_limit FROM users " +
      "WHERE LOWER(username) = LOWER($1) AND node_domain = $2",
      [username, ctx.nodeDomain]
    );
    if (!user) {
      return { pre_approved: false, message: "Usuario no encontrado" };
    }

    // 2. Buscar tarjeta activa del tipo ntag216
    var card = ctx.db.queryOne(
      "SELECT card_uid, ntag215_pwd_encrypted, ntag215_pack " +
      "FROM nfc_cards WHERE user_id = $1 AND card_type = 'ntag216' " +
      "AND is_active = true ORDER BY issued_at DESC LIMIT 1",
      [user.id]
    );
    if (!card) {
      return { pre_approved: false, message: "No tiene tarjeta NTAG216 activa" };
    }

    // 3. Verificar PIN
    if (!ctx.bcrypt.verify(pin, ctx.db.getPinHash(user.id))) {
      return { pre_approved: false, message: "PIN incorrecto" };
    }

    // 4. Verificar saldo (balance - amount >= -credit_limit)
    var newBalance = user.balance - amount;
    if (newBalance < -user.credit_limit) {
      return { pre_approved: false, message: "Saldo insuficiente" };
    }

    // 5. Encontrar slot activo actual
    var activeSlot = ctx.db.queryOne(
      "SELECT slot_number, certificate FROM nfc_ntag216_slots " +
      "WHERE card_uid = $1 AND is_active = true ORDER BY slot_number LIMIT 1",
      [card.card_uid]
    );
    if (!activeSlot) {
      return { pre_approved: false, message: "No hay slot activo" };
    }

    // 6. Elegir slot de escritura (backup aleatorio)
    var writeSlot = ctx.db.queryOne(
      "SELECT slot_number FROM nfc_ntag216_slots " +
      "WHERE card_uid = $1 AND is_backup = true " +
      "ORDER BY RANDOM() LIMIT 1",
      [card.card_uid]
    );

    // 7. Generar nuevo certificado
    var newCert = ctx.crypto.randomBytes(16);

    // 8. Guardar pre-aprobacion (TTL 30s)
    var pendingId = ctx.crypto.uuid();
    ctx.db.execute(
      "INSERT INTO nfc_ntag216_pending " +
      "(id, card_uid, terminal_id, user_id, amount, read_slot, write_slot, " +
      "backup_slot, new_certificate, expires_at) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '30 seconds')",
      [pendingId, card.card_uid, ctx.terminalId, user.id, amount,
       activeSlot.slot_number, writeSlot.slot_number,
       activeSlot.slot_number, newCert]
    );

    // 9. Retornar datos para el POS (se encriptaran antes de enviar)
    return {
      pre_approved: true,
      card_uid: card.card_uid,
      card_type: "ntag216",
      pwd: ctx.crypto.toHex(ctx.crypto.decrypt(card.ntag215_pwd_encrypted)),
      pack: ctx.crypto.toHex(card.ntag215_pack),
      read_slot: activeSlot.slot_number,
      expected_certificate: ctx.crypto.toHex(activeSlot.certificate),
      write_slot: writeSlot.slot_number,
      backup_slot: activeSlot.slot_number,
      new_certificate: ctx.crypto.toHex(newCert)
    };
  },

  // Confirm: confirma lectura/escritura y procesa pago
  confirm: function(ctx, cardUid, readOk, writeOk, writtenPages) {
    // 1. Buscar pre-aprobacion pendiente (no expirada)
    var pending = ctx.db.queryOne(
      "SELECT * FROM nfc_ntag216_pending " +
      "WHERE card_uid = $1 AND expires_at > NOW() " +
      "ORDER BY created_at DESC LIMIT 1",
      [cardUid]
    );
    if (!pending) {
      return { status: "rejected", message: "No hay pre-aprobacion valida" };
    }

    // 2. Si fallo la lectura o escritura, rechazar
    if (!readOk || !writeOk) {
      ctx.db.execute(
        "DELETE FROM nfc_ntag216_pending WHERE id = $1",
        [pending.id]
      );
      return {
        status: "rejected",
        message: "Fallo la " + (!readOk ? "lectura" : "escritura") + " de la tarjeta"
      };
    }

    // 3. Debitar balance del usuario
    ctx.db.execute(
      "UPDATE users SET balance = balance - $1 WHERE id = $2",
      [pending.amount, pending.user_id]
    );

    // 4. Rotar slots: desactivar leido, activar escrito
    ctx.db.execute(
      "UPDATE nfc_ntag216_slots SET is_active = false, updated_at = NOW() " +
      "WHERE card_uid = $1 AND slot_number = $2",
      [cardUid, pending.read_slot]
    );
    ctx.db.execute(
      "UPDATE nfc_ntag216_slots SET is_active = true, is_backup = false, " +
      "certificate = $3, updated_at = NOW() " +
      "WHERE card_uid = $1 AND slot_number = $2",
      [cardUid, pending.write_slot, pending.new_certificate]
    );

    // 5. Slot antiguo pasa a ser backup
    ctx.db.execute(
      "UPDATE nfc_ntag216_slots SET is_backup = true, is_active = false, " +
      "backup_of_slot = $3, updated_at = NOW() " +
      "WHERE card_uid = $1 AND slot_number = $2",
      [cardUid, pending.read_slot, pending.write_slot]
    );

    // 6. Borrar pending
    ctx.db.execute(
      "DELETE FROM nfc_ntag216_pending WHERE id = $1",
      [pending.id]
    );

    // 7. Log transaccion
    var txId = ctx.crypto.uuid();
    ctx.db.execute(
      "INSERT INTO nfc_transactions " +
      "(id, terminal_id, card_uid, user_id, amount, status, transaction_type) " +
      "VALUES ($1, $2, $3, $4, $5, 'approved', 'single')",
      [txId, pending.terminal_id, cardUid, pending.user_id, pending.amount]
    );

    // 8. Retornar resultado
    var newBalance = ctx.db.queryOne(
      "SELECT balance FROM users WHERE id = $1",
      [pending.user_id]
    );

    return {
      status: "approved",
      transaction_id: txId,
      user_balance: newBalance.balance
    };
  },

  // CleanupExpired: borra pre-aprobaciones expiradas
  cleanupExpired: function(ctx) {
    ctx.db.execute(
      "DELETE FROM nfc_ntag216_pending WHERE expires_at < NOW()"
    );
  }
};
```

### 3.3 reader.json (logica del POS Android)

El POS Android NO ejecuta JavaScript. En cambio, usa un formato **declarativo**
que describe como leer/escribir la tarjeta usando comandos NFC estandar.
Esto es mas seguro y no requiere un motor JS en Android.

```json
{
  "reader_version": 1,
  "type": "ntag216",
  "display_name": "NTAG216",

  "detection": {
    "nfc_forum_type": 2,
    "tech_list": ["android.nfc.tech.NfcA"],
    "sak": 0x00,
    "atqa": "0x4400",
    "identify_command": {
      "opcode": "0x60",
      "expected_response_prefix": "0x0004040502030100"
    }
  },

  "uid": {
    "method": "tag_id",
    "format": "hex"
  },

  "auth": {
    "method": "PWD_AUTH",
    "command_opcode": "0x1B",
    "pwd_offset": 0,
    "pwd_length": 4,
    "pack_length": 2,
    "pack_verify": true
  },

  "read_certificate": {
    "method": "READ",
    "command_opcode": "0x30",
    "pages_per_read": 4,
    "bytes_per_certificate": 16,
    "slot_to_page_formula": "private_zone_start + (slot * 4)",
    "auth_required": true
  },

  "write_certificate": {
    "method": "WRITE",
    "command_opcode": "0xA2",
    "pages_per_write": 1,
    "writes_per_certificate": 4,
    "slot_to_page_formula": "private_zone_start + (slot * 4)",
    "auth_required": true,
    "verify_after_write": true
  },

  "write_public_data": {
    "method": "WRITE",
    "command_opcode": "0xA2",
    "start_page": 4,
    "pages": 6,
    "auth_required": false
  },

  "configure_auth": {
    "method": "WRITE_MULTIPLE",
    "pages": [
      { "page": 229, "data_offset": 0, "data_length": 4, "description": "PWD byte 0-3" },
      { "page": 230, "data_offset": 4, "data_length": 2, "description": "PACK byte 0-1" },
      { "page": 228, "data_offset": 6, "data_length": 1, "description": "AUTH0" },
      { "page": 228, "data_offset": 7, "data_length": 1, "description": "ACCESS" }
    ],
    "auth_required": false,
    "notes": "Configurar durante provisionamiento. AUTH0 = primera pagina protegida."
  },

  "memory_layout": {
    "public_zone_start_page": 4,
    "public_zone_end_page": 9,
    "private_zone_start_page": 10,
    "private_zone_end_page": 229,
    "config_zone_start_page": 228
  },

  "slots": {
    "total": 55,
    "active": 27,
    "backup": 28,
    "certificate_size": 16,
    "pages_per_slot": 4
  }
}
```

### 3.4 migration.sql

```sql
-- Migracion para NTAG216 (auto-instalada desde .nfcpkg)
-- Se ejecuta en una transaccion. Si falla, se hace rollback.

CREATE TABLE IF NOT EXISTS nfc_ntag216_slots (
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

CREATE INDEX IF NOT EXISTS idx_nfc_ntag216_slots_uid
    ON nfc_ntag216_slots(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_ntag216_slots_active
    ON nfc_ntag216_slots(card_uid, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS nfc_ntag216_pending (
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

CREATE INDEX IF NOT EXISTS idx_nfc_ntag216_pending_card
    ON nfc_ntag216_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_ntag216_pending_expiry
    ON nfc_ntag216_pending(expires_at);
```

### 3.5 Firma del paquete

Cada `.nfcpkg` debe estar firmado con Ed25519. La firma verifica que el
paquete no ha sido modificado y que proviene de un autor de confianza.

```
signature.sig = Ed25519.Sign(privateKey, SHA256(manifest.json || driver.js || reader.json))
```

**Claves de firma:**

- **Clave oficial del proyecto:** Distribuida con cada instalacion del
  servidor. Los paquetes firmados con esta clave se instalan automaticamente.
- **Claves de nodos federados:** Cada nodo puede generar su propia clave
  de firma. Los paquetes firmados por nodos federados conocidos se instalan
  con una advertencia "Driver de nodo X, no oficial".
- **Claves manuales:** El admin puede agregar claves publicas confiables
  manualmente desde la UI. Los paquetes firmados con esas claves se instalan
  sin advertencia.

**Sin firma valida:** El paquete NO se instala. Se muestra un error.

---

## 4. Sandbox JavaScript (Goja)

El backend Go ejecuta `driver.js` dentro de un sandbox Goja. El sandbox
expone una API limitada y segura. **El codigo JavaScript no tiene acceso
al sistema de archivos, red, ni a Go directamente.**

### API del sandbox

```go
// internal/payments/cards/sandbox.go

type SandboxContext struct {
    DB          DBInterface
    Crypto      CryptoInterface
    Bcrypt      BcryptInterface
    NodeDomain  string
    TerminalID  string
}

type DBInterface interface {
    QueryOne(query string, args []interface{}) map[string]interface{}
    Execute(query string, args []interface{})
    GetPinHash(userID string) string
}

type CryptoInterface interface {
    RandomBytes(n int) []byte
    ToHex(bytes []byte) string
    FromHex(hex string) []byte
    UUID() string
    Encrypt(data []byte) []byte  // encripta con master key del nodo
    Decrypt(data []byte) []byte  // desencripta con master key del nodo
}

type BcryptInterface interface {
    Hash(password string) string
    Verify(password, hash string) bool
}
```

### Restricciones del sandbox

1. **Timeout:** Cada ejecucion tiene un timeout de 5 segundos.
2. **Sin I/O:** No hay `require()`, `fetch()`, `XMLHttpRequest`, ni `fs`.
3. **Sin eval:** `eval()` y `Function()` estan deshabilitados.
4. **Memoria limitada:** Max 16MB de heap.
5. **Solo ES5.1:** No hay ES6+ (pero se puede transpilar con Babel).
6. **Solo funciones declaradas:** El driver debe exportar un objeto
   `NfcDriver` con los metodos `provision`, `preAuth`, `confirm`,
   `cleanupExpired`.

### Compilacion y cache

```go
// Al instalar un driver:
runtime := goja.New()
script, err := goja.Compile("driver.js", driverSource, false)
runtime.Set("ctx", sandboxContext)
runtime.RunScript(script)

// Cachear el runtime compilado para reuso
driverCache.Set("ntag216", &CompiledDriver{
    Runtime: runtime,
    Script:  script,
})
```

---

## 5. Base de datos: registro de drivers instalados

```sql
-- Tabla: nfc_card_drivers
CREATE TABLE IF NOT EXISTS nfc_card_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT UNIQUE NOT NULL,           -- "ntag216", "mifare_plus_x", etc.
    display_name TEXT NOT NULL,
    version TEXT NOT NULL,               -- "1.0.0"
    manifest JSONB NOT NULL,             -- manifest.json completo
    driver_js TEXT NOT NULL,             -- codigo JS del driver
    reader_json TEXT NOT NULL,           -- reader.json declarativo
    migration_sql TEXT,                  -- migracion ejecutada
    signature TEXT NOT NULL,             -- firma Ed25519 (hex)
    signed_by TEXT NOT NULL,             -- "official", "node:domain.com", "manual"
    is_active BOOLEAN NOT NULL DEFAULT true,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shared_with_federation BOOLEAN NOT NULL DEFAULT false
);

-- Claves publicas de firma confiables
CREATE TABLE IF NOT EXISTS nfc_driver_signing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,                 -- "Oficial", "Nodo A", etc.
    public_key TEXT NOT NULL,            -- Ed25519 public key (hex)
    trust_level TEXT NOT NULL,           -- "official", "federated", "manual"
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache de paquetes compartidos por otros nodos
CREATE TABLE IF NOT EXISTS nfc_driver_packages_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    version TEXT NOT NULL,
    package_data BYTEA NOT NULL,         -- .nfcpkg completo (ZIP)
    shared_by TEXT NOT NULL,             -- nodo que lo compartio
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    installed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(type, version)
);
```

---

## 6. Sharing federado entre nodos

### 6.1 Protocolo de sharing

Cuando un nodo instala un driver, automaticamente lo comparte con los
demas nodos federados via el protocolo de gossip existente.

```
Nodo A instala driver NTAG216
    │
    ├── Guarda en nfc_card_drivers
    ├── Marca shared_with_federation = true
    │
    └── Gossip tick (60s)
        │
        ├── Para cada peer federado activo:
        │   │
        │   └── POST /federation/drivers/sync
        │       {
        │         from_node: "nodo-a.org",
        │         drivers: [
        │           {
        │             type: "ntag216",
        │             version: "1.0.0",
        │             manifest_hash: "sha256:...",
        │             package_url: "/federation/drivers/download/ntag216"
        │           }
        │         ]
        │       }
        │
        └── Nodo B recibe la lista
            │
            ├── Compara con sus drivers instalados
            ├── Si no tiene ntag216 → lo marca como "disponible"
            ├── Si tiene version menor → lo marca como "actualizacion disponible"
            └── Notifica al admin via UI
```

### 6.2 Endpoints de federation

```
GET  /federation/drivers/list          → Lista drivers instalados en el nodo
POST /federation/drivers/sync          → Recibe lista de drivers de un peer
GET  /federation/drivers/download/{type} → Descarga .nfcpkg completo
POST /federation/drivers/install       → Instala un driver desde un peer
```

### 6.3 Auto-descarga cross-node

```
Escenario: Usuario del Nodo B tiene tarjeta NTAG216, pero Nodo B no tiene
el driver instalado. Nodo A si lo tiene.

1. POS del Nodo B intenta pagar con tarjeta NTAG216
2. Servidor del Nodo B responde: "Tipo de tarjeta ntag216 no soportado"
3. POS muestra: "Esta tarjeta no es soportada en este nodo.
   Buscando driver en nodos federados..."
4. Servidor del Nodo B consulta a sus peers federados:
   GET /federation/drivers/list (a cada peer)
5. Nodo A responde: "Si, tengo ntag216 v1.0.0"
6. Servidor del Nodo B descarga el .nfcpkg:
   GET /federation/drivers/download/ntag216 (de Nodo A)
7. Servidor del Nodo B verifica la firma
8. Servidor del Nodo B instala el driver automaticamente
9. Servidor del Nodo B re-intenta la transaccion
10. La transaccion proceede normalmente
```

### 6.4 Control de confianza

- **Drivers oficiales** (firmados con clave del proyecto): Auto-instalacion
  cross-node sin preguntas.
- **Drivers de nodos federados** (firmados con clave de un nodo conocido):
  Auto-descarga pero el admin debe aprobar la instalacion desde la UI.
- **Drivers desconocidos** (firma no reconocida): No se auto-descargan.
  El admin debe subirlos manualmente.

---

## 7. UI Web Admin

### 7.1 Nueva pestana "Drivers" en NFC

```
NFC > Terminales | Provisionar | Tarjetas | Transacciones | Emparejamiento | Drivers
                                                                              ^^^^^^^
```

### 7.2 Vista de lista de drivers

```
┌─────────────────────────────────────────────────────────────────────┐
│  Drivers de Tarjetas NFC                              [+ Subir driver] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ [icon] NTAG215          v1.0.0    Activo    Oficial             │ │
│  │        504 bytes · PWD-32bit · 30 slots · Compatible: Todos      │ │
│  │        [Detalles]  [Compartir con federacion]  [Desactivar]     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ [icon] Ultralight C     v1.0.0    Activo    Oficial             │ │
│  │        148 bytes · 3DES · 8 slots · Compatible: Parcial          │ │
│  │        [Detalles]  [Compartir con federacion]  [Desactivar]     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ [icon] MIFARE Classic   v1.0.0    Activo    Oficial             │ │
│  │        752 bytes · Crypto1 · 15 sectors · Compatible: Parcial    │ │
│  │        [Detalles]  [Compartir con federacion]  [Desactivar]     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ [icon] NTAG216          v1.0.0    Disponible (de nodo-a.org)    │ │
│  │        888 bytes · PWD-32bit · 55 slots · Compatible: Todos      │ │
│  │        [Instalar]  [Descartar]                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ [icon] MIFARE Plus X    v0.9.0    Actualizacion disponible      │ │
│  │        de nodo-b.org (v1.0.0)                                    │ │
│  │        [Actualizar]  [Ignorar]                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Dialogo "Subir driver"

```
┌─────────────────────────────────────────────────────────────────────┐
│  Subir Driver de Tarjeta NFC                                   [X]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Selecciona un archivo .nfcpkg:                                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    [Arrastrar archivo aqui]                       │ │
│  │                       o  [Examinar...]                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Archivo: mi-tarjeta-ntag216.nfcpkg (12.3 KB)                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Vista previa del paquete:                                        │ │
│  │                                                                   │ │
│  │  Tipo:          NTAG216                                          │ │
│  │  Version:       1.0.0                                            │ │
│  │  Firma:         Valida (Oficial)                                 │ │
│  │  Memoria:       888 bytes de usuario                             │ │
│  │  Seguridad:     PWD-32bit                                        │ │
│  │  Slots:         55 (27 activos + 28 backups)                    │ │
│  │  Compatibilidad: Android full, iOS full, ESP32 full             │ │
│  │  Migracion:     Si (2 tablas nuevas)                             │ │
│  │                                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [Cancelar]              [Instalar driver]                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.4 Estado de instalacion

```
Instalando NTAG216 v1.0.0...

✓ Verificando firma...         OK (Oficial)
✓ Validando manifest...        OK
✓ Ejecutando migracion DB...   OK (2 tablas creadas)
✓ Compilando driver.js...      OK
✓ Registrando driver...        OK
✓ Compartiendo con federacion... OK (3 nodos notificados)

Driver NTAG216 v1.0.0 instalado correctamente.
```

---

## 8. Motor declarativo Android (reader.json)

El POS Android NO ejecuta JavaScript. En cambio, descarga `reader.json`
del servidor y lo interpreta con un motor declarativo nativo.

### 8.1 CardReaderEngine

```kotlin
// punto-de-venta-pos/.../data/nfc/CardReaderEngine.kt

/**
 * Motor que interpreta reader.json para leer/escribir tarjetas NFC
 * sin codigo compilado. Soporta comandos NFC Type 2 y APDU ISO 14443-4.
 */
class CardReaderEngine(private val readerConfig: ReaderConfig) : CardReader {

    override val cardType: String = readerConfig.type
    override val displayName: String = readerConfig.displayName

    override fun canHandle(tag: Tag): Boolean {
        // Verificar techList contra detection.tech_list
        val techList = tag.techList.toList()
        val requiredTechs = readerConfig.detection.techList
        if (!requiredTechs.all { it in techList }) return false

        // Verificar SAK/ATQA si estan definidos
        // Verificar GET_VERSION si identify_command esta definido
        return true
    }

    override fun readUid(tag: Tag): String {
        return when (readerConfig.uid.method) {
            "tag_id" -> CryptoEngine.bytesToHex(tag.id)
            "read_page_0" -> readPage(tag, 0).take(4).toByteArray().toHex()
            else -> CryptoEngine.bytesToHex(tag.id)
        }
    }

    override fun readCertificate(tag: Tag, slot: Int, authData: ByteArray): ByteArray? {
        val cfg = readerConfig.readCertificate
        val tech = getTech(tag, cfg.method) ?: return null

        // Autenticar si es necesario
        if (cfg.authRequired) {
            if (!authenticate(tech, authData)) return null
        }

        // Calcular pagina inicial del slot
        val startPage = calculateSlotPage(slot, cfg.slotToPageFormula)

        // Leer 4 paginas (16 bytes)
        return readPages(tech, startPage, cfg.pagesPerRead)
    }

    override fun writeCertificate(
        tag: Tag, slot: Int, certificate: ByteArray, authData: ByteArray
    ): Boolean {
        val cfg = readerConfig.writeCertificate
        val tech = getTech(tag, cfg.method) ?: return false

        if (cfg.authRequired) {
            if (!authenticate(tech, authData)) return false
        }

        val startPage = calculateSlotPage(slot, cfg.slotToPageFormula)

        // Escribir 4 paginas de 4 bytes cada una
        for (i in 0 until cfg.writesPerCertificate) {
            val page = startPage + i
            val offset = i * 4
            val pageData = certificate.copyOfRange(offset, offset + 4)
            if (!writePage(tech, page, pageData)) return false
        }

        return true
    }

    // ... verifyWrite, writePublicData, configureAuth implementados
    //     de manera similar, interpretando reader.json

    private fun authenticate(tech: TagTechnology, authData: ByteArray): Boolean {
        val authCfg = readerConfig.auth
        return when (authCfg.method) {
            "PWD_AUTH" -> authenticatePwd(tech, authData, authCfg)
            "3DES_AUTH" -> authenticate3Des(tech, authData, authCfg)
            "AES_AUTH" -> authenticateAes(tech, authData, authCfg)
            "KEY_A" -> authenticateKeyA(tech, authData, authCfg)
            "KEY_B" -> authenticateKeyB(tech, authData, authCfg)
            "none" -> true
            else -> false
        }
    }

    private fun calculateSlotPage(slot: Int, formula: String): Int {
        // Interpretar formula simple: "private_zone_start + (slot * 4)"
        val privateStart = readerConfig.memoryLayout.privateZoneStartPage
        val pagesPerSlot = readerConfig.slots.pagesPerSlot
        return privateStart + (slot * pagesPerSlot)
    }
}
```

### 8.2 Descarga automatica de reader.json

```kotlin
// punto-de-venta-pos/.../data/repository/PosRepository.kt

/**
 * Descarga todos los reader.json de los drivers instalados en el servidor.
 * Se llama al sincronizar y al iniciar sesion.
 */
suspend fun syncCardReaders(): Result<List<ReaderConfig>> = withContext(Dispatchers.IO) {
    try {
        val service = apiClient.getService()
        val response = service.listCardDrivers()
        if (response.isSuccessful && response.body() != null) {
            val drivers = response.body()!!
            // Guardar cada reader.json localmente
            for (driver in drivers) {
                val readerConfig = parseReaderConfig(driver.readerJson)
                CardReaderConfigStore.save(driver.type, readerConfig)
            }
            // Recargar el registry con los nuevos readers
            CardReaderRegistry.reloadFromStore()
            Result.success(drivers.map { parseReaderConfig(it.readerJson) })
        } else {
            Result.failure(Exception("Error sincronizando drivers"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

### 8.3 CardReaderRegistry dinamico

```kotlin
// punto-de-venta-pos/.../data/nfc/CardReaderRegistry.kt

object CardReaderRegistry {

    private val readers = mutableListOf<CardReader>()
    private val builtinReaders = mutableListOf<CardReader>()

    init {
        // Readers compilados (built-in): siempre disponibles
        builtinReaders.add(MifareClassicCardReader())
        builtinReaders.add(Ntag215Reader())
        builtinReaders.add(UltralightCReader())
        builtinReaders.add(DesfireCardReader())
        reload()
    }

    /**
     * Recarga el registry desde los reader.json guardados localmente.
     * Se llama despues de syncCardReaders().
     */
    fun reload() {
        readers.clear()
        readers.addAll(builtinReaders)

        // Agregar readers dinamicos desde reader.json
        val dynamicConfigs = CardReaderConfigStore.getAll()
        for (config in dynamicConfigs) {
            // No duplicar si ya hay un built-in con el mismo tipo
            if (readers.none { it.cardType == config.type }) {
                readers.add(CardReaderEngine(config))
            }
        }
    }

    fun detectReader(tag: Tag): CardReader? {
        // Probar built-in primero, luego dinamicos
        return readers.firstOrNull { it.canHandle(tag) }
    }
}
```

---

## 9. API endpoints (backend Go)

### 9.1 Endpoints admin web

```
GET  /api/nfc/drivers                    → Lista drivers instalados
GET  /api/nfc/drivers/{type}             → Detalle de un driver
POST /api/nfc/drivers/upload             → Subir .nfcpkg (multipart)
POST /api/nfc/drivers/{type}/activate    → Activar driver
POST /api/nfc/drivers/{type}/deactivate  → Desactivar driver
DELETE /api/nfc/drivers/{type}           → Desinstalar driver
POST /api/nfc/drivers/{type}/share       → Compartir con federacion
GET  /api/nfc/drivers/available          → Drivers disponibles de peers
POST /api/nfc/drivers/install-from-peer  → Instalar desde un peer
GET  /api/nfc/drivers/signing-keys       → Claves de firma confiables
POST /api/nfc/drivers/signing-keys       → Agregar clave de firma
DELETE /api/nfc/drivers/signing-keys/{id} → Remover clave de firma
```

### 9.2 Endpoints POS Android

```
GET  /api/nfc/card-drivers               → Lista drivers con reader.json
GET  /api/nfc/card-drivers/{type}/reader → Descarga reader.json de un driver
```

### 9.3 Endpoints federation

```
GET  /federation/drivers/list            → Lista drivers para peers
GET  /federation/drivers/download/{type} → Descarga .nfcpkg
POST /federation/drivers/sync            → Recibe lista de drivers de un peer
```

---

## 10. Flujo completo: de la caja al pago

```
1. Comunidad consigue 50 tarjetas NTAG216 en AliExpress

2. Alguien del proyecto crea el .nfcpkg:
   - Escribe driver.js (logica del servidor)
   - Escribe reader.json (logica del POS)
   - Escribe migration.sql
   - Firma el paquete con la clave oficial
   - Publica ntag216-1.0.0.nfcpkg

3. Admin del Nodo A descarga ntag216-1.0.0.nfcpkg

4. Admin entra a: Web admin → NFC → Drivers → Subir driver
   - Selecciona el archivo
   - Ve la vista previa: NTAG216, 888 bytes, 55 slots
   - Click "Instalar driver"
   - El servidor verifica firma, ejecuta migracion, compila driver.js
   - "Driver instalado correctamente"

5. El nodo A comparte automaticamente con nodos B, C, D via gossip

6. Admin del Nodo B ve en su UI:
   "NTAG216 v1.0.0 disponible (de nodo-a.org)"
   - Click "Instalar"
   - El servidor descarga el .nfcpkg del Nodo A
   - Verifica firma, instala, listo

7. POS Android del Nodo A se sincroniza:
   - Descarga reader.json de NTAG216
   - CardReaderRegistry.reload() detecta el nuevo reader

8. Usuario acerca tarjeta NTAG216 al POS:
   - CardReaderRegistry.detectReader(tag) → CardReaderEngine(ntag216)
   - POS lee UID, lee certificado, escribe nuevo, verifica
   - POS envia confirmacion al servidor
   - Servidor ejecuta driver.js confirm() en sandbox
   - Pago aprobado

9. Usuario del Nodo C (sin driver) acerca tarjeta NTAG216 al POS:
   - Servidor: "Tipo ntag216 no soportado"
   - POS: "Buscando driver en nodos federados..."
   - Servidor consulta peers, Nodo A responde "tengo ntag216"
   - Servidor descarga .nfcpkg, verifica, instala
   - Servidor re-intenta: "Pago aprobado"
   - Usuario no se entero de nada
```

---

## 11. Seguridad

### 11.1 Firma de paquetes

- Todo `.nfcpkg` debe estar firmado con Ed25519.
- La firma cubre `SHA256(manifest.json || driver.js || reader.json)`.
- Sin firma valida, el paquete no se instala.
- La clave publica oficial viene embebida en el binario del servidor.

### 11.2 Sandbox del driver.js

- Goja es un sandbox real (no como V8 que tiene escapes).
- No hay acceso a filesystem, red, ni os.
- Solo se exponen las funciones del `SandboxContext`.
- Timeout de 5 segundos por ejecucion.
- Memoria limitada a 16MB.

### 11.3 Migracion SQL segura

- Se ejecuta en una transaccion.
- Si cualquier statement falla, se hace rollback completo.
- Solo se permiten DDL (CREATE TABLE, ALTER TABLE, CREATE INDEX).
- No se permite DML (INSERT, UPDATE, DELETE) en la migracion.
- No se permite DROP de tablas existentes.

### 11.4 Verificacion de reader.json

- El reader.json se valida contra un schema JSON antes de usarlo.
- Solo se permiten comandos NFC conocidos (READ, WRITE, PWD_AUTH, etc.).
- No se permite ejecucion arbitraria.

### 11.5 Sharing federado seguro

- Los paquetes se comparten via el canal federado encriptado existente
  (AES-256-GCM + Ed25519).
- El peer que recibe verifica la firma del paquete antes de instalarlo.
- Los drivers de peers no se auto-instalan sin aprobacion del admin
  (excepto los oficiales).

---

## 12. Creacion de paquetes (.nfcpkg)

### 12.1 Herramienta CLI

```bash
# Crear un paquete desde un directorio
nfc-pkg build ./mi-driver/
  → Genera mi-driver-ntag216-1.0.0.nfcpkg

# Firmar un paquete
nfc-pkg sign mi-driver-ntag216-1.0.0.nfcpkg --key official.key
  → Agrega signature.sig al paquete

# Verificar un paquete
nfc-pkg verify mi-driver-ntag216-1.0.0.nfcpkg --pubkey official.pub
  → "Firma valida (Oficial)"

# Inspeccionar un paquete
nfc-pkg inspect mi-driver-ntag216-1.0.0.nfcpkg
  → Muestra manifest, archivos, firma
```

### 12.2 Estructura del directoria fuente

```
mi-driver/
├── manifest.json
├── driver.js
├── reader.json
├── migration.sql
├── protocol.md
├── icon.svg
└── package.key          ← clave privada Ed25519 (no se incluye en el .nfcpkg)
```

### 12.3 Plantilla base

Se proporciona una plantilla `nfc-driver-template/` con todos los archivos
necesarios para crear un driver nuevo, incluyendo:

- `manifest.json` con todos los campos vacios
- `driver.js` con las 4 funciones vacias
- `reader.json` con la estructura declarativa vacia
- `migration.sql` con ejemplos comentados
- `protocol.md` con la estructura del documento
- `icon.svg` placeholder
- `README.md` con instrucciones

---

## 13. Implementacion

### Fases

| Fase | Que | Estado |
|------|-----|--------|
| 1 | Formato .nfcpkg + firma | Pendiente |
| 2 | Sandbox Goja + API | Pendiente |
| 3 | Migracion automatica | Pendiente |
| 4 | Endpoints API admin | Pendiente |
| 5 | UI web admin (Drivers tab) | Pendiente |
| 6 | Motor declarativo Android | Pendiente |
| 7 | Sharing federado | Pendiente |
| 8 | Auto-descarga cross-node | Pendiente |
| 9 | Herramienta CLI nfc-pkg | Pendiente |
| 10 | Plantilla + documentacion | Pendiente |
| 11 | Migrar drivers existentes a .nfcpkg | Pendiente |

### Archivos nuevos a crear

```
Backend Go:
  internal/payments/cards/sandbox.go          ← Sandbox Goja + API
  internal/payments/cards/package.go          ← Parser de .nfcpkg
  internal/payments/cards/signing.go          ← Verificacion de firma
  internal/payments/cards/dynamic_registry.go  ← Registry de drivers dinamicos
  internal/payments/cards/migration_runner.go  ← Ejecutor de migraciones
  internal/api/nfc_drivers.go                 ← Handlers HTTP admin
  internal/federation/drivers.go              ← Sharing federado

Web admin:
  web/src/pages/NFCDrivers.tsx                ← Pagina de drivers
  web/src/components/DriverUpload.tsx         ← Dialogo de subida
  web/src/components/DriverCard.tsx           ← Tarjeta de driver

Android:
  punto-de-venta-pos/.../data/nfc/CardReaderEngine.kt     ← Motor declarativo
  punto-de-venta-pos/.../data/nfc/CardReaderConfigStore.kt ← Persistencia
  punto-de-venta-pos/.../data/nfc/ReaderConfig.kt          ← Modelo reader.json

CLI:
  cmd/nfc-pkg/main.go                         ← Herramienta CLI

Plantilla:
  templates/nfc-driver-template/              ← Plantilla base

Migracion DB:
  internal/db/migrations/151_driver_registry.sql  ← Tablas del registry
```

### Dependencia nueva

```
go get github.com/dop251/goja
```

Goja es Go puro, sin CGO, usado en produccion por Grafana k6 y Nakama.
Licencia MIT. ~6-7x mas rapido que otto. Suficiente para logica de drivers
(no es CPU-intensivo, solo glue code + DB queries).

---

## 14. Preguntas frecuentes

### ¿Por que JavaScript y no Lua o Python?

JavaScript es el lenguaje mas conocido del mundo. Cualquier programador web
puede escribir un driver. Goja es Go puro (sin CGO), seguro, y suficiente
para logica de drivers. Lua requeriria aprender otro lenguaje. Python
requeriria CGO o un interprete pesado.

### ¿Por que el POS Android no ejecuta JavaScript?

Por seguridad y simplicidad. Android ya tiene un motor JS (V8) pero
exponerlo seria un riesgo de seguridad. El formato declarativo reader.json
es mas seguro: solo describe comandos NFC, no puede hacer logica arbitraria.
Si una tarjeta necesita logica compleja en el POS, se implementa como
reader built-in (compilado en Kotlin).

### ¿Que pasa si un driver tiene un bug?

1. El sandbox tiene timeout de 5s, asi que un loop infinito no cuelga el servidor.
2. Si el driver lanza una excepcion, la transaccion falla y se muestra error.
3. El admin puede desactivar el driver desde la UI.
4. Se puede instalar una version nueva que reemplaza la vieja.

### ¿Puedo tener dos versiones del mismo driver?

No. `nfc_card_drivers.type` es UNIQUE. Instalar una version nueva
reemplaza la vieja. La migracion SQL debe ser idempotente (usar
`CREATE TABLE IF NOT EXISTS`, etc.).

### ¿Que pasa si la migracion SQL falla?

Se hace rollback completo de la transaccion. El driver no se instala.
Se muestra el error SQL al admin. El paquete queda disponible para
re-intentar despues de corregir el problema.

### ¿Como se actualiza un driver?

Se sube un .nfcpkg con la misma `type` pero version mayor. El servidor:
1. Desactiva el driver viejo
2. Ejecuta la migracion nueva (debe ser idempotente)
3. Compila el driver.js nuevo
4. Activa el driver nuevo
5. Comparte la actualizacion con los peers

### ¿Que pasa si un nodo federado comparte un driver malicioso?

1. El paquete debe estar firmado. Si la firma no es reconocida, no se instala.
2. Si esta firmado por un nodo federado, el admin debe aprobar manualmente.
3. El sandbox limita lo que el driver puede hacer (sin I/O, sin red).
4. La migracion SQL solo permite DDL, no DML.
5. El admin puede revocar la confianza de un nodo en cualquier momento.

### ¿Funciona sin internet?

Si. Los drivers instalados funcionan offline. El sharing federado requiere
conexion entre nodos, pero una vez instalado, el driver no necesita internet.
El POS Android descarga reader.json una vez y lo guarda localmente.

### ¿Como creo un driver sin saber programar?

No puedes crear un driver sin saber programar, pero **puedes instalarlo**
sin saber programar. La idea es que unos pocos programadores del proyecto
creen drivers para las tarjetas mas comunes y los distribuyan como .nfcpkg.
Las comunidades solo los instalan.

En el futuro, se podria crear un asistente visual en la web admin que
genere driver.js y reader.json a partir de un formulario (seleccionar
tipo de auth, numero de slots, etc.), pero eso es una fase posterior.

---

## 15. Comparacion: antes vs despues

| Aspecto | Sistema actual | Sistema .nfcpkg |
|---------|---------------|-----------------|
| Instalar driver | Programador escribe Go + Kotlin, compila, deploy | Admin sube archivo desde web |
| Tiempo de instalacion | Horas/dias | 30 segundos |
| Compartir con otros nodos | Manual (copiar codigo, recompilar) | Automatico via gossip |
| Saber programar | Si (Go + Kotlin) | No (solo subir archivo) |
| Actualizar driver | Recompilar todo | Subir nueva version |
| Driver de nodo federado | Imposible sin recompilar | Auto-descarga + click |
| Android | Recompilar APK | Descarga reader.json automatico |
| Rollback | Manual | Desactivar desde UI |

---

## 16. Referencias

- [Goja - ECMAScript 5.1 en Go puro](https://github.com/dop251/goja)
- [Sistema modular actual](guia-agregar-tarjeta-nfc.md) (fase anterior)
- [Protocolo NTAG215](tarjeta-ntag215-protocolo.md)
- [Protocolo Ultralight C](tarjeta-ultralight-c-protocolo.md)
- [Catalogo de tarjetas](nfc_tipos_tarjetas.md)
- [Federacion y gossip](federation.md)
