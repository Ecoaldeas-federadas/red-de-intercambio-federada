-- 046_decimal_prices.sql
-- Cambia los precios de BIGINT (enteros) a NUMERIC(12,2) (decimales)
-- para soportar centimos de TQ.
--
-- Problema: 2 TQ / 5 productos = 0.4 TQ, pero con enteros se redondea a 0.
-- Solucion: usar NUMERIC(12,2) para todos los campos de precio.
--
-- IMPORTANTE: energy_total es GENERATED ALWAYS AS (...) STORED,
-- por lo que hay que eliminarla ANTES de alterar las columnas que usa.

-- products: PRIMERO eliminar energy_total (GENERATED) para poder alterar las columnas que usa
ALTER TABLE products DROP COLUMN IF EXISTS energy_total;

-- AHORA alterar las columnas de energia
ALTER TABLE products ALTER COLUMN price_per_unit TYPE NUMERIC(12,2) USING price_per_unit::NUMERIC(12,2);
ALTER TABLE products ALTER COLUMN energy_direct TYPE NUMERIC(12,2) USING energy_direct::NUMERIC(12,2);
ALTER TABLE products ALTER COLUMN energy_human TYPE NUMERIC(12,2) USING energy_human::NUMERIC(12,2);
ALTER TABLE products ALTER COLUMN energy_inputs TYPE NUMERIC(12,2) USING energy_inputs::NUMERIC(12,2);
ALTER TABLE products ALTER COLUMN energy_amortization TYPE NUMERIC(12,2) USING energy_amortization::NUMERIC(12,2);

-- FINALMENTE recrear energy_total como GENERATED
ALTER TABLE products ADD COLUMN energy_total NUMERIC(12,2) GENERATED ALWAYS AS (energy_direct + energy_human + energy_inputs + energy_amortization) STORED;

-- store_items: precios
ALTER TABLE store_items ALTER COLUMN price_trueque TYPE NUMERIC(12,2) USING price_trueque::NUMERIC(12,2);
ALTER TABLE store_items ALTER COLUMN base_price TYPE NUMERIC(12,2) USING base_price::NUMERIC(12,2);
ALTER TABLE store_items ALTER COLUMN extra_costs TYPE NUMERIC(12,2) USING extra_costs::NUMERIC(12,2);
ALTER TABLE store_items ALTER COLUMN final_price TYPE NUMERIC(12,2) USING final_price::NUMERIC(12,2);

-- product_compositions: precio y subtotal
ALTER TABLE product_compositions ALTER COLUMN component_price TYPE NUMERIC(12,2) USING component_price::NUMERIC(12,2);
ALTER TABLE product_compositions ALTER COLUMN subtotal TYPE NUMERIC(12,2) USING subtotal::NUMERIC(12,2);

-- product_federation_proposals: precio
ALTER TABLE product_federation_proposals ALTER COLUMN price_per_unit TYPE NUMERIC(12,2) USING price_per_unit::NUMERIC(12,2);

-- ledger_entries: amount (para transacciones decimales)
ALTER TABLE ledger_entries ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);

-- transactions: amount
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);
