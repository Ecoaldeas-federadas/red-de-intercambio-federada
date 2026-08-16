# Solucion de Problemas — Terminales NFC ESP32

## NFC / PN532

| Problema | Causa | Solucion |
|----------|-------|----------|
| "PN532 not found" | Cableado incorrecto | Verificar SDA=GPIO21, SCL=GPIO22, VCC=3.3V |
| | Jumper SEL mal puesto | Jumper en posicion I2C (no SPI) |
| | Direccion I2C incorrecta | Probar 0x24 o 0x48 con I2C scanner |
| No lee tarjetas | Antena lejos | Acercar tarjeta a la antena del PN532 (< 5cm) |
| | Tipo de tarjeta no soportada | Usar ISO14443A (MIFARE, NTAG) |
| Lectura intermitente | Interferencia EMI | Alejar de motores/fuentes de ruido |
| | Cables largos | Usar cables < 20cm para I2C |

## WiFi

| Problema | Causa | Solucion |
|----------|-------|----------|
| No conecta | SSID/password incorrecto | Verificar config.h |
| | WiFi 5GHz | ESP32 solo soporta 2.4GHz |
| | Senal debil | Acercar al router o usar repetidor |
| IP 0.0.0.0 | DHCP no responde | Reiniciar router o usar IP estatica |

## Registro / Autenticacion

| Problema | Causa | Solucion |
|----------|-------|----------|
| "Error registro" | Token invalido | Re-registrar terminal en el servidor |
| | URL incorrecta | Verificar SERVER_URL en config.h |
| | Terminal ya registrado | Borrar NVS: `esptool.py erase_region 0x...` |
| "Error auth" | Claves corruptas | Borrar NVS y re-registrar |
| | Servidor sin claves | Admin debe llamar EnsureServerKeys |
| | Reloj desincronizado | El ESP32 usa millis, no NTP — verificar timestamp |

## Pantalla OLED

| Problema | Causa | Solucion |
|----------|-------|----------|
| Pantalla en blanco | Direccion I2C incorrecta | Probar 0x3C y 0x3D |
| | Cable SDA/SCL invertido | SDA=GPIO21 (pin 21), SCL=GPIO22 (pin 22) |
| Pixelados | Mal contacto | Verificar soldaduras/cables |
| Contraste bajo | OLED viejo | Reemplazar display |

## Pantalla Touch (TTGO T-Display)

| Problema | Causa | Solucion |
|----------|-------|----------|
| Touch no responde | SPI no configurado | Verificar pines XPT2046 en codigo |
| | Calibracion incorrecta | Ajustar rangos en getTouchedKey() |
| Pantalla incorrecta | TFT_eSPI mal configurado | Editar User_Setup.h para ILI9341 |
| Colores invertidos | Rotacion incorrecta | Ajustar tft.setRotation(0-3) |

## Encoder rotatorio

| Problema | Causa | Solucion |
|----------|-------|----------|
| No gira valores | Interrupcion no activa | Verificar attachInterrupt en GPIO26 |
| Saltos de valores | Debounce insuficiente | Aumentar delay en inputDigit() |
| Boton no responde | Pull-up faltante | GPIO14 con INPUT_PULLUP |
| Gira al reves | A/B invertidos | Intercambiar GPIO26 y GPIO27 |

## Buzzer

| Problema | Causa | Solucion |
|----------|-------|----------|
| No suena | Pin incorrecto | Verificar GPIO25 |
| | Buzzer activo vs pasivo | Usar buzzer pasivo (sin oscilador) |
| Volumen bajo | Sin resistencia | Agregar resistencia 100Ω en serie |

## Comunicacion cifrada

| Problema | Causa | Solucion |
|----------|-------|----------|
| "Error decrypt" | Clave compartida incorrecta | Re-derivar ECDH, verificar claves |
| | Nonce incorrecto | Verificar generacion de nonce |
| | Payload corrupto | Verificar JSON serialization |
| "Signature verification failed" | Clave publica incorrecta | Re-cargar serverPubKey desde NVS |

## Resetear terminal

Si el terminal esta en estado inconsistente:

```bash
# Borrar NVS (borra claves, requiere re-registro)
esptool.py --port COM3 erase_region 0x9000 0x6000

# O borrar todo
esptool.py --port COM3 erase_flash
```

Despues de borrar NVS, el terminal generara nuevas claves y necesitara
un nuevo `REGISTRATION_TOKEN` del admin.

## Logs de debug

Para ver logs detallados, abrir Monitor Serie a 115200 baud.
El firmware imprime:
- Estado de WiFi
- Version del PN532
- Estado de registro
- Errores de autenticacion
