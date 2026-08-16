# Guia de Flasheo — Terminales NFC ESP32

## Prerequisitos

1. **Arduino IDE** 2.x (descargar de arduino.cc)
2. **ESP32 Board Support**:
   - Archivo > Preferencias > URL adicional de boards:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Herramientas > Placa > Boards Manager > buscar "esp32" > Instalar

3. **Librerias necesarias** (Herramientas > Administrar Librerias):
   - `Adafruit PN532` (by Adafruit)
   - `Adafruit SSD1306` (by Adafruit)
   - `ArduinoJson` (by Benoit Blanchon)
   - `TFT_eSPI` (by Bodmer) — solo para terminal-touch
   - `XPT2046_Touchscreen` (by Paul Stoffregen) — solo para terminal-touch

## Pasos

### 1. Configurar

Abrir `config.h` del terminal elegido y editar:

```c
#define WIFI_SSID     "mi_red_wifi"
#define WIFI_PASSWORD "mi_password"
#define SERVER_URL    "https://mi-nodo.trueque.org"
#define TERMINAL_ID       "TERM-KEYPAD-001"
#define REGISTRATION_TOKEN "abc123-token-del-admin"
```

### 2. Registrar terminal en el servidor

Antes de flashear, el admin debe registrar el terminal:

```bash
# Como admin con permiso nfc.register_terminal
curl -X POST https://mi-nodo.trueque.org/api/nfc/terminal/register \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "terminal_id": "TERM-KEYPAD-001",
    "label": "Ferreteria Don Jose",
    "terminal_type": "keypad",
    "location": "Local 5"
  }'
```

Esto devuelve un `registration_token`. Copiarlo a `config.h`.

### 3. Conectar ESP32

1. Conectar ESP32 via cable USB al computador
2. Herramientas > Placa > "ESP32 DevKit V1" (o TTGO T-Display para touch)
3. Herramientas > Puerto > seleccionar COM port (o /dev/ttyUSB0 en Linux)

### 4. Subir codigo

1. Archivo > Abrir > seleccionar el `.ino` del terminal
2. Click en boton "Subir" (flecha derecha)
3. Esperar compilacion y subida (1-2 minutos)

### 5. Verificar

1. Abrir Monitor Serie (Herramientas > Monitor Serie)
2. Baudrate: 115200
3. El terminal deberia:
   - Conectar WiFi
   - Mostrar IP en OLED
   - Generar claves (si primera vez)
   - Registrarse con servidor
   - Mostrar "Listo"

## Para terminal-touch: configurar TFT_eSPI

El TFT_eSPI requiere configurar el display correcto:

1. Ir a la carpeta de librerias: `Arduino/libraries/TFT_eSPI`
2. Editar `User_Setup.h`:
   ```c
   #define ILI9341_2BIT
   #define TFT_MISO 19
   #define TFT_MOSI 23
   #define TFT_SCLK 18
   #define TFT_CS   15
   #define TFT_DC   2
   #define TFT_RST  4
   #define TOUCH_CS 33
   ```

## Problemas comunes

| Problema | Solucion |
|----------|----------|
| "No se encontro placa" | Instalar ESP32 board support, seleccionar placa correcta |
| "Error al subir" | Presionar boton BOOT en ESP32 durante subida |
| "PN532 not found" | Verificar conexiones I2C, jumper SEL en I2C |
| "Error registro" | Verificar SERVER_URL y REGISTRATION_TOKEN |
| "Error auth" | El servidor no tiene claves, verificar NFC server keys |
| OLED en blanco | Verificar direccion I2C (0x3C o 0x3D) |
| WiFi no conecta | Verificar SSID/password, senal WiFi suficiente |

Ver `troubleshooting.md` para mas detalles.
