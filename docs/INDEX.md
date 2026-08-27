# Documentacion de la Red de Intercambio Federada

## Indice

1. [Arquitectura del Sistema](architecture.md) - Vision general, componentes, flujo de datos
2. [API REST](api.md) - Endpoints, request/response, autenticacion
3. [Protocolo de Federacion](federation.md) - mTLS, gossip, mensajes entre nodos, federacion de productos
4. [Esquema de Base de Datos](database.md) - Tablas, relaciones, migraciones
5. [Seguridad y Criptografia](security.md) - Passkeys, claves Ed25519, hash chain, JWT
6. [Cuentas y Miembros](accounts.md) - Tipos de cuenta, niveles de miembro, admision
7. [Recuperacion de Cuenta](recovery.md) - Aprobacion configurable, multi-firma, codigos de invitacion
8. [Impuestos y Cuenta de la Asamblea](taxes.md) - Cuenta predefinida, distribucion por asamblea, reglas de transferencia
9. [Pagos](payments.md) - QR, NFC, manual, terminales ESP32
10. [Asambleas](assembly.md) - Sesiones, propuestas, votacion, convocatoria automatica, tipos por scope, reglas de transferencia
11. [Auditoria](audit.md) - Transparencia, verificacion hash chain
12. [Puente de Comercio Externo](external_bridge.md) - FC, DEX, tienda comunitaria, productos compuestos
13. [Modulo de Precios](pricing.md) - Calculadora energetica, catalogo, tarifas, energia por kg
14. [Productos Compuestos](composite_products.md) - Sistema de productos compuestos, materias primas, recetas
15. [Limites Federados](federation_limits.md) - Limites globales, bilaterales, piscinas separadas
16. [Frontend PWA](frontend.md) - React, TypeScript, TailwindCSS, Vite, service worker
17. [Despliegue](deployment.md) - Docker, instalacion de nuevo nodo, setup wizard
18. [Departamentos y Permisos](departments.md) - Departamentos con jerarquia (org padre), roles, permisos, asambleas opcionales
19. [Hardware NFC](nfc_hardware.md) - Terminales ESP32, PN532, tipos de terminal, componentes
20. [Sistema de Intercambio y Moneda TQ](currency_exchange.md) - TQ, credito mutuo, historia, calculo energetico, comercio externo
21. [Feria Conuquera Agroecologica](feria_conuquera.md) - Historia, filosofia, organizacion, productos, actividades, ecoaldeas
22. [Gobernanza - Ley de la Aldea](governance.md) - Reglas, jerarquia nodo/org/depto, asambleas por scope, admision, FRNE, tenencia de tierra
23. [Notificaciones](notifications.md) - Sistema unificado, pasarelas federadas (Matrix, Telegram, XMPP), preferencias, scope por usuario
24. [Plan: Servicios de Organizaciones](PLAN_SERVICIOS_ORGANIZACIONES.md) - Plan de impuestos por nivel, servicios, organizaciones de la Asamblea
25. [Gobernanza Federada](federation_governance.md) - Constantes federadas, propuestas, votacion entre nodos, consenso, canasta basica compartida
26. [Escalar YugabyteDB](scaling_yugabytedb.md) - Limite de tabletas, agregar nodos, colocation, configuracion de cluster
27. [Guia de Inicio para Desarrolladores](guia-inicio-desarrolladores-tq.md) - Stack completo, estructura del repo, como colaborar
28. [Principios Innegociables para Desarrollar](PRINCIPIOS_INNEGOCIABLES.md) - 10 reglas basicas: codigo abierto, codigo base unico, ajustes de nodo, que requiere aprobacion

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
| 14 | Gobernanza con asamblea: quorum, votacion, revision, minutas | Completado |
| 14.1 | Asambleas de organizacion y departamento (scoped) | Completado |
| 14.2 | Convocatoria automatica, frecuencia, notificaciones | Completado |
| 14.3 | Tipos de propuesta por scope (no mezclar decisiones) | Completado |
| 14.4 | Tiempos minimos de anticipacion, fecha obligatoria | Completado |
| 14.5 | Reglas de transferencia por scope | Completado |
| 14.6 | Departamentos con organizacion padre (jerarquia) | Completado |
| 14.7 | Documentacion actualizada de asambleas y gobernanza | Completado |
| 15 | Impuestos por nivel de miembro y organizacion | Completado |
| 15.1 | Servicios y mensualidades de organizaciones | Completado |
| 15.2 | Organizaciones de la Asamblea (is_assembly_owned) | Completado |
| 15.3 | Auto-suscripcion de miembros a servicios obligatorios | Completado |
| 15.4 | Scheduler de cobros mensuales automaticos | Completado |
| 15.5 | Juntas directivas con reuniones, votaciones y actas | Completado |
| 15.6 | Organizaciones de la Asamblea usan Asamblea General | Completado |
| 15.7 | Documentacion actualizada de servicios y gobernanza | Completado |
| 16 | Junta Directiva del nodo (meeting_type en assembly_sessions) | Completado |
| 16.1 | Reclasificacion de decisiones: operativas a Junta Directiva | Completado |
| 16.2 | Quorum configurable de Junta Directiva del nodo | Completado |
| 16.3 | Sincronizacion automatica de informacion de red entre nodos | Completado |
| 16.4 | Calculadora de precios externos en Comercio Exterior | Completado |
| 16.5 | Fix: catalogo de servicios federados no cargaba (res.data) | Completado |
| 16.6 | Fix: guardar FC desde canasta basica (internal_cost nullable) | Completado |
| 16.7 | Documentacion actualizada | Completado |

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
│   ├── shared/               # Codigo compartido (crypto, NFC, display, server, pairing)
│   ├── terminal-keypad/      # Terminal con encoder rotatorio
│   ├── terminal-touch/       # Terminal con pantalla tactil
│   ├── terminal-community/   # Punto comunitario doble tarjeta
│   ├── terminal-ble-reader/  # Lector NFC Bluetooth (accesorio del POS, no terminal)
│   ├── chip-id-reader/       # Lector de chip ID para provisioning
│   └── docs/                 # Hardware, seguridad, flasheo, troubleshooting
├── web/                      # Frontend PWA React
│   ├── src/
│   │   ├── api.ts            # Cliente API con JWT
│   │   ├── App.tsx           # Rutas
│   │   ├── components/       # Layout, navegacion, public-site
│   │   ├── hooks/            # useAuth, usePermissions, useConfig
│   │   ├── pages/            # 42+ paginas (Setup, Dashboard, Pos, NFCTerminals, Assembly, Store, etc.)
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
| 044 | Jerarquia de 3 niveles en store_items (parent_category, subcategory) |
| 045 | Separacion de productos agrupados en items individuales (group_id, is_group) |
| 046 | Precios decimales en productos |
| 047 | Limites simetricos (positivo = negativo) + canasta basica 500 TQ |
| 048 | Tabla governance_rules + seed inicial (Ley de la Aldea) |
| 049 | Estructuras de asamblea: sesiones, decisiones, votos |
| 050 | Plazos de votacion y deadlines |
| 051 | Asistencia y doble validacion presencial |
| 052 | Quorum configurable, gracia, reprogramacion |
| 053 | Flujo de revision: proposed -> pending -> executed |
| 054 | Asambleas de organizacion y departamento (scoped) |
| 055 | Convocatoria automatica, frecuencia, notificaciones, tipos por scope |
| 056 | Tiempos minimos de anticipacion, cuenta predefinida de impuestos |
| 057 | Departamentos con organizacion padre (jerarquia) |
| 058 | Ventana de asistencia configurable |
| 059 | Modulo de notificaciones: notifications, channels, gateways, preferences |
| 060 | Horas silenciosas (quiet_hours_start, quiet_hours_end en users) |
| 061 | Metadata de usuario (digest_mode, last_digest_sent) |
| 062 | Fix gobernanza dinamica + ID nacional + conflictos de fusion |
| 063 | rule_type en governance_rules + pasaporte + fix conflictos |
| 064 | 24 reglas de comunidad intencional + paises + documentos de usuario |
| 065 | Propuestas publicas para mejorar el sistema (sin cuenta) |
| 066 | Sistema de backups + nodos YugabyteDB |
| 067 | (vacia, mantiene secuencia) |
| 068 | Restaurar URLs de Unsplash en products |
| 069 | Servicios de organizaciones, suscripciones, is_assembly_owned |
| 070 | Reuniones de junta directiva (meeting_type en scoped assemblies) |
| 071 | 12 reglas publicas sobre organizaciones, servicios y juntas |
| 076 | Gobernanza federada: constantes, propuestas, votacion entre nodos |
| 077 | Expulsion de nodos de la federacion |
| 078 | Configuracion de cluster YugabyteDB |
| 079 | Informacion de red del nodo para sincronizacion federada |
| 080 | Junta Directiva del nodo (meeting_type en assembly_sessions del nodo) |
| 081 | Fix: internal_cost y external_price_usd nullable en conversion_factor |
| 082 | Reclasificar decisiones operativas a Junta Directiva + defaults de quorum |

