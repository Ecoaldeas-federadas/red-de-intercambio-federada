-- Migracion 089: Expandir base de datos mundial de materias primas
--
-- Se agregan TODAS las materias primas que faltan en el catalogo,
-- con valores de energia de las bases de datos internacionales:
-- - Agribalyse (Francia): 200+ productos agricolas
-- - FAO: produccion animal
-- - Pimentel & Pimentel: energia en alimentos
-- - ICE Database (University of Bath): 300+ materiales de construccion
-- - Ecoinvent: materiales industriales
-- - OEcotextiles: fibras textiles
-- - Estudios LCA de UK, EU, Iran, Albania, Canada, Nigeria, Turquia
--
-- Estas son MATERIAS PRIMAS, no productos compuestos.
-- Los productos compuestos se calculan sumando las materias primas
-- mas la energia del proceso de composicion.

-- === ALIMENTOS: Materias primas que faltan ===

-- Tomate fresco (separado de verduras generales)
-- Agribalyse: ~2.8 MJ/kg farm-gate
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Tomate Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Tomate fresco de conuco. Energia: ~2.8 MJ/kg = 0.8 kWh/kg (farm-gate). Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tomate Fresco' AND node_domain = nd.node_domain);

-- Cebolla fresca
-- Agribalyse: ~2.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cebolla Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Cebolla fresca de conuco. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cebolla Fresca' AND node_domain = nd.node_domain);

-- Ajo fresco
-- Agribalyse: ~3.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Ajo Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Ajo fresco de conuco. Energia: ~3.5 MJ/kg = 1 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ajo Fresco' AND node_domain = nd.node_domain);

-- Pimenton/Chile fresco
-- Agribalyse: ~3.2 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pimenton y Chile Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Pimenton dulce, aji picante fresco. Energia: ~3.2 MJ/kg = 0.9 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pimenton y Chile Fresco' AND node_domain = nd.node_domain);

-- Lechuga y hojas frescas
-- Agribalyse: ~1.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Lechuga Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Lechuga, espinaca, acelga fresca. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lechuga Fresca' AND node_domain = nd.node_domain);

-- Yuca fresca
-- Agribalyse: ~2.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Yuca Fresca', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Yuca fresca de conuco. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse, FAO.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yuca Fresca' AND node_domain = nd.node_domain);

-- Platano fresco
-- FAO: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Platano Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Platano de sombra fresco. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: FAO.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Platano Fresco' AND node_domain = nd.node_domain);

-- Cambur/Banana fresco
-- FAO: ~1.8 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cambur Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Cambur/banana fresco. Energia: ~1.8 MJ/kg = 0.5 kWh/kg. Fuente: FAO, Agribalyse.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cambur Fresco' AND node_domain = nd.node_domain);

-- Aguacate fresco
-- Agribalyse: ~3.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aguacate Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Aguacate fresco. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aguacate Fresco' AND node_domain = nd.node_domain);

-- Mango fresco
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Mango Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Mango fresco de temporada. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Temporada', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mango Fresco' AND node_domain = nd.node_domain);

-- Papaya/Lechosa fresca
-- FAO: ~1.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Papaya Fresca', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Papaya/lechosa fresca. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: FAO.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Papaya Fresca' AND node_domain = nd.node_domain);

-- Naranja fresca
-- Agribalyse: ~1.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Naranja Fresca', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Naranja fresca de patio. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Naranja Fresca' AND node_domain = nd.node_domain);

-- Limon fresco
-- Agribalyse: ~1.8 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Limon Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Limon fresco. Energia: ~1.8 MJ/kg = 0.5 kWh/kg. Fuente: Agribalyse.',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Limon Fresco' AND node_domain = nd.node_domain);

-- Patilla/Sandia fresca
-- FAO: ~1.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Patilla Fresca', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Patilla/sandia fresca. Energia: ~1.0 MJ/kg = 0.3 kWh/kg. Fuente: FAO.',
'De Temporada', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Patilla Fresca' AND node_domain = nd.node_domain);

