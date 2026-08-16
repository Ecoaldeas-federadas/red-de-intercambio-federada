#ifndef SERVER_CLIENT_H
#define SERVER_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "crypto_helper.h"

struct ServerConfig {
  String serverUrl;
  String terminalId;
  String registrationToken;
};

struct EncryptedPayload {
  String nonce;
  String ciphertext;
  String signature;
};

// HTTP POST with JSON body
String httpPost(const String& url, const String& jsonBody) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  int code = http.POST(jsonBody);
  String response = "";
  if (code > 0) {
    response = http.getString();
  }
  http.end();
  return response;
}

// HTTP GET
String httpGet(const String& url) {
  HTTPClient http;
  http.begin(url);
  http.setTimeout(10000);
  int code = http.GET();
  String response = "";
  if (code > 0) {
    response = http.getString();
  }
  http.end();
  return response;
}

// Complete registration: send terminal public key, receive server public key
bool completeRegistration(ServerConfig* config, KeyPair* kp, uint8_t* serverPubKey) {
  StaticJsonDocument<512> doc;
  doc["terminal_id"] = config->terminalId;
  doc["registration_token"] = config->registrationToken;
  doc["terminal_public_key"] = bytesToHex(kp->public_key, 32);

  String body;
  serializeJson(doc, body);

  String url = config->serverUrl + "/api/nfc/terminal/complete-registration";
  String response = httpPost(url, body);

  if (response.length() == 0) return false;

  StaticJsonDocument<256> respDoc;
  deserializeJson(respDoc, response);

  String serverPubHex = respDoc["server_public_key"] | "";
  if (serverPubHex.length() != 64) return false;

  size_t len;
  hexToBytes(serverPubHex, serverPubKey, &len);
  return (len == 32);
}

// Authenticate with server (mutual Ed25519)
String authenticateTerminal(ServerConfig* config, KeyPair* kp, const uint8_t* serverPubKey) {
  // Generate nonce
  uint8_t nonceBytes[16];
  esp_fill_random(nonceBytes, 16);
  String nonce = bytesToHex(nonceBytes, 16);

  // Sign nonce with terminal private key
  uint8_t signature[64];
  signMessage(kp->private_key, (const uint8_t*)nonce.c_str(), nonce.length(), signature);

  StaticJsonDocument<512> doc;
  doc["terminal_id"] = config->terminalId;
  doc["nonce"] = nonce;
  doc["signature"] = bytesToHex(signature, 64);

  String body;
  serializeJson(doc, body);

  String url = config->serverUrl + "/api/nfc/terminal/auth";
  String response = httpPost(url, body);

  if (response.length() == 0) return "";

  StaticJsonDocument<512> respDoc;
  deserializeJson(respDoc, response);

  String sessionToken = respDoc["session_token"] | "";
  String respSigHex = respDoc["signature"] | "";

  // Verify server signature on session token
  if (respSigHex.length() == 128 && sessionToken.length() > 0) {
    uint8_t respSig[64];
    size_t len;
    hexToBytes(respSigHex, respSig, &len);
    if (verifySignature(serverPubKey, (const uint8_t*)sessionToken.c_str(),
                        sessionToken.length(), respSig)) {
      return sessionToken;
    }
  }
  return "";
}

// Send heartbeat
bool sendHeartbeat(ServerConfig* config, const uint8_t* serverPubKey) {
  StaticJsonDocument<256> doc;
  doc["terminal_id"] = config->terminalId;
  String body;
  serializeJson(doc, body);

  String url = config->serverUrl + "/api/nfc/terminal/heartbeat";
  String response = httpPost(url, body);
  return (response.length() > 0);
}

// Encrypt payload for server
EncryptedPayload encryptForServer(const uint8_t* sharedKey, const String& jsonPayload,
                                   const uint8_t* privKey) {
  EncryptedPayload ep;
  size_t ptLen = jsonPayload.length();
  uint8_t nonce[12];
  uint8_t ciphertext[256];
  size_t ctLen;

  if (!encryptPayload(sharedKey, (const uint8_t*)jsonPayload.c_str(), ptLen,
                      nonce, ciphertext, &ctLen)) {
    return ep;
  }

  // Sign the ciphertext
  uint8_t signature[64];
  signMessage(privKey, ciphertext, ctLen, signature);

  ep.nonce = bytesToHex(nonce, 12);
  ep.ciphertext = bytesToHex(ciphertext, ctLen);
  ep.signature = bytesToHex(signature, 64);
  return ep;
}

// Send encrypted payment to server
String sendPayment(ServerConfig* config, const uint8_t* sharedKey,
                   const String& jsonPayload, const uint8_t* privKey,
                   const String& endpoint) {
  EncryptedPayload ep = encryptForServer(sharedKey, jsonPayload, privKey);

  StaticJsonDocument<512> doc;
  doc["terminal_id"] = config->terminalId;

  JsonObject payload = doc.createNestedObject("encrypted_payload");
  payload["nonce"] = ep.nonce;
  payload["ciphertext"] = ep.ciphertext;
  payload["signature"] = ep.signature;

  String body;
  serializeJson(doc, body);

  String url = config->serverUrl + endpoint;
  return httpPost(url, body);
}

// Decrypt server response
String decryptServerResponse(const uint8_t* sharedKey, const String& responseJson,
                              const uint8_t* serverPubKey) {
  StaticJsonDocument<512> respDoc;
  deserializeJson(respDoc, responseJson);

  String nonceHex = respDoc["nonce"] | "";
  String ctHex = respDoc["ciphertext"] | "";
  String sigHex = respDoc["signature"] | "";

  if (nonceHex.length() == 0 || ctHex.length() == 0) return "";

  uint8_t nonce[12], ciphertext[512], signature[64];
  size_t len;

  hexToBytes(nonceHex, nonce, &len);
  hexToBytes(ctHex, ciphertext, &len);
  hexToBytes(sigHex, signature, &len);

  // Verify server signature
  if (!verifySignature(serverPubKey, ciphertext, len, signature)) {
    return "";
  }

  // Decrypt
  uint8_t plaintext[512];
  size_t ptLen;
  if (!decryptPayload(sharedKey, nonce, 12, ciphertext, len, plaintext, &ptLen)) {
    return "";
  }

  return String((char*)plaintext).substring(0, ptLen);
}

#endif // SERVER_CLIENT_H
