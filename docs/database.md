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
| `046_decimal_prices.sql` | Precios decimales (NUMERIC 12,2) |
| `047_symmetric_limits.sql` | Limites simetricos (positivo = negativo) + canasta basica 500 TQ |
| `048_governance_rules.sql` | Tabla governance_rules + seed Ley de la Aldea |
| `049_governance_assembly.sql` | Estructuras de asamblea: sesiones, decisiones, votos |
| `050_voting_deadline.sql` | Plazos de votacion |
| `051_assembly_attendance.sql` | Asistencia y doble validacion presencial |
| `052_quorum_config.sql` | Quorum configurable, gracia, reprogramacion |
| `053_proposal_review_flow.sql` | Flujo: proposed -> pending -> executed |
| `054_scoped_assemblies.sql` | Asambleas de organizacion y departamento (tablas *_scoped) |
| `055_assembly_convocation.sql` | Convocatoria automatica, frecuencia, notificaciones |
| `056_assembly_advance_tax.sql` | Tiempos minimos, cuenta predefinida de impuestos |
| `057_department_parent.sql` | Departamentos con organizacion padre |
| `058_attendance_window.sql` | Ventana de anticipacion para asistencia |
| `059_notifications.sql` | Modulo de notificaciones (notifications, channels, gateways, preferences) |
| `060_fix_member_levels_domain.sql` | Fix member_levels para usuarios de otro node_domain |
| `060_quiet_hours.sql` | Horas silenciosas por usuario |
| `061_user_metadata.sql` | Columna metadata en users (digest_mode, last_digest_sent) |
| `062_fix_governance_rules_dynamic.sql` | Corregir reglas con terminologia real |
| `062_national_id_and_merge_conflicts.sql` | ID nacional + tabla de conflictos de fusion |
| `063_governance_rule_type.sql` | Campo rule_type en governance_rules |
| `063_passport_and_merge_fix.sql` | Pasaporte + fix conflictos |
| `064_new_governance_rules_community.sql` | 24 reglas de comunidad intencional |
| `064_user_documents_and_countries.sql` | Paises (ISO 3166-1) + tipos de documento + documentos de usuario |
| `065_public_proposals.sql` | Propuestas publicas para mejorar el sistema |
| `066_backup_system.sql` | Sistema de backups + nodos YugabyteDB |
| `067_replace_unsplash_urls.sql` | (vacia, mantiene secuencia) |
| `068_restore_unsplash_urls.sql` | Restaurar URLs de Unsplash en products |
| `069_organization_services.sql` | Servicios, suscripciones, is_assembly_owned |
| `070_board_meetings.sql` | Reuniones de junta directiva (meeting_type) |
| `071_governance_org_services_rules.sql` | 12 reglas publicas sobre organizaciones y servicios |
| `098_pos_tables.sql` | Tablas POS: pos_shifts (turnos con apertura/cierre, montos, ventas) |
| `140_classic_required_doc_type.sql` | Campo required_doc_type en nfc_cards (tipo de documento requerido para Classic) |
| `141_terminal_shift_pin.sql` | Campo shift_pin_hash en nfc_terminals (PIN del turno hasheado bcrypt) |
| `142_shift_transaction_indexes.sql` | Indices para pos_shifts.opened_at, closed_at y nfc_transactions.created_at |
| `143_pos_retention_config.sql` | Tabla pos_retention_config (retencion configurable, purga automatica) |
| `146_terminal_authorized_users.sql` | Tabla nfc_terminal_authorized_users (personas adicionales autorizadas por terminal) |
| `163_languages_table.sql` | Tabla `languages` (code, name, native_name, enabled, is_default) |
| `164_translations_table.sql` | Tabla `translations` (namespace, key, value por idioma) |
| `165_translation_permissions.sql` | Permisos `translations.manage`, `translations.edit`, `translations.delegate` |
| `166_node_config_language.sql` | Columna `default_language` en `node_config` |
| `167_user_preferences_language.sql` | Idioma en `user_preferences` |
| `168_translation_federation.sql` | Federacion de traducciones entre nodos |
| `169_content_translations.sql` | Tablas legacy de traducciones de contenido (paginas, settings, admision) |
| `170_english_content_translations.sql` | Backfill de traducciones inglesas legacy |
| `171_level_translations.sql` | Traducciones de niveles (member_levels, organization_levels) |
| `172_dynamic_data_translations.sql` | Traducciones legacy de productos, calculadora, gobernanza |
| `173_unified_content_translations.sql` | Capa unificada: `content_translation_sources`, `content_translations`, `content_translation_history`, `product_taxonomy_terms` + funcion `upsert_content_translation_source` con deteccion de cambios por `source_hash` |
| `174_translation_sources_extended.sql` | Backfill de fuentes extendidas: asambleas, propuestas publicas, notificaciones, departamentos, roles, servicios, tienda, perfiles de fe, prohibiciones, etiquetas de catalogo, reglas dietarias, horarios comerciales, drivers NFC |
| `175_content_translation_source_language.sql` | Correccion federada: `source_language` proviene de `node_config.default_language` del nodo propietario, no del traductor |
| `176_english_content_seed_translations.sql` | Backfill de traducciones inglesas reales del contenido seed (productos, calculadora, reglas, niveles, constantes federadas) |

