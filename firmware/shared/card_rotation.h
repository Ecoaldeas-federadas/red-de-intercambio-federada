#ifndef CARD_ROTATION_H
#define CARD_ROTATION_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "crypto_helper.h"
#include "desfire_crypto.h"
#include "server_client.h"

// Card rotation: flujo de rotacion de clave por transaccion
//
// Flujo:
// 1. Terminal autentica tarjeta con clave K (existente)
// 2. Servidor valida transaccion (saldo, PIN)
// 3. Terminal pide nueva clave K' al servidor (prepare-rotation)
// 4. Terminal escribe K' en la tarjeta (changeKey)
// 5. Terminal verifica K' re-autenticando
// 6. Si OK: terminal confirma al servidor (confirm-rotation)
// 7. Servidor ejecuta la transaccion
// 8. Terminal borra K y K' de memoria
//
// Si falla la escritura:
// - Reintentar hasta 3 veces
// - Si despues de 3 intentos no se puede: reportar fail-rotation
// - La transaccion NO se ejecuta
// - La clave vieja K sigue activa

struct RotationResult {
  bool success;
  String newKeyHex;   // Nueva clave K' en hex
  String errorMessage;
  int attempts;       // Numero de intentos
  unsigned long duration;  // ms
};

// Pedir al servidor que prepare una rotacion (genera K')
// Devuelve la nueva clave en hex
String requestRotation(ServerConfig* config, const uint8_t* sharedKey,
                       const uint8_t* privKey, const String& cardUID,
                       const String& terminalID) {

  StaticJsonDocument<256> payload;
  payload["card_uid"] = cardUID;
  payload["terminal_id"] = terminalID;

  String payloadStr;
  serializeJson(payload, payloadStr);

  String url = config->serverUrl + "/api/nfc/cards/" + cardUID + "/prepare-rotation";
  String response = sendPayment(config, sharedKey, payloadStr, privKey, url);

  if (response.length() == 0) return "";

  String decrypted = decryptServerResponse(sharedKey, response, nullptr);
  if (decrypted.length() == 0) return "";

  StaticJsonDocument<512> result;
  deserializeJson(result, decrypted);

  String newKeyHex = result["new_key_hex"] | "";
  return newKeyHex;
}

// Confirmar al servidor que la rotacion se completo
bool confirmRotation(ServerConfig* config, const uint8_t* sharedKey,
                     const uint8_t* privKey, const String& cardUID,
                     unsigned long durationMS) {

  StaticJsonDocument<256> payload;
  payload["duration_ms"] = (int)durationMS;

  String payloadStr;
  serializeJson(payload, payloadStr);

  String url = config->serverUrl + "/api/nfc/cards/" + cardUID + "/confirm-rotation";
  String response = sendPayment(config, sharedKey, payloadStr, privKey, url);

  return (response.length() > 0);
}

// Reportar fallo de rotacion al servidor
void reportRotationFail(ServerConfig* config, const uint8_t* sharedKey,
                        const uint8_t* privKey, const String& cardUID,
                        const String& errorMsg) {

  StaticJsonDocument<256> payload;
  payload["error_message"] = errorMsg;

  String payloadStr;
  serializeJson(payload, payloadStr);

  String url = config->serverUrl + "/api/nfc/cards/" + cardUID + "/fail-rotation";
  sendPayment(config, sharedKey, payloadStr, privKey, url);
}

// Ejecutar rotacion completa de clave en la tarjeta DESFire
// Requiere que la tarjeta ya este autenticada con la clave vieja
RotationResult performRotation(ServerConfig* config, const uint8_t* sharedKey,
                                const uint8_t* privKey, const String& cardUID,
                                const String& terminalID,
                                const uint8_t* oldKey) {

  RotationResult result;
  result.success = false;
  result.attempts = 0;
  result.duration = 0;

  unsigned long startTime = millis();

  // 1. Pedir nueva clave al servidor
  String newKeyHex = requestRotation(config, sharedKey, privKey, cardUID, terminalID);
  if (newKeyHex.length() != 32) {  // 16 bytes = 32 hex chars
    result.errorMessage = "No se pudo obtener nueva clave del servidor";
    result.duration = millis() - startTime;
    return result;
  }

  // Convertir hex a bytes
  uint8_t newKey[16];
  size_t len;
  hexToBytes(newKeyHex, newKey, &len);
  if (len != 16) {
    result.errorMessage = "Clave nueva invalida";
    result.duration = millis() - startTime;
    return result;
  }

  result.newKeyHex = newKeyHex;

  // 2. Intentar escribir la nueva clave (hasta 3 intentos)
  for (int attempt = 1; attempt <= 3; attempt++) {
    result.attempts = attempt;

    DESFireResult changeRes = changeKey(0x00, newKey, oldKey);
    if (changeRes.success) {
      // 3. Verificar que la nueva clave funciona
      delay(100);  // Pequena pausa despues de changeKey

      if (verifyKeyWorks(0x00, newKey)) {
        // 4. Confirmar al servidor
        result.duration = millis() - startTime;
        if (confirmRotation(config, sharedKey, privKey, cardUID, result.duration)) {
          result.success = true;
          return result;
        } else {
          result.errorMessage = "Clave escrita pero no se pudo confirmar al servidor";
          return result;
        }
      } else {
        result.errorMessage = "Clave escrita pero verificacion fallo (intento " + String(attempt) + ")";
      }
    } else {
      result.errorMessage = "Escritura fallo: " + changeRes.error + " (intento " + String(attempt) + ")";
    }

    delay(200);  // Pausa antes de reintentar
  }

  // 5. Todos los intentos fallaron
  result.duration = millis() - startTime;
  reportRotationFail(config, sharedKey, privKey, cardUID, result.errorMessage);
  return result;
}

// Limpiar claves de memoria (zeroization)
void clearKeyFromMemory(uint8_t* key, size_t len) {
  if (key == nullptr) return;
  for (size_t i = 0; i < len; i++) {
    key[i] = 0;
  }
}

#endif // CARD_ROTATION_H
