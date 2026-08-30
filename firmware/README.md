# Firmware ESP32 — Terminales NFC

Firmware para terminales de pago NFC basadas en ESP32. Cuatro tipos de terminal con codigo y documentacion separados.

## Tipos de terminal

| Tipo | Hardware | Input | Carpeta |
|------|----------|-------|---------|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | `terminal-keypad/` |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil para monto y PIN | `terminal-touch/` |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta (vendedor + comprador) | `terminal-community/` |
| **BLE Reader** | ESP32 + PN532 (sin pantalla/WiFi) | Lector NFC via Bluetooth al POS (accesorio) | `terminal-ble-reader/` |

**Nota:** El "terminal web" es ahora puro software en el navegador (ver `pos/` — POS Web).
No requiere ESP32. El merchant usa el POS Web para crear cobros QR y pagos NFC.
Para NFC en el navegador, se usa un lector BLE Reader conectado via Web Bluetooth.

## Estructura

```
firmware/
├── README.md              (este archivo)
├── shared/                (codigo compartido: crypto, NFC, display, server, PIN, hardware_binding, wifi_provisioning)
├── terminal-keypad/       (terminal con encoder)
├── terminal-touch/        (terminal con pantalla tactil)
├── terminal-community/    (punto comunitario doble tarjeta)
├── terminal-ble-reader/   (lector NFC via Bluetooth - accesorio del POS)
└── docs/                  (documentacion general)
```

## Tipos de tarjeta NFC soportados

| Tipo | Seguridad | Soporte firmware |
|------|-----------|------------------|
| UID-only | Solo UID | Todos los terminales |
| MIFARE Classic 1K (cert dinamicos) | 6 capas: claves A/B unicas + cert rotativo | terminal-keypad (processClassicPayment) |
| NTAG424 DNA | SUN MAC, AES | Placeholder (TODO) |
| MIFARE DESFire EV3 | AES-128, multi-app | Todos los terminales (authenticateDESFire) |

### MIFARE Classic con certificados dinamicos

El firmware soporta MIFARE Classic 1K con certificados dinamicos rotativos. El flujo es:

1. Comerciante ingresa monto + documento + PIN del cliente (sin tarjeta)
2. ESP32 envia pre-auth al servidor → servidor responde con sector a leer + Key A + cert esperado + sector a escribir + Key B + cert nuevo
3. ESP32 pide tarjeta al cliente
4. ESP32 lee UID → verifica, lee sector con Key A → verifica cert (triple redundancia)
5. ESP32 escribe nuevo cert en sector destino con Key B
6. ESP32 confirma al servidor → servidor procesa pago

Funciones en `shared/nfc_reader.h`:
- `authenticateClassicSector(sector, key, keyType)` — autentica con Key A o B
- `readClassicSectorBlocks(sector, keyA, outBlocks, outValid)` — lee 3 bloques
- `verifyClassicCertificate(sector, keyA, expectedCert)` — verifica cert
- `writeClassicSectorBlocks(sector, keyB, cert)` — escribe 3 bloques
- `writeFullClassicSector(sector, keyA, keyB, accessBits, cert)` — provisionamiento completo

Ver `docs/tarjeta-classic-certificados.md` para detalles del modelo de 6 capas.

## Provisioning (flujo de instalacion)

Hay dos formas de registrar un terminal ESP32:

### Opcion 1: Emparejamiento por codigo (recomendado)

```
1. Flashear el firmware generico en el ESP32 (mismo firmware para todos)
2. En el sitio: encender el terminal
3. El ESP32 se conecta al WiFi (portal cautivo si primera vez)
4. El ESP32 genera su par de claves Ed25519
5. El ESP32 envia su chip_id + clave publica al servidor
6. El servidor responde con un codigo de 6 digitos
7. El ESP32 muestra el codigo en su pantalla
8. El admin entra el codigo en el panel web (Terminales NFC > Emparejamiento)
9. El admin ve la info del dispositivo (chip_id, tipo) y aprueba
10. El ESP32 recibe la confirmacion por polling y queda registrado
```

### Opcion 2: Provision manual (mayor seguridad)

**IMPORTANTE: `config.h` NO se edita manualmente.** El servidor lo genera con los valores reales del terminal.

