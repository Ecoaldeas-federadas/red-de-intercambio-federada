# Productos Compuestos

## Archivos
- `internal/api/external.go` - Handlers API para productos compuestos
- `internal/external/store.go` - Logica de tienda y compra
- `internal/db/migrations/042_composite_products_system.sql` - Esquema de composiciones
- `internal/db/migrations/044_store_items_hierarchy.sql` - Jerarquia de 3 niveles en store_items
- `web/src/pages/Store.tsx` - Formulario de producto compuesto con modal de busqueda

## Concepto

Un **producto compuesto** es un producto creado por un usuario a partir de
materias primas y productos base del catalogo aprobado. El precio se calcula
**automaticamente** sumando el precio de cada componente. El usuario **no
ingresa el precio manualmente**.

## Modelo de Calculo por Rendimiento

### El Problema

Si un productor hace jugo de naranja, necesita saber cuanto cuesta cada envase.
No basta con saber que la naranja cuesta 2 TQ/kg — necesita saber cuanta
naranja va en cada envase.

### La Solucion: Cantidad Comprada + Rendimiento

El sistema usa un modelo de **cantidad comprada + rendimiento**:

1. El productor especifica **cuanto compro** (ej: 1 kg de naranjas)
2. El productor especifica **cuantos productos salen** (ej: 50 envases de 200ml)
3. El sistema calcula automaticamente:
   - Cantidad por producto = 1 kg / 50 = 0.02 kg por envase
   - Costo por producto = 2 TQ/kg x 0.02 kg = 0.04 TQ por envase

### Ejemplo: Jugo de Naranja (envase 200ml)

| Componente | Comprado | Rendimiento | Costo por envase |
|-----------|----------|-------------|-----------------|
| Naranjas | 1 kg (2 TQ/kg) | 50 envases | 0.04 TQ |
| Azucar/panela | 0.2 kg (15 TQ/kg) | 50 envases | 0.06 TQ |
| Envase de vidrio | 50 unidades (0.5 TQ/u) | 50 envases | 0.50 TQ |
| Trabajo (exprimido + envasado) | 2 horas (1 TQ/h) | 50 envases | 0.04 TQ |
| Transporte | 5 km (0.5 TQ/km) | 50 envases | 0.05 TQ |
| **TOTAL por envase** | | | **0.69 TQ** |

Precio redondeado: **1 TQ por envase de 200ml**

### Ejemplo: Maceta de arcilla

| Componente | Comprado | Rendimiento | Costo por unidad |
|-----------|----------|-------------|-----------------|
| Arcilla para Ceramica | 10 kg (1 TQ/kg) | 5 macetas | 2.0 TQ |
| Coccion de Ceramica | 1 carga (5 TQ) | 5 macetas | 1.0 TQ |
| Trabajo de Alfareria | 10 horas (1 TQ/h) | 5 macetas | 2.0 TQ |
| **TOTAL por maceta** | | | **5 TQ** |

## Modelo de 3 niveles

### 1. Catalogo global (lista de productos)
- **Materias primas** aprobadas por asamblea
- **Productos compuestos aprobados** por asamblea -> se vuelven "producto base"
- Los productos base pueden ser usados como componentes de otros compuestos
- Solo productos aprobados aparecen en el catalogo global
- Los productos pueden agruparse cuando tienen el mismo precio (ver [pricing.md](pricing.md))

### 2. Tienda (tipo Mercado Libre por nodo)
- Cualquier usuario crea productos compuestos personales
- **No requieren aprobacion de asamblea** porque usan componentes ya aprobados
- El precio se calcula automaticamente
- Visibles en la tienda del nodo para que todos los compren
- NO aparecen en el catalogo global de productos

### 3. Productos compuestos personales
- Solo en la tienda del creador
- Pueden comprarse por otros usuarios del nodo
- Si el producto se mueve a otro nodo federado, requiere aprobacion de ese nodo

## Categorias Jerarquicas (3 Niveles)

Al crear un producto compuesto, el usuario debe seleccionar su ubicacion en
la jerarquia de categorias:

1. **Categoria padre** (ej: Alimentacion, Artesania, Textiles)
2. **Categoria** (ej: Cosecha Fresca, Ceramica, Confeccion)
3. **Subcategoria** (opcional, ej: Frutas, Vajilla, Macetas)

