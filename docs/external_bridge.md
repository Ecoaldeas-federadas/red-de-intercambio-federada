# Puente de Comercio Externo

## Archivos
- `internal/external/dex.go` - Factor de conversion (FC) y operaciones externas
- `internal/external/store.go` - Tienda comunitaria, productos compuestos, compra
- `internal/api/external.go` - Handlers API REST

## Factor de Conversion (FC)

### Concepto
El FC es el factor que convierte entre moneda interna (energia, en TQ) y moneda
externa (USD). Permite que la comunidad interactue con el mercado externo sin
usar dinero fiat internamente.

### Calculo
1. Se selecciona un producto de referencia (canasta basica)
2. Se compara precio interno (energia total) vs precio externo (USD)
3. `FC = precio_interno / precio_externo`
4. Se almacena en `conversion_factor` con: internal_cost, external_price_usd, factor, external_tax_rate

### Recalculo
- `POST /api/external/fc/recalculate`: recalcula FC basado en precios actuales
- Requiere aprobacion (segun reglas configuradas)

## Operaciones Externas

### Tipos
| Tipo | Descripcion |
|------|-------------|
| `import` | Importacion de producto externo |
| `export` | Exportacion de producto al mercado externo |

### Campos
- `product_id`, `product_name`: producto involucrado
- `quantity`: cantidad
- `internal_value`: valor en TQ
- `external_value_usd`: valor en USD
- `fc_applied`: FC aplicado a la operacion
- `buyer_seller`: contraparte externa
- `status`: pending, approved, rejected, completed

### Aprobacion
- Operaciones requieren aprobacion (segun monto y reglas)
- `POST /api/external/operations/{id}/approve`
- `POST /api/external/operations/{id}/reject`

## Tienda Comunitaria

### Concepto
La tienda comunitaria funciona como Mercado Libre por nodo. Cada usuario tiene
su propia tienda personal donde ofrece productos. Los productos pueden ser:
1. **Productos del catalogo** (con stock y costos adicionales)
2. **Productos compuestos** (creados con materias primas del catalogo)

### Tienda federada
- Cada nodo tiene su propia tienda
- Los usuarios pueden cambiar de nodo para comprar en tiendas de otros nodos
- Los productos compuestos de otros nodos requieren que todos sus componentes
  esten aprobados en el nodo del comprador

### Tabla `store_items`
- `product_id`: producto del catalogo (NULL si es compuesto)
- `product_name`, `description`, `category`
- `origin`: internal/external
- `price_trueque`: precio base
- `stock`: cantidad disponible
- `is_active`: activo/inactivo
- `owner_id`: dueno del item
- `unit`: unidad de venta
- `quantity_per_unit`: unidades por paquete
- `base_price`: precio base del catalogo
- `extra_costs`: costos adicionales (envio, envase)
- `final_price`: base + extra
- `extra_description`: descripcion de costos adicionales
- `is_composite`: es producto compuesto
- `composite_description`: composicion desglosada

### Endpoints de tienda

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/store/items` | Items de la tienda personal |
| POST | `/api/store/items` | Crea item del catalogo (simple) |
| GET | `/api/store/items/{id}` | Detalle de item |
| GET | `/api/store/all` | Todos los items de todas las tiendas del nodo |
| PUT | `/api/store/items/{id}/stock` | Actualiza stock |
| PUT | `/api/store/items/{id}/price` | Actualiza precio |
| DELETE | `/api/store/items/{id}` | Desactiva item |
| POST | `/api/store/purchase` | Compra item |
| POST | `/api/store/composite` | Crea producto compuesto (precio automatico) |
| GET | `/api/store/composite/{id}/composition` | Ver composicion de un compuesto |
| GET | `/api/products/components` | Lista componentes disponibles para compuestos |

### Crear item simple (del catalogo)
```
POST /api/store/items
```
Body:
```json
{
  "product_id": "uuid-del-producto",
  "stock": 10,
  "quantity_per_unit": 1,
  "extra_costs": 5,
  "extra_description": "Envase de vidrio retornable"
}
```

### Crear producto compuesto
```
POST /api/store/composite
```
Ver [composite_products.md](composite_products.md) para detalles completos.

### Compra
```
POST /api/store/purchase
```
Body:
```json
{
  "item_id": "uuid-del-item",
  "buyer_id": "uuid-del-comprador",
  "quantity": 2
}
```

**Validaciones al comprar:**
1. Stock disponible
2. Saldo del comprador
3. Limites de cuenta
4. Si es producto compuesto: todos los componentes deben estar aprobados
   en el nodo local. Si alguno no esta aprobado, la compra se bloquea.

### Paginacion
- `GET /api/products` soporta `limit` y `offset` para paginacion
- Frontend usa `IntersectionObserver` para infinite scroll
- `GET /api/store/all` lista todos los items de todas las tiendas del nodo

## Costos Adicionales

Los items de tienda pueden tener costos adicionales sobre el precio base:
- Envio a domicilio
- Envase especial (vidrio retornable, barro)
- Traslado
- Presentacion especial

El precio final se calcula como:
```
final_price = base_price + extra_costs
```

El campo `extra_description` explica que incluye el costo adicional.
