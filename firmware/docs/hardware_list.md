# Lista de Hardware por Tipo de Terminal

## Componentes comunes (todos los tipos)

| Componente | Modelo | Precio aprox. USD |
|-----------|--------|-------------------|
| ESP32 | ESP32 DevKit V1 (38 pin) | $5-8 |
| Lector NFC | PN532 modulo I2C | $3-6 |
| Buzzer | Pasivo 5V | $0.50 |

## Terminal Keypad

| Componente | Modelo | Precio aprox. USD |
|-----------|--------|-------------------|
| ESP32 | DevKit V1 | $5-8 |
| PN532 | Modulo I2C | $3-6 |
| OLED | SSD1306 128x64 I2C | $3-5 |
| Encoder | KY-040 rotatorio | $1-2 |
| Protoboard | 830 puntos | $2-3 |
| Cables | Jumper M-M/M-F ~20 | $2 |
| **Total** | | **$16-26** |

## Terminal Web

| Componente | Modelo | Precio aprox. USD |
|-----------|--------|-------------------|
| ESP32 | DevKit V1 | $5-8 |
| PN532 | Modulo I2C | $3-6 |
| OLED | SSD1306 128x64 I2C | $3-5 |
| Buzzer | Pasivo | $0.50 |
| Protoboard | 830 puntos | $2-3 |
| Cables | Jumper ~12 | $1.50 |
| **Total** | | **$15-23** |

## Terminal Touch

| Componente | Modelo | Precio aprox. USD |
|-----------|--------|-------------------|
| TTGO T-Display | ESP32 + ILI9341 + XPT2046 | $15-25 |
| PN532 | Modulo I2C | $3-6 |
| Buzzer | Pasivo | $0.50 |
| Cables | Jumper M-F ~8 | $1.50 |
| **Total** | | **$20-33** |

## Terminal Community

| Componente | Modelo | Precio aprox. USD |
|-----------|--------|-------------------|
| ESP32 | DevKit V1 | $5-8 |
| PN532 | Modulo I2C | $3-6 |
| OLED | SSD1306 128x64 I2C | $3-5 |
| Encoder | KY-040 rotatorio | $1-2 |
| Protoboard | 830 puntos | $2-3 |
| Cables | Jumper ~20 | $2 |
| **Total** | | **$16-26** |

## Donde comprar

- AliExpress / Banggood: ESP32, PN532, OLED, encoder
- Amazon: componentes con envio rapido
- DigiKey / Mouser: componentes originales con garantia

## Notas

- El TTGO T-Display incluye ESP32 + pantalla + touch en una sola placa
- El PN532 funciona con tarjetas NTAG424 DNA, MIFARE DESFire EV3 y UID-only
- Verificar que el PN532 tenga jumper I2C configurado
- OLED SSD1306: direccion I2C 0x3C o 0x3D (ver etiqueta)
