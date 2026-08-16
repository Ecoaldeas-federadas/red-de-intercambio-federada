# Terminal Keypad NFC

Terminal de pago NFC con ESP32 que usa un encoder rotatorio para ingresar el monto y el PIN.

## Hardware

- ESP32 DevKit V1
- PN532 (lector NFC via I2C)
- OLED SSD1306 128x64 (I2C)
- Encoder rotatorio KY-040
- Buzzer pasivo

Ver `wiring.md` para conexiones detalladas.

## Funcionamiento

1. **Boot**: Genera keypair Ed25519, se registra con el servidor (autenticacion mutual)
2. **Loop**:
   - Muestra "Monto?" en OLED
   - Usuario gira encoder para setear monto, boton para confirmar
   - Muestra "Acerce tarjeta"
   - Lee tarjeta NFC (PN532)
   - Muestra "Ingrese PIN"
   - Usuario ingresa PIN de 4 digitos con encoder
   - Cifra payload (AES-256-GCM), firma (Ed25519), envia al servidor
   - Descifra respuesta, muestra "APROBADA" o "RECHAZADA"
   - Buzzer: 2 beeps cortos (aprobado) o 1 beep largo (rechazado)

## Configuracion

1. Editar `config.h` con:
   - `WIFI_SSID` / `WIFI_PASSWORD`: credenciales WiFi
   - `SERVER_URL`: URL del servidor (ej: `https://mi-nodo.com`)
   - `TERMINAL_ID`: ID unico del terminal (ej: `TERM-KEYPAD-001`)
   - `REGISTRATION_TOKEN`: token otorgado por el admin al registrar el terminal

2. En el servidor, el admin debe registrar el terminal primero:
   ```
   POST /api/nfc/terminal/register
   { "terminal_id": "TERM-KEYPAD-001", "terminal_type": "keypad", ... }
   ```
   Esto devuelve un `registration_token` que se pone en `config.h`.

## Cargar codigo al ESP32

1. Instalar Arduino IDE
2. Instalar ESP32 board support ( Boards Manager -> ESP32 )
3. Instalar librerias:
   - Adafruit PN532
   - Adafruit SSD1306
   - ArduinoJson
4. Abrir `terminal-keypad.ino`
5. Seleccionar board: ESP32 DevKit
6. Seleccionar puerto COM
7. Subir

## Seguridad

- Keypair Ed25519 generado en el ESP32, clave privada en NVS (no sale del dispositivo)
- Autenticacion mutual: terminal firma, servidor firma, ambos verifican
- Comunicacion cifrada con AES-256-GCM via ECDH (Curve25519)
- Anti-replay: nonce aleatorio en cada mensaje
- No almacena datos sensibles de tarjetas
