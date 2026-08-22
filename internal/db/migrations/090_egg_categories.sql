-- Migracion 090: Tres categorias de huevos segun sistema de produccion
--
-- El usuario pidio diferenciar los tipos de huevos:
-- 1. Huevos comerciales (gallinas en jaula, produccion masiva) - MAS BARATOS
-- 2. Huevos criollos (gallinas criollas, semilibres) - PRECIO MEDIO
-- 3. Huevos de gallinas felices (free-range, organico, pastoreo) - MAS CAROS
--
-- Valores de la base de datos mundial (estudios LCA):
--
-- Comercial (jaula):
--   Australia 2020: 10.7 MJ/kg = 3.0 kWh/kg
--   Brasil 2024:   ~10.0 MJ/kg = 2.8 kWh/kg
--   UK Williams:   14.1 MJ/kg = 3.9 kWh/kg
--   Promedio:      ~12 MJ/kg = 3.3 kWh/kg -> redondear a 4 TQ/kg
--
-- Criollo (semilibre, barn, alimentacion mixta):
--   Dekker barn:   23.0 MJ/kg = 6.4 kWh/kg
--   UK free-range: 15.4 MJ/kg = 4.3 kWh/kg
--   Australia FR:  12.2 MJ/kg = 3.4 kWh/kg
--   Promedio:      ~17 MJ/kg = 4.7 kWh/kg -> redondear a 5 TQ/kg
--
-- Gallinas felices (free-range organico, pastoreo rotativo):
--   Dekker FR:     23.5 MJ/kg = 6.5 kWh/kg
--   Dekker organico: 20.6 MJ/kg = 5.7 kWh/kg
--   Wageningen organico: 19-27 MJ/kg = 5.3-7.5 kWh/kg
--   Promedio:      ~23 MJ/kg = 6.4 kWh/kg -> redondear a 6 TQ/kg
--
-- Peso de una docena: 0.65 kg (12 huevos x ~54g c/u)
--
-- Precios por docena:
--   Comercial:    4 TQ/kg x 0.65 kg = 2.6 -> 3 TQ
--   Criollo:      5 TQ/kg x 0.65 kg = 3.25 -> 3 TQ
--   Gallina feliz: 6 TQ/kg x 0.65 kg = 3.9 -> 4 TQ

-- === HUEVOS COMERCIALES (gallinas en jaula) ===
-- Actualizar el producto existente "Huevos Frescos" a comercial
UPDATE products SET
  name = 'Huevos Comerciales (Jaula)',
  price_per_kg = 4,
  base_unit = 'kg',
  weight_kg = 0.65,
  price_per_unit = 3,
  energy_inputs = 4,
  description = 'Huevos de gallinas criadas en jaula (produccion comercial masiva). Sistema mas barato y mas eficiente energeticamente. Energia: ~12 MJ/kg = 3.3 kWh/kg (Australia 10.7, Brasil 10, UK 14.1). Fuente: Australia LCA 2020, Brasil LCA 2024, Williams UK 2006. Precio base: 4 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 4 x 0.65 = 2.6 -> 3 TQ.',
  badge = 'Comercial'
WHERE name = 'Huevos Frescos';

-- === HUEVOS CRIOLLOS (gallinas semilibres, alimentacion mixta) ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Huevos Criollos (Semilibres)', 'Alimentacion', 'Cosecha Fresca', 'Huevos', 'internal', 'docena',
'Huevos de gallinas criollas semilibres. Gallinas que caminan en corral o patio, comen del suelo + maiz/legumbres. Mas caros que comerciales porque consumen mas alimento por huevo. Energia: ~17 MJ/kg = 4.7 kWh/kg (UK free-range 15.4, Dekker barn 23.0, Australia FR 12.2). Fuente: Williams UK 2006, Dekker NL 2011, Australia LCA 2020. Precio base: 5 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 5 x 0.65 = 3.25 -> 3 TQ.',
'Criollo', '', 3, true, true, '', 0, 0, 5, 0, 5, 'kg', 0.65
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Huevos Criollos (Semilibres)' AND node_domain = nd.node_domain);

-- === HUEVOS DE GALLINAS FELICES (free-range organico, pastoreo) ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Huevos de Gallinas Felices (Pastoreo)', 'Alimentacion', 'Cosecha Fresca', 'Huevos', 'internal', 'docena',
'Huevos de gallinas felices en pastoreo rotativo libre. Gallinas con acceso total al exterior, pastoreo organico, sin jaula ni confinamiento. Sistema mas caro porque las gallinas consumen mas alimento organico y tienen menor productividad por ave. Energia: ~23 MJ/kg = 6.4 kWh/kg (Dekker free-range 23.5, organico 20.6, Wageningen organico 19-27). Fuente: Dekker NL 2011, Wageningen Kipster 2021. Precio base: 6 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 6 x 0.65 = 3.9 -> 4 TQ.',
'Gallina Feliz', '', 4, true, true, '', 0, 0, 6, 0, 6, 'kg', 0.65
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Huevos de Gallinas Felices (Pastoreo)' AND node_domain = nd.node_domain);
