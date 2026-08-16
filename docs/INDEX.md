# Documentacion del Sistema de Credito Mutuo Federado

## Indice

1. [Arquitectura del Sistema](architecture.md) - Vision general, componentes, flujo de datos
2. [API REST](api.md) - Endpoints, request/response, autenticacion
3. [Protocolo de Federacion](federation.md) - mTLS, gossip, mensajes entre nodos
4. [Esquema de Base de Datos](database.md) - Tablas, relaciones, migraciones
5. [Seguridad y Criptografia](security.md) - Passkeys, claves Ed25519, hash chain, JWT
6. [Cuentas y Miembros](accounts.md) - Tipos de cuenta, niveles de miembro, admision
7. [Recuperacion de Cuenta](recovery.md) - Aprobacion configurable, multi-firma, codigos de invitacion
8. [Impuestos y Fondo Comunitario](taxes.md) - Tasas, fondo multi-sig, instituciones publicas
9. [Pagos](payments.md) - QR, NFC, manual, terminales ESP32
10. [Asambleas](assembly.md) - Sesiones, decisiones, multi-firma
11. [Auditoria](audit.md) - Transparencia, verificacion hash chain
12. [Puente de Comercio Externo](external_bridge.md) - FC, DEX, tienda comunitaria
13. [Modulo de Precios](pricing.md) - Calculadora energetica, catalogo, tarifas
14. [Limites Federados](federation_limits.md) - Limites globales, bilaterales, piscinas separadas
15. [Frontend PWA](frontend.md) - React, TypeScript, TailwindCSS, Vite, service worker
16. [Despliegue](deployment.md) - Docker, instalacion de nuevo nodo, setup wizard
17. [Departamentos y Permisos](departments.md) - Departamentos, roles, permisos granulares, multi-firma
18. [Hardware NFC](nfc_hardware.md) - Terminales ESP32, PN532, tipos de terminal, componentes

## Estado de Implementacion

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1 | Fundacion (DB, ledger, hash chain, transacciones) | Completado |
| 2 | Cripto + Auth (Passkeys, Ed25519, JWT) | Completado |
| 3 | Admision + API REST | Completado |
| 4 | Federacion (mTLS, gossip, limites bilaterales) | Completado |
| 5 | Organizaciones, instituciones publicas, multi-firma | Completado |
| 6 | Asamblea + Auditoria | Completado |
| 7 | Pagos (QR, NFC, manual) | Completado |
| 8 | Comercio externo + Precios (DEX, tienda, FC) | Completado |
| 9 | Frontend PWA React | Completado |
| 9.1 | Recuperacion de cuenta con aprobacion configurable | Completado |
| 9.2 | Departamentos, roles y permisos granulares | Completado |
| 9.3 | Terminales NFC ESP32 (keypad, web, touch, community) | Completado |
| 9.4 | Setup Wizard + login por contrasena + auto-configuracion | Completado |
| 10 | Documentacion | Completado |

## Estructura del Proyecto

```
red de intercambio federada/
├── cmd/node/main.go          # Punto de entrada del nodo
├── config.yaml               # Configuracion del nodo
├── internal/
│   ├── accounts/             # Usuarios, organizaciones, recuperacion
│   ├── api/                  # Handlers HTTP, middleware, rutas, setup wizard
│   ├── config/               # Carga de configuracion
│   ├── crypto/               # Passkeys, Ed25519, encriptacion, terminal crypto
│   ├── db/                   # Pool de conexion, migraciones
│   ├── external/             # DEX, tienda comunitaria
│   ├── federation/           # Servidor federacion, mTLS
│   ├── ledger/               # Ledger doble entrada, hash chain
│   ├── payments/             # QR, NFC, manual, terminales NFC ESP32
│   └── pricing/              # Calculadora energetica, productos
├── firmware/                 # Firmware ESP32 para terminales NFC
│   ├── shared/               # Codigo compartido (crypto, NFC, display, server)
│   ├── terminal-keypad/      # Terminal con encoder rotatorio
│   ├── terminal-web/         # Terminal con app web
│   ├── terminal-touch/       # Terminal con pantalla tactil
│   ├── terminal-community/   # Punto comunitario doble tarjeta
│   └── docs/                 # Hardware, seguridad, flasheo, troubleshooting
├── web/                      # Frontend PWA React
│   ├── src/
│   │   ├── api.ts            # Cliente API con JWT
│   │   ├── App.tsx           # Rutas
│   │   ├── components/       # Layout, navegacion
│   │   ├── hooks/            # useAuth, usePermissions
│   │   ├── pages/            # 18 paginas (incluye Setup, Departments, NFCTerminals)
│   │   └── main.tsx          # Entry point + service worker
│   ├── public/               # manifest, sw.js, icon
│   └── package.json
├── docs/                     # Esta documentacion
└── docker/                   # Dockerfile, docker-compose
```
