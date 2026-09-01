# Diseno: Perfiles de Nodo con Productos Prohibidos Compartidos via Federacion

## Diseno tecnico

> **ESTADO: IMPLEMENTADO** — Este sistema ya esta implementado en el codigo.
> Para usarlo, ver [Guia: Perfiles de Nodo y Productos Prohibidos](guia-perfiles-nodo.md).

## Objetivo

Permitir que los nodos federados que comparten un mismo perfil religioso/filosofico
(adventista, ISKCON, halal, etc.) compartan automaticamente las prohibiciones de
productos entre ellos, sin necesidad de configuracion manual en cada nodo.

### Problema actual

- Los perfiles de nodo (adventista, ISKCON, etc.) estan **hardcodeados** en el
  frontend. No se pueden crear nuevos desde la UI.
- Las reglas de catalogo son **por categoria** ("carne", "alcohol"), no por
  producto individual. No sabes que tipo de carne o que producto especifico.
- Cada nodo configura sus prohibiciones **independientemente**. No hay sharing.
- No hay forma de que un nodo adventista marque un producto como no apto y
  los demas nodos adventistas lo reciban automaticamente.

### Solucion propuesta

1. **Perfiles dinamicos** — Los perfiles se almacenan en la DB, no hardcodeados.
   Cualquier nodo puede crear un perfil nuevo (ej: "adventista reforma").
2. **Prohibiciones por producto** — Ademas de por categoria, se puede marcar
   productos individuales como prohibitos para un perfil.
3. **Sharing federado** — Cuando un nodo con perfil X marca un producto como
   prohibido, los demas nodos con perfil X reciben la prohibicion via gossip.
4. **Auto-aprobacion opcional** — Cada nodo decide si acepta automaticamente
   las prohibiciones de peers, o si requiere revision manual.
5. **Independencia** — Un nodo puede desaprobar localmente cualquier prohibicion
   que considere un falso positivo.

## Modelo de datos

### Tabla: `node_faith_profiles` (nueva)

Perfiles dinamicos compartidos via federation.

