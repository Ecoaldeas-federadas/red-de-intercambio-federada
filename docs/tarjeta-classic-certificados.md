# Tarjeta MIFARE Classic 1K — Certificados Dinámicos Rotativos

## Resumen

Este documento describe cómo el sistema implementa certificados dinámicos rotativos en tarjetas **MIFARE Classic 1K** para mitigar la clonación. La tarjeta Classic es barata ($0.30 USD) y ampliamente disponible en Venezuela, pero su criptografía (Crypto1) es débil y vulnerable a ataques Nested/Hardnested que pueden extraer todas las claves.

El diseño usa **6 capas de seguridad** para compensar las limitaciones criptográficas de la tarjeta:

1. Claves A/B únicas por sector por tarjeta
2. Certificados dinámicos con triple redundancia
3. Rotación aleatoria por transacción
4. Doble factor de autenticación (documento + PIN + tarjeta)
5. Claves minimizadas en tránsito
6. Aislamiento entre tarjetas

---

## Estructura física de la tarjeta MIFARE Classic 1K

```
Sector 0: READ-ONLY (UID de fábrica, 4 o 7 bytes) — NO TOCAR
Sectores 1-15: 15 sectores disponibles para certificados

Cada sector tiene 4 bloques de 16 bytes:
  Bloque 0: 16 bytes (copia 1 del certificado)
  Bloque 1: 16 bytes (copia 2 del certificado)
  Bloque 2: 16 bytes (copia 3 del certificado)
  Bloque 3: SECTOR TRAILER — Key A (6b) + Access Bits (4b) + Key B (6b)
             NUNCA se escribe en caliente (evita corrupción irreversible)

Total por tarjeta:
  - 15 sectores × (Key A + Key B) = 30 claves únicas
  - 15 sectores × 3 bloques = 45 copias de certificados
  - Solo 1 sector tiene el certificado VÁLIDO
```

### Access Bits estándar

Configuración usada por el sistema:
- **Key A** = autenticación de **lectura**
- **Key B** = autenticación de **escritura**
- Valor: `0x78 0x77 0x88 0x69`

Esta configuración se escribe **una sola vez** en el provisionamiento (bloque 3/trailer) y **nunca se modifica en caliente**.

---

## Las 6 capas de seguridad

### Capa 1: Claves A/B únicas por sector por tarjeta

- 15 sectores × (Key A + Key B) = **30 claves únicas** por tarjeta
- Cada clave es aleatoria (6 bytes, `crypto/rand`)
- Cada tarjeta tiene claves **TOTALMENTE diferentes** a otras tarjetas
- Key A = solo lectura, Key B = solo escritura
- Escritas UNA SOLA VEZ en provisionamiento (bloque 3/trailer)
- NUNCA se modifican en caliente (evita corrupción irreversible del sector)
- Guardadas en el servidor (`nfc_card_sectors`), solo el servidor las conoce

**Si un atacante vulnera una tarjeta**, obtiene las claves de ESA tarjeta, pero esas claves **no sirven para ninguna otra tarjeta**.

### Capa 2: Certificados dinámicos (16 bytes por sector)

- 15 sectores × 3 bloques = **45 copias** de certificados
- Solo **1 sector** tiene el certificado **VÁLIDO** (`is_active=true`)
- Los otros 14 sectores tienen certificados **basura** (aleatorios, indistinguibles del real)
- Solo el **servidor** sabe cuál sector es el activo
- La tarjeta **NO graba hora/fecha**, por lo que es imposible saber cuál sector se modificó último observando la tarjeta físicamente

### Capa 3: Rotación aleatoria por transacción

- Cada transacción: el servidor lee el sector activo, escribe un nuevo certificado en un sector aleatorio
- El sector viejo pasa a `is_active=false` (su certificado queda como basura automática)
- El sector nuevo pasa a `is_active=true` (certificado recién escrito)
- **No es secuencial**: salta aleatoriamente entre los 15 sectores
- Un atacante que copió la tarjeta antes de la rotación no sabe cuál sector se activó

### Capa 4: Doble factor de autenticación (2FA)

- **Documento de identidad** (lo que el usuario ES) — **OBLIGATORIO** para Classic
- **PIN de 4 dígitos** (lo que el usuario SABE)
- **Tarjeta física** (lo que el usuario TIENE)
- Los tres se verifican **ANTES** de procesar el pago
- El documento es ingresado por el comerciante en el POS y validado contra `users.national_id` o `user_documents`

