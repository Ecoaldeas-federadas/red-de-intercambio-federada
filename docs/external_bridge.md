# Puente de Comercio Externo

## Archivos
- `internal/external/dex.go` - Factor de conversion (FC) y operaciones externas
- `internal/external/store.go` - Tienda comunitaria
- `internal/api/external.go` - Handlers API REST

## Factor de Conversion (FC)

### Concepto
El FC es el factor que convierte entre moneda interna (energia, en unidades de trueque) y moneda externa (USD). Permite que la comunidad interactue con el mercado externo sin usar dinero fiat internamente.

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
- `internal_value`: valor en moneda interna
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
La tienda comunitaria permite a los miembros comprar productos usando su saldo interno. Los productos pueden ser producidos internamente o importados.

### Items
- `GET /api/store/items`: lista items disponibles
- `POST /api/store/items`: crea item (nombre, descripcion, precio, stock, product_id)
- Campos: name, description, price, stock, image_url, product_id, is_active

### Compra
- `POST /api/store/buy/{id}`: compra item
- Valida: stock disponible, saldo del comprador, limites
- Crea transaccion: debit comprador, credit vendedor
- Reduce stock
