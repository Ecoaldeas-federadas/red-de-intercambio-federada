#ifndef DISPLAY_HELPER_H
#define DISPLAY_HELPER_H

#include <Arduino.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool initDisplay() {
  Wire.begin(21, 22); // SDA=21, SCL=22 for ESP32
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    return false;
  }
  display.clearDisplay();
  display.display();
  return true;
}

void showText(const String& text, int textSize = 2, int y = 0) {
  display.clearDisplay();
  display.setTextSize(textSize);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, y);
  display.println(text);
  display.display();
}

void showTwoLines(const String& line1, const String& line2) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  display.setCursor(0, 16);
  display.setTextSize(2);
  display.println(line2);
  display.display();
}

void showThreeLines(const String& line1, const String& line2, const String& line3) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  display.setCursor(0, 12);
  display.println(line2);
  display.setCursor(0, 24);
  display.println(line3);
  display.display();
}

void showAmount(const String& amount) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Monto:");
  display.setTextSize(3);
  display.setCursor(0, 16);
  display.println(amount);
  display.display();
}

void showReady() {
  showText("Listo", 2, 24);
}

void showWaitingCard() {
  showText("Acerce", 2, 8);
  display.setCursor(0, 32);
  display.setTextSize(2);
  display.println("tarjeta");
  display.display();
}

void showProcessing() {
  showText("Procesando...", 1, 24);
}

void showResult(const String& status, const String& message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  if (status == "approved") {
    display.setCursor(0, 0);
    display.println("APROBADA");
  } else {
    display.setCursor(0, 0);
    display.println("RECHAZADA");
  }
  display.setCursor(0, 16);
  display.println(message);
  display.display();
}

void showPINPrompt(const String& who) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("PIN " + who);
  display.setCursor(0, 16);
  display.setTextSize(2);
  display.println("----");
  display.display();
}

void showIP(const String& ip) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Terminal NFC");
  display.setCursor(0, 12);
  display.println("IP: " + ip);
  display.display();
}

#endif // DISPLAY_HELPER_H
