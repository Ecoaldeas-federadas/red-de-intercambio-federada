# Protocolo de certificados dinámicos rotativos para MIFARE Ultralight C

> Especificación del protocolo de seguridad para tarjetas MIFARE Ultralight C
> en el Sistema TQ / Red de Intercambio Federada.
>
> Ultralight C se incluye marcada como **"baja capacidad"** porque:
> - Tiene mejor criptografía que MIFARE Classic (3DES 112-bit vs Crypto1 roto)
> - Pero solo 148 bytes de memoria = 8 slots (4 activos + 4 backups)
> - Recomendada solo si no se consigue NTAG215

## 1. Especificaciones de la tarjeta

| Aspecto | Valor |
|---------|-------|
| Fabricante | NXP Semiconductors |
| Estándar | NFC Forum Type 2, ISO/IEC 14443 Type A |
| Memoria total | 192 bytes (48 páginas de 4 bytes) |
| Memoria de usuario | 148 bytes (37 páginas) |
| Seguridad | 3DES con clave de 112 bits (2-key 3DES) |
| Autenticación | Mutua (3-pass) |
| Secure messaging | No (comunicación post-auth en plaintext) |
| Retención de datos | 5 años |
| Ciclos de escritura | 10,000 |
| Capacidad | **low** (baja — solo 8 slots) |

### Comandos NFC relevantes

| Comando | Descripción |
|---------|-------------|
| READ | Lee 4 páginas (16 bytes) |
| WRITE | Escribe 1 página (4 bytes) |
| COMPATIBILITY_WRITE | Write compatible |
| AUTH-1 (3DES) | Autenticación mutua 3-pass con 3DES |

### Detección desde Android

Ultralight C se detecta via `MifareUltralight` (si el teléfono lo soporta)
o via `NfcA`:

```kotlin
// Opción 1: MifareUltralight (si está soportado)
val ultralight = MifareUltralight.get(tag)
if (ultralight != null) {
    val type = ultralight.type
    if (type == MifareUltralight.TYPE_ULTRALIGHT_C) {
        // Es Ultralight C
    }
}

// Opción 2: NfcA + GET_VERSION (fallback)
val nfcA = NfcA.get(tag)
nfcA.connect()
// Enviar comando de autenticación 3DES para verificar
```

**Importante:** La implementación de `MifareUltralight` es **opcional** en
Android. Algunos teléfonos no la soportan. En ese caso, se puede usar
`NfcA` con comandos raw, pero la autenticación 3DES debe implementarse
manualmente.

## 2. Comparación criptográfica: Ultralight C vs Classic

| Aspecto | MIFARE Classic | Ultralight C |
|---------|---------------|--------------|
| Algoritmo | Crypto1 (propietario) | 3DES (estándar) |
| Longitud de clave | 48 bits | 112 bits (2-key 3DES) |
| Seguridad efectiva | ~0 (roto desde 2008) | ~80 bits |
| Ataques conocidos | Nested/Hardnested recupera claves en segundos | Keyspace reduction a 2^28 |
| Autenticación | Mutua (3-pass) | Mutua (3-pass) |
| Secure messaging | No | No |
| Multi-clave | Sí (2 por sector × 15 sectores = 30) | No (1 clave para toda la tarjeta) |

**Conclusión:** Ultralight C tiene criptografía **MÁS FUERTE** que Classic.
3DES de 112 bits es un algoritmo estándar serio, mientras que Crypto1 es
un cipher propietario de 48 bits completamente roto.

## 3. Estructura de memoria