**Importante:** Para tarjetas Classic con certificados dinámicos, el documento es **SIEMPRE obligatorio** (hardcoded en el código, no configurable). Esto difiere de las tarjetas UID-only legacy donde el documento es configurable.

### Capa 5: Claves en tránsito minimizadas

- Por transacción, solo se envían **2 claves** al POS:
  - Key A del sector a leer (autenticación de lectura)
  - Key B del sector a escribir (autenticación de escritura)
- Las claves viajan **encriptadas** (EphemeralMessage con AES-256-GCM)
- Si se interceptan, solo sirven para **esa tarjeta, esa transacción**
- Para obtener todas las claves de una tarjeta, habría que interceptar **muchas transacciones** de ese usuario

### Capa 6: Aislamiento entre tarjetas

- Cada usuario/tarjeta tiene claves **únicas**
- Si vulneran una tarjeta, esas claves **no sirven para otra**
- El certificado válido de una tarjeta **no sirve para otra**
- No hay clave maestra compartida entre tarjetas

---

## Flujo de pago (auth primero, tarjeta al final)

```
1. COMERCIANTE ingresa monto → confirma
2. CLIENTE ingresa documento de identidad + PIN (NO tarjeta aún)
3. POS envía al servidor: {doc_type, doc_number, pin, amount, terminal_id}
   (cifrado con EphemeralMessage AES-256-GCM)
4. Servidor valida:
   - Usuario existe (por doc_number) ✓
   - PIN correcto (bcrypt) ✓
   - Saldo suficiente (balance - amount >= credit_limit) ✓
   - Bloquea el monto (pre-aprobación, NO procesa aún)
5. Servidor busca tarjeta del usuario:
   - card_uid en nfc_cards (con has_dynamic_certs=true)
   - sector activo en nfc_card_sectors (is_active=true)
   - Genera nuevo certificado aleatorio (16 bytes, crypto/rand)
   - Elige sector aleatorio para escribir (1-15, != sector activo)
6. Servidor responde al POS (todo encriptado):
   {
     pre_approved: true,
     card_uid: "AABBCCDD",
     read_sector: 3,
     read_key_a: "hex...",              // Key A del sector 3
     expected_certificate: "hex...",    // cert que debe estar en sector 3
     write_sector: 9,
     write_key_b: "hex...",             // Key B del sector 9
     new_certificate: "hex..."          // cert nuevo para sector 9
   }
7. POS muestra: "ACERQUE SU TARJETA — No la retire"
8. CLIENTE acerca tarjeta
9. POS lee UID (sector 0, read-only) → verifica coincide con card_uid
10. POS autentica sector 3 con Key A → lee bloques 0,1,2
    - Triple redundancia: al menos 1 de 3 bloques debe coincidir con expected_certificate
11. POS autentica sector 9 con Key B → escribe new_certificate en bloques 0,1,2
12. POS re-lee sector 9 para verificar escritura (¿cuántos bloques coinciden?)
13. POS envía confirmación al servidor:
    {card_uid, read_ok: true, write_ok: true, written_blocks: 3}
14. Servidor:
    - Si confirmed: procesa pago (debita balance)
      - Sector 3 → is_active=false (cert viejo = basura)
      - Sector 9 → is_active=true, certificate=new_cert
    - Si failed: cancela pre-aprobación, libera monto, sector 3 sigue activo
15. Servidor responde: {approved/rejected, transaction_id, balance}
16. POS muestra resultado al cliente
```

### Por qué este orden es mejor

- **El servidor ya sabe quién es el usuario** antes de tocar la tarjeta
- **El POS recibe TODO antes de acercar la tarjeta**: sector a leer, clave A, sector a escribir, clave B, certificados
- **La tarjeta es el último paso**: solo prueba posesión física del token
- **No hay petición extra**: una sola ida (auth) y una sola vuelta (pre-aprobación con todo), luego confirmación
- **Si el usuario no tiene tarjeta o no la acerca**: el servidor cancela la pre-aprobación después de un timeout (30 segundos)

---

## Provisionamiento inicial (en máquina dedicada)