```
1. En la central:
   a. Conectar ESP32 nuevo por USB
   b. Leer el chip ID del ESP32 (MAC de fabrica, 12 hex chars)
   c. En la web app (panel admin) > "Provisionar Terminal":
      - Entrar el chip ID
      - Seleccionar tipo de terminal (keypad, touch, community)
      - El servidor registra el terminal y genera terminal_id + registration_token
   d. Descargar el config.h generado (o el .bin compilado)
   e. Colocar config.h en la carpeta del terminal y compilar
   f. El firmware queda vinculado a ese ESP32 (no funciona en otro)

2. En el sitio (instalacion final):
   a. Encender el terminal
   b. El ESP32 verifica su chip ID (si no coincide, se detiene)
   c. Si es la primera vez: entra modo provisioning WiFi
   d. El ESP32 se registra con el servidor (intercambio de claves)
   e. El terminal queda operativo
```

### Re-registro (rotacion de claves)

Si un terminal pierde sus claves o se reemplaza:
1. El terminal se re-registra con el mismo chip_id
2. El servidor detecta que el dispositivo ya existe
3. El admin ve "Dispositivo ya registrado" y elige:
   - Reemplazar la clave del terminal existente (mantiene historial)
   - Crear un terminal nuevo

### Vinculacion al hardware (anti-copia)

Cada ESP32 tiene un chip ID unico grabado en efuse (no modificable).
El firmware compilado incluye el chip ID esperado y lo verifica al arranque.
Si alguien copia el .bin de un terminal y lo flashea en otro ESP32,
el firmware no arranca (el chip ID no coincide).

Esto garantiza que cada terminal es unico y no se puede clonar.

### WiFi en el sitio

El WiFi NO se preconfigura en el firmware. El usuario lo configura en el sitio
via portal cautivo (AP modo). Esto permite que el terminal se mueva a cualquier
ubicacion con WiFi. Las credenciales WiFi se guardan en NVS del ESP32.

Si el WiFi falla, el terminal vuelve automaticamente a modo provisioning.

## Seguridad

Todos los terminales usan el mismo modelo de seguridad:

1. **Keypair de identidad Ed25519**: Generado en el ESP32, clave privada en NVS (no sale del dispositivo)
2. **Registro mutual**: ESP32 envia su public key de identidad, servidor responde con la suya
3. **Claves efimeras por transaccion**: Cada mensaje genera un nuevo par Ed25519 efimero
4. **ECDH efimero**: Derivan clave compartida con claves efimeras (no con identidad)
5. **Forward secrecy**: Si alguien captura una clave, solo compromete esa transaccion
6. **AES-256-GCM**: Toda comunicacion cifrada con la shared key efimera
7. **Ed25519**: Toda comunicacion firmada con clave de identidad (no efimera)
8. **Anti-replay**: Nonce aleatorio en cada mensaje + claves efimeras cambian cada vez
9. **PIN**: 4 digitos, hasheado con bcrypt en servidor, max 3 intentos
10. **Hardware binding**: Firmware vinculado al chip ID del ESP32 (anti-copia)

### Protocolo efimero por transaccion

```
Por cada mensaje:
  Terminal genera (priv_eph, pub_eph) nueva
  Servidor genera (priv_eph, pub_eph) nueva
  Terminal envia: pub_eph + firma(identidad, pub_eph) + ciphertext + firma(identidad, ciphertext)
  Servidor verifica firma de identidad
  Servidor deriva shared_key = ECDH(server_eph_priv, terminal_eph_pub)
  Servidor descifra con shared_key
  Servidor responde con mismo shared_key + firma(identidad_server, ciphertext)
  Terminal deriva shared_key = ECDH(terminal_eph_priv, server_eph_pub)
  Terminal descifra respuesta

  -> Las claves publicas en el wire cambian en cada transaccion
  -> Si alguien intercepta trafico, no puede reutilizar nada
  -> Forward secrecy: capturar una clave efimera solo compromete 1 transaccion
```

Ver `docs/security_model.md` para detalles.

## Inicio rapido

1. Elegir tipo de terminal segun necesidades
2. Comprar componentes (ver `docs/hardware_list.md`)
3. **Provisionar el terminal desde el servidor** (ver flujo arriba)
4. Descargar config.h generado o .bin compilado
5. Cargar codigo al ESP32 (ver `docs/flashing_guide.md`)
6. En el sitio: configurar WiFi via portal cautivo
7. Verificar funcionamiento (ver `docs/troubleshooting.md`)
