# Plan: Impuestos por Nivel + Servicios/Mensualidades de Organizaciones + Organizaciones de Asamblea

## Estado del documento
- [x] Fase 1: Estudio del sistema actual (impuestos)
- [x] Fase 1: Estudio del sistema actual (organizaciones)
- [x] Fase 1: Estudio del sistema actual (asamblea)
- [ ] Fase 2: Diseno de la solucion
- [ ] Fase 3: Implementacion

---

## FASE 1: ESTUDIO DEL SISTEMA ACTUAL

### 1.1 Sistema de Impuestos

#### Lo que existe en la base de datos

**Tabla `member_levels`** (migracion 001):
- Columna `tax_rate DECIMAL(5,4)` -- existe pero **NO se configura en el demo seed**
- El demo seed (`demoSeedMemberLevels`) crea niveles raiz/tronco/rama/brote
  pero NO establece `tax_rate`. Queda en NULL/0.

**Tabla `organization_levels`** (migracion 012):
- Columna `tax_rate DECIMAL(5,4)` -- SI se configura en el demo seed:
  - org_produccion: 2%
  - org_consumo: 1%
  - org_publica: 0%
  - org_cooperativa: 1%

**Tabla `users`** (migracion 001):
- Columna `tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0`
- Permite override por usuario, pero por defecto es 0

**Tabla `tax_config`** (migraciones 007 y 056):
- Hay DOS creaciones de `tax_config`:
  - Migracion 007: sin UNIQUE en node_domain, con `applies_to`
  - Migracion 056: con UNIQUE en node_domain, sin `applies_to` extra
- El demo seed crea multiples filas en `tax_config` con diferentes
  `applies_to` (individual, organization, department, fund, commerce, etc.)
  pero la migracion 056 tiene UNIQUE(node_domain) lo que podria causar
  conflictos.

#### Lo que existe en el backend

**`internal/taxes/calculator.go`**:
- `GetTaxRate(userID)` -- busca `tax_rate` del usuario, si es 0 busca
  el `tax_rate` del `member_level` del usuario. **CORRECTO en logica**
  pero **NO se usa** en el handler de transferencias.

**`internal/api/handlers.go` linea 173-188**:
- El handler de transferencias (`POST /api/transfer`) usa `tax_config`
  (configuracion global del nodo), NO el `tax_rate` del nivel del usuario.
- Solo consulta una fila de `tax_config` con `WHERE node_domain = $1`
- No filtra por `applies_to` segun el tipo de cuenta del emisor
- No usa `taxes.Calculator.GetTaxRate()` en absoluto

#### PROBLEMA CONFIRMADO

**El impuesto por nivel NO funciona.** El handler de transferencias
usa `tax_config` (global del nodo), no el `tax_rate` del `member_level`
ni del `organization_level` del emisor. Aunque las columnas existen
en la base de datos y `taxes.Calculator` sabe buscarlas, el handler
no las usa.

Ademas, el demo seed no configura `tax_rate` en `member_levels`,
solo en `organization_levels`.

#### Destino del impuesto

- El handler envia el impuesto a `tax_config.tax_account_id`
- El demo seed configura `tax_account_id` con la cuenta `impuestos`
- La migracion 056 dice: "Los impuestos llegan automaticamente a esta
  cuenta. Lo que se vota en asamblea es a DONDE distribuir ese dinero."
- La cuenta `impuestos` es una cuenta tipo `fund`
- **El usuario quiere que los impuestos vayan a la cuenta de la Asamblea**
  (cuenta social). Actualmente van a `impuestos`, no a `asamblea`.

### 1.2 Sistema de Organizaciones

#### Estructura actual

**Tabla `users`** con `account_type = 'organization'`:
- Las organizaciones son usuarios con tipo 'organization'
- Tienen: `organization_subtype` (commerce, services, public_service, cooperative)
- Tienen: `credit_limit`, `debit_limit`, `annual_budget_limit`, `tax_rate`
- Tienen: `required_signatures`, `authorized_signers` (multi-sig)
- Tienen: `organization_level_id` (FK a `organization_levels`)

**Tabla `organization_board_members`** (migracion 014):
- Junta directiva de cada organizacion
- Campos: `organization_id`, `user_id`, `position`, `term_start`, `term_end`,
  `is_active`, `appointed_by`
- **NO existe concepto de "miembros regulares"** de una organizacion
- Solo hay junta directiva, no hay miembros suscritos

**Tabla `departments`** (migracion 004):
- Subgrupos internos de una organizacion
- Tienen: `name`, `description`, `group_type`, `head_user_id`
- Tienen roles y miembros propios

#### Lo que NO existe

- **No hay servicios/mensualidades**: No hay tabla para definir que una
  organizacion cobra X monto mensual a sus miembros
- **No hay suscripciones**: No hay tabla para registrar que un usuario
  esta suscrito a un servicio de una organizacion
- **No hay cobro automatico**: No hay scheduler que descuente mensualidades
- **No hay organizaciones de la Asamblea**: No hay marca que indique que
  una organizacion pertenece a la Asamblea y que todos los miembros del
  nodo son automaticamente miembros
