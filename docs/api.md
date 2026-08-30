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
| GET | `/api/auth/passkey/list` | Lista passkeys del usuario |
| DELETE | `/api/auth/passkey/{id}` | Elimina un passkey |

### Transacciones (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/accounts/me` | Datos y balance del usuario |
| POST | `/api/transfer` | Crea transferencia (requiere `receiver_id`, `amount`) |
| GET | `/api/ledger/transactions` | Lista transacciones del usuario (con filtros) |
| GET | `/api/products` | Lista productos del catalogo (con paginacion limit/offset) |
| POST | `/api/products` | Crea producto (requiere aprobacion de asamblea) |
| POST | `/api/products/{id}/approve` | Aprueba producto (permiso products.manage) |
| GET | `/api/products/categories` | Lista jerarquia de 3 niveles (parent_category, category, subcategory) |
| POST | `/api/calculator/internal` | Calcula precio energetico interno |
| POST | `/api/calculator/external` | Calcula precio energetico externo |
| POST | `/api/calculator/labor` | Calcula precio de mano de obra |
| GET | `/api/calculator/tariff` | Obtiene tarifas del calculador |

### Dashboard y Profile (`internal/api/handlers.go`, `internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/auth/me` | Info del usuario autenticado (perfil, balance) |
| PUT | `/api/auth/me/contacts` | Actualizar contactos del usuario |
| GET | `/api/ledger/transactions` | Historial de transacciones del usuario |
| GET | `/api/my/organizations` | Organizaciones del usuario |
| GET | `/api/my/departments` | Departamentos del usuario |
| GET | `/api/my/assembly` | Asambleas del usuario |
| GET | `/api/countries` | Lista de paises (ISO 3166-1) |
| GET | `/api/document-types` | Tipos de documento de identidad |
| GET | `/api/auth/me/documents` | Listar documentos del usuario |
| POST | `/api/auth/me/documents` | Subir documento de identidad |

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
| GET | `/api/config` | Configuracion del nodo |
| PUT | `/api/config` | Actualizar configuracion |
| GET | `/api/member-levels` | Niveles de miembro |
| POST | `/api/member-levels` | Crear nivel |
| PUT | `/api/member-levels/{id}` | Actualizar nivel |
| GET | `/api/organization-levels` | Niveles de organizacion |
| POST | `/api/organization-levels` | Crear nivel de org |
| PUT | `/api/organization-levels/{id}` | Actualizar nivel de org |

### Fondo Comunitario (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/fund/balance` | Balance del fondo comunitario |

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

### Niveles de Nodo, Membresia y Padrinos (`internal/api/federation.go`, `internal/federation/node_levels.go`)

| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/federation/node-levels` | - | Lista los niveles de nodo federado |
| GET | `/api/federation/nodes/{domain}/membership` | - | Membresia de un nodo (nivel, fechas) |
| GET | `/api/federation/nodes/{domain}/check-upgrade` | - | Verifica si un nodo puede ascender de nivel |
| GET | `/api/federation/sponsorships` | - | Lista de padrinos y nodos apadrinados |

### Emparejamiento Federado (`internal/federation/pairing.go`)

| Metodo | Ruta | Body | Descripcion |
|--------|------|------|-------------|
| POST | `/api/federation/pair/initiate` | `requesting_domain`, `requesting_public_key`, `requesting_endpoint` | Inicia emparejamiento federado |
| GET | `/api/federation/pair/pending` | - | Lista emparejamientos pendientes |
| GET | `/api/federation/pair/request/{reqId}/options` | - | Devuelve 4 opciones de codigo + `message` |
| POST | `/api/federation/pair/request/{reqId}/confirm` | `selected_code`, `sponsor_domain` | Confirma emparejamiento con codigo seleccionado |

El emparejamiento usa **verificacion de 4 opciones**: el confirmador ve 4
codigos y debe elegir el correcto. Expira en 60 segundos.

### Endpoints mTLS de Federacion (reconciliacion y auditoria)

Estos endpoints se consumen entre nodos via mTLS (no requieren JWT):

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/federation/reconcile/compare` | Compara cadenas de transacciones inter-nodos |
| POST | `/federation/reconcile/chain` | Solicita la cadena de transacciones de un nodo |
| POST | `/federation/reconcile/import` | Importa transacciones faltantes durante reconciliacion |
| GET | `/federation/audit/chain` | Auditoria federada de la cadena de transacciones |

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

