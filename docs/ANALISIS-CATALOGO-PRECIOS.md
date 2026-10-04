# Análisis del Sistema de Catálogo y Precios

Estudio completo de cómo funciona la página de productos, cómo se calculan los precios, de dónde salen los datos y qué hay que cambiar para llegar al modelo objetivo: **materia prima federada global + productos de nodo exclusivamente compuestos**.

---

## 1. Cómo funciona la página hoy

### 1.1 La tabla `products` mezcla tres cosas distintas

Una sola tabla (`products`) contiene, distinguidas solo por columnas:

| Tipo de fila | Marca actual | Quién la ve |
|---|---|---|
| **Materia prima / catálogo mundial** | `is_system = true` | Todos los nodos (se siembra en cada dominio) |
| **Producto de catálogo del nodo** | `node_domain = '__LOCAL__'` (o `localhost`/`default`), `is_composite = false` | El nodo local; otros lo ven en "Federación" |
| **Producto compuesto** | `is_composite = true` | El nodo que lo creó |
| **Producto importado de otro nodo** | `source_node`/`source_product_id` poblados | El nodo que lo importó |

Los `node_domain` presentes: el real del nodo, `'localhost'`, `'default'`, y dominios de nodos federados. Las consultas casi siempre usan `node_domain IN ($1, 'localhost', 'default')`.

### 1.2 La UI de catálogo (Products.tsx)

Tres pestañas:

- **Federación** → `GET /api/products/federated` — todos los `node_domain`, sin compuestos ni ocultos.
- **Mi Nodo** → `GET /api/products` — dominio local + `localhost` + `default`, sin compuestos. Sub-tabs Permitidos/No permitidos (`is_allowed`).
- **Compuestos** → `GET /api/products/composite` — `is_composite = true` del dominio local.

### 1.3 La tienda (Store.tsx)

Dos modos de crear un item:

- **Producto del catálogo** (simple): elige un producto aprobado, pone precio manual + costos extra → `store_items`.
- **Producto compuesto** (default): arma el producto desde `GET /api/products/components`, el precio = Σ componentes → `store_items` con `is_composite = true` + filas en `product_compositions`.

El selector de componentes (`listComponents`, `internal/api/external.go:855`) filtra por categoría:

| `?category=` | Filtro SQL actual |
|---|---|
| `materia_prima` | `subcategory = 'Materia Prima'` ← **roto** (ver §5.1) |
| `producto_base` | `is_composite = true` |
| `trabajo` | `unit = 'hora'` |
| `embalaje` | `parent_category = 'Embalaje'` |
| `envio` | `parent_category = 'Envio'` |

### 1.4 Aprobaciones actuales

- **Producto de nodo**: asamblea/junta local — propuestas `product_approval`, `product_disapproval`, `product_remove`, `product_import` (migración 105; defaults: approve junta 50%, remove asamblea 66.67%, import asamblea 50%).
- **Producto federado (nodo a nodo)**: `product_federation_proposals` — un nodo propone, cada nodo aprueba individualmente (`/api/federation/products/{id}/approve`).
- **Decisiones globales de la Federación**: `federation_proposals` + `federation_votes` — consenso `fc_approval_threshold` (default 75%) del total de nodos; `applyProposal` ejecuta. Tipos actuales: `change_constant`, `expel_node`, `upgrade_node_level`, `create_node_level`, `edit_node_level`.

---

## 2. Cómo se calculan los precios

**TQ = Trueque = 1 kWh de energía incorporada.** Todos los precios internos son energía.

### 2.1 Modelo energético directo (`internal/pricing/calculator.go`)

```
energy_total  = energy_direct + energy_human + energy_inputs + energy_amortization
price_per_unit = energy_total / quantity_per_batch
```

- `energy_direct`: kWh de electricidad/combustible del proceso.
- `energy_human`: `horas_humanas × tarifa(tipo_trabajo)` (ver 2.2).
- `energy_inputs`: kWh de insumos/materiales.
- `energy_amortization`: kWh de amortización de herramientas/infraestructura.

`energy_total` es columna generada (STORED) desde la migración 046.

### 2.2 Tarifa laboral del nodo (`energy_tariff`)

Configurada por cada nodo en NodeSettings (`GET/PUT /api/calculator/tariff`):

```
base_hora = (vital_food + vital_water + vital_domestic + vital_services) / work_hours_per_day
```

Defaults: 800+150+350+200 = 1500 TQ/mes ÷ 6 h/día → 250 TQ/hora base.

Multiplicadores por tipo de trabajo (`RateForLaborType`):

| labor_type | factor |
|---|---|
| admin | × effort_admin (def 1.0) |
| technical | × effort_technical (def 1.15) |
| agricultural | × effort_agricultural (def 1.3) |
| (otro) | × 1.0 |

Los cambios de tarifa pasan por gobernanza (`energy_tariff_changes`, migración 014).

