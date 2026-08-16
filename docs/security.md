# Seguridad y Criptografia

## Autenticacion: Passkeys (WebAuthn/FIDO2)

### Archivos
- `internal/crypto/passkey.go` - Gestor de Passkeys
- `internal/api/auth.go` - Handlers de auth y middleware JWT

### Flujo de Registro
1. **BeginRegistration**: Genera challenge aleatorio (32 bytes), crea opciones WebAuthn con RP ID, algoritmos soportados (-7 ES256, -257 RS256)
2. **VerifyRegistration**: Valida clientDataJSON (tipo, challenge, origin), decodifica attestationObject (CBOR), extrae clave publica
3. Almacena: credential_id, public_key, sign_count en tabla `user_passkeys`

### Flujo de Login
1. **BeginLogin**: Genera challenge, permite credenciales existentes
2. **VerifyLogin**: Valida clientDataJSON, verifica firma Ed25519 sobre (authData + clientData), valida sign_count (anti-replay)

### Registro de Segundo Dispositivo
- Usuario autenticado llama a BeginRegistration con `excludeCredentials` (credenciales existentes)
- El nuevo passkey se asocia al mismo user_id
- Se registra en `device_registrations` con tipo `additional`

## JWT (JSON Web Token)

- **Algoritmo**: HS256
- **Secret**: Variable de entorno `JWT_SECRET` (default: "change-me-in-production")
- **Claims**: user_id, username, node, exp (24h), iat
- **Middleware**: `RequireAuth` valida token en header `Authorization: Bearer <token>`

## Claves Ed25519

### Generacion
- Cada usuario genera par de claves Ed25519 al registrarse
- Clave privada encriptada con AES-256-GCM usando passphrase del usuario
- Clave publica almacenada en `users.public_key` (hex)

### Firma de Transacciones
- Transacciones se firman con clave privada del usuario
- `user_signature` almacenado en tabla `transactions`
- Verificacion con clave publica almacenada

### Multi-firma
- Organizaciones configuran `required_signatures` y `authorized_signers`
- Propuestas multi-firma acumulan firmas en `collected_signatures` (JSONB)
- Se ejecutan cuando se alcanza `required_signatures`

## Hash Chain (Cadena de Bloques)

### Estructura
- Cada transaccion tiene `prev_hash` y `current_hash`
- `current_hash = SHA256(prev_hash + tx_data_serializada)`
- Primera transaccion: `prev_hash = "genesis"` o vacio

### Verificacion
- Auditoria recorre todas las transacciones en orden
- Recalcula hashes y compara con almacenados
- Cualquier modificacion altera la cadena detectablemente

## Encriptacion de Claves Privadas

- **Algoritmo**: AES-256-GCM
- **Derivacion de clave**: Scrypt desde passphrase + salt
- **Almacenamiento**: `users.encrypted_private_key` (BYTEA), `users.encryption_key_salt` (BYTEA)
- **Passphrase**: Nunca se almacena, solo en memoria del usuario

## Recuperacion de Cuenta

### Principio Fundamental
**Ninguna persona sola puede restaurar el acceso a una cuenta.** Minimo 2 aprobaciones requeridas.

### Modos de Aprobacion Configurables
| Modo | Descripcion |
|------|-------------|
| `multi_sig` | N firmas de cualquier miembro con voz/voto |
| `council` | Grupo designado (member_group) |
| `assembly` | Votacion formal de asamblea |
| `department` | Jefes de departamento |

### Flujo
1. Solicitud publica con razon y verificacion de identidad
2. Acumulacion de aprobaciones (cada aprobador autenticado con JWT)
3. Auto-expiracion configurable (default 72h)
4. Al completarse: se eliminan passkeys antiguas, se reemplaza clave publica
5. Usuario registra nuevo dispositivo con nueva Passkey

## Codigos de Invitacion

- Miembros existentes generan codigos de invitacion
- Codigo hasheado con SHA256 (no se almacena en plano)
- Configurable: max_uses, nivel propuesto, expiracion
- Validacion antes de permitir registro

## Terminales NFC ESP32

### Archivos
- `internal/crypto/terminal_crypto.go` - Criptografia de terminales
- `internal/payments/nfc_terminal.go` - Logica de terminales NFC
- `firmware/shared/crypto_helper.h` - Cripto en ESP32 (mbedtls)

### Autenticacion Mutual (Ed25519)
1. Terminal genera keypair Ed25519 de **identidad**, almacena clave privada en NVS
2. Terminal envia su clave publica de identidad al servidor (con token de registro)
3. Servidor responde con su clave publica de identidad
4. Terminal firma nonce con su clave de identidad, servidor verifica
5. Servidor firma session token con su clave de identidad, terminal verifica

### Claves Efimeras por Transaccion (Forward Secrecy)
- Por **cada mensaje**, ambos generan un nuevo par Ed25519 efimero
- Intercambian publicas efimeras firmadas con su clave de identidad
- Derivan shared key via ECDH efimero (no con claves de identidad)
- **Forward secrecy**: si alguien captura una clave efimera, solo compromete 1 transaccion
- Las claves publicas en el wire **cambian en cada transaccion**
- Un atacante que intercepta trafico no puede reutilizar nada

