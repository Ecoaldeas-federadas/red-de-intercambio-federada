# Hardware NFC — Terminales de Pago con ESP32

## Resumen

El sistema soporta terminales de pago NFC basados en ESP32 que se comunican con el servidor de forma segura usando autenticacion mutual (Ed25519), cifrado (AES-256-GCM via ECDH Curve25519) y verificacion de PIN.

## Tipos de terminal

| Tipo | Hardware | Input | Uso |
|------|----------|-------|-----|
| **Keypad** | ESP32 + PN532 + OLED + encoder | Encoder para monto y PIN | Comercio individual |
| **Touch** | TTGO T-Display + PN532 | Pantalla tactil | Terminal autonomo |
| **Community** | ESP32 + PN532 + OLED + encoder | Doble tarjeta | Punto comunitario |
| **BLE Reader** | ESP32 + PN532 (sin pantalla/WiFi) | Lector NFC Bluetooth | Accesorio del POS (Android o web) |

**Nota:** El "terminal web" es ahora puro software en el navegador (POS Web, directorio `pos/`). No requiere ESP32.
El merchant usa el POS Web para crear cobros QR. Para NFC en el navegador, se conecta
un lector BLE Reader via Web Bluetooth (solo Chrome/Edge, no Safari de iPhone).

## Emparejamiento

Hay dos formas de registrar un terminal ESP32:

1. **Por codigo corto (recomendado):** El ESP32 muestra un codigo de 6 digitos en su pantalla,
   el admin lo aprueba desde la web. Firmware generico, no requiere compilacion por terminal.
   El ESP32 envia su chip_id (MAC efuse) automaticamente.

2. **Provision manual (mayor seguridad):** El admin provisiona con chip_id, descarga config.h,
   compila firmware especifico. Hardware binding anti-copia (el firmware no arranca en otro ESP32).

### Re-registro (rotacion de claves)

Si un terminal pierde sus claves o se reemplaza, el sistema detecta que el dispositivo ya existe
por su chip_id/fingerprint y le pregunta al admin: "Reemplazar la clave del terminal existente
o crear uno nuevo?" Esto preserva el historial y configuracion del terminal.

### Verificacion de 4 opciones (emparejamiento POS)

El emparejamiento de terminales POS ahora usa una **verificacion de 4 opciones**
para evitar que alguien intercepte el codigo y lo confirme por error o fraude:

1. El terminal genera y muestra un codigo de 6 digitos.
2. El admin abre la pantalla de aprobacion en la web.
3. La pantalla muestra **4 codigos distintos** (uno es el correcto, tres son aleatorios).
4. El admin debe **seleccionar el codigo correcto** de las 4 opciones.
5. Si no se confirma en **60 segundos**, el codigo expira y se debe generar uno nuevo.

**Endpoints:**
- `GET /api/nfc/terminal/pair/request/{reqId}/options` — Devuelve las 4 opciones de codigo.
- `POST /api/nfc/terminal/pair/request/{reqId}/approve` — Aprueba con el `selected_code` (opcional).

**Razon:** Con un solo codigo, cualquiera que lo vea puede confirmar. Con 4
opciones, solo quien ve la pantalla del terminal sabe cual es el correcto. Esto
evita ataques de intermediario y errores de confirmacion.

## Confirmacion de pagos

| Metodo | Confirmacion | Requiere celular |
|--------|-------------|------------------|
| QR code | Cliente escanea QR -> /pay?t=token -> confirma | Si |
| NFC DESFire (tarjeta segura) | Tarjeta + PIN en terminal | No |
| NFC UID-only (tarjeta sencilla) | Tarjeta + documento ID + PIN en terminal | No |

La tarjeta DESFire tiene encriptacion AES que valida autenticidad, por eso solo pide PIN.
La tarjeta UID-only es barata y no tiene encriptacion, por eso pide documento de identidad
para verificar que la tarjeta pertenece a quien dice ser.

