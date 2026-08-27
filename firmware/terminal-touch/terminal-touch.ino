// terminal-touch.ino — Terminal NFC con pantalla tactil (TTGO T-Display)
// ESP32 + ILI9341 tactil + PN532 + Buzzer
// Monto y PIN se ingresan en pantalla tactil

#include <WiFi.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>
#include "config.h"
#include "../shared/hardware_binding.h"
#include "../shared/wifi_provisioning.h"
#include "../shared/crypto_helper.h"
#include "../shared/nfc_reader.h"
#include "../shared/desfire_crypto.h"
#include "../shared/card_rotation.h"
#include "../shared/server_client.h"
#include "../shared/local_lock.h"

#define BUZZER_PIN 25
#define XPT2046_IRQ  36
#define XPT2046_MOSI 32
#define XPT2046_MISO 39
#define XPT2046_CLK  25
#define XPT2046_CS   33

TFT_eSPI tft = TFT_eSPI();
XPT2046_Touchscreen ts(XPT2046_CS, XPT2046_IRQ);
SPIClass touchSPI = SPIClass(VSPI);

KeyPair terminalKeys;
uint8_t serverPubKey[32];
uint8_t sharedKey[32];
String sessionToken = "";
unsigned long lastHeartbeat = 0;
bool serverActive = true;

ServerConfig config;

// Touch keypad state
String currentInput = "";
bool inputConfirmed = false;

void drawKeypad(const String& title, const String& currentValue) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 10);
  tft.println(title);

  tft.setTextSize(3);
  tft.setCursor(10, 40);
  tft.println(currentValue);

  // Draw 3x4 keypad
  const char* keys[12] = {"1","2","3","4","5","6","7","8","9","C","0","OK"};
  int x0 = 20, y0 = 90, w = 90, h = 50, gap = 5;

  for (int i = 0; i < 12; i++) {
    int col = i % 3;
    int row = i / 3;
    int x = x0 + col * (w + gap);
    int y = y0 + row * (h + gap);

    uint32_t color = TFT_DARKGREY;
    if (String(keys[i]) == "OK") color = TFT_DARKGREEN;
    if (String(keys[i]) == "C") color = TFT_DARKRED;

    tft.fillRect(x, y, w, h, color);
    tft.drawRect(x, y, w, h, TFT_WHITE);
    tft.setTextColor(TFT_WHITE, color);
    tft.setTextSize(3);
    tft.setCursor(x + 30, y + 15);
    tft.println(keys[i]);
  }
}

int getTouchedKey() {
  if (!ts.tirqTouched()) return -1;
  TS_Point p = ts.getPoint();
  // Map touch coordinates to keypad
  int x0 = 20, y0 = 90, w = 90, h = 50, gap = 5;

  for (int i = 0; i < 12; i++) {
    int col = i % 3;
    int row = i / 3;
    int x = x0 + col * (w + gap);
    int y = y0 + row * (h + gap);
    // Simple bounding box check (coordinates need calibration)
    if (p.x > 1500 && p.x < 3800 && p.y > 1500 && p.y < 3800) {
      // Approximate mapping - adjust for your display
      int touchCol = (p.x - 1500) / 770;
      int touchRow = (p.y - 1500) / 770;
      if (touchCol == col && touchRow == row) return i;
    }
  }
  return -1;
}

String inputOnTouchscreen(const String& title, int maxLen) {
  String value = "";
  inputConfirmed = false;

  drawKeypad(title, "");

  while (!inputConfirmed) {
    int key = getTouchedKey();
    if (key >= 0) {
      const char* keys[12] = {"1","2","3","4","5","6","7","8","9","C","0","OK"};

      if (key == 10) { // "0"
        if (value.length() < maxLen) value += "0";
      } else if (key == 9) { // "C" = clear
        value = "";
      } else if (key == 11) { // "OK"
        if (value.length() > 0) inputConfirmed = true;
      } else {
        if (value.length() < maxLen) value += keys[key];
      }

      drawKeypad(title, value);
      delay(300); // debounce
    }
    delay(50);
  }
  return value;
}

