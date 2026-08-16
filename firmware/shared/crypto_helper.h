#ifndef CRYPTO_HELPER_H
#define CRYPTO_HELPER_H

#include <Arduino.h>
#include <mbedtls/ed25519.h>
#include <mbedtls/aes.h>
#include <mbedtls/gcm.h>
#include <mbedtls/sha256.h>
#include <mbedtls/sha512.h>
#include <mbedtls/entropy.h>
#include <mbedtls/ctr_drbg.h>
#include "esp_system.h"
#include "nvs_flash.h"

// Terminal keypair stored in NVS
static const char* NVS_NAMESPACE = "nfc_term";
static const char* NVS_PRIV_KEY = "priv_key";
static const char* NVS_PUB_KEY  = "pub_key";
static const char* NVS_SRV_KEY  = "srv_key";
static const char* NVS_REGISTERED = "registered";

struct KeyPair {
  uint8_t private_key[32];
  uint8_t public_key[32];
};

// Generate Ed25519 keypair using mbedtls
bool generateKeyPair(KeyPair* kp) {
  mbedtls_entropy_context entropy;
  mbedtls_ctr_drbg_context ctr_drbg;
  const char* pers = "nfc_terminal_keygen";

  mbedtls_entropy_init(&entropy);
  mbedtls_ctr_drbg_init(&ctr_drbg);

  int ret = mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy,
                                   (const unsigned char*)pers, strlen(pers));
  if (ret != 0) return false;

  ret = mbedtls_ed25519_genkey(kp->public_key, kp->private_key,
                               mbedtls_ctr_drbg_random, &ctr_drbg);
  
  mbedtls_ctr_drbg_free(&ctr_drbg);
  mbedtls_entropy_free(&entropy);
  return (ret == 0);
}

// Save keypair to NVS
bool saveKeyPair(const KeyPair* kp) {
  nvs_handle_t handle;
  if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle) != ESP_OK) return false;

  nvs_set_blob(handle, NVS_PRIV_KEY, kp->private_key, 32);
  nvs_set_blob(handle, NVS_PUB_KEY, kp->public_key, 32);
  nvs_commit(handle);
  nvs_close(handle);
  return true;
}

// Load keypair from NVS
bool loadKeyPair(KeyPair* kp) {
  nvs_handle_t handle;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) return false;

  size_t len = 32;
  esp_err_t ret = nvs_get_blob(handle, NVS_PRIV_KEY, kp->private_key, &len);
  if (ret == ESP_OK) {
    len = 32;
    ret = nvs_get_blob(handle, NVS_PUB_KEY, kp->public_key, &len);
  }
  nvs_close(handle);
  return (ret == ESP_OK);
}

// Save server public key
bool saveServerPublicKey(const uint8_t* serverPubKey) {
  nvs_handle_t handle;
  if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle) != ESP_OK) return false;
  nvs_set_blob(handle, NVS_SRV_KEY, serverPubKey, 32);
  nvs_set_u8(handle, NVS_REGISTERED, 1);
  nvs_commit(handle);
  nvs_close(handle);
  return true;
}

// Load server public key
bool loadServerPublicKey(uint8_t* serverPubKey) {
  nvs_handle_t handle;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) return false;
  size_t len = 32;
  esp_err_t ret = nvs_get_blob(handle, NVS_SRV_KEY, serverPubKey, &len);
  nvs_close(handle);
  return (ret == ESP_OK);
}

// Check if terminal is registered
bool isRegistered() {
  nvs_handle_t handle;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) return false;
  uint8_t reg = 0;
  nvs_get_u8(handle, NVS_REGISTERED, &reg);
  nvs_close(handle);
  return (reg == 1);
}

// Sign a message with terminal private key
bool signMessage(const uint8_t* privKey, const uint8_t* message, size_t msgLen, uint8_t* signature) {
  return (mbedtls_ed25519_sign(signature, 64, message, msgLen,
                                privKey) == 0);
}

// Verify a signature with server public key
bool verifySignature(const uint8_t* pubKey, const uint8_t* message, size_t msgLen, const uint8_t* signature) {
  return (mbedtls_ed25519_verify(signature, 64, message, msgLen,
                                  pubKey) == 0);
}

