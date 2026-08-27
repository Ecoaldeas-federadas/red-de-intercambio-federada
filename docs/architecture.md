# Arquitectura del Sistema

## Vision General

El sistema de credito mutuo federado es una red descentralizada de nodos independientes que operan sobre una base de datos compartida (YugabyteDB/PostgreSQL). Cada nodo representa una comunidad local con su propia asamblea, miembros y reglas. Los nodos se federan via mTLS para permitir comercio inter-nodos con limites bilaterales configurables.

## Componentes Principales

### 1. Nodo (Node)
- **Punto de entrada**: `cmd/node/main.go`
- **Servidor HTTP**: Chi router con middleware (CORS, auth JWT, logger, recoverer)
- **Configuracion**: `config.yaml` define nombre del nodo, dominio, puerto, BD, origenes CORS

### 2. Base de Datos
- **YugabyteDB / PostgreSQL**: Compatible con ambos
- **Migraciones**: `internal/db/migrations/` (71 migraciones, 001-071)
- **Pool de conexiones**: `pgx/v5`
- **Backups**: `internal/api/backups.go` — export/import `.sql`
- **Nodos YugabyteDB**: `internal/api/yugabyte_nodes.go` — gestion de cluster

### 3. Ledger de Doble Entrada
- **Archivo**: `internal/ledger/`
- **Hash chain**: Cada transaccion encadena el hash de la anterior
- **Entradas**: credit/debit con categoria (user_balance, node_bridge, node_bridge_global, node_bridge_bilateral, fund, external_bridge)
- **Pool type**: Cada entrada cross-node tiene pool_type 'global' o 'bilateral'
- **Inmutabilidad**: Las entradas no se modifican, solo se crean nuevas

### 4. Criptografia
- **Archivo**: `internal/crypto/`
- **Passkeys**: WebAuthn/FIDO2 para autenticacion sin contrasenas
- **Ed25519**: Claves asimetricas para firma de transacciones
- **Encriptacion**: Claves privadas encriptadas con passphrase del usuario (AES-256-GCM)
- **NFC Terminal Crypto**: `internal/crypto/terminal_crypto.go` — Ed25519, ECDH Curve25519, AES-256-GCM para terminales ESP32

### 5. API REST
- **Archivo**: `internal/api/` (29 handlers)
- **Router**: Chi v5 con middleware
- **Autenticacion**: JWT (Bearer token, 24h de validez)
- **Handlers**: auth, setup, federation, organization, payments, external, recovery, departments, nfc_terminal, assembly, scoped_assembly, services_handler, subscription_scheduler, notifications, gateways, notification_scheduler, system, tax, handlers, demo_setup, backups, yugabyte_nodes, documents, merge_conflicts, my_membership, public_proposals, vapid, vapid_crypto, routes
- **Permisos**: Middleware `RequirePermission` verifica permisos por rol de departamento + permisos directos del usuario
- **WebPush**: VAPID (ES256 JWT) + encriptacion aes128gcm (RFC 8291)
- **HTML estatico**: Generacion de archivos HTML en disco para crawlers y sitemap

### 6. Federacion
- **Archivo**: `internal/federation/`
- **Transporte**: mTLS (mutual TLS) con certificados propios
- **Mensajes**: Inbox para mensajes entre nodos, confirmaciones, limites
- **Piscina global multilateral**: Saldo compartido entre todos los nodos (node_bridge_global)
- **Piscinas bilaterales**: Saldo entre dos nodos especificos (node_bridge_bilateral)
- **Integridad distribuida**: Firma dual + hash encadenado + reconciliacion (cross_node_tx_chain)
- **Niveles de nodo**: Nodo Nuevo (1), Nodo Aceptado (2), Nodo Pleno (3) con padrino
- **Verificacion de 4 opciones**: Para emparejamiento POS y federation pairing
- **Reconciliacion**: Al reconectar, compara hashes y sincroniza divergencias

### 7. Frontend PWA
- **Archivo**: `web/`
- **Stack**: React 18, TypeScript, TailwindCSS, Vite
- **PWA**: Manifest, service worker, offline cache
- **32 paginas**: Setup, Login, Dashboard, Transfer, Wallet, History, MyServices, Payments, NFCTerminals, Products, Calculator, CalculatorParams, Store, FederationPeers, FederationLimits, Parity, MergeConflicts, Organizations, OrganizationDetail, Governance, Assembly, Audit, ExternalBridge, Admission, Recovery, Departments, DepartmentDetail, NodeSettings, NotificationSettings, Notifications, Profile, CommunityFund, WebsiteAdmin
- **12 componentes**: Layout, EntitySelector, PublicSite, ScopedAssembly, SessionExpiredModal, DynamicAdmissionForm, InlineEditable, LivePageEditor, PublicBlocks, PublicFederationPage, PublicGovernancePage, ThemeCustomizer
- **Hooks**: `useAuth`, `usePermissions`, `useConfig`
- **Setup Wizard**: Pagina de configuracion inicial de 4 pasos para nuevo nodo (auto-genera claves, crea admin, departamentos, permisos)