## Cambios Recientes

### Junta Directiva del Nodo y Reclasificacion de Decisiones (migraciones 080-082)

La Asamblea General del nodo ahora tiene dos tipos de reunion:

1. **Asamblea General** - todos los miembros con derecho a voto
   - Decisiones grandes: expulsion, federacion, impuestos, tarifas, gobernanza
2. **Junta Directiva del nodo** - solo miembros de la junta
   - Decisiones operativas: cuentas, limites, productos, fondos, presupuesto

**Decisiones reclasificadas a Junta Directiva** (antes todas eran Asamblea):
- `create_account`, `limit_change`, `product_modification`,
  `fund_distribution`, `budget_increase`

**Decisiones que siguen siendo de Asamblea**:
- `admission` (50%), `expulsion` (75%), `federation_config` (66.67%),
  `tax_change` (66.67%), `energy_rate_change` (66.67%),
  `member_level` (50%), `org_level` (50%), `policy` (50%),
  `governance_rule` (50%), `free_proposal` (50%)

**Quorum de Junta Directiva**: calculado sobre miembros de la junta
(no sobre todos los miembros del nodo). Defaults: 50%/30% (ordinaria),
50%/30% (extraordinaria), 40%/25% (urgente).

**La Asamblea decide** quien aprueba que: puede cambiar el
`approval_method` de cualquier tipo de propuesta.

