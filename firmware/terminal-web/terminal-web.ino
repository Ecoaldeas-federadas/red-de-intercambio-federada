// terminal-web.ino — Terminal NFC modo web (polling de monto desde app)
// ESP32 + PN532 + OLED + Buzzer (minimo hardware)
// El comerciante setea el monto desde la app web/frontend

#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "../shared/hardware_binding.h"
#include "../shared/wifi_provisioning.h"
#include "../shared/crypto_helper.h"
#include "../shared/nfc_reader.h"
#include "../shared/desfire_crypto.h"
#include "../shared/card_rotation.h"
#include "../shared/display_helper.h"
#include "../shared/server_client.h"

#define BUZZER_PIN 25

KeyPair terminalKeys;
uint8_t serverPubKey[32];
uint8_t sharedKey[32];
String sessionToken = "";
unsigned long lastHeartbeat = 0;
int64_t pendingAmount = 0;
bool hasPendingAmount = false;

ServerConfig config;

void setup() {
  Serial.begin(115200);

  // 1. Verificar que este firmware corresponde a este hardware fisico
  if (!verifyHardwareBinding(EXPECTED_CHIP_ID)) {
    return;  // verifyHardwareBinding detiene el dispositivo si no coincide
  }
  Serial.print("Hardware verificado. Chip ID: ");
  Serial.println(getFullMacHex());

  if (!initDisplay()) Serial.println("Display init failed");
  showText("Iniciando...", 1, 24);

  if (!initNFCReader()) {
    showText("Error NFC", 2, 24);
    while (1) delay(1000);
  }

  pinMode(BUZZER_PIN, OUTPUT);

  // 2. Conectar WiFi (provisioning en el sitio si es la primera vez)
  if (!connectToWifi()) {
    showText("Configura WiFi", 1, 16);
    showText("conectate a:", 1, 32);
    String apSuffix = String(EXPECTED_CHIP_ID).substring(0, 4);
    showText("Terminal-" + apSuffix, 1, 48);
    startProvisioningAP(apSuffix);
    while (true) {
      provisioningLoop();
    }
  }
  showIP(WiFi.localIP().toString());

  config.serverUrl = SERVER_URL;
  config.terminalId = TERMINAL_ID;
  config.registrationToken = REGISTRATION_TOKEN;

  if (!isRegistered()) {
    showText("Generando claves...", 1, 16);
    if (!generateKeyPair(&terminalKeys)) {
      showText("Error cripto", 2, 24);
      while (1) delay(1000);
    }
    saveKeyPair(&terminalKeys);

    showText("Registrando...", 1, 16);
    if (!completeRegistration(&config, &terminalKeys, serverPubKey)) {
      showText("Error registro", 2, 16);
      while (1) delay(1000);
    }
    saveServerPublicKey(serverPubKey);
    showText("Registrado OK", 1, 24);
  } else {
    loadKeyPair(&terminalKeys);
    loadServerPublicKey(serverPubKey);
  }

  deriveSharedKey(terminalKeys.private_key, serverPubKey, sharedKey);

  showText("Autenticando...", 1, 16);
  sessionToken = authenticateTerminal(&config, &terminalKeys, serverPubKey);
  if (sessionToken.length() == 0) {
    showText("Error auth", 2, 24);
    while (1) delay(5000);
  }

  showText("Esperando monto", 1, 16);
  showTwoLines("Monto desde app", "web...");
}

