# API REST

## Autenticacion

Todos los endpoints (excepto setup, registro y login) requieren header `Authorization: Bearer <JWT>`.

El JWT contiene: `user_id`, `username`, `node`, expira en 24 horas.

### Permisos

Los endpoints sensibles requieren permisos especificos via middleware `RequirePermission`.
Los permisos provienen de roles de departamento + permisos directos del usuario.
Ver `departments.md` para la lista completa de permisos.

## Endpoints

### Auth (`internal/api/auth.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/register` | Inicia registro WebAuthn (BeginRegistration) |
| POST | `/api/auth/passkey/finish` | Completa registro con respuesta WebAuthn |
| POST | `/api/auth/login/begin` | Inicia login WebAuthn (BeginLogin) |
| POST | `/api/auth/login/finish` | Completa login, devuelve JWT |
| POST | `/api/auth/login/password` | Login con usuario + contrasena (bcrypt) |
| GET | `/api/auth/me` | Info del usuario autenticado |
| POST | `/api/auth/passkey/list` | Lista passkeys del usuario |
| DELETE | `/api/auth/passkey/{id}` | Elimina un passkey |

### Transacciones (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/accounts/me` | Datos y balance del usuario |
| POST | `/api/transactions` | Crea transaccion (transferencia interna) |
| GET | `/api/transactions` | Lista transacciones (con filtros) |
| GET | `/api/transactions/{id}` | Detalle de transaccion |
| GET | `/api/products` | Lista productos del catalogo (con paginacion limit/offset) |
| POST | `/api/products` | Crea producto (requiere aprobacion de asamblea) |
| POST | `/api/products/{id}/approve` | Aprueba producto (permiso products.manage) |
| GET | `/api/products/categories` | Lista jerarquia de 3 niveles (parent_category, category, subcategory) |
| GET | `/api/pricing/calculate` | Calcula precio energetico |

### Dashboard y Profile (`internal/api/handlers.go`, `internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/dashboard` | Resumen del dashboard (balance, alertas, asambleas, orgs) |
| GET | `/api/profile` | Perfil del usuario autenticado |
| PUT | `/api/profile` | Actualizar perfil |
| GET | `/api/wallet` | Billetera con balance, limites y movimientos |
| GET | `/api/history` | Historial de transacciones |
| GET | `/api/my-membership` | Organizaciones y departamentos del usuario |
| GET | `/api/countries` | Lista de paises (ISO 3166-1) |
| GET | `/api/document-types` | Tipos de documento de identidad |
| POST | `/api/user/documents` | Subir documento de identidad |
| GET | `/api/user/documents` | Listar documentos del usuario |

### Asamblea del Nodo (`internal/api/assembly.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/assembly/sessions` | Listar sesiones (filter=upcoming/past) |
| POST | `/api/assembly/sessions` | Crear sesion (fecha obligatoria) |
| POST | `/api/assembly/sessions/{id}/close` | Cerrar asamblea + auto-convocar siguiente |
| POST | `/api/assembly/sessions/{id}/reschedule` | Reprogramar (notifica a miembros) |
| GET | `/api/assembly/proposals` | Listar propuestas |
| POST | `/api/assembly/proposals` | Crear propuesta (estado: proposed) |
| POST | `/api/assembly/proposals/{id}/open-voting` | Abrir votacion (estado: pending) |
| POST | `/api/assembly/proposals/{id}/vote` | Votar (for/against/abstain) |
| POST | `/api/assembly/proposals/{id}/execute` | Ejecutar propuesta aprobada |
| GET | `/api/assembly/proposals/{id}/report` | Informe de votacion |
| GET | `/api/assembly/config` | Configuracion de quorum |
| PUT | `/api/assembly/config/{proposalType}` | Actualizar config |
| GET | `/api/assembly/frequency-config` | Config de frecuencia |
| PUT | `/api/assembly/frequency-config` | Actualizar frecuencia |
| GET | `/api/assembly/notifications` | Notificaciones del usuario |
| PUT | `/api/assembly/notifications/{id}/read` | Marcar como leida |
| GET | `/api/assembly/proposal-types` | Tipos permitidos por scope |
| GET | `/api/assembly/board` | Junta directiva del nodo |
| GET | `/api/assembly/voting-members` | Miembros con derecho a voto |

