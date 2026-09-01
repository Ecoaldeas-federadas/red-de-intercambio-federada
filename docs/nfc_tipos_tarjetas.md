# Catálogo completo de tipos de tarjetas NFC

> Documento de referencia para el sistema modular de drivers de tarjetas NFC.
> Cada tipo soportado tiene un driver Go, un reader Kotlin, un manifiesto JSON
> y una migración DB. Agregar una nueva tarjeta = agregar un archivo por capa.

## Criterio de inclusión

Una tarjeta se incluye en el sistema solo si cumple **TODOS** estos requisitos:

1. **Se puede escribir en ella** — no tarjetas read-only.
2. **Tiene seguridad criptográfica** (PWD, AES, 3DES o similar) — no tarjetas solo-UID.
3. **Tiene memoria suficiente para un protocolo de certificados rotativos**
   con al menos doble redundancia (slots activos + slots de respaldo).

### Tarjeta de referencia

**NTAG215** — 504 bytes de usuario, 30 slots (15 activos + 15 backups),
PWD de 32 bits, escribible, compatible con todos los teléfonos.

Es el mínimo aceptable. Todo lo que tenga menos memoria, menos slots, o no se
pueda escribir está excluido.

### Caso especial: MIFARE Ultralight C

Ultralight C tiene **criptografía MÁS FUERTE que MIFARE Classic**:

| Aspecto | MIFARE Classic | Ultralight C |
|---------|---------------|--------------|
| Algoritmo | Crypto1 (propietario) | 3DES (estándar) |
| Longitud de clave | 48 bits | 112 bits (2-key 3DES) |
| Seguridad efectiva | ~0 (roto desde 2008) | ~80 bits |
| Ataques conocidos | Nested/Hardnested recupera todas las claves en segundos | Keyspace reduction a 2^28, mucho más difícil |
| Autenticación | Mutua (3-pass) | Mutua (3-pass) |
| Secure messaging | No | No (comunicación post-auth en plaintext) |

Pero solo tiene **148 bytes de memoria** = 8 slots con doble redundancia
(4 activos + 4 backups) vs 30 slots en NTAG215.

**Decisión:** Se incluye marcada como `"capacity": "low"`. Recomendada solo si
no se consigue NTAG215. Su mejor criptografía (3DES) compensa parcialmente su
menor número de slots.

## Tarjetas soportadas

### Tier 1 — Compatible con todos los teléfonos + cumple requisitos mínimos

| # | Tarjeta | Memoria | Seguridad | Slots | Precio | Android | iOS | Capacidad | Driver |
|---|---------|---------|-----------|-------|--------|---------|-----|-----------|--------|
| 1 | **NTAG215** | 504 B | PWD 32-bit | 30 | $0.15 | ✅ | ✅ | full | `ntag215` ★ |
| 2 | NTAG216 | 888 B | PWD 32-bit | 55 | $0.20 | ✅ | ✅ | full | `ntag216` (futuro) |
| 3 | NTAG424 DNA | 416 B | AES-128+SUN | — | $0.50 | ✅ | ✅ | full | `ntag424` |
| 4 | DESFire EV3 | 4096 B | AES-128/256 | — | $1.50 | ✅ | ✅ | full | `desfire` |
| 5 | MIFARE Plus EV2 | 4096 B | AES-128 | — | $0.80 | ✅ | ✅ | full | `mifare_plus` (futuro) |
| 6 | Ultralight C | 148 B | 3DES 112-bit | 8 | $0.15 | ✅* | ✅* | **low** | `ultralight_c` |

★ = Recomendada como principal (disponible en Venezuela, compatible con todos los teléfonos)

*Ultralight C: implementación de `MifareUltralight` es opcional en Android.
Puede no funcionar en todos los teléfonos.

### Tier 2 — Requiere lector ESP32 (no funciona en todos los teléfonos)

| # | Tarjeta | Memoria | Seguridad | Slots | Precio | Android | iOS | Capacidad | Driver |
|---|---------|---------|-----------|-------|--------|---------|-----|-----------|--------|
| 7 | MIFARE Classic 1K | 1024 B | Crypto1 (roto) | 15 | $0.08 | Parcial** | ❌ | full | `classic` |
| 8 | MIFARE Classic 4K | 4096 B | Crypto1 (roto) | 75 | $0.12 | Parcial** | ❌ | full | `classic_4k` (futuro) |

**Classic: Samsung sí, Google Pixel no, la mayoría de chinos sí.
NO es estándar NFC Forum. Requiere lector ESP32 dedicado para garantizar
compatibilidad.

### Tier 3 — Largo alcance / especializado (ISO 15693)

| # | Tarjeta | Memoria | Seguridad | Precio | Android | iOS | Driver |
|---|---------|---------|-----------|--------|---------|-----|--------|
| 9 | ICODE SLIX2 | 320 B | PWD 32-bit | $0.15 | ✅ | ✅ | `icode_slix2` (futuro) |
| 10 | ST25DV | 4096 B | PWD 32-bit | $0.50 | ✅ | ✅ | `st25dv` (futuro) |