```
┌─────────────────────────────────────────────────────────────────┐
│ Páginas 0-1:   UID + manufacturer data (read-only) — NO TOCAR   │
├─────────────────────────────────────────────────────────────────┤
│ Página 2:      Lock bytes (OTP, interno) — NO TOCAR              │
├─────────────────────────────────────────────────────────────────┤
│ Página 3:      OTP + internal (read-only) — NO TOCAR             │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 4-7:   ZONA PÚBLICA (16 bytes, sin auth)                │
│   4-5: custom_card_id (8 bytes, nuestro ID personalizado)       │
│   6-7: node_domain hash (8 bytes)                               │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 8-39:  ZONA PRIVADA (32 páginas = 8 slots de 16 bytes)  │
│                                                                 │
│   Slots 0-3:  4 certificados ACTIVOS                            │
│     Slot 0: páginas 8-11  (1 válido o 3 basura)                 │
│     Slot 1: páginas 12-15                                       │
│     Slot 2: páginas 16-19                                       │
│     Slot 3: páginas 20-23                                       │
│                                                                 │
│   Slots 4-7:  4 copias de RESPALDO (doble redundancia)          │
│     Slot 4: páginas 24-27 (backup del slot 0)                   │
│     Slot 5: páginas 28-31 (backup del slot 1)                   │
│     Slot 6: páginas 32-35 (backup del slot 2)                   │
│     Slot 7: páginas 36-39 (backup del slot 3)                   │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 40-43: Lock bytes, counters, auth config (readable)     │
├─────────────────────────────────────────────────────────────────┤
│ Páginas 44-47: 3DES key (16 bytes, NO legible)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cálculo de páginas por slot

Cada slot ocupa 4 páginas (16 bytes = 1 certificado):

| Slot | Páginas | Tipo |
|------|---------|------|
| 0 | 8-11 | Activo |
| 1 | 12-15 | Activo |
| 2 | 16-19 | Activo |
| 3 | 20-23 | Activo |
| 4 | 24-27 | Backup del 0 |
| 5 | 28-31 | Backup del 1 |
| 6 | 32-35 | Backup del 2 |
| 7 | 36-39 | Backup del 3 |

**Fórmula:** `página_inicial = 8 + (slot * 4)`

### Zona pública (páginas 4-7)

| Página | Bytes | Contenido |
|--------|-------|-----------|
| 4 | 0-3 | custom_card_id (bytes 0-3) |
| 5 | 0-3 | custom_card_id (bytes 4-7) |
| 6 | 0-3 | node_domain hash (bytes 0-3) |
| 7 | 0-3 | node_domain hash (bytes 4-7) |

El `custom_card_id` es un identificador único generado por el servidor,
diferente del UID de fábrica.

## 4. Modelo de seguridad (6 capas)

### Capa 1: Clave 3DES única por tarjeta

- Cada tarjeta tiene su propia clave 3DES de 112 bits generada con `crypto/rand`.
- La clave se guarda en el servidor encriptada con la master key del nodo.
- El POS la recibe encriptada (AES-256-GCM) por transacción.
- Solo el servidor sabe la clave de cada tarjeta.

### Capa 2: 8 certificados con doble redundancia

- 4 slots activos + 4 slots de respaldo = 8 certificados.
- Solo 1 slot activo tiene el certificado válido.
- Los otros 3 slots activos tienen basura aleatoria.
- Los 4 slots de respaldo tienen copias del cert activo.
- Solo el servidor sabe cuál slot es el activo.

### Capa 3: Rotación aleatoria por transacción

- Cada transacción rota el certificado a un slot aleatorio diferente.
- El slot viejo pasa a basura.
- El slot nuevo se escribe con el cert nuevo.
- El backup correspondiente también se actualiza.

### Capa 4: 2FA (documento + PIN + tarjeta)

- El cliente debe presentar documento de identidad + PIN + tarjeta física.
- El documento se verifica contra la BD del usuario.
- El PIN se hashea con bcrypt.

### Capa 5: Clave en tránsito minimizada

- Solo 1 clave 3DES viaja por transacción (encriptada con AES-256-GCM).
- La clave se envía solo después de validar documento + PIN + saldo.

### Capa 6: Aislamiento entre tarjetas

- Cada tarjeta tiene clave 3DES única.
- Cada tarjeta tiene 8 certificados únicos.

## 5. Autenticación 3DES (3-pass mutual auth)

A diferencia de NTAG215 (que usa PWD_AUTH simple), Ultralight C usa
autenticación mutua de 3 pasos con 3DES:

```
POS                          Tarjeta
 │                              │
 │ 1. AUTH-1 (comando)         │
 │─────────────────────────────>│
 │                              │
 │ 2. RndB (encrypted)         │
 │<─────────────────────────────│
 │   (tarjeta genera RndB,     │
 │    la encripta con 3DES     │
 │    y la envía)              │
 │                              │
 │ 3. POS desencripta RndB     │
 │    Genera RndA              │
 │    Calcula RndA || RndB'    │
 │    Encripta con 3DES        │
 │    Envía a tarjeta          │
 │─────────────────────────────>│
 │                              │
 │ 4. Tarjeta desencripta      │
 │    Verifica RndB'           │
 │    Calcula RndA'            │
 │    Encripta con 3DES        │
 │    Envía RndA' (encrypted)  │
 │<─────────────────────────────│
 │                              │
 │ 5. POS desencripta RndA'    │
 │    Verifica = RndA          │
 │    → Autenticación exitosa  │
 │                              │