## Tablas Principales

### Usuarios y Cuentas
- **`users`**: Cuentas individuales, organizaciones, instituciones publicas. Campos: node_domain, username, account_type, member_level_id, credit/debit_limit, public_key, encrypted_private_key, required_signatures, authorized_signers
- **`user_passkeys`**: Credenciales WebAuthn (credential_id, public_key, sign_count)
- **`user_credentials`**: Credenciales de contrasena (password_hash bcrypt) para login por contrasena
- **`nfc_cards`**: Tarjetas NFC vinculadas a usuarios (card_type, pin_hash, crypto_enabled, has_dynamic_certs para MIFARE Classic, required_doc_type para tipo de documento requerido en Classic — migracion 140)
- **`nfc_card_sectors`**: Sectores MIFARE Classic con claves A/B y certificados dinamicos (migracion 138)
- **`nfc_classic_pending`**: Pre-aprobaciones pendientes de confirmacion de lectura/escritura Classic (TTL 30s, migracion 138)
- **`nfc_terminals`**: Terminales NFC (terminal_id, merchant_user_id, organization_id, department_id, shift_pin_hash para PIN del turno — migracion 141)
- **`nfc_terminal_authorized_users`**: Personas adicionales autorizadas para usar un terminal (terminal_id, user_id, assigned_by — migracion 146)
- **`pos_shifts`**: Turnos de POS (terminal_id, user_id, status, opened_at, closed_at, opening_amount, closing_amount, total_sales, transactions_count — migracion 098)
- **`pos_retention_config`**: Configuracion de retencion (node_domain, retention_days, enabled, last_purge_at — migracion 143)
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
- **`ledger_entries`**: Entradas doble entrada (credit/debit, account_category, pool_type)
  - `pool_type`: 'global' (piscina global multilateral) o 'bilateral' (piscina bilateral)
  - `account_category`: user_balance, node_bridge, node_bridge_global, node_bridge_bilateral, fund, external_bridge
- **`cross_node_tx_chain`**: Cadena de transacciones cross-node con firma dual y hash encadenado (NUEVO)
- **`multi_sig_approvals`**: Propuestas multi-firma pendientes

### Admision y Membresia
- **`admission_requests`**: Solicitudes de admision de nuevos miembros
- **`membership_history`**: Historial de cambios de nivel/estado

### Federacion
- **`federation_global_config`**: Limites globales del nodo (fallback)
- **`bilateral_limits`**: Limites bilaterales entre nodos
- **`bilateral_limit_history`**: Historial de cambios de limites
- **`node_balance`**: Balance bilateral con cada nodo
- **`processed_messages`**: Idempotencia de mensajes federados
- **`certificates`**: Certificados mTLS
- **`node_federation_keys`**: Claves publicas de nodos pares (peers)
- **`product_federation_proposals`**: Productos propuestos por otros nodos (pending/approved/rejected)
- **`federation_node_levels`**: Niveles de nodo federado (configurables por votacion) (NUEVO)
- **`federation_node_membership`**: Membresia de cada nodo (nivel, metricas, padrino) (NUEVO)
- **`federation_sponsorships`**: Patrocinios (retencion de limite del padrino) (NUEVO)
- **`federation_pairing_requests`**: Solicitudes de federation pairing con verificacion de 4 opciones (NUEVO)

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
- **`assembly_sessions`**: Sesiones de asamblea del nodo
- **`assembly_decisions`**: Decisiones con multi-firma
- **`assembly_votes`**: Votos de miembros en decisiones
- **`assembly_config`**: Configuracion de aprobacion por tipo de propuesta
- **`assembly_attendance`**: Asistencia a sesiones presenciales
- **`assembly_quorum_config`**: Quorum configurable por tipo de asamblea
- **`assembly_frequency_config`**: Frecuencia y convocatoria automatica
- **`assembly_notifications`**: Notificaciones a miembros de asamblea
- **`assembly_proposal_types`**: Tipos de propuestas permitidos por scope

