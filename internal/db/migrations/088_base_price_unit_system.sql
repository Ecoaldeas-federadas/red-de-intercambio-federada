-- Migracion 088: Sistema completo de precio base + unidad base + calculo
--
-- El sistema ahora muestra:
-- 1. base_price: precio de la base de datos mundial (en su unidad natural)
-- 2. base_unit: unidad del precio base (kg, L, unidad, docena, etc.)
-- 3. product_weight: cuanto pesa/mide el producto que se ofrece
-- 4. price_per_unit: precio calculado = base_price * product_weight (en base_unit)
--
-- Ejemplo huevos:
--   base_price = 4 TQ (por kg, base de datos mundial)
--   base_unit = kg
--   product_weight = 0.65 (una docena pesa 0.65 kg)
--   price_per_unit = 4 * 0.65 = 2.6 -> 3 TQ
--   Calculo mostrado: "4 TQ/kg x 0.65 kg = 2.6 TQ"

-- Agregar columna base_unit (unidad del precio base: kg, L, unidad, docena)
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) DEFAULT 'kg';

-- Renombrar price_per_kg conceptualmente a base_price
-- (mantenemos la columna price_per_kg por compatibilidad pero ahora
--  representa el precio base de la base de datos mundial)

-- === ASIGNAR base_unit SEGUN EL TIPO DE PRODUCTO ===

-- Productos por kilo (mayoria de alimentos solidos)
UPDATE products SET base_unit = 'kg' WHERE base_unit = '' OR base_unit IS NULL;
UPDATE products SET base_unit = 'kg' WHERE unit = 'kg';

-- Productos por litro (liquidos)
UPDATE products SET base_unit = 'L' WHERE name IN (
  'Leche Fresca', 'Aceites y Vinagres', 'Aceite Vegetal',
  'Miel Pura de Abejas', 'Miel 1L',
  'Bebidas Fermentadas',
  'Detergentes y Suavizantes Naturales',
  'Bioinsumos y Preparados',
  'Pinturas y Recubrimientos Naturales'
);

-- Huevos: base de datos mundial da energia por kg de huevo
UPDATE products SET base_unit = 'kg' WHERE name = 'Huevos Frescos';

-- Diesel: por litro
UPDATE products SET base_unit = 'L' WHERE name = 'Diesel Agricola';

-- === ACTUALIZAR price_per_kg (base_price) CON VALORES DE LA BASE MUNDIAL ===
-- Estos son los valores reales de la base de datos mundial (Agribalyse, FAO,
-- Pimentel, Ecoinvent, ICE Database) en la unidad natural del producto.

-- Huevos: 4 TQ/kg (base de datos mundial: ~15 MJ/kg = 4.2 kWh/kg)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 0.65
WHERE name = 'Huevos Frescos';

-- Pollo: 5 TQ/kg (base: ~18 MJ/kg)
UPDATE products SET price_per_kg = 5, base_unit = 'kg', weight_kg = 1
WHERE name = 'Carnes de Pollo y Aves';

-- Cerdo: 6 TQ/kg (base: ~20 MJ/kg)
UPDATE products SET price_per_kg = 6, base_unit = 'kg', weight_kg = 1
WHERE name = 'Carnes de Cerdo y Chivo';

-- Vacuno: 11 TQ/kg (base: ~40 MJ/kg)
UPDATE products SET price_per_kg = 11, base_unit = 'kg', weight_kg = 1
WHERE name = 'Carnes de Vacuno';

-- Pescado: 7 TQ/kg (base: ~25 MJ/kg)
UPDATE products SET price_per_kg = 7, base_unit = 'kg', weight_kg = 1
WHERE name = 'Pescados y Mariscos';

-- Leche: 2 TQ/L (base: ~6 MJ/L)
UPDATE products SET price_per_kg = 2, base_unit = 'L', weight_kg = 1
WHERE name = 'Leche Fresca';

-- Lacteos: 8 TQ/kg (base: 25-36 MJ/kg)
UPDATE products SET price_per_kg = 8, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Lacteos Artesanales', 'Quesos Artesanales de Bufala y Cabra');

-- Granos: 3 TQ/kg (base: ~10 MJ/kg conuco)
UPDATE products SET price_per_kg = 3, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Granos Basicos Criollos', 'Granos basicos (maiz, frijol) 1kg');

-- Arroz: 4 TQ/kg (base: ~14 MJ/kg conuco)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1
WHERE name = 'Arroz y Legumbres';

-- Harinas: 4 TQ/kg (base: ~14 MJ/kg)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Harinas Integrales', 'Harina de maiz 50kg');

-- Verduras: 2 TQ/kg (base: ~5-7 MJ/kg conuco)
UPDATE products SET price_per_kg = 2, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Hojas Verdes y Aromaticas', 'Hortalizas y Hojas Verdes de El Junquito',
  'Tuberculos Ancestrales y Platanos', 'Verduras y Hortalizas de Conuco', 'Verduras frescas 1kg',
  'Raices y Bulbos');

-- Frutas: 2 TQ/kg (base: ~2.8 MJ/kg farm-gate + procesamiento)
UPDATE products SET price_per_kg = 2, base_unit = 'kg', weight_kg = 1
WHERE name = 'Frutas de Temporada';

