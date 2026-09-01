# Protocolo de certificados dinámicos rotativos para NTAG215

> Especificación del protocolo de seguridad para tarjetas NTAG215 en el
> Sistema TQ / Red de Intercambio Federada.
>
> NTAG215 es la tarjeta recomendada como principal porque:
> - Se consigue en Venezuela
> - Es compatible con TODOS los teléfonos (Android + iOS)
> - Tiene 504 bytes de memoria de usuario = 30 slots con doble redundancia
> - PWD de 32 bits compensada con certificados rotativos y 2FA

## 1. Especificaciones de la tarjeta

| Aspecto | Valor |
|---------|-------|
| Fabricante | NXP Semiconductors |
| Estándar | NFC Forum Type 2, ISO/IEC 14443 Type A |
| Memoria total | 540 bytes (135 páginas de 4 bytes) |
| Memoria de usuario | 504 bytes (126 páginas) |
| Seguridad | PWD de 32 bits + PACK de 16 bits |
| AUTH0 | Define primera página que requiere contraseña |
| PROT | 0 = solo escritura protegida, 1 = lectura+escritura protegida |
| AUTHLIM | Límite de intentos de autenticación fallidos |
| Contador NFC | Opcional, 24 bits |
| Firma de originalidad | ECDSA (detecta chips falsificados) |
| Retención de datos | 10 años |
| Ciclos de escritura | 100,000 |

### Comandos NFC relevantes

| Comando | Código | Descripción |
|---------|--------|-------------|
| READ | 30h | Lee 4 páginas (16 bytes) a la vez |
| FAST_READ | 3Ah | Lee múltiples páginas rápidamente |
| WRITE | A2h | Escribe 1 página (4 bytes) |
| COMPATIBILITY_WRITE | A0h | Write compatible con Ultralight |
| PWD_AUTH | 1Bh | Autenticación con contraseña |
| READ_CNT | 39h | Lee el contador NFC |
| READ_SIG | 3Ch | Lee firma de originalidad (32 bytes) |
| GET_VERSION | 60h | Obtiene versión del chip |

### Detección desde Android

NTAG215 se detecta via `NfcA` (ISO 14443 Type A). No usa `MifareClassic`
ni `MifareUltralight`. Se identifica con:

1. `tag.techList` contiene `"android.nfc.tech.NfcA"`
2. Enviar comando `GET_VERSION` (60h) → responde 8 bytes con info del chip
3. NTAG215 responde: vendor=04h (NXP), product=04h (NTAG), sub-product=02h
4. El byte 4 indica el tamaño: 0x11 = 504 bytes (NTAG215)

```kotlin
val nfcA = NfcA.get(tag)
nfcA.connect()
val versionCmd = byteArrayOf(0x60.toByte())
val response = nfcA.transceive(versionCmd)
// response[0] = 0x00 (header)
// response[1] = 0x04 (vendor ID: NXP)
// response[2] = 0x04 (product type: NTAG)
// response[3] = 0x02 (product subtype)
// response[4] = 0x11 (major product version: NTAG215)
// response[5] = 0x00 (minor)
// response[6] = size info
// response[7] = protocol info
```

## 2. Estructura de memoria

