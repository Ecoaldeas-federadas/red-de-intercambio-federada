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
#include "../shared/desfire_crypto.h"
#include "../shared/card_rotation.h"
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

    // Emparejamiento por codigo corto (nuevo flujo)
    // Si hay registration_token (provision manual), usar completeRegistration
    // Si no, usar emparejamiento por codigo
    if (config.registrationToken.length() > 0) {
      showText("Registrando...", 1, 16);
      if (!completeRegistration(&config, &terminalKeys, serverPubKey)) {
        showText("Error registro", 2, 16);
        while (1) delay(1000);
      }
      saveServerPublicKey(serverPubKey);
      showText("Registrado OK", 1, 24);
    } else {
      // Emparejamiento por codigo de 6 digitos
      showText("Emparejando...", 1, 16);
      String code = initiatePairing(&config, &terminalKeys, "keypad");
      if (code.length() == 0) {
        showText("Error emparejar", 2, 16);
        while (1) delay(5000);
      }

      // Mostrar codigo en pantalla
      showText("Codigo:", 1, 16);
      showText(code, 2, 24);
      showText("Ingresa en panel", 3, 40);

      // Poll hasta que se apruebe o expire
      while (true) {
        delay(3000);
        PairingPollResult pr = pollPairingStatus(&config, code);
        if (pr.status == "approved") {
          // Guardar terminal_id y server_public_key
          config.terminalId = pr.terminalId;
          size_t len;
          hexToBytes(pr.serverPubKey, serverPubKey, &len);
          saveServerPublicKey(serverPubKey);
          saveTerminalId(config.terminalId);
          showText("Aprobado!", 1, 24);
          break;
        } else if (pr.status == "rejected") {
          showText("Rechazado", 2, 24);
          while (1) delay(5000);
        } else if (pr.status == "expired") {
          showText("Expirado", 2, 24);
          while (1) delay(5000);
        }
        // pending: seguir esperando
      }
    }
  } else {
    // Load existing keys
    loadKeyPair(&terminalKeys);
    loadServerPublicKey(serverPubKey);
    config.terminalId = loadTerminalId();
  }

  // Derive shared key
  deriveSharedKey(terminalKeys.private_key, serverPubKey, sharedKey);

  // Authenticate
  showText("Autenticando...", 1, 16);
  sessionToken = authenticateTerminal(&config, &terminalKeys, serverPubKey);
  if (sessionToken.length() == 0) {
    showText("Error auth", 2, 24);
    // El terminal pudo haber sido borrado del servidor. Resetear registro.
    clearRegistration();
    showText("Resetear reg", 2, 40);
    showText("Reiniciar...", 3, 56);
    delay(3000);
    ESP.restart();
  }

  // Verificar estado con heartbeat al arrancar
  int hbStatus = sendHeartbeat(&config, serverPubKey);
  if (hbStatus == 3) {
    // Terminal fue borrado del servidor
    showText("Terminal", 1, 16);
    showText("eliminado", 1, 32);
    showText("Reiniciar...", 2, 48);
    clearRegistration();
    delay(3000);
    ESP.restart();
  } else if (hbStatus == 2) {
    serverActive = false;
  } else if (hbStatus == 1) {
    serverActive = true;
  }

  showReady();
  delay(1000);
}

