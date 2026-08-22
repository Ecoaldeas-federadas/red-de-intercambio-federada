-- Migracion 087: Sistema inteligente de calculo de precios por peso
--
-- El sistema ahora tiene:
-- 1. price_per_kg: precio base por kilo (de la base de datos mundial)
-- 2. weight_kg: peso aproximado de una unidad del producto (ej: docena de huevos = 0.65 kg)
-- 3. price_per_unit: precio calculado = price_per_kg * weight_kg
--
-- Cuando alguien crea un producto con diferente cantidad/peso, el sistema
-- recalcula automaticamente el precio basado en el precio por kilo.

-- Agregar columna weight_kg (peso de una unidad en kilogramos)
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3) DEFAULT 0;

-- === PESOS APROXIMADOS POR PRODUCTO ===
-- Estos son pesos de referencia para que el sistema pueda calcular

-- Huevos: 1 docena = 12 huevos x ~54g = 0.648 kg
UPDATE products SET weight_kg = 0.650 WHERE name = 'Huevos Frescos';

-- Carnes: ya estan por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name IN ('Carnes de Pollo y Aves', 'Carnes de Cerdo y Chivo', 'Carnes de Vacuno', 'Pescados y Mariscos') AND weight_kg = 0;

-- Granos: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name IN ('Granos Basicos Criollos', 'Arroz y Legumbres', 'Harinas Integrales') AND weight_kg = 0;

-- Verduras y frutas: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE unit = 'kg' AND weight_kg = 0;

-- Leche: 1 litro = 1.03 kg
UPDATE products SET weight_kg = 1.03 WHERE name = 'Leche Fresca';

-- Aceites: 1 litro = ~0.92 kg
UPDATE products SET weight_kg = 0.92 WHERE name IN ('Aceites y Vinagres', 'Aceite Vegetal') AND weight_kg = 0;

-- Miel: 1 litro = ~1.42 kg
UPDATE products SET weight_kg = 1.42 WHERE name IN ('Miel Pura de Abejas', 'Miel 1L') AND weight_kg = 0;

-- Bebidas fermentadas: 1 litro = ~1 kg
UPDATE products SET weight_kg = 1 WHERE name = 'Bebidas Fermentadas' AND weight_kg = 0;

-- Detergentes: 1 litro = ~1 kg
UPDATE products SET weight_kg = 1 WHERE name = 'Detergentes y Suavizantes Naturales' AND weight_kg = 0;

-- Bioinsumos: 1 litro = ~1 kg
UPDATE products SET weight_kg = 1 WHERE name = 'Bioinsumos y Preparados' AND weight_kg = 0;

-- Abonos: 1 saco = ~25 kg
UPDATE products SET weight_kg = 25 WHERE name = 'Abonos Organicos' AND weight_kg = 0;

-- Tierra/Sustratos: 1 saco = ~20 kg
UPDATE products SET weight_kg = 20 WHERE name = 'Tierra Fertil y Sustratos' AND weight_kg = 0;

-- Papelon: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name IN ('Papelon y Panela', 'Azucar y Edulcorantes') AND weight_kg = 0;

-- Panaderia: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Panaderia y Masas Caseras' AND weight_kg = 0;

-- Especias: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Especias y Condimentos' AND weight_kg = 0;

-- Infusiones: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Infusiones y Tes' AND weight_kg = 0;

-- Hierbas medicinales: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Hierbas Medicinales Secas' AND weight_kg = 0;

-- Dulces: por kg, peso = 1 (frasco ~0.5 kg)
UPDATE products SET weight_kg = 0.5 WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas') AND weight_kg = 0;

-- Cacao: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name IN ('Cacao, Chocolate y Cafe', 'Cacao Puro, Chocolates y Cafe de Montana') AND weight_kg = 0;

-- Hongos: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Hongos Comestibles' AND weight_kg = 0;

-- Plaguicidas: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Plaguicidas Naturales' AND weight_kg = 0;

-- Fertilizantes: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Fertilizantes Organicos' AND weight_kg = 0;

-- Lena: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Lena Seca para Cocinar' AND weight_kg = 0;

-- Carbon: por kg, peso = 1
UPDATE products SET weight_kg = 1 WHERE name = 'Carbon Vegetal' AND weight_kg = 0;

-- Diesel: 1 litro = 0.832 kg
UPDATE products SET weight_kg = 0.832 WHERE name = 'Diesel Agricola' AND weight_kg = 0;

-- === RECULAR price_per_kg PARA PRODUCTOS POR KG ===
-- Si el producto es por kg, price_per_kg = price_per_unit
UPDATE products SET price_per_kg = price_per_unit
WHERE unit = 'kg' AND (price_per_kg IS NULL OR price_per_kg = 0);

-- Si el producto es por litro, price_per_kg = price_per_unit (aproximado)
UPDATE products SET price_per_kg = price_per_unit
WHERE unit IN ('litro', 'L') AND (price_per_kg IS NULL OR price_per_kg = 0);

-- === RECALCULAR price_per_unit PARA PRODUCTOS CON weight_kg Y price_per_kg ===
-- Si tiene price_per_kg y weight_kg, el precio = price_per_kg * weight_kg
-- Pero solo si el producto no es por kg (por kg el precio ya es el base)
UPDATE products SET price_per_unit = ROUND(price_per_kg * weight_kg)
WHERE weight_kg > 0 AND price_per_kg > 0
  AND unit NOT IN ('kg', 'litro', 'L')
  AND price_per_kg != price_per_unit;

-- Huevos: price_per_kg = 4, weight_kg = 0.65, price_per_unit = 4 * 0.65 = 2.6 -> 3
UPDATE products SET price_per_unit = 3, price_per_kg = 4, weight_kg = 0.65
WHERE name = 'Huevos Frescos';

-- Abonos: price_per_kg = 0.09, weight_kg = 25, price_per_unit = 0.09 * 25 = 2.25 -> 2
UPDATE products SET price_per_unit = 2, price_per_kg = 0.09, weight_kg = 25
WHERE name = 'Abonos Organicos';

-- Dulces: price_per_kg = 5, weight_kg = 0.5, price_per_unit = 5 * 0.5 = 2.5 -> 3
UPDATE products SET price_per_unit = 3, price_per_kg = 5, weight_kg = 0.5
WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas');

-- Sustratos: price_per_kg = 0.05, weight_kg = 20, price_per_unit = 0.05 * 20 = 1
UPDATE products SET price_per_unit = 1, price_per_kg = 0.05, weight_kg = 20
WHERE name = 'Tierra Fertil y Sustratos';
