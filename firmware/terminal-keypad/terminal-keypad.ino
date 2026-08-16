// terminal-keypad.ino — Terminal NFC con teclado (rotary encoder)
// ESP32 + PN532 + OLED SSD1306 + Rotary Encoder + Buzzer
// Terminal "tonto": lee tarjeta, pide PIN, envia al servidor, muestra resultado

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
#include "../shared/local_lock.h"

#define BUZZER_PIN 25

KeyPair terminalKeys;
uint8_t serverPubKey[32];
uint8_t sharedKey[32];
String sessionToken = "";
unsigned long lastHeartbeat = 0;
bool serverActive = true;  // el servidor marca el terminal como activo
unsigned long lockPressStart = 0;  // para detectar pulsacion larga (bloqueo)

void setup() {
  Serial.begin(115200);

  // 1. Verificar que este firmware corresponde a este hardware fisico
  if (!verifyHardwareBinding(EXPECTED_CHIP_ID)) {
    return;  // verifyHardwareBinding detiene el dispositivo si no coincide
  }
  Serial.print("Hardware verificado. Chip ID: ");
  Serial.println(getFullMacHex());

  // Init display
  if (!initDisplay()) {
    Serial.println("Display init failed");
  }
  showText("Iniciando...", 1, 24);

  // Init NFC reader
  if (!initNFCReader()) {
    showText("Error NFC", 2, 24);
    while (1) delay(1000);
  }

  // Init PIN input (rotary encoder)
  initPinInput();

  // Init buzzer
  pinMode(BUZZER_PIN, OUTPUT);

  // Init local lock
  initLocalLock();

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

  // Config del servidor
  config.serverUrl = SERVER_URL;
  config.terminalId = TERMINAL_ID;
  config.registrationToken = REGISTRATION_TOKEN;

  if (!isRegistered()) {
    // Generate keypair
    showText("Generando claves...", 1, 16);
    if (!generateKeyPair(&terminalKeys)) {
      showText("Error cripto", 2, 24);
      while (1) delay(1000);
    }
    saveKeyPair(&terminalKeys);

    // Register with server
    showText("Registrando...", 1, 16);
    if (!completeRegistration(&config, &terminalKeys, serverPubKey)) {
      showText("Error registro", 2, 16);
      while (1) delay(1000);
    }
    saveServerPublicKey(serverPubKey);
    showText("Registrado OK", 1, 24);
  } else {
    // Load existing keys
    loadKeyPair(&terminalKeys);
    loadServerPublicKey(serverPubKey);
  }

  // Derive shared key
  deriveSharedKey(terminalKeys.private_key, serverPubKey, sharedKey);

  // Authenticate
  showText("Autenticando...", 1, 16);
  sessionToken = authenticateTerminal(&config, &terminalKeys, serverPubKey);
  if (sessionToken.length() == 0) {
    showText("Error auth", 2, 24);
    while (1) delay(5000);
  }

  showReady();
  delay(1000);
}

void loop() {
  // Heartbeat every 30s — verifica estado activo en el servidor
  if (millis() - lastHeartbeat > 30000) {
    String hbResponse = sendHeartbeat(&config, serverPubKey);
    // El servidor puede indicar que el terminal esta desactivado
    if (hbResponse.indexOf("\"active\":false") >= 0) {
      serverActive = false;
    } else if (hbResponse.length() > 0) {
      serverActive = true;
    }
    lastHeartbeat = millis();
  }

  // Si el servidor desactivo el terminal (dueño cerro el punto)
  if (!serverActive) {
    showText("Terminal no", 1, 16);
    showText("inicializado", 1, 32);
    showText("Contacte admin", 1, 48);
    delay(5000);
    return;
  }

  // Si esta bloqueado localmente, pedir PIN para desbloquear
  if (isLocalLocked()) {
    showText("BLOQUEADO", 2, 16);
    showText("PIN para", 1, 40);
    showText("desbloquear:", 1, 56);
    String enteredPIN = inputPIN("PIN desbloqueo");
    if (checkLockPIN(enteredPIN, LOCK_PIN)) {
      unlockTerminal();
      showText("Desbloqueado", 1, 24);
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      delay(1000);
    } else {
      showText("PIN incorrecto", 1, 24);
      digitalWrite(BUZZER_PIN, HIGH); delay(300);
      digitalWrite(BUZZER_PIN, LOW);
      delay(2000);
    }
    return;
  }

  // Step 1: Input amount via rotary encoder
  showText("Monto?", 2, 24);
  int64_t amount = inputAmount();
  showAmount(String(amount / 100) + "." + String(amount % 100));
  delay(1000);

  // Step 2: Wait for NFC card
  showWaitingCard();
  NFCCard card;
  do {
    card = readNFCCard(500);
  } while (!card.valid);

  // Beep on card detected
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Step 3: Input PIN
  showPINPrompt("usuario");
  String pin = inputPIN("Ingrese PIN");

  // Step 4: Build payload and send
  showProcessing();

  StaticJsonDocument<256> payload;
  payload["card_uid"] = card.uid;
  payload["crypto_token"] = card.uid; // Simplified: use UID as token
  payload["pin"] = pin;
  payload["amount"] = amount;
  payload["timestamp"] = millis();
  payload["nonce"] = String((unsigned long)esp_random());

  String payloadStr;
  serializeJson(payload, payloadStr);

  String response = sendPayment(&config, sharedKey, payloadStr,
                                 terminalKeys.private_key,
                                 "/api/nfc/terminal/payment");

  // Step 5: Decrypt and show result
  if (response.length() > 0) {
    String decrypted = decryptServerResponse(sharedKey, response, serverPubKey);
    if (decrypted.length() > 0) {
      StaticJsonDocument<256> result;
      deserializeJson(result, decrypted);
      String status = result["status"] | "error";
      String message = result["message"] | "Error desconocido";

      showResult(status, message);

      if (status == "approved") {
        // Success beep
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW); delay(100);
        digitalWrite(BUZZER_PIN, HIGH); delay(100);
        digitalWrite(BUZZER_PIN, LOW);
      } else {
        // Error beep
        digitalWrite(BUZZER_PIN, HIGH); delay(300);
        digitalWrite(BUZZER_PIN, LOW);
      }
    } else {
      showText("Error decrypt", 1, 24);
    }
  } else {
    showText("Error red", 2, 24);
  }

  delay(3000);
  showReady();

  // Nota: para bloquear localmente, mantener presionado el encoder
  // 2 segundos cuando el terminal muestra "Listo" (showReady).
  // Esto se detecta en el inputAmount() con pulsacion larga.
  // Ver pin_helper.h para la implementacion del encoder.
}

// Need config as global
ServerConfig config;
