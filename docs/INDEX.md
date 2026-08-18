# Documentacion de la Red de Intercambio Federada

## Indice

1. [Arquitectura del Sistema](architecture.md) - Vision general, componentes, flujo de datos
2. [API REST](api.md) - Endpoints, request/response, autenticacion
3. [Protocolo de Federacion](federation.md) - mTLS, gossip, mensajes entre nodos, federacion de productos
4. [Esquema de Base de Datos](database.md) - Tablas, relaciones, migraciones
5. [Seguridad y Criptografia](security.md) - Passkeys, claves Ed25519, hash chain, JWT
6. [Cuentas y Miembros](accounts.md) - Tipos de cuenta, niveles de miembro, admision
7. [Recuperacion de Cuenta](recovery.md) - Aprobacion configurable, multi-firma, codigos de invitacion
8. [Impuestos y Fondo Comunitario](taxes.md) - Tasas, fondo multi-sig, instituciones publicas
9. [Pagos](payments.md) - QR, NFC, manual, terminales ESP32
10. [Asambleas](assembly.md) - Sesiones, decisiones, multi-firma
11. [Auditoria](audit.md) - Transparencia, verificacion hash chain
12. [Puente de Comercio Externo](external_bridge.md) - FC, DEX, tienda comunitaria, productos compuestos
13. [Modulo de Precios](pricing.md) - Calculadora energetica, catalogo, tarifas, energia por kg
14. [Productos Compuestos](composite_products.md) - Sistema de productos compuestos, materias primas, recetas
15. [Limites Federados](federation_limits.md) - Limites globales, bilaterales, piscinas separadas
16. [Frontend PWA](frontend.md) - React, TypeScript, TailwindCSS, Vite, service worker
17. [Despliegue](deployment.md) - Docker, instalacion de nuevo nodo, setup wizard
18. [Departamentos y Permisos](departments.md) - Departamentos, roles, permisos granulares, multi-firma
19. [Hardware NFC](nfc_hardware.md) - Terminales ESP32, PN532, tipos de terminal, componentes

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
| 11 | Catalogo energetico realineado (ICE Database) | Completado |
| 11.1 | Productos por kg de material + trabajo por hora | Completado |
| 11.2 | Division de bundles en productos individuales | Completado |
| 12 | Tienda comunitaria con costos adicionales y paginacion | Completado |
| 12.1 | Productos compuestos con precio automatico | Completado |
| 12.2 | Federacion de productos entre nodos con aprobacion individual | Completado |
| 13 | Documentacion actualizada | Completado |

## Estructura del Proyecto

```
red de intercambio federada/
├── cmd/node/main.go          # Punto de entrada del nodo
├── cmd/install/main.go       # Instalador CLI
├── cmd/installer/main.go     # Instalador web
├── config.yaml               # Configuracion del nodo
├── internal/
│   ├── accounts/             # Usuarios, organizaciones, recuperacion
│   ├── api/                  # Handlers HTTP, middleware, rutas, setup wizard
│   ├── config/               # Carga de configuracion
│   ├── crypto/               # Passkeys, Ed25519, encriptacion, terminal crypto
│   ├── db/                   # Pool de conexion, migraciones, seed
│   ├── external/             # DEX, tienda comunitaria, productos compuestos
│   ├── federation/           # Servidor federacion, mTLS, gossip, productos federados
│   ├── ledger/               # Ledger doble entrada, hash chain
│   ├── payments/             # QR, NFC, manual, terminales NFC ESP32
│   └── pricing/              # Calculadora energetica, productos
├── firmware/                 # Firmware ESP32 para terminales NFC
│   ├── shared/               # Codigo compartido (crypto, NFC, display, server)
│   ├── terminal-keypad/      # Terminal con encoder rotatorio
│   ├── terminal-web/         # Terminal con app web
│   ├── terminal-touch/       # Terminal con pantalla tactil
│   ├── terminal-community/   # Punto comunitario doble tarjeta
│   ├── terminal-ble-reader/  # Lector BLE de tarjetas
│   ├── chip-id-reader/       # Lector de chip ID
│   └── docs/                 # Hardware, seguridad, flasheo, troubleshooting
├── web/                      # Frontend PWA React
│   ├── src/
│   │   ├── api.ts            # Cliente API con JWT
│   │   ├── App.tsx           # Rutas
│   │   ├── components/       # Layout, navegacion, public-site
│   │   ├── hooks/            # useAuth, usePermissions, useConfig
│   │   ├── pages/            # 18+ paginas (Setup, Departments, NFCTerminals, Store, Products)
│   │   └── main.tsx          # Entry point + service worker
│   ├── public/               # manifest, sw.js, icon
│   └── package.json
├── docs/                     # Esta documentacion
└── docker/                   # Dockerfile, docker-compose
```

## Migraciones Recientes

| Migracion | Descripcion |
|-----------|-------------|
| 038 | Catalogo realineado con valores energeticos internacionales |
| 039 | Tienda: unidad, cantidad por paquete, costos adicionales, paginacion |
| 040 | Division de bundles en productos individuales con precios especificos |
| 041 | Productos artesanales por kg de material + trabajo por hora |
| 042 | Sistema de productos compuestos (tabla product_compositions) |
| 043 | Federacion de productos entre nodos (tabla product_federation_proposals) |
