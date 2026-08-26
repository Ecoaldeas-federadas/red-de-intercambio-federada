// terminal-ble-reader.ino — Lector NFC tonto via Bluetooth (BLE)
// ESP32 + PN532 — sin WiFi, sin pantalla, sin buzzer (opcional)
//
// Este terminal es el mas simple posible: solo lee tarjetas NFC y envia
// el UID por Bluetooth al celular. El celular maneja TODO:
//   - UI (pantalla, teclado)
//   - Conexion al servidor
//   - Procesamiento de transacciones
//   - Encriptacion end-to-end con el servidor
//
// El ESP32 solo hace dos cosas:
//   1. Leer el UID de la tarjeta NFC
//   2. Enviarlo por BLE al celular emparejado
//
// Protocolo BLE:
//   - Servicio: 6e400001-... (NFC Reader Service)
//   - Char 0002: ESP32 -> celular (notifica card UID leido)
//   - Char 0003: celular -> ESP32 (comandos: "read", "cancel", "status")
//   - Char 0004: ESP32 -> celular (estado del lector + config del servidor)
//
// Seguridad:
//   - El link BLE se encripta con Secure Simple Pairing (LE Secure Connections)
//   - El ESP32 verifica su chip ID al arranque (no se puede copiar a otro)
//   - El UID de la tarjeta se envia encriptado sobre BLE
//   - El celular hace la encriptacion end-to-end con el servidor

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "config.h"
#include "../shared/hardware_binding.h"
#include "../shared/nfc_reader.h"
#include "../shared/desfire_crypto.h"

BLEServer* bleServer = NULL;
BLECharacteristic* cardChar = NULL;
BLECharacteristic* commandChar = NULL;
BLECharacteristic* statusChar = NULL;

bool deviceConnected = false;
bool oldDeviceConnected = false;

// Callbacks de conexion BLE
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer* server) {
    deviceConnected = false;
  }
};

// Callbacks de escritura (comandos desde el celular)
class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) {
    String cmd = characteristic->getValue().c_str();

    if (cmd == "read") {
      // El celular pide al ESP32 que lea una tarjeta
      // El loop principal se encarga de leer y notificar
    } else if (cmd == "cancel") {
      // Cancelar lectura en curso
    } else if (cmd == "status") {
      // Enviar estado actual + config al celular
      String status = "{\"terminal_id\":\"" + String(TERMINAL_ID) +
                      "\",\"server_url\":\"" + String(SERVER_URL) +
                      "\",\"chip_id\":\"" + getFullMacHex() +
                      "\",\"connected\":true}";
      statusChar->setValue(status.c_str());
      statusChar->notify();
    } else if (cmd == "detect_type") {
      // Detectar tipo de tarjeta (DESFire vs normal)
      NFCCard card = readNFCCard(500);
      if (card.valid) {
        String typeResp = "{\"card_uid\":\"" + card.uid +
                          "\",\"is_secure\":" + (card.isSecure ? "true" : "false") +
                          ",\"card_type\":\"" + (card.isSecure ? "desfire" : "uid_only") + "\"}";
        cardChar->setValue(typeResp.c_str());
        cardChar->notify();
      }
    } else if (cmd.startsWith("auth_desfire:")) {
      // Comando: auth_desfire:<aes_key_hex>
      // El celular envia la clave AES y el ESP32 autentica la tarjeta
      String keyHex = cmd.substring(13);
      if (keyHex.length() == 32) {
        uint8_t aesKey[16];
        size_t len;
        hexToBytes(keyHex, aesKey, &len);

        bool authOk = authenticateDESFire(aesKey);
        String resp = "{\"auth_result\":" + String(authOk ? "true" : "false") + "}";
        cardChar->setValue(resp.c_str());
        cardChar->notify();

        // Limpiar clave de memoria
        clearKeyFromMemory(aesKey, 16);
      }
    } else if (cmd.startsWith("change_key:")) {
      // Comando: change_key:<old_key_hex>:<new_key_hex>
      // El celular pide al ESP32 rotar la clave de la tarjeta
      String params = cmd.substring(11);
      int sep = params.indexOf(':');
      if (sep > 0) {
        String oldHex = params.substring(0, sep);
        String newHex = params.substring(sep + 1);
        if (oldHex.length() == 32 && newHex.length() == 32) {
          uint8_t oldKey[16], newKey[16];
          size_t len;
          hexToBytes(oldHex, oldKey, &len);
          hexToBytes(newHex, newKey, &len);

          DESFireResult res = changeKey(0x00, newKey, oldKey);
          String resp = "{\"change_key_result\":" + String(res.success ? "true" : "false") +
                        ",\"error\":\"" + res.error + "\"}";
          cardChar->setValue(resp.c_str());
          cardChar->notify();

          clearKeyFromMemory(oldKey, 16);
          clearKeyFromMemory(newKey, 16);
        }
      }
    } else if (cmd.startsWith("verify_key:")) {
      // Comando: verify_key:<new_key_hex>
      // Verificar que la nueva clave funciona
      String keyHex = cmd.substring(11);
      if (keyHex.length() == 32) {
        uint8_t aesKey[16];
        size_t len;
        hexToBytes(keyHex, aesKey, &len);

        bool ok = verifyKeyWorks(0x00, aesKey);
        String resp = "{\"verify_result\":" + String(ok ? "true" : "false") + "}";
        cardChar->setValue(resp.c_str());
        cardChar->notify();

        clearKeyFromMemory(aesKey, 16);
      }
    }
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("NFC BLE Reader iniciando...");