```
┌─────────────────────────────────────────────────────────────────┐
│ Páginas 0-2:   UID de fábrica (read-only) — NO TOCAR            │
├─────────────────────────────────────────────────────────────────┤
│ Página 3:      Capability Container (OTP) — NO TOCAR             │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 4-9:   ZONA PÚBLICA (24 bytes, sin contraseña)          │
│   4-5: custom_card_id (8 bytes, nuestro ID personalizado)       │
│   6-7: node_domain hash (8 bytes)                               │
│   8-9: user_reference + versión protocolo (8 bytes)             │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 10-129: ZONA PRIVADA (120 páginas = 30 slots de 16 B)   │
│                                                                 │
│   Slots 0-14:  15 certificados ACTIVOS                          │
│     Slot 0:  páginas 10-13  (1 válido o 14 basura)              │
│     Slot 1:  páginas 14-17                                      │
│     Slot 2:  páginas 18-21                                      │
│     ...                                                         │
│     Slot 14: páginas 66-69                                      │
│                                                                 │
│   Slots 15-29: 15 copias de RESPALDO (doble redundancia)        │
│     Slot 15: páginas 70-73  (backup del slot 0)                 │
│     Slot 16: páginas 74-77  (backup del slot 1)                 │
│     ...                                                         │
│     Slot 29: páginas 126-129 (backup del slot 14)               │
├─────────────────────────────────────────────────────────────────┤
│ Página 130:    Dynamic lock bytes (OTP)                         │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 131-134: Configuración                                  │
│   131: MIRROR, AUTH0=10 (proteger desde página 10)              │
│   132: ACCESS (PROT=1: leer+escribir requieren PWD)             │
│   133: PWD (32 bits, única por tarjeta)                         │
│   134: PACK (16 bits)                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Cálculo de páginas por slot

Cada slot ocupa 4 páginas (16 bytes = 1 certificado):

| Slot | Páginas | Tipo |
|------|---------|------|
| 0 | 10-13 | Activo |
| 1 | 14-17 | Activo |
| 2 | 18-21 | Activo |
| 3 | 22-25 | Activo |
| 4 | 26-29 | Activo |
| 5 | 30-33 | Activo |
| 6 | 34-37 | Activo |
| 7 | 38-41 | Activo |
| 8 | 42-45 | Activo |
| 9 | 46-49 | Activo |
| 10 | 50-53 | Activo |
| 11 | 54-57 | Activo |
| 12 | 58-61 | Activo |
| 13 | 62-65 | Activo |
| 14 | 66-69 | Activo |
| 15 | 70-73 | Backup del 0 |
| 16 | 74-77 | Backup del 1 |
| 17 | 78-81 | Backup del 2 |
| 18 | 82-85 | Backup del 3 |
| 19 | 86-89 | Backup del 4 |
| 20 | 90-93 | Backup del 5 |
| 21 | 94-97 | Backup del 6 |
| 22 | 98-101 | Backup del 7 |
| 23 | 102-105 | Backup del 8 |
| 24 | 106-109 | Backup del 9 |
| 25 | 110-113 | Backup del 10 |
| 26 | 114-117 | Backup del 11 |
| 27 | 118-121 | Backup del 12 |
| 28 | 122-125 | Backup del 13 |
| 29 | 126-129 | Backup del 14 |

**Fórmula:** `página_inicial = 10 + (slot * 4)`

### Zona pública (páginas 4-9)

La zona pública no requiere PWD. Contiene:

| Página | Bytes | Contenido |
|--------|-------|-----------|
| 4 | 0-3 | custom_card_id (bytes 0-3) |
| 5 | 0-3 | custom_card_id (bytes 4-7) |
| 6 | 0-3 | node_domain hash (bytes 0-3) |
| 7 | 0-3 | node_domain hash (bytes 4-7) |
| 8 | 0-3 | user_reference (bytes 0-3) |
| 9 | 0-2 | user_reference (bytes 4-6) |
| 9 | 3 | versión protocolo (0x01 = NTAG215 v1) |

El `custom_card_id` es un identificador único generado por el servidor,
diferente del UID de fábrica. Permite identificar la tarjeta sin necesidad
de autenticación. No contiene información sensible.

## 3. Modelo de seguridad (6 capas)

### Capa 1: PWD única por tarjeta

- Cada tarjeta tiene su propia PWD de 32 bits generada con `crypto/rand`.
- La PWD se guarda en el servidor encriptada con la master key del nodo.
- El POS la recibe encriptada (AES-256-GCM) por transacción.
- Solo el servidor sabe la PWD de cada tarjeta.
- Si vulneran una tarjeta, la PWD no sirve para otras.

### Capa 2: 30 certificados con doble redundancia

- 15 slots activos + 15 slots de respaldo = 30 certificados.
- Solo 1 slot activo tiene el certificado válido.
- Los otros 14 slots activos tienen basura aleatoria.
- Los 15 slots de respaldo tienen copias del cert activo.
- Solo el servidor sabe cuál slot es el activo.
- Un atacante que copie toda la memoria no sabe cuál cert es el válido.

### Capa 3: Rotación aleatoria por transacción

- Cada transacción rota el certificado a un slot aleatorio diferente.
- El slot viejo pasa a basura.
- El slot nuevo se escribe con el cert nuevo.
- El backup correspondiente también se actualiza.
- No es secuencial — el atacante no puede predecir el próximo slot.

### Capa 4: 2FA (documento + PIN + tarjeta)

- El cliente debe presentar documento de identidad + PIN + tarjeta física.
- El documento se verifica contra la BD del usuario.
- El PIN se hashea con bcrypt.
- La tarjeta debe estar registrada y activa.

### Capa 5: PWD en tránsito minimizada

- Solo 1 PWD viaja por transacción (encriptada con AES-256-GCM).
- No hay claves A/B separadas como en Classic.
- La PWD se envía solo después de validar documento + PIN + saldo.

### Capa 6: Aislamiento entre tarjetas

- Cada tarjeta tiene PWD única.
- Cada tarjeta tiene 30 certificados únicos.
- Si vulneran una tarjeta, no sirve para acceder a otras.

### Capa 7: Zona pública con custom_card_id

- El `custom_card_id` se graba permanentemente en la zona pública.
- Permite identificar la tarjeta sin PWD.
- No contiene información sensible (solo identificación).
- Es adicional al UID de fábrica.

## 4. Flujo de provisionamiento (2 pasos)

### Paso 1: Registro en servidor (web admin)

El admin registra la tarjeta en el servidor:

```
POST /api/nfc/cards/provision-ntag215
{
  "user_id": "uuid...",
  "card_uid": "AABBCCDD",  // leído del teléfono o lector
  "initial_pin": "1234"
}
```

El servidor:
1. Genera PWD aleatoria de 32 bits (crypto/rand).
2. Genera PACK aleatorio de 16 bits.
3. Genera `custom_card_id` único (8 bytes).
4. Genera 30 certificados aleatorios de 16 bytes cada uno.
5. Marca un slot aleatorio (0-14) como activo con su certificado.
6. Copia el cert activo al backup correspondiente (slot 15-29).
7. Guarda todo en `nfc_ntag215_slots` y `nfc_cards`.
8. Retorna la data para que el POS escriba físicamente.

Respuesta:
```json
{
  "card_uid": "AABBCCDD",
  "password": "a1b2c3d4",
  "pack": "e5f6",
  "auth0": 10,
  "custom_card_id": "0102030405060708",
  "slots": [
    {"slot_number": 0, "certificate": "...", "is_active": false, "is_backup": false},
    {"slot_number": 1, "certificate": "...", "is_active": true,  "is_backup": false},
    ...
    {"slot_number": 15, "certificate": "...", "is_active": false, "is_backup": true, "backup_of_slot": 0},
    ...
  ]
}
```

### Paso 2: Grabado físico (POS Android)

El POS Android escribe físicamente la tarjeta:

1. Detectar NTAG215 via `NfcA` + `GET_VERSION`.
2. Leer UID (páginas 0-1) → verificar coincide con `card_uid`.
3. Escribir zona pública (páginas 4-9) con `custom_card_id`, `node_domain`, `user_reference`.
4. Escribir los 30 slots en las páginas 10-129.
5. Escribir configuración:
   - Página 131: AUTH0 = 10 (proteger desde página 10)
   - Página 132: ACCESS con PROT=1 (leer+escribir protegidos)
   - Página 133: PWD
   - Página 134: PACK
6. Verificar escritura re-leyendo páginas críticas.
7. Confirmar inicialización con el servidor.

**Importante:** Una vez escrita la configuración (PWD), las páginas 10+ requieren
PWD_AUTH para leer/escribir. El POS debe autenticarse antes de verificar.

## 5. Flujo de pago

### Diagrama de secuencia

```
COMERCIANTE          POS Android              Servidor                Tarjeta
    │                    │                       │                       │
    │ 1. Ingresa monto   │                       │                       │
    │───────────────────>│                       │                       │
    │                    │                       │                       │
    │ 2. Pide doc+PIN    │                       │                       │
    │<───────────────────│                       │                       │
    │                    │                       │                       │
    │ 3. Cliente ingresa │                       │                       │
    │    doc + PIN       │                       │                       │
    │───────────────────>│                       │                       │
    │                    │                       │                       │
    │                    │ 4. Pre-auth (encrypt) │                       │
    │                    │──────────────────────>│                       │
    │                    │                       │                       │
    │                    │                       │ Valida usuario        │
    │                    │                       │ Verifica PIN          │
    │                    │                       │ Verifica saldo        │
    │                    │                       │ Busca tarjeta NTAG215 │
    │                    │                       │ Genera nuevo cert     │
    │                    │                       │ Elige slot aleatorio  │
    │                    │                       │ Guarda pre-aprobación │
    │                    │                       │ (TTL 30s)             │
    │                    │                       │                       │
    │                    │ 5. Respuesta (encrypt)│                       │
    │                    │<──────────────────────│                       │
    │                    │   {                   │                       │
    │                    │    pre_approved: true,│                       │
    │                    │    card_type: "ntag215",                      │
    │                    │    card_uid: "...",   │                       │
    │                    │    password: "...",   │                       │
    │                    │    pack: "...",       │                       │
    │                    │    read_slot: 3,      │                       │
    │                    │    expected_cert: "...",                      │
    │                    │    write_slot: 9,     │                       │
    │                    │    backup_slot: 24,   │                       │
    │                    │    new_cert: "..."    │                       │
    │                    │   }                   │                       │
    │                    │                       │                       │
    │ 6. "ACERQUE TARJETA"                       │                       │
    │<───────────────────│                       │                       │
    │                    │                       │                       │
    │                    │ 7. Cliente acerca tarjeta ──────────────────>│
    │                    │                       │                       │
    │                    │ 8. Lee UID ──────────────────────────────────>│
    │                    │<────────────────────────────────── UID        │
    │                    │                       │                       │
    │                    │ 9. Verifica UID = card_uid                    │
    │                    │                       │                       │
    │                    │ 10. PWD_AUTH(password)──────────────────────>│
    │                    │<────────────────────────────────── PACK       │
    │                    │                       │                       │
    │                    │ 11. Verifica PACK                            │
    │                    │                       │                       │
    │                    │ 12. Lee slot 3 (4 páginas)──────────────────>│
    │                    │<────────────────────────────────── 16 bytes   │
    │                    │                       │                       │
    │                    │ 13. Verifica = expected_cert                 │
    │                    │                       │                       │
    │                    │ 14. Escribe new_cert slot 9 (4 páginas)─────>│
    │                    │ 15. Escribe new_cert backup 24 (4 páginas)──>│
    │                    │                       │                       │
    │                    │ 16. Re-lee slot 9 ──────────────────────────>│
    │                    │<────────────────────────────────── 16 bytes   │
    │                    │                       │                       │
    │                    │ 17. Verifica escritura                       │
    │                    │                       │                       │
    │                    │ 18. Confirma (encrypt)│                       │
    │                    │──────────────────────>│                       │
    │                    │   {                   │                       │
    │                    │    card_uid: "...",   │                       │
    │                    │    read_ok: true,     │                       │
    │                    │    write_ok: true,    │                       │
    │                    │    written_pages: 8   │                       │
    │                    │   }                   │                       │
    │                    │                       │                       │
    │                    │                       │ Busca pre-aprobación  │
    │                    │                       │ Verifica no expiró    │
    │                    │                       │ Procesa pago          │
    │                    │                       │ Rota certificados:    │
    │                    │                       │   slot 3 → inactivo   │
    │                    │                       │   slot 9 → activo     │
    │                    │                       │   backup 24 → actuali │
    │                    │                       │ Registra transacción  │
    │                    │                       │                       │
    │                    │ 19. Resultado pago    │                       │
    │                    │<──────────────────────│                       │
    │                    │                       │                       │
    │ 20. Muestra resultado                       │                       │
    │<───────────────────│                       │                       │
