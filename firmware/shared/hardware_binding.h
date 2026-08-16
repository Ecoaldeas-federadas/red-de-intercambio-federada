// hardware_binding.h — Vinculacion del firmware al hardware fisico del ESP32
// Impide que un firmware compilado para un nodo sea copiado a otro.
// Cada ESP32 tiene un chip ID unico grabado en efuse (no modificable).
// Si el chip ID del hardware no coincide con EXPECTED_CHIP_ID, el firmware se detiene.
#ifndef HARDWARE_BINDING_H
#define HARDWARE_BINDING_H

#include <Arduino.h>
#include "esp_chip_info.h"
#include "esp_mac.h"

// Lee el chip ID unico del ESP32 (MAC address de fabrica, grabada en efuse)
// Retorna como string hexadecimal de 12 caracteres (48 bits)
String getChipId() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t chipId = (uint32_t)(mac >> 16);  // bits altos de la MAC
  char idStr[13];
  snprintf(idStr, sizeof(idStr), "%06X", chipId);
  return String(idStr);
}

// Lee la MAC completa como string de 12 hex chars (mas granular)
String getFullMacHex() {
  uint64_t mac = ESP.getEfuseMac();
  char macStr[13];
  snprintf(macStr, sizeof(macStr), "%012llX", (unsigned long long)mac);
  return String(macStr);
}

// Verifica que el hardware coincide con el esperado.
// Si no coincide, muestra error y detiene el dispositivo permanentemente.
// Retorna true si el hardware es correcto, false si no coincide (y ya se detuvo).
bool verifyHardwareBinding(const String& expectedChipId) {
  String actualChipId = getFullMacHex();

  if (actualChipId.equalsIgnoreCase(expectedChipId)) {
    return true;
  }

  // Hardware no coincide — este firmware fue compilado para otro ESP32.
  // Detener el dispositivo para evitar uso indebido.
  Serial.println();
  Serial.println("========================================");
  Serial.println("ERROR: HARDWARE NO AUTORIZADO");
  Serial.println("========================================");
  Serial.print("Chip ID esperado: ");
  Serial.println(expectedChipId);
  Serial.print("Chip ID actual:   ");
  Serial.println(actualChipId);
  Serial.println("Este firmware esta vinculado a otro dispositivo.");
  Serial.println("Deteniendo ejecucion por seguridad.");
  Serial.println("========================================");

  // Parpadeo infinito del LED integrado para indicar error de hardware
  pinMode(2, OUTPUT);  // LED integrado en la mayoria de placas ESP32
  while (true) {
    digitalWrite(2, HIGH);
    delay(200);
    digitalWrite(2, LOW);
    delay(200);
  }

  return false;  // nunca llega aqui, pero por claridad
}

#endif // HARDWARE_BINDING_H
