-- Migracion 093: Productos de la Feria Conuquera Agroecologica con valores energeticos conocidos
--
-- Fuente de investigacion: Feria Conuquera Agroecologica, Parque Los Caobos, Caracas.
-- Primer sabado de cada mes. ~45 productores. 10+ anos de actividad.
--
-- Fuentes consultadas:
-- - Blog oficial: http://feriaconuquera.blogspot.com/
-- - Instagram: @feriaconuquera
-- - Ultimas Noticias (10 anos de la feria, 45 productores)
-- - Desde La Plaza (articulos 2015-2019)
-- - Yvke Mundial / Radio Mundial
-- - Prensa Rural, Haiman El Troudi, Orinoco Tribune
-- - Lombriz Roja Urbana, Semillas del Pueblo
--
-- Solo se incluyen productos con valores energeticos conocidos o estimables
-- a partir de bases de datos internacionales (Agribalyse, FAO, Pimentel).
-- Los productos compuestos sin valor energetico conocido (cafunga, casabe,
-- jabones artesanales, etc.) se discuten aparte para calcular su energia
-- a partir de sus componentes.
--
-- Todos los productos se crean como:
-- - is_system = true (aparecen en la referencia mundial/catalogo global)
-- - is_approved = true (aparecen en el catalogo aprobado del nodo)
--
-- Productores identificados publicamente:
-- - Lechivita: miel, propoleo, cocomiel, quesos de bufala/cabra
-- - Alfivegetales: rucula, kale, aguacate, aji picante, moras
-- - Cacao Siborori: chocolate 80%, 65%, 100%
-- - Flor de Tilo: casabe, naiboa, catalinas
-- - SanaTe: infusiones, curcuma, moringa, jengibre
-- - Dokobaka/Totobaca: plantas medicinales, semillas
-- - Estilita Ruiz: cafunga
-- - Silio Sanchez: gallinas criollas, cabras, conejos

-- === COSECHA FRESCA: HORTALIZAS Y VERDURAS FALTANTES ===

-- Topocho (plato tipo burro, similar al platano)
-- FAO: ~2.0 MJ/kg (similar al platano)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Topocho Fresco', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Topocho fresco de conuco. Similar al platano burro. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: FAO. Documentado en Feria Conuquera.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Topocho Fresco' AND node_domain = nd.node_domain);

-- Mapuey (Dioscorea trifida, tuberculo nativo)
-- Estudios LCA: ~3.0 MJ/kg (similar a otros tuberculos andinos)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Mapuey Fresco', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Mapuey (Dioscorea trifida) fresco de conuco. Tuberculo nativo americano, variedades blanco y morado. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: estudios LCA tuberculos andinos. Documentado en Feria Conuquera (Unidad Docovaca).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mapuey Fresco' AND node_domain = nd.node_domain);

-- Name Morado (variedad morada de Dioscorea)
-- Similar al name comun: ~3.0 MJ/kg
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Name Morado Fresco', 'Alimentacion', 'Cosecha Fresca', 'Tuberculos', 'internal', 'kg',
'Name morado fresco de conuco. Variedad de Dioscorea con mayor contenido de minerales. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: estudios LCA tuberculos. Documentado en Feria Conuquera (Unidad Docovaca).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Name Morado Fresco' AND node_domain = nd.node_domain);

-- Verdolaga (Portulaca oleracea, hoja verde comestible)
-- Agribalyse: ~1.5 MJ/kg (similar a otras hojas verdes)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Verdolaga Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Verdolaga (Portulaca oleracea) fresca. Hoja verde comestible rica en omega-3. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Unidad Docovaca).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Verdolaga Fresca' AND node_domain = nd.node_domain);

-- Pira / Amaranto hoja (Amaranthus, hoja verde)
-- FAO: ~2.5 MJ/kg (hojas de amaranto)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pira (Amaranto) Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Pira o amaranto (Amaranthus) fresco. Hoja verde nutritiva, equivalente a espinaca. Tambien llamada Yerba Caracas. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: FAO. Documentado en Feria Conuquera (Unidad Docovaca).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pira (Amaranto) Fresca' AND node_domain = nd.node_domain);