-- Pina fresca
-- Agribalyse: ~2.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pina Fresca', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Pina fresca. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse.',
'De Temporada', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pina Fresca' AND node_domain = nd.node_domain);

-- Caraota/Frijol seco
-- Agribalyse: ~12 MJ/kg (legumbre seca)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Caraota Seca', 'Alimentacion', 'Granos y Cereales', 'Legumbres', 'internal', 'kg',
'Caraota/frijol seco. Energia: ~12 MJ/kg = 3.3 kWh/kg (siembra + cosecha + secado). Fuente: Agribalyse.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Caraota Seca' AND node_domain = nd.node_domain);

-- Maiz seco
-- Agribalyse: ~10 MJ/kg (conuco ~3 kWh/kg)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Maiz Seco', 'Alimentacion', 'Granos y Cereales', 'Cereales', 'internal', 'kg',
'Maiz criollo seco. Energia: ~10 MJ/kg = 3 kWh/kg (conuco). Fuente: Agribalyse, Albania LCA.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Maiz Seco' AND node_domain = nd.node_domain);

-- Arroz seco
-- Agribalyse: ~14 MJ/kg (conuco ~4 kWh/kg)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arroz Seco', 'Alimentacion', 'Granos y Cereales', 'Cereales', 'internal', 'kg',
'Arroz seco. Energia: ~14 MJ/kg = 4 kWh/kg (conuco). Industrial: 7 MJ/kg. Fuente: Agribalyse.',
'De Conuco', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arroz Seco' AND node_domain = nd.node_domain);

-- Trigo seco
-- Piringer & Steinberg: 3.9 MJ/kg industrial, ~10 MJ/kg conuco
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Trigo Seco', 'Alimentacion', 'Granos y Cereales', 'Cereales', 'internal', 'kg',
'Trigo seco. Energia: ~10 MJ/kg = 3 kWh/kg (conuco). Industrial: 3.9 MJ/kg. Fuente: Piringer & Steinberg 2006.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Trigo Seco' AND node_domain = nd.node_domain);

-- Quinchoncho/Cajan seco
-- FAO: ~12 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Quinchoncho Seco', 'Alimentacion', 'Granos y Cereales', 'Legumbres', 'internal', 'kg',
'Quinchoncho/cajan seco. Energia: ~12 MJ/kg = 3.3 kWh/kg. Fuente: FAO.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Quinchoncho Seco' AND node_domain = nd.node_domain);

-- Lentejas secas
-- Agribalyse: ~13 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Lentejas Secas', 'Alimentacion', 'Granos y Cereales', 'Legumbres', 'internal', 'kg',
'Lentejas secas. Energia: ~13 MJ/kg = 3.6 kWh/kg. Fuente: Agribalyse.',
'Importado', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lentejas Secas' AND node_domain = nd.node_domain);

-- Garbanzos secos
-- Agribalyse: ~13 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Garbanzos Secos', 'Alimentacion', 'Granos y Cereales', 'Legumbres', 'internal', 'kg',
'Garbanzos secos. Energia: ~13 MJ/kg = 3.6 kWh/kg. Fuente: Agribalyse.',
'Importado', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Garbanzos Secos' AND node_domain = nd.node_domain);

-- Cafe verde (materia prima)
-- FAO: ~20 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cafe Verde', 'Alimentacion', 'Granos y Cereales', 'Cafe', 'internal', 'kg',
'Cafe verde sin tostar (materia prima). Energia: ~20 MJ/kg = 5.5 kWh/kg (cultivo + cosecha + secado). Fuente: FAO.',
'De Montana', '', 6, true, true, '', 0, 0, 6, 0, 6, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cafe Verde' AND node_domain = nd.node_domain);

-- Cacao en grano (materia prima)
-- FAO: ~15 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cacao en Grano', 'Alimentacion', 'Granos y Cereales', 'Cacao', 'internal', 'kg',
'Cacao en grano fermentado y secado (materia prima). Energia: ~15 MJ/kg = 4.2 kWh/kg (cultivo + fermentacion + secado). Fuente: FAO.',
'De Montana', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cacao en Grano' AND node_domain = nd.node_domain);