### Asambleas Scoped (org/depto + juntas directivas)
- **`assembly_sessions_scoped`**: Sesiones de asamblea de org/depto (con `meeting_type`: assembly o board)
- **`assembly_decisions_scoped`**: Decisiones propuestas en sesiones scoped
- **`assembly_votes_scoped`**: Votos en decisiones scoped
- **`assembly_attendance_scoped`**: Asistencia a sesiones scoped
- **`assembly_quorum_config_scoped`**: Quorum configurable por scope y meeting_type

### Gobernanza
- **`governance_rules`**: Reglas de gobernanza (Ley de la Aldea) con categoria, severidad, icono

### Servicios de Organizaciones
- **`organization_services`**: Servicios ofrecidos por organizaciones (subscription, benefit, one_time)
- **`organization_subscriptions`**: Suscripciones de miembros a servicios (active, auto, cancelled)
- **`organization_service_failures`**: Fallos de cobro registrados

### Notificaciones
- **`notifications`**: Notificaciones del usuario
- **`notification_channels`**: Canales de entrega (email, telegram, matrix, webpush, sms, whatsapp, webhook)
- **`notification_gateways`**: Configuracion de pasarelas por nodo
- **`notification_preferences`**: Preferencias de usuario por tipo y canal
- **`notification_quiet_hours`**: Horas silenciosas por usuario

### Documentos y Paises
- **`countries`**: Paises del mundo (ISO 3166-1)
- **`document_types`**: Tipos de documento de identidad
- **`user_documents`**: Documentos de identidad de usuarios

### Propuestas Publicas y Backups
- **`public_proposals`**: Propuestas publicas para mejorar el sistema (sin cuenta)
- **`backups`**: Configuracion de backups de BD
- **`yugabyte_nodes`**: Nodos YugabyteDB del cluster

### Conflictos de Fusion
- **`merge_conflicts`**: Conflictos cuando dos nodos se federan con usuarios duplicados

### Auditoria
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

### Internacionalizacion de Contenido Dinamico (Capa Unificada — migraciones 173-175)

Las tablas legacy 169-172 se conservan por compatibilidad. La capa unificada permite
que cualquier texto visible almacenado en la BD tenga una clave estable, traducciones
por idioma, deteccion de cambios e historial, sin modificar el texto original.

- **`content_translation_sources`**: Registro de fuentes traducibles.
  - Clave: `translation_key` = `entity_type:entity_id:field_name`
  - Campos: `node_domain`, `source_language` (del nodo propietario), `source_text`, `source_hash` (md5), `context` (JSONB), `is_active`
  - Unique: `(node_domain, entity_type, entity_id, field_name)`
- **`content_translations`**: Traducciones por idioma.
  - FK a `content_translation_sources` (ON DELETE CASCADE)
  - Campos: `language`, `value`, `source_hash` (para detectar traducciones stale), `translated_by` (FK users)
  - Unique: `(translation_key, language)`
- **`content_translation_history`**: Auditoria de cambios.
  - Campos: `old_value`, `new_value`, `source_hash`, `changed_by`, `changed_at`
- **`product_taxonomy_terms`**: Taxonomia estable de productos.
  - Permite que los filtros usen el valor base (`source_value`) mientras se muestra el label traducido
  - Levels: `parent`, `category`, `subcategory`
  - Unique: `(node_domain, level, parent_source_value, source_value)`
- **Funcion `upsert_content_translation_source`**: Inserta o actualiza una fuente.
  - Si el `source_text` cambia, `source_hash` cambia y las traducciones existentes quedan `stale`
  - El `source_language` se resuelve desde `node_config.default_language` del nodo propietario

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
users 1--* organization_services (as organization)
users 1--* organization_subscriptions (as member)
users 1--* notifications
users 1--* user_documents
users 1--* assembly_sessions_scoped (as scope_id for org)
departments 1--* assembly_sessions_scoped (as scope_id for dept)
transactions 1--* ledger_entries
transactions 1--* multi_sig_approvals
assembly_sessions 1--* assembly_decisions
assembly_decisions 1--* assembly_votes
assembly_sessions_scoped 1--* assembly_decisions_scoped
assembly_decisions_scoped 1--* assembly_votes_scoped
recovery_requests 1--* recovery_approvals
member_groups 1--* member_group_members
products 1--* product_producers
products 1--* product_price_history
products 1--* product_compositions (as component_product_id)
store_items 1--* product_compositions (as product_id)
product_federation_proposals --> products (on approval)
organization_services 1--* organization_subscriptions
governance_rules (independiente por node_domain)
```
