// config.h — Configuracion del terminal keypad
// IMPORTANTE: Este archivo es GENERADO POR EL SERVIDOR.
// No editar manualmente. El servidor genera este archivo con los valores
// reales del terminal (terminal_id, token, server URL, chip ID) y compila
// el firmware. El WiFi NO se configura aqui — se configura en el sitio
// via portal cautivo cuando el terminal arranca por primera vez.

#ifndef CONFIG_H
#define CONFIG_H

// Vinculacion al hardware fisico (chip ID unico del ESP32 en efuse)
// Si este firmware se flashea en otro ESP32, no arrancara.
#define EXPECTED_CHIP_ID  "AABBCCDDEEFF"

// Identidad del terminal (generada por el servidor)
#define TERMINAL_ID        "TERM-KEYPAD-001"
#define REGISTRATION_TOKEN "TOKEN-DEL-ADMIN"

// URL del servidor (sin barra final)
#define SERVER_URL         "https://tu-servidor.com"

// PIN de bloqueo local (4 digitos)
// Bloqueo momentaneo del teclado — no va al servidor.
// Para bloquear: mantener presionada la tecla del encoder 2 segundos en IDLE
// Para desbloquear: ingresar este PIN
#define LOCK_PIN           "0000"

#endif // CONFIG_H