### Asambleas y Juntas de Organizacion (`internal/api/scoped_assembly.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/organization/{id}/assembly/sessions` | Listar sesiones de asamblea |
| POST | `/api/organization/{id}/assembly/sessions` | Crear sesion de asamblea |
| GET | `/api/organization/{id}/assembly/proposals` | Listar propuestas de asamblea |
| POST | `/api/organization/{id}/assembly/proposals` | Crear propuesta de asamblea |
| POST | `/api/organization/{id}/assembly/proposals/{id}/open-voting` | Abrir votacion |
| POST | `/api/organization/{id}/assembly/proposals/{id}/vote` | Votar |
| POST | `/api/organization/{id}/assembly/proposals/{id}/execute` | Ejecutar |
| GET | `/api/organization/{id}/assembly/config` | Config de asamblea |
| PUT | `/api/organization/{id}/assembly/config` | Actualizar config |
| GET | `/api/organization/{id}/assembly/proposal-types` | Tipos permitidos |
| GET | `/api/organization/{id}/assembly/reports` | Reportes |
| PUT | `/api/organization/{id}/assembly/sessions/{id}/minutes` | Actualizar minutas |
| GET/POST | `/api/organization/{id}/assembly/sessions/{id}/attendance` | Asistencia |
| POST | `/api/organization/{id}/assembly/sessions/{id}/close` | Cerrar sesion |

### Juntas Directivas de Organizacion (`internal/api/scoped_assembly.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/organization/{id}/board/sessions` | Listar sesiones de junta directiva |
| POST | `/api/organization/{id}/board/sessions` | Crear sesion de junta |
| GET | `/api/organization/{id}/board/proposals` | Listar propuestas de junta |
| POST | `/api/organization/{id}/board/proposals` | Crear propuesta de junta |
| POST | `/api/organization/{id}/board/proposals/{id}/open-voting` | Abrir votacion de junta |
| POST | `/api/organization/{id}/board/proposals/{id}/vote` | Votar en junta |
| POST | `/api/organization/{id}/board/proposals/{id}/execute` | Ejecutar decision de junta |
| GET | `/api/organization/{id}/board/config` | Config de junta |
| GET | `/api/organization/{id}/board/proposal-types` | Tipos: board_operational, board_financial, board_appointment |

### Asambleas de Departamento (`internal/api/scoped_assembly.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/department/{id}/assembly/sessions` | Listar sesiones |
| POST | `/api/department/{id}/assembly/sessions` | Crear sesion |
| GET | `/api/department/{id}/assembly/proposals` | Listar propuestas |
| POST | `/api/department/{id}/assembly/proposals` | Crear propuesta |
| POST | `/api/department/{id}/assembly/proposals/{id}/vote` | Votar |
| POST | `/api/department/{id}/assembly/proposals/{id}/execute` | Ejecutar |

### Servicios de Organizaciones (`internal/api/services_handler.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/organization/{id}/services` | Listar servicios de la organizacion |
| POST | `/api/organization/{id}/services` | Crear servicio |
| PUT | `/api/organization/{id}/services/{serviceId}` | Actualizar servicio |
| DELETE | `/api/organization/{id}/services/{serviceId}` | Eliminar servicio |
| POST | `/api/organization/{id}/services/{serviceId}/subscribe` | Suscribirse a servicio |
| POST | `/api/organization/{id}/services/{serviceId}/unsubscribe` | Cancelar suscripcion |
| GET | `/api/my-services` | Mis servicios suscritos |

### Gobernanza (`internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/public/governance` | Reglas de gobernanza publicas (sin auth) |
| GET | `/api/governance/rules` | Listar todas las reglas |
| POST | `/api/governance/rules` | Crear regla (permiso governance.manage) |
| PUT | `/api/governance/rules/{id}` | Actualizar regla |
| DELETE | `/api/governance/rules/{id}` | Eliminar regla |

