#ifndef NFC_READER_H
#define NFC_READER_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_PN532.h>
#include "desfire_crypto.h"

#define PN532_IRQ   (2)
#define PN532_RESET (4)  // Not connected by default on the HU

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

// Tipos de tarjeta detectados
enum CardType {
  CARD_UNKNOWN = 0,
  CARD_UID_ONLY,      // MIFARE Classic / UID normal (sin crypto)
  CARD_DESFIRE_EV3,   // DESFire EV3 (segura, AES-128)
  CARD_NTAG424,       // NTAG424 SUN (segura, AES-128)
};

struct NFCCard {
  String uid;         // Hex UID string
  uint8_t uidBytes[7];
  uint8_t uidLength;
  bool valid;
  CardType type;      // Tipo detectado
  bool isSecure;      // true si tiene crypto (DESFire o NTAG424)
};

bool initNFCReader() {
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    return false;
  }
  nfc.SAMConfig();
  return true;
}

String getNFCVersion() {
  nfc.begin();
  uint32_t v = nfc.getFirmwareVersion();
  if (!v) return "Not found";
  return "PN5" + String((v >> 24) & 0xFF, HEX) + " v" +
         String((v >> 16) & 0xFF) + "." + String((v >> 8) & 0xFF);
}

// Detectar el tipo de tarjeta despues de leer el UID
// Intenta enviar un comando DESFire (GetVersion). Si responde, es DESFire.
CardType detectCardType(uint8_t* uid, uint8_t uidLen) {
  // Intentar GetVersion de DESFire (0x60)
  // Solo DESFire responde a este comando
  uint8_t getVersion[] = {0x60};
  uint8_t response[32];
  uint8_t responseLen = sizeof(response);

  // inDataExchange requiere que la tarjeta este en modo ISO14443-4
  // Primero necesitamos activar la tarjeta en modo ISO14443-4
  bool ok = nfc.inDataExchange(getVersion, 1, response, &responseLen);

  if (ok && responseLen >= 2) {
    uint8_t sw1 = response[responseLen - 2];
    uint8_t sw2 = response[responseLen - 1];
    // 0x9100 = OK en DESFire
    if (sw1 == 0x91 && sw2 == 0x00) {
      return CARD_DESFIRE_EV3;
    }
    // 0x91AE = authentication required (tambien es DESFire)
    if (sw1 == 0x91 && (sw2 == 0xAE || sw2 == 0x1E)) {
      return CARD_DESFIRE_EV3;
    }
  }

  // Si no responde a DESFire, es una tarjeta normal (UID only)
  return CARD_UID_ONLY;
}

NFCCard readNFCCard(uint16_t timeout = 1000) {
  NFCCard card;
  card.valid = false;
  card.uidLength = 0;
  card.type = CARD_UNKNOWN;
  card.isSecure = false;

  uint8_t success;
  uint8_t uid[7] = {0};

  success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &card.uidLength, timeout);

  if (success && card.uidLength > 0) {
    memcpy(card.uidBytes, uid, card.uidLength);
    card.uid = "";
    for (uint8_t i = 0; i < card.uidLength; i++) {
      if (uid[i] < 0x10) card.uid += "0";
      card.uid += String(uid[i], HEX);
    }
    card.uid.toUpperCase();
    card.valid = true;

    // Detectar tipo de tarjeta
    card.type = detectCardType(uid, card.uidLength);
    card.isSecure = (card.type == CARD_DESFIRE_EV3 || card.type == CARD_NTAG424);
  }

  return card;
}

// === LECTURA CRIPTOGRAFICA (DESFire EV3) ===

// Autenticar tarjeta DESFire con clave AES
// Devuelve true si la autenticacion fue exitosa
bool authenticateDESFire(const uint8_t* aesKey) {
  // Seleccionar aplicacion (AID 0x000001 por defecto)
  DESFireResult selRes = selectApplication(0x000001);
  if (!selRes.success) {
    // La aplicacion puede no existir si la tarjeta es nueva
    // Intentar autenticar en el nivel PICC (master key)
  }

  // Autenticar con AES
  DESFireResult authRes = authenticateAES(0x00, aesKey);
  return authRes.success;
}

// Leer datos de una tarjeta DESFire autenticada
String readDESFireData(const uint8_t* aesKey) {
  if (!authenticateDESFire(aesKey)) {
    return "";
  }

  // Leer archivo 0x00 (datos del usuario)
  uint8_t data[32];
  DESFireResult readRes = readData(0x00, data, 16);
  if (!readRes.success) {
    return "";
  }

  // Convertir a hex string
  String result = "";
  for (uint8_t i = 0; i < 16 && i < readRes.responseLen - 2; i++) {
    if (readRes.response[i] < 0x10) result += "0";
    result += String(readRes.response[i], HEX);
  }
  return result;
}

// === LECTURA UID ONLY (tarjetas normales) ===

// Para tarjetas normales (MIFARE Classic / UID), el UID es el unico identificador
// La seguridad se basa en el PIN del usuario
String readUIDOnlyToken(const NFCCard& card) {
  return card.uid;
}

// === COMPATIBILIDAD CON FUNCIONES ANTERIORES ===

// NTAG424 SUN (placeholder - requiere implementacion especifica)
String readNTAG424SUN(uint8_t* uid, uint8_t uidLen) {
  // NTAG424 SUN requiere leer el mensaje NDEF con el MAC
  // Por ahora, devolver UID (modo fallback)
  // TODO: implementar lectura SUN real cuando se consigan tarjetas NTAG424
  String token = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) token += "0";
    token += String(uid[i], HEX);
  }
  return token;
}

// DESFire EV3 (compatibilidad - usar authenticateDESFire + readDESFireData)
String readDESFireEV3(uint8_t* uid, uint8_t uidLen, const uint8_t* aesKey) {
  String data = readDESFireData(aesKey);
  if (data.length() > 0) {
    return data;
  }
  // Fallback: devolver UID si no se puede autenticar
  String token = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) token += "0";
    token += String(uid[i], HEX);
  }
  return token;
}

#endif // NFC_READER_H