### Reglas

- Las categorias **no se crean** por el vendedor
- El vendedor **navega** por la jerarquia existente
- Si una categoria no existe, la **administracion** debe crearla
- No hay campo de texto libre para categoria
- Los 3 niveles se envian al backend: `parent_category`, `category`, `subcategory`

### Endpoint de Categorias

```
GET /api/products/categories
```

Retorna la jerarquia de 3 niveles derivada de productos aprobados y visibles:

```json
{
  "categories": [
    {
      "parent_category": "Alimentacion",
      "categories": [
        {
          "category": "Cosecha Fresca",
          "subcategories": ["Frutas", "Tuberculos", "Verduras", "Hojas Verdes"]
        }
      ]
    }
  ]
}
```

## Categorias de Componentes

Al agregar componentes, el usuario usa un **modal de busqueda** con campo de
texto y filtro por categoria:

| Categoria | Descripcion | Ejemplos |
|-----------|-------------|----------|
| `materia_prima` | Materias primas del catalogo | Arcilla, madera, tela, lana, fibra, naranja |
| `producto_base` | Compuestos aprobados por asamblea | Vaso de arcilla, envase de barro |
| `trabajo` | Horas de trabajo | Alfareria, carpinteria, costura, cesteria |
| `embalaje` | Tipos de envase/embalaje | Vidrio, barro, tela, papel, hoja de platanero |
| `envio` | Costos de envio por distancia | Local, vecino, lejano, recogida |

### Busqueda de Componentes

El endpoint soporta busqueda de texto:

```
GET /api/products/components?search=naranja&category=materia_prima
```

La busqueda se realiza en:
- `name` (nombre del producto)
- `description` (descripcion del producto)
- `category` (categoria)
- `parent_category` (categoria padre)

Esto permite encontrar "Naranja" buscando por "naranja", incluso si el
producto esta dentro de un grupo como "Frutas de Temporada".

## Tabla `product_compositions`

```sql
CREATE TABLE product_compositions (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,           -- products.id o store_items.id
  product_type TEXT NOT NULL,         -- 'catalog' o 'store_item'
  component_product_id UUID,          -- materia prima o producto base
  component_name TEXT NOT NULL,       -- nombre del componente
  component_unit TEXT NOT NULL,       -- unidad del componente
  component_price BIGINT NOT NULL,    -- precio unitario al momento de crear
  quantity NUMERIC NOT NULL,          -- cantidad usada por producto
  subtotal BIGINT NOT NULL,           -- component_price * quantity
  component_category TEXT NOT NULL,   -- materia_prima, producto_base, trabajo, embalaje, envio
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
```

## Tabla `store_items` (con jerarquia)

```sql
-- Migracion 044: anade jerarquia de 3 niveles
ALTER TABLE store_items ADD COLUMN parent_category TEXT;
ALTER TABLE store_items ADD COLUMN subcategory TEXT;
-- category ya existia
```

## Endpoints API

### Crear producto compuesto
```
POST /api/store/composite
```
Body:
```json
{
  "product_name": "Jugo de naranja 200ml",
  "description": "Jugo natural de naranja recien exprimido",
  "parent_category": "Alimentacion",
  "category": "Bebidas",
  "subcategory": "Jugos Naturales",
  "stock": 10,
  "components": [
    {
      "component_product_id": "uuid-de-naranja",
      "component_name": "Naranja",
      "component_unit": "kg",
      "component_price": 2,
      "quantity": 0.02,
      "component_category": "materia_prima",
      "quantity_purchased": 1,
      "yield_products": 50
    },
    {
      "component_product_id": "uuid-de-envase-vidrio",
      "component_name": "Envase de Vidrio 200ml",
      "component_unit": "unidad",
      "component_price": 0.5,
      "quantity": 1,
      "component_category": "embalaje",
      "quantity_purchased": 50,
      "yield_products": 50
    }
  ]
}
```

Respuesta:
```json
{
  "item": { ... },
  "total_price": 1,
  "composition": "Naranja x0.02 (0.04 TQ), Envase de Vidrio 200ml x1.00 (0.50 TQ)",
  "components": [ ... ]
}
```