### Cifrado de Comunicacion (AES-256-GCM)
- Toda comunicacion cifrada con la shared key efimera de la transaccion
- Nonce aleatorio de 12 bytes por mensaje (anti-replay)
- Ciphertext firmado con clave de identidad Ed25519 por el emisor
- Receptor verifica firma de identidad antes de descifrar

### PIN de Tarjetas NFC
- 4 digitos, hasheado con bcrypt en el servidor
- Maximo 3 intentos antes de bloqueo temporal (15 minutos)
- Admin puede resetear PIN con permiso `nfc.reset_pin`
- Usuario puede cambiar PIN con PIN viejo

### Identificacion de Tarjetas NFC (BIN-style)
- Card UID tiene formato `nodocodigo:hexrandom` (ej: `nodo1trueque:a1b2c3d4e5f6a7b8`)
- Los primeros caracteres identifican el nodo origen (como los BINs de tarjetas bancarias)
- **No se busca en todos los nodos** — se identifica el nodo directamente por el prefijo
- Si la tarjeta es de otro nodo, se consulta via federation `/federation/card/lookup`
- El nodo origen responde con: userID, username, displayName, balance, isActive
- La transaccion se procesa via `CrossNodeTransfer` entre los nodos federados

## Pagos por Codigo QR

### Formato del QR (protocolo fmc/1.0)
```json
{
  "protocol": "fmc/1.0",
  "type": "PaymentRequest",
  "node": "nodo1.trueque.local",
  "user": "@usuario@nodo1.trueque.local",
  "user_id": "uuid",
  "display_name": "Juan Perez",
  "account": "usuario@nodo1.trueque.local",
  "amount": 5000,
  "label": "Pago de productos",
  "nonce": "aleatorio",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

### Tipos de QR
- **QR con monto fijo**: `amount` presente — para productos/POS, el que paga no puede cambiar el monto
- **QR sin monto (libre)**: `amount` null — el que escanea introduce el monto manualmente
- **QR P2P**: usuario genera QR en su app, otro lo escanea para transferir
- **QR POS**: software de negocio genera QR via API `/api/payments/qr/pos` con monto automatico

### Pago Cross-Node via QR
- Si el QR es de otro nodo (`is_local_node = false`), el pago se procesa via `CrossNodeTransfer`
- El nodo del pagador debita, el nodo del receptor acredita
- Se validan limites bilaterales y globales antes de procesar
- Equivalente a "pago movil": cedula = user_id, banco = node, telefono = account

### Endpoints API para integracion externa
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/payments/qr/generate` | Generar QR personalizado (con o sin monto) |
| POST | `/api/payments/qr/parse` | Escanear/validar QR |
| POST | `/api/payments/qr/pos` | Generar QR con monto fijo (para POS de negocios) |
| POST | `/api/payments/manual` | Pago manual con datos |
| POST | `/api/payments/nfc/lookup` | Buscar tarjeta NFC (local o federada) |

### Permisos
- Middleware `RequirePermission` verifica permisos del usuario via JWT
- Permisos provienen de roles de departamento + permisos directos
- Ver `departments.md` para lista completa de permisos

## TLS / SSL en Intranet (sin internet)

### Arquitectura de TLS

El nodo Go corre en HTTP plano (puerto 8080). Un reverse proxy (Nginx/Caddy)
maneja TLS en el frente. Esto separa la logica de negocio del manejo de certificados.

```
[Cliente] --HTTPS--> [Nginx/Caddy] --HTTP:8080--> [Nodo Go]
```

### Certificados en intranet (sin internet permanente)

Los navegadores verifican certificados **localmente** — no consultan a ninguna
CA en tiempo real. Esto significa que un certificado de Let's Encrypt funciona
en intranet sin internet, porque la verificacion es matematica local contra
el trust store del sistema operativo.

Ver `deployment.md` > "SSL / TLS en Intranet (sin internet)" para la guia
completa con:

- **Let's Encrypt en intranet** (recomendado): obtener certificado con internet
  temporal, funciona sin internet despues. Sin instalar nada en clientes.
  Renovacion automatica cada 90 dias cuando hay internet esporadico.
- **CA privada + script .bat**: sin internet nunca. Se instala una vez por
  dispositivo (doble clic), funciona por 10 anos en todos los navegadores.
- **HTTP plano**: para LAN aislada sin requerimientos de seguridad.

### mTLS entre Nodos

La federacion servidor-servidor usa mTLS mutuo con la misma CA privada.
Cada nodo presenta su certificado y verifica el del par. Esto es independiente
del TLS del navegador.

### Login por Contrasena (Setup Wizard)

- El setup inicial crea el usuario admin con contrasena (bcrypt)
- La contrasena se usa para cifrar la clave privada Ed25519 (AES-256-GCM)
- Login por contrasena via `POST /api/auth/login/password`
- Login por Passkey (WebAuthn) sigue disponible como alternativa
- Ambos metodos retornan JWT con mismo formato
