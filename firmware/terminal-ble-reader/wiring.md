# Wiring — Terminal BLE Reader

## Conexiones

### PN532 (NFC Reader) — I2C

```
ESP32          PN532
-----          -----
GPIO 21        SDA
GPIO 22        SCL
3.3V           VCC
GND            GND
```

Jumpers del PN532: IRQ = 0, I2C = 1 (modo I2C)

### LED de estado

El LED integrado del ESP32 (GPIO 2) se usa para indicar el estado:
- **Parpadeo lento** (0.5s): no conectado al celular, esperando BLE
- **Encendido fijo**: conectado, esperando tarjeta
- **Parpadeo rapido** (3x): tarjeta leida y enviada

### Buzzer (opcional)

Si se desea feedback sonoro al leer una tarjeta:
```
ESP32          Buzzer
-----          ------
GPIO 25        Signal
GND            GND
```

## No se necesita

- Pantalla OLED SSD1306
- Pantalla TFT ILI9341
- Rotary encoder
- Keypad
- Modulo WiFi (el ESP32 lo tiene pero no se usa)