- **No hay obligaciones/derechos/deberes**: No hay estructura para definir
  que exige una organizacion a sus miembros (dinero, horas de trabajo, etc.)

### 1.3 Sistema de Asamblea

#### Estructura actual

- Tablas: `assembly_sessions`, `assembly_decisions`, `assembly_votes`,
  `assembly_config`, `assembly_quorum_config`, `assembly_frequency_config`
- La cuenta `asamblea` se crea en `DemoAutoSetup` como organizacion
- La asamblea tiene propuestas que se votan y ejecutan
- Hay tipos de propuesta: `governance_rule`, `member_admission`, etc.
- **NO hay tipo de propuesta para crear organizaciones de la Asamblea**

#### Lo que falta

- La Asamblea deberia poder "poseer" organizaciones
- Las organizaciones de la Asamblea tienen a todos los miembros auto-suscritos
- Crear una organizacion de la Asamblea requiere propuesta + votacion
- Los miembros nuevos del nodo se auto-suscriben a las organizaciones
  de la Asamblea existentes

### 1.4 Scheduler existente

- `NotificationScheduler` corre cada hora
- Verifica votaciones por cerrar, asambleas proximas, digests
- **Se puede extender** para verificar cobros mensuales pendientes

---

## FASE 2: DISENO DE LA SOLUCION

### 2.1 Corregir impuestos por nivel (PRIORIDAD ALTA)

#### Cambios necesarios:

**A. Demo seed: configurar `tax_rate` en `member_levels`**

Agregar `tax_rate` a los niveles del demo:
- raiz: 0.5% (0.005) -- fundadores aportan poco, ya contribuyen mucho
- tronco: 1% (0.01)
- rama: 1.5% (0.015)
- brote: 2% (0.02) -- nuevos aportan mas, como incentivo a ascender

**B. Handler de transferencias: usar `tax_rate` del nivel**

Cambiar `handlers.go` linea 173-188 para:
1. Obtener el `tax_rate` del emisor usando `taxes.Calculator.GetTaxRate()`
   o directamente consultando `member_levels.tax_rate` /
   `organization_levels.tax_rate`
2. Si el emisor es organizacion, buscar `organization_levels.tax_rate`
3. Si el emisor es individual, buscar `member_levels.tax_rate`
4. Si el usuario tiene `tax_rate` override, usar ese
5. Fallback a `tax_config` si no hay tax_rate en el nivel
6. El impuesto va a la cuenta de la Asamblea (no solo `impuestos`)

**C. Destino del impuesto: cuenta de la Asamblea**

- Buscar la cuenta `asamblea` del nodo
- Si no existe, fallback a `impuestos`
- Si no existe, fallback a `tax_config.tax_account_id`

### 2.2 Servicios y Mensualidades de Organizaciones

#### Nueva tabla: `organization_services`

```sql
CREATE TABLE organization_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- ej: "Energia Electrica"
  description TEXT,                      -- que incluye el servicio
  service_type TEXT NOT NULL DEFAULT 'subscription',
    -- 'subscription' = mensualidad recurrente
    -- 'one_time' = cobro unico
    -- 'benefit' = la organizacion PAGA al miembro (no cobra)
  amount BIGINT NOT NULL DEFAULT 0,      -- monto en TQ
  frequency TEXT NOT NULL DEFAULT 'monthly',
    -- 'monthly', 'quarterly', 'annual', 'one_time'
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
    -- true = todos los miembros deben pagar (org de Asamblea)
    -- false = voluntario, el usuario se suscribe
  obligations TEXT,                      -- deberes del miembro
  rights TEXT,                           -- derechos del miembro
  duties TEXT,                           -- tareas esperadas
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_proposal UUID,              -- propuesta de asamblea que la aprobo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Nueva tabla: `organization_subscriptions`

```sql
CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES organization_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'paused', 'cancelled', 'auto' (auto-suscrito por Asamblea)
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  last_charged_at TIMESTAMPTZ,           -- ultimo cobro mensual
  next_charge_at TIMESTAMPTZ,            -- proximo cobro
  UNIQUE(service_id, user_id)
);
```

#### Nueva tabla: `organization_member_obligations`

No es necesaria tabla separada -- los campos `obligations`, `rights`,
`duties` van en `organization_services` y son visibles para todos.

#### Scheduler de cobros mensuales

Extender `NotificationScheduler` o crear `SubscriptionScheduler`:
- Corre diariamente
- Busca suscripciones activas con `next_charge_at <= NOW()`
- Crea transaccion: miembro -> organizacion
- Actualiza `last_charged_at` y `next_charge_at`
- Si el miembro no tiene saldo suficiente, registra deuda / notifica

### 2.3 Organizaciones de la Asamblea

#### Cambios en `users`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_assembly_owned BOOLEAN NOT NULL DEFAULT false;
```

- Las organizaciones con `is_assembly_owned = true` pertenecen a la Asamblea
- Todos los miembros del nodo son automaticamente miembros
- Sus servicios con `is_mandatory = true` aplican a todos

