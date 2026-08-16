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
- **Migraciones**: `internal/db/migrations/` (001_initial_schema, 002_seed_data, 003_account_recovery, 004_nfc_terminals)
- **Pool de conexiones**: `pgx/v5`

### 3. Ledger de Doble Entrada
- **Archivo**: `internal/ledger/`
- **Hash chain**: Cada transaccion encadena el hash de la anterior
- **Entradas**: credit/debit con categoria (user_balance, tax, federation, external)
- **Inmutabilidad**: Las entradas no se modifican, solo se crean nuevas

### 4. Criptografia
- **Archivo**: `internal/crypto/`
- **Passkeys**: WebAuthn/FIDO2 para autenticacion sin contrasenas
- **Ed25519**: Claves asimetricas para firma de transacciones
- **Encriptacion**: Claves privadas encriptadas con passphrase del usuario (AES-256-GCM)
- **NFC Terminal Crypto**: `internal/crypto/terminal_crypto.go` — Ed25519, ECDH Curve25519, AES-256-GCM para terminales ESP32

### 5. API REST
- **Archivo**: `internal/api/`
- **Router**: Chi v5 con middleware
- **Autenticacion**: JWT (Bearer token, 24h de validez)
- **Handlers**: auth, setup, federation, organization, payments, external, recovery, departments, nfc_terminal
- **Permisos**: Middleware `RequirePermission` verifica permisos por rol de departamento + permisos directos del usuario

### 6. Federacion
- **Archivo**: `internal/federation/`
- **Transporte**: mTLS (mutual TLS) con certificados propios
- **Mensajes**: Inbox para mensajes entre nodos, confirmaciones, limites
- **Balance multilateral**: Seguimiento de saldo con cada nodo remoto

### 7. Frontend PWA
- **Archivo**: `web/`
- **Stack**: React 18, TypeScript, TailwindCSS, Vite
- **PWA**: Manifest, service worker, offline cache
- **18 paginas**: Setup, Login, Dashboard, Transfer, History, Products, Calculator, Store, FederationLimits, Parity, Assembly, Audit, ExternalBridge, Admission, Organizations, Payments, Recovery, Departments, NFCTerminals
- **Hooks**: `useAuth`, `usePermissions`
- **Setup Wizard**: Pagina de configuracion inicial de 4 pasos para nuevo nodo (auto-genera claves, crea admin, departamentos, permisos)

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
1. Nodo local valida limites bilaterales con nodo remoto
2. Mensaje enviado via mTLS al inbox del nodo remoto
3. Nodo remoto valida y confirma
4. Balance multilateral actualizado en ambos nodos

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
