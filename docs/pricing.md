# Modulo de Precios

## Archivos
- `internal/pricing/` - Calculadora energetica, catalogo de productos, tarifas
- `internal/db/seed.go` - Catalogo base de productos (materias primas, productos terminados)
- `internal/db/migrations/038_energy_realigned_catalog.sql` - Catalogo realineado
- `internal/db/migrations/041_artisanal_products_by_material_weight.sql` - Productos por kg

## Modelo Energetico

### Unidad de medida
- **1 TQ = 1 kWh** (convencion de trabajo del proyecto)
- TQ **no es dinero**: registra energia, contribuciones y compromisos
- No es bancario, no genera intereses, no es instrumento financiero

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

## Estandar Internacional: ICE Database

El catalogo usa el estandar **ICE Database (University of Bath / SERT)** para
energia incorporada por kg de material. La energia se calcula por **mas de material**,
no por "unidad" ambigua.

### Factores de energia incorporada (MJ/kg)

| Material | MJ/kg | TQ/kg | Fuente |
|----------|-------|-------|--------|
| Arcilla/ceramica | 2.5 | 0.7 | ICE Database |
| Madera blanda (secado aire) | 0.3 | 0.08 | ICE Database |
| Madera dura (secado horno) | 2.0 | 0.56 | ICE Database |
| Fibra vegetal | 0.5 | 0.14 | Estimacion comunitaria |
| Algodon/tela | 143 | 39.7 | ICE Database, Ecoinvent |
| Lana | 67.5 | 18.75 | ICE Database |
| Vidrio | 12.7 | 3.5 | ICE Database |
| Papel kraft | 25 | 6.9 | ICE Database |

### Formula de precio para productos terminados
```
precio = (kg_material x energia_por_kg) + (horas_trabajo x 1 TQ) + coccion
```

**Ejemplo: Olla de barro de 2 kg**
- Material: 2 kg x 2.5 MJ/kg = 5 MJ
- Coccion: 18 MJ
- Trabajo: 3 horas x 3.6 MJ = 10.8 MJ
- Total: 33.8 MJ = 9.4 TQ -> precio: 8 TQ

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

### Estructura jerarquica
1. **Categoria padre** (ej: Artesania, Textiles, Construccion)
2. **Categoria** (ej: Ceramica, Madera, Confeccion)
3. **Subcategoria** (ej: Materia Prima, Vajilla, Macetas, Trabajo)

### Tipos de productos en el catalogo
| Tipo | Descripcion | Ejemplo |
|------|-------------|---------|
| Materia prima | Vendida por kg, m, L | Arcilla 1 TQ/kg, Tela 40 TQ/kg |
| Producto terminado | Peso y dimensiones definidas | Taza 0.3 kg = 2 TQ |
| Trabajo artesanal | Vendido por hora | Alfareria 1 TQ/hora |
| Embalaje | Envases reutilizables | Vidrio 200ml = 2 TQ |
| Envio | Costos de entrega | Local 1 TQ, Lejano 15 TQ |

### Tabla `products`
- name, parent_category, category, subcategory
- origin (internal/external/federated)
- unit (kg, m, unidad, hora, rollo, carga, entrega)
- quantity_per_batch, quantity_per_unit
- Componentes de energia por unidad
- price_per_unit (en TQ)
- external_price_usd (precio de referencia externo)
- is_approved, approved_by
- is_composite (marcar productos compuestos)
- is_hidden (ocultar del catalogo publico)
- source_node, source_product_id (para productos federados)

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

## Pagina Publica de Metodologia

La pagina publica explica:
- Que TQ no es dinero
- Que registra energia, contribuciones y compromisos
- La metodologia basada en ICE Database
- Los factores de energia incorporada por material
- Las limitaciones de los datos
- Las fuentes consultadas