## Componentes

### Lector NFC: PN532

- Modulo I2C, compatible con ISO14443A
- Soporta: MIFARE Classic, NTAG, DESFire
- Rango: ~5cm
- Precio: $3-6 USD

### Pantalla: OLED SSD1306

- 128x64 pixeles, I2C
- Monocromo (blanco sobre negro)
- Direccion: 0x3C o 0x3D
- Precio: $3-5 USD

### Pantalla tactil: TTGO T-Display

- ESP32 + ILI9341 + XPT2046 integrados
- 320x240 a color, tactil resistivo
- Precio: $15-25 USD

### Encoder rotatorio: KY-040

- Encoder cuadratura + boton
- Para ingresar montos y PINs
- Precio: $1-2 USD

## Tarjetas NFC soportadas

| Tipo | Seguridad | Precio | Recomendacion |
|------|-----------|--------|---------------|
| UID-only (sin cert) | Solo UID (sin crypto) | $0.20 | Basico |
| MIFARE Classic 1K (con cert dinamicos) | 15 sectores con certificados rotativos + claves A/B unicas | $0.30 | Medio (con doc obligatorio) |
| NTAG424 DNA | SUN MAC, AES-128 | $0.50 | Recomendado |
| MIFARE DESFire EV3 | AES-128, multi-app | $1.50 | Alta seguridad |

### MIFARE Classic 1K con Certificados Dinamicos

El sistema soporta MIFARE Classic 1K con un modelo de seguridad de 6 capas que mitiga la clonacion:

**Capa 1: Claves A/B unicas por sector por tarjeta**
- 15 sectores × (Key A + Key B) = 30 claves, todas diferentes
- Cada tarjeta tiene claves TOTALMENTE diferentes a otras tarjetas
- Key A = solo lectura, Key B = solo escritura (access bits)
- Escritas UNA SOLA VEZ en provisionamiento (bloque 3/trailer)
- NUNCA se modifican en caliente (evita corrupcion irreversible)
- Guardadas en el servidor, solo el servidor las conoce

**Capa 2: Certificados dinamicos (16 bytes por sector)**
- 15 sectores × 3 bloques = 45 copias de certificados
- Solo 1 sector tiene el certificado VALIDO (is_active=true)
- Los otros 14 tienen certificados basura (aleatorios, indistinguibles)
- Solo el servidor sabe cual sector es el activo

**Capa 3: Rotacion aleatoria por transaccion**
- Cada transaccion: servidor lee sector activo, escribe nuevo cert en sector aleatorio
- Sector viejo → is_active=false (cert queda como basura)
- Sector nuevo → is_active=true (cert recien escrito)
- No es secuencial: salta aleatoriamente entre los 15 sectores

**Capa 4: Doble factor de autenticacion (2FA)**
- Documento de identidad (OBLIGATORIO para Classic, no configurable)
- PIN de 4 digitos
- Tarjeta fisica
- Los tres se verifican ANTES de procesar el pago

**Capa 5: Claves en transito minimizadas**
- Por transaccion solo se envian 2 claves al POS: Key A del sector a leer + Key B del sector a escribir
- Viajan encriptadas (EphemeralMessage AES-256-GCM)
- Si se interceptan, solo sirven para esa tarjeta, esa transaccion

**Capa 6: Aislamiento entre tarjetas**
- Cada usuario/tarjeta tiene claves unicas
- Si vulneran una tarjeta, esas claves no sirven para otra

### Flujo de pago con tarjeta Classic

1. Comerciante ingresa monto
2. Cliente ingresa documento de identidad + PIN (sin tarjeta)
3. Servidor valida usuario, PIN, saldo → bloquea monto (pre-aprobacion)
4. Servidor busca sector activo, genera nuevo cert, elige sector aleatorio
5. Servidor envia al POS: card_uid + sector leer + key A + cert esperado + sector escribir + key B + cert nuevo
6. POS muestra "ACERQUE SU TARJETA"
7. POS lee UID → verifica, lee sector con key A → verifica cert, escribe nuevo cert con key B
8. POS confirma al servidor: read_ok + write_ok
9. Servidor procesa pago, desactiva sector viejo, activa nuevo
10. POS muestra resultado

