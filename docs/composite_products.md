# Productos Compuestos

## Archivos
- `internal/api/external.go` - Handlers API para productos compuestos
- `internal/external/store.go` - Logica de tienda y compra
- `internal/db/migrations/042_composite_products_system.sql` - Esquema de composiciones
- `web/src/pages/Store.tsx` - Formulario de producto compuesto

## Concepto

Un **producto compuesto** es un producto creado por un usuario a partir de
materias primas y productos base del catalogo aprobado. El precio se calcula
**automaticamente** sumando el precio de cada componente por su cantidad.
El usuario **no ingresa el precio manualmente**.

### Ejemplo: Jugo de naranja 200ml

| Componente | Categoria | Cantidad | Subtotal |
|------------|-----------|----------|----------|
| Naranja (materia prima) | materia_prima | 0.3 kg | 1 TQ |
| Agua (materia prima) | materia_prima | 0.15 L | 0 TQ |
| Envase de Vidrio 200ml | embalaje | 1 unidad | 2 TQ |
| Trabajo de Costura (hora) | trabajo | 0.5 h | 1 TQ |
| **Total automatico** | | | **4 TQ** |

### Ejemplo: Maceta de arcilla

| Componente | Categoria | Cantidad | Subtotal |
|------------|-----------|----------|----------|
| Arcilla para Ceramica | materia_prima | 2 kg | 2 TQ |
| Coccion de Ceramica en Horno | trabajo | 1 carga | 5 TQ |
| Trabajo de Alfareria | trabajo | 2 h | 2 TQ |
| **Total automatico** | | | **9 TQ** |

## Modelo de 3 niveles

### 1. Catalogo global (lista de productos)
- **Materias primas** aprobadas por asamblea
- **Productos compuestos aprobados** por asamblea -> se vuelven "producto base"
- Los productos base pueden ser usados como componentes de otros compuestos
- Solo productos aprobados aparecen en el catalogo global

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

## Categorias de Componentes

Al crear un producto compuesto, el usuario selecciona componentes del catalogo
aprobado. Los componentes se filtran por categoria:

| Categoria | Descripcion | Ejemplos |
|-----------|-------------|----------|
| `materia_prima` | Materias primas del catalogo | Arcilla, madera, tela, lana, fibra |
| `producto_base` | Compuestos aprobados por asamblea | Vaso de arcilla, envase de barro |
| `trabajo` | Horas de trabajo | Alfareria, carpinteria, costura, cesteria |
| `embalaje` | Tipos de envase/embalaje | Vidrio, barro, tela, papel, hoja de platanero |
| `envio` | Costos de envio por distancia | Local, vecino, lejano, recogida |

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
  quantity NUMERIC NOT NULL,          -- cantidad usada
  subtotal BIGINT NOT NULL,           -- component_price * quantity
  component_category TEXT NOT NULL,   -- materia_prima, producto_base, trabajo, embalaje, envio
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);
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
  "category": "Bebidas",
  "stock": 10,
  "components": [
    {
      "component_product_id": "uuid-de-naranja",
      "component_name": "Naranja",
      "component_unit": "kg",
      "component_price": 3,
      "quantity": 0.3,
      "component_category": "materia_prima"
    },
    {
      "component_product_id": "uuid-de-envase-vidrio",
      "component_name": "Envase de Vidrio 200ml",
      "component_unit": "unidad",
      "component_price": 2,
      "quantity": 1,
      "component_category": "embalaje"
    }
  ]
}
```

Respuesta:
```json
{
  "item": { ... },
  "total_price": 4,
  "composition": "Naranja x0.30 (1 TQ), Envase de Vidrio 200ml x1.00 (2 TQ)",
  "components": [ ... ]
}
```

**Validaciones:**
- Cada componente debe estar aprobado en el nodo (`is_approved = true`)
- Si un componente no esta aprobado -> error 400
- El precio se toma del catalogo, no del cliente
- El precio total es la suma de subtotales, no editable

### Ver composicion de un producto
```
GET /api/store/composite/{id}/composition
```
Retorna la lista de componentes con sus cantidades y subtotales.

### Listar componentes disponibles
```
GET /api/products/components?category=materia_prima
```
Parametros de categoria:
- `all` (default): todos los componentes aprobados
- `materia_prima`: solo materias primas
- `producto_base`: solo compuestos aprobados por asamblea
- `trabajo`: solo horas de trabajo
- `embalaje`: solo embalajes
- `envio`: solo costos de envio

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
1. Usuario ingresa nombre, descripcion, categoria, stock
2. Filtra componentes por categoria (materia_prima, trabajo, embalaje, envio)
3. Selecciona componente del dropdown
4. Ingresa cantidad
5. Click "Agregar" -> anade a la lista
6. Repite para cada componente
7. El sistema muestra precio total automatico (no editable)
8. Click "Publicar en Mi Tienda" -> crea el producto

#### Visualizacion en tienda
- Etiqueta "Compuesto" en productos compuestos
- Muestra composicion desglosada (extra_description)
- Precio total con unidad
