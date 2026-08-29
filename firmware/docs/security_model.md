# Modelo de Seguridad — Terminales NFC

## Arquitectura de autenticacion mutual

```
Terminal ESP32                        Servidor
     |                                    |
     |  1. Genera Ed25519 keypair         |
     |  2. POST /complete-registration    |
     |     {terminal_id, token, pub_key}  |
     |----------------------------------->|
     |                                    | 3. Verifica token
     |                                    | 4. Guarda terminal pub_key
     |  5. Retorna server_pub_key         |
     |<-----------------------------------|
     |                                    |
     |  6. ECDH: deriva shared_key        | 6. ECDH: deriva shared_key
     |     (Curve25519 + SHA256)          |     (Curve25519 + SHA256)
     |                                    |
     |  7. POST /auth                     |
     |     {terminal_id, nonce, sig}      |
     |----------------------------------->|
     |                                    | 8. Verifica firma Ed25519
     |                                    | 9. Crea sesion
     | 10. Retorna {session_token, sig}   |
     |<-----------------------------------|
     |                                    |
     | 11. Verifica firma del servidor    |
     |                                    |
     |  = SESION ESTABLECIDA =            |
```

## Cifrado de comunicacion

Cada mensaje entre terminal y servidor:

1. **Terminal**: Cifra payload con AES-256-GCM (clave compartida ECDH)
2. **Terminal**: Firma ciphertext con Ed25519 (clave privada del terminal)
3. **Terminal**: Envia `{nonce, ciphertext, signature}` al servidor
4. **Servidor**: Verifica firma con clave publica del terminal
5. **Servidor**: Descifra con AES-256-GCM (misma clave compartida)
6. **Servidor**: Procesa, cifra respuesta, firma con su clave privada
7. **Terminal**: Verifica firma del servidor, descifra respuesta

## Proteccion anti-replay

- Cada mensaje incluye un `nonce` aleatorio (16 bytes del RNG del ESP32)
- Cada mensaje incluye `timestamp` (millis del terminal)
- El servidor puede rechazar mensajes con timestamps muy antiguos
- El nonce se incluye en el payload cifrado, no visible en claro

## Almacenamiento de claves

### Terminal ESP32
- Clave privada Ed25519: almacenada en **NVS** (Non-Volatile Storage) del ESP32
- Clave publica del servidor: almacenada en NVS
- La clave privada **nunca** sale del dispositivo
- NVS sobrevive reinicios y reflash del firmware

### Servidor
- Clave privada Ed25519: almacenada en `nfc_server_keys` (cifrada en produccion)
- Claves publicas de terminales: almacenadas en `nfc_terminals.terminal_public_key`
- Clave compartida: derivada on-the-fly, no almacenada

## Seguridad del PIN

- PIN de 4 digitos
- Hasheado con **bcrypt** (costo default) en el servidor
- Maximo **3 intentos** antes de bloqueo temporal
- Bloqueo temporal de **15 minutos** tras 3 intentos fallidos
- El PIN se envia dentro del payload cifrado (nunca en claro)
- Admin puede resetear el PIN con permiso `nfc.reset_pin`
- Usuario puede cambiar su PIN con PIN viejo (endpoint `/api/nfc/cards/pin`)

## Tipos de tarjeta NFC soportados

| Tipo | Seguridad | Uso |
|------|-----------|-----|
| UID-only | Solo lee UID | Basico, sin crypto en tarjeta |
| MIFARE Classic 1K (cert dinamicos) | 15 sectores con claves A/B unicas + cert rotativo | Economico con anti-clonacion |
| NTAG424 DNA | SUN MAC, AES | Cripto en tarjeta, anti-clonacion |
| MIFARE DESFire EV3 | AES, archivos | Alta seguridad, multi-app |

### MIFARE Classic 1K con certificados dinamicos

El firmware ESP32 (PN532) soporta MIFARE Classic 1K con certificados dinamicos rotativos:

- **Deteccion:** `detectCardType()` ya detecta MIFARE Classic como `CARD_UID_ONLY`. Para distinguir
  Classic con cert dinamicos, el servidor responde con `has_dynamic_certs=true` al hacer lookup.
- **Lectura:** `nfc.mifareclassic_AuthenticateBlock(sector, keyA)` + `nfc.mifareclassic_ReadDataBlock(block)`
- **Escritura:** `nfc.mifareclassic_AuthenticateBlock(sector, keyB)` + `nfc.mifareclassic_WriteDataBlock(block, data)`
- **Triple redundancia:** 3 bloques por sector (0,1,2), al menos 1 debe coincidir con el cert esperado
- **NO escribir trailer (bloque 3):** Solo se escriben bloques 0,1,2 en caliente. El trailer se escribe
  una sola vez en provisionamiento.

**Flujo de pago Classic (firmware ESP32):**
1. Comerciante ingresa monto + documento + PIN del cliente
2. ESP32 envia pre-auth al servidor → servidor responde con sector a leer + Key A + cert esperado + sector a escribir + Key B + cert nuevo
3. ESP32 lee UID → verifica
4. ESP32 autentica sector a leer con Key A → lee 3 bloques → verifica cert
5. ESP32 autentica sector a escribir con Key B → escribe 3 bloques con cert nuevo
6. ESP32 confirma al servidor → servidor procesa pago

Ver `docs/tarjeta-classic-certificados.md` para detalles completos del modelo de 6 capas.

## Permisos NFC

| Permiso | Descripcion | Multisig |
|---------|-------------|----------|
| `nfc.issue_card` | Emitir tarjeta con PIN inicial | No |
| `nfc.deactivate_card` | Desactivar tarjeta | No |
| `nfc.reset_pin` | Resetear PIN de tarjeta | No |
| `nfc.register_terminal` | Registrar terminal ESP32 | No |
| `nfc.deactivate_terminal` | Desactivar terminal | No |
| `nfc.view_transactions` | Ver transacciones NFC | No |

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|--------|-----------|
| Clonacion de tarjeta | Usar NTAG424 DNA o DESFire EV3 con crypto |
| Interceptacion de RF | Comunicacion cifrada AES-256-GCM |
| Robo de terminal | Clave privada en NVS, no extraible |
| PIN brute force | Max 3 intentos, bloqueo 15 min |
| Replay attack | Nonce + timestamp en cada mensaje |
| MITM | Mutual Ed25519 verification |
| Server key compromise | Rotacion de claves, clave privada cifrada |