### NFC Terminal y tarjetas Classic (`internal/api/nfc_terminal.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/nfc/terminal/complete-registration` | Registro mutual terminal |
| POST | `/api/nfc/terminal/auth` | Autenticacion Ed25519 |
| POST | `/api/nfc/terminal/heartbeat` | Heartbeat |
| POST | `/api/nfc/terminal/payment` | Pago individual (cifrado) |
| POST | `/api/nfc/terminal/payment/community` | Pago comunitario (doble tarjeta) |
| POST | `/api/nfc/terminal/payment/multisig-sign` | Firma multi-sig |
| POST | `/api/nfc/terminal/classic/pre-auth` | Pre-autenticacion tarjeta Classic (cert dinamicos) |
| POST | `/api/nfc/terminal/classic/confirm` | Confirmar lectura/escritura tarjeta Classic |
| POST | `/api/nfc/cards/issue` | Emitir tarjeta (permiso: `nfc.issue_card`) |
| POST | `/api/nfc/cards/provision-classic` | Provisionar MIFARE Classic con cert dinamicos (permiso: `nfc.issue_card`) |
| PUT | `/api/nfc/cards/pin` | Cambiar PIN |
| PUT | `/api/nfc/cards/{uid}/pin/reset` | Resetear PIN (permiso: `nfc.reset_pin`) |

Ver `docs/tarjeta-classic-certificados.md` para detalles del flujo Classic.

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
| GET | `/api/nfc/terminal/pair/request/{reqId}/options` | JWT | Devuelve 4 opciones de codigo para verificacion de emparejamiento POS |
| POST | `/api/nfc/terminal/pair/request/{reqId}/approve` | JWT | Aprueba emparejamiento POS (acepta `selected_code` opcional) |

### Auditoria (`internal/api/handlers.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/audit` | Entradas de auditoria (con filtros) |

### Admision (`internal/api/handlers.go`, `internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/admission/apply` | Enviar solicitud de admision (publico) |
| GET | `/api/admission/requests` | Lista solicitudes de admision |
| GET | `/api/admission-requests` | Lista solicitudes de admision pendientes |
| POST | `/api/admission-requests/{id}/approve` | Aprueba admision |
| POST | `/api/admission-requests/{id}/reject` | Rechaza admision |

### Sitio Web Publico (`internal/api/system.go`)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/public/settings` | Configuracion publica del nodo |
| GET | `/api/public/pages` | Paginas del sitio publico |

### POS Web — Sesiones (3 niveles de auth)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/pos-web/request-session` | Solicitar sesion (navegador → dueno) |
| GET | `/api/pos-web/session-status` | Consultar estado de la solicitud |
| POST | `/api/pos-web/approve-session` | Aprobar sesion (dueno, elegir duracion 1h/5h/24h) |
| POST | `/api/pos-web/reject-session` | Rechazar sesion (dueno) |
| POST | `/api/pos-web/revoke-session` | Anular sesion activa (dueno) |
| GET | `/api/pos-web/sessions` | Listar sesiones del terminal (dueno) |
| POST | `/api/pos-web/cleanup-expired` | Limpiar sesiones expiradas (auto) |

### POS — Cargos QR

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/pos/charge` | Crear cargo QR (monto, descripcion) |
| GET | `/api/pos/charge/{id}/status` | Consultar estado del cargo (polling) |
| GET | `/api/pos/charge/{token}/info` | Info publica del cargo por token (sin auth) |
| POST | `/api/pos/charge/{id}/cancel` | Cancelar cargo |

### NFC Terminal — Flujo unificado (todos los tipos de tarjeta)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/nfc/terminal/classic/pre-auth` | Pre-autenticacion unificada (doc + PIN → card_type) |
| POST | `/api/nfc/terminal/classic/confirm` | Confirmar lectura/escritura Classic (cert dinamicos) |
| POST | `/api/nfc/cards/provision-classic` | Provisionar tarjeta MIFARE Classic (permiso: `nfc.issue_card`) |

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
