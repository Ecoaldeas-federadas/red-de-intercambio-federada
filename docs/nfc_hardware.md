# Hardware NFC — Terminales de Pago con ESP32

## Resumen

El sistema soporta terminales de pago NFC basados en ESP32 que se comunican con el servidor de forma segura usando autenticacion mutual (Ed25519), cifrado (AES-256-GCM via ECDH Curve25519) y verificacion de PIN.

## Tipos de terminal

| Tipo | Hardware | Input | Uso |
|------|----------|-------|-----|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | Comercio individual |
| **Web** | ESP32 + PN532 + OLED | Monto desde app web | Comercio con PC/tablet |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil | Terminal autonomo |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta | Punto comunitario |

## Componentes

### Lector NFC: PN532

- Modulo I2C, compatible con ISO14443A
- Soporta: MIFARE Classic, NTAG, DESFire
- Rango: ~5cm
- Precio: $3-6 USD

### Pantalla: OLED SSD1306

- 128x64 pixeles, I2C
- Monocromo (blanco sobre negro)
- Direccion: 0x3C o 0x3D
- Precio: $3-5 USD

### Pantalla tactil: TTGO T-Display

- ESP32 + ILI9341 + XPT2046 integrados
- 320x240 a color, tactil resistivo
- Precio: $15-25 USD

### Encoder rotatorio: KY-040

- Encoder cuadratura + boton
- Para ingresar montos y PINs
- Precio: $1-2 USD

## Tarjetas NFC soportadas

| Tipo | Seguridad | Precio | Recomendacion |
|------|-----------|--------|---------------|
| UID-only | Solo UID (sin crypto) | $0.20 | Basico |
| NTAG424 DNA | SUN MAC, AES-128 | $0.50 | Recomendado |
| MIFARE DESFire EV3 | AES-128, multi-app | $1.50 | Alta seguridad |

### Recomendacion

Para la mayoria de casos, **NTAG424 DNA** ofrece el mejor balance entre seguridad y costo. Proporciona autenticacion criptografica (SUN MAC) que previene clonacion simple.

## Esquema de conexiones

Ver `firmware/terminal-*/wiring.md` para cada tipo de terminal.

### Bus I2C compartido

El PN532 y el OLED comparten el bus I2C:
- SDA: GPIO 21
- SCL: GPIO 22

### Pines usados

| Pin | Funcion | Dispositivo |
|-----|---------|-------------|
| GPIO 21 | I2C SDA | PN532 + OLED |
| GPIO 22 | I2C SCL | PN532 + OLED |
| GPIO 2 | IRQ | PN532 |
| GPIO 4 | RST | PN532 |
| GPIO 25 | Buzzer | Buzzer |
| GPIO 26 | Encoder A | KY-040 |
| GPIO 27 | Encoder B | KY-040 |
| GPIO 14 | Encoder SW | KY-040 (boton) |

## Alimentacion

- USB: 5V via cable USB (mas comun)
- Bateria: LiPo 3.7V via pin 3.3V o modulo de carga
- Consumo: ~80mA en operacion, ~20mA en idle

## Donde comprar

- [AliExpress](https://aliexpress.com): ESP32, PN532, OLED, encoder
- [Amazon](https://amazon.com): Componentes con envio rapido
- [DigiKey](https://digikey.com): Componentes originales

## Ver tambien

- `firmware/` — Codigo fuente del firmware
- `firmware/docs/security_model.md` — Modelo de seguridad detallado
- `firmware/docs/flashing_guide.md` — Guia de flasheo
- `firmware/docs/hardware_list.md` — Lista completa de componentes
- `firmware/docs/troubleshooting.md` — Solucion de problemas
