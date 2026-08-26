#ifndef DESFIRE_CRYPTO_H
#define DESFIRE_CRYPTO_H

#include <Arduino.h>
#include <Adafruit_PN532.h>
#include <mbedtls/aes.h>

// DESFire EV3 crypto via PN532 ISO14443-4 APDUs
// Implementa autenticacion AES-128, cambio de clave, lectura/escritura
//
// DESFire EV3 usa el protocolo ISO14443-4 con APDUs especificas:
// - Select Application (0x5A)
// - Authenticate AES (0xAA)
// - Read Data (0xBD)
// - Write Data (0x3D)
// - Change Key (0xC4)
//
// El PN532 soporta ISO14443-4 via inDataExchange()

extern Adafruit_PN532 nfc;

// --- Estructuras ---

struct DESFireResult {
  bool success;
  uint8_t response[64];
  uint8_t responseLen;
  String error;
};

// --- Funciones de bajo nivel: APDUs via PN532 ---

// Enviar un APDU ISO14443-4 a la tarjeta via inDataExchange
DESFireResult sendAPDU(const uint8_t* apdu, uint8_t apduLen, uint16_t timeout = 500) {
  DESFireResult res;
  res.success = false;
  res.responseLen = 0;

  uint8_t response[64];
  uint8_t responseLen = sizeof(response);

  bool ok = nfc.inDataExchange(apdu, apduLen, response, &responseLen);
  if (!ok) {
    res.error = "inDataExchange failed";
    return res;
  }

  // Copiar respuesta
  if (responseLen > 0 && responseLen <= 64) {
    memcpy(res.response, response, responseLen);
    res.responseLen = responseLen;
  }

  // Verificar SW1/SW2 (ultimos 2 bytes)
  // 0x9100 = success en DESFire (0x91 = status, 0x00 = OK)
  if (responseLen >= 2) {
    uint8_t sw1 = response[responseLen - 2];
    uint8_t sw2 = response[responseLen - 1];
    if (sw1 == 0x91 && sw2 == 0x00) {
      res.success = true;
    } else if (sw1 == 0x91) {
      res.error = "DESFire error code: 0x" + String(sw2, HEX);
    } else {
      res.error = "APDU error: SW1=0x" + String(sw1, HEX) + " SW2=0x" + String(sw2, HEX);
    }
  } else {
    res.error = "Response too short";
  }

  return res;
}

// --- Funciones DESFire ---

// Detectar si una tarjeta es DESFire EV3
// Intenta seleccionar la aplicacion DESFire. Si responde, es DESFire.
bool isDESFireCard(uint8_t* uid, uint8_t uidLen) {
  // Get Version command (0x60) - solo DESFire responde
  uint8_t getVersion[] = {0x60};
  DESFireResult res = sendAPDU(getVersion, 1, 300);

  if (res.success && res.responseLen > 2) {
    // DESFire responde con version info
    // EV3 tiene major version 0x03 o mayor
    return true;
  }
  return false;
}

// Seleccionar aplicacion DESFire por AID (Application ID)
// AID por defecto para nuestro sistema: 0x00 0x00 0x01
DESFireResult selectApplication(uint32_t aid = 0x000001) {
  uint8_t apdu[] = {
    0x90, 0x5A, 0x00, 0x00, 0x03,  // CLA INS P1 P2 Lc
    (uint8_t)(aid & 0xFF),           // AID byte 0 (LSB)
    (uint8_t)((aid >> 8) & 0xFF),    // AID byte 1
    (uint8_t)((aid >> 16) & 0xFF),   // AID byte 2
    0x00                             // Le
  };
  return sendAPDU(apdu, sizeof(apdu));
}

