# Firmware ESP32 — Terminales NFC

Firmware para terminales de pago NFC basadas en ESP32. Cuatro tipos de terminal con codigo y documentacion separados.

## Tipos de terminal

| Tipo | Hardware | Input | Carpeta |
|------|----------|-------|---------|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | `terminal-keypad/` |
| **Web** | ESP32 + PN532 + OLED | Monto desde app web, PIN en app | `terminal-web/` |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil para monto y PIN | `terminal-touch/` |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta (vendedor + comprador) | `terminal-community/` |

## Estructura

```
firmware/
├── README.md              (este archivo)
├── shared/                (codigo compartido: crypto, NFC, display, server, PIN)
├── terminal-keypad/       (terminal con encoder)
├── terminal-web/          (terminal con app web)
├── terminal-touch/        (terminal con pantalla tactil)
├── terminal-community/    (punto comunitario doble tarjeta)
└── docs/                  (documentacion general)
```

## Seguridad

Todos los terminales usan el mismo modelo de seguridad:

1. **Keypair de identidad Ed25519**: Generado en el ESP32, clave privada en NVS (no sale del dispositivo)
2. **Registro mutual**: ESP32 envia su public key de identidad, servidor responde con la suya
3. **Claves efimeras por transaccion**: Cada mensaje genera un nuevo par Ed25519 efimero
4. **ECDH efimero**: Derivan clave compartida con claves efimeras (no con identidad)
5. **Forward secrecy**: Si alguien captura una clave, solo compromete esa transaccion
6. **AES-256-GCM**: Toda comunicacion cifrada con la shared key efimera
7. **Ed25519**: Toda comunicacion firmada con clave de identidad (no efimera)
8. **Anti-replay**: Nonce aleatorio en cada mensaje + claves efimeras cambian cada vez
9. **PIN**: 4 digitos, hasheado con bcrypt en servidor, max 3 intentos

### Protocolo efimero por transaccion

```
Por cada mensaje:
  Terminal genera (priv_eph, pub_eph) nueva
  Servidor genera (priv_eph, pub_eph) nueva
  Terminal envia: pub_eph + firma(identidad, pub_eph) + ciphertext + firma(identidad, ciphertext)
  Servidor verifica firma de identidad
  Servidor deriva shared_key = ECDH(server_eph_priv, terminal_eph_pub)
  Servidor descifra con shared_key
  Servidor responde con mismo shared_key + firma(identidad_server, ciphertext)
  Terminal deriva shared_key = ECDH(terminal_eph_priv, server_eph_pub)
  Terminal descifra respuesta

  -> Las claves publicas en el wire cambian en cada transaccion
  -> Si alguien intercepta trafico, no puede reutilizar nada
  -> Forward secrecy: capturar una clave efimera solo compromete 1 transaccion
```

Ver `docs/security_model.md` para detalles.

## Inicio rapido

1. Elegir tipo de terminal segun necesidades
2. Comprar componentes (ver `docs/hardware_list.md`)
3. Editar `config.h` con WiFi, servidor y terminal_id
4. Registrar terminal en el servidor (admin)
5. Cargar codigo al ESP32 (ver `docs/flashing_guide.md`)
6. Verificar funcionamiento (ver `docs/troubleshooting.md`)