-- Panaderia: 4 TQ/kg (base: ~14 MJ/kg artesanal)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1
WHERE name = 'Panaderia y Masas Caseras';

-- Papelon: 5 TQ/kg (base: ~18 MJ/kg tradicional)
UPDATE products SET price_per_kg = 5, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Papelon y Panela', 'Azucar y Edulcorantes');

-- Aceites: 6 TQ/L (base: ~20 MJ/L prensado frio)
UPDATE products SET price_per_kg = 6, base_unit = 'L', weight_kg = 1
WHERE name IN ('Aceites y Vinagres', 'Aceite Vegetal');

-- Dulces: 5 TQ/kg (base: ~18 MJ/kg), frasco ~0.5 kg
UPDATE products SET price_per_kg = 5, base_unit = 'kg', weight_kg = 0.5
WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas');

-- Cacao: 15 TQ/kg (base: ~54 MJ/kg artesanal)
UPDATE products SET price_per_kg = 15, base_unit = 'kg', weight_kg = 1
WHERE name IN ('Cacao, Chocolate y Cafe', 'Cacao Puro, Chocolates y Cafe de Montana');

-- Miel: 7 TQ/L (base: ~25 MJ/kg)
UPDATE products SET price_per_kg = 7, base_unit = 'L', weight_kg = 1
WHERE name IN ('Miel Pura de Abejas', 'Miel 1L');

-- Bebidas fermentadas: 3 TQ/L (base: ~10 MJ/L)
UPDATE products SET price_per_kg = 3, base_unit = 'L', weight_kg = 1
WHERE name = 'Bebidas Fermentadas';

-- Infusiones: 3 TQ/kg (base: ~10 MJ/kg)
UPDATE products SET price_per_kg = 3, base_unit = 'kg', weight_kg = 1
WHERE name = 'Infusiones y Tes';

-- Especias: 4 TQ/kg (base: ~14 MJ/kg)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1
WHERE name = 'Especias y Condimentos';

-- Hierbas medicinales: 3 TQ/kg (base: ~10 MJ/kg)
UPDATE products SET price_per_kg = 3, base_unit = 'kg', weight_kg = 1
WHERE name = 'Hierbas Medicinales Secas';

-- Hongos: 3 TQ/kg (base: ~10 MJ/kg)
UPDATE products SET price_per_kg = 3, base_unit = 'kg', weight_kg = 1
WHERE name = 'Hongos Comestibles';

-- Plaguicidas: 2 TQ/L (base: ~7 MJ/L)
UPDATE products SET price_per_kg = 2, base_unit = 'L', weight_kg = 1
WHERE name = 'Plaguicidas Naturales';

-- Abonos: 0.09 TQ/kg (base: ~0.3 MJ/kg), saco 25 kg
UPDATE products SET price_per_kg = 0.09, base_unit = 'kg', weight_kg = 25
WHERE name = 'Abonos Organicos';

-- Fertilizantes: 0.09 TQ/kg
UPDATE products SET price_per_kg = 0.09, base_unit = 'kg', weight_kg = 1
WHERE name = 'Fertilizantes Organicos';

-- Bioinsumos: 3 TQ/L (base: ~10 MJ/L)
UPDATE products SET price_per_kg = 3, base_unit = 'L', weight_kg = 1
WHERE name = 'Bioinsumos y Preparados';

-- Tierra/Sustratos: 0.05 TQ/kg, saco 20 kg
UPDATE products SET price_per_kg = 0.05, base_unit = 'kg', weight_kg = 20
WHERE name = 'Tierra Fertil y Sustratos';

-- Lena: 4 TQ/kg (base: 15.3 MJ/kg)
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1
WHERE name = 'Lena Seca para Cocinar';

-- Carbon: 6 TQ/kg (base: ~22 MJ/kg)
UPDATE products SET price_per_kg = 6, base_unit = 'kg', weight_kg = 1
WHERE name = 'Carbon Vegetal';

-- Diesel: 12 TQ/L (base: 41.7 MJ/L)
UPDATE products SET price_per_kg = 12, base_unit = 'L', weight_kg = 1
WHERE name = 'Diesel Agricola';

-- Pinturas: 4 TQ/L (base: ~15 MJ/L)
UPDATE products SET price_per_kg = 4, base_unit = 'L', weight_kg = 1
WHERE name = 'Pinturas y Recubrimientos Naturales';

-- Detergentes: 5 TQ/L (base: ~18 MJ/L)
UPDATE products SET price_per_kg = 5, base_unit = 'L', weight_kg = 1
WHERE name = 'Detergentes y Suavizantes Naturales';

-- === RECALCULAR price_per_unit = base_price * weight ===
-- Para productos donde base_unit = kg: price = price_per_kg * weight_kg
-- Para productos donde base_unit = L: price = price_per_kg * weight_kg (weight_kg = volumen en L)
UPDATE products SET price_per_unit = ROUND(price_per_kg * weight_kg)
WHERE price_per_kg > 0 AND weight_kg > 0
  AND unit NOT IN ('kg', 'litro', 'L');

-- Para productos por kg o L, price_per_unit = price_per_kg (base)
UPDATE products SET price_per_unit = price_per_kg
WHERE price_per_kg > 0 AND unit IN ('kg', 'litro', 'L')
  AND weight_kg = 1;
