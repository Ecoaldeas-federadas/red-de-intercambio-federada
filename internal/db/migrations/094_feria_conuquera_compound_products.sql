-- Migracion 094: Productos compuestos de la Feria Conuquera con energia calculada
--
-- Esta migracion agrega productos compuestos cuyo precio en TQ se calcula a partir de:
-- 1. Las materias primas que lo componen (ya en el catalogo, migraciones 089 y 093)
-- 2. La energia del proceso (coccion, fermentacion, secado, etc.)
-- 3. El tiempo de trabajo humano estimado
--
-- Fuentes de calculo energético:
-- - Agribalyse (base de datos LCA francesa)
-- - FAO (produccion animal y vegetal)
-- - Estudios LCA de pan, casabe, jabon, vermicompostaje, panela
-- - Recetas tradicionales venezolanas (ingredientes y tiempos)
--
-- Conversion: 1 TQ ≈ 1 kWh ≈ 3.6 MJ
--
-- Todos los productos se crean como:
-- - is_system = true (aparecen en la referencia mundial/catalogo global)
-- - is_approved = true (aparecen en el catalogo aprobado del nodo)

-- =====================================================================
-- ALIMENTOS TRADICIONALES VENEZOLANOS
-- =====================================================================

-- === CASABE ===
-- Receta: 2 kg yuca amarga -> 1 kg casabe (rendimiento ~50%)
-- Energia: yuca (3 MJ/kg x 2 = 6 MJ) + rallado+prensado (trabajo ~1h) + coccion budare 15 min (~3 MJ)
-- Total: ~9 MJ/kg = ~2.5 kWh/kg -> 3 TQ/kg
-- Fuentes: comidasvenezolanas.org, laylita.com, 196flavors.com, radio.otilca.org
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Casabe Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Panaderia', 'internal', 'unidad',
'Casabe artesanal de yuca amarga. Pan ancestral indigena: yuca rallada, prensada en sebucan, tostada en budare. Ingredientes: yuca amarga, sal. Rendimiento: 2 kg yuca -> 1 kg casabe. Energia: yuca (6 MJ) + coccion (3 MJ) = 9 MJ/kg = 2.5 kWh/kg. Tiempo: 1h preparacion + 15 min coccion. Fuente: recetas tradicionales + LCA yuca. Documentado en Feria Conuquera (Flor de Tilo, El Hatillo).',
'De Conuco', '', 3, true, true, '', 2, 1, 0, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Casabe Artesanal' AND node_domain = nd.node_domain);

-- === NAIBOA ===
-- Receta: 2 tortas de casabe + melado de papelon + queso blanco rallado + anis
-- Energia: casabe (9 MJ/kg x 0.1 = 0.9) + papelon (15 MJ/kg x 0.05 = 0.75) + queso (10 MJ/kg x 0.05 = 0.5) + horneado 10 min (~2 MJ)
-- Total: ~4 MJ/unidad ~200g = ~20 MJ/kg = ~5.5 kWh/kg -> 4 TQ/unidad (peso ~200g)
-- Fuentes: Wikipedia, EcuRed, lecturas-yantares-placeres.blogspot.com, atril.press
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Naiboa Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Dulces Tradicionales', 'internal', 'unidad',
'Naiboa artesanal. Primer dulce netamente venezolano. Dos tortas de casabe rellenas con melado de papelon, queso blanco rallado y semillas de anis, horneadas. Ingredientes: casabe, papelon, queso blanco, anis. Energia: casabe + papelon + queso + horneado = ~4 MJ/unidad (200g) = ~20 MJ/kg = 5.5 kWh/kg. Tiempo: 30 min preparacion + 10 min horneado. Fuente: Wikipedia, EcuRed, recetas tradicionales. Documentado en Feria Conuquera (Flor de Tilo).',
'De Conuco', '', 4, true, true, '', 3, 1, 1, 0, 20, 'kg', 0.2
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Naiboa Artesanal' AND node_domain = nd.node_domain);

