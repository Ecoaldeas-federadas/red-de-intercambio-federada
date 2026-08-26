-- Migracion 122: Calculadora dinamica basada en tarifa energetica
--
-- PROBLEMA: Los parametros de la calculadora tenian valores kwh_per_unit
-- hardcoded (0.18, 0.15, etc.) que no se relacionaban con la tarifa
-- energetica (canasta vital). Si la asamblea cambiaba la canasta vital
-- o los factores de esfuerzo, la calculadora no se actualizaba.
--
-- SOLUCION: Anadir columna tariff_category a calculator_parameters.
-- Cuando tariff_category es 'agricultural', 'technical' o 'admin',
-- la calculadora usa dinamicamente:
--   base_rate = (vital_food + vital_water + vital_domestic + vital_services) / work_hours_per_day
--   kwh = base_rate * effort_factor_from_tariff * hours
-- Cuando tariff_category es NULL, usa kwh_per_unit directamente (comportamiento anterior).

-- Paso 1: Anadir columna tariff_category
ALTER TABLE calculator_parameters
  ADD COLUMN IF NOT EXISTS tariff_category VARCHAR(20);

-- Paso 2: Asignar tariff_category a parametros existentes segun su categoria
UPDATE calculator_parameters SET tariff_category = 'agricultural'
WHERE parameter_type = 'work' AND category IN (
  'Agricultura',
  'Traccion Animal'
) AND tariff_category IS NULL;

UPDATE calculator_parameters SET tariff_category = 'technical'
WHERE parameter_type = 'work' AND category IN (
  'Construccion',
  'Artesania y manufactura'
) AND tariff_category IS NULL;

UPDATE calculator_parameters SET tariff_category = 'admin'
WHERE parameter_type = 'work' AND category IN (
  'Trabajo intelectual',
  'Servicios',
  'Produccion de alimentos'
) AND tariff_category IS NULL;

-- Paso 3: Para parametros con tariff_category, actualizar kwh_per_unit
-- al valor base_rate actual (1.0 con canasta=8, horas=8)
-- Esto sirve como referencia visual pero el calculo real es dinamico
UPDATE calculator_parameters SET kwh_per_unit = 1.0
WHERE parameter_type = 'work' AND tariff_category = 'admin'
  AND kwh_per_unit < 0.5;

UPDATE calculator_parameters SET kwh_per_unit = 0.61
WHERE parameter_type = 'work' AND tariff_category = 'agricultural'
  AND kwh_per_unit < 0.5;

UPDATE calculator_parameters SET kwh_per_unit = 3.0
WHERE parameter_type = 'work' AND tariff_category = 'technical'
  AND kwh_per_unit < 0.5;
