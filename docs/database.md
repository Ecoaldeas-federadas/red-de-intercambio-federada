# Base de Datos

## Motor
- YugabyteDB / PostgreSQL (compatible con ambos)
- Driver: `pgx/v5` con pool de conexiones

## Migraciones

| Archivo | Descripcion |
|---------|-------------|
| `001_initial_schema.sql` | Esquema completo: usuarios, passkeys, transacciones, ledger, federacion, productos, asamblea, auditoria |
| `002_seed_data.sql` | Datos iniciales: niveles de miembro, tarifas energeticas |
| `003_account_recovery.sql` | Recuperacion de cuenta, codigos de invitacion, registro de dispositivos |
| `004_nfc_terminals.sql` | Terminales NFC, tarjetas, sesiones, transacciones, departamentos, roles, permisos, credenciales de usuario |

## Tablas Principales

### Usuarios y Cuentas
- **`users`**: Cuentas individuales, organizaciones, instituciones publicas. Campos: node_domain, username, account_type, member_level_id, credit/debit_limit, public_key, encrypted_private_key, required_signatures, authorized_signers
- **`user_passkeys`**: Credenciales WebAuthn (credential_id, public_key, sign_count)
- **`user_credentials`**: Credenciales de contrasena (password_hash bcrypt) para login por contrasena
- **`nfc_cards`**: Tarjetas NFC vinculadas a usuarios (card_type, pin_hash, crypto_enabled)
- **`member_levels`**: Niveles de miembro con limites y permisos
- **`member_groups`**: Grupos de miembros (consejos, departamentos)
- **`member_group_members`**: Membresia de grupos
- **`departments`**: Departamentos del nodo (name, description, group_type, is_active)
- **`roles`**: Roles dentro de departamentos (name, description, is_active)
- **`department_members`**: Membresia de usuarios en departamentos con rol asignado
- **`permissions`**: Permisos granulares del sistema (name, description, category)
- **`role_permissions`**: Permisos asignados a roles
- **`user_permissions`**: Permisos directos asignados a usuarios (con expiracion opcional)

### Transacciones y Ledger
- **`transactions`**: Transacciones con hash chain, multi-firma, impuestos
- **`ledger_entries`**: Entradas doble entrada (credit/debit, account_category)
- **`multi_sig_approvals`**: Propuestas multi-firma pendientes

### Admision y Membresia
- **`admission_requests`**: Solicitudes de admision de nuevos miembros
- **`membership_history`**: Historial de cambios de nivel/estado

### Federacion
- **`federation_global_config`**: Limites globales del nodo
- **`bilateral_limits`**: Limites bilaterales entre nodos
- **`bilateral_limit_history`**: Historial de cambios de limites
- **`node_balance`**: Balance multilateral con cada nodo
- **`processed_messages`**: Idempotencia de mensajes federados
- **`certificates`**: Certificados mTLS

### Productos y Precios
- **`products`**: Catalogo con energia directa, humana, insumos, amortizacion
- **`product_price_history`**: Historial de cambios de precio
- **`product_producers`**: Productores asociados a productos
- **`energy_tariff`**: Tarifas energeticas por categoria
- **`conversion_factor`**: Factor de conversion (FC) interno/externo

### Comercio Externo
- **`external_bridge_operations`**: Operaciones de import/export
- **`external_bridge`**: Tabla legacy

### Pagos
- Tablas de pagos usan `transactions` y `ledger_entries`

### Asamblea y Auditoria
- **`assembly_sessions`**: Sesiones de asamblea
- **`assembly_decisions`**: Decisiones con multi-firma
- **`audit_log`**: Registro de auditoria

### Recuperacion
- **`recovery_config`**: Configuracion de recuperacion por nodo
- **`recovery_requests`**: Solicitudes de recuperacion
- **`recovery_approvals`**: Firmas de aprobacion
- **`invitation_codes`**: Codigos de invitacion hasheados
- **`device_registrations`**: Registro de dispositivos

### Aprobaciones
- **`approval_rules`**: Reglas de aprobacion configurables
- **`approval_signatures`**: Firmas de aprobacion

## Relaciones Clave

```
users 1--* user_passkeys
users 1--* nfc_cards
users 1--* transactions (sender/receiver)
users 1--* ledger_entries
users 1--* admission_requests (created_user)
users 1--* membership_history
users 1--* recovery_requests (target/requester)
users 1--* recovery_approvals (approver)
users 1--* device_registrations
users 1--* organizations (as signer)
transactions 1--* ledger_entries
transactions 1--* multi_sig_approvals
assembly_sessions 1--* assembly_decisions
recovery_requests 1--* recovery_approvals
member_groups 1--* member_group_members
products 1--* product_producers
products 1--* product_price_history
```
