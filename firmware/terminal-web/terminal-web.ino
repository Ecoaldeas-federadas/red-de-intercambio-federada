// terminal-web.ino — Terminal NFC modo web (polling de monto desde app)
// ESP32 + PN532 + OLED + Buzzer (minimo hardware)
// El comerciante setea el monto desde la app web/frontend

#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "../shared/crypto_helper.h"
#include "../shared/nfc_reader.h"
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

  if (!initDisplay()) Serial.println("Display init failed");
  showText("Iniciando...", 1, 24);

  if (!initNFCReader()) {
    showText("Error NFC", 2, 24);
    while (1) delay(1000);
  }

  pinMode(BUZZER_PIN, OUTPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  showText("Conectando WiFi", 1, 24);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
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

  // For web terminal: PIN is entered in the web app
  // The server already has the PIN from the web session
  showProcessing();

  StaticJsonDocument<256> payload;
  payload["card_uid"] = card.uid;
  payload["crypto_token"] = card.uid;
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
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW); delay(100);
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);
      } else {
        digitalWrite(BUZZER_PIN, HIGH); delay(300);
        digitalWrite(BUZZER_PIN, LOW);
      }
    } else {
      showText("Error decrypt", 1, 24);
    }
  } else {
    showText("Error red", 2, 24);
  }

  // Reset
  hasPendingAmount = false;
  pendingAmount = 0;
  delay(3000);
  showText("Esperando monto", 1, 16);
}
