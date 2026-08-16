# Terminal Touch NFC — Esquema de Conexiones

## Componentes

| Componente | Modelo | Cantidad |
|-----------|--------|----------|
| ESP32 con pantalla | TTGO T-Display (ILI9341 + XPT2046) | 1 |
| Lector NFC | PN532 (modulo I2C) | 1 |
| Buzzer | Pasivo 5V | 1 |
| Cables jumper | M-F | ~8 |

## Conexiones

### TTGO T-Display — integrado

Pantalla ILI9341 y touchscreen XPT2046 ya integrados en la placa.

### TTGO T-Display — PN532 (I2C)

| PN532 | TTGO Pin | Nota |
|-------|----------|------|
| VCC   | 3.3V     | |
| GND   | GND      | |
| SDA   | GPIO 21  | I2C SDA |
| SCL   | GPIO 22  | I2C SCL |
| IRQ   | GPIO 2   | |
| RST   | GPIO 4   | |

### TTGO T-Display — Buzzer

| Buzzer | TTGO Pin |
|--------|----------|
| +      | GPIO 25  |
| -      | GND      |

## Diagrama

```
  TTGO T-Display (ESP32 + ILI9341 + XPT2046)
  +----------------------------------+
  |  [Pantalla tactil ILI9341]       |
  |                                  |
  |  3V3    GND                      |
  |  GPIO21 (SDA)---+---> PN532 SDA  |
  |  GPIO22 (SCL)---+---> PN532 SCL  |
  |  GPIO2  (IRQ)------> PN532 IRQ   |
  |  GPIO4  (RST)------> PN532 RST   |
  |  GPIO25 (BUZZER)---> Buzzer +    |
  +----------------------------------+
```

## Notas

- Pantalla y touch ya integrados, no requiere cableado extra
- Touch usa SPI separado (VSPI) configurado en codigo
- PN532 usa I2C compartido
- Calibrar coordenadas touch segun tu unidad (ver getTouchedKey())