-- Sal marina
-- Ecoinvent: ~8 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Sal Marina', 'Alimentacion', 'Condimentos', 'Sal', 'internal', 'kg',
'Sal marina de evaporacion solar. Energia: ~8 MJ/kg = 2.2 kWh/kg (evaporacion + recoleccion). Fuente: Ecoinvent.',
'Marina', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sal Marina' AND node_domain = nd.node_domain);

-- Vinagre artesanal
-- ~10 MJ/L
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Vinagre Artesanal', 'Alimentacion', 'Condimentos', 'Vinagre', 'internal', 'L',
'Vinagre de cana o frutas. Energia: ~10 MJ/L = 3 kWh/L (fermentacion acida). Fuente: Agribalyse.',
'Artesanal', '', 3, true, true, '', 0, 0, 3, 0, 3, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vinagre Artesanal' AND node_domain = nd.node_domain);

-- === MATERIALES DE CONSTRUCCION: Materias primas que faltan ===
-- Fuente: ICE Database (University of Bath), Ecoinvent

-- Cemento Portland
-- ICE Database: 4.6 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cemento Portland', 'Construccion', 'Materiales', 'Cemento', 'external', 'kg',
'Cemento Portland. Energia: 4.6 MJ/kg = 1.3 kWh/kg (calcinacion de caliza a 1450C). Fuente: ICE Database.',
'Industrial', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cemento Portland' AND node_domain = nd.node_domain);

-- Cal viva
-- ICE Database: 5.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cal Viva', 'Construccion', 'Materiales', 'Cal', 'external', 'kg',
'Cal viva (CaO). Energia: 5.0 MJ/kg = 1.4 kWh/kg (calcinacion de caliza a 900C). Fuente: ICE Database.',
'Industrial', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cal Viva' AND node_domain = nd.node_domain);

-- Yeso
-- ICE Database: 1.8 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Yeso', 'Construccion', 'Materiales', 'Yeso', 'external', 'kg',
'Yeso (CaSO4). Energia: 1.8 MJ/kg = 0.5 kWh/kg (calcinacion + molienda). Fuente: ICE Database.',
'Industrial', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yeso' AND node_domain = nd.node_domain);

-- Cobre
-- ICE Database: 70 MJ/kg (virgen), 25 MJ/kg (reciclado)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cobre', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Cobre virgen. Energia: 70 MJ/kg = 19.4 kWh/kg (mineria + fundicion + refinacion). Reciclado: 25 MJ/kg. Fuente: ICE Database.',
'Metal', '', 19, true, true, '', 0, 0, 19, 0, 19, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cobre' AND node_domain = nd.node_domain);

-- Zinc
-- ICE Database: 72 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Zinc', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Zinc virgen. Energia: 72 MJ/kg = 20 kWh/kg (mineria + fundicion). Fuente: ICE Database.',
'Metal', '', 20, true, true, '', 0, 0, 20, 0, 20, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Zinc' AND node_domain = nd.node_domain);

-- Plomo
-- ICE Database: 25 MJ/kg (virgen), 10 MJ/kg (reciclado)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Plomo', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Plomo virgen. Energia: 25 MJ/kg = 7 kWh/kg (mineria + fundicion). Reciclado: 10 MJ/kg. Fuente: ICE Database.',
'Metal', '', 7, true, true, '', 0, 0, 7, 0, 7, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plomo' AND node_domain = nd.node_domain);

-- Bronce (aleacion cobre + estano)
-- ICE Database: ~80 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Bronce', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Bronce (aleacion cobre + estano). Energia: ~80 MJ/kg = 22 kWh/kg. Fuente: ICE Database.',
'Metal', '', 22, true, true, '', 0, 0, 22, 0, 22, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bronce' AND node_domain = nd.node_domain);

