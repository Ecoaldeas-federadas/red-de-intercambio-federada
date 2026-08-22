-- Migracion 081: Hacer nullable internal_cost y external_price_usd
--
-- La tabla conversion_factor tenia internal_cost y external_price_usd
-- como NOT NULL, pero el metodo StoreFCFromBasket no los usa (usa
-- basket_cost_external y basket_cost_local_tq en su lugar).
--
-- Esto causaba el error:
--   null value in column "internal_cost" of relation "conversion_factor"
--   violates not-null constraint (SQLSTATE 23502)

ALTER TABLE conversion_factor ALTER COLUMN internal_cost DROP NOT NULL;
ALTER TABLE conversion_factor ALTER COLUMN external_price_usd DROP NOT NULL;