void loop() {
  // Heartbeat every 30s — verifica estado activo en el servidor
  if (millis() - lastHeartbeat > 30000) {
    int hbStatus = sendHeartbeat(&config, serverPubKey);
    if (hbStatus == 3) {
      // Terminal fue borrado del servidor: resetear y reiniciar
      showText("Terminal", 1, 16);
      showText("eliminado", 1, 32);
      clearRegistration();
      delay(3000);
      ESP.restart();
    } else if (hbStatus == 2) {
      serverActive = false;
    } else if (hbStatus == 1) {
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

  // Mostrar tipo de tarjeta detectada
  if (card.isSecure) {
    showText("Tarjeta segura", 1, 16);
    showText("(DESFire EV3)", 1, 32);
  } else {
    showText("Tarjeta normal", 1, 16);
    showText("(UID + PIN)", 1, 32);
  }
  delay(800);

  // Step 3: Input PIN
  showPINPrompt("usuario");
  String pin = inputPIN("Ingrese PIN");

  // Step 4: Build payload and send
  showProcessing();

  // Variables para flujo criptografico
  uint8_t cardAESKey[16] = {0};
  bool hasCardKey = false;
  String cryptoToken = "";

  // Si es tarjeta segura (DESFire), pedir clave AES al servidor
  if (card.isSecure) {
    showText("Autenticando", 1, 16);
    showText("tarjeta...", 1, 32);

    // Pedir clave AES al servidor (canal cifrado)
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
        String keyB64 = keyResult["aes_key_b64"] | "";

        if (keyB64.length() > 0) {
          // Decodificar base64 a bytes (simplificado: hex si viene en hex)
          String keyHex = keyResult["aes_key_hex"] | "";
          if (keyHex.length() == 32) {
            size_t len;
            hexToBytes(keyHex, cardAESKey, &len);
            hasCardKey = true;

            // Autenticar DESFire con la clave
            if (authenticateDESFire(cardAESKey)) {
              cryptoToken = "desfire_auth_ok";
              showText("Auth OK", 1, 40);
            } else {
              showText("Auth fallo", 1, 40);
              showText("Tarjeta falsa?", 1, 56);
              delay(2000);
              showReady();
              continue;
            }
          }
        }
      }
    }
  } else {
    // Tarjeta normal: usar UID como token (modo legacy)
    cryptoToken = card.uid;
  }

  // Construir payload del pago
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

  // Step 5: Decrypt and show result
  if (response.length() > 0) {
    String decrypted = decryptServerResponse(sharedKey, response, serverPubKey);
    if (decrypted.length() > 0) {
      StaticJsonDocument<512> result;
      deserializeJson(result, decrypted);
      String status = result["status"] | "error";
      String message = result["message"] | "Error desconocido";

      // Si el pago fue aprobado y la tarjeta es segura, hacer rotacion de clave
      if (status == "approved" && card.isSecure && hasCardKey) {
        showText("Rotando clave", 1, 16);
        showText("de seguridad...", 1, 32);

        RotationResult rotResult = performRotation(
          &config, sharedKey, terminalKeys.private_key,
          card.uid, config.terminalId, cardAESKey);

        if (rotResult.success) {
          showText("Clave rotada OK", 1, 40);
        } else {
          // La transaccion ya fue aprobada pero la rotacion fallo
          // No es critico: la clave vieja sigue funcionando
          showText("Rotacion fallo", 1, 40);
          showText("(no critico)", 1, 56);
        }
        delay(1000);
      }

      // Limpiar clave de memoria (zeroization)
      if (hasCardKey) {
        clearKeyFromMemory(cardAESKey, 16);
        hasCardKey = false;
      }

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

  // Limpiar clave de memoria por seguridad
  if (hasCardKey) {
    clearKeyFromMemory(cardAESKey, 16);
  }

  delay(3000);
  showReady();

  // Nota: para bloquear localmente, mantener presionado el encoder
  // 2 segundos cuando el terminal muestra "Listo" (showReady).
  // Esto se detecta en el inputAmount() con pulsacion larga.
  // Ver pin_helper.h para la implementacion del encoder.
}

// ===== PAGO MIFARE CLASSIC (certificados dinamicos) =====
// Flujo: monto → documento + PIN → pre-auth → tarjeta → confirm
// Difiere del flujo normal: auth PRIMERO, tarjeta DESPUES.

void processClassicPayment(int64_t amount) {
  // Step 1: Pedir documento de identidad (OBLIGATORIO para Classic)
  // El terminal keypad usa rotary encoder: girar para cambiar numero, click para confirmar
  showText("Documento:", 2, 16);
  showText("Gira=numero", 1, 32);
  showText("Click=OK", 1, 48);
  encoderPos = 0;
  int64_t docNum = 0;
  while (true) {
    docNum = abs(encoderPos);
    showText("Doc: " + String((long)docNum), 1, 16);
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(200);  // debounce
      break;
    }
    delay(50);
  }
  String docNumber = String((long)docNum);
  if (docNumber.length() == 0 || docNumber == "0") {
    showText("Cancelado", 2, 24);
    delay(2000);
    showReady();
    return;
  }

  // Step 2: Pedir PIN
  showPINPrompt("usuario");
  String pin = inputPIN("Ingrese PIN");
  if (pin.length() < 4) {
    showText("PIN corto", 2, 24);
    delay(2000);
    showReady();
    return;
  }

  // Step 3: Enviar pre-auth al servidor
  showText("Validando...", 1, 16);
  showText("No acerque", 1, 32);
  showText("tarjeta aun", 1, 48);

  StaticJsonDocument<256> preAuthPayload;
  preAuthPayload["terminal_id"] = config.terminalId;
  preAuthPayload["doc_type"] = "cedula";
  preAuthPayload["doc_number"] = docNumber;
  preAuthPayload["pin"] = pin;
  preAuthPayload["amount"] = amount;

  String preAuthStr;
  serializeJson(preAuthPayload, preAuthStr);

  String preAuthResponse = sendPayment(&config, sharedKey, preAuthStr,
                                        terminalKeys.private_key,
                                        "/api/nfc/terminal/classic/pre-auth");

  if (preAuthResponse.length() == 0) {
    showText("Error red", 2, 24);
    showText("(pre-auth)", 1, 40);
    delay(3000);
    showReady();
    return;
  }

  // Parsear respuesta del pre-auth
  StaticJsonDocument<512> preAuthResp;
  DeserializationError err = deserializeJson(preAuthResp, preAuthResponse);
  if (err) {
    showText("Error parse", 2, 24);
    delay(3000);
    showReady();
    return;
  }

  if (!preAuthResp["pre_approved"] || !preAuthResp["pre_approved"].as<bool>()) {
    String msg = preAuthResp["message"] | "Rechazado";
    showText("Rechazado", 2, 16);
    showText(msg, 1, 32);
    digitalWrite(BUZZER_PIN, HIGH); delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    delay(3000);
    showReady();
    return;
  }

  // Extraer datos del pre-auth
  String cardUid = preAuthResp["card_uid"] | "";
  int readSector = preAuthResp["read_sector"] | 0;
  String readKeyAHex = preAuthResp["read_key_a"] | "";
  String expectedCertHex = preAuthResp["expected_certificate"] | "";
  int writeSector = preAuthResp["write_sector"] | 0;
  String writeKeyBHex = preAuthResp["write_key_b"] | "";
  String newCertHex = preAuthResp["new_certificate"] | "";

  if (cardUid.length() == 0 || readKeyAHex.length() == 0 || newCertHex.length() == 0) {
    showText("Respuesta", 2, 16);
    showText("incompleta", 1, 32);
    delay(3000);
    showReady();
    return;
  }

  // Step 4: Pedir tarjeta al usuario
  showText("ACERQUE", 2, 16);
  showText("TARJETA", 1, 32);
  showText("No retire!", 1, 48);

  NFCCard card;
  unsigned long cardTimeout = millis() + 30000;  // 30s timeout
  do {
    card = readNFCCard(500);
    if (millis() > cardTimeout) {
      showText("Timeout", 2, 24);
      showText("No acerco", 1, 40);
      delay(3000);
      showReady();
      return;
    }
  } while (!card.valid);

  // Beep on card detected
  digitalWrite(BUZZER_PIN, HIGH); delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Step 5: Verificar UID
  if (card.uid != cardUid) {
    showText("UID no", 2, 16);
    showText("coincide", 1, 32);
    digitalWrite(BUZZER_PIN, HIGH); delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    delay(3000);
    showReady();
    return;
  }

  // Convertir hex strings a bytes
  uint8_t keyA[6], keyB[6], expectedCert[16], newCert[16];
  hexStringToBytes(readKeyAHex, keyA, 6);
  hexStringToBytes(writeKeyBHex, keyB, 6);
  hexStringToBytes(expectedCertHex, expectedCert, 16);
  hexStringToBytes(newCertHex, newCert, 16);

  // Step 6: Leer sector activo con Key A y verificar cert
  showText("Leyendo...", 1, 16);
  if (!verifyClassicCertificate(readSector, keyA, expectedCert)) {
    showText("Cert no", 2, 16);
    showText("coincide", 1, 32);
    digitalWrite(BUZZER_PIN, HIGH); delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    // Reportar fallo al servidor
    sendClassicConfirm(cardUid, false, false, 0);
    delay(3000);
    showReady();
    return;
  }

  // Step 7: Escribir nuevo cert en sector destino con Key B
  showText("Escribiendo...", 1, 16);
  showText("NO RETIRE!", 1, 32);
  uint8_t writtenBlocks = writeClassicSectorBlocks(writeSector, keyB, newCert);

  if (writtenBlocks == 0) {
    showText("Escritura", 2, 16);
    showText("fallo", 1, 32);
    digitalWrite(BUZZER_PIN, HIGH); delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    sendClassicConfirm(cardUid, true, false, 0);
    delay(3000);
    showReady();
    return;
  }

  // Step 8: Confirmar al servidor
  showText("Confirmando...", 1, 16);
  bool confirmOK = sendClassicConfirm(cardUid, true, true, writtenBlocks);

  if (confirmOK) {
    // Success beep
    digitalWrite(BUZZER_PIN, HIGH); delay(100);
    digitalWrite(BUZZER_PIN, LOW); delay(100);
    digitalWrite(BUZZER_PIN, HIGH); delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    showText("APROBADO!", 2, 16);
  } else {
    digitalWrite(BUZZER_PIN, HIGH); delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    showText("Error", 2, 16);
    showText("confirm", 1, 32);
  }

  // Limpiar claves de memoria
  clearKeyFromMemory(keyA, 6);
  clearKeyFromMemory(keyB, 6);
  clearKeyFromMemory(expectedCert, 16);
  clearKeyFromMemory(newCert, 16);

  delay(3000);
  showReady();
}

// Helper: convertir hex string a bytes
void hexStringToBytes(const String& hex, uint8_t* out, size_t len) {
  for (size_t i = 0; i < len; i++) {
    String byteStr = hex.substring(i * 2, i * 2 + 2);
    out[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }
}

// Helper: enviar confirmacion Classic al servidor
bool sendClassicConfirm(const String& cardUid, bool readOk, bool writeOk, uint8_t writtenBlocks) {
  StaticJsonDocument<256> confirmPayload;
  confirmPayload["terminal_id"] = config.terminalId;
  confirmPayload["card_uid"] = cardUid;
  confirmPayload["read_ok"] = readOk;
  confirmPayload["write_ok"] = writeOk;
  confirmPayload["written_blocks"] = writtenBlocks;

  String confirmStr;
  serializeJson(confirmPayload, confirmStr);

  String response = sendPayment(&config, sharedKey, confirmStr,
                                 terminalKeys.private_key,
                                 "/api/nfc/terminal/classic/confirm");
  return response.length() > 0;
}

// Need config as global
ServerConfig config;
