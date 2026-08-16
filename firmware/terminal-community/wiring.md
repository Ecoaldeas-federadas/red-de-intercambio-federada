# Punto Comunitario NFC — Esquema de Conexiones

## Componentes

| Componente | Modelo | Cantidad |
|-----------|--------|----------|
| ESP32 | ESP32 DevKit V1 | 1 |
| Lector NFC | PN532 (modulo I2C) | 1 |
| Pantalla | OLED SSD1306 128x64 I2C | 1 |
| Encoder rotatorio | KY-040 | 1 |
| Buzzer | Pasivo 5V | 1 |
| Protoboard | 830 puntos | 1 |
| Cables jumper | M-M / M-F | ~20 |

## Conexiones

Identico al terminal-keypad (mismo hardware):

| Dispositivo | ESP32 Pin |
|-------------|-----------|
| PN532 SDA | GPIO 21 |
| PN532 SCL | GPIO 22 |
| PN532 IRQ | GPIO 2 |
| PN532 RST | GPIO 4 |
| OLED SDA | GPIO 21 (compartido) |
| OLED SCL | GPIO 22 (compartido) |
| Encoder CLK | GPIO 26 |
| Encoder DT | GPIO 27 |
| Encoder SW | GPIO 14 |
| Buzzer + | GPIO 25 |

Ver `terminal-keypad/wiring.md` para diagrama detallado.

## Diferencia con terminal-keypad

El hardware es identico. La diferencia esta en el firmware:
- Keypad: una tarjeta (comprador) + PIN
- Community: dos tarjetas (vendedor + comprador) + PIN de ambos

## Notas

- El encoder se usa para ingresar el monto y los PINs
- Multiple vendedores pueden usar el mismo punto secuencialmente
- El flujo es: vendedor -> monto -> comprador -> transaccion