El provisionamiento se hace en un **punto fijo** donde la tarjeta se monta y se deja quieta. No se hace en el POS de venta.

```
1. Admin vincula tarjeta a usuario (card_uid + user_id + PIN inicial)
2. Servidor genera (todo con crypto/rand):
   - 15 pares de claves A/B aleatorios (6 bytes cada uno, únicos por sector)
     Cada par es diferente entre sectores Y diferente entre tarjetas
   - 15 access_bits (Key A lee, Key B escribe)
   - 15 certificados de 16 bytes:
     14 basura aleatoria + 1 real (en un sector aleatorio = activo)
3. Servidor guarda todo en nfc_card_sectors (claves en BD)
4. Servidor responde con toda la data para que la máquina escriba:
   - Por cada sector 1-15: key_a, key_b, access_bits, certificate
5. Máquina escribe TODOS los sectores (con calma, tarjeta montada):
   - Por cada sector:
     a) Escribir bloque 3 (trailer): Key A + Access Bits + Key B
     b) Escribir bloques 0,1,2: el certificado (basura o real)
   - Progreso visual: "Escribiendo sector 3/15..."
6. Máquina confirma provisionamiento completo al servidor
7. Servidor marca tarjeta como provisionada (has_dynamic_certs=true)
```

**NOTA:** Las claves A/B se escriben UNA SOLA VEZ aquí. Nunca más se tocan. Solo cambian los certificados (bloques 0,1,2) en transacciones.

---

## Rotación por transacción (ejemplo)

```
Estado en servidor (nfc_card_sectors) para tarjeta AABBCCDD:
  sector 1: key_a=AAA, key_b=BBB, cert=basura1, is_active=false
  sector 3: key_a=CCC, key_b=DDD, cert=ABC(real), is_active=true
  sector 7: key_a=EEE, key_b=FFF, cert=basura7, is_active=false
  sector 9: key_a=GGG, key_b=HHH, cert=basura9, is_active=false
  ... (otros sectores con basura)

Transacción:
  1. Servidor identifica sector 3 como activo (cert=ABC)
  2. Servidor genera nuevo cert=DEF (16 bytes aleatorios)
  3. Servidor elige sector 9 al azar (no secuencial, != 3)
  4. POS lee sector 3 con key_a=CCC → verifica cert=ABC ✓
  5. POS escribe DEF en sector 9 con key_b=HHH (bloques 0,1,2)
  6. POS confirma escritura
  7. Servidor:
     - sector 3 → is_active=false (cert=ABC ahora es basura)
     - sector 9 → is_active=true, cert=DEF
  8. Próxima transacción: lee sector 9, escribe en sector aleatorio nuevo
     (ej. sector 2, 14, etc. — nunca secuencial)
```

---

## Recuperación de escritura interrumpida (tearing recovery)

### Si escritura falla (usuario retiró tarjeta)

- POS no confirma → servidor cancela pre-aprobación tras timeout (30s)
- Sector 3 sigue activo (cert=ABC)
- Sector 9 queda con basura (no se confirmó escritura)
- Próxima transacción: lee sector 3, intenta rotar de nuevo

### Si escritura parcial (1 de 3 bloques escrito)

- POS re-lee sector 9: bloque 0 tiene DEF, bloques 1,2 tienen basura
- POS reporta: `written_blocks=1`
- Servidor decide:
  - Si `written_blocks >= 1`: puede activar sector 9 (al menos 1 bloque válido = cert legible)
    Marca `needs_repair=true` para reparar bloques 1,2 en próxima transacción
  - Si `written_blocks == 0`: cancelar, mantener sector 3, reintentar rotación próxima vez

### Si el usuario se va y vuelve días después

- Servidor ya canceló la pre-aprobación (timeout)
- Usuario se autentica de nuevo (doc + PIN)
- Servidor lee sector 3 (sigue activo)
- Si sector 9 tiene escritura parcial: lo repara o elige otro sector

---

## Endpoints de la API

### POST /api/nfc/cards/provision-classic
Provisiona una tarjeta MIFARE Classic 1K con certificados dinámicos.
- **Permiso:** `nfc.issue_card`
- **Request:** `{user_id, card_uid, initial_pin}`
- **Response:** `{card_uid, sectors: [{sector_number, key_a, key_b, access_bits, certificate, is_active}]}`