#### Auto-suscripcion:

- Cuando se crea una organizacion de la Asamblea, se suscriben todos
  los miembros activos a sus servicios obligatorios
- Cuando un nuevo miembro es admitido, se auto-suscribe a todas las
  organizaciones de la Asamblea existentes
- El tipo de suscripcion es 'auto' (no puede cancelar)

#### Propuesta de Asamblea para crear organizacion:

- Nuevo tipo de propuesta: `create_assembly_organization`
- Al aprobarse, crea la organizacion con `is_assembly_owned = true`
- Crea los servicios definidos en la propuesta
- Auto-suscribe a todos los miembros

### 2.4 API necesaria

```
GET    /api/organizations/{id}/services          -- listar servicios
POST   /api/organizations/{id}/services          -- crear servicio (admin org)
PUT    /api/organizations/services/{id}          -- editar servicio
DELETE /api/organizations/services/{id}          -- desactivar servicio

GET    /api/organizations/services/{id}/subscriptions  -- listar suscritos
POST   /api/organizations/services/{id}/subscribe      -- suscribirse (voluntario)
DELETE /api/organizations/services/{id}/subscribe      -- desuscribirse (voluntario)

GET    /api/my-services                          -- mis servicios activos
GET    /api/my-subscriptions                     -- mis suscripciones

POST   /api/assembly/proposals                   -- tipo: create_assembly_organization
```

### 2.5 UI necesaria

- En `OrganizationDetail.tsx`: tab "Servicios" para ver/crear servicios
- En `OrganizationDetail.tsx`: tab "Miembros" para ver suscritos
- En Dashboard o nueva pagina: "Mis Servicios" -- ver mis suscripciones
- Al crear organizacion de Asamblea: formulario con servicios iniciales
- Mostrar obligaciones/derechos/deberes antes de suscribirse

---

## FASE 3: IMPLEMENTACION (orden propuesto)

### Paso 1: Corregir impuestos por nivel [x]
- [x] Demo seed: agregar tax_rate a member_levels (raiz=0.5%, tronco=1%, rama=1.5%, brote=2%)
- [x] Handler de transferencias: usar tax_rate del nivel del emisor
- [x] Destino: cuenta de la Asamblea (fallback impuestos, fallback tax_config)
- [x] Build OK

### Paso 2: Migracion - tablas de servicios [x]
- [x] Crear migracion 069_organization_services.sql
- [x] Tabla organization_services
- [x] Tabla organization_subscriptions
- [x] Columna is_assembly_owned en users
- [x] Tabla subscription_charge_failures

### Paso 3: Backend - servicios y suscripciones [x]
- [x] CRUD de organization_services (services.go + services_handler.go)
- [x] Subscribe/unsubscribe
- [x] Listar mis servicios / mis suscripciones
- [x] Scheduler de cobros mensuales (subscription_scheduler.go)
- [x] Auto-suscripcion para orgs de Asamblea
- [x] Rutas registradas en routes.go
- [x] Scheduler registrado en main.go
- [x] Build OK

### Paso 4: Backend - organizaciones de Asamblea [ ]
- [ ] Tipo de propuesta create_assembly_organization
- [ ] Ejecucion de propuesta: crear org + servicios + auto-suscribir
- [ ] Auto-suscripcion de nuevos miembros

### Paso 5: Frontend [x]
- [x] Pagina "Mis Servicios" (MyServices.tsx)
- [x] Ruta /app/my-services registrada en App.tsx
- [x] Menu "Mis Servicios" agregado al Layout
- [x] Mostrar obligaciones/derechos/deberes antes de suscribirse
- [x] Build Vite OK

### Paso 6: Demo seed [x]
- [x] Crear organizacion de Asamblea: Electricidad (50 TQ/mes)
- [x] Crear organizacion de Asamblea: Transporte (30 TQ/mes)
- [x] Crear organizacion de Asamblea: Agua (25 TQ/mes)
- [x] Crear servicios obligatorios con obligaciones/derechos/deberes
- [x] Auto-suscribir a todos los miembros activos
- [x] Crear servicio voluntario: Centro de Salud (15 TQ/mes)
- [x] Suscribir voluntariamente a algunos miembros
- [x] Tablas nuevas agregadas al DemoReset

### Paso 7: Build + commit + deploy [x]
- [x] go build OK
- [x] npm run build OK
- [x] commit + push (1af8d78)
- [ ] update.ps1 (pendiente por el usuario)

---

## NOTAS TECNICAS

- Migracion siguiente: 069 (hay duplicados 060, 062, 063, 064 pero 069 esta libre)
- El scheduler de cobros debe ser idempotente (no cobrar dos veces el mismo mes)
- Las transacciones de cobro deben tener `tx_type = 'subscription_charge'`
- Los cobros fallidos (saldo insuficiente) deben registrarse como deuda pendiente
- Las organizaciones benéficas (service_type = 'benefit') pagan a los miembros
- Los cambios de tarifa deben aprobarse por votacion de los miembros de la org