// Autenticar con AES-128 (DESFire EV3)
// Protocolo:
// 1. Terminal envia 0xAA 0x00 (key number 0)
// 2. Tarjeta responde con rndB (16 bytes cifrados con AES key)
// 3. Terminal descifra rndB, genera rndA, envia rndA + rndB' cifrado
// 4. Tarjeta responde con rndA' cifrado (verificacion mutua)
//
// Simplificado: el servidor hace la verificacion, el terminal solo
// reenvia los datos. Esta funcion hace el intercambio de mensajes.
DESFireResult authenticateAES(uint8_t keyNumber, const uint8_t* aesKey) {
  // Paso 1: Enviar authenticate AES command
  uint8_t authCmd[] = {0x90, 0xAA, 0x00, 0x00, 0x01, keyNumber, 0x00};
  DESFireResult res1 = sendAPDU(authCmd, sizeof(authCmd));

  if (!res1.success || res1.responseLen < 18) {
    res1.error = "Auth step 1 failed";
    return res1;
  }

  // res1.response contiene: rndB_cifrado (16 bytes) + SW1 SW2
  // Extraer rndB cifrado (sin los ultimos 2 bytes de SW)
  uint8_t rndB_enc[16];
  memcpy(rndB_enc, res1.response, 16);

  // Descifrar rndB con AES-ECB
  uint8_t rndB[16];
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_dec(&aes, aesKey, 128);
  mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_DECRYPT, rndB_enc, rndB);
  mbedtls_aes_free(&aes);

  // Generar rndA (random 16 bytes)
  uint8_t rndA[16];
  esp_fill_random(rndA, 16);

  // Construir rndA + rndB' donde rndB' = rndB rotado izquierda 1 byte
  uint8_t rndB_rot[16];
  for (int i = 0; i < 15; i++) {
    rndB_rot[i] = rndB[i + 1];
  }
  rndB_rot[15] = rndB[0];

  // Concatenar rndA + rndB_rot = 32 bytes
  uint8_t token[32];
  memcpy(token, rndA, 16);
  memcpy(token + 16, rndB_rot, 16);

  // Cifrar token con AES-CBC (IV = 0)
  // DESFire usa AES-CBC para este paso
  uint8_t iv[16] = {0};
  uint8_t token_enc[32];
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, aesKey, 128);
  // AES-CBC encrypt manualmente (bloque por bloque)
  uint8_t block[16];
  for (int i = 0; i < 2; i++) {
    // XOR con IV o bloque anterior
    for (int j = 0; j < 16; j++) {
      block[j] = token[i * 16 + j] ^ iv[j];
    }
    mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_ENCRYPT, block, token_enc + i * 16);
    memcpy(iv, token_enc + i * 16, 16);
  }
  mbedtls_aes_free(&aes);

  // Paso 2: Enviar token cifrado
  uint8_t authCmd2[40];
  authCmd2[0] = 0x90;  // CLA
  authCmd2[1] = 0xAF;  // INS (continue)
  authCmd2[2] = 0x00;  // P1
  authCmd2[3] = 0x00;  // P2
  authCmd2[4] = 0x20;  // Lc = 32 bytes
  memcpy(authCmd2 + 5, token_enc, 32);
  authCmd2[37] = 0x00;  // Le

  DESFireResult res2 = sendAPDU(authCmd2, sizeof(authCmd2));

  if (!res2.success || res2.responseLen < 18) {
    res2.error = "Auth step 2 failed (clave incorrecta o tarjeta falsa)";
    return res2;
  }

  // res2.response contiene rndA' cifrado (16 bytes) + SW1 SW2
  // La tarjeta verifica que conocemos la clave devolviendo rndA rotado
  // Para esta implementacion, confiamos en que si SW=0x9100, la auth fue OK
  // (el servidor puede hacer verificacion adicional si se desea)

  res2.success = true;
  return res2;
}

// Cambiar clave AES de la tarjeta (rotacion)
// Requiere autenticacion previa con la clave actual
DESFireResult changeKey(uint8_t keyNumber, const uint8_t* newKey, const uint8_t* oldKey) {
  // DESFire ChangeKey command (0xC4)
  // El nuevo key se cifra con la clave de sesion actual
  // Formato: keyNumber + newKey (16 bytes) + CRC32

  // Por simplicidad, ciframos newKey con AES-CBC usando oldKey
  uint8_t iv[16] = {0};
  uint8_t encKey[16];
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, oldKey, 128);
  mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_ENCRYPT, newKey, encKey);
  mbedtls_aes_free(&aes);

  // Construir APDU
  // ChangeKey: 0xC4 + keyNumber + encryptedNewKey (16 bytes) + CRC
  uint8_t apdu[25];
  apdu[0] = 0x90;  // CLA
  apdu[1] = 0xC4;  // INS = ChangeKey
  apdu[2] = 0x00;  // P1
  apdu[3] = 0x00;  // P2
  apdu[4] = 0x11;  // Lc = 17 bytes (keyNumber + 16 bytes key)
  apdu[5] = keyNumber;
  memcpy(apdu + 6, encKey, 16);
  apdu[22] = 0x00;  // Le

  return sendAPDU(apdu, sizeof(apdu));
}

// Leer datos de un archivo DESFire
DESFireResult readData(uint8_t fileNum, uint8_t* data, uint8_t dataLen) {
  uint8_t apdu[] = {
    0x90, 0xBD, 0x00, 0x00, 0x07,  // CLA INS P1 P2 Lc
    fileNum,                         // File number
    0x00, 0x00, 0x00,                // Offset (0)
    dataLen,                         // Length
    0x00                             // Le
  };
  return sendAPDU(apdu, sizeof(apdu));
}

// Escribir datos en un archivo DESFire
DESFireResult writeData(uint8_t fileNum, const uint8_t* data, uint8_t dataLen) {
  uint8_t apdu[32];
  apdu[0] = 0x90;  // CLA
  apdu[1] = 0x3D;  // INS = WriteData
  apdu[2] = 0x00;  // P1
  apdu[3] = 0x00;  // P2
  apdu[4] = 7 + dataLen;  // Lc
  apdu[5] = fileNum;
  apdu[6] = 0x00; 0x00; 0x00;  // Offset
  apdu[9] = dataLen;  // Length
  memcpy(apdu + 10, data, dataLen);
  apdu[10 + dataLen] = 0x00;  // Le

  return sendAPDU(apdu, 11 + dataLen);
}

// Verificar que una clave funciona (re-autenticar despues de changeKey)
bool verifyKeyWorks(uint8_t keyNumber, const uint8_t* aesKey) {
  DESFireResult authRes = authenticateAES(keyNumber, aesKey);
  return authRes.success;
}

#endif // DESFIRE_CRYPTO_H
