-- Migracion 039: Mejoras de tienda y paginacion de productos
-- 1. Anadir campos a store_items para manejar unidad, extras y precio final
-- 2. Anadir campos a products para cantidad estandar por unidad

-- 1. Anadir campos a store_items
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS quantity_per_unit NUMERIC DEFAULT 1;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS base_price BIGINT DEFAULT 0;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS extra_costs BIGINT DEFAULT 0;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS final_price BIGINT DEFAULT 0;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS extra_description TEXT DEFAULT '';

-- Migrar datos existentes: base_price = price_trueque, final_price = price_trueque
UPDATE store_items SET base_price = price_trueque WHERE base_price = 0;
UPDATE store_items SET final_price = price_trueque WHERE final_price = 0;
UPDATE store_items SET unit = 'unidad' WHERE unit = '';

-- 2. Anadir quantity_per_unit a products (cuantas unidades estandar por precio)
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_per_unit NUMERIC DEFAULT 1;

-- Actualizar quantity_per_unit segun la unidad existente
UPDATE products SET quantity_per_unit = 1 WHERE quantity_per_unit = 1;