-- Laton (aleacion cobre + zinc)
-- ICE Database: ~75 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Laton', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Laton (aleacion cobre + zinc). Energia: ~75 MJ/kg = 21 kWh/kg. Fuente: ICE Database.',
'Metal', '', 21, true, true, '', 0, 0, 21, 0, 21, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Laton' AND node_domain = nd.node_domain);

-- Hierro
-- ICE Database: 25 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Hierro', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Hierro virgen. Energia: 25 MJ/kg = 7 kWh/kg (mineria + reduccion en alto horno). Fuente: ICE Database.',
'Metal', '', 7, true, true, '', 0, 0, 7, 0, 7, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hierro' AND node_domain = nd.node_domain);

-- Estano
-- ICE Database: ~80 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Estano', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Estano virgen. Energia: ~80 MJ/kg = 22 kWh/kg (mineria + fundicion). Fuente: ICE Database.',
'Metal', '', 22, true, true, '', 0, 0, 22, 0, 22, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Estano' AND node_domain = nd.node_domain);

-- Niquel
-- ICE Database: ~165 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Niquel', 'Construccion', 'Materiales', 'Metales', 'external', 'kg',
'Niquel virgen. Energia: ~165 MJ/kg = 46 kWh/kg (mineria + fundicion + refinacion). Fuente: ICE Database.',
'Metal', '', 46, true, true, '', 0, 0, 46, 0, 46, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Niquel' AND node_domain = nd.node_domain);

-- Plastico PVC
-- ICE Database: ~80 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Plastico PVC', 'Construccion', 'Materiales', 'Plasticos', 'external', 'kg',
'PVC (policloruro de vinilo). Energia: ~80 MJ/kg = 22 kWh/kg (petroquimica + polimerizacion). Fuente: ICE Database.',
'Petroquimico', '', 22, true, true, '', 0, 0, 22, 0, 22, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plastico PVC' AND node_domain = nd.node_domain);

-- Polietileno (PE)
-- ICE Database: ~85 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Polietileno', 'Construccion', 'Materiales', 'Plasticos', 'external', 'kg',
'Polietileno (PE). Energia: ~85 MJ/kg = 24 kWh/kg (petroquimica + polimerizacion). Fuente: ICE Database.',
'Petroquimico', '', 24, true, true, '', 0, 0, 24, 0, 24, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Polietileno' AND node_domain = nd.node_domain);

-- Polipropileno (PP)
-- ICE Database: ~115 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Polipropileno', 'Construccion', 'Materiales', 'Plasticos', 'external', 'kg',
'Polipropileno (PP). Energia: ~115 MJ/kg = 32 kWh/kg (petroquimica + polimerizacion). Fuente: ICE Database.',
'Petroquimico', '', 32, true, true, '', 0, 0, 32, 0, 32, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Polipropileno' AND node_domain = nd.node_domain);

-- Poliester
-- ICE Database: ~125 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Poliester', 'Construccion', 'Materiales', 'Plasticos', 'external', 'kg',
'Poliester. Energia: ~125 MJ/kg = 35 kWh/kg (petroquimica + polimerizacion). Fuente: ICE Database, OEcotextiles.',
'Petroquimico', '', 35, true, true, '', 0, 0, 35, 0, 35, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Poliester' AND node_domain = nd.node_domain);

-- Nylon
-- ICE Database: ~250 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Nylon', 'Construccion', 'Materiales', 'Plasticos', 'external', 'kg',
'Nylon (poliamida). Energia: ~250 MJ/kg = 69 kWh/kg (petroquimica + polimerizacion). Fuente: ICE Database, OEcotextiles.',
'Petroquimico', '', 69, true, true, '', 0, 0, 69, 0, 69, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Nylon' AND node_domain = nd.node_domain);

-- === FIBRAS TEXTILES NATURALES (materias primas) ===
-- Fuente: OEcotextiles, MDPI LCA studies

