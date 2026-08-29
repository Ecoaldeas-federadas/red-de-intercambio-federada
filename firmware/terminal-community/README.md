# Punto Comunitario NFC

Terminal de pago NFC para puntos comunitarios donde multiples vendedores pueden vender al mismo terminal.

## Hardware

- ESP32 DevKit V1
- PN532 (lector NFC via I2C)
- OLED SSD1306 128x64 (I2C)
- Encoder rotatorio KY-040
- Buzzer pasivo

Ver `wiring.md` para conexiones.

## Funcionamiento — Flujo de doble tarjeta

1. **IDLE**: Muestra "Punto Comunitario" / "Vendedor: acerque tarjeta"
2. **WAITING_SELLER**: Lee tarjeta del vendedor
3. **WAITING_PIN_SELLER**: Vendedor ingresa PIN (encoder)
4. **WAITING_AMOUNT**: Vendedor ingresa monto (encoder)
5. **WAITING_BUYER**: Muestra info + "Comprador: acerce tarjeta"
6. **WAITING_PIN_BUYER**: Comprador ingresa PIN (encoder)
7. **PROCESSING**: Envia al servidor (endpoint community), descifra respuesta
8. **DONE**: Muestra resultado + buzzer. Vuelve a IDLE.

## Soporte MIFARE Classic (certificados dinamicos)

El terminal comunitario puede soportar MIFARE Classic con certificados dinamicos. El flujo Classic
difiere del flujo normal: el documento + PIN del comprador se ingresan ANTES de acercar la tarjeta
del comprador. La tarjeta del vendedor sigue el flujo normal (UID o DESFire).

Para activar el flujo Classic en el paso del comprador, ver `processClassicPayment()` en
`terminal-keypad/terminal-keypad.ino` como referencia. Las funciones de lectura/escritura de
sectores estan en `shared/nfc_reader.h`.

Ver `docs/tarjeta-classic-certificados.md` para detalles del modelo de 6 capas.

## Seguridad

- Servidor valida PIN de vendedor Y comprador (bcrypt)
- Servidor verifica que vendedor != comprador
- Servidor debita al comprador y acredita al vendedor
- Todo cifrado y firmado mutualmente (Ed25519 + AES-256-GCM)

## Casos de uso

- Mercado comunitario: cada vendedor acerca su tarjeta al inicio
- Ferias: multiples productores usan el mismo punto de venta
- Tienda cooperativa: cada miembro vende sus productos

## Configuracion

1. Editar `config.h` con WiFi, servidor, terminal_id y registration_token
2. Registrar terminal en el servidor (admin): tipo "community"
3. Subir codigo al ESP32

## Cargar codigo

1. Arduino IDE + ESP32 board support
2. Librerias: Adafruit PN532, Adafruit SSD1306, ArduinoJson
3. Abrir `terminal-community.ino`, seleccionar board ESP32 DevKit, subir
