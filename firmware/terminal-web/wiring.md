# Terminal Web NFC — Esquema de Conexiones

## Componentes

| Componente | Modelo | Cantidad |
|-----------|--------|----------|
| ESP32 | ESP32 DevKit V1 | 1 |
| Lector NFC | PN532 (modulo I2C) | 1 |
| Pantalla | OLED SSD1306 128x64 I2C | 1 |
| Buzzer | Pasivo 5V | 1 |
| Protoboard | 830 puntos | 1 |
| Cables jumper | M-M / M-F | ~12 |

## Conexiones

### ESP32 — PN532 (I2C)

| PN532 | ESP32 Pin |
|-------|-----------|
| VCC   | 3.3V      |
| GND   | GND       |
| SDA   | GPIO 21   |
| SCL   | GPIO 22   |
| IRQ   | GPIO 2    |
| RST   | GPIO 4    |

### ESP32 — OLED SSD1306 (I2C)

| OLED | ESP32 Pin |
|------|-----------|
| VCC  | 3.3V      |
| GND  | GND       |
| SDA  | GPIO 21   |
| SCL  | GPIO 22   |

### ESP32 — Buzzer

| Buzzer | ESP32 Pin |
|--------|-----------|
| +      | GPIO 25   |
| -      | GND       |

## Diagrama

```
  ESP32 DevKit V1
  +-------------------+
  | 3V3          GND  |
  | GPIO21 (SDA)---+--|---> PN532 SDA / OLED SDA
  | GPIO22 (SCL)---+--|---> PN532 SCL / OLED SCL
  | GPIO2  (IRQ)------|---> PN532 IRQ
  | GPIO4  (RST)------|---> PN532 RST
  | GPIO25 (BUZZER)---|---> Buzzer +
  +-------------------+
```

## Notas

- Configuracion minima: sin encoder, sin teclado
- El monto se setea desde la app web del comerciante
- El ESP32 hace polling cada 2s al servidor por monto pendiente
- El PIN se ingresa en la app web, no en el terminal
