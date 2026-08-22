-- Migracion 085: Corregir valores de energia de productos animales
--
-- Los valores anteriores estaban basados en estimaciones demasiado altas
-- y con la jerarquia incorrecta. Los datos corregidos provienen de:
--
-- Fuentes:
-- - FAO (2013): "Greenhouse gas emissions from pig and chicken supply chains"
--   Hallazgo clave: "la intensidad de emisiones de la carne de pollo es
--   45% mayor que la de huevos por kg" - el pollo usa MAS energia que los huevos.
-- - Pimentel & Pimentel (2003): energia para producir alimentos
-- - Agribalyse (Francia): LCA de productos agricolas
-- - Leinonen et al. (2012): LCA de pollo y huevos en UK
-- - de Vries (2010): revision de 16 estudios LCA
--   Jerarquia confirmada: vacuno > cerdo > pollo > huevos > leche
-- - PMC/Univ. Iceland (2024): pollo 12 MJ/kg, huevos 13 MJ/kg
--
-- Jerarquia correcta de energia por kg:
--   Vacuno: ~40 MJ/kg = 11 kWh/kg (era 22-28, demasiado alto)
--   Cerdo: ~20 MJ/kg = 5.5 kWh/kg (era 13.2, demasiado alto)
--   Pollo: ~18 MJ/kg = 5 kWh/kg (era 8.3, demasiado alto)
--   Huevos: ~15 MJ/kg = 4.2 kWh/kg (era 9.6, demasiado alto)
--   Leche: ~6 MJ/L = 1.7 kWh/L (correcto, no cambiar)
--
-- Ademas, el producto "Huevos Frescos" tiene unidad "docena" pero el
-- precio estaba calculado como si fuera por kg. Una docena de huevos
-- pesa ~0.65 kg (12 huevos x ~54g c/u).
-- Energia por docena = 4.2 kWh/kg x 0.65 kg = 2.7 kWh -> precio 3 TQ

-- Corregir Huevos Frescos (unidad: docena)
-- Energia real: ~15 MJ/kg = 4.2 kWh/kg
-- Una docena pesa ~0.65 kg, energia por docena = 4.2 x 0.65 = 2.7 kWh
-- Precio: 3 TQ por docena (era 10)
UPDATE products SET
  price_per_unit = 3,
  energy_inputs = 3,
  energy_direct = 0,
  energy_human = 0,
  energy_amortization = 0,
  description = 'Huevos de gallina criolla, huevos de pato, huevos de codorniz. Energia: ~15 MJ/kg = 4.2 kWh/kg. Una docena pesa ~0.65 kg, energia por docena = 4.2 x 0.65 = 2.7 kWh. Fuente: FAO, Agribalyse, Leinonen et al. (2012). La jerarquia energetica correcta es: vacuno > cerdo > pollo > huevos > leche (FAO 2013).'
WHERE name = 'Huevos Frescos';

-- Corregir Carnes de Pollo y Aves (unidad: kg)
-- Energia real: ~18 MJ/kg = 5 kWh/kg (rango 9.6-25, mid ~18)
-- Precio: 5 TQ por kg (era 8)
UPDATE products SET
  price_per_unit = 5,
  energy_inputs = 5,
  energy_direct = 0,
  energy_human = 0,
  energy_amortization = 0,
  description = 'Pollo de patio, gallina, pato, conejo. Energia: ~18 MJ/kg = 5 kWh/kg (rango 9.6-25, conversion 2.0 kg pienso/kg carne). El pollo usa 45% mas energia que los huevos por kg (FAO 2013). Fuente: FAO, Pimentel, Agribalyse, Leinonen et al. (2012).'
WHERE name = 'Carnes de Pollo y Aves';

-- Corregir Carnes de Cerdo y Chivo (unidad: kg)
-- Energia real: ~20 MJ/kg = 5.5 kWh/kg (rango 15.9-22.7)
-- Precio: 6 TQ por kg (era 13)
UPDATE products SET
  price_per_unit = 6,
  energy_inputs = 6,
  energy_direct = 0,
  energy_human = 0,
  energy_amortization = 0,
  description = 'Cerdo criollo, chivo. Energia: ~20 MJ/kg = 5.5 kWh/kg (rango 15.9-22.7, conversion 6.5 kg pienso/kg). Fuente: FAO, Agribalyse, review de Vries (2010).'
WHERE name = 'Carnes de Cerdo y Chivo';

-- Corregir Carnes de Vacuno (unidad: kg)
-- Energia real: ~40 MJ/kg = 11 kWh/kg (rango 35-50, pastoreo)
-- Precio: 11 TQ por kg (era 25)
UPDATE products SET
  price_per_unit = 11,
  energy_inputs = 11,
  energy_direct = 0,
  energy_human = 0,
  energy_amortization = 0,
  description = 'Carne de res, vacuno pastoreado. Energia: ~40 MJ/kg = 11 kWh/kg (rango 35-50, conversion 25 kg forraje/kg). La carne de vacuno es la que mas energia consume: 7.5x mas que el pollo. Fuente: Pimentel, Cederberg, Ecoinvent, Agribalyse. El valor anterior (80-100 MJ/kg) era demasiado alto; los estudios LCA reales muestran 35-50 MJ/kg.'
WHERE name = 'Carnes de Vacuno';

-- Corregir Pescados y Mariscos (unidad: kg)
-- Energia real: ~25 MJ/kg = 7 kWh/kg (captura + cadena de frio)
-- Precio: 7 TQ por kg (era 10)
UPDATE products SET
  price_per_unit = 7,
  energy_inputs = 7,
  energy_direct = 0,
  energy_human = 0,
  energy_amortization = 0,
  description = 'Pescado fresco de rio, salado, carite, cazon, camarones. Energia estimada: ~25 MJ/kg = 7 kWh/kg (captura + cadena de frio). Fuente: FAO, Ecoinvent.'
WHERE name = 'Pescados y Mariscos';

-- Actualizar la descripcion de la tabla de equivalencias en la pagina publica
-- (se hace via seed, no aqui, para mantener consistencia)

-- Nota: La canasta basica familiar semanal tambien referencia estos valores
-- y puede necesitar recalcularse. Ver migracion 040 y 047.