-- === CATALINAS (PALEDONIAS) ===
-- Receta: 280g harina trigo + 250g papelon + 100g mantequilla + especias + horneado 20 min 150°C
-- Energia: harina trigo (14 MJ/kg x 0.28 = 3.9) + papelon (15 x 0.25 = 3.75) + mantequilla (30 x 0.1 = 3) + horneado (~3 MJ)
-- Total: ~14 MJ/porcion ~100g = ~140 MJ/kg = ~39 kWh/kg -> 4 TQ/100g (price_per_kg=40, weight=0.1, price=4)
-- Fuentes: recetas.elperiodico.com, noticias24hrs.com.ve, ultimasnoticias.com.ve, cookmagic.net
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Catalinas Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Dulces Tradicionales', 'internal', 'unidad',
'Catalinas (paledonias/cucas negras). Galletas dulces especiadas de origen colonial. Ingredientes: harina de trigo, melado de papelon, mantequilla, canela, clavo, jengibre, bicarbonato. Energia: harina + papelon + mantequilla + horneado 20 min 150°C = ~14 MJ/100g = ~140 MJ/kg = 39 kWh/kg. Rinde 8 unidades. Tiempo: 45 min total. Fuente: recetas tradicionales venezolanas. Documentado en Feria Conuquera (Flor de Tilo).',
'De Conuco', '', 4, true, true, '', 3, 1, 1, 0, 40, 'kg', 0.1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Catalinas Artesanales' AND node_domain = nd.node_domain);

-- === BESITO DE COCO ===
-- Receta: 100g coco rallado + 150g harina trigo + 100g papelon + especias + huevos + horneado 25 min 180°C
-- Energia: coco (6 MJ/kg x 0.1 = 0.6) + harina trigo (14 x 0.15 = 2.1) + papelon (15 x 0.1 = 1.5) + huevo + horneado (~3 MJ)
-- Total: ~8 MJ/unidad ~80g = ~100 MJ/kg = ~28 kWh/kg -> 3 TQ/unidad (price_per_kg=35, weight=0.08, price=2.8->3)
-- Fuentes: chefspencil.com, 196flavors.com, elestimulo.com
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Besito de Coco Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Dulces Tradicionales', 'internal', 'unidad',
'Besito de coco artesanal. Dulce tradicional caribeno de origen colonial. Ingredientes: coco rallado, harina de trigo, papelon, clavos, canela, guayabita, huevos, polvo de hornear. Energia: coco + harina + papelon + huevos + horneado 25 min 180°C = ~8 MJ/unidad (80g) = ~100 MJ/kg = 28 kWh/kg. Tiempo: 1h total. Fuente: recetas tradicionales. Documentado en Feria Conuquera.',
'De Conuco', '', 3, true, true, '', 2, 1, 1, 0, 35, 'kg', 0.08
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Besito de Coco Artesanal' AND node_domain = nd.node_domain);

-- === CAFUNGA ===
-- Receta: cambur titiaro + cambur morado + papelon + coco + clavo + anis, envuelto en hoja de cambur, coccion 1h
-- Energia: cambur (1.8 MJ/kg x 0.5 = 0.9) + papelon (15 x 0.2 = 3) + coco (6 x 0.1 = 0.6) + coccion 1h (~3 MJ)
-- Total: ~7 MJ/unidad ~300g = ~23 MJ/kg = ~6.5 kWh/kg -> 2 TQ/unidad (price_per_kg=7, weight=0.3, price=2.1->2)
-- Fuentes: Blog oficial Feria Conuquera, Haiman El Troudi
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cafunga de Barlovento', 'Alimentacion', 'Gastronomia Artesanal', 'Dulces Tradicionales', 'internal', 'unidad',
'Cafunga de Barlovento. Dulce afrovenezolano ancestral. Ingredientes: cambur titiaro, cambur morado, papelon, coco rallado, clavo de olor, anis. Envuelto en hoja de cambur. Energia: cambur + papelon + coco + coccion 1h = ~7 MJ/unidad (300g) = ~23 MJ/kg = 6.5 kWh/kg. Tiempo: 1.5h preparacion + 1h coccion. Fuente: Blog oficial Feria Conuquera, Haiman El Troudi. Productora: Estilita Ruiz "Reina de la Cafunga".',
'De Conuco', '', 2, true, true, '', 1, 1, 1, 0, 7, 'kg', 0.3
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cafunga de Barlovento' AND node_domain = nd.node_domain);

