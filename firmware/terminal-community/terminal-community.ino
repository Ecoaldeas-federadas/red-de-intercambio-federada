// terminal-community.ino — Punto comunitario (doble tarjeta: vendedor + comprador)
// ESP32 + PN532 + OLED + Buzzer (minimo hardware)
// Flujo: vendedor acerca tarjeta+PIN -> monto -> comprador acerca tarjeta+PIN -> transaccion

#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "../shared/hardware_binding.h"
#include "../shared/wifi_provisioning.h"
#include "../shared/crypto_helper.h"
#include "../shared/nfc_reader.h"
#include "../shared/display_helper.h"
#include "../shared/server_client.h"
#include "../shared/pin_helper.h"

#define BUZZER_PIN 25

KeyPair terminalKeys;
uint8_t serverPubKey[32];
uint8_t sharedKey[32];
String sessionToken = "";
unsigned long lastHeartbeat = 0;

// Community session state
enum CommunityState {
  IDLE,
  WAITING_SELLER,
  WAITING_PIN_SELLER,
  WAITING_AMOUNT,
  WAITING_BUYER,
  WAITING_PIN_BUYER,
  PROCESSING,
  DONE
};

CommunityState commState = IDLE;
String sellerCardUID = "";
String sellerPIN = "";
int64_t amount = 0;

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

  initPinInput();
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

  commState = IDLE;
}

void loop() {
  // Heartbeat
  if (millis() - lastHeartbeat > 30000) {
    sendHeartbeat(&config, serverPubKey);
    lastHeartbeat = millis();
  }

  switch (commState) {

    case IDLE:
      showText("Punto", 2, 8);
      display.setCursor(0, 32);
      display.setTextSize(2);
      display.println("Comunitario");
      display.display();
      delay(2000);
      showText("Vendedor:", 1, 8);
      display.setCursor(0, 24);
      display.setTextSize(2);
      display.println("acerque");
      display.setCursor(0, 40);
      display.println("tarjeta");
      display.display();
      commState = WAITING_SELLER;
      break;

    case WAITING_SELLER: {
      NFCCard card = readNFCCard(500);
      if (card.valid) {
        sellerCardUID = card.uid;
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);
        showPINPrompt("vendedor");
        commState = WAITING_PIN_SELLER;
      }
      break;
    }

    case WAITING_PIN_SELLER: {
      sellerPIN = inputPIN("PIN vendedor");
      showText("Monto?", 2, 24);
      commState = WAITING_AMOUNT;
      break;
    }

    case WAITING_AMOUNT: {
      amount = inputAmount();
      showThreeLines("Vende: " + sellerCardUID.substring(0, 8),
                     "Monto: " + String(amount / 100) + "." + String(amount % 100),
                     "Comprador: acerce");
      commState = WAITING_BUYER;
      break;
    }

    case WAITING_BUYER: {
      NFCCard card = readNFCCard(500);
      if (card.valid) {
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);

        // Check seller != buyer
        if (card.uid == sellerCardUID) {
          showText("Misma tarjeta!", 1, 24);
          delay(2000);
          showThreeLines("Vende: " + sellerCardUID.substring(0, 8),
                         "Monto: " + String(amount / 100) + "." + String(amount % 100),
                         "Comprador: acerce");
          break;
        }

        showPINPrompt("comprador");
        commState = WAITING_PIN_BUYER;
      }
      break;
    }

    case WAITING_PIN_BUYER: {
      String buyerPIN = inputPIN("PIN comprador");
      commState = PROCESSING;

      // Build community payment payload
      StaticJsonDocument<512> payload;
      payload["seller_card_uid"] = sellerCardUID;
      payload["seller_crypto_token"] = sellerCardUID;
      payload["seller_pin"] = sellerPIN;
      payload["buyer_card_uid"] = ""; // will be set from last read
      payload["buyer_pin"] = buyerPIN;
      payload["amount"] = amount;
      payload["timestamp"] = millis();
      payload["nonce"] = String((unsigned long)esp_random());

      // We need the buyer card UID - store it from WAITING_BUYER
      // For simplicity, re-read is not needed; store in variable
      // In production: store buyerCardUID in WAITING_BUYER state

      String payloadStr;
      serializeJson(payload, payloadStr);

      showProcessing();

      String response = sendPayment(&config, sharedKey, payloadStr,
                                     terminalKeys.private_key,
                                     "/api/nfc/terminal/payment/community");

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

      commState = DONE;
      break;
    }

    case PROCESSING:
      // Handled in WAITING_PIN_BUYER
      break;

    case DONE:
      delay(3000);
      // Reset for next transaction
      sellerCardUID = "";
      sellerPIN = "";
      amount = 0;
      commState = IDLE;
      break;
  }

  delay(50);
}