```

### Detalle de cada paso

#### Pasos 1-3: Entrada de datos

El comerciante ingresa el monto. El POS pide documento de identidad y PIN
al cliente. El cliente los ingresa sin necesidad de la tarjeta.

#### Paso 4: Pre-autenticación (encriptado)

El POS envía al servidor (encriptado con AES-256-GCM via EphemeralMessage):

```json
{
  "terminal_id": "TERM-001",
  "doc_type": "cedula_v",
  "doc_number": "V-12345678",
  "pin": "1234",
  "amount": 5000
}
```

#### Paso 5: Respuesta del servidor

El servidor valida:
1. Usuario existe y tiene el documento.
2. PIN correcto (bcrypt compare).
3. Saldo suficiente (balance - amount >= credit_limit).
4. Tarjeta NTAG215 activa del usuario.
5. Slot activo actual.

Genera:
- Nuevo certificado aleatorio de 16 bytes.
- Slot de escritura aleatorio (0-14, != slot activo).
- Slot de backup correspondiente (write_slot + 15).

Responde (encriptado):
```json
{
  "pre_approved": true,
  "card_type": "ntag215",
  "card_uid": "AABBCCDD",
  "password": "a1b2c3d4",
  "pack": "e5f6",
  "read_slot": 3,
  "expected_certificate": "11223344556677889900aabbccddeeff",
  "write_slot": 9,
  "backup_slot": 24,
  "new_certificate": "ffeeddccbbaa00998877665544332211"
}
```

#### Pasos 6-13: Lectura y verificación

El POS muestra "ACERQUE SU TARJETA — No la retire".

Al detectar la tarjeta:
1. Lee UID (páginas 0-1, sin PWD).
2. Verifica UID = `card_uid` de la pre-aprobación.
3. Envía `PWD_AUTH` con la password recibida.
4. Recibe PACK y verifica coincide.
5. Lee el slot 3 (páginas 22-25, 4 páginas = 16 bytes).
6. Verifica que el cert leído = `expected_certificate`.

Si cualquiera falla → rechazar, no procesar pago.

#### Pasos 14-17: Escritura y verificación

1. Escribe `new_certificate` en slot 9 (páginas 46-49, 4 escrituras de 4 bytes).
2. Escribe `new_certificate` en backup slot 24 (páginas 106-109, 4 escrituras).
3. Re-lee slot 9 para verificar la escritura.
4. Si la verificación falla → no confirmar, el servidor no procesa el pago.

#### Paso 18: Confirmación

El POS envía (encriptado):
```json
{
  "card_uid": "AABBCCDD",
  "read_ok": true,
  "write_ok": true,
  "written_pages": 8
}
```

#### Paso 19: Procesamiento

El servidor:
1. Busca la pre-aprobación pendiente (TTL 30s).
2. Verifica que no haya expirado.
3. Si `read_ok` y `write_ok` son true:
   - Procesa el pago (transfiere saldo).
   - Rota certificados:
     - Slot 3 → `is_active = false` (cert viejo = basura).
     - Slot 9 → `is_active = true`, `certificate = new_cert`.
     - Backup slot 24 → `certificate = new_cert`.
   - Registra la transacción.
4. Si `read_ok` o `write_ok` son false:
   - No procesa el pago.
   - Marca la tarjeta para reparación si `written_pages < 8`.
   - Retorna error.

## 6. Recuperación de escritura interrumpida

### Escenario: tarjeta retirada durante escritura

Si el cliente retira la tarjeta antes de que terminen las 8 escrituras
(4 del slot + 4 del backup):

1. El POS detecta `IOException` (tag perdido).
2. El POS NO envía confirmación al servidor.
3. La pre-aprobación expira después de 30 segundos.
4. El servidor NO procesa el pago.
5. El slot 9 puede quedar parcialmente escrito.

### Reparación automática

En la próxima transacción del usuario:
1. El servidor busca el slot activo actual (slot 3 en el ejemplo).
2. El POS lee el slot activo y verifica el cert.
3. Si el slot activo está intacto → transacción normal.
4. Si el slot activo está corrupto → el servidor busca en los backups.
5. Si un backup tiene el cert correcto → usa ese backup como activo.
6. Si ningún slot tiene el cert correcto → tarjeta bloqueada, requiere re-emisión.

### Detección de escritura parcial

El campo `written_pages` en `nfc_ntag215_slots` indica cuántas páginas
se confirmaron escribir:
- 0 = no se escribió.
- 1-3 = escritura parcial.
- 4 = slot completo.
- `needs_repair = true` si `written_pages < 4`.

En la próxima transacción, el servidor puede:
- Re-escribir el slot parcial si es el slot activo.
- Ignorar el slot parcial si no es el activo (es basura de todos modos).

## 7. Comparación con MIFARE Classic

| Aspecto | MIFARE Classic 1K | NTAG215 |
|---------|-------------------|---------|
| Claves/sectores | 30 claves (A+B × 15 sectores) | 1 PWD para toda la zona privada |
| Slots de cert | 15 (triple redundancia = 45 copias) | 15 + 15 backup (doble redundancia = 30 copias) |
| Memoria útil | 720 bytes (15×48) | 480 bytes (30×16) |
| Compatibilidad teléfonos | Parcial (no Pixel, no iOS) | Universal (todos los teléfonos) |
| Criptografía | Crypto1 (roto desde 2008) | PWD de 32 bits (simple pero funcional) |
| Zona pública | No (todo requiere clave) | Sí (páginas 4-9 sin PWD) |
| Corruption risk | Alta (sector trailer) | Baja (no hay trailer, solo páginas planas) |
| Detección Android | `MifareClassic` (no en todos) | `NfcA` + `GET_VERSION` (universal) |
| Precio | $0.08 | $0.15 |
| Disponibilidad Venezuela | Sí | Sí |

### Ventajas de NTAG215 sobre Classic

1. **Compatible con TODOS los teléfonos** — resuelve el problema principal.
2. **Sin sector trailer** — no hay riesgo de corromper access bits.
3. **Zona pública** — permite identificación sin PWD.
4. **PWD única por tarjeta** — más simple que 30 claves.
5. **Escritura más confiable** — páginas planas, no sectores con trailers.

### Desventajas de NTAG215 vs Classic

1. **Menos redundancia** — doble (2 copias) vs triple (3 copias).
2. **PWD de 32 bits** — más débil que Crypto1 en teoría, pero Crypto1 está roto.
3. **Una sola PWD** — si se vulnera, toda la zona privada queda expuesta.
   En Classic, vulnerar un sector no expone los otros.

### Conclusión

NTAG215 es **mejor que Classic para uso con teléfonos** porque:
- La compatibilidad universal es más importante que la diferencia criptográfica.
- Crypto1 está tan roto que la PWD de 32 bits es igualmente débil en la práctica.
- Ambas dependen de los certificados rotativos y 2FA para seguridad real.
- NTAG215 no tiene el riesgo de corrupción del sector trailer.

## 8. Limitaciones de seguridad (importante)

### NTAG215 NO tiene AES

NTAG215 usa PWD de 32 bits, que es una contraseña simple, no criptografía
simétrica real. **No es equivalente a AES-128 ni a 3DES.**

### PWD viaja en claro por RF

La PWD se envía con el comando `PWD_AUTH` y puede ser interceptada con
equipo especializado. Esto es similar a Classic donde las claves también
se pueden recuperar.

### No hay secure messaging

Después de `PWD_AUTH`, la comunicación es en plaintext. Un atacante con
equipo podría modificar datos en tránsito (Man-in-the-Middle).

### Clonación de memoria pública

Las páginas 4-9 (zona pública) son legibles sin PWD. Un atacante puede
copiar el `custom_card_id`, pero no los certificados (páginas 10+).

### Clonación con PWD conocida

Si un atacante obtiene la PWD (por interceptación o brute force con
AUTHLIM deshabilitado), puede leer y copiar toda la memoria. La defensa
es:
- `AUTHLIM` configurado para limitar intentos.
- Certificados rotativos (el atacante no sabe cuál es el válido).
- 2FA (documento + PIN + tarjeta).
- Detección de uso simultáneo (servidor).

### Recomendación de alta seguridad

Para aplicaciones que requieren seguridad criptográfica real, usar
**DESFire EV3** o **NTAG424 DNA** con AES-128. NTAG215 es una solución
práctica de seguridad media, no alta.

## 9. Configuración de la tarjeta

### AUTH0

`AUTH0 = 10` — la protección por PWD comienza en la página 10.
Las páginas 0-9 son libremente legibles sin PWD.

### ACCESS (PROT)

`PROT = 1` — tanto lectura como escritura de las páginas 10+ requieren PWD.
Esto impide que un atacante lea los certificados sin la PWD.

### AUTHLIM

`AUTHLIM = 3` — máximo 3 intentos de autenticación fallidos antes de
bloquear el acceso a la zona protegida. Previene brute force de la PWD.

### PWD y PACK

- `PWD`: 32 bits aleatorios, única por tarjeta, generada con `crypto/rand`.
- `PACK`: 16 bits aleatorios, usado para verificar que el `PWD_AUTH` fue exitoso.
- Ambos se guardan en el servidor (PWD encriptada, PACK en claro).

### Dynamic lock bytes (página 130)

No se bloquean permanentemente las páginas de datos durante el
provisionamiento. El bloqueo permanente haría imposible la rotación de
certificados. Solo se bloquean si se quiere hacer la tarjeta read-only
después de su vida útil (no es el caso normal).

## 10. Endpoints API

### Provisionamiento

```
POST /api/nfc/cards/provision-ntag215
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "uuid",
  "card_uid": "AABBCCDD",
  "initial_pin": "1234"
}
```

Respuesta:
```json
{
  "card_uid": "AABBCCDD",
  "password": "a1b2c3d4",
  "pack": "e5f6",
  "auth0": 10,
  "custom_card_id": "0102030405060708",
  "slots": [...]
}
```

### Pre-autenticación

```
POST /api/nfc/terminal/ntag215/pre-auth
Content-Type: application/json
(encryptado con AES-256-GCM via EphemeralMessage)

{
  "terminal_id": "TERM-001",
  "doc_type": "cedula_v",
  "doc_number": "V-12345678",
  "pin": "1234",
  "amount": 5000
}
```

Respuesta (encriptada):
```json
{
  "pre_approved": true,
  "card_type": "ntag215",
  "card_uid": "AABBCCDD",
  "password": "a1b2c3d4",
  "pack": "e5f6",
  "read_slot": 3,
  "expected_certificate": "11223344556677889900aabbccddeeff",
  "write_slot": 9,
  "backup_slot": 24,
  "new_certificate": "ffeeddccbbaa00998877665544332211"
}
```

### Confirmación

```
POST /api/nfc/terminal/ntag215/confirm
Content-Type: application/json
(encryptado con AES-256-GCM via EphemeralMessage)

{
  "terminal_id": "TERM-001",
  "card_uid": "AABBCCDD",
  "read_ok": true,
  "write_ok": true,
  "written_pages": 8
}
```

Respuesta:
```json
{
  "status": "approved",
  "transaction_id": "uuid",
  "new_balance": 4500,
  "message": "pago procesado correctamente"
}
```