**Validaciones:**
- Cada componente debe estar aprobado en el nodo (`is_approved = true`)
- Si un componente no esta aprobado -> error 400
- El precio se toma del catalogo, no del cliente
- El precio total es la suma de subtotales, no editable
- Se requieren `parent_category` y `category` (subcategory es opcional)

### Ver composicion de un producto
```
GET /api/store/composite/{id}/composition
```
Retorna la lista de componentes con sus cantidades y subtotales.

### Listar componentes disponibles
```
GET /api/products/components?category=materia_prima&search=naranja
```
Parametros:
- `category` (opcional): `all`, `materia_prima`, `producto_base`, `trabajo`, `embalaje`, `envio`
- `search` (opcional): texto a buscar en nombre, descripcion, categoria y categoria padre

### Listar categorias jerarquicas
```
GET /api/products/categories
```
Retorna la jerarquia de 3 niveles para los selectores en cascada.

## Verificacion de Compra

Cuando un usuario compra un producto compuesto, el sistema verifica que
**todos** los componentes del producto esten aprobados en el nodo local.

Si algun componente no esta aprobado, la compra se bloquea con el mensaje:
> "no se puede comprar: los siguientes componentes no estan aprobados en este nodo: [lista]"

Esto asegura que un producto compuesto de otro nodo solo se puede comprar
si todos sus materiales estan aprobados localmente.

## Productos Base de Embalaje y Envio

El catalogo incluye productos base para usar como componentes:

### Embalajes
| Producto | Precio | Descripcion |
|----------|--------|-------------|
| Envase de Vidrio 200ml | 2 TQ | Retornable |
| Envase de Vidrio 500ml | 2 TQ | Retornable |
| Envase de Vidrio 1L | 3 TQ | Retornable |
| Envase de Barro 500ml | 3 TQ | Artesanal |
| Bolsa de Tela de Algodon | 2 TQ | Reutilizable |
| Bolsa de Papel Kraft | 1 TQ | Reciclable |
| Hoja de Platanero | 1 TQ | Biodegradable |

### Envios
| Producto | Precio | Descripcion |
|----------|--------|-------------|
| Envio Local | 1 TQ | Dentro del nodo |
| Envio Vecino | 5 TQ | Nodo cercano federado |
| Envio Lejano | 15 TQ | Nodo distante federado |
| Recogida en Parcela | 0 TQ | Sin envio |

## Frontend

### Store.tsx - Formulario de producto compuesto

El formulario tiene dos modos:
1. **Producto Compuesto** (nuevo): selector de componentes con calculo automatico
2. **Producto del Catalogo** (simple): producto existente con stock y extras

#### Flujo de creacion de compuesto

1. Usuario ingresa nombre, descripcion, stock
2. Selecciona categoria jerarquica (3 niveles en cascada):
   - Categoria padre (dropdown)
   - Categoria (dropdown, filtrado por padre)
   - Subcategoria (dropdown opcional, filtrado por padre y categoria)
3. Click "Buscar y agregar componente" -> abre modal de busqueda
4. En el modal:
   - Escribe parte del nombre (ej: "naranja")
   - Filtra por categoria si quiere (materia_prima, trabajo, etc.)
   - Ve resultados con nombre, descripcion, ubicacion jerarquica y precio
   - Click en un resultado para seleccionarlo
5. Configura el componente seleccionado:
   - Cantidad que compro (ej: 1 kg)
   - Cuantos productos salen (ej: 50 envases)
   - El sistema muestra el calculo: costo por producto
6. Click "Agregar este componente" -> anade a la lista
7. Repite para cada componente
8. El sistema muestra precio total automatico (no editable)
9. Click "Publicar en Mi Tienda" -> crea el producto

#### Modal de busqueda de componentes

- Campo de texto para buscar por nombre o descripcion
- Filtros por categoria: Todos, Materias Primas, Productos Base, Trabajo, Embalaje, Envio
- Resultados muestran: nombre, descripcion, ubicacion jerarquica, precio por unidad
- Busca en nombre Y descripcion (por eso "naranja" encuentra items del grupo "Frutas de Temporada")

#### Visualizacion en tienda
- Etiqueta "Compuesto" en productos compuestos
- Muestra composicion desglosada (extra_description)
- Precio total con unidad
- Muestra jerarquia: Categoria padre > Categoria > Subcategoria
