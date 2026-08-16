# Terminal Keypad — Esquema de Conexiones

## Componentes

| Componente | Modelo | Cantidad |
|-----------|--------|----------|
| ESP32 | ESP32 DevKit V1 (38 pin) | 1 |
| Lector NFC | PN532 (modulo I2C) | 1 |
| Pantalla | OLED SSD1306 128x64 I2C | 1 |
| Encoder rotatorio | KY-040 | 1 |
| Buzzer | Pasivo 5V | 1 |
| Resistencia | 10KΩ | 2 |
| Protoboard | 830 puntos | 1 |
| Cables jumper | M-M / M-F | ~20 |

## Conexiones

### ESP32 — PN532 (I2C)

| PN532 | ESP32 Pin | Nota |
|-------|-----------|------|
| VCC   | 3.3V      | |
| GND   | GND       | |
| SDA   | GPIO 21   | I2C SDA |
| SCL   | GPIO 22   | I2C SCL |
| IRQ   | GPIO 2    | Interrupcion |
| RST   | GPIO 4    | Reset (opcional) |
| SEL   | -         | Jumper en I2C |

### ESP32 — OLED SSD1306 (I2C)

| OLED | ESP32 Pin | Nota |
|------|-----------|------|
| VCC  | 3.3V      | |
| GND  | GND       | |
| SDA  | GPIO 21   | Compartido con PN532 |
| SCL  | GPIO 22   | Compartido con PN532 |

### ESP32 — Encoder Rotatorio KY-040

| KY-040 | ESP32 Pin | Nota |
|--------|-----------|------|
| VCC    | 3.3V      | |
| GND    | GND       | |
| CLK    | GPIO 26   | Encoder A (con pull-up) |
| DT     | GPIO 27   | Encoder B (con pull-up) |
| SW     | GPIO 14   | Boton (con pull-up) |

### ESP32 — Buzzer

| Buzzer | ESP32 Pin | Nota |
|--------|-----------|------|
| +      | GPIO 25   | PWM |
| -      | GND       | |

## Diagrama visual

```
  ESP32 DevKit V1
  +-------------------+
  | 3V3          GND  |
  | GPIO21 (SDA)------|--+--> PN532 SDA
  | GPIO22 (SCL)------|--+--> PN532 SCL
  | GPIO2  (IRQ)------|----> PN532 IRQ
  | GPIO4  (RST)------|----> PN532 RST
  |                   |
  | GPIO26 (CLK)------|----> KY-040 CLK
  | GPIO27 (DT)-------|----> KY-040 DT
  | GPIO14 (SW)-------|----> KY-040 SW
  |                   |
  | GPIO25 (BUZZER)---|----> Buzzer +
  +-------------------+

  I2C Bus (SDA=GPIO21, SCL=GPIO22):
  +-- PN532 (0x24 o 0x48)
  +-- OLED  (0x3C)
```

## Notas

- PN532 y OLED comparten el bus I2C (SDA/SCL)
- El encoder usa interrupciones en GPIO26 (CLK)
- Pull-up internas del ESP32 usadas para encoder y boton
- Buzzer pasivo: usar tone()/noTone() para melodias
- Alimentacion: USB o bateria 5V via pin VIN