### Impuestos (`internal/api/tax.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/tax/config` | Configuracion de impuestos del nodo |
| PUT | `/api/tax/config` | Actualizar configuracion |
| GET | `/api/tax/distributions` | Distribuciones aprobadas |

### Notificaciones (`internal/api/notifications.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/notifications` | Notificaciones del usuario |
| PUT | `/api/notifications/{id}/read` | Marcar como leida |
| PUT | `/api/notifications/read-all` | Marcar todas como leidas |
| GET | `/api/notifications/preferences` | Preferencias del usuario |
| PUT | `/api/notifications/preferences` | Actualizar preferencias |
| GET | `/api/notifications/gateways` | Pasarelas configuradas |
| PUT | `/api/notifications/gateways/{id}` | Configurar pasarela |
| POST | `/api/notifications/test` | Enviar notificacion de prueba |
| GET | `/api/notifications/vapid-public-key` | Clave publica VAPID para WebPush |

### Configuracion del Nodo (`internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/node/settings` | Configuracion del nodo |
| PUT | `/api/node/settings` | Actualizar configuracion |
| GET | `/api/member-levels` | Niveles de miembro |
| POST | `/api/member-levels` | Crear nivel |
| PUT | `/api/member-levels/{id}` | Actualizar nivel |
| GET | `/api/organization-levels` | Niveles de organizacion |
| POST | `/api/organization-levels` | Crear nivel de org |
| PUT | `/api/organization-levels/{id}` | Actualizar nivel de org |

### Fondo Comunitario (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/fund` | Estado del fondo comunitario |
| GET | `/api/fund/distributions` | Distribuciones del fondo |

### Backups y YugabyteDB (`internal/api/backups.go`, `internal/api/yugabyte_nodes.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/backups` | Lista de backups |
| POST | `/api/backups` | Crear backup |
| GET | `/api/backups/{id}/download` | Descargar backup |
| DELETE | `/api/backups/{id}` | Eliminar backup |
| GET | `/api/yugabyte/nodes` | Nodos YugabyteDB |
| POST | `/api/yugabyte/nodes` | Agregar nodo |

### Conflictos de Fusion (`internal/api/merge_conflicts.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/merge-conflicts` | Lista de conflictos |
| POST | `/api/merge-conflicts/{id}/resolve` | Resolver conflicto |

### Propuestas Publicas (`internal/api/public_proposals.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/public/proposals` | Propuestas publicas (sin auth) |
| POST | `/api/public/proposals` | Crear propuesta publica (sin auth) |
| POST | `/api/public/proposals/{id}/vote` | Votar propuesta publica (sin auth) |

### Calculadora (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/calculator/params` | Parametros de calculadora |
| POST | `/api/calculator/params` | Crear parametro (permiso config.manage) |
| PUT | `/api/calculator/params/{id}` | Actualizar parametro |
| DELETE | `/api/calculator/params/{id}` | Eliminar parametro |

