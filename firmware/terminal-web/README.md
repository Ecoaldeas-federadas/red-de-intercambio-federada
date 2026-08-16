# Terminal Web NFC

Terminal de pago NFC minimalista. El comerciante setea el monto desde la app web.

## Hardware

- ESP32 DevKit V1
- PN532 (lector NFC via I2C)
- OLED SSD1306 128x64 (I2C)
- Buzzer pasivo

Ver `wiring.md` para conexiones.

## Funcionamiento

1. **Boot**: Genera keypair, se registra con servidor (mutual auth)
2. **Espera monto**: Hace polling al servidor cada 2s
3. **Cuando hay monto**: Muestra monto en OLED, espera tarjeta
4. **Lee tarjeta**: Envia al servidor (PIN viene de la app web)
5. **Muestra resultado**: APROBADA/RECHAZADA + buzzer

## Ventajas

- Hardware minimo (sin encoder, sin touchscreen)
- El comerciante usa su telefono/computadora para setear montos
- Ideal para negocios que ya tienen una computadora o tablet

## Configuracion

1. Editar `config.h` con WiFi, servidor, terminal_id y registration_token
2. Registrar terminal en el servidor (admin): tipo "web"
3. El comerciante usa la pagina web `/nfc-terminals` > tab "Sesion Web" para setear montos
4. Subir codigo al ESP32

## Cargar codigo

1. Arduino IDE + ESP32 board support
2. Librerias: Adafruit PN532, Adafruit SSD1306, ArduinoJson
3. Abrir `terminal-web.ino`, seleccionar board ESP32 DevKit, subir