void loop() {
  // Heartbeat
  if (millis() - lastHeartbeat > 30000) {
    sendHeartbeat(&config, serverPubKey);
    lastHeartbeat = millis();
  }

  // Poll for pending amount from server
  if (!hasPendingAmount) {
    String url = config.serverUrl + "/api/nfc/terminal/" + config.terminalId + "/session";
    String response = httpGet(url);

    if (response.length() > 0) {
      StaticJsonDocument<512> respDoc;
      deserializeJson(respDoc, response);

      String status = respDoc["status"] | "";
      if (status == "waiting_card") {
        int64_t amt = respDoc["current_amount"] | 0;
        pendingAmount = amt;
        hasPendingAmount = true;
        showAmount(String(amt / 100) + "." + String(amt % 100));
        delay(1000);
      }
    }
    delay(2000); // Poll every 2 seconds
    return;
  }

  // We have a pending amount, wait for card
  showWaitingCard();
  NFCCard card;
  do {
    card = readNFCCard(500);
  } while (!card.valid);

  digitalWrite(BUZZER_PIN, HIGH); delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Mostrar tipo de tarjeta
  if (card.isSecure) {
    showText("Tarjeta segura", 1, 16);
  } else {
    showText("Tarjeta normal", 1, 16);
  }

  // For web terminal: PIN is entered in the web app
  // The server already has the PIN from the web session
  showProcessing();

  // Variables para flujo criptografico
  uint8_t cardAESKey[16] = {0};
  bool hasCardKey = false;
  String cryptoToken = "";

  // Si es tarjeta segura, pedir clave AES y autenticar
  if (card.isSecure) {
    showText("Auth tarjeta...", 1, 24);
    StaticJsonDocument<256> keyReq;
    keyReq["terminal_id"] = config.terminalId;
    String keyReqStr;
    serializeJson(keyReq, keyReqStr);

    String keyUrl = config.serverUrl + "/api/nfc/cards/" + card.uid + "/request-key?terminal_id=" + config.terminalId;
    String keyResponse = sendPayment(&config, sharedKey, keyReqStr, terminalKeys.private_key, keyUrl);

    if (keyResponse.length() > 0) {
      String keyDecrypted = decryptServerResponse(sharedKey, keyResponse, serverPubKey);
      if (keyDecrypted.length() > 0) {
        StaticJsonDocument<512> keyResult;
        deserializeJson(keyResult, keyDecrypted);
        String keyHex = keyResult["aes_key_hex"] | "";
        if (keyHex.length() == 32) {
          size_t len;
          hexToBytes(keyHex, cardAESKey, &len);
          hasCardKey = true;
          if (authenticateDESFire(cardAESKey)) {
            cryptoToken = "desfire_auth_ok";
          } else {
            showText("Auth fallo", 2, 24);
            if (hasCardKey) clearKeyFromMemory(cardAESKey, 16);
            delay(2000);
            hasPendingAmount = false;
            showText("Esperando monto", 1, 16);
            continue;
          }
        }
      }
    }
  } else {
    cryptoToken = card.uid;
  }

  StaticJsonDocument<256> payload;
  payload["card_uid"] = card.uid;
  payload["crypto_token"] = cryptoToken;
  payload["card_type"] = card.isSecure ? "desfire" : "uid_only";
  payload["pin"] = ""; // PIN comes from web app session
  payload["amount"] = pendingAmount;
  payload["timestamp"] = millis();
  payload["nonce"] = String((unsigned long)esp_random());

  String payloadStr;
  serializeJson(payload, payloadStr);

  String response = sendPayment(&config, sharedKey, payloadStr,
                                 terminalKeys.private_key,
                                 "/api/nfc/terminal/payment");

  if (response.length() > 0) {
    String decrypted = decryptServerResponse(sharedKey, response, serverPubKey);
    if (decrypted.length() > 0) {
      StaticJsonDocument<256> result;
      deserializeJson(result, decrypted);
      String status = result["status"] | "error";
      String message = result["message"] | "Error";

      showResult(status, message);

      if (status == "approved") {
        // Rotacion de clave si es tarjeta segura
        if (card.isSecure && hasCardKey) {
          showText("Rotando clave...", 1, 24);
          RotationResult rotResult = performRotation(
            &config, sharedKey, terminalKeys.private_key,
            card.uid, config.terminalId, cardAESKey);
          showText(rotResult.success ? "Clave rotada OK" : "Rotacion fallo", 1, 24);
          delay(800);
        }
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW); delay(100);
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);
      } else {
        digitalWrite(BUZZER_PIN, HIGH); delay(300);
        digitalWrite(BUZZER_PIN, LOW);
      }
      // Limpiar clave de memoria
      if (hasCardKey) {
        clearKeyFromMemory(cardAESKey, 16);
        hasCardKey = false;
      }
    } else {
      showText("Error decrypt", 1, 24);
    }
  } else {
    showText("Error red", 2, 24);
  }
  if (hasCardKey) clearKeyFromMemory(cardAESKey, 16);

  // Reset
  hasPendingAmount = false;
  pendingAmount = 0;
  delay(3000);
  showText("Esperando monto", 1, 16);
}