-- Algodon (fibra cruda)
-- OEcotextiles: 55 MJ/kg (fibra), 147 MJ/kg (tela)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Algodon en Rama', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Algodon en rama (fibra cruda). Energia: 55 MJ/kg = 15 kWh/kg (cultivo + cosecha + desmotado). Fuente: OEcotextiles, MDPI LCA.',
'De Conuco', '', 15, true, true, '', 0, 0, 15, 0, 15, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Algodon en Rama' AND node_domain = nd.node_domain);

-- Lana (fibra cruda)
-- OEcotextiles: 63 MJ/kg (fibra)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Lana en Sucio', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Lana en sucio (fibra cruda de oveja). Energia: 63 MJ/kg = 17.5 kWh/kg (crianza + esquila + lavado). Fuente: OEcotextiles.',
'De Pastoreo', '', 18, true, true, '', 0, 0, 18, 0, 18, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lana en Sucio' AND node_domain = nd.node_domain);

-- Lino (fibra cruda)
-- OEcotextiles: 10 MJ/kg (fibra)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Lino en Rama', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Lino en rama (fibra cruda). Energia: 10 MJ/kg = 2.8 kWh/kg (cultivo + enriado + secado). Fuente: OEcotextiles, MDPI LCA.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lino en Rama' AND node_domain = nd.node_domain);

-- Canamo/Hemp (fibra cruda)
-- ~10 MJ/kg (similar al lino)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Canamo en Rama', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Canamo/hemp en rama (fibra cruda). Energia: ~10 MJ/kg = 2.8 kWh/kg (cultivo + procesado). Fuente: OEcotextiles, MDPI LCA.',
'De Conuco', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Canamo en Rama' AND node_domain = nd.node_domain);

-- Yute (fibra cruda)
-- MDPI LCA: ~5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Yute en Rama', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Yute en rama (fibra cruda). Energia: ~5 MJ/kg = 1.4 kWh/kg (cultivo + enriado). Fuente: MDPI LCA.',
'Importado', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yute en Rama' AND node_domain = nd.node_domain);

-- Sisal (fibra cruda)
-- ~5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Sisal en Rama', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Sisal en rama (fibra de agave). Energia: ~5 MJ/kg = 1.4 kWh/kg (cultivo + desfibrado). Fuente: MDPI LCA.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sisal en Rama' AND node_domain = nd.node_domain);

-- Seda (fibra cruda)
-- MDPI LCA: ~18.6 MJ/kg (fibra), alto impacto
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Seda Cruda', 'Textiles', 'Fibras', 'Naturales', 'internal', 'kg',
'Seda cruda (fibra de gusano de seda). Energia: ~50 MJ/kg = 14 kWh/kg (crianza + hilado). Fuente: MDPI LCA.',
'Artesanal', '', 14, true, true, '', 0, 0, 14, 0, 14, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Seda Cruda' AND node_domain = nd.node_domain);

-- Cuero (curtido vegetal)
-- ~50 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cuero Curtido Vegetal', 'Textiles', 'Fibras', 'Cuero', 'internal', 'kg',
'Cuero curtido con taninos vegetales. Energia: ~50 MJ/kg = 14 kWh/kg (subproducto animal + curtido). Fuente: Ecoinvent.',
'Artesanal', '', 14, true, true, '', 0, 0, 14, 0, 14, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cuero Curtido Vegetal' AND node_domain = nd.node_domain);

-- Caucho natural (látex)
-- ~35 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Caucho Natural (Latex)', 'Textiles', 'Fibras', 'Caucho', 'internal', 'kg',
'Caucho natural (latex de hevea). Energia: ~35 MJ/kg = 10 kWh/kg (cultivo + extraccion + coagulacion). Fuente: Ecoinvent.',
'De Monte', '', 10, true, true, '', 0, 0, 10, 0, 10, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Caucho Natural (Latex)' AND node_domain = nd.node_domain);

-- === PAPEL Y DERIVADOS ===

-- Papel reciclado
-- ICE Database: ~15 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Papel Reciclado', 'Materiales', 'Papel', 'Reciclado', 'internal', 'kg',
'Papel reciclado artesanal. Energia: ~15 MJ/kg = 4 kWh/kg (reciclaje + pulpa + secado). Fuente: ICE Database.',
'Reciclado', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Papel Reciclado' AND node_domain = nd.node_domain);