-- === PAN ARTESANAL DE MASA MADRE ===
-- Receta: harina de trigo + agua + masa madre + sal, fermentacion 24h, horneado 45 min 230°C
-- Energia: harina trigo (14 MJ/kg x 0.6 = 8.4) + fermentacion (sin energia externa) + horneado 45 min 230°C (~7 MJ)
-- Total: ~15 MJ/kg = ~4.2 kWh/kg -> 4 TQ/kg
-- Fuentes: LCA pan artesanal (Argentina: 0.5-1.3 kg CO2/kg), Springer LCA bread-baking, cipycos.umsa.bo
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pan Artesanal de Masa Madre', 'Alimentacion', 'Gastronomia Artesanal', 'Panaderia', 'internal', 'kg',
'Pan artesanal de masa madre. Fermentacion natural 24h, horneado en horno artesanal. Ingredientes: harina de trigo, agua, masa madre (cultivo de bacterias lacticas y levaduras), sal. Energia: harina (8.4 MJ) + horneado 45 min 230°C (7 MJ) = ~15 MJ/kg = 4.2 kWh/kg. Tiempo activo: 45 min. Tiempo total: 24h. Fuente: LCA pan artesanal (Springer, Argentina). Documentado en Feria Conuquera (Flor de Tilo).',
'Hecho en Casa', '', 4, true, true, '', 2, 1, 2, 0, 4, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pan Artesanal de Masa Madre' AND node_domain = nd.node_domain);

-- === AREPA DE AUYAMA ===
-- Receta: harina de maiz + auyama cocida + agua + sal, coccion en budare 10 min por lado
-- Energia: harina maiz (14 MJ/kg x 0.1 = 1.4) + auyama (3 x 0.1 = 0.3) + coccion 20 min (~2 MJ)
-- Total: ~4 MJ/unidad ~150g = ~25 MJ/kg = ~7 kWh/kg -> 2 TQ/unidad (price_per_kg=10, weight=0.15, price=1.5->2)
-- Fuentes: yaeshoravenezuela.com, elchefreal.com, Lombriz Roja Urbana
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arepa de Auyama Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Panaderia', 'internal', 'unidad',
'Arepa de auyama artesanal. Masa de harina de maiz precocida con auyama cocida, asada en budare. Ingredientes: harina de maiz, auyama, agua, sal. Energia: harina + auyama + coccion budare 20 min = ~4 MJ/unidad (150g) = ~25 MJ/kg = 7 kWh/kg. Tiempo: 30 min. Fuente: recetas tradicionales + Lombriz Roja Urbana. Documentado en Feria Conuquera.',
'Hecho en Casa', '', 2, true, true, '', 1, 1, 1, 0, 10, 'kg', 0.15
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arepa de Auyama Artesanal' AND node_domain = nd.node_domain);

-- === AREPA DE PLATANO ===
-- Similar a la de auyama pero con platano maduro
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arepa de Platano Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Panaderia', 'internal', 'unidad',
'Arepa de platano artesanal. Masa de harina de maiz con platano maduro, asada en budare. Ingredientes: harina de maiz, platano maduro, agua, sal. Energia: harina + platano + coccion budare 20 min = ~4 MJ/unidad (150g) = ~25 MJ/kg = 7 kWh/kg. Tiempo: 30 min. Fuente: recetas tradicionales + Lombriz Roja Urbana. Documentado en Feria Conuquera.',
'Hecho en Casa', '', 2, true, true, '', 1, 1, 1, 0, 10, 'kg', 0.15
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arepa de Platano Artesanal' AND node_domain = nd.node_domain);

-- === TORTA DE PLATANO ===
-- Receta: platano maduro + especias + horno 30 min
-- Energia: platano (2 MJ/kg x 0.5 = 1) + azucar/papelon (15 x 0.1 = 1.5) + horneado 30 min (~3 MJ)
-- Total: ~5 MJ/porcion ~200g = ~25 MJ/kg = ~7 kWh/kg -> 2 TQ/porcion (price_per_kg=10, weight=0.2, price=2)
-- Fuentes: Prensa Rural
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Torta de Platano Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Postres', 'internal', 'porcion',
'Torta de platano artesanal. Platano maduro horneado con especias. Ingredientes: platano maduro, papelon, canela, clavo. Energia: platano + papelon + horneado 30 min = ~5 MJ/porcion (200g) = ~25 MJ/kg = 7 kWh/kg. Tiempo: 1h total. Fuente: Prensa Rural. Documentado en Feria Conuquera.',
'Hecho en Casa', '', 2, true, true, '', 1, 1, 1, 0, 10, 'kg', 0.2
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Torta de Platano Artesanal' AND node_domain = nd.node_domain);

-- =====================================================================
-- BEBIDAS
-- =====================================================================