// Convert Ed25519 private key to Curve25519 for ECDH
void ed25519PrivToCurve25519(const uint8_t* edPriv, uint8_t* curvePriv) {
  mbedtls_sha512_context ctx;
  mbedtls_sha512_init(&ctx);
  mbedtls_sha512_starts(&ctx, 0);
  mbedtls_sha512_update(&ctx, edPriv, 32);
  uint8_t hash[64];
  mbedtls_sha512_finish(&ctx, hash);
  mbedtls_sha512_free(&ctx);

  memcpy(curvePriv, hash, 32);
  curvePriv[0] &= 248;
  curvePriv[31] &= 127;
  curvePriv[31] |= 64;
}

// Convert Ed25519 public key to Curve25519 for ECDH
void ed25519PubToCurve25519(const uint8_t* edPub, uint8_t* curvePub) {
  mbedtls_sha512_context ctx;
  mbedtls_sha512_init(&ctx);
  mbedtls_sha512_starts(&ctx, 0);
  mbedtls_sha512_update(&ctx, edPub, 32);
  uint8_t hash[64];
  mbedtls_sha512_finish(&ctx, hash);
  mbedtls_sha512_free(&ctx);

  memcpy(curvePub, hash, 32);
  curvePub[0] &= 248;
  curvePub[31] &= 127;
  curvePub[31] |= 64;
}

// Derive shared key using ECDH (Curve25519) + SHA256
bool deriveSharedKey(const uint8_t* privKey, const uint8_t* peerPubKey, uint8_t* sharedKey) {
  uint8_t curvePriv[32], curvePub[32], rawShared[32];

  ed25519PrivToCurve25519(privKey, curvePriv);
  ed25519PubToCurve25519(peerPubKey, curvePub);

  // X25519 scalar multiplication
  int ret = mbedtls_ecdh_compute_shared(0, rawShared, 32, curvePub, curvePriv, NULL, NULL);
  if (ret != 0) return false;

  // SHA256 of raw shared secret -> 32-byte AES key
  mbedtls_sha256_context shaCtx;
  mbedtls_sha256_init(&shaCtx);
  mbedtls_sha256_starts(&shaCtx, 0);
  mbedtls_sha256_update(&shaCtx, rawShared, 32);
  mbedtls_sha256_finish(&shaCtx, sharedKey);
  mbedtls_sha256_free(&shaCtx);

  return true;
}

// Encrypt with AES-256-GCM
bool encryptPayload(const uint8_t* key, const uint8_t* plaintext, size_t ptLen,
                    uint8_t* nonce, uint8_t* ciphertext, size_t* ctLen) {
  mbedtls_gcm_context ctx;
  mbedtls_gcm_init(&ctx);

  int ret = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256);
  if (ret != 0) { mbedtls_gcm_free(&ctx); return false; }

  // Generate random 12-byte nonce
  esp_fill_random(nonce, 12);

  ret = mbedtls_gcm_crypt_and_tag(&ctx, MBEDTLS_GCM_ENCRYPT, ptLen,
                                   nonce, 12, NULL, 0,
                                   plaintext, ciphertext, 16, ciphertext + ptLen);
  *ctLen = ptLen + 16; // ciphertext + tag

  mbedtls_gcm_free(&ctx);
  return (ret == 0);
}

// Decrypt with AES-256-GCM
bool decryptPayload(const uint8_t* key, const uint8_t* nonce, size_t nonceLen,
                    const uint8_t* ciphertext, size_t ctLen,
                    uint8_t* plaintext, size_t* ptLen) {
  mbedtls_gcm_context ctx;
  mbedtls_gcm_init(&ctx);

  int ret = mbedtls_gcm_setkey(&ctx, MBEDTLS_CIPHER_ID_AES, key, 256);
  if (ret != 0) { mbedtls_gcm_free(&ctx); return false; }

  size_t actualCtLen = ctLen - 16; // last 16 bytes are tag
  ret = mbedtls_gcm_auth_decrypt(&ctx, actualCtLen,
                                  nonce, nonceLen, NULL, 0,
                                  ciphertext + actualCtLen, 16,
                                  ciphertext, plaintext);
  *ptLen = actualCtLen;

  mbedtls_gcm_free(&ctx);
  return (ret == 0);
}

// Hex helpers
String bytesToHex(const uint8_t* data, size_t len) {
  String hex = "";
  for (size_t i = 0; i < len; i++) {
    if (data[i] < 16) hex += "0";
    hex += String(data[i], HEX);
  }
  return hex;
}

void hexToBytes(const String& hex, uint8_t* data, size_t* len) {
  *len = hex.length() / 2;
  for (size_t i = 0; i < *len; i++) {
    String byteStr = hex.substring(i * 2, i * 2 + 2);
    data[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }
}

#endif // CRYPTO_HELPER_H
