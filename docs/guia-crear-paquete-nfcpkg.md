# Guia: Como Crear un Paquete .nfcpkg

> Para **programadores** que quieren crear soporte para un nuevo tipo de tarjeta NFC.
> Los admin de comunidad no necesitan esta guia — ellos solo suben el `.nfcpkg`
> desde la web admin (ver [guia-instalar-driver-web.md](guia-instalar-driver-web.md)).

## Que es un .nfcpkg

Un `.nfcpkg` es un ZIP firmado con Ed25519 que contiene todo lo necesario
para que el servidor y el POS Android soporten una nueva tarjeta NFC:

```
mi-tarjeta-ntag216.nfcpkg  (ZIP)
├── manifest.json     — Metadatos + specs de la tarjeta
├── driver.js         — Logica del servidor (JavaScript ES5.1, Goja sandbox)
├── reader.json       — Logica del POS Android (declarativo)
├── migration.sql     — Migracion DB (solo DDL)
├── protocol.md       — Documento del protocolo (opcional)
├── icon.svg          — Icono para UI (opcional)
└── signature.sig     — Firma Ed25519
```

## Requisitos

- Go 1.25+ (para compilar la herramienta `nfc-pkg`)
- El repositorio del proyecto clonado
- Conocimiento basico de JavaScript (ES5.1)
- Conocimiento del protocolo NFC de la tarjeta que quieres soportar

## Paso 1: Copiar la plantilla

```bash
cp -r templates/nfc-driver-template ./mi-driver
cd mi-driver
```

## Paso 2: Editar manifest.json

Cambia los campos principales:

```json
{
  "type": "ntag216",           ← identificador unico de la tarjeta
  "display_name": "NTAG216",   ← nombre para mostrar en la UI
  "driver_version": "1.0.0",   ← version del driver
  "description": "...",
  "manufacturer": "NXP",
  ...
}
```

Ajusta `memory`, `security`, `protocol`, `compatibility` segun las specs
de la tarjeta. Consulta el datasheet del fabricante.

## Paso 3: Escribir driver.js

El driver se escribe en JavaScript ES5.1 (usar `var`, no `let`/`const`).
Se ejecuta en un sandbox Goja dentro del servidor Go.

### API del sandbox

| Objeto | Metodo | Descripcion |
|--------|--------|-------------|
| `ctx.db` | `.queryOne(sql, args)` | Ejecuta SELECT, retorna una fila o null |
| `ctx.db` | `.execute(sql, args)` | Ejecuta INSERT/UPDATE/DELETE |
| `ctx.db` | `.getPinHash(userId)` | Retorna el hash de PIN de un usuario |
| `ctx.crypto` | `.randomBytes(n)` | Genera n bytes aleatorios |
| `ctx.crypto` | `.toHex(bytes)` | Convierte bytes a hex string |
| `ctx.crypto` | `.fromHex(hex)` | Convierte hex a bytes |
| `ctx.crypto` | `.uuid()` | Genera un UUID v4 |
| `ctx.crypto` | `.hash(data)` | SHA256 de bytes |
| `ctx.bcrypt` | `.hash(password)` | Hashea password con bcrypt |
| `ctx.bcrypt` | `.verify(pass, hash)` | Verifica password contra hash |
| `ctx` | `.nodeDomain` | Dominio de este nodo |
| `ctx` | `.terminalId` | ID del terminal (en preAuth/confirm) |

### Metodos obligatorios

El objeto `NfcDriver` debe tener 4 metodos:

1. **`provision(ctx, userId, cardUid, initialPin)`** — Registra la tarjeta
2. **`preAuth(ctx, username, pin, amount)`** — Valida usuario + saldo
3. **`confirm(ctx, cardUid, readOk, writeOk, writtenPages)`** — Procesa pago
4. **`cleanupExpired(ctx)`** — Borra pre-aprobaciones expiradas

Ver `templates/nfc-driver-template/driver.js` para un ejemplo completo.

### Restricciones del sandbox

- **Sin I/O:** No hay `require()`, `fetch()`, `fs`, ni red
- **Sin eval:** `eval()` y `Function()` estan deshabilitados
- **Timeout:** 5 segundos por ejecucion
- **Solo ES5.1:** No hay ES6+ (usar `var`, funciones normales, no arrow)

## Paso 4: Escribir reader.json

El POS Android NO ejecuta JavaScript. En cambio, interpreta `reader.json`
que describe como leer/escribir la tarjeta usando comandos NFC estandar.

### Estructura

```json
{
  "type": "ntag216",
  "display_name": "NTAG216",
  "detection": { ... },          ← como detectar la tarjeta
  "uid": { ... },                ← como leer el UID
  "auth": { ... },               ← como autenticar
  "read_certificate": { ... },   ← como leer un certificado
  "write_certificate": { ... },  ← como escribir un certificado
  "write_public_data": { ... },  ← como escribir datos publicos
  "configure_auth": { ... },     ← como configurar auth (provisionamiento)
  "memory_layout": { ... },      ← layout de memoria
  "slots": { ... }               ← configuracion de slots
}
```

### Metodos de autenticacion soportados