### 2.3 Modelo precio-por-peso (migraciones 086–088)

Para items sembrados con precio de referencia mundial:

```
suggested_price = price_per_kg (base_price en unidad natural) × weight_kg
```

`base_unit` ∈ {kg, L, unidad}. `scanProductRows` genera `price_calculation` explicativo ("2.50 TQ/kg × 0.65 kg = 1.63 TQ").

### 2.4 Modelo compuesto (migración 042)

```
precio = Σ (component_price × quantity)
```

`product_compositions` guarda el `component_price` **congelado al momento de crear** — si el precio base cambia después, el compuesto no se recalcula (defecto §5.6).

### 2.5 Precio externo (puente USD → TQ)

`CalculateExternal`: `price_usd × (1 + logistics%) × factor_conversión + tax`. Usa `conversion_factor` activo del nodo. Solo para comercio exterior, no afecta el trueque interno.

---

## 3. De dónde salen los datos (fuentes de precios/energía)

**No hay consulta en runtime a ninguna librería.** Todo son valores embebidos en seeds y migraciones, calculados offline a partir de bases de datos públicas:

| Fuente | Qué aporta | Dónde está embebida |
|---|---|---|
| **ICE Database** (Univ. of Bath) | Energía incorporada de ~300 materiales de construcción | migraciones 037, 042, 089; seed.go |
| **Agribalyse** (ADEME/INRAE, Francia) | Energía de ~200 productos agrícolas farm-gate | migración 089, 093; seed.go |
| **Ecoinvent** | Materiales industriales | migraciones 089, 037 |
| **FAO** | Producción animal | migración 089 |
| **Pimentel & Pimentel** | Energía en alimentos | migraciones 089, 093 |
| **OEcotextiles** | Fibras textiles | migración 089 |
| Estudios LCA (UK, EU, Irán, Albania, Canadá, Nigeria, Turquía) | Valores puntuales | migración 089 |
| Estándar interno | 1 TQ = 1 kWh = 3.6 MJ; trabajo: 0.61 kWh/h agrícola, 1.0 general, 3.0 técnico | seed.go (~L2297) |

### El catálogo se siembra desde DOS orígenes

1. **`internal/db/seed.go`** — `products[]` con ~416 entradas (`is_system=true, is_approved=true`), con correcciones de migraciones 085–095 aplicadas en la misma función.
2. **Migraciones con INSERT** — 037 (71), 038 (28), 089 (80 materias primas), 090, 093–095 (Feria Conuquera), 018, 026, 027, 040, 041, 042…

Las migraciones insertan `SELECT ... FROM (SELECT DISTINCT node_domain FROM products)` — replican cada fila en todos los dominios existentes al momento de correr.

### Sistema paralelo: `calculator_parameters` (migración 010)

Tabla separada con `parameter_type ∈ {work, material}`, `kwh_per_unit`, `effort_factor` — usada por la página Calculator. **Duplicación conceptual** con `products`: el mismo material/trabajo existe en dos tablas con seeds distintos.

---

## 4. Tablas involucradas

| Tabla | Rol |
|---|---|
| `products` | Todo: materia prima, catálogo, compuestos, importados |
| `product_compositions` | Componentes de un compuesto (de products o store_items) |
| `store_items` | Items a la venta en la tienda del nodo |
| `energy_tariff` | Necesidades vitales → tarifa/hora del nodo |
| `energy_tariff_changes` | Propuestas de cambio de tarifa |
| `conversion_factor` | Factor USD→TQ activo del nodo |
| `product_federation_proposals` | Propagación nodo-a-nodo de productos |
| `federation_proposals` / `federation_votes` | Consenso global (75% default) |
| `federation_constants` | Constantes configurables (`fc_approval_threshold`…) |
| `product_allowlist` | Productos permitidos/prohibidos por nodo (`is_allowed`) |
| `calculator_parameters` | Parámetros work/material (duplicado de products) |
| `product_price_history` | Historial de cambios de precio |
| `product_producers` | Quiénes producen cada producto |

---

## 5. Defectos e inconsistencias encontrados

### 5.1 El selector de materia prima está roto
`listComponents` filtra `subcategory = 'Materia Prima'` exacto, pero la migración 089 siembra ~80 materias primas con subcategorías descriptivas (`Hortalizas`, `Frutas`, `Tuberculos`, `Granos`, `Materiales`…). Solo ~14 de ~90 aparecen en el selector. **El filtro necesita `item_type`, no texto de subcategoría.**

### 5.2 No hay dominio federado
`is_system=true` marca "global" pero las filas viven en `node_domain` del nodo/local. Nada garantiza que todos los nodos tengan el mismo set ni que nadie lo edite localmente.

### 5.3 Tres modelos de precio sin frontera clara
Energético (energy_*), precio-por-peso (price_per_kg × weight_kg) y compuesto (Σ componentes) coexisten; un mismo producto puede tener valores incoherentes entre los tres.