```

Después de la autenticación, el POS puede leer y escribir las páginas
protegidas. **Nota:** La comunicación post-autenticación es en plaintext
(sin secure messaging). Esto es una limitación de Ultralight C.

## 6. Flujo de provisionamiento (2 pasos)

### Paso 1: Registro en servidor

```
POST /api/nfc/cards/provision-ultralight-c
{
  "user_id": "uuid...",
  "card_uid": "AABBCCDD",
  "initial_pin": "1234"
}
```

El servidor:
1. Genera clave 3DES aleatoria de 16 bytes (112 bits efectivos).
2. Genera `custom_card_id` único (8 bytes).
3. Genera 8 certificados aleatorios de 16 bytes cada uno.
4. Marca un slot aleatorio (0-3) como activo con su certificado.
5. Copia el cert activo al backup correspondiente (slot 4-7).
6. Guarda todo en `nfc_ultralight_c_slots` y `nfc_cards`.
7. Retorna la data para que el POS escriba físicamente.

Respuesta:
```json
{
  "card_uid": "AABBCCDD",
  "des_key": "0102030405060708090a0b0c0d0e0f10",
  "custom_card_id": "0102030405060708",
  "slots": [
    {"slot_number": 0, "certificate": "...", "is_active": false, "is_backup": false},
    {"slot_number": 1, "certificate": "...", "is_active": true,  "is_backup": false},
    {"slot_number": 2, "certificate": "...", "is_active": false, "is_backup": false},
    {"slot_number": 3, "certificate": "...", "is_active": false, "is_backup": false},
    {"slot_number": 4, "certificate": "...", "is_active": false, "is_backup": true, "backup_of_slot": 0},
    {"slot_number": 5, "certificate": "...", "is_active": false, "is_backup": true, "backup_of_slot": 1},
    {"slot_number": 6, "certificate": "...", "is_active": false, "is_backup": true, "backup_of_slot": 2},
    {"slot_number": 7, "certificate": "...", "is_active": false, "is_backup": true, "backup_of_slot": 3}
  ]
}
```

### Paso 2: Grabado físico (POS Android)

1. Detectar Ultralight C via `MifareUltralight` o `NfcA`.
2. Leer UID (páginas 0-1) → verificar coincide con `card_uid`.
3. Autenticarse con 3DES (3-pass mutual auth).
4. Escribir zona pública (páginas 4-7) con `custom_card_id` y `node_domain`.
5. Escribir los 8 slots en las páginas 8-39.
6. Escribir la clave 3DES en las páginas 44-47 (solo durante personalización).
7. Verificar escritura re-leyendo páginas críticas.
8. Confirmar inicialización con el servidor.

**Importante:** La clave 3DES se escribe en las páginas 44-47 durante la
personalización. Estas páginas **no son legibles** después de escribirse.
La clave solo se puede cambiar, no leer.

## 7. Flujo de pago

### Resumen del flujo

```
1. COMERCIANTE ingresa monto
2. CLIENTE ingresa documento + PIN (sin tarjeta)
3. POS envía pre-auth al servidor (encriptado)
4. Servidor valida → busca tarjeta Ultralight C → driver.PreAuth()
5. Servidor responde (encriptado):
   {
     pre_approved: true,
     card_type: "ultralight_c",
     card_uid: "AABBCCDD",
     des_key: "hex...",            // clave 3DES (16 bytes)
     read_slot: 1,                 // slot a leer (0-3)
     expected_certificate: "hex...",
     write_slot: 3,                // slot a escribir (0-3, != 1)
     backup_slot: 7,               // slot de respaldo (4-7)
     new_certificate: "hex..."
   }