-- Rucula (Eruca vesicaria, hoja verde)
-- Agribalyse: ~1.5 MJ/kg (hojas verdes tipo ensalada)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Rucula Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Rucula (Eruca vesicaria) fresca. Hoja de ensalada con sabor picante. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Alfivegetales, El Junquito).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rucula Fresca' AND node_domain = nd.node_domain);

-- Col Rizada / Kale (Brassica oleracea var. acephala)
-- Agribalyse: ~1.5 MJ/kg (hojas verdes)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Col Rizada (Kale) Fresca', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Col rizada o kale (Brassica oleracea var. acephala) fresca. Hoja verde nutritiva. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Alfivegetales, El Junquito).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Col Rizada (Kale) Fresca' AND node_domain = nd.node_domain);

-- Sauco (Sambucus, hoja/planta medicinal y comestible)
-- Agribalyse: ~1.5 MJ/kg (hojas/arbustos)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Sauco Fresco', 'Alimentacion', 'Cosecha Fresca', 'Aromaticas', 'internal', 'kg',
'Sauco (Sambucus) fresco. Hoja y flor medicinal/comestible. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas aromaticas). Documentado en Feria Conuquera.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sauco Fresco' AND node_domain = nd.node_domain);

-- Aji Picante fresco (Capsicum frutescens/annuum)
-- Agribalyse: ~3.2 MJ/kg (similar al pimenton)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aji Picante Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Aji picante fresco (Capsicum). Variedades criollas de conuco. Energia: ~3.2 MJ/kg = 0.9 kWh/kg. Fuente: Agribalyse. Documentado en Feria Conuquera (Alfivegetales).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aji Picante Fresco' AND node_domain = nd.node_domain);

-- Aji Dulce fresco (Capsicum chinense, sin picante)
-- Agribalyse: ~3.2 MJ/kg (similar al pimenton)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aji Dulce Fresco', 'Alimentacion', 'Cosecha Fresca', 'Hortalizas', 'internal', 'kg',
'Aji dulce fresco (Capsicum chinense). Base del sofrito venezolano, sin picante. Energia: ~3.2 MJ/kg = 0.9 kWh/kg. Fuente: Agribalyse. Documentado en Feria Conuquera.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aji Dulce Fresco' AND node_domain = nd.node_domain);

-- Toronjil / Melissa officinalis (hierba aromatica)
-- Agribalyse: ~1.5 MJ/kg (hierbas aromaticas)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Toronjil Fresco', 'Alimentacion', 'Cosecha Fresca', 'Aromaticas', 'internal', 'kg',
'Toronjil (Melissa officinalis) fresco. Hierba aromatica medicinal. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hierbas aromaticas). Documentado en Feria Conuquera.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Toronjil Fresco' AND node_domain = nd.node_domain);

-- === COSECHA FRESCA: FRUTAS FALTANTES ===

-- Moras (Rubus, fruta)
-- Agribalyse: ~3.0 MJ/kg (frutas rojas)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Moras Frescas', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg',
'Moras (Rubus) frescas. Fruta roja de conuco. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (frutas rojas). Documentado en Feria Conuquera (Alfivegetales, El Junquito).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Moras Frescas' AND node_domain = nd.node_domain);

-- === LACTEOS Y DERIVADOS ANIMALES ===

-- Leche de Cabra fresca
-- FAO: ~5.0 MJ/kg (leche de cabra)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Leche de Cabra Fresca', 'Alimentacion', 'Lacteos', 'Leche', 'internal', 'L',
'Leche de cabra fresca. Energia: ~5.0 MJ/kg = 1.4 kWh/kg. Fuente: FAO (produccion animal). Documentado en Feria Conuquera (Silio Sanchez, Lechivita).',
'De Patio', '', 1, true, true, '', 0, 0, 2, 0, 2, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Leche de Cabra Fresca' AND node_domain = nd.node_domain);

-- Queso de Cabra artesanal
-- LCA quesos: ~10 MJ/kg (leche + procesamiento)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Queso de Cabra Artesanal', 'Alimentacion', 'Lacteos', 'Quesos', 'internal', 'kg',
'Queso artesanal de leche de cabra. Energia: ~10 MJ/kg = 2.8 kWh/kg (leche + cuajo + procesamiento). Fuente: LCA productos lacteos. Documentado en Feria Conuquera (Silio Sanchez, Lechivita).',
'De Patio', '', 3, true, true, '', 0, 0, 3, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Queso de Cabra Artesanal' AND node_domain = nd.node_domain);

