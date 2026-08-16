#ifndef PIN_HELPER_H
#define PIN_HELPER_H

#include <Arduino.h>

// PIN input via rotary encoder + button
// Returns 4-digit PIN as String

#define ENCODER_PIN_A  26
#define ENCODER_PIN_B  27
#define BUTTON_PIN     14

volatile int encoderPos = 0;
volatile int lastA = 0;

void IRAM_ATTR encoderISR() {
  int a = digitalRead(ENCODER_PIN_A);
  int b = digitalRead(ENCODER_PIN_B);
  if (a != lastA) {
    if (a != b) {
      encoderPos++;
    } else {
      encoderPos--;
    }
  }
  lastA = a;
}

void initPinInput() {
  pinMode(ENCODER_PIN_A, INPUT_PULLUP);
  pinMode(ENCODER_PIN_B, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(ENCODER_PIN_A, encoderISR, CHANGE);
}

// Input a single digit (0-9) using rotary encoder
int inputDigit(int currentDigit, const String& prompt) {
  encoderPos = currentDigit;
  while (true) {
    int val = ((encoderPos % 10) + 10) % 10;
    // Display would show current digit here
    // showText(String(val), 3, 24);

    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(200); // debounce
      return val;
    }
    delay(50);
  }
}

// Input 4-digit PIN using rotary encoder
String inputPIN(const String& prompt) {
  String pin = "";
  for (int i = 0; i < 4; i++) {
    int digit = inputDigit(0, prompt + " digito " + String(i + 1) + "/4");
    pin += String(digit);
    // Update display showing **** with filled digits
  }
  return pin;
}

// Input amount using rotary encoder (in centavos)
int64_t inputAmount() {
  encoderPos = 0;
  int64_t amount = 0;

  // Simple implementation: rotate to change value, click to confirm
  while (true) {
    amount = abs(encoderPos) * 100; // each click = 1 unit = 100 centavos
    // showAmount(String(amount / 100) + "." + String(amount % 100));

    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(200);
      return amount;
    }
    delay(50);
  }
}

// For touch terminals: PIN input is handled by the touch UI directly
// This function provides a stub for compatibility
String inputPINTouch(int (*touchGetDigit)(const String&), const String& prompt) {
  String pin = "";
  for (int i = 0; i < 4; i++) {
    int digit = touchGetDigit(prompt + " " + String(i + 1) + "/4");
    pin += String(digit);
  }
  return pin;
}

#endif // PIN_HELPER_H
