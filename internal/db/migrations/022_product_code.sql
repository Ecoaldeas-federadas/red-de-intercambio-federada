-- Migracion 022: Anadir columna product_code faltante
--
-- Las consultas de productos en system.go seleccionan product_code
-- pero esa columna no existia en la tabla products, causando que
-- ambas queries (admin y publica) fallaran silenciosamente y
-- devolvieran arrays vacios.

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT DEFAULT '';

-- Actualizar los productos seed existentes para que tengan product_code
UPDATE products SET product_code = '' WHERE product_code IS NULL;
