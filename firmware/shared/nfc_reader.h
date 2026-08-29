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

// === LECTURA/ESCRITURA MIFARE CLASSIC (certificados dinamicos) ===

// Autenticar un sector MIFARE Classic con una clave (A o B)
// sector: 0-15, key: 6 bytes, keyType: 0 = Key A (MIFARE_KEY_A), 1 = Key B (MIFARE_KEY_B)
bool authenticateClassicSector(uint8_t sector, const uint8_t* key, uint8_t keyType) {
  uint8_t block = sector * 4;  // primer bloque del sector
  return nfc.mifareclassic_AuthenticateBlock(card.uidBytes, card.uidLength,
                                              block, keyType, key);
}

// Leer los 3 bloques de datos de un sector (0,1,2 — NO el trailer 3)
// Retorna true si al menos 1 bloque se leyo correctamente
// outBlocks: 3 buffers de 16 bytes cada uno
// outValid: 3 bools indicando cuales bloques se leyeron OK
bool readClassicSectorBlocks(uint8_t sector, const uint8_t* keyA,
                              uint8_t outBlocks[3][16], bool outValid[3]) {
  if (!authenticateClassicSector(sector, keyA, 0 /* MIFARE_KEY_A */)) {
    outValid[0] = outValid[1] = outValid[2] = false;
    return false;
  }

  uint8_t baseBlock = sector * 4;
  bool anyOK = false;
  for (uint8_t i = 0; i < 3; i++) {
    outValid[i] = nfc.mifareclassic_ReadDataBlock(baseBlock + i, outBlocks[i]);
    if (outValid[i]) anyOK = true;
  }
  return anyOK;
}

// Verificar que al menos 1 de los 3 bloques coincide con el certificado esperado
bool verifyClassicCertificate(uint8_t sector, const uint8_t* keyA,
                               const uint8_t* expectedCert /* 16 bytes */) {
  uint8_t blocks[3][16];
  bool valid[3];
  if (!readClassicSectorBlocks(sector, keyA, blocks, valid)) {
    return false;
  }
  for (uint8_t i = 0; i < 3; i++) {
    if (valid[i] && memcmp(blocks[i], expectedCert, 16) == 0) {
      return true;  // al menos 1 bloque coincide
    }
  }
  return false;
}

// Escribir el certificado en los 3 bloques de datos de un sector (0,1,2)
// Usa Key B para autenticacion de escritura
// Retorna el numero de bloques escritos correctamente (0-3)
uint8_t writeClassicSectorBlocks(uint8_t sector, const uint8_t* keyB,
                                  const uint8_t* cert /* 16 bytes */) {
  if (!authenticateClassicSector(sector, keyB, 1 /* MIFARE_KEY_B */)) {
    return 0;
  }

  uint8_t baseBlock = sector * 4;
  uint8_t written = 0;
  for (uint8_t i = 0; i < 3; i++) {
    if (nfc.mifareclassic_WriteDataBlock(baseBlock + i, (uint8_t*)cert)) {
      written++;
    }
  }
  return written;
}

// Escribir un sector completo (provisionamiento): trailer + 3 bloques de datos
// SOLO se usa en provisionamiento inicial. NUNCA en transacciones en caliente.
// keyA, keyB: 6 bytes cada uno, accessBits: 4 bytes, cert: 16 bytes
bool writeFullClassicSector(uint8_t sector, const uint8_t* keyA,
                             const uint8_t* keyB, const uint8_t* accessBits,
                             const uint8_t* cert) {
  // Autenticar con clave por defecto (F F F F F F) para sector nuevo
  uint8_t defaultKey[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  if (!authenticateClassicSector(sector, defaultKey, 0 /* Key A */)) {
    return false;
  }

  uint8_t baseBlock = sector * 4;

  // Escribir trailer (bloque 3): Key A (6) + Access Bits (4) + Key B (6)
  uint8_t trailer[16];
  memcpy(trailer, keyA, 6);
  memcpy(trailer + 6, accessBits, 4);
  memcpy(trailer + 10, keyB, 6);
  if (!nfc.mifareclassic_WriteDataBlock(baseBlock + 3, trailer)) {
    return false;
  }

  // Escribir certificado en bloques 0,1,2 (triple redundancia)
  for (uint8_t i = 0; i < 3; i++) {
    if (!nfc.mifareclassic_WriteDataBlock(baseBlock + i, (uint8_t*)cert)) {
      return false;
    }
  }
  return true;
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