-- Carton reciclado
-- ICE Database: ~12 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Carton Reciclado', 'Materiales', 'Papel', 'Carton', 'internal', 'kg',
'Carton reciclado. Energia: ~12 MJ/kg = 3.3 kWh/kg (reciclaje + pulpa + prensado). Fuente: ICE Database.',
'Reciclado', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carton Reciclado' AND node_domain = nd.node_domain);

-- === BEBIDAS: Materias primas que faltan ===

-- Cafe tostado (materia prima procesada)
-- ~30 MJ/kg (tostado a lena)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cafe Tostado en Grano', 'Alimentacion', 'Bebidas', 'Cafe', 'internal', 'kg',
'Cafe tostado en grano. Energia: ~30 MJ/kg = 8 kWh/kg (cafe verde 6 + tostado a lena 2). Fuente: FAO, Agribalyse.',
'De Montana', '', 8, true, true, '', 0, 0, 8, 0, 8, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cafe Tostado en Grano' AND node_domain = nd.node_domain);

-- Chocolate artesanal 70%
-- ~54 MJ/kg (cacao + azucar + conchado)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Chocolate Artesanal 70%', 'Alimentacion', 'Dulces', 'Chocolate', 'internal', 'kg',
'Chocolate artesanal 70% cacao. Energia: ~54 MJ/kg = 15 kWh/kg (cacao 4 + azucar 5 + conchado 6). Fuente: FOB UK, Agribalyse.',
'Artesanal', '', 15, true, true, '', 0, 0, 15, 0, 15, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chocolate Artesanal 70%' AND node_domain = nd.node_domain);

-- === COMBUSTIBLES: Materias primas que faltan ===

-- Gasolina
-- ICE Database: 42 MJ/kg = 11.6 kWh/L
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Gasolina', 'Energia y Combustibles', 'Combustibles', 'Gasolina', 'external', 'L',
'Gasolina. Energia: 42 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: ICE Database, Ecoinvent.',
'Fosil', '', 12, true, true, '', 0, 0, 12, 0, 12, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gasolina' AND node_domain = nd.node_domain);

-- Gas GLP (propano/butano)
-- ICE Database: 87 MJ/kg = 25 kWh/kg, ~24 kWh/L
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Gas GLP', 'Energia y Combustibles', 'Combustibles', 'GLP', 'external', 'kg',
'Gas GLP (propano/butano). Energia: 87 MJ/kg = 24 kWh/kg (refinacion + envasado). Fuente: ICE Database.',
'Fosil', '', 24, true, true, '', 0, 0, 24, 0, 24, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gas GLP' AND node_domain = nd.node_domain);

-- Kerosen
-- ICE Database: ~42 MJ/L = 11.6 kWh/L
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Kerosen', 'Energia y Combustibles', 'Combustibles', 'Kerosen', 'external', 'L',
'Kerosen. Energia: ~42 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: ICE Database.',
'Fosil', '', 12, true, true, '', 0, 0, 12, 0, 12, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kerosen' AND node_domain = nd.node_domain);

-- === MINERALES Y AGREGADOS ===

-- Arena de rio
-- ICE Database: 0.083 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arena de Rio', 'Construccion', 'Agregados', 'Arena', 'internal', 'kg',
'Arena de rio. Energia: 0.083 MJ/kg = 0.02 kWh/kg (extraccion + clasificacion). Fuente: ICE Database.',
'Natural', '', 0, true, true, '', 0, 0, 0, 0, 0, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arena de Rio' AND node_domain = nd.node_domain);

-- Grava
-- ICE Database: 0.083 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Grava', 'Construccion', 'Agregados', 'Grava', 'internal', 'kg',
'Grava de rio/cantera. Energia: 0.083 MJ/kg = 0.02 kWh/kg (extraccion + clasificacion). Fuente: ICE Database.',
'Natural', '', 0, true, true, '', 0, 0, 0, 0, 0, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Grava' AND node_domain = nd.node_domain);