### Provisionamiento de tarjeta Classic

El provisionamiento de tarjetas se divide en dos permisos diferentes:

**Paso 1: Registrar/provisionar (permiso `nfc.issue_card`)** — Web admin
1. Admin vincula tarjeta a usuario (user_id + PIN inicial + tipo de tarjeta)
2. Servidor genera 15 pares de claves A/B aleatorios + 15 certificados (14 basura + 1 real)
3. La tarjeta queda "registrada pero no inicializada" en el servidor

**Paso 2: Grabar/inicializar (permiso `nfc.initialize_card`)** — POS Android
1. Operador abre POS Android → Administracion → Grabar Tarjeta
2. Selecciona una tarjeta de la lista de pendientes de inicializacion
3. Coloca la tarjeta fisica en el lector NFC del celular
4. POS escribe TODOS los sectores (claves + access bits + certificados)
5. POS verifica que la escritura fue correcta
6. POS confirma inicializacion al servidor

**Por que dos permisos separados:**
- `nfc.issue_card` es mas restrictivo: solo personas especificas pueden registrar tarjetas (asociar a usuario, definir PIN, tipo)
- `nfc.initialize_card` es menos restrictivo: el operador solo asegura que la tarjeta quede bien posicionada durante la escritura
- Esto permite que una persona registre la tarjeta y otra persona la grabe fisicamente

### Limitaciones de MIFARE Classic

MIFARE Classic usa Crypto1, que es criptograficamente debil. El ataque Nested/Hardnested
puede obtener TODAS las claves A/B y TODO el contenido de la tarjeta. El sistema mitiga
esto porque:
- El atacante no sabe cual sector es el activo (solo el servidor lo sabe)
- Necesita PIN + documento (2FA)
- Despues de una transaccion legitima, el clon queda obsoleto
- Cada tarjeta tiene claves unicas (no sirven para otra tarjeta)

Para alta seguridad, se recomienda DESFire EV3.

## Esquema de conexiones

Ver `firmware/terminal-*/wiring.md` para cada tipo de terminal.

### Bus I2C compartido

El PN532 y el OLED comparten el bus I2C:
- SDA: GPIO 21
- SCL: GPIO 22

### Pines usados

| Pin | Funcion | Dispositivo |
|-----|---------|-------------|
| GPIO 21 | I2C SDA | PN532 + OLED |
| GPIO 22 | I2C SCL | PN532 + OLED |
| GPIO 2 | IRQ | PN532 |
| GPIO 4 | RST | PN532 |
| GPIO 25 | Buzzer | Buzzer |
| GPIO 26 | Encoder A | KY-040 |
| GPIO 27 | Encoder B | KY-040 |
| GPIO 14 | Encoder SW | KY-040 (boton) |

## Alimentacion

- USB: 5V via cable USB (mas comun)
- Bateria: LiPo 3.7V via pin 3.3V o modulo de carga
- Consumo: ~80mA en operacion, ~20mA en idle

## Donde comprar

- [AliExpress](https://aliexpress.com): ESP32, PN532, OLED, encoder
- [Amazon](https://amazon.com): Componentes con envio rapido
- [DigiKey](https://digikey.com): Componentes originales

## Ver tambien

- `firmware/` — Codigo fuente del firmware
- `firmware/docs/security_model.md` — Modelo de seguridad detallado
- `firmware/docs/flashing_guide.md` — Guia de flasheo
- `firmware/docs/hardware_list.md` — Lista completa de componentes
- `firmware/docs/troubleshooting.md` — Solucion de problemas
