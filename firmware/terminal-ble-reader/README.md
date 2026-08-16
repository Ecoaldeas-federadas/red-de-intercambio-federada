# Terminal BLE Reader (Lector tonto)

Terminal NFC minimalista que se conecta por Bluetooth al celular.
No tiene WiFi, no tiene pantalla, no procesa transacciones.
Solo lee tarjetas NFC y envia el UID por BLE al telefono.

## Filosofia

El ESP32 es lo mas tonto posible:
- Lee el UID de la tarjeta NFC
- Lo envia por Bluetooth al celular emparejado
- **Eso es todo**

El celular hace todo el trabajo:
- Interfaz de usuario (pantalla, teclado, monto, PIN)
- Conexion al servidor
- Procesamiento de transacciones
- Encriptacion end-to-end con el servidor

## Hardware

| Componente | Modelo | Notas |
|-----------|--------|-------|
| MCU | ESP32 | Cualquier variante con BLE |
| NFC Reader | PN532 | Conectado por I2C o SPI |
| LED | Integrado | GPIO 2 (estado) |
| Buzzer | Opcional | No requerido |

No se necesita:
- ~~Pantalla OLED/ TFT~~
- ~~WiFi~~
- ~~Encoder/Keypad~~
- ~~Buzzer~~ (opcional)

## Wiring (PN532 por I2C)

```
ESP32          PN532
-----          -----
GPIO 21 (SDA)  SDA
GPIO 22 (SCL)  SCL
3.3V           VCC
GND            GND
```

Configurar el PN532 en modo I2C (jumpers IRQ=0, I2C=1).

## Protocolo BLE

### Servicio
```
UUID: 6e400001-b5a3-f393-e0a9-e50e24dcca9e
```

### Caracteristicas

| UUID | Direccion | Funcion |
|------|-----------|---------|
| `6e400002-...` | ESP32 -> Celular | Notify: card UID leido |
| `6e400003-...` | Celular -> ESP32 | Write: comandos |
| `6e400004-...` | ESP32 -> Celular | Read/Notify: estado + config |

### Mensajes

**Card UID leido** (ESP32 -> celular, notify):
```json
{"card_uid": "A1B2C3D4", "timestamp": 12345}
```

**Estado/Config** (ESP32 -> celular, al conectar):
```json
{
  "terminal_id": "TERM-BLE-001",
  "server_url": "https://nodo-a.org",
  "chip_id": "AABBCCDDEEFF",
  "connected": true
}
```

**Comandos** (celular -> ESP32):
| Comando | Accion |
|---------|--------|
| `read` | Iniciar modo lectura |
| `cancel` | Cancelar lectura en curso |
| `status` | Solicitar estado + config |

## Seguridad

1. **BLE encriptado**: LE Secure Connections con MITM protection
2. **Hardware binding**: el firmware verifica el chip ID del ESP32 al arranque
3. **No almacena nada**: el ESP32 no guarda credenciales ni claves de transaccion
4. **Solo UID**: el ESP32 solo envia el UID de la tarjeta, toda la cripto la hace el celular

## Configuracion

El `config.h` es generado por el servidor. No se edita manualmente.
Ver el README principal del firmware para el flujo de provisioning.
