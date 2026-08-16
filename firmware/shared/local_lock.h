// local_lock.h — Bloqueo local con PIN para terminales con teclado
// Este es un bloqueo MOMENTANEO y LOCAL: no va al servidor, no afecta el estado
// del terminal en el servidor. Solo bloquea el teclado/pantalla localmente para
// impedir que alguien use el terminal en ese momento (ej: el comerciante se aleja).
//
// Para bloquear: mantener presionada una tecla especial (o combo) durante 2 segundos
//                cuando el terminal esta en estado IDLE.
// Para desbloquear: ingresar el PIN de bloqueo en el teclado.
//
// El PIN de bloqueo se configura en config.h (LOCK_PIN) y se incluye en el firmware
// compilado por el servidor. No se puede cambiar desde el terminal (solo re-flasheando).
//
// El bloqueo persiste tras reinicio (se guarda en NVS).
//
// IMPORTANTE: Este bloqueo es independiente del bloqueo del servidor.
// El servidor puede desactivar el terminal (el dueño cierra el punto desde su panel web)
// y el terminal se negara a procesar pagos aunque este localmente desbloqueado.
#ifndef LOCAL_LOCK_H
#define LOCAL_LOCK_H

#include <Arduino.h>
#include "nvs_flash.h"

static const char* LOCK_NVS_NS = "local_lock";
static const char* LOCK_NVS_STATE = "locked";

// Estado de bloqueo local
bool localLocked = false;

// Cargar estado de bloqueo desde NVS
bool loadLockState() {
  nvs_handle_t handle;
  if (nvs_open(LOCK_NVS_NS, NVS_READONLY, &handle) != ESP_OK) return false;
  uint8_t state = 0;
  nvs_get_u8(handle, LOCK_NVS_STATE, &state);
  nvs_close(handle);
  localLocked = (state == 1);
  return true;
}

// Guardar estado de bloqueo en NVS (persiste tras reinicio)
bool saveLockState(bool locked) {
  nvs_handle_t handle;
  if (nvs_open(LOCK_NVS_NS, NVS_READWRITE, &handle) != ESP_OK) return false;
  nvs_set_u8(handle, LOCK_NVS_STATE, locked ? 1 : 0);
  nvs_commit(handle);
  nvs_close(handle);
  localLocked = locked;
  return true;
}

// Inicializar el sistema de bloqueo local
void initLocalLock() {
  loadLockState();
}

// Verificar si el terminal esta bloqueado localmente
bool isLocalLocked() {
  return localLocked;
}

// Bloquear el terminal localmente
void lockTerminal() {
  saveLockState(true);
  Serial.println("Terminal bloqueado localmente");
}

// Desbloquear el terminal localmente
void unlockTerminal() {
  saveLockState(false);
  Serial.println("Terminal desbloqueado localmente");
}

// Verificar si un PIN ingresado coincide con el PIN de bloqueo
bool checkLockPIN(const String& enteredPIN, const String& configuredLockPIN) {
  if (configuredLockPIN.length() == 0) return false;  // sin PIN configurado = no se puede bloquear
  return enteredPIN == configuredLockPIN;
}

#endif // LOCAL_LOCK_H