## Tarjetas EXCLUIDAS (no cumplen requisitos mínimos)

| Tarjeta | Razón de exclusión |
|---------|---------------------|
| UID-only | No se puede escribir credenciales. Sin seguridad. Solo UID clonable. |
| NTAG210 | 48 bytes — insuficiente para cualquier protocolo de slots |
| NTAG213 | 144 bytes — solo 9 slots sin redundancia, por debajo del mínimo |
| Ultralight EV1 | 48 bytes, sin cripto |
| Read-only | No se puede escribir |
| FeliCa | Propietario de Japón, no disponible en Venezuela |

## Especificaciones técnicas detalladas

### NTAG215 (principal)

- **Fabricante:** NXP Semiconductors
- **Estándar:** NFC Forum Type 2, ISO/IEC 14443 Type A
- **Memoria total:** 540 bytes (135 páginas de 4 bytes)
- **Memoria de usuario:** 504 bytes (126 páginas)
- **Seguridad:** PWD de 32 bits + PACK de 16 bits
- **AUTH0:** define primera página que requiere contraseña
- **PROT:** 0 = solo escritura protegida, 1 = lectura+escritura protegida
- **Compatibilidad:** Universal — todos los teléfonos Android y iOS
- **Disponibilidad Venezuela:** Sí
- **Precio aprox:** $0.15 USD

**Protocolo del sistema:**
- 30 slots (15 activos + 15 backups) con doble redundancia
- Zona pública (páginas 4-9) con custom_card_id
- Zona privada (páginas 10-129) protegida con PWD
- Rotación aleatoria por transacción
- Ver: `docs/tarjeta-ntag215-protocolo.md`

### NTAG216

- **Fabricante:** NXP Semiconductors
- **Estándar:** NFC Forum Type 2, ISO/IEC 14443 Type A
- **Memoria total:** 924 bytes (231 páginas de 4 bytes)
- **Memoria de usuario:** 888 bytes (222 páginas)
- **Seguridad:** PWD de 32 bits + PACK de 16 bits
- **Compatibilidad:** Universal — todos los teléfonos Android y iOS
- **Disponibilidad Venezuela:** Limitada
- **Precio aprox:** $0.20 USD

**Protocolo del sistema (futuro):**
- 55 slots (27 activos + 28 backups) con doble redundancia
- Más slots que NTAG215 = más confusión para el atacante
- Misma mecánica que NTAG215, solo cambia el número de slots

### NTAG424 DNA

- **Fabricante:** NXP Semiconductors
- **Estándar:** NFC Forum Type 4, ISO/IEC 14443-4
- **Memoria total:** 416 bytes en sistema de archivos
- **Seguridad:** AES-128 + SUN (Secure Unique Messaging)
- **Característica clave:** MAC dinámico por lectura (SUN)
- **Compatibilidad:** Universal — todos los teléfonos Android y iOS
- **Disponibilidad Venezuela:** Difícil de conseguir
- **Precio aprox:** $0.50 USD

**Protocolo del sistema:**
- Usa SUN MAC para autenticación criptográfica real
- No necesita certificados rotativos (el MAC ya es dinámico)
- Driver existente en el sistema

### DESFire EV3

- **Fabricante:** NXP Semiconductors
- **Estándar:** NFC Forum Type 4, ISO/IEC 14443-4
- **Memoria total:** 4096 bytes en sistema de archivos
- **Seguridad:** AES-128/192/256, 3DES, DES
- **Características:** Multi-aplicación, per-file access control
- **Certificación:** Common Criteria EAL5+
- **Compatibilidad:** Universal — todos los teléfonos Android y iOS
- **Disponibilidad Venezuela:** Muy difícil de conseguir
- **Precio aprox:** $1.50 USD

**Protocolo del sistema:**
- Autenticación AES-128 mutua
- No necesita certificados rotativos (AES es suficiente)
- Driver existente en el sistema

### MIFARE Plus EV2

- **Fabricante:** NXP Semiconductors
- **Estándar:** ISO/IEC 14443-4
- **Memoria total:** 2048 o 4096 bytes
- **Seguridad:** AES-128 (Security Level 3)
- **Compatibilidad:** Compatible hacia atrás con MIFARE Classic (SL1)
- **Certificación:** Common Criteria EAL5+
- **Disponibilidad Venezuela:** Difícil de conseguir
- **Precio aprox:** $0.80 USD

**Protocolo del sistema (futuro):**
- Usa AES-128 en SL3
- Migra de Classic a AES sin cambiar infraestructura
- Driver futuro

### MIFARE Ultralight C (baja capacidad)

- **Fabricante:** NXP Semiconductors
- **Estándar:** NFC Forum Type 2, ISO/IEC 14443 Type A
- **Memoria total:** 192 bytes (48 páginas de 4 bytes)
- **Memoria de usuario:** 148 bytes (37 páginas)
- **Seguridad:** 3DES con clave de 112 bits (2-key 3DES)
- **Autenticación:** Mutua (3-pass)
- **Compatibilidad:** Implementación de `MifareUltralight` opcional en Android
- **Disponibilidad Venezuela:** Sí
- **Precio aprox:** $0.15 USD