-- === PAPELON CON LIMON (AGUAPANELA) ===
-- Receta: 200g papelon + 1L agua + jugo de 2 limones + hielo
-- Energia: papelon (15 MJ/kg x 0.2 = 3 MJ) + limon (3 x 0.1 = 0.3) + coccion/disolucion 20 min (~1 MJ)
-- Total: ~4 MJ/L = ~1.1 kWh/L -> 1 TQ/L
-- Fuentes: thecookwaregeek.com, venezuelancooking.wordpress.com, enrilemoine.com, Wikipedia
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Papelon con Limon', 'Alimentacion', 'Bebidas', 'Bebidas Naturales', 'internal', 'L',
'Papelon con limon (aguapanela). Bebida tradicional venezolana refrescante. Ingredientes: papelon, agua, jugo de limon. Energia: papelon (3 MJ) + limon (0.3 MJ) + disolucion/coccion 20 min (1 MJ) = ~4 MJ/L = 1.1 kWh/L. Tiempo: 30 min. Fuente: recetas tradicionales + Wikipedia. Documentado en Feria Conuquera.',
'Hecho en Casa', '', 1, true, true, '', 1, 0, 1, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Papelon con Limon' AND node_domain = nd.node_domain);

-- === AGUAMIEL ===
-- Receta: miel diluida en agua + levadura, fermentacion ligera espontanea
-- Energia: miel (3.5 MJ/kg x 0.15 = 0.53 MJ) + fermentacion espontanea (sin energia externa)
-- Total: ~1 MJ/L = ~0.3 kWh/L -> 1 TQ/L
-- Fuentes: todohidromiel.com, Lechivita (Feria Conuquera)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aguamiel', 'Alimentacion', 'Bebidas', 'Fermentados', 'internal', 'L',
'Aguamiel. Bebida fermentada ligera a base de miel diluida en agua. Ingredientes: miel, agua, levaduras naturales. Energia: miel (0.5 MJ) + fermentacion espontanea (sin energia externa) = ~1 MJ/L = 0.3 kWh/L. Tiempo: fermentacion 3-7 dias. Fuente: todohidromiel.com. Documentado en Feria Conuquera (Lechivita).',
'De Conuco', '', 1, true, true, '', 0, 1, 0, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aguamiel' AND node_domain = nd.node_domain);

-- === HIDROMIEL (VINO DE MIEL) ===
-- Receta: 300g miel + 2L agua + levadura Saccharomyces, fermentacion 2-4 semanas
-- Energia: miel (3.5 MJ/kg x 0.15 = 0.53 MJ/L) + levadura + fermentacion (sin energia externa, ~22°C)
-- Total: ~2 MJ/L = ~0.6 kWh/L -> 1 TQ/L
-- Fuentes: todohidromiel.com, inkbird.com, ri.agro.uba.ar, abc.es
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Hidromiel (Vino de Miel)', 'Alimentacion', 'Bebidas', 'Fermentados', 'internal', 'L',
'Hidromiel (vino de miel). Bebida alcoholica fermentada ancestral. Ingredientes: miel, agua, levadura Saccharomyces cerevisiae. Energia: miel (0.5 MJ/L) + fermentacion 2-4 semanas a 22°C (sin energia externa) = ~2 MJ/L = 0.6 kWh/L. Grado alcoholico: 8-12%. Tiempo: 2-4 semanas fermentacion + 2 meses maduracion. Fuente: todohidromiel.com, FAUBA. Documentado en Feria Conuquera (Lechivita).',
'De Conuco', '', 1, true, true, '', 0, 1, 1, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hidromiel (Vino de Miel)' AND node_domain = nd.node_domain);

-- === COCOMIEL ===
-- Receta: miel + coco + coccion (invencion familiar Lechivita)
-- Energia: miel (3.5 MJ/kg x 0.2 = 0.7) + coco (6 x 0.1 = 0.6) + coccion (~1.5 MJ)
-- Total: ~3 MJ/L = ~0.8 kWh/L -> 1 TQ/L
-- Fuentes: Ultimas Noticias (Lechivita)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cocomiel', 'Alimentacion', 'Bebidas', 'Fermentados', 'internal', 'L',
'Cocomiel. Bebida artesanal inventada por la familia Lechivita. Mezcla de miel y coco con coccion. Ingredientes: miel, coco, agua. Energia: miel (0.7 MJ) + coco (0.6 MJ) + coccion (1.5 MJ) = ~3 MJ/L = 0.8 kWh/L. Tiempo: 2h preparacion. Fuente: Ultimas Noticias. Documentado en Feria Conuquera (Lechivita).',
'De Conuco', '', 1, true, true, '', 1, 1, 1, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cocomiel' AND node_domain = nd.node_domain);

-- =====================================================================
-- HARINAS ALTERNATIVAS
-- =====================================================================

