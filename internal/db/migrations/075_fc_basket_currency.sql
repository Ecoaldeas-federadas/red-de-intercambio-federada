-- Migracion 075: FC basado en canasta basica + moneda externa configurable
-- Antes el FC usaba "CPI externo" y "costo energetico local" (terminos tecnicos).
-- Ahora usa canasta basica: comparar el costo de la misma canasta en moneda externa vs TQ.
-- Tambien permite elegir la moneda externa (USD, EUR, COP, MXN, etc.)

-- Agregar columnas que faltaban (el codigo Go las usaba pero no existian en la tabla)
ALTER TABLE conversion_factor ADD COLUMN IF NOT EXISTS external_cpi DECIMAL(12,2) DEFAULT 0;
ALTER TABLE conversion_factor ADD COLUMN IF NOT EXISTS local_energy_cost DECIMAL(12,2) DEFAULT 0;

-- Nuevas columnas para canasta basica
ALTER TABLE conversion_factor ADD COLUMN IF NOT EXISTS external_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE conversion_factor ADD COLUMN IF NOT EXISTS basket_cost_external DECIMAL(12,2);
ALTER TABLE conversion_factor ADD COLUMN IF NOT EXISTS basket_cost_local_tq BIGINT;

-- Comentario explicativo
COMMENT ON COLUMN conversion_factor.external_currency IS 'Moneda externa de referencia (USD, EUR, COP, MXN, etc.)';
COMMENT ON COLUMN conversion_factor.basket_cost_external IS 'Costo de la canasta basica en moneda externa';
COMMENT ON COLUMN conversion_factor.basket_cost_local_tq IS 'Costo de la canasta basica en TQ (moneda local del nodo)';

-- Monedas externas comunes para referencia (no es una tabla de datos, solo documentacion)
-- USD - Dolar estadounidense
-- EUR - Euro
-- COP - Peso colombiano
-- MXN - Peso mexicano
-- ARS - Peso argentino
-- VES - Bolivar venezolano
-- BRL - Real brasileño
-- CLP - Peso chileno
-- PEN - Sol peruano
-- BOB - Boliviano
-- UYU - Peso uruguayo
-- PYG - Guarani paraguayo
-- DOP - Peso dominicano
-- CUP - Peso cubano
-- HNL - Lempira hondureño
-- GTQ - Quetzal guatemalteco
-- NIO - Cordoba nicaraguense
-- SVC - Colon salvadoreño
-- CRC - Colon costarricense
-- PAB - Balboa panameño
