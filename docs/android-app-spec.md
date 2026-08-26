# App Android - Especificacion Tecnica

## Resumen

Aplicacion Android para actuar como terminal NFC movil conectada a un lector
Bluetooth BLE (ESP32 + PN532) o directamente al NFC del telefono.

## Arquitectura recomendada

**React Native** (TypeScript) - permite compartir codigo con el POS web existente
y reutilizar el modulo `crypto.ts` (Ed25519, device fingerprint, etc).

Alternativa: **Kotlin nativo** si se prefiere maximo rendimiento y acceso directo
al NFC del telefono.

## Componentes principales

### 1. Autenticacion con el servidor
- Reutilizar `crypto.ts` del POS web (Ed25519 keypair + device fingerprint)
- Login del comerciante (JWT)
- Registro del terminal movil
- Sesion con rotating keys (30s)

### 2. Conexion BLE con lector ESP32
- Servicio BLE: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- Caracteristicas:
  - `0002`: ESP32 → celular (card UID leido)
  - `0003`: celular → ESP32 (comandos)
  - `0004`: ESP32 → celular (estado/config)
- Comandos BLE soportados:
  - `read` - leer tarjeta
  - `status` - obtener estado del lector
  - `detect_type` - detectar si es DESFire o normal
  - `auth_desfire:<aes_key_hex>` - autenticar DESFire con clave AES
  - `change_key:<old_hex>:<new_hex>` - rotar clave de la tarjeta
  - `verify_key:<new_hex>` - verificar que la nueva clave funciona

### 3. Flujo de pago (dual)

#### Tarjeta normal (UID + PIN):
```
1. Leer UID via BLE o NFC del telefono
2. Pedir PIN al usuario (teclado en pantalla)
3. POST /api/nfc/terminal/payment { card_uid, crypto_token: uid, card_type: "uid_only", pin, amount }
4. Mostrar resultado
```

#### Tarjeta segura (DESFire EV3):
```
1. Leer UID via BLE
2. POST /api/nfc/cards/{uid}/request-key → obtener clave AES
3. Enviar "auth_desfire:<key>" al ESP32 via BLE
4. ESP32 autentica la tarjeta
5. Pedir PIN al usuario
6. POST /api/nfc/terminal/payment { card_uid, crypto_token: "desfire_auth_ok", card_type: "desfire", pin, amount }
7. Si aprobado y auto_rotate:
   a. POST /api/nfc/cards/{uid}/prepare-rotation → obtener nueva clave K'
   b. Enviar "change_key:<K>:<K'>" al ESP32 via BLE
   c. Enviar "verify_key:<K'>" al ESP32 via BLE
   d. Si verificado: POST /api/nfc/cards/{uid}/confirm-rotation
   e. Si fallo 3x: POST /api/nfc/cards/{uid}/fail-rotation
8. Borrar K y K' de memoria
9. Mostrar resultado
```

### 4. UI/UX

Pantallas:
- **Login**: usuario + password del comerciante
- **Setup**: configurar URL del servidor, emparejar lector BLE
- **Cobro**: ingresar monto
- **NFC**: esperar tarjeta, mostrar tipo detectado
- **PIN**: teclado numerico para PIN
- **Procesando**: spinner
- **Rotando clave**: spinner con mensaje "Rotando clave de seguridad"
- **Resultado**: aprobado/rechazado
- **Historial**: ultimas transacciones
- **Config**: tipo de tarjeta, modo de rotacion

### 5. Seguridad

- Claves AES recibidas del servidor se guardan SOLO en memoria
- Al cerrar la app o terminar la transaccion: zeroization
- No usar AsyncStorage/SharedPreferences para claves
- Usar Android Keystore para la clave Ed25519 del terminal
- BLE con Secure Simple Pairing (LE Secure Connections)
- TLS para todas las comunicaciones con el servidor

### 6. Permisos necesarios

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

### 7. Endpoints del backend que consume

| Endpoint | Metodo | Funcion |
|---|---|---|
| `/api/auth/login` | POST | Login comerciante |
| `/api/nfc/terminal/register` | POST | Registrar terminal movil |
| `/api/nfc/terminal/complete-registration` | POST | Completar registro con clave publica |
| `/api/nfc/terminal/auth` | POST | Autenticar terminal |
| `/api/nfc/terminal/heartbeat` | POST | Heartbeat |
| `/api/nfc/terminal/payment` | POST | Procesar pago |
| `/api/nfc/cards/{uid}/request-key` | POST | Pedir clave AES de tarjeta |
| `/api/nfc/cards/{uid}/challenge` | POST | Generar challenge |
| `/api/nfc/cards/{uid}/verify-response` | POST | Verificar respuesta |
| `/api/nfc/cards/{uid}/prepare-rotation` | POST | Preparar rotacion de clave |
| `/api/nfc/cards/{uid}/confirm-rotation` | POST | Confirmar rotacion |
| `/api/nfc/cards/{uid}/fail-rotation` | POST | Reportar fallo de rotacion |
| `/api/nfc/cards/{uid}/crypto-status` | GET | Estado criptografico |
| `/api/nfc/card-type/config` | GET | Config de tipo de tarjeta |

### 8. Librerias recomendadas (React Native)

```json
{
  "react-native-ble-plx": "^3.0.0",
  "react-native-nfc-manager": "^3.14.0",
  "@react-native-async-storage/async-storage": "^1.19.0",
  "react-native-keychain": "^8.1.0",
  "tweetnacl": "^1.0.3"
}
```

### 9. Compilacion

```bash
# Instalar dependencias
npm install

# Compilar APK
cd android && ./gradlew assembleRelease

# O con React Native CLI
npx react-native build android --mode release
```

Requiere Android Studio con:
- Android SDK 33+
- Build Tools 33.0.0
- JDK 17

### 10. Notas

- El NFC interno del telefono Android puede leer NDEF pero NO hace APDUs
  ISO14443-4 de DESFire. Para DESFire real se necesita el lector BLE ESP32.
- Si el telefono tiene NFC y la tarjeta es normal (UID+PIN), se puede usar
  el NFC del telefono directamente sin lector BLE.
- El lector BLE ESP32 es necesario para:
  - Tarjetas DESFire EV3 (APDUs ISO14443-4)
  - Rotacion de clave por transaccion
  - Escritura de clave en la tarjeta