-- === HARINA DE YUCA ===
-- Produccion: yuca fresca (60% humedad) -> secado -> molienda. Rendimiento ~40%
-- Energia: yuca (3 MJ/kg x 2.5 = 7.5 MJ, rendimiento 40%) + secado solar/electrico (~3 MJ) + molienda (~1 MJ)
-- Total: ~12 MJ/kg = ~3.3 kWh/kg -> 3 TQ/kg
-- Fuentes: LCA cassava flour Nigeria (academicjournals.org), scielo.sld.cu, CIAT
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Harina de Yuca Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Harinas Alternativas', 'internal', 'kg',
'Harina de yuca artesanal. Yuca pelada, secada (solar o electrica) y molida. Sin gluten, sin aditivos. Rendimiento: 2.5 kg yuca -> 1 kg harina. Energia: yuca (7.5 MJ) + secado (3 MJ) + molienda (1 MJ) = ~12 MJ/kg = 3.3 kWh/kg. Tiempo: 1 dia secado solar. Fuente: LCA cassava flour Nigeria, CIAT. Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'De Conuco', '', 3, true, true, '', 2, 1, 1, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Harina de Yuca Artesanal' AND node_domain = nd.node_domain);

-- === HARINA DE CAMBUR ===
-- Produccion: cambur verde -> rebanadas -> secado solar/electrico -> molienda. Rendimiento ~20%
-- Energia: cambur (1.8 MJ/kg x 5 = 9 MJ, rendimiento 20%) + secado solar (~2 MJ) + molienda (~1 MJ)
-- Total: ~12 MJ/kg = ~3.3 kWh/kg -> 3 TQ/kg
-- Fuentes: Desde La Plaza (Luis Angel Leisiaga), LCA secado de frutas
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Harina de Cambur Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Harinas Alternativas', 'internal', 'kg',
'Harina de cambur artesanal. Cambur verde rebanado, secado (solar o electrico) y molido. Sin gluten, sin aditivos, sin conservantes. Apta para panquecas, ponques, galletas, brownies, pies, alfajores, bizcochos, waffles. Rendimiento: 5 kg cambur -> 1 kg harina. Energia: cambur (9 MJ) + secado (2 MJ) + molienda (1 MJ) = ~12 MJ/kg = 3.3 kWh/kg. Tiempo: 1-2 dias secado solar. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga, harina "Buen Pan").',
'De Conuco', '', 3, true, true, '', 2, 1, 1, 0, 3, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Harina de Cambur Artesanal' AND node_domain = nd.node_domain);

-- =====================================================================
-- COSMETICA E HIGIENE NATURAL
-- =====================================================================

-- === JABON ARTESANAL DE ACEITE RECICLADO ===
-- Produccion: saponificacion en frio. Aceite reciclado + NaOH + agua + aditivos naturales. Curado 4-6 semanas.
-- Energia: LCA jabon con WCO: ~8 MJ/kg (reduccion 58-61% vs virgen) + saponificacion (exotermica, sin energia externa) + curado (pasivo)
-- Total: ~10 MJ/kg = ~2.8 kWh/kg -> 3 TQ/kg. Barra 90g = 0.27 TQ -> 1 TQ/barra (price_per_kg=10, weight=0.09, price=0.9->1)
-- Fuentes: Springer LCA WCO soap, MDPI Sustainability, hdl.handle.net/10882/19165
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Jabon Artesanal de Aceite Reciclado', 'Salud y Medicina', 'Higiene Natural', 'Jabones', 'internal', 'unidad',
'Jabon artesanal hecho con aceite de cocina reciclado. Saponificacion en frio con NaOH, agua y aditivos naturales. Variantes: avena, romero, pino, miel, canela, sabila, cafe. Sin conservantes ni quimicos industriales. Curado 4-6 semanas. Energia: LCA WCO soap ~8 MJ/kg + proceso (2 MJ) = ~10 MJ/kg = 2.8 kWh/kg. Barra 90g = 0.9 TQ. Huella de carbono reducida 58-61% vs jabon industrial. Fuente: Springer LCA, MDPI Sustainability. Documentado en Feria Conuquera (Territorio K-ribe, Guatire).',
'Limpieza Natural', '', 1, true, true, '', 1, 1, 1, 0, 10, 'kg', 0.09
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jabon Artesanal de Aceite Reciclado' AND node_domain = nd.node_domain);

