// chip-id-reader.ino — Sketch generico para leer el chip ID del ESP32
//
// Este sketch NO requiere config.h ni hardware binding.
// Se flashea UNA VEZ en cualquier ESP32 nuevo para leer su chip ID.
// El chip ID se usa para provisionar el terminal desde el servidor.
//
// Uso:
//   1. Flashear este sketch al ESP32 nuevo (desde Arduino IDE o esptool)
//   2. Abrir Monitor Serie (115200 baud)
//   3. Copiar el chip ID que aparece (12 caracteres hex)
//   4. Entrar el chip ID en la web app > Provisionar Terminal
//   5. Descargar el config.h generado
//   6. Flashear el firmware real del terminal (con el config.h)
//
// Tambien se puede leer desde el navegador con Web Serial API:
//   - El web app tiene un boton "Escanear ESP32 via USB"
//   - Se conecta por Web Serial y lee el chip ID automaticamente

#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  delay(500);  // dar tiempo al serial

  Serial.println();
  Serial.println("========================================");
  Serial.println("  LECTOR DE CHIP ID — ESP32");
  Serial.println("========================================");
  Serial.println();
}

void loop() {
  // Leer MAC de fabrica (efuse, no modificable)
  uint64_t mac = ESP.getEfuseMac();

  // Formato de 12 hex chars (48 bits de la MAC)
  char macStr[13];
  snprintf(macStr, sizeof(macStr), "%012llX", (unsigned long long)mac);

  // Formato corto (6 hex chars, bits altos)
  uint32_t chipId = (uint32_t)(mac >> 16);
  char shortId[7];
  snprintf(shortId, sizeof(shortId), "%06X", chipId);

  Serial.println("----------------------------------------");
  Serial.print("Chip ID (12 hex): ");
  Serial.println(macStr);
  Serial.print("Chip ID (corto):  ");
  Serial.println(shortId);
  Serial.print("MAC completa:     ");
  Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X\n",
    (uint8_t)(mac >> 40), (uint8_t)(mac >> 32),
    (uint8_t)(mac >> 24), (uint8_t)(mac >> 16),
    (uint8_t)(mac >> 8),  (uint8_t)(mac));
  Serial.println();
  Serial.println(">>> Copia el Chip ID (12 hex) <<<");
  Serial.println(">>> y usalo en la web app para provisionar <<<");
  Serial.println("----------------------------------------");
  Serial.println();

  // Parpadear LED para indicar que esta activo
  pinMode(2, OUTPUT);
  digitalWrite(2, HIGH);
  delay(500);
  digitalWrite(2, LOW);
  delay(2500);  // repetir cada 3 segundos
}