-- Arcilla
-- ICE Database: ~1.7 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arcilla', 'Construccion', 'Materiales', 'Arcilla', 'internal', 'kg',
'Arcilla para ceramica/adobes. Energia: ~1.7 MJ/kg = 0.5 kWh/kg (extraccion + preparacion). Fuente: ICE Database.',
'Natural', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arcilla' AND node_domain = nd.node_domain);

-- === AGUA ===

-- Agua potable
-- Ecoinvent: ~0.5 MJ/L (tratamiento + distribucion)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Agua Potable', 'Servicios', 'Agua', 'Potable', 'internal', 'L',
'Agua potable tratada. Energia: ~0.5 MJ/L = 0.14 kWh/L (tratamiento + distribucion). Fuente: Ecoinvent.',
'Vital', '', 0, true, true, '', 0, 0, 0, 0, 0, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Agua Potable' AND node_domain = nd.node_domain);

-- === VIDRIO ===

-- Vidrio plano (ya existe pero asegurar valores)
-- ICE Database: 15 MJ/kg
UPDATE products SET price_per_kg = 4, base_unit = 'kg', weight_kg = 1,
  description = 'Vidrio plano. Energia: 15 MJ/kg = 4.2 kWh/kg (fusión de sílice a 1500C). Fuente: ICE Database.'
WHERE name = 'Vidrio Plano' AND (price_per_kg = 0 OR price_per_kg IS NULL);

-- Vidrio reciclado
-- ICE Database: ~8 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Vidrio Reciclado', 'Construccion', 'Materiales', 'Vidrio', 'internal', 'kg',
'Vidrio reciclado. Energia: ~8 MJ/kg = 2.2 kWh/kg (reciclaje + fusion a menor temperatura). Fuente: ICE Database.',
'Reciclado', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vidrio Reciclado' AND node_domain = nd.node_domain);

-- === MADERA ===

-- Madera aserrada (ya existe pero asegurar valores)
-- ICE Database: 8.5 MJ/kg = 2.36 kWh/kg
UPDATE products SET price_per_kg = 2, base_unit = 'kg', weight_kg = 1,
  description = 'Madera aserrada, vigas, tablas, listones. Energia: 8.5 MJ/kg = 2.36 kWh/kg (tala + aserrado + secado). Fuente: ICE Database.'
WHERE name = 'Madera de Construccion' AND (price_per_kg = 0 OR price_per_kg IS NULL);

-- Madera estructural
-- ICE Database: 8.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Madera Estructural', 'Construccion', 'Materiales', 'Madera', 'internal', 'kg',
'Madera estructural (vigas, columnas). Energia: 8.5 MJ/kg = 2.36 kWh/kg (tala + aserrado + secado). Fuente: ICE Database.',
'Natural', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Madera Estructural' AND node_domain = nd.node_domain);

-- Bambu
-- ~8 MJ/kg (similar a madera pero crece mas rapido)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Bambu Estructural', 'Construccion', 'Materiales', 'Bambu', 'internal', 'kg',
'Bambu estructural. Energia: ~8 MJ/kg = 2.2 kWh/kg (cultivo + corte + tratamiento). Fuente: Ecoinvent.',
'Renovable', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bambu Estructural' AND node_domain = nd.node_domain);

-- === ACEITES ESENCIALES Y EXTRACTOS ===

-- Aceite esencial (extracto concentrado)
-- ~200 MJ/kg (extraccion por destilacion)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aceite Esencial', 'Salud y Medicina', 'Extractos', 'Aceites', 'internal', 'L',
'Aceite esencial (destilacion por arrastre de vapor). Energia: ~200 MJ/L = 55 kWh/L (cultivo + destilacion). Fuente: Ecoinvent.',
'Artesanal', '', 55, true, true, '', 0, 0, 55, 0, 55, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aceite Esencial' AND node_domain = nd.node_domain);

