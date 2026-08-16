# Terminal Touch NFC

Terminal de pago NFC con pantalla tactil. Monto y PIN se ingresan tocando la pantalla.

## Hardware

- TTGO T-Display (ESP32 + ILI9341 + XPT2046 tactil)
- PN532 (lector NFC via I2C)
- Buzzer pasivo

Ver `wiring.md` para conexiones.

## Funcionamiento

1. **Boot**: Genera keypair, registra con servidor (mutual auth)
2. **Monto**: Teclado numerico en pantalla tactil
3. **Tarjeta**: "Acerce tarjeta" -> lee NFC
4. **PIN**: Teclado numerico en pantalla tactil (4 digitos)
5. **Resultado**: Muestra APROBADA/RECHAZADA en color + buzzer

## Ventajas

- UI completa en pantalla a color
- No requiere dispositivo externo (telefono/computadora)
- Todo se hace en el terminal: monto, PIN, resultado
- Ideal para negocios que quieren un terminal autonomo

## Configuracion

1. Editar `config.h` con WiFi, servidor, terminal_id y registration_token
2. Registrar terminal en el servidor (admin): tipo "touch"
3. Subir codigo al TTGO T-Display

## Cargar codigo

1. Arduino IDE + ESP32 board support
2. Librerias: Adafruit PN532, TFT_eSPI, XPT2046_Touchscreen, ArduinoJson
3. Configurar TFT_eSPI User_Setup.h para ILI9341
4. Abrir `terminal-touch.ino`, seleccionar board TTGO T-Display, subir

## Calibracion del touch

Las coordenadas del touchscreen pueden variar entre unidades. Editar la funcion
`getTouchedKey()` en el .ino para ajustar los rangos de mapeo segun tu pantalla.