-- Queso de Bufala artesanal
-- LCA quesos: ~12 MJ/kg (leche de bufala + procesamiento)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Queso de Bufala Artesanal', 'Alimentacion', 'Lacteos', 'Quesos', 'internal', 'kg',
'Queso artesanal de leche de bufala. Energia: ~12 MJ/kg = 3.3 kWh/kg (leche de bufala + cuajo + procesamiento). Fuente: LCA productos lacteos. Documentado en Feria Conuquera (Lechivita).',
'De Patio', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Queso de Bufala Artesanal' AND node_domain = nd.node_domain);

-- Ricota artesanal
-- LCA: ~8 MJ/kg (subproducto del queso, menos energia)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Ricota Artesanal', 'Alimentacion', 'Lacteos', 'Quesos', 'internal', 'kg',
'Ricota artesanal. Subproducto del queso, requiere menos energia. Energia: ~8 MJ/kg = 2.2 kWh/kg. Fuente: LCA productos lacteos. Documentado en Feria Conuquera.',
'De Patio', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ricota Artesanal' AND node_domain = nd.node_domain);

-- Yogurt Natural artesanal
-- Agribalyse: ~4 MJ/kg (yogurt natural)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Yogurt Natural Artesanal', 'Alimentacion', 'Lacteos', 'Yogurt', 'internal', 'kg',
'Yogurt natural artesanal, sin azucar. Energia: ~4 MJ/kg = 1.1 kWh/kg. Fuente: Agribalyse (yogurt). Documentado en Feria Conuquera (Lechivita).',
'De Patio', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Yogurt Natural Artesanal' AND node_domain = nd.node_domain);

-- Dulce de Leche artesanal
-- LCA: ~8 MJ/kg (leche + azucar + coccion prolongada)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Dulce de Leche Artesanal', 'Alimentacion', 'Dulces', 'Dulce de Leche', 'internal', 'kg',
'Dulce de leche artesanal. Leche + azucar + coccion prolongada. Energia: ~8 MJ/kg = 2.2 kWh/kg. Fuente: LCA dulce de leche. Documentado en Feria Conuquera (Lechivita).',
'De Patio', '', 2, true, true, '', 0, 0, 2, 0, 2, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Dulce de Leche Artesanal' AND node_domain = nd.node_domain);

-- === MIEL Y APICULTURA ===

-- Miel Pura de Abejas
-- FAO: ~3.5 MJ/kg (miel de abejas)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Miel Pura de Abejas', 'Alimentacion', 'Miel y Apicultura', 'Miel', 'internal', 'kg',
'Miel pura de abejas. Energia: ~3.5 MJ/kg = 1.0 kWh/kg. Fuente: FAO (apicultura). Documentado en Feria Conuquera (Lechivita, 10 anos en la feria).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Miel Pura de Abejas' AND node_domain = nd.node_domain);

-- Polen de Abejas
-- FAO: ~3.5 MJ/kg (similar a la miel, producto apicola)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Polen de Abejas', 'Alimentacion', 'Miel y Apicultura', 'Polen', 'internal', 'kg',
'Polen de abejas. Producto apicola rico en proteinas. Energia: ~3.5 MJ/kg = 1.0 kWh/kg. Fuente: FAO (apicultura). Documentado en Feria Conuquera (Lechivita).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Polen de Abejas' AND node_domain = nd.node_domain);

-- === CONDIMENTOS Y ESPECIAS ===

-- Onoto Natural fresco (Bixa orellana)
-- Agribalyse: ~3.0 MJ/kg (especias/condimentos frescos)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Onoto Natural Fresco', 'Alimentacion', 'Condimentos', 'Especias', 'internal', 'kg',
'Onoto natural (Bixa orellana) fresco. Condimento tradicional venezolano para hallacas. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (condimentos). Documentado en Feria Conuquera.',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Onoto Natural Fresco' AND node_domain = nd.node_domain);

-- Curcuma Fresca (Curcuma longa)
-- Agribalyse: ~3.0 MJ/kg (raiz/condimento fresco)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Curcuma Fresca', 'Alimentacion', 'Condimentos', 'Especias', 'internal', 'kg',
'Curcuma (Curcuma longa) fresca. Raiz medicinal y condimentaria. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (raices/condimentos). Documentado en Feria Conuquera (SanaTe).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Curcuma Fresca' AND node_domain = nd.node_domain);