-- Propoleo (extracto)
-- ~100 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Propoleo Crudo', 'Salud y Medicina', 'Extractos', 'Propoleo', 'internal', 'kg',
'Propoleo crudo de abejas. Energia: ~100 MJ/kg = 28 kWh/kg (apicultura + extraccion + filtrado). Fuente: Ecoinvent.',
'De Monte', '', 28, true, true, '', 0, 0, 28, 0, 28, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Propoleo Crudo' AND node_domain = nd.node_domain);

-- Cera de abejas
-- ~40 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cera de Abejas', 'Salud y Medicina', 'Extractos', 'Cera', 'internal', 'kg',
'Cera de abejas natural. Energia: ~40 MJ/kg = 11 kWh/kg (apicultura + fundido + filtrado). Fuente: Ecoinvent.',
'De Monte', '', 11, true, true, '', 0, 0, 11, 0, 11, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cera de Abejas' AND node_domain = nd.node_domain);

-- === SEMILLAS Y NUECES ===

-- Mani/Cacahuate
-- Agribalyse: ~20 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Mani Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutos Secos', 'internal', 'kg',
'Mani/cacahuate fresco. Energia: ~20 MJ/kg = 5.5 kWh/kg (cultivo + cosecha + secado). Fuente: Agribalyse.',
'De Conuco', '', 6, true, true, '', 0, 0, 6, 0, 6, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mani Fresco' AND node_domain = nd.node_domain);

-- Ajonjoli/Sesamo
-- Agribalyse: ~25 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Ajonjoli', 'Alimentacion', 'Cosecha Fresca', 'Semillas', 'internal', 'kg',
'Ajonjoli/sesamo. Energia: ~25 MJ/kg = 7 kWh/kg (cultivo + cosecha + secado). Fuente: Agribalyse.',
'De Conuco', '', 7, true, true, '', 0, 0, 7, 0, 7, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ajonjoli' AND node_domain = nd.node_domain);

-- Coco fresco
-- FAO: ~5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Coco Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'unidad',
'Coco fresco. Energia: ~5 MJ/kg = 1.4 kWh/kg. Un coco pesa ~1.5 kg. Fuente: FAO.',
'De Patio', '', 2, true, true, '', 0, 0, 2, 0, 1.4, 'kg', 1.5
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Coco Fresco' AND node_domain = nd.node_domain);

-- === TUBERCULOS ADICIONALES ===

-- Name
-- Agribalyse: ~2.5 MJ/kg (similar a yuca)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Name Fresco', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Name fresco de conuco. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse, FAO.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Name Fresco' AND node_domain = nd.node_domain);

-- Auyama/Calabaza
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Auyama Fresca', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Auyama/calabaza fresca. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Auyama Fresca' AND node_domain = nd.node_domain);

-- Batata/Camote
-- Agribalyse: ~2.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Batata Fresca', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Batata/camote fresco. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Batata Fresca' AND node_domain = nd.node_domain);

-- === VERDURAS ADICIONALES ===

-- Berenjena
-- Agribalyse: ~2.5 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Berenjena Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Berenjena fresca. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Berenjena Fresca' AND node_domain = nd.node_domain);

-- Zanahoria
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Zanahoria Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Zanahoria fresca. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Zanahoria Fresca' AND node_domain = nd.node_domain);

-- Remolacha/Betarraga
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Remolacha Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Remolacha/betarraga fresca. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Remolacha Fresca' AND node_domain = nd.node_domain);

-- Pepino
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pepino Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Pepino fresco. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pepino Fresco' AND node_domain = nd.node_domain);

-- Calabacin/Zucchini
-- Agribalyse: ~2.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Calabacin Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Calabacin/zucchini fresco. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Calabacin Fresco' AND node_domain = nd.node_domain);

-- Cilantro/Perejil
-- Agribalyse: ~3.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cilantro y Perejil Fresco', 'Alimentacion', 'Cosecha Fresca', 'Aromaticas', 'internal', 'kg',
'Cilantro, perejil, cebollin fresco. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cilantro y Perejil Fresco' AND node_domain = nd.node_domain);