-- === DESODORANTE NATURAL ===
-- Produccion: bicarbonato + almidon de maiz + aceite de coco + aceites esenciales. Mezclado en frio.
-- Energia: ingredientes (~8 MJ/kg) + mezclado (minimo, ~1 MJ)
-- Total: ~9 MJ/kg = ~2.5 kWh/kg -> 3 TQ/kg. Barra 50g = 0.15 TQ -> 1 TQ (price_per_kg=15, weight=0.05, price=0.75->1)
-- Fuentes: Desde La Plaza, Prensa Rural (Territorio K-ribe)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Desodorante Natural Artesanal', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'unidad',
'Desodorante natural artesanal. Sin aluminio, sin parabenos. Ingredientes: bicarbonato de sodio, almidon de maiz, aceite de coco, aceites esenciales. Energia: ingredientes (8 MJ/kg) + mezclado (1 MJ) = ~9 MJ/kg = 2.5 kWh/kg. Barra 50g. Fuente: Desde La Plaza, Prensa Rural. Documentado en Feria Conuquera (Territorio K-ribe).',
'Limpieza Natural', '', 1, true, true, '', 1, 1, 0, 0, 15, 'kg', 0.05
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Desodorante Natural Artesanal' AND node_domain = nd.node_domain);

-- =====================================================================
-- INSUMOS AGROECOLOGICOS
-- =====================================================================

-- === HUMUS DE LOMBRIZ SOLIDO ===
-- Produccion: vermicompostaje de residuos organicos con Eisenia foetida. 2-3 meses. Sin energia externa.
-- Energia: LCA vermicompostaje: ~2 MJ/kg (principalmente transporte y manejo, el proceso biologico es autonomo)
-- Total: ~2 MJ/kg = ~0.6 kWh/kg -> 1 TQ/kg
-- Fuentes: MDPI Carbon Footprint composting/vermicomposting, scielo.org.mx emergia lombricompost
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Humus de Lombriz Solido', 'Agricultura', 'Insumos Agroecologicos', 'Abonos Organicos', 'internal', 'kg',
'Humus de lombriz solido. Vermicompostaje de residuos organicos con lombriz roja californiana (Eisenia foetida). Proceso biologico autonomo 2-3 meses, sin energia externa. Energia: LCA vermicompostaje ~2 MJ/kg = 0.6 kWh/kg (manejo + empaque). Fuente: MDPI, scielo.org.mx. Documentado en Feria Conuquera (Lombriz Roja Urbana).',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Humus de Lombriz Solido' AND node_domain = nd.node_domain);

-- === HUMUS DE LOMBRIZ LIQUIDO ===
-- Produccion: humus solido + agua, extraccion por lixiviacion. Presentacion: botellas 500cc, 1000cc, 1500cc.
-- Energia: humus solido (2 MJ/kg x 0.2 = 0.4) + agua + extraccion (~0.5 MJ)
-- Total: ~1 MJ/L = ~0.3 kWh/L -> 1 TQ/L
-- Fuentes: Lombriz Roja Urbana (blog)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Humus de Lombriz Liquido', 'Agricultura', 'Insumos Agroecologicos', 'Biofertilizantes', 'internal', 'L',
'Humus de lombriz liquido (lixiviado). Extraccion liquida de humus solido. Presentaciones: botellas 500cc, 1000cc, 1500cc. Energia: humus (0.4 MJ) + extraccion (0.5 MJ) = ~1 MJ/L = 0.3 kWh/L. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera (Lombriz Roja Urbana).',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Humus de Lombriz Liquido' AND node_domain = nd.node_domain);

-- === PIE DE CRIA DE LOMBRIZ ROJA CALIFORNIANA ===
-- Produccion: cria de Eisenia foetida en sustrato organico. Presentacion: 300g, 400g, 1.5kg, 2kg.
-- Energia: sustrato + manejo de cria (~3 MJ/kg)
-- Total: ~3 MJ/kg = ~0.8 kWh/kg -> 1 TQ/kg
-- Fuentes: Lombriz Roja Urbana (blog)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pie de Cria de Lombriz Roja Californiana', 'Agricultura', 'Insumos Agroecologicos', 'Vermicultura', 'internal', 'kg',
'Pie de cria de lombriz roja californiana (Eisenia foetida). Sustrato organico con mas de 20 lombrices en 300g, incluye capullos (cocoons). Presentaciones: 300g, 400g, 1.5kg, 2kg. Energia: sustrato + manejo de cria = ~3 MJ/kg = 0.8 kWh/kg. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera (Lombriz Roja Urbana).',
'Agroecologico', '', 1, true, true, '', 0, 1, 1, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pie de Cria de Lombriz Roja Californiana' AND node_domain = nd.node_domain);