6. POS muestra: "ACERQUE SU TARJETA — No la retire"
7. POS lee UID → verifica = card_uid
8. POS autentica con 3DES (3-pass mutual auth)
9. POS lee slot 1 (4 páginas) → verifica = expected_certificate
10. POS escribe new_certificate en slot 3 (4 páginas)
11. POS escribe new_certificate en backup slot 7 (4 páginas)
12. POS re-lee slot 3 → verifica escritura
13. POS confirma: {card_uid, read_ok, write_ok, written_pages}
14. Servidor procesa pago y rota certificados
15. POS muestra resultado
```

### Diferencias con NTAG215

| Aspecto | NTAG215 | Ultralight C |
|---------|---------|--------------|
| Autenticación | PWD_AUTH (simple) | 3DES 3-pass (mutua) |
| Slots | 30 (15+15) | 8 (4+4) |
| Confusión atacante | 15 opciones | 4 opciones |
| Criptografía | PWD 32-bit | 3DES 112-bit |
| Secure messaging | No | No |
| Memoria | 504 B | 148 B |

## 8. Recuperación de escritura interrumpida

Igual que NTAG215, si el cliente retira la tarjeta durante la escritura:

1. El POS detecta `IOException`.
2. El POS NO envía confirmación.
3. La pre-aprobación expira (30s).
4. El servidor NO procesa el pago.
5. El slot puede quedar parcialmente escrito.

En la próxima transacción:
- Si el slot activo está intacto → transacción normal.
- Si el slot activo está corrupto → buscar en backups.
- Si un backup tiene el cert correcto → usar como activo.
- Si ningún slot tiene el cert → tarjeta bloqueada, re-emisión.

## 9. Limitaciones importantes

### Baja capacidad (8 slots)

Con solo 4 slots activos, el atacante tiene solo 4 opciones donde buscar
el cert válido (vs 15 en NTAG215). Esto reduce significativamente la
confusión. La mejor criptografía (3DES) compensa parcialmente, pero no
equivale a tener más slots.

### No secure messaging

Después de la autenticación 3DES, la comunicación es en plaintext.
Un atacante con equipo podría hacer Man-in-the-Middle. Esto es igual
que NTAG215 y Classic.

### Compatibilidad Android variable

La implementación de `MifareUltralight` es opcional en Android. Algunos
teléfonos no la soportan. Se puede usar `NfcA` con comandos raw, pero
requiere implementar la autenticación 3DES manualmente.

### Ciclos de escritura limitados

Ultralight C tiene solo 10,000 ciclos de escritura (vs 100,000 en NTAG215).
Con rotación de certificados por transacción, esto limita la vida útil
de la tarjeta a ~1,250 transacciones (8 slots × 10,000 / 8 páginas por
transacción). NTAG215 soporta ~12,500 transacciones en comparación.

### Retención de datos

Ultralight C retiene datos por 5 años (vs 10 años en NTAG215).

## 10. Cuándo usar Ultralight C

### Usar si:
- No se consigue NTAG215 en el momento.
- Se consigue Ultralight C a buen precio.
- Se prefiere mejor criptografía (3DES) sobre más slots.
- El volumen de transacciones es bajo (< 1,000 por tarjeta).

### No usar si:
- Se consigue NTAG215 (preferir siempre).
- El volumen de transacciones es alto (> 1,000).
- Se requiere máxima compatibilidad con todos los teléfonos.
- Se necesita larga retención de datos (> 5 años).

## 11. Endpoints API

### Provisionamiento

```
POST /api/nfc/cards/provision-ultralight-c
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "uuid",
  "card_uid": "AABBCCDD",
  "initial_pin": "1234"
}
```

### Pre-autenticación

```
POST /api/nfc/terminal/ultralight-c/pre-auth
(encryptado con AES-256-GCM via EphemeralMessage)

{
  "terminal_id": "TERM-001",
  "doc_type": "cedula_v",
  "doc_number": "V-12345678",
  "pin": "1234",
  "amount": 5000
}
```

### Confirmación

```
POST /api/nfc/terminal/ultralight-c/confirm
(encryptado con AES-256-GCM via EphemeralMessage)

{
  "terminal_id": "TERM-001",
  "card_uid": "AABBCCDD",
  "read_ok": true,
  "write_ok": true,
  "written_pages": 8
}
```
