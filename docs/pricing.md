# Modulo de Precios

## Archivos
- `internal/pricing/` - Calculadora energetica, catalogo de productos, tarifas

## Calculo Energetico

### Componentes de Energia
| Componente | Descripcion |
|------------|-------------|
| `energy_direct` | Energia directa consumida (combustible, electricidad) |
| `energy_human` | Energia humana (horas de trabajo x tarifa) |
| `energy_inputs` | Insumos (materia prima, transporte de insumos) |
| `energy_amortization` | Amortizacion de herramientas/equipo |

### Formula
```
energy_total = energy_direct + energy_human + energy_inputs + energy_amortization
```

El `energy_total` es un campo calculado (GENERATED ALWAYS AS) en la tabla `products`.

## Tarifas Energeticas

Tabla `energy_tariff` (configurable por nodo):

| Categoria | Default (unidades) | Descripcion |
|-----------|--------------------|-------------|
| `vital_food` | 800 | Alimento vital por hora |
| `vital_water` | 150 | Agua vital por hora |
| `vital_domestic` | 350 | Trabajo domestico por hora |
| `vital_services` | 200 | Servicios basicos por hora |

### Esfuerzo
| Tipo | Factor | Descripcion |
|------|--------|-------------|
| `effort_admin` | 1.0 | Trabajo administrativo |
| `effort_technical` | 1.15 | Trabajo tecnico/especializado |
| `effort_agricultural` | 1.3 | Trabajo agricola/fisico |

### Parametros Laborales
- `work_hours_per_day`: 6 (default)
- `work_days_per_month`: 24 (default)

## Catalogo de Productos

### Tabla `products`
- name, category, origin (internal/external)
- unit, quantity_per_batch
- Componentes de energia por unidad
- price_per_unit (en moneda interna)
- external_price_usd (precio de referencia externo)
- external_logistics_pct, external_tax_rate
- is_approved, approved_by

### Productores
- `product_producers`: asocia productos con productores
- Cada productor tiene sus propios componentes de energia
- Permite desglosar el aporte de cada productor

### Historial de Precios
- `product_price_history`: registra cambios de precio
- Incluye old_price, new_price, change_reason, approved_by

## Calculadora

- `GET /api/pricing/calculate`: calcula precio energetico
- Parametros: producto, cantidad, productor (opcional)
- Retorna: desglose de energia, precio total, equivalencia externa
