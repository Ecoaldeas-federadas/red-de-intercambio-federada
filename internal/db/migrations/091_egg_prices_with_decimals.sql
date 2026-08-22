-- Migracion 091: Corregir precios de huevos con decimales
--
-- El usuario establecio los precios correctos:
-- - Huevos comerciales: 4 TQ por docena
-- - Huevos criollos: 6 TQ por docena
-- - Huevos de gallinas felices: 8 TQ por docena
--
-- El problema anterior era que el sistema redondeaba a enteros:
--   4 TQ/kg x 0.65 kg = 2.60 -> redondeaba a 3 (INCORRECTO)
--   5 TQ/kg x 0.65 kg = 3.25 -> redondeaba a 3 (INCORRECTO)
--
-- Ahora el sistema calcula con decimales (céntimos):
--   base_price x weight_kg = price_per_unit (SIN redondear)
--
-- Precio base por kg (calculado al reves: price / weight):
--   Comercial:     4 TQ / 0.65 kg = 6.15 TQ/kg
--   Criollo:       6 TQ / 0.65 kg = 9.23 TQ/kg
--   Gallina feliz: 8 TQ / 0.65 kg = 12.31 TQ/kg

-- === HUEVOS COMERCIALES (Jaula) - 4 TQ por docena ===
UPDATE products SET
  name = 'Huevos Comerciales (Jaula)',
  price_per_kg = 6.15,
  base_unit = 'kg',
  weight_kg = 0.65,
  price_per_unit = 4.00,
  energy_inputs = 6.15,
  description = 'Huevos de gallinas criadas en jaula (produccion comercial masiva). Sistema mas barato. Energia total (incluye alimento, jaula, ventilacion, transporte): ~22 MJ/kg = 6.15 kWh/kg. Fuente: Australia LCA 2020, Brasil LCA 2024, Williams UK 2006. Precio base: 6.15 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 6.15 x 0.65 = 4.00 TQ.',
  badge = 'Comercial'
WHERE name IN ('Huevos Comerciales (Jaula)', 'Huevos Frescos');

-- === HUEVOS CRIOLLOS (Semilibres) - 6 TQ por docena ===
UPDATE products SET
  price_per_kg = 9.23,
  base_unit = 'kg',
  weight_kg = 0.65,
  price_per_unit = 6.00,
  energy_inputs = 9.23,
  description = 'Huevos de gallinas criollas semilibres. Gallinas que caminan en corral o patio, comen del suelo + maiz/legumbres. Energia total: ~33 MJ/kg = 9.23 kWh/kg (incluye mayor consumo de alimento, menor productividad). Fuente: Williams UK 2006, Dekker NL 2011, Australia LCA 2020. Precio base: 9.23 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 9.23 x 0.65 = 6.00 TQ.',
  badge = 'Criollo'
WHERE name = 'Huevos Criollos (Semilibres)';

-- === HUEVOS DE GALLINAS FELICES (Pastoreo) - 8 TQ por docena ===
UPDATE products SET
  price_per_kg = 12.31,
  base_unit = 'kg',
  weight_kg = 0.65,
  price_per_unit = 8.00,
  energy_inputs = 12.31,
  description = 'Huevos de gallinas felices en pastoreo rotativo libre. Gallinas con acceso total al exterior, pastoreo organico, sin jaula ni confinamiento. Sistema mas caro: las gallinas consumen mas alimento organico y tienen menor productividad. Energia total: ~44 MJ/kg = 12.31 kWh/kg (incluye feed organico, pastoreo, menor eficiencia). Fuente: Dekker NL 2011, Wageningen Kipster 2021, de Vries review 2010. Precio base: 12.31 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 12.31 x 0.65 = 8.00 TQ.',
  badge = 'Gallina Feliz'
WHERE name = 'Huevos de Gallinas Felices (Pastoreo)';

-- === QUITAR REDONDEO EN OTROS PRODUCTOS ===
-- El problema del redondeo afecta a todos los productos calculados.
-- Ahora el sistema debe mantener decimales en price_per_unit.

-- Abonos: 0.09 TQ/kg x 25 kg = 2.25 TQ (no redondear a 2)
UPDATE products SET price_per_unit = 2.25
WHERE name = 'Abonos Organicos' AND price_per_kg = 0.09 AND weight_kg = 25;

-- Dulces: 5 TQ/kg x 0.5 kg = 2.50 TQ (no redondear a 3)
UPDATE products SET price_per_unit = 2.50
WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas')
  AND price_per_kg = 5 AND weight_kg = 0.5;

-- Sustratos: 0.05 TQ/kg x 20 kg = 1.00 TQ
UPDATE products SET price_per_unit = 1.00
WHERE name = 'Tierra Fertil y Sustratos' AND price_per_kg = 0.05 AND weight_kg = 20;

-- Coco: 1.4 TQ/kg x 1.5 kg = 2.10 TQ
UPDATE products SET price_per_unit = 2.10
WHERE name = 'Coco Fresco' AND weight_kg = 1.5;
