#ifndef NFC_READER_H
#define NFC_READER_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_PN532.h>

#define PN532_IRQ   (2)
#define PN532_RESET (4)  // Not connected by default on the HU

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

struct NFCCard {
  String uid;         // Hex UID string
  uint8_t uidBytes[7];
  uint8_t uidLength;
  bool valid;
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

NFCCard readNFCCard(uint16_t timeout = 1000) {
  NFCCard card;
  card.valid = false;
  card.uidLength = 0;

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
  }

  return card;
}

// Read NTAG424 DNA SUN message (if card supports it)
String readNTAG424SUN(uint8_t* uid, uint8_t uidLen) {
  // NTAG424 DNA SUN reading requires specific APDU commands
  // This is a simplified placeholder - actual implementation
  // would use ISO14443-4 APDUs to read the SUN MAC
  uint8_t apdu[] = {0x00, 0xA4, 0x04, 0x00, 0x07, 0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00};
  uint8_t response[64];
  uint8_t responseLen = 0;

  // In real implementation: send APDU, parse response for SUN token
  // For now, return UID-based token
  String token = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) token += "0";
    token += String(uid[i], HEX);
  }
  return token;
}

// Read MIFARE DESFire EV3 (simplified)
String readDESFireEV3(uint8_t* uid, uint8_t uidLen) {
  // DESFire EV3 requires ISO14443-4 APDU communication
  // Actual implementation would authenticate with AES and read files
  String token = "";
  for (uint8_t i = 0; i < uidLen; i++) {
    if (uid[i] < 0x10) token += "0";
    token += String(uid[i], HEX);
  }
  return token;
}

#endif // NFC_READER_H