### Federacion (`internal/api/federation.go`)

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/federation/config` | - | Configuracion global de federacion |
| PUT | `/api/federation/config` | `federation.change_config` | Actualiza config |
| GET | `/api/federation/bilateral` | - | Lista limites bilaterales |
| GET | `/api/federation/bilateral/{remoteNode}` | - | Detalle de limite bilateral |
| POST | `/api/federation/bilateral/propose` | `federation.set_limits` | Propone limite bilateral |
| POST | `/api/federation/bilateral/{remoteNode}/confirm` | `federation.set_limits` | Confirma limite bilateral |
| GET | `/api/federation/bilateral/{remoteNode}/history` | - | Historial de cambios |
| GET | `/api/federation/parity/{remoteNode}` | - | Reporte de paridad con nodo |
| GET | `/api/federation/parity` | - | Lista reportes de paridad |
| GET | `/api/federation/warnings` | - | Advertencias de limites |
| GET | `/api/federation/nodes` | - | Nodos conocidos |
| GET | `/api/federation/balance/{remoteNode}` | - | Balance con nodo remoto |
| GET | `/api/federation/volume` | - | Reporte de volumen |
| GET | `/api/federation/peers` | - | Lista peers registrados |
| POST | `/api/federation/peers` | `federation.change_config` | Registra peer |
| DELETE | `/api/federation/peers/{peerDomain}` | `federation.change_config` | Elimina peer |
| GET | `/api/federation/products/pending` | - | Productos federados pendientes de aprobacion |
| GET | `/api/federation/products/all` | - | Historial completo de propuestas federadas |
| POST | `/api/federation/products/{id}/approve` | `products.manage` | Aprueba producto federado |
| POST | `/api/federation/products/{id}/reject` | `products.manage` | Rechaza producto federado |

### Organizaciones (`internal/api/organization.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/organizations` | Lista organizaciones |
| POST | `/api/organizations` | Crea organizacion (requiere aprobacion) |
| POST | `/api/organizations/{id}/approve` | Aprueba organizacion |
| POST | `/api/organizations/{id}/budget/increase` | Aumenta presupuesto anual |
| POST | `/api/organizations/{id}/multisig/proposal` | Crea propuesta multi-firma |
| POST | `/api/organizations/multisig/{id}/sign` | Firma propuesta multi-firma |

### Pagos (`internal/api/payments.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/payments/qr/generate` | Genera codigo QR de pago |
| POST | `/api/payments/qr/parse` | Parsea y procesa QR |
| POST | `/api/payments/nfc/lookup` | Busca tarjeta NFC |
| POST | `/api/payments/nfc/assign` | Asigna tarjeta NFC a usuario |
| POST | `/api/payments/manual` | Pago manual entre usuarios |

### Comercio Externo y Tienda (`internal/api/external.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/external/fc` | Factor de conversion actual |
| POST | `/api/external/fc/calculate` | Calcula FC |
| POST | `/api/external/fc/store` | Almacena FC (permiso external.store_fc) |
| GET | `/api/external/operations` | Lista operaciones externas |
| POST | `/api/external/operations` | Crea operacion (import/export) |
| GET | `/api/external/operations/{id}` | Detalle de operacion |
| POST | `/api/external/operations/{id}/approve` | Aprueba operacion |
| POST | `/api/external/operations/{id}/reject` | Rechaza operacion |
| GET | `/api/store/items` | Items de la tienda personal |
| POST | `/api/store/items` | Crea item del catalogo (simple) |
| GET | `/api/store/items/{id}` | Detalle de item |
| GET | `/api/store/all` | Todos los items de todas las tiendas del nodo |
| PUT | `/api/store/items/{id}/stock` | Actualiza stock (permiso store.update_stock) |
| PUT | `/api/store/items/{id}/price` | Actualiza precio (permiso store.update_price) |
| DELETE | `/api/store/items/{id}` | Desactiva item (permiso store.deactivate_item) |
| POST | `/api/store/purchase` | Compra item |
| POST | `/api/store/composite` | Crea producto compuesto (precio automatico) |
| GET | `/api/store/composite/{id}/composition` | Ver composicion de un compuesto |
| GET | `/api/products/components` | Lista componentes disponibles (con filtros ?category= y ?search=) |

### Recuperacion de Cuenta (`internal/api/recovery.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/recovery/config` | Configuracion de recuperacion del nodo |
| PUT | `/api/recovery/config` | Actualiza configuracion (min 2 aprobaciones) |
| POST | `/api/recovery/request` | Crea solicitud de recuperacion |
| GET | `/api/recovery/requests` | Lista solicitudes (con filtro status) |
| GET | `/api/recovery/requests/{id}` | Detalle de solicitud |
| POST | `/api/recovery/requests/{id}/approve` | Aprueba solicitud (acumula firmas) |
| POST | `/api/recovery/requests/{id}/reject` | Rechaza solicitud |
| POST | `/api/recovery/requests/{id}/complete` | Completa recuperacion (reemplaza passkeys) |
| GET | `/api/recovery/requests/{id}/approvals` | Lista firmas de aprobacion |
| POST | `/api/recovery/invitation` | Genera codigo de invitacion |
| POST | `/api/recovery/invitation/validate` | Valida codigo de invitacion |

### Setup / Inicializacion (`internal/api/setup.go`)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/setup/status` | No | Verifica si el nodo esta inicializado |
| POST | `/api/setup/init` | No | Inicializa nodo (crea admin, genera claves) |