### Sincronizacion Automatica de Red (migracion 079)

Los nodos federados ahora sincronizan automaticamente:
- Dominio, IP publica, IPv6 ULA, endpoint WireGuard
- Lista de servicios disponibles con sus direcciones
- Cuando un nodo cambia su configuracion, los peers se actualizan

### Calculadora de Precios Externos

Comercio Exterior ahora tiene una sub-pestana "Calculadora de Precios"
que muestra todos los productos del nodo con su precio equivalente en
moneda externa segun el FC actual. Es informativo: ayuda a verificar
si el FC esta bien calibrado.

### Sistema de Asambleas Completo (migraciones 049-057)

El sistema de asambleas ahora soporta tres niveles de decision:

1. **Asamblea del nodo** - decisiones del nodo completo (15 tipos de propuesta)
2. **Asamblea de organizacion** - decisiones internas (9 tipos, opcional)
3. **Asamblea de departamento** - decisiones internas (4 tipos, opcional)

**Principales caracteristicas:**
- Convocatoria automatica con frecuencia configurable (ej: cada 3 meses)
- Tiempos minimos de anticipacion: ordinaria 7 dias, extraordinaria 24h, urgente 1h
- Fecha obligatoria al crear sesiones (no se puede crear para "ahora mismo")
- Notificaciones automaticas a miembros elegibles
- Flujo de revision: propuesta -> revision -> votacion -> ejecucion
- Voto secreto con informes publicos agregados
- Quorum configurable por tipo de propuesta y tipo de asamblea
- Doble validacion de asistencia presencial
- Minutas automaticas con eventos editables
- Pestañas separadas: proximas asambleas vs asambleas pasadas

**Reglas de transferencia:**
- La asamblea del nodo NO puede transferir a personas directamente (solo orgs y deptos)
- Las organizaciones y departamentos SI pueden transferir a personas

**Jerarquia de departamentos:**
- Todo departamento debe pertenecer a una organizacion o al nodo/asamblea
- No puede existir aislado ni pertenecer a una persona

### Servicios y Organizaciones de la Asamblea (migraciones 069-070)

**Impuestos por nivel:**
- El handler de transferencias ahora usa el `tax_rate` del `member_level` u `organization_level` del emisor
- Orden de precedencia: users.tax_rate > member_levels.tax_rate > organization_levels.tax_rate > tax_config
- El impuesto va a la cuenta de la Asamblea (fallback: impuestos, fallback: tax_config)

**Servicios de organizaciones:**
- Las organizaciones pueden ofrecer servicios: mensualidades, cobros, pagos a miembros
- Tipos: subscription (cobra), benefit (paga), one_time (cobro unico)
- Monto puede ser 0 (gratuito) o positivo
- Frecuencia: mensual, trimestral, anual
- Obligatorios o voluntarios
- Cada servicio define obligaciones, derechos y deberes
- Scheduler cobra/paga automaticamente

**Organizaciones de la Asamblea:**
- `is_assembly_owned = true` marca organizaciones que pertenecen a la Asamblea
- Todos los miembros del nodo son automaticamente miembros
- Sus decisiones se votan en la Asamblea General
- Tienen junta directiva propia para decisiones operativas
- Servicios obligatorios aplican a todos los miembros del nodo

**Juntas directivas con reuniones:**
- Cada organizacion tiene dos espacios de decision: asamblea y junta directiva
- `meeting_type = 'assembly'`: todos los miembros participan
- `meeting_type = 'board'`: solo la junta directiva participa
- Ambos tienen: sesiones, propuestas, votaciones, actas, asistencia, quorum, reportes
- Tipos de propuesta para junta: board_operational, board_financial, board_appointment

Ver detalles en:
- [assembly.md](assembly.md) - Documentacion completa del sistema de asambleas
- [governance.md](governance.md) - Estructura de gobernanza y jerarquia
- [departments.md](departments.md) - Departamentos con organizacion padre
- [taxes.md](taxes.md) - Impuestos por nivel y cuenta de la asamblea
- [PLAN_SERVICIOS_ORGANIZACIONES.md](PLAN_SERVICIOS_ORGANIZACIONES.md) - Plan de servicios

### Sistema de Moneda Saldo Cero: 5 Pilares

Documentado en [currency_exchange.md](currency_exchange.md):
1. Punto de Partida - Saldo Inicial Cero
2. Dinamica del Intercambio - Credito Mutuo
3. Limite Inferior - Piso Negativo
4. Limite Superior - Techo Positivo
5. Respaldo y Unidad de Cuenta - Energia Fisica Real