### 5.4 Duplicación products ↔ calculator_parameters
Mismo concepto (material con kWh/unidad) en dos tablas con seeds independientes.

### 5.5 Precio de componente congelado
`product_compositions.component_price` se copia al crear el compuesto — los compuestos no reflejan cambios posteriores del precio base federado.

### 5.6 Propagación federada stubbeada
`federation.Client.SendMessage` retorna nil; `BroadcastProductProposal` solo loguea. Los endpoints `remoteProposal`/`remoteVote` existen pero nada los invoca — cada nodo solo ve propuestas locales. El consenso funciona dentro de un nodo; la difusión automática está incompleta.

### 5.7 Sin garantía composite-only ni piso de precio
Nada impide vender materia prima directa ni poner precio por debajo del costo de componentes.

---

## 6. Arquitectura objetivo

### 6.1 División en dos dominios

```
node_domain = '__FEDERATION__'   → catálogo global, idéntico en todos los nodos
                                   item_type: raw_material | base_product | service
                                              | packaging | shipping
                                   cambios SOLO por consenso federado (75%)

node_domain = '__LOCAL__'        → productos del nodo, TODOS compuestos
                                   item_type = 'composite'
                                   precio = Σ componentes federados × cantidad
                                          + trabajo local (tarifa del nodo)
                                          + embalaje/envío (variables del nodo)
```

### 6.2 Reglas

1. **La materia prima es federada**: frutas, hortalizas, carnes, pescado, granos, hierro, plástico, madera, tierra, arcilla, azúcar, harina, aceite… — lo que la Federación apruebe como componente válido. No se vende directa.
2. **Todo producto de nodo es compuesto**: se arma desde el catálogo federado + trabajo/embalaje/envío.
3. **Precio federado = piso**: el compuesto no puede salir por debajo de la suma de componentes a precio base.
4. **Trabajo**: valorado con `energy_tariff` del nodo (necesidades vitales ÷ horas/día × multiplicador).
5. **Embalaje/envío**: items base federados + variables propias del nodo.
6. **Identidad estable**: `catalog_key` (ej. `raw-tomate-fresco`) único e idéntico en todos los nodos — los upserts federados lo usan como clave.

### 6.3 Gobernanza del catálogo

Nuevos `proposal_type` en `federation_proposals`:

- `catalog_item_upsert` — payload = item completo `{catalog_key, name, description, item_type, parent_category, category, subcategory, unit, base_unit, price_per_kg, weight_kg, energy_*}` → `applyProposal` hace upsert por `catalog_key`.
- `catalog_item_remove` — key = `catalog_key` → marca el item como inactivo/oculto.

Umbral: `fc_approval_threshold` (75% default, configurable). Como cada nodo aplica el mismo upsert por `catalog_key`, todos convergen al mismo catálogo.

### 6.4 Limpieza del catálogo actual

1. **Exportar primero** → `exports/catalogo-productos.{json,sql,md}` (generado desde seed.go + migraciones).
2. Migración 182: añade `catalog_key` + `item_type`, siembra el catálogo `__FEDERATION__`, borra todo lo que no sea federado ni compuesto válido (FK CASCADE limpia composiciones/store_items huérfanos).

---

## 7. Archivos clave

| Archivo | Rol |
|---|---|
| `internal/db/migrations/001` | `products`, `energy_tariff`, `conversion_factor` |
| `internal/db/migrations/010` | `calculator_parameters` (duplicado) |
| `internal/db/migrations/042` | `product_compositions`, `is_composite`, embalaje/envío |
| `internal/db/migrations/043` | `product_federation_proposals` |
| `internal/db/migrations/076` | `federation_proposals`/`votes` + consenso |
| `internal/db/migrations/086–088` | `price_per_kg`, `weight_kg`, `base_unit` |
| `internal/db/migrations/089` | ~80 materias primas (subcategorías descriptivas) |
| `internal/db/seed.go` | Seed principal ~416 productos |
| `internal/pricing/calculator.go` | Motor de cálculo |
| `internal/api/external.go` | `listComponents`, `addCompositeItem` |
| `internal/api/system.go` | CRUD + listados de productos |
| `internal/api/federation_gov.go` | Propuestas, votos, `applyProposal` |
| `web/src/pages/Products.tsx` | 3 pestañas del catálogo |
| `web/src/pages/Store.tsx` | Constructor de compuestos |
| `web/src/pages/NodeSettings.tsx` | Tarifa vital del nodo |

## 8. Datos preservados

El catálogo completo actual (~500+ productos entre seed y migraciones) se exporta antes de la limpieza en tres formatos bajo `exports/`:

- `catalogo-productos.json` — todos los campos
- `catalogo-productos.sql` — INSERTs reproducibles
- `catalogo-productos.md` — documento legible por categoría