  // 1. Verificar que este firmware corresponde a este hardware fisico
  if (!verifyHardwareBinding(EXPECTED_CHIP_ID)) {
    return;  // verifyHardwareBinding detiene el dispositivo si no coincide
  }
  Serial.print("Hardware verificado. Chip ID: ");
  Serial.println(getFullMacHex());

  // 2. Iniciar NFC reader
  if (!initNFCReader()) {
    Serial.println("Error: no se pudo iniciar PN532");
    // Parpadeo rapido para indicar error de hardware
    pinMode(2, OUTPUT);
    while (true) {
      digitalWrite(2, HIGH); delay(100);
      digitalWrite(2, LOW); delay(100);
    }
  }
  Serial.println("NFC reader OK");

  // 3. Iniciar BLE
  BLEDevice::init(BLE_DEVICE_NAME);
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_MITM);
  BLEDevice::setSecurityIOCap(ESP_IO_CAP_KBDISP);  // permite pairing con PIN

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

  // Caracteristica: card UID (ESP32 -> celular, notify)
  cardChar = service->createCharacteristic(
    BLE_CHAR_CARD_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  cardChar->addDescriptor(new BLE2902());

  // Caracteristica: comandos (celular -> ESP32, write)
  commandChar = service->createCharacteristic(
    BLE_CHAR_COMMAND_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  commandChar->setCallbacks(new CommandCallbacks());

  // Caracteristica: estado/config (ESP32 -> celular, read + notify)
  statusChar = service->createCharacteristic(
    BLE_CHAR_STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusChar->addDescriptor(new BLE2902());

  service->start();

  // Advertising
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);  // ayuda con conexion iPhone
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE activo. Esperando conexion del celular...");
  Serial.print("Nombre BLE: ");
  Serial.println(BLE_DEVICE_NAME);

  // LED integrado para indicar estado
  pinMode(2, OUTPUT);
}

void loop() {
  // Indicador de estado con LED:
  // - No conectado: parpadeo lento
  // - Conectado, esperando tarjeta: encendido fijo
  // - Tarjeta leida: parpadeo rapido

  if (!deviceConnected) {
    digitalWrite(2, HIGH); delay(500);
    digitalWrite(2, LOW); delay(500);

    // Reconectar advertising si se desconecto
    if (oldDeviceConnected && !deviceConnected) {
      delay(500);  // dar tiempo al stack BLE
      BLEDevice::startAdvertising();
      Serial.println("Reanudando advertising BLE...");
      oldDeviceConnected = deviceConnected;
    }
    return;
  }

  // Recien conectado
  if (!oldDeviceConnected && deviceConnected) {
    Serial.println("Celular conectado via BLE");
    oldDeviceConnected = deviceConnected;

    // Enviar estado inicial al celular
    String status = "{\"terminal_id\":\"" + String(TERMINAL_ID) +
                    "\",\"server_url\":\"" + String(SERVER_URL) +
                    "\",\"chip_id\":\"" + getFullMacHex() +
                    "\",\"connected\":true}";
    statusChar->setValue(status.c_str());
    statusChar->notify();
  }

  // LED encendido fijo = esperando tarjeta
  digitalWrite(2, HIGH);

  // Leer tarjeta NFC (timeout corto para no bloquear el loop BLE)
  NFCCard card = readNFCCard(200);

  if (card.valid) {
    Serial.print("Tarjeta leida: ");
    Serial.println(card.uid);

    // Enviar UID al celular via BLE
    // Formato JSON: {"card_uid":"XXXX","timestamp":12345}
    String payload = "{\"card_uid\":\"" + card.uid +
                     "\",\"timestamp\":" + String(millis()) + "}";
    cardChar->setValue(payload.c_str());
    cardChar->notify();

    // Parpadeo rapido = tarjeta leida
    for (int i = 0; i < 3; i++) {
      digitalWrite(2, LOW); delay(80);
      digitalWrite(2, HIGH); delay(80);
    }

    // Pequena pausa para evitar lecturas duplicadas
    delay(1000);
  }

  // Pequeno delay para no saturar el loop
  delay(50);
}