### 8. Gobernanza y Asambleas
- **Archivo**: `internal/api/assembly.go` (asamblea del nodo), `internal/api/scoped_assembly.go` (asambleas de org/depto + juntas directivas)
- **Asamblea del nodo**: sesiones, propuestas, votaciones, quorum, minutas, convocatoria automatica
- **Asambleas scoped**: organizacion y departamento, con tipos de propuesta separados
- **Juntas directivas**: `meeting_type = 'board'` — reuniones separadas de la asamblea
- **Organizaciones de la Asamblea**: `is_assembly_owned = true` — decisiones se votan en Asamblea General
- **Reglas de gobernanza**: `governance_rules` — Ley de la Aldea, visible en pagina publica

### 9. Servicios de Organizaciones
- **Archivo**: `internal/accounts/services.go`, `internal/api/services_handler.go`, `internal/api/subscription_scheduler.go`
- **Tipos**: subscription (cobra), benefit (paga), one_time (cobro unico)
- **Frecuencia**: mensual, trimestral, anual
- **Obligatorios o voluntarios**
- **Scheduler**: cobra/paga automaticamente segun frecuencia

### 10. Notificaciones
- **Archivo**: `internal/api/notifications.go`, `internal/api/gateways.go`, `internal/api/notification_scheduler.go`
- **Canales**: Email, Telegram, Matrix, WebPush, SMS, WhatsApp, webhook
- **Preferencias por usuario**: horas silenciosas, modo digest
- **Scheduler**: notificaciones automaticas de votaciones, asambleas, cobros

### 11. Auditoria
- **Archivo**: `internal/audit/logger.go`
- **Tabla**: `audit_log`
- **Hash chain**: verificacion de integridad del ledger

### 12. Impuestos
- **Archivo**: `internal/taxes/calculator.go`, `internal/api/tax.go`
- **Resolucion**: users.tax_rate > member_levels.tax_rate > organization_levels.tax_rate > tax_config
- **Destino**: cuenta de la Asamblea

## Flujo de Datos

### Instalacion de Nuevo Nodo (Setup Wizard)
1. Arrancar el nodo — migraciones y claves NFC se generan automaticamente
2. Frontend detecta nodo no inicializado (`GET /api/setup/status`) y redirige a `/setup`
3. Wizard de 4 pasos: nombre/dominio del nodo, usuario admin, contrasena, revision
4. `POST /api/setup/init` crea: usuario admin, claves Ed25519, departamento Administracion, rol con todos los permisos, claves NFC
5. JWT retornado para login inmediato

### Registro de Usuario
1. Usuario obtiene codigo de invitacion de un miembro existente
2. Frontend llama a `/api/auth/register` -> BeginRegistration (WebAuthn)
3. Usuario registra Passkey en su dispositivo
4. Frontend llama a `/api/auth/passkey/finish` -> VerifyRegistration
5. Cuenta queda pendiente de admision (approbacion por asamblea o regla configurada)
6. Alternativamente, login por contrasena via `/api/auth/login/password` (bcrypt)

### Transaccion Interna
1. Usuario autenticado envia transferencia via `/api/transactions`
2. Sistema valida limites (credito/debito, por transaccion, diario, mensual)
3. Sistema calcula impuesto segun tax_rate del usuario
4. Ledger crea entradas: debit del remitente, credit del receptor, debit para impuesto
5. Hash chain: current_hash = SHA256(prev_hash + tx_data)
6. Si requiere multi-firma, se acumulan firmas hasta alcanzar required_signatures

### Transaccion Federada
1. Nodo local determina el pool: acuerdo bilateral activo → bilateral; si no → global
2. Nodo local valida limites (bilaterales o globales segun el nivel del nodo)
3. Nodo local crea la transaccion y la firma con su clave Ed25519 (firma del emisor)
4. Mensaje enviado via mTLS al nodo remoto
5. Nodo remoto verifica la firma del emisor, firma tambien (firma dual)
6. Ambos nodos almacenan la transaccion dual-firmada en cross_node_tx_chain
7. Hash encadenado: tx_hash = SHA256(prev_hash + tx_data + ambas_firmas)
8. Balance actualizado en ambos nodos (global o bilateral segun el pool)
9. Al reconectar, reconcilian hashes y sincronizan divergencias

### Recuperacion de Cuenta
1. Usuario pierde acceso a su dispositivo/Passkey
2. Cualquier persona puede solicitar recuperacion via `/api/recovery/request`
3. Segun configuracion del nodo (multi_sig, council, assembly, department)
4. Se acumulan aprobaciones hasta alcanzar required_approvals (minimo 2)
5. Nadie solo puede restaurar acceso
6. Al completarse, se reemplazan Passkeys y clave publica del usuario

## Dependencias Externas

| Dependencia | Version | Proposito |
|-------------|---------|-----------|
| chi/v5 | v5.x | Router HTTP |
| pgx/v5 | v5.x | Driver PostgreSQL |
| golang-jwt/v5 | v5.x | Tokens JWT |
| google/uuid | v1.x | Identificadores UUID |
| fxamacker/cbor | v2.x | Decodificacion CBOR (WebAuthn) |
| crypto/ed25519 | stdlib | Firmas digitales |
| react | 18.x | Frontend UI |
| vite | 5.x | Build tool frontend |
| tailwindcss | 3.x | Estilos CSS |
| lucide-react | latest | Iconos |
| bcrypt | v1.x | Hash de contrasenas (login por contrasena) |
