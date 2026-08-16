# Firmware ESP32 — Terminales NFC

Firmware para terminales de pago NFC basadas en ESP32. Cinco tipos de terminal con codigo y documentacion separados.

## Tipos de terminal

| Tipo | Hardware | Input | Carpeta |
|------|----------|-------|---------|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | `terminal-keypad/` |
| **Web** | ESP32 + PN532 + OLED | Monto desde app web, PIN en app | `terminal-web/` |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil para monto y PIN | `terminal-touch/` |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta (vendedor + comprador) | `terminal-community/` |
| **BLE Reader** | ESP32 + PN532 (sin pantalla/WiFi) | Lector tonto via Bluetooth al celular | `terminal-ble-reader/` |

## Estructura

```
firmware/
├── README.md              (este archivo)
├── shared/                (codigo compartido: crypto, NFC, display, server, PIN, hardware_binding, wifi_provisioning)
├── terminal-keypad/       (terminal con encoder)
├── terminal-web/          (terminal con app web)
├── terminal-touch/        (terminal con pantalla tactil)
├── terminal-community/    (punto comunitario doble tarjeta)
├── terminal-ble-reader/   (lector NFC tonto via Bluetooth)
└── docs/                  (documentacion general)
```

## Provisioning (flujo de instalacion)

**IMPORTANTE: `config.h` NO se edita manualmente.** El servidor lo genera con los valores reales del terminal.

### Flujo completo

```
1. En la central:
   a. Conectar ESP32 nuevo por USB
   b. Leer el chip ID del ESP32 (MAC de fabrica, 12 hex chars)
      - En Arduino IDE: Serial Monitor muestra el chip ID al arrancar
      - O ejecutar: esptool.py --port COMX chip_id
   c. En la web app (panel admin) > "Provisionar Terminal":
      - Entrar el chip ID
      - Seleccionar tipo de terminal (keypad, touch, web, community, ble-reader)
      - El servidor registra el terminal y genera terminal_id + registration_token
   d. Descargar el config.h generado (o el .bin compilado)
   e. Colocar config.h en la carpeta del terminal y compilar
      - O flashear el .bin directamente
   f. El firmware queda vinculado a ese ESP32 (no funciona en otro)

2. En el sitio (instalacion final):
   a. Encender el terminal
   b. El ESP32 verifica su chip ID (si no coincide, se detiene)
   c. Si es la primera vez: entra modo provisioning WiFi
      - Aparece un WiFi "Terminal-XXXX"
      - Conectarse desde el celular
      - Se abre una pagina web (192.168.4.1)
      - Seleccionar red WiFi y entrar contrasena
      - El ESP32 se reinicia y se conecta
   d. El ESP32 se registra con el servidor (intercambio de claves)
   e. El terminal queda operativo

3. Para reconfigurar:
   - Llevar el terminal a la central
   - Reflashear con nuevo firmware
   - No se puede reconfigurar remotamente (por seguridad)
```

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