| Metodo | Tarjetas | Comando |
|--------|----------|---------|
| `PWD_AUTH` | NTAG215, NTAG216, NTAG213 | 0x1B |
| `3DES_AUTH` | Ultralight C | 0x1A |
| `KEY_A` | MIFARE Classic | MifareClassic API |
| `KEY_B` | MIFARE Classic | MifareClassic API |
| `none` | Sin auth | — |

### Limitaciones del motor declarativo

El motor declarativo (`CardReaderEngine`) soporta:
- Comandos NfcA: READ (0x30), WRITE (0xA2), PWD_AUTH (0x1B)
- MIFARE Classic: authenticateSectorWithKeyA/B, readBlock, writeBlock

**NO soporta** (requiere reader built-in compilado):
- DESFire (APDU complejo)
- MIFARE Plus (AES, secure messaging)
- NTAG424 DNA (SUN MAC, SDM)
- ICODE SLIX2 (ISO 15693)

Si tu tarjeta necesita logica que no se puede expresar declarativamente,
tienes que escribir un reader Kotlin compilado (ver guia antigua).

## Paso 5: Escribir migration.sql

La migracion crea las tablas que `driver.js` necesita. Solo se permite DDL:

```sql
CREATE TABLE IF NOT EXISTS nfc_midriver_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    ...
);

CREATE INDEX IF NOT EXISTS idx_nfc_midriver_slots_uid
    ON nfc_midriver_slots(card_uid);
```

### Reglas

- **Solo DDL:** CREATE, ALTER, CREATE INDEX, DROP IF EXISTS
- **No DML:** INSERT, UPDATE, DELETE no permitidos
- **No DROP de tablas existentes** (solo IF EXISTS de tablas propias)
- **Idempotente:** Usar `IF NOT EXISTS` (la migracion puede ejecutarse multiples veces)
- **En transaccion:** Si falla, se hace rollback completo

## Paso 6: Generar claves Ed25519

```bash
go run ./cmd/nfc-pkg genkey --out mykey
```

Esto crea:
- `mykey.pub` — clave publica (compartir libremente)
- `mykey.key` — clave privada (GUARDAR EN SECRETO)

## Paso 7: Construir el paquete

```bash
go run ./cmd/nfc-pkg build ./mi-driver
```

Crea `mi-driver-ntag216-1.0.0.nfcpkg` (sin firma).

## Paso 8: Firmar el paquete

```bash
go run ./cmd/nfc-pkg sign mi-driver-ntag216-1.0.0.nfcpkg --key mykey.key
```

Agrega `signature.sig` al paquete.

## Paso 9: Verificar

```bash
go run ./cmd/nfc-pkg verify mi-driver-ntag216-1.0.0.nfcpkg --pubkey mykey.pub
```

Debe decir "Firma VALIDA".

## Paso 10: Inspeccionar

```bash
go run ./cmd/nfc-pkg inspect mi-driver-ntag216-1.0.0.nfcpkg
```

Muestra el contenido completo del paquete.

## Paso 11: Distribuir

### Opcion A: Subir directamente

1. Entra a la web admin del nodo
2. NFC > Drivers NFC > Subir Driver
3. Selecciona el `.nfcpkg`
4. Click "Instalar Driver"

### Opcion B: Compartir la clave publica

Para que otros nodos puedan verificar tus paquetes:

1. Comparte `mykey.pub` con los admin de otros nodos
2. Ellos agregan tu clave publica desde: NFC > Drivers NFC > Claves de Firma > + Agregar Clave
3. Ahora pueden instalar tus paquetes y verificarlos

### Opcion C: Federation automatica

Si tu nodo esta federado con otros:

1. Sube el `.nfcpkg` a tu nodo
2. Marca "Compartir con federacion"
3. Los otros nodos reciben el driver automaticamente via gossip
4. Aparece en su UI como "Disponible (de tu-nodo.org)"
5. El admin del otro nodo click "Instalar"

## Modelo de firma por-nodo

Cada nodo es independiente. No hay clave oficial central:

- **Tu nodo firma con su propia clave** — se genera automaticamente al instalar el primer driver
- **La clave publica se asocia a tu node_domain** — los otros nodos la conocen via federation
- **Tu puedes usar tu propia clave** (generada con `nfc-pkg genkey`) — mas control
- **El admin puede agregar claves manuales** — para confiar en programadores externos

## Ejemplo completo: NTAG216

Ver `packages/ntag216-1.0.0.nfcpkg/` para un ejemplo completo de un driver
real para NTAG216.

## Troubleshooting

### "driver.js invalido: error de sintaxis"

Verifica que usas ES5.1 (`var`, no `let`/`const`). No uses arrow functions.

### "NfcDriver.provision no esta definido"

El objeto `NfcDriver` debe tener los 4 metodos: `provision`, `preAuth`, `confirm`, `cleanupExpired`.

### "firma no reconocida por ninguna clave confiable"

El paquete esta firmado con una clave que el nodo no conoce. Agrega la clave
publica desde la UI: NFC > Drivers NFC > Claves de Firma > + Agregar Clave.

### "migracion SQL fallo"

Verifica que la migracion solo tiene DDL (CREATE/ALTER/INDEX). No INSERT/UPDATE/DELETE.

### "timeout en provision"

El driver tardo mas de 5 segundos. Optimiza las queries DB o reduce el numero de slots.