void showTextTouch(const String& text, int color = TFT_WHITE) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(color, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 100);
  tft.println(text);
}

void setup() {
  Serial.begin(115200);

  // 1. Verificar que este firmware corresponde a este hardware fisico
  if (!verifyHardwareBinding(EXPECTED_CHIP_ID)) {
    return;  // verifyHardwareBinding detiene el dispositivo si no coincide
  }
  Serial.print("Hardware verificado. Chip ID: ");
  Serial.println(getFullMacHex());

  // Init display
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  showTextTouch("Iniciando...");

  // Init touch
  touchSPI.begin(XPT2046_CLK, XPT2046_MISO, XPT2046_MOSI, XPT2046_CS);
  ts.begin(touchSPI);
  ts.setRotation(1);

  // Init NFC
  if (!initNFCReader()) {
    showTextTouch("Error NFC", TFT_RED);
    while (1) delay(1000);
  }

  pinMode(BUZZER_PIN, OUTPUT);

  // Init local lock
  initLocalLock();

  // 2. Conectar WiFi (provisioning en el sitio si es la primera vez)
  if (!connectToWifi()) {
    String apSuffix = String(EXPECTED_CHIP_ID).substring(0, 4);
    showTextTouch("Configura WiFi\nConectate a:\nTerminal-" + apSuffix);
    startProvisioningAP(apSuffix);
    while (true) {
      provisioningLoop();
    }
  }

  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 10);
  tft.println("IP: " + WiFi.localIP().toString());

  config.serverUrl = SERVER_URL;
  config.terminalId = TERMINAL_ID;
  config.registrationToken = REGISTRATION_TOKEN;

  if (!isRegistered()) {
    showTextTouch("Generando claves...");
    if (!generateKeyPair(&terminalKeys)) {
      showTextTouch("Error cripto", TFT_RED);
      while (1) delay(1000);
    }
    saveKeyPair(&terminalKeys);

    if (config.registrationToken.length() > 0) {
      showTextTouch("Registrando...");
      if (!completeRegistration(&config, &terminalKeys, serverPubKey)) {
        showTextTouch("Error registro", TFT_RED);
        while (1) delay(1000);
      }
      saveServerPublicKey(serverPubKey);
      showTextTouch("Registrado OK", TFT_GREEN);
    } else {
      // Emparejamiento por codigo de 6 digitos
      showTextTouch("Emparejando...");
      String code = initiatePairing(&config, &terminalKeys, "touch");
      if (code.length() == 0) {
        showTextTouch("Error emparejar", TFT_RED);
        while (1) delay(5000);
      }

      showTextTouch("Codigo: " + code, TFT_CYAN, 24);
      showTextTouch("Ingresa en panel admin", TFT_WHITE, 48);

      while (true) {
        delay(3000);
        PairingPollResult pr = pollPairingStatus(&config, code);
        if (pr.status == "approved") {
          config.terminalId = pr.terminalId;
          size_t len;
          hexToBytes(pr.serverPubKey, serverPubKey, &len);
          saveServerPublicKey(serverPubKey);
          saveTerminalId(config.terminalId);
          showTextTouch("Aprobado!", TFT_GREEN);
          break;
        } else if (pr.status == "rejected") {
          showTextTouch("Rechazado", TFT_RED);
          while (1) delay(5000);
        } else if (pr.status == "expired") {
          showTextTouch("Expirado", TFT_RED);
          while (1) delay(5000);
        }
      }
    }
  } else {
    loadKeyPair(&terminalKeys);
    loadServerPublicKey(serverPubKey);
    config.terminalId = loadTerminalId();
  }

  deriveSharedKey(terminalKeys.private_key, serverPubKey, sharedKey);

  showTextTouch("Autenticando...");
  sessionToken = authenticateTerminal(&config, &terminalKeys, serverPubKey);
  if (sessionToken.length() == 0) {
    showTextTouch("Error auth", TFT_RED);
    while (1) delay(5000);
  }

  showTextTouch("Listo", TFT_GREEN);
  delay(1000);
}

