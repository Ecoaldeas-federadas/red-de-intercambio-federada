// config.h — Configuracion del lector BLE (terminal tonto)
// IMPORTANTE: Este archivo es GENERADO POR EL SERVIDOR.
// No editar manualmente. El servidor genera este archivo con los valores
// reales del terminal (terminal_id, token, server URL, chip ID) y compila
// el firmware.
//
// Este terminal NO usa WiFi ni pantalla. Solo lee tarjetas NFC y las envia
// por Bluetooth (BLE) al celular, que se encarga de toda la logica.
// El ESP32 actua como un lector NFC periferico del telefono.

#ifndef CONFIG_H
#define CONFIG_H

// Vinculacion al hardware fisico (chip ID unico del ESP32 en efuse)
// Si este firmware se flashea en otro ESP32, no arrancara.
#define EXPECTED_CHIP_ID  "AABBCCDDEEFF"

// Identidad del terminal (generada por el servidor)
#define TERMINAL_ID        "TERM-BLE-001"
#define REGISTRATION_TOKEN "TOKEN-DEL-ADMIN"

// URL del servidor (sin barra final)
// El ESP32 no se conecta al servidor directamente — el celular lo hace.
// Pero el celular necesita saber a que servidor conectarse, y lo obtiene
// del ESP32 via BLE durante el emparejamiento.
#define SERVER_URL         "https://tu-servidor.com"

// Nombre del servicio BLE y caracteristicas
#define BLE_DEVICE_NAME    "NFC-Reader-001"
#define BLE_SERVICE_UUID        "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHAR_CARD_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // ESP32 -> celular (card UID)
#define BLE_CHAR_COMMAND_UUID   "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // celular -> ESP32 (comandos)
#define BLE_CHAR_STATUS_UUID    "6e400004-b5a3-f393-e0a9-e50e24dcca9e"  // ESP32 -> celular (estado/config)

#endif // CONFIG_H
