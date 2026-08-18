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
| `005_terminal_chip_binding.sql` | Binding de chip ID de terminal |
| `006_node_config_and_federation_keys.sql` | Configuracion del nodo, claves de federacion |
| `007_tax_board_votes.sql` | Votos de junta de impuestos |
| `008_currency_app_config.sql` | Configuracion de moneda y app |
| `009_super_admin.sql` | Super admin |
| `010_calculator_parameters.sql` | Parametros de calculadora energetica |
| `011_default_levels_and_fund.sql` | Niveles por defecto y fondo comunitario |
| `012_organization_levels.sql` | Niveles de organizacion |
| `013_public_website.sql` | Sitio web publico |
| `014_governance.sql` | Gobernanza (asamblea, juntas) |
| `015_menu_styles.sql` | Estilos de menu |
| `016_dynamic_admission_form.sql` | Formulario dinamico de admision |
| `017_footer_uploads.sql` | Subidas de footer |
| `018_feria_seed_products.sql` | Productos seed (feria) + badge, image_url |
| `019_product_subcategory.sql` | Subcategoria de productos + is_hidden |
| `020_theme_colors.sql` | Colores del tema |
| `021_header_customization.sql` | Personalizacion del header |
| `022_product_code.sql` | Codigo de producto |
| `023_store_items_and_fixes.sql` | Items de tienda comunitaria |
| `024-027` | Dedup y reinsert de productos |
| `028-036` | Fixes de imagenes y productos basicos |
| `037_full_community_catalog.sql` | Catalogo comunitario completo |
| `038_energy_realigned_catalog.sql` | Catalogo realineado con valores energeticos internacionales |
| `039_store_extras_and_pagination.sql` | Tienda: unidad, cantidad por paquete, costos adicionales, paginacion |
| `040_split_bundles_into_individual_products.sql` | Division de bundles en productos individuales |
| `041_artisanal_products_by_material_weight.sql` | Productos artesanales por kg de material + trabajo por hora |
| `042_composite_products_system.sql` | Sistema de productos compuestos (product_compositions) |
| `043_product_federation.sql` | Federacion de productos entre nodos (product_federation_proposals) |
| `044_store_items_hierarchy.sql` | Jerarquia de 3 niveles en store_items (parent_category, subcategory) |
| `045_split_grouped_products.sql` | Separacion de productos agrupados en items individuales (group_id, is_group) |

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
- **`node_federation_keys`**: Claves publicas de nodos pares (peers)
- **`product_federation_proposals`**: Productos propuestos por otros nodos (pending/approved/rejected)

### Productos y Precios
- **`products`**: Catalogo con energia directa, humana, insumos, amortizacion
  - Campos: name, parent_category, category, subcategory, unit, origin, price_per_unit
  - Campos energeticos: energy_direct, energy_human, energy_inputs, energy_amortization
  - Campos de estado: is_approved, is_hidden, is_system, is_composite
  - Campos de agrupacion: is_group (contenedor de items), group_id (referencia al padre)
  - Campos de federacion: source_node, source_product_id
  - Campos de tienda: badge, image_url, product_code, quantity_per_unit
- **`product_compositions`**: Composicion de productos compuestos (componentes y cantidades)
- **`product_price_history`**: Historial de cambios de precio
- **`product_producers`**: Productores asociados a productos
- **`energy_tariff`**: Tarifas energeticas por categoria
- **`conversion_factor`**: Factor de conversion (FC) interno/externo

### Tienda Comunitaria
- **`store_items`**: Items en tienda personal de cada usuario
  - Campos: product_id, product_name, description, origin
  - Campos de jerarquia: parent_category, category, subcategory (3 niveles)
  - Campos de precio: price_trueque, base_price, extra_costs, final_price
  - Campos de stock: stock, is_active
  - Campos de unidad: unit, quantity_per_unit
  - Campos de compuesto: is_composite, composite_description, extra_description
  - Campos de auditoria: owner_id, node_domain, created_at, updated_at
- **`store_purchases`**: Compras realizadas en tienda

### Comercio Externo
- **`external_bridge_operations`**: Operaciones de import/export
- **`external_bridge`**: Tabla legacy

### Pagos
- Tablas de pagos usan `transactions` y `ledger_entries`

### Asamblea y Auditoria
- **`assembly_sessions`**: Sesiones de asamblea
- **`assembly_decisions`**: Decisiones con multi-firma
- **`assembly_votes`**: Votos de miembros en decisiones
- **`assembly_config`**: Configuracion de aprobacion por tipo de propuesta
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

### Sitio Web Publico
- **`public_pages`**: Paginas del sitio web publico del nodo
- **`public_settings`**: Configuracion del sitio publico

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
users 1--* store_items (as owner)
transactions 1--* ledger_entries
transactions 1--* multi_sig_approvals
assembly_sessions 1--* assembly_decisions
assembly_decisions 1--* assembly_votes
recovery_requests 1--* recovery_approvals
member_groups 1--* member_group_members
products 1--* product_producers
products 1--* product_price_history
products 1--* product_compositions (as component_product_id)
store_items 1--* product_compositions (as product_id)
product_federation_proposals --> products (on approval)
```