### POST /api/nfc/terminal/classic/pre-auth
Pre-autenticación para tarjeta Classic (terminal-facing, Ed25519 auth).
- **Payload cifrado:** `{terminal_id, doc_type, doc_number, pin, amount}`
- **Response cifrada:** `{pre_approved, card_uid, read_sector, read_key_a, expected_certificate, write_sector, write_key_b, new_certificate}`

### POST /api/nfc/terminal/classic/confirm
Confirma la lectura/escritura de la tarjeta Classic (terminal-facing, Ed25519 auth).
- **Payload cifrado:** `{terminal_id, card_uid, read_ok, write_ok, written_blocks}`
- **Response cifrada:** `PaymentResultDecrypted` (status, transaction_id, user_balance)

---

## Esquema de base de datos

### nfc_card_sectors (migración 138)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `card_uid` | TEXT | UID de la tarjeta |
| `node_domain` | TEXT | Nodo |
| `sector_number` | INT | Número de sector (1-15) |
| `key_a_encrypted` | BYTEA | Key A (6 bytes, lectura) |
| `key_b_encrypted` | BYTEA | Key B (6 bytes, escritura) |
| `access_bits` | BYTEA | Access bits (4 bytes) |
| `certificate` | BYTEA | Certificado actual (16 bytes) |
| `is_active` | BOOLEAN | Sector con cert válido |
| `written_blocks` | INT | Bloques confirmados (0-3) |
| `needs_repair` | BOOLEAN | Necesita reparación |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de actualización |

**Constraint:** `UNIQUE(card_uid, sector_number)`

### nfc_classic_pending (migración 138)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `card_uid` | TEXT | UID de la tarjeta |
| `terminal_id` | TEXT | Terminal que inició |
| `user_id` | UUID | FK → users(id) |
| `amount` | BIGINT | Monto a pagar |
| `read_sector` | INT | Sector a leer |
| `write_sector` | INT | Sector a escribir |
| `new_certificate` | BYTEA | Cert nuevo (16 bytes) |
| `expires_at` | TIMESTAMPTZ | Expiración (30s) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

### nfc_cards (campo nuevo)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `has_dynamic_certs` | BOOLEAN | Tiene certificados dinámicos Classic (migración 138) |

---

## Implementación por plataforma

### Backend (Go)

**Archivos:**
- `internal/db/migrations/138_classic_card_certificates.sql` — esquema
- `internal/payments/nfc_terminal.go` — lógica de negocio
- `internal/api/nfc_terminal.go` — endpoints HTTP

**Funciones principales:**
- `ProvisionClassicCard(ctx, userID, cardUID, initialPIN)` — genera 15 sectores
- `ClassicPreAuth(ctx, terminalID, docType, docNumber, pin, amount)` — pre-aprueba
- `ConfirmClassicTransaction(ctx, terminalID, cardUID, readOK, writeOK, writtenBlocks)` — confirma
- `CleanupExpiredClassicPending(ctx)` — borra pre-aprobaciones expiradas
- `HasClassicCerts(ctx, cardUID)` — verifica si tarjeta tiene cert dinámicos

### Android POS (Kotlin)

**Archivos:**
- `data/nfc/MifareClassicReader.kt` — lector/escritor de sectores
- `data/api/PosApiModels.kt` — modelos API
- `data/api/PosApiService.kt` — endpoints Retrofit
- `data/repository/PosRepository.kt` — funciones de repositorio
- `ui/viewmodel/PosViewModel.kt` — lógica del flujo Classic
- `ui/screens/NfcChargeScreen.kt` — UI con "ACERQUE SU TARJETA"
- `ui/screens/ProvisionCardScreen.kt` — pantalla de provisionamiento
- `MainActivity.kt` — detección de MIFARE Classic

**Clase clave:** `MifareClassicReader`
- `readSectorBlocks(tag, sector, keyA)` — lee bloques 0,1,2 con Key A
- `writeSectorBlocks(tag, sector, data, keyB)` — escribe 3 bloques con Key B
- `verifyWrite(tag, sector, keyA, expected)` — re-lee y verifica
- `writeFullSector(tag, sector, keyA, keyB, accessBits, cert)` — provisionamiento completo

### ESP32 (Firmware)