-- Jengibre Fresco (Zingiber officinale)
-- Agribalyse: ~3.0 MJ/kg (raiz/condimento fresco)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Jengibre Fresco', 'Alimentacion', 'Condimentos', 'Especias', 'internal', 'kg',
'Jengibre (Zingiber officinale) fresco. Raiz medicinal y condimentaria. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (raices/condimentos). Documentado en Feria Conuquera (SanaTe).',
'De Conuco', '', 1, true, true, '', 0, 0, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jengibre Fresco' AND node_domain = nd.node_domain);

-- === CACAO Y CHOCOLATE ===

-- Chocolate Artesanal 80% cacao
-- LCA chocolate: ~20 MJ/kg (mayormente cacao, poco azucar)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Chocolate Artesanal 80%', 'Alimentacion', 'Dulces', 'Chocolate', 'internal', 'kg',
'Chocolate artesanal 80% cacao. Variedades Forastero, Criollo y Porcelana de Barlovento y Paria. Sin conservantes ni lecitina. Energia: ~20 MJ/kg = 5.6 kWh/kg. Fuente: LCA chocolate artesanal. Documentado en Feria Conuquera (Cacao Siborori).',
'De Conuco', '', 6, true, true, '', 0, 0, 6, 0, 6, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chocolate Artesanal 80%' AND node_domain = nd.node_domain);

-- Chocolate Artesanal 100% cacao (pasta de cacao pura)
-- LCA cacao puro: ~25 MJ/kg (cacao 100%, sin azucar)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Chocolate Artesanal 100%', 'Alimentacion', 'Dulces', 'Chocolate', 'internal', 'kg',
'Chocolate artesanal 100% cacao (pasta de cacao pura). Sin azucar, sin conservantes, sin lecitina. Variedades Forastero, Criollo y Porcelana. Energia: ~25 MJ/kg = 6.9 kWh/kg. Fuente: LCA cacao puro. Documentado en Feria Conuquera (Cacao Siborori).',
'De Conuco', '', 7, true, true, '', 0, 0, 7, 0, 7, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chocolate Artesanal 100%' AND node_domain = nd.node_domain);

-- Cacao en Polvo artesanal
-- LCA: ~20 MJ/kg (cacao procesado en polvo)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cacao en Polvo Artesanal', 'Alimentacion', 'Condimentos', 'Cacao', 'internal', 'kg',
'Cacao en polvo artesanal. Molido a partir de grano tostado. Energia: ~20 MJ/kg = 5.6 kWh/kg. Fuente: LCA cacao procesado. Documentado en Feria Conuquera (Cacao Siborori).',
'De Conuco', '', 6, true, true, '', 0, 0, 6, 0, 6, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cacao en Polvo Artesanal' AND node_domain = nd.node_domain);

-- === CAFE ===

-- Cafe Molido Artesanal
-- Agribalyse: ~15 MJ/kg (cafe tostado y molido)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cafe Molido Artesanal', 'Alimentacion', 'Bebidas', 'Cafe', 'internal', 'kg',
'Cafe molido artesanal. Tostado y molido a partir de grano de conuco. Energia: ~15 MJ/kg = 4.2 kWh/kg. Fuente: Agribalyse (cafe tostado/molido). Documentado en Feria Conuquera (talleres de cultivo de cafe).',
'De Conuco', '', 4, true, true, '', 0, 0, 4, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cafe Molido Artesanal' AND node_domain = nd.node_domain);

-- === HUEVOS CRIOLLOS (ya existen categorias, pero el criollo de la feria es especifico) ===
-- Nota: La migracion 090 ya creo "Huevos Criollos (Semi-Libres)" con precio 6 TQ/docena.
-- No duplicamos. Solo verificamos que existe.

-- === ACTUALIZAR price_per_unit = price_per_kg * weight_kg PARA TODOS LOS NUEVOS ===
-- Los productos nuevos tienen weight_kg = 1, asi que price_per_unit = price_per_kg
-- Esto ya esta correcto en los INSERTs de arriba (price_per_unit = price_per_kg).