```sql
CREATE TABLE IF NOT EXISTS node_faith_profiles (
    id TEXT PRIMARY KEY,              -- ej: "adventista", "adventista_reforma"
    name TEXT NOT NULL,               -- ej: "Adventista Reforma"
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'custom',  -- cristiana, hindu, islamica, custom
    icon TEXT NOT NULL DEFAULT 'globe',
    -- Reglas base por categoria (ej: "sin carne, sin alcohol")
    default_rules TEXT,
    -- Quien creo el perfil (node_domain)
    created_by TEXT NOT NULL,
    -- Si esta compartido via federation
    is_shared BOOLEAN NOT NULL DEFAULT true,
    -- Si es un perfil oficial (creado por los desarrolladores) o custom
    is_official BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabla: `node_profile_settings` (nueva)

Configuracion de cada nodo respecto a su perfil.

```sql
CREATE TABLE IF NOT EXISTS node_profile_settings (
    node_domain TEXT PRIMARY KEY,
    faith_profile TEXT NOT NULL DEFAULT '',  -- referencia a node_faith_profiles.id
    -- Si auto-aprueba prohibiciones de peers con el mismo perfil
    auto_approve_prohibitions BOOLEAN NOT NULL DEFAULT false,
    -- Si recibe prohibiciones de peers
    receive_peer_prohibitions BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabla: `profile_product_prohibitions` (nueva)

Prohibiciones de productos especificos por perfil. Compartidas via federation.

```sql
CREATE TABLE IF NOT EXISTS profile_product_prohibitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- El perfil al que aplica esta prohibicion
    profile_id TEXT NOT NULL,
    -- El producto prohibido (por nombre, no por ID — los productos difieren entre nodos)
    product_name TEXT NOT NULL,
    -- Categoria del producto (ej: "carne", "bebida")
    product_category TEXT,
    -- Razon de la prohibicion (ej: "contiene cerdo")
    reason TEXT,
    -- Quien reporto la prohibicion (node_domain)
    reported_by TEXT NOT NULL,
    -- Estado de aprobacion local:
    -- 'approved'    = prohibicion activa en este nodo
    -- 'pending'     = esperando revision manual
    -- 'rejected'    = el nodo decidio no aplicar esta prohibicion
    approval_status TEXT NOT NULL DEFAULT 'approved',
    -- Si fue auto-aprobada
    auto_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Un nodo solo puede tener una prohibicion por producto+perfil
    UNIQUE(node_domain, profile_id, product_name)
);
```

**Nota:** `product_name` se usa en lugar de `product_id` porque los productos
son diferentes en cada nodo. Cuando un nodo reporta "Carne de cerdo" como
prohibida, los otros nodos buscan productos cuyo nombre coincida o contenga
ese termino.

### Tabla: `profile_product_prohibition_queue` (nueva)

Cola de prohibiciones recibidas de peers, pendientes de aprobacion manual.

```sql
CREATE TABLE IF NOT EXISTS profile_product_prohibition_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_category TEXT,
    reason TEXT,
    reported_by TEXT NOT NULL,         -- nodo que reporto
    -- Estado: 'pending', 'approved', 'rejected'
    status TEXT NOT NULL DEFAULT 'pending',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,                  -- usuario admin que reviso
    UNIQUE(node_domain, profile_id, product_name)
);
```

## Flujo de sharing federado

### 1. Un nodo marca un producto como prohibido

```
[Admin del nodo A (adventista)]
  → Marca "Salchicha de cerdo" como prohibida para adventistas
  → POST /api/node/profile/prohibitions
  → Guarda en profile_product_prohibitions (approval_status='approved')
  → Marca el producto local como prohibido en catalog_dietary_rules
```

### 2. Gossip propaga la prohibicion

```
[Gossip tick (cada 60s)]
  → syncProfileProhibitions()
  → Lee prohibiciones aprobadas locales
  → POST /federation/profile-prohibitions/sync a cada peer activo
  → Cada peer recibe:
     {
       from_node: "nodo-a.org",
       profile_id: "adventista",
       prohibitions: [
         { product_name: "Salchicha de cerdo", reason: "contiene cerdo" }
       ]
     }
```

### 3. Peer recibe la prohibicion

```
[Peer nodo B (adventista)]
  → POST /federation/profile-prohibitions/sync
  → Verifica que el nodo B tiene perfil "adventista"
  → Verifica que el nodo A es un peer federado activo
  → Si auto_approve_prohibitions = true:
     → Guarda en profile_product_prohibitions (approval_status='approved')
     → Marca productos locales coincidentes como prohibidos
  → Si auto_approve_prohibitions = false:
     → Guarda en profile_product_prohibition_queue (status='pending')
     → Aparece en la UI como "Pendiente de revision"
```

### 4. Admin del peer revisa prohibiciones pendientes

```
[Admin del nodo B]
  → Ve "Salchicha de cerdo" en cola de revision
  → Click "Aprobar" → marca producto local como prohibido
  → O click "Rechazar" → ignora la prohibicion para este nodo
```

### 5. Nodo puede desaprobar localmente

```
[Admin del nodo B]
  → Ve "Salchicha de cerdo" en lista de prohibiciones
  → Click "Desaprobar" → cambia approval_status='rejected'
  → El producto deja de estar prohibido en nodo B
  → No afecta a otros nodos
```

## Match de productos entre nodos

Como los productos son diferentes en cada nodo, el match se hace por nombre:

1. **Match exacto:** "Salchicha de cerdo" == "Salchicha de cerdo"
2. **Match parcial (contains):** "cerdo" in "Salchicha de cerdo"
3. **Match por categoria:** Si la prohibicion incluye categoria "carne",
   buscar productos locales con categoria "carne"

El admin puede ver que productos locales fueron afectados por cada prohibicion
y desactivarlos individualmente si es un falso positivo.

## Crear nuevos perfiles

### Flujo

1. Admin de nodo va a: Perfil del Nodo > Crear nuevo perfil
2. Ingresa nombre, descripcion, reglas base, categoria
3. El perfil se guarda en `node_faith_profiles` con `created_by = este_nodo`
4. El perfil se marca como `is_shared = true`
5. En el proximo gossip, el perfil se propaga a todos los peers
6. Los peers reciben el perfil y lo guardan en su DB local
7. Otros nodos pueden seleccionar el perfil desde su UI

### Sharing de perfiles via gossip

```
[Gossip tick]
  → syncFaithProfiles()
  → Lee perfiles locales con is_shared=true
  → POST /federation/faith-profiles/sync a cada peer
  → Cada peer guarda los perfiles en node_faith_profiles
  → Los perfiles aparecen en la UI del peer
```

### Perfiles oficiales vs custom

- **Oficiales:** Creados por los desarrolladores (migracion SQL). No se pueden
  borrar. Se actualizan con nuevas versiones del software.
- **Custom:** Creados por cualquier nodo. Se comparten via federation.
  Cualquier nodo puede crearlos. Si el nodo creador se desconecta, el perfil
  sigue existiendo en los nodos que ya lo tienen.

## Endpoints API

### Perfiles

| Metodo | Path | Descripcion |
|--------|------|-------------|
| GET | `/api/node/faith-profiles` | Lista perfiles disponibles (oficiales + custom + recibidos) |
| POST | `/api/node/faith-profiles` | Crea un nuevo perfil custom |
| PUT | `/api/node/faith-profile` | Asigna perfil al nodo actual |
| GET | `/api/node/faith-profile` | Obtiene perfil actual del nodo |
| PUT | `/api/node/profile-settings` | Configura auto-approve, receive-peer, etc. |

### Prohibiciones de productos

| Metodo | Path | Descripcion |
|--------|------|-------------|
| GET | `/api/node/profile/prohibitions` | Lista prohibiciones aprobadas |
| POST | `/api/node/profile/prohibitions` | Marca un producto como prohibido |
| DELETE | `/api/node/profile/prohibitions/{id}` | Desaprueba una prohibicion local |
| GET | `/api/node/profile/prohibitions/pending` | Lista prohibiciones pendientes de revision |
| POST | `/api/node/profile/prohibitions/{id}/approve` | Aprueba una prohibicion pendiente |
| POST | `/api/node/profile/prohibitions/{id}/reject` | Rechaza una prohibicion pendiente |

### Federation

| Metodo | Path | Descripcion |
|--------|------|-------------|
| GET | `/federation/faith-profiles/list` | Lista perfiles compartidos |
| POST | `/federation/faith-profiles/sync` | Recibe perfiles de un peer |
| GET | `/federation/profile-prohibitions/list` | Lista prohibiciones de un perfil |
| POST | `/federation/profile-prohibitions/sync` | Recibe prohibiciones de un peer |

## UI Web

### Pestana: Perfil del Nodo (mejorada)

1. **Perfil actual** — muestra el perfil seleccionado
2. **Selector de perfiles** — lista oficial + custom + recibidos
3. **Boton "Crear nuevo perfil"** — formulario para crear perfil custom
4. **Configuracion de sharing:**
   - Checkbox: "Auto-aprobar prohibiciones de peers"
   - Checkbox: "Recibir prohibiciones de peers"
5. **Lista de prohibiciones activas** — productos prohibidos para el perfil
6. **Boton "Agregar prohibicion"** — marcar un producto como prohibido
7. **Cola de prohibiciones pendientes** — si auto-approve esta desactivado

### Formulario: Crear nuevo perfil

```
Nombre: [Adventista Reforma]
Descripcion: [Rama reformista del adventismo]
Categoria: [cristiana]
Reglas base: [Sin carne, sin alcohol, sin cafe, sin especias fuertes]
Icono: [book-open]
```

### Formulario: Agregar prohibicion

```
Producto: [Salchicha de cerdo]  (autocomplete de productos locales)
Categoria: [carne]  (opcional)
Razon: [contiene cerdo]  (opcional)
```

## Gossip

### syncFaithProfiles

Cada 60s, envia perfiles locales compartidos a todos los peers activos.

### syncProfileProhibitions

Cada 60s, envia prohibiciones aprobadas locales a todos los peers activos
que tienen el mismo perfil.

## Seguridad y confianza

- Solo nodos federados activos pueden enviar prohibiciones.
- Las prohibiciones se filtran por perfil: un nodo adventista no recibe
  prohibiciones de un nodo ISKCON.
- El admin puede rechazar cualquier prohibicion (falso positivo).
- El admin puede desactivar auto-approve en cualquier momento.
- Crear un perfil nuevo requiere `config.manage` (permiso de admin).
- Marcar un producto como prohibido requiere `config.manage`.

## Migracion

### Migracion 152

Crea las 4 tablas nuevas y migra los perfiles hardcodeados a la DB.

```sql
-- 1. Crear tablas (ver arriba)
-- 2. Insertar perfiles oficiales
INSERT INTO node_faith_profiles (id, name, description, category, icon, default_rules, created_by, is_official)
VALUES
  ('adventista', 'Adventista', 'Sin alcohol, tabaco, cerdo, cafe', 'cristiana', 'book-open', 'Sin alcohol, tabaco, cerdo, cafe', 'system', true),
  ('iskcon', 'ISKCON', 'Sin carne, huevo, ajo, cebolla, cafe, alcohol', 'hindu', 'flower', '...', 'system', true),
  -- ... etc
ON CONFLICT (id) DO NOTHING;

-- 3. Migrar faith_profile existente de public_settings a node_profile_settings
INSERT INTO node_profile_settings (node_domain, faith_profile)
SELECT node_domain, faith_profile FROM public_settings WHERE faith_profile IS NOT NULL AND faith_profile != ''
ON CONFLICT (node_domain) DO NOTHING;
```

## Lo que NO cambia

- **catalog_dietary_rules** sigue funcionando para prohibiciones por categoria.
- **catalog_labels** y **product_labels** siguen funcionando para etiquetas.
- **organization_catalog_rules** sigue funcionando para reglas por organizacion.
- **organization_profiles** sigue funcionando para perfiles por organizacion.
- **node_presets** sigue funcionando para preconfiguraciones iniciales.

Lo nuevo es **aditivo**: prohibiciones por producto individual + sharing federado.

## Fases de implementacion

| Fase | Que | Estado |
|------|-----|--------|
| 1 | Migracion 152 + tablas nuevas | Implementado |
| 2 | API: perfiles dinamicos (CRUD) | Implementado |
| 3 | API: prohibiciones por producto | Implementado |
| 4 | API: cola de aprobacion pendiente | Implementado |
| 5 | Federation: sync perfiles + prohibiciones | Implementado |
| 6 | Web UI: crear perfil, prohibiciones, cola | Implementado |
| 7 | Migrar perfiles hardcodeados a DB | Implementado |
| 8 | Documentacion | Implementado |
| 9 | Verificacion y commit | Implementado |

## Preguntas abiertas

1. **Match de productos:** Como manejar productos con nombres diferentes
   en distintos nodos? (ej: "Chorizo" vs "Chorizo de cerdo"). Opcion
   propuesta: match por contains + categoria, con revision manual.

2. **Conflictos:** Que pasa si un nodo reporta "Carne" como prohibida y
   otro reporta "Carne de res" como permitida? Opcion: cada prohibicion
   es independiente. El admin decide localmente.

3. **Versionado de perfiles:** Si un perfil cambia sus reglas base,
   como se propaga? Opcion: el perfil tiene version, y los cambios
   se propagan via gossip como una actualizacion del perfil.

4. **Perfiles sub-tipo:** Como manejar "adventista" vs "adventista
   reforma"? Opcion: son perfiles independientes. "adventista reforma"
   hereda las reglas de "adventista" + las suyas propias. (No implementado
   en la fase 1 — cada perfil es independiente.)
