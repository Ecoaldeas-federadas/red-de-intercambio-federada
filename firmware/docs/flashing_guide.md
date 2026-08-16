# Guia de Flasheo — Terminales NFC ESP32

## Prerequisitos

1. **Arduino IDE** 2.x (descargar de arduino.cc)
2. **ESP32 Board Support**:
   - Archivo > Preferencias > URL adicional de boards:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Herramientas > Placa > Boards Manager > buscar "esp32" > Instalar

3. **Librerias necesarias** (Herramientas > Administrar Librerias):
   - `Adafruit PN532` (by Adafruit)
   - `Adafruit SSD1306` (by Adafruit) — no necesario para BLE reader
   - `ArduinoJson` (by Benoit Blanchon)
   - `TFT_eSPI` (by Bodmer) — solo para terminal-touch
   - `XPT2046_Touchscreen` (by Paul Stoffregen) — solo para terminal-touch
   - `ESP32 BLE Arduino` (incluido con el board support) — solo para terminal-ble-reader

## Flujo de provisioning (NUEVO)

**El `config.h` NO se edita manualmente.** Se genera desde el servidor.

### Paso 1: Leer el chip ID del ESP32

Conectar el ESP32 nuevo por USB y leer su chip ID (MAC de fabrica):

**Opcion A — Arduino IDE:**
1. Abrir cualquier sketch que imprima el chip ID
2. Subir y abrir Monitor Serie (115200 baud)
3. Copiar los 12 caracteres hex del chip ID

**Opcion B — esptool.py:**
```bash
esptool.py --port COM3 chip_id
# O en Linux/Mac:
esptool.py --port /dev/ttyUSB0 chip_id
```

**Opcion C — Sketch de lectura:**
```cpp
void setup() {
  Serial.begin(115200);
  delay(1000);
  uint64_t mac = ESP.getEfuseMac();
  char macStr[13];
  snprintf(macStr, sizeof(macStr), "%012llX", (unsigned long long)mac);
  Serial.print("Chip ID: ");
  Serial.println(macStr);
}
void loop() {}
```

### Paso 2: Provisionar desde el servidor

En la web app (panel de admin) > **Provisionar Terminal**:

1. Entrar el chip ID (12 hex chars, ej. `AABBCCDDEEFF`)
2. Seleccionar tipo de terminal (keypad, touch, web, community, ble-reader)
3. Opcional: etiqueta, ubicacion
4. El servidor registra el terminal y genera:
   - `terminal_id` unico
   - `registration_token` unico
   - `config.h` con todos los valores

### Paso 3: Descargar config.h

Desde el servidor, descargar el `config.h` generado:

```bash
# Via API (con JWT del admin):
curl -X POST https://mi-nodo.org/api/nfc/terminal/provision \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "chip_id": "AABBCCDDEEFF",
    "terminal_type": "keypad",
    "label": "Ferreteria Don Jose",
    "location": "Local 5"
  }'

# Descargar el config.h:
curl -o config.h \
  -H "Authorization: Bearer <JWT>" \
  https://mi-nodo.org/api/nfc/terminal/TERM-KEYPAD-AABBCC/config.h
```

### Paso 4: Colocar config.h y compilar

1. Copiar el `config.h` descargado a la carpeta del terminal elegido
   (ej. `firmware/terminal-keypad/config.h`)
2. Abrir el `.ino` del terminal en Arduino IDE
3. Seleccionar la placa correcta:
   - ESP32 DevKit V1 — para keypad, web, community, ble-reader
   - TTGO T-Display — para touch
4. Seleccionar el puerto COM
5. Click en "Subir" (flecha derecha)
6. Esperar compilacion y subida (1-2 minutos)

### Paso 5: Configurar WiFi en el sitio (NO en la central)

Despues de flashear, el terminal se lleva al sitio de instalacion:

1. Encender el terminal
2. El ESP32 verifica su chip ID (si no coincide, se detiene con LED parpadeando)
3. Si es la primera vez, entra modo provisioning WiFi:
   - Aparece un WiFi llamado `Terminal-XXXX` (XXXX = primeros 4 del chip ID)
   - Conectarse desde el celular a ese WiFi
   - Se abre automaticamente una pagina web (portal cautivo)
   - Si no se abre: ir a `http://192.168.4.1` en el navegador
   - Seleccionar la red WiFi del sitio y entrar la contrasena
   - El terminal se reinicia y se conecta al WiFi
4. El terminal se registra con el servidor automaticamente
5. Queda operativo

### Paso 6: Verificar

1. Abrir Monitor Serie (115200 baud)
2. El terminal deberia:
   - Verificar hardware ("Hardware verificado. Chip ID: ...")
   - Conectar WiFi (o entrar modo provisioning si no hay WiFi guardado)
   - Mostrar IP asignada
   - Generar claves (si primera vez)
   - Registrarse con servidor
   - Mostrar "Listo"

## Anti-copia (importante)

El firmware compilado esta vinculado al chip ID del ESP32 especifico.
Si alguien copia el `.bin` y lo flashea en otro ESP32:
- El ESP32 arranca
- Lee su propio chip ID
- Lo compara con `EXPECTED_CHIP_ID` del config.h
- **No coincide** -> el firmware se detiene
- LED parpadea rapidamente indicando error de hardware

Esto garantiza que cada terminal es unico y no se puede clonar.

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

## Para terminal-ble-reader: libreria BLE

La libreria BLE viene incluida con el ESP32 board support.
No se necesita instalar nada adicional.

## Problemas comunes

| Problema | Solucion |
|----------|----------|
| "No se encontro placa" | Instalar ESP32 board support, seleccionar placa correcta |
| "Error al subir" | Presionar boton BOOT en ESP32 durante subida |
| "PN532 not found" | Verificar conexiones I2C, jumper SEL en I2C |
| "HARDWARE NO AUTORIZADO" | El config.h fue generado para otro chip ID. Provisionar de nuevo con el chip ID correcto |
| "Error registro" | Verificar SERVER_URL y REGISTRATION_TOKEN en config.h |
| "Error auth" | El servidor no tiene claves, verificar NFC server keys |
| OLED en blanco | Verificar direccion I2C (0x3C o 0x3D) |
| WiFi no conecta | Configurar WiFi via portal cautivo (conectarse a Terminal-XXXX) |
| LED parpadea rapido | Error de hardware: chip ID no coincide. Re-provisionar |
| LED parpadea lento (BLE) | Esperando conexion del celular. Emparejar desde la app |

Ver `troubleshooting.md` para mas detalles.