void loop() {
  // Heartbeat — verifica estado activo en el servidor
  if (millis() - lastHeartbeat > 30000) {
    String hbResponse = sendHeartbeat(&config, serverPubKey);
    if (hbResponse.indexOf("\"active\":false") >= 0) {
      serverActive = false;
    } else if (hbResponse.length() > 0) {
      serverActive = true;
    }
    lastHeartbeat = millis();
  }

  // Si el servidor desactivo el terminal
  if (!serverActive) {
    showTextTouch("Terminal no\ninicializado\n\nContacte admin", TFT_RED);
    delay(5000);
    return;
  }

  // Si esta bloqueado localmente, pedir PIN para desbloquear
  if (isLocalLocked()) {
    showTextTouch("BLOQUEADO\n\nIngrese PIN:", TFT_YELLOW);
    String enteredPIN = inputOnTouchscreen("PIN desbloqueo:", 4);
    if (checkLockPIN(enteredPIN, LOCK_PIN)) {
      unlockTerminal();
      showTextTouch("Desbloqueado", TFT_GREEN);
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      delay(1000);
    } else {
      showTextTouch("PIN incorrecto", TFT_RED);
      digitalWrite(BUZZER_PIN, HIGH); delay(300);
      digitalWrite(BUZZER_PIN, LOW);
      delay(2000);
    }
    return;
  }

  // Step 1: Input amount on touchscreen
  String amountStr = inputOnTouchscreen("Monto (centavos):", 8);
  int64_t amount = atoll(amountStr.c_str());

  // Step 2: Wait for card
  showTextTouch("Acerce tarjeta", TFT_CYAN);
  NFCCard card;
  do {
    card = readNFCCard(500);
  } while (!card.valid);

  digitalWrite(BUZZER_PIN, HIGH); delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Mostrar tipo de tarjeta
  if (card.isSecure) {
    showTextTouch("Tarjeta segura (DESFire)", TFT_GREEN);
  } else {
    showTextTouch("Tarjeta normal (UID+PIN)", TFT_CYAN);
  }
  delay(800);

  // Step 3: Input PIN on touchscreen
  String pin = inputOnTouchscreen("PIN:", 4);

  // Step 4: Send payment
  showTextTouch("Procesando...", TFT_YELLOW);

  // Variables para flujo criptografico
  uint8_t cardAESKey[16] = {0};
  bool hasCardKey = false;
  String cryptoToken = "";

  // Si es tarjeta segura, pedir clave AES y autenticar
  if (card.isSecure) {
    showTextTouch("Auth tarjeta...", TFT_YELLOW);
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
            showTextTouch("Auth fallo - tarjeta falsa?", TFT_RED);
            delay(2000);
            if (hasCardKey) clearKeyFromMemory(cardAESKey, 16);
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
  payload["pin"] = pin;
  payload["amount"] = amount;
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

      if (status == "approved") {
        // Rotacion de clave si es tarjeta segura
        if (card.isSecure && hasCardKey) {
          showTextTouch("Rotando clave...", TFT_YELLOW);
          RotationResult rotResult = performRotation(
            &config, sharedKey, terminalKeys.private_key,
            card.uid, config.terminalId, cardAESKey);
          if (rotResult.success) {
            showTextTouch("Clave rotada OK", TFT_GREEN);
            delay(800);
          } else {
            showTextTouch("Rotacion fallo (no critico)", TFT_YELLOW);
            delay(1000);
          }
        }
        showTextTouch("APROBADA\n" + message, TFT_GREEN);
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW); delay(100);
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);
      } else {
        showTextTouch("RECHAZADA\n" + message, TFT_RED);
        digitalWrite(BUZZER_PIN, HIGH); delay(300);
        digitalWrite(BUZZER_PIN, LOW);
      }
      // Limpiar clave de memoria
      if (hasCardKey) {
        clearKeyFromMemory(cardAESKey, 16);
        hasCardKey = false;
      }
    } else {
      showTextTouch("Error decrypt", TFT_RED);
    }
  } else {
    showTextTouch("Error red", TFT_RED);
  }
  if (hasCardKey) clearKeyFromMemory(cardAESKey, 16);

  delay(3000);
  showTextTouch("Listo", TFT_GREEN);
}
