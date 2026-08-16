// config.h — Configuracion del terminal touch
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
#define TERMINAL_ID        "TERM-TOUCH-001"
#define REGISTRATION_TOKEN "TOKEN-DEL-ADMIN"

// URL del servidor (sin barra final)
#define SERVER_URL         "https://tu-servidor.com"

// PIN de bloqueo local (4 digitos)
// Bloqueo momentaneo de la pantalla — no va al servidor.
// Para bloquear: tocar y mantener la esquina superior izquierda 2 segundos en IDLE
// Para desbloquear: ingresar este PIN en la pantalla tactil
#define LOCK_PIN           "0000"

#endif // CONFIG_H
