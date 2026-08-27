# Hardware NFC — Terminales de Pago con ESP32

## Resumen

El sistema soporta terminales de pago NFC basados en ESP32 que se comunican con el servidor de forma segura usando autenticacion mutual (Ed25519), cifrado (AES-256-GCM via ECDH Curve25519) y verificacion de PIN.

## Tipos de terminal

| Tipo | Hardware | Input | Uso |
|------|----------|-------|-----|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | Comercio individual |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil | Terminal autonomo |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta | Punto comunitario |
| **BLE Reader** | ESP32 + PN532 (sin pantalla/WiFi) | Lector NFC Bluetooth | Accesorio del POS (Android o web) |

**Nota:** El "terminal web" es ahora puro software en el navegador (`/app/pos`). No requiere ESP32.
El merchant usa la pagina web para crear cobros QR. Para NFC en el navegador, se conecta
un lector BLE Reader via Web Bluetooth (solo Chrome/Edge, no Safari de iPhone).

## Emparejamiento

Hay dos formas de registrar un terminal ESP32:

1. **Por codigo corto (recomendado):** El ESP32 muestra un codigo de 6 digitos en su pantalla,
   el admin lo aprueba desde la web. Firmware generico, no requiere compilacion por terminal.
   El ESP32 envia su chip_id (MAC efuse) automaticamente.

2. **Provision manual (mayor seguridad):** El admin provisiona con chip_id, descarga config.h,
   compila firmware especifico. Hardware binding anti-copia (el firmware no arranca en otro ESP32).

### Re-registro (rotacion de claves)

Si un terminal pierde sus claves o se reemplaza, el sistema detecta que el dispositivo ya existe
por su chip_id/fingerprint y le pregunta al admin: "Reemplazar la clave del terminal existente
o crear uno nuevo?" Esto preserva el historial y configuracion del terminal.

### Verificacion de 4 opciones (emparejamiento POS)

El emparejamiento de terminales POS ahora usa una **verificacion de 4 opciones**
para evitar que alguien intercepte el codigo y lo confirme por error o fraude:

1. El terminal genera y muestra un codigo de 6 digitos.
2. El admin abre la pantalla de aprobacion en la web.
3. La pantalla muestra **4 codigos distintos** (uno es el correcto, tres son aleatorios).
4. El admin debe **seleccionar el codigo correcto** de las 4 opciones.
5. Si no se confirma en **60 segundos**, el codigo expira y se debe generar uno nuevo.

**Endpoints:**
- `GET /api/nfc/terminal/pair/{code}/options` — Devuelve las 4 opciones de codigo.
- `POST /api/nfc/terminal/pair/{code}/approve` — Aprueba con el `selected_code` (opcional).

**Razon:** Con un solo codigo, cualquiera que lo vea puede confirmar. Con 4
opciones, solo quien ve la pantalla del terminal sabe cual es el correcto. Esto
evita ataques de intermediario y errores de confirmacion.

## Confirmacion de pagos

| Metodo | Confirmacion | Requiere celular |
|--------|-------------|------------------|
| QR code | Cliente escanea QR -> /pay?t=token -> confirma | Si |
| NFC DESFire (tarjeta segura) | Tarjeta + PIN en terminal | No |
| NFC UID-only (tarjeta sencilla) | Tarjeta + documento ID + PIN en terminal | No |

La tarjeta DESFire tiene encriptacion AES que valida autenticidad, por eso solo pide PIN.
La tarjeta UID-only es barata y no tiene encriptacion, por eso pide documento de identidad
para verificar que la tarjeta pertenece a quien dice ser.

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