### Departamentos (`internal/api/departments.go`)

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/departments` | - | Lista departamentos |
| POST | `/api/departments` | `dept.manage` | Crea departamento |
| GET | `/api/departments/{id}` | - | Detalle de departamento |
| PUT | `/api/departments/{id}` | `dept.manage` | Actualiza departamento |
| DELETE | `/api/departments/{id}` | `dept.manage` | Elimina departamento |
| GET | `/api/departments/{id}/roles` | - | Lista roles del departamento |
| POST | `/api/departments/{id}/roles` | `dept.manage` | Crea rol |
| PUT | `/api/roles/{id}` | `dept.manage` | Actualiza rol |
| DELETE | `/api/roles/{id}` | `dept.manage` | Elimina rol |
| GET | `/api/roles/{id}/permissions` | - | Lista permisos del rol |
| PUT | `/api/roles/{id}/permissions` | `dept.manage` | Actualiza permisos del rol |
| GET | `/api/departments/{id}/members` | - | Lista miembros |
| POST | `/api/departments/{id}/members` | `dept.assign_members` | Agrega miembro |
| DELETE | `/api/departments/{id}/members/{user_id}` | `dept.assign_members` | Remueve miembro |
| GET | `/api/permissions` | - | Lista todos los permisos |
| GET | `/api/permissions/categories` | - | Lista categorias de permisos |
| GET | `/api/users/me/permissions` | - | Lista permisos del usuario actual |

### NFC Terminales (`internal/api/nfc_terminal.go`)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/nfc/terminal/register` | JWT + `nfc.register_terminal` | Registrar terminal |
| POST | `/api/nfc/terminal/complete-registration` | Token registro | Completa registro mutual |
| POST | `/api/nfc/terminal/auth` | Terminal | Autenticacion terminal |
| POST | `/api/nfc/terminal/heartbeat` | Terminal | Heartbeat |
| POST | `/api/nfc/terminal/payment` | Terminal | Pago individual (cifrado) |
| POST | `/api/nfc/terminal/payment/community` | Terminal | Pago comunitario (cifrado) |
| GET | `/api/nfc/terminals` | JWT | Lista terminales |
| DELETE | `/api/nfc/terminal/{id}` | JWT + `nfc.deactivate_terminal` | Desactivar |
| POST | `/api/nfc/cards/issue` | JWT + `nfc.issue_card` | Emitir tarjeta |
| PUT | `/api/nfc/cards/pin` | JWT | Cambiar PIN |
| PUT | `/api/nfc/cards/{uid}/pin/reset` | JWT + `nfc.reset_pin` | Resetear PIN |
| GET | `/api/nfc/transactions` | JWT | Lista transacciones NFC |

### Auditoria (`internal/api/handler.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/audit` | Entradas de auditoria (con filtros) |

### Admision (`internal/api/handler.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/accounts/pending` | Lista solicitudes de admision pendientes |
| POST | `/api/accounts/admission/{id}/approve` | Aprueba admision |
| POST | `/api/accounts/admission/{id}/reject` | Rechaza admision |

### Sitio Web Publico (`internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/public/settings` | Configuracion publica del nodo |
| GET | `/api/public/pages` | Paginas del sitio publico |

## Formato de Respuesta

### Exito
```json
{ "data": ... }
```

### Error
```json
{ "error": "mensaje descriptivo" }
```

### Codigos HTTP
- `200` OK
- `201` Creado
- `400` Error de validacion
- `401` No autenticado
- `403` No autorizado (sin permiso)
- `404` No encontrado
- `409` Conflicto (ej: nodo ya inicializado)
- `500` Error interno
