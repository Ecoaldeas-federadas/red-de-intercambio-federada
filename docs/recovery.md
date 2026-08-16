# Recuperacion de Cuenta

## Archivos
- `internal/accounts/recovery.go` - Logica de negocio
- `internal/api/recovery.go` - Handlers HTTP API
- `internal/db/migrations/003_account_recovery.sql` - Esquema DB
- `web/src/pages/Recovery.tsx` - Frontend

## Principio Fundamental

**Ninguna persona sola puede restaurar el acceso a la cuenta de otra persona.** El sistema exige un minimo de 2 aprobaciones (configurable) para completar cualquier recuperacion.

## Modos de Aprobacion

| Modo | Descripcion | Quien aprueba |
|------|-------------|---------------|
| `multi_sig` | Multi-firma de N miembros | Cualquier miembro con voz/voto |
| `council` | Consejo designado | Miembros de un group_id especifico |
| `assembly` | Votacion de asamblea | Decision formal de asamblea |
| `department` | Jefes de departamento | Responsables de departamento |

### Configuracion
- Endpoint: `PUT /api/recovery/config`
- Parametros: approval_mode, required_approvals (min 2), council_group_id, auto_expire_hours, requires_identity_verification
- Solo actualizable por asamblea o autoridad designada

## Tablas de Base de Datos

### `recovery_config`
Configuracion por nodo. Define el modo de aprobacion, numero de aprobaciones requeridas, horas para auto-expirar, y si requiere verificacion de identidad.

### `recovery_requests`
Solicitudes de recuperacion. Contiene: usuario objetivo, razon, verificacion de identidad, estado (pending/approved/rejected/expired/completed), aprobaciones acumuladas, expiracion.

### `recovery_approvals`
Firmas individuales de aprobacion. Cada aprobador autenticado con JWT. Registra tipo de aprobacion, firma opcional, grupo (si aplica), notas.

### `invitation_codes`
Codigos de invitacion para registro inicial. Hasheados con SHA256. Configurables en usos maximos, nivel propuesto, expiracion.

### `device_registrations`
Registro de dispositivos. Distingue entre `initial` (primer dispositivo) y `additional` (dispositivos adicionales).

## Flujo Completo

### 1. Registro Inicial
1. Miembro existente genera codigo de invitacion: `POST /api/recovery/invitation`
2. Nuevo usuario valida codigo: `POST /api/recovery/invitation/validate`
3. Usuario registra primer dispositivo Passkey: `POST /api/auth/register` + `POST /api/auth/passkey/finish`
4. Cuenta queda pendiente de admision

### 2. Registro de Segundo Dispositivo
1. Usuario autenticado inicia nuevo registro Passkey
2. Se excluyen credenciales existentes (excludeCredentials)
3. Nuevo passkey se asocia al mismo user_id
4. Se registra en `device_registrations` como `additional`

### 3. Perdida de Acceso
1. Usuario pierde dispositivo/Passkey
2. Cualquier persona crea solicitud: `POST /api/recovery/request`
   - target_username: usuario que perdio acceso
   - reason: razon de la solicitud
   - identity_verification: datos de verificacion (opcional segun config)
3. Solicitud queda `pending` con expiracion configurable (default 72h)

### 4. Acumulacion de Aprobaciones
1. Miembros autenticados aprueban: `POST /api/recovery/requests/{id}/approve`
2. Sistema valida:
   - No ha aprobado antes (unico por persona)
   - Si modo `council`: debe ser miembro del grupo designado
   - Solicitud no expirada
3. Cada aprobacion se registra en `recovery_approvals`
4. Cuando `approved_by.length >= required_approvals` -> estado `approved`

### 5. Rechazo
- Cualquier aprobador puede rechazar: `POST /api/recovery/requests/{id}/reject`
- Estado cambia a `rejected` con razon

### 6. Completar Recuperacion
1. Solicitud debe estar `approved`
2. Usuario recuperado o aprobador llama: `POST /api/recovery/requests/{id}/complete`
3. Sistema:
   - Actualiza `users.public_key` con nueva clave
   - Elimina todos los `user_passkeys` antiguos
   - Marca solicitud como `completed`
4. Usuario registra nuevo dispositivo Passkey

## Seguridad

- **No single point of failure**: Minimo 2 aprobaciones, configurable hasta N
- **Auto-expiracion**: Las solicitudes expiran si no se completan en tiempo
- **Audit trail**: Todas las aprobaciones quedan registradas con timestamp
- **Identity verification**: Configurable si se requiere verificacion adicional
- **Council restriction**: En modo council, solo miembros del grupo designado pueden aprobar