-- === COMPOST MADURO ===
-- Produccion: compostaje de residuos organicos vegetales. 2-6 meses. Sin energia externa.
-- Energia: LCA compostaje: ~1.5 MJ/kg (manejo + volteo)
-- Total: ~1.5 MJ/kg = ~0.4 kWh/kg -> 1 TQ/kg
-- Fuentes: MDPI Carbon Footprint composting
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Compost Maduro Artesanal', 'Agricultura', 'Insumos Agroecologicos', 'Abonos Organicos', 'internal', 'kg',
'Compost maduro artesanal. Compostaje de residuos organicos vegetales 2-6 meses. Proceso biologico autonomo, sin energia externa. Energia: LCA compostaje ~1.5 MJ/kg = 0.4 kWh/kg (manejo + volteo). Fuente: MDPI. Documentado en Feria Conuquera (Dokobaka, otros).',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'kg', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Compost Maduro Artesanal' AND node_domain = nd.node_domain);

-- === MICROORGANISMOS DE MONTANA ===
-- Produccion: fermentacion de microorganismos efficaces (lactobacilos, levaduras) con melaza.
-- Energia: melaza (15 MJ/kg x 0.05 = 0.75) + fermentacion (sin energia externa) + empaque
-- Total: ~2 MJ/L = ~0.6 kWh/L -> 1 TQ/L
-- Fuentes: Lombriz Roja Urbana
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Microorganismos de Montana', 'Agricultura', 'Insumos Agroecologicos', 'Bioinsumos', 'internal', 'L',
'Microorganismos de montana (MM). Fermentacion de lactobacilos, levaduras y hongos beneficiosos con melaza. Bioinsumo para activar compostaje y mejorar suelo. Energia: melaza (0.75 MJ) + fermentacion (sin energia externa) = ~2 MJ/L = 0.6 kWh/L. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'L', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Microorganismos de Montana' AND node_domain = nd.node_domain);

-- =====================================================================
-- PRODUCTOS VEGETARIANOS/VEGANOS
-- =====================================================================

-- === CROQUETAS DE SOYA ===
-- Receta: soya + condimentos + harina + fritura/horneado
-- Energia: soya (15 MJ/kg x 0.1 = 1.5) + harina (14 x 0.05 = 0.7) + coccion 15 min (~2 MJ)
-- Total: ~4 MJ/unidad ~80g = ~50 MJ/kg = ~14 kWh/kg -> 2 TQ/unidad (price_per_kg=20, weight=0.08, price=1.6->2)
-- Fuentes: Desde La Plaza (Luis Angel Leisiaga)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Croquetas de Soya Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Vegetariano', 'internal', 'unidad',
'Croquetas de soya artesanales. Producto vegetariano. Ingredientes: soya, condimentos, harina, coccion al horno o fritura. Energia: soya (1.5 MJ) + harina (0.7 MJ) + coccion 15 min (2 MJ) = ~4 MJ/unidad (80g) = ~50 MJ/kg = 14 kWh/kg. Tiempo: 30 min. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'Vegetariano', '', 2, true, true, '', 1, 1, 1, 0, 20, 'kg', 0.08
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Croquetas de Soya Artesanales' AND node_domain = nd.node_domain);

-- === TORTICAS VEGANAS ===
-- Receta: harina vegetal + vegetales + especias + horneado
-- Energia: harina (14 MJ/kg x 0.08 = 1.1) + vegetales (3 x 0.05 = 0.15) + horneado 20 min (~2 MJ)
-- Total: ~3.5 MJ/unidad ~80g = ~44 MJ/kg = ~12 kWh/kg -> 2 TQ/unidad (price_per_kg=20, weight=0.08, price=1.6->2)
-- Fuentes: Desde La Plaza (Luis Angel Leisiaga)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Torticas Veganas Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Vegetariano', 'internal', 'unidad',
'Torticas veganas artesanales. Producto 100% vegetal. Ingredientes: harina de legumbres/cereales, vegetales, especias. Sin productos de origen animal. Energia: harina (1.1 MJ) + vegetales (0.15 MJ) + horneado 20 min (2 MJ) = ~3.5 MJ/unidad (80g) = ~44 MJ/kg = 12 kWh/kg. Tiempo: 30 min. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'Vegano', '', 2, true, true, '', 1, 1, 1, 0, 20, 'kg', 0.08
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Torticas Veganas Artesanales' AND node_domain = nd.node_domain);