**Archivos:**
- `firmware/shared/nfc_reader.h` — detección y lectura NFC
- `firmware/terminal-keypad/terminal-keypad.ino` — terminal keypad
- `firmware/terminal-touch/terminal-touch.ino` — terminal táctil
- `firmware/terminal-community/terminal-community.ino` — terminal comunitario
- `firmware/terminal-ble-reader/terminal-ble-reader.ino` — lector BLE

**Soporte Classic:** El firmware ESP32 necesita actualizarse para:
1. Detectar MIFARE Classic (ya detecta `CARD_UID_ONLY`)
2. Leer sectores con Key A usando `nfc.mifareclassic_AuthenticateBlock()`
3. Escribir sectores con Key B
4. Enviar certificado leído al servidor en el payload

### Web POS (React/TypeScript)

**Archivo:** `web/src/pages/Pos.tsx`

El POS web usa **Web Bluetooth** para conectar un lector BLE. El flujo Classic requiere:
1. El comerciante ingresa documento + PIN del cliente
2. El POS web envía pre-auth al servidor
3. El servidor responde con sector a leer + claves
4. El POS web envía comandos al lector BLE para leer/escribir sectores
5. El POS web confirma al servidor

**Nota:** El POS web actualmente solo crea cargos QR/NFC básicos. El flujo Classic completo requiere implementar la comunicación con el lector BLE para lectura/escritura de sectores MIFARE Classic.

---

## Limitaciones de MIFARE Classic

### Vulnerabilidad criptográfica

MIFARE Classic usa **Crypto1**, que es criptográficamente débil. El ataque **Nested/Hardnested** (con Proxmark3, Flipper Zero, etc.) puede:

- **SÍ** obtener TODAS las claves A/B de TODOS los sectores
- **SÍ** leer TODO el contenido de la tarjeta
- **SÍ** clonar la tarjeta completamente

### Por qué el diseño sigue siendo seguro

A pesar de la vulnerabilidad, el diseño mitiga el riesgo porque:

1. **El atacante no sabe cuál sector es el activo** — ve 15 sectores con datos, todos parecen iguales, solo el servidor sabe cuál vale
2. **Necesita PIN + documento** — sin eso no puede hacer la transacción
3. **Después de una transacción legítima, el clon queda obsoleto** — el cert activo cambió a otro sector, el clon tiene el viejo
4. **Cada tarjeta tiene claves únicas** — si vulneran una tarjeta, esas claves no sirven para otra tarjeta

### Recomendación

Para **alta seguridad**, se recomienda **DESFire EV3** que tiene criptografía AES-128 real y no es vulnerable a los ataques de Crypto1. MIFARE Classic con certificados dinámicos es una **opción económica** para casos donde el costo de DESFire es prohibitivo.

---

## Comparación de tarjetas

| Característica | UID-only (legacy) | MIFARE Classic (cert dinámicos) | DESFire EV3 |
|----------------|-------------------|--------------------------------|-------------|
| Precio | $0.20 | $0.30 | $1.50 |
| Criptografía | Ninguna | Crypto1 (débil) | AES-128 (fuerte) |
| Clonable | Sí (fácil) | Sí (pero cert rotativo mitiga) | No (difícil) |
| Documento obligatorio | Configurable | **Sí (siempre)** | No |
| Certificados dinámicos | No | Sí (15 sectores) | No (usa AES) |
| Rotación por transacción | No | Sí | Opcional |
| Triple redundancia | No | Sí (3 bloques) | No |
| Recomendado para | Básico | Económico con seguridad | Alta seguridad |

---

## Ver también

- [Hardware NFC](nfc_hardware.md) — Lista de hardware y tipos de terminal
- [Seguridad](security.md) — Modelo de seguridad general
- [Pagos](payments.md) — Flujos de pago
- [API](api.md) — Endpoints de la API
- [Base de datos](database.md) — Esquema completo
- [Especificación Android](android-app-spec.md) — App Android POS
- [Criptografía POS](punto-de-venta-pos/docs/06-criptografia.md) — Criptografía del POS
- [Flujos de pago POS](punto-de-venta-pos/docs/03-flujos-pago.md) — Flujos de pago del POS
- [Modelo de seguridad firmware](firmware/docs/security_model.md) — Seguridad del firmware ESP32

---

*Documento creado en migración 138 — Certificados dinámicos rotativos para MIFARE Classic 1K.*