**Ventaja sobre Classic:** 3DES de 112 bits es criptografía estándar seria,
mientras que Crypto1 de 48 bits está completamente roto.

**Limitación:** Solo 148 bytes = 8 slots (4 activos + 4 backups). Menos
confusión para el atacante (4 opciones vs 15 en NTAG215), pero mejor
criptografía que Classic.

**Protocolo del sistema:**
- 8 slots (4 activos + 4 backups) con doble redundancia
- Autenticación 3DES mutua
- Ver: `docs/tarjeta-ultralight-c-protocolo.md`

### MIFARE Classic 1K

- **Fabricante:** NXP Semiconductors
- **Estándar:** ISO/IEC 14443 Type A (NO es NFC Forum)
- **Memoria total:** 1024 bytes (16 sectores × 4 bloques × 16 bytes)
- **Memoria de usuario:** 752 bytes (sectores 1-15, 3 bloques por sector)
- **Seguridad:** Crypto1 de 48 bits (ROTO desde 2008)
- **Compatibilidad:** Parcial — Samsung sí, Google Pixel no, iOS no
- **Disponibilidad Venezuela:** Sí
- **Precio aprox:** $0.08 USD

**Protocolo del sistema (existente):**
- 15 sectores con claves A/B independientes (30 claves)
- 15 certificados con triple redundancia (45 copias)
- Ver: `docs/tarjeta-classic-certificados.md`

**Advertencia:** Crypto1 está roto. Las claves se pueden recuperar en segundos
con ataques Nested/Hardnested. La seguridad depende de los certificados
rotativos y 2FA, no de Crypto1.

### MIFARE Classic 4K

- Igual que Classic 1K pero con 40 sectores (32 sectores de 4 bloques + 8 sectores de 16 bloques)
- 75 slots posibles con triple redundancia
- Misma criptografía rota (Crypto1)
- Driver futuro

### ICODE SLIX2

- **Fabricante:** NXP Semiconductors
- **Estándar:** ISO 15693 (NFC Forum Type 5)
- **Memoria total:** 320 bytes
- **Seguridad:** PWD de 32 bits
- **Compatibilidad:** Android e iOS (NFC-V)
- **Ventaja:** Largo alcance (hasta 1.5m)
- **Driver futuro**

### ST25DV

- **Fabricante:** STMicroelectronics
- **Estándar:** ISO 15693 (NFC Forum Type 5)
- **Memoria total:** 4096 bytes
- **Seguridad:** PWD de 32 bits
- **Compatibilidad:** Android e iOS (NFC-V)
- **Ventaja:** Largo alcance, mucha memoria
- **Driver futuro**

## Recomendaciones

### Para uso principal (POS Android)

**NTAG215** es la recomendación principal porque:
1. Se consigue en Venezuela
2. Es compatible con TODOS los teléfonos (Android + iOS)
3. Tiene 504 bytes = 30 slots con doble redundancia
4. PWD de 32 bits compensada con certificados rotativos y 2FA
5. Es económica ($0.15 USD)

### Para alta seguridad (si se consigue)

**DESFire EV3** o **NTAG424 DNA** porque:
1. AES-128 real (no PWD de 32 bits)
2. Criptografía estándar certificada
3. No necesitan certificados rotativos (AES es suficiente)

### Para compatibilidad legacy

**MIFARE Classic 1K** se mantiene porque:
1. Ya hay tarjetas emitidas en el sistema
2. Funciona con lectores ESP32/PN532
3. No se elimina, se refactoriza como un driver más

### Como fallback económico

**Ultralight C** porque:
1. Mejor criptografía que Classic (3DES 112-bit vs Crypto1 roto)
2. Pero solo 8 slots (baja capacidad)
3. Usar solo si no se consigue NTAG215

## Cómo agregar un nuevo tipo de tarjeta

El sistema es modular. Para agregar una nueva tarjeta:

1. **Driver Go:** Crear `internal/payments/cards/{tipo}_driver.go`
   - Implementa la interfaz `CardDriver`
   - Se auto-registra en `init()`

2. **Manifiesto JSON:** Crear `docs/card-drivers/{tipo}.json`
   - Specs de memoria, seguridad, compatibilidad, protocolo
   - El sistema lo lee para listar tipos disponibles

3. **Reader Kotlin:** Crear `punto-de-venta-pos/.../data/nfc/{Tipo}Reader.kt`
   - Implementa la interfaz `CardReader`
   - Se registra en `CardReaderRegistry`

4. **Migración DB:** Crear `internal/db/migrations/{numero}_{tipo}.sql`
   - Tablas específicas del tipo si las necesita

5. **Listo.** El sistema automáticamente:
   - Lista el tipo en `GET /api/nfc/card-types`
   - Acepta `card_type: "{tipo}"` en emisión de tarjetas
   - Usa el driver para provisionamiento y pago
   - Android detecta el tipo via `CardReaderRegistry.detectReader(tag)`
   - Admin UI muestra el tipo como opción disponible

No se necesita modificar código existente. Solo agregar archivos nuevos.