-- === CHIMICHURRI DE MANGO ===
-- Receta: mango + especias + vinagre + hierbas, coccion y envasado
-- Energia: mango (3 MJ/kg x 0.3 = 0.9) + vinagre (10 x 0.1 = 1) + coccion 30 min (~2 MJ)
-- Total: ~4 MJ/frasco ~250g = ~16 MJ/kg = ~4.4 kWh/kg -> 2 TQ/frasco (price_per_kg=8, weight=0.25, price=2)
-- Fuentes: Desde La Plaza (Luis Angel Leisiaga)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Chimichurri de Mango Artesanal', 'Alimentacion', 'Condimentos', 'Salsas', 'internal', 'frasco',
'Chimichurri de mango artesanal. Salsa agridulce de mango con especias y vinagre. Ingredientes: mango, vinagre, especias, hierbas. Energia: mango (0.9 MJ) + vinagre (1 MJ) + coccion 30 min (2 MJ) = ~4 MJ/frasco (250g) = ~16 MJ/kg = 4.4 kWh/kg. Tiempo: 1h total. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'Hecho en Casa', '', 2, true, true, '', 1, 1, 1, 0, 8, 'kg', 0.25
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chimichurri de Mango Artesanal' AND node_domain = nd.node_domain);

-- =====================================================================
-- PLANTAS Y SEMILLAS
-- =====================================================================

-- === PLANTAS MEDICINALES (VIVAS) ===
-- Produccion: germinacion/estaca + cultivo en maceta 2-6 meses
-- Energia: tierra + semilla/estaca + riego + manejo (~3.6 MJ/maceta)
-- Total: ~3.6 MJ/maceta = ~1 kWh -> 1 TQ/maceta
-- Fuentes: Blog oficial Feria Conuquera (Dokobaka, Madre Selva)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Plantas Medicinales (Maceta)', 'Agricultura', 'Vivero', 'Medicinales', 'internal', 'maceta',
'Plantas medicinales vivas en maceta. Variedades: sabila, ruda, oregano, romero, malojillo, poleo, estevia, llanten, calendula. Energia: tierra + semilla/estaca + riego + manejo 2-6 meses = ~3.6 MJ/maceta = 1 kWh. Fuente: Blog oficial Feria Conuquera. Documentado en Feria Conuquera (Dokobaka, Madre Selva).',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'unidad', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plantas Medicinales (Maceta)' AND node_domain = nd.node_domain);

-- === SEMILLAS CRIOLLAS ===
-- Produccion: cosecha + secado + seleccion + almacenamiento
-- Energia: ~3.6 MJ/sobre = ~1 kWh -> 1 TQ/sobre
-- Fuentes: Blog oficial, Diario VEA (30 especies de leguminosas)
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Semillas Criollas Ancestrales', 'Agricultura', 'Semillas', 'Criollas', 'internal', 'sobre',
'Semillas criollas y ancestrales. Variedades: maiz cariaco, frijol, caraota, ahuyama, tomate, pimenton, lechuga, cilantro. 30 especies de leguminosas ancestrales documentadas. Energia: cosecha + secado + seleccion + almacenamiento = ~3.6 MJ/sobre = 1 kWh. Fuente: Blog oficial, Diario VEA. Documentado en Feria Conuquera.',
'Agroecologico', '', 1, true, true, '', 0, 1, 0, 0, 1, 'unidad', 1
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Semillas Criollas Ancestrales' AND node_domain = nd.node_domain);

-- =====================================================================
-- ACTUALIZAR price_per_unit PARA PRODUCTOS DONDE price_per_kg * weight_kg != price_per_unit
-- =====================================================================
-- Para los productos donde weight_kg != 1, recalcular price_per_unit
UPDATE products SET price_per_unit = ROUND(price_per_kg * weight_kg)
WHERE name IN (
  'Naiboa Artesanal',
  'Catalinas Artesanales',
  'Besito de Coco Artesanal',
  'Cafunga de Barlovento',
  'Arepa de Auyama Artesanal',
  'Arepa de Platano Artesanal',
  'Torta de Platano Artesanal',
  'Jabon Artesanal de Aceite Reciclado',
  'Desodorante Natural Artesanal',
  'Croquetas de Soya Artesanales',
  'Torticas Veganas Artesanales',
  'Chimichurri de Mango Artesanal'
)
AND price_per_unit != ROUND(price_per_kg * weight_kg);
