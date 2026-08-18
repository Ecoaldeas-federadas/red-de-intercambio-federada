-- Migracion 037: Catalogo completo de productos y servicios de comunidad autosustentable
--
-- Inserta productos nuevos agrupados por equivalencia energetica.
-- NO borra productos existentes. Solo inserta donde no existe el nombre.
-- Baseline: 1 hora de trabajo humano = 325 TQ

-- ============ ALIMENTACION: Cosecha Fresca ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Frutas de Temporada', 'Alimentacion', 'Cosecha Fresca', 'Frutas', 'internal', 'kg', 'Mango, papaya, guayaba, patilla, melon, pina, lechosa, cambur, limon, naranja, mandarina, aguacate.', 'De Estacion', 'https://images.unsplash.com/photo-1619566636856-adf8ab172aa0?auto=format&fit=crop&w=600&q=80', 60, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Frutas de Temporada' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Raices y Bulbos', 'Alimentacion', 'Cosecha Fresca', 'Raices', 'internal', 'kg', 'Apio, name topi, mapuey, batata, borugo, rabano.', 'Raices Criollas', 'https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80', 65, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Raices y Bulbos' AND node_domain = nd.node_domain);

-- ============ ALIMENTACION: Gastronomia Artesanal ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Panaderia y Masas Caseras', 'Alimentacion', 'Gastronomia Artesanal', 'Panaderia', 'internal', 'kg', 'Pan de maiz, pan de trigo integral, arepas, cachapas, bollos, empanadas, tortillas de maiz.', 'Hecho en Casa', 'https://images.unsplash.com/photo-1509444154694-2c20049b1c1e?auto=format&fit=crop&w=600&q=80', 150, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Panaderia y Masas Caseras' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Encurtidos y Salsas', 'Alimentacion', 'Gastronomia Artesanal', 'Conservas', 'internal', 'frasco', 'Encurtidos de vegetales, tomate enlatado, salsa picante, guasacaca, pesto de albahaca.', 'Conserva Viva', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 180, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Encurtidos y Salsas' AND node_domain = nd.node_domain);

-- ============ ALIMENTACION: Endulzantes ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Papelon y Panela', 'Alimentacion', 'Endulzantes', 'Panela', 'internal', 'kg', 'Papelon en bloque, panela granulada, rapadura, melaza de cana.', 'De Cana', 'https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80', 800, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Papelon y Panela' AND node_domain = nd.node_domain);

-- ============ ALIMENTACION: Carnes y Pescados ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carnes de Pastoreo', 'Alimentacion', 'Carnes y Pescados', 'Carnes', 'internal', 'kg', 'Carne de res, cerdo criollo, pollo de patio, chivo, conejo, pato.', 'Pastoreo Libre', 'https://images.unsplash.com/photo-1607623814025-e3df5d8d6e1e?auto=format&fit=crop&w=600&q=80', 1200, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carnes de Pastoreo' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Pescados y Mariscos', 'Alimentacion', 'Carnes y Pescados', 'Pescados', 'internal', 'kg', 'Pescado fresco de rio, pescado salado, carite, cazon, camarones, cangrejo.', 'Del Rio/Mar', 'https://images.unsplash.com/photo-1535140728325-a4d3707eee61?auto=format&fit=crop&w=600&q=80', 1000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pescados y Mariscos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Huevos Frescos', 'Alimentacion', 'Carnes y Pescados', 'Huevos', 'internal', 'docena', 'Huevos de gallina criolla, huevos de pato, huevos de codorniz.', 'De Patio', 'https://images.unsplash.com/photo-1569288063648-8a3d4f5e2f4e?auto=format&fit=crop&w=600&q=80', 600, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Huevos Frescos' AND node_domain = nd.node_domain);

-- ============ ALIMENTACION: Bebidas ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Bebidas Fermentadas', 'Alimentacion', 'Bebidas', 'Fermentadas', 'internal', 'litro', 'Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha artesanal.', 'Fermentacion Natural', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bebidas Fermentadas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Infusiones y Tes', 'Alimentacion', 'Bebidas', 'Infusiones', 'internal', 'kg', 'Te de hierbas, manzanilla, anis, tilo, boldo, hierbabuena seca.', 'Botica Natural', 'https://images.unsplash.com/photo-1597318181409-1e81af9b8d3e?auto=format&fit=crop&w=600&q=80', 100, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Infusiones y Tes' AND node_domain = nd.node_domain);

-- ============ ALIMENTACION: Condimentos ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Especias y Condimentos', 'Alimentacion', 'Condimentos', 'Especias', 'internal', 'kg', 'Comino, oregano, pimienta, aji dulce, aji picante, onoto, cilantro seco, laurel.', 'Sazon Criolla', 'https://images.unsplash.com/photo-1596040033229-a3c5b59a5c21?auto=format&fit=crop&w=600&q=80', 600, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Especias y Condimentos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Aceites y Vinagres', 'Alimentacion', 'Condimentos', 'Aceites', 'internal', 'litro', 'Aceite de coco, aceite de ajonjoli, aceite de palma, vinagre de cana, vinagre de frutas.', 'Prensado en Frio', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80', 1500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aceites y Vinagres' AND node_domain = nd.node_domain);

-- ============ AGRICULTURA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Semillas Criollas Adaptadas', 'Agricultura', 'Semillas y Plantulas', 'Semillas', 'internal', 'sobre', 'Semillas de maiz, frijol, caraota, ahuyama, tomate, pimenton, lechuga, cilantro.', 'Semilla Nativa', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 30, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Semillas Criollas Adaptadas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Estacas y Esquejes', 'Agricultura', 'Semillas y Plantulas', 'Estacas', 'internal', 'unidad', 'Estacas de yuca, platano, frutales (mango, aguacate, citricos), mora, parchita.', 'Propagacion', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 20, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Estacas y Esquejes' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Abonos Organicos', 'Agricultura', 'Insumos Agricolas', 'Abonos', 'internal', 'saco', 'Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza.', 'Fertilidad Natural', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 100, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Abonos Organicos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Bioinsumos y Preparados', 'Agricultura', 'Insumos Agricolas', 'Bioinsumos', 'internal', 'litro', 'Biofertilizantes, biopreparados fungicos, te de compost, purines, microorganismos eficientes.', 'Agroecologia', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 150, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bioinsumos y Preparados' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Tierra Fertil y Sustratos', 'Agricultura', 'Tierra y Compost', 'Sustratos', 'internal', 'saco', 'Tierra preparada, sustrato para semilleros, turba, arena de rio, mezcla para macetas.', 'Tierra Viva', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 40, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tierra Fertil y Sustratos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Sistemas de Riego', 'Agricultura', 'Riego', 'Sistemas', 'internal', 'juego', 'Mangueras, aspersores, goteros, bombas manuales, tanques de almacenamiento.', 'Riego Eficiente', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sistemas de Riego' AND node_domain = nd.node_domain);

-- ============ SALUD Y MEDICINA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Hierbas Medicinales Secas', 'Salud y Medicina', 'Medicina Botanica', 'Hierbas Secas', 'internal', 'kg', 'Manzanilla, toronjil, valeriana, eucalipto, llanten, malojillo, sauco, tila deshidratados.', 'Secado al Sol', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hierbas Medicinales Secas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Terapias Manuales y Alternativas', 'Salud y Medicina', 'Terapias', 'Sesiones', 'internal', 'sesion', 'Masaje terapeutico, acupuntura, reflexologia, terapia manual, osteopatia, digitopuntura.', 'Salud Integral', 'https://images.unsplash.com/photo-1544161515-4ab6ce7db09c?auto=format&fit=crop&w=600&q=80', 650, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Terapias Manuales y Alternativas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Jabones y Productos de Higiene', 'Salud y Medicina', 'Higiene', 'Jabones', 'internal', 'unidad', 'Jabon de lavar, jabon corporal natural, champu solido, dentifrico natural.', 'Limpieza Natural', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jabones y Productos de Higiene' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Detergentes y Suavizantes Naturales', 'Salud y Medicina', 'Higiene', 'Detergentes', 'internal', 'litro', 'Detergente biodegradable, suavizante de plantas, limpiador multiusos, desinfectante natural.', 'Eco Limpieza', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Detergentes y Suavizantes Naturales' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Botiquin y Primeros Auxilios', 'Salud y Medicina', 'Primeros Auxilios', 'Botiquin', 'internal', 'juego', 'Vendas, gasas, alcohol, yodo, apositos, tiritas, tijeras, manual de primeros auxilios.', 'Emergencia', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Botiquin y Primeros Auxilios' AND node_domain = nd.node_domain);

-- ============ TEXTILES ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Reparacion y Adaptacion de Prendas', 'Textiles', 'Confeccion', 'Reparaciones', 'internal', 'prenda', 'Parches, costuras, ajustes, dobladillos, cambio de cremalleras, reformas.', 'Reutilizar', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Reparacion y Adaptacion de Prendas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Cobijas, Frazadas y Hamacas', 'Textiles', 'Tejidos', 'Cobijas', 'internal', 'unidad', 'Frazadas de lana, mantas de algodon, hamacas de cañamo, colchas tejidas.', 'Calor Artesanal', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80', 6000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cobijas, Frazadas y Hamacas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Hilos y Lana para Tejer', 'Textiles', 'Hilos y Materiales', 'Hilos', 'internal', 'rollo', 'Hilo de coser, lana para tejer, hilo de cañamo, estambres, hilos encerados.', 'Materia Prima', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 200, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hilos y Lana para Tejer' AND node_domain = nd.node_domain);

-- ============ ARTESANIA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Vasijas y Vajilla de Barro', 'Artesania', 'Ceramica', 'Vasijas', 'internal', 'unidad', 'Ollas de barro, vasijas, platos, tazas, cantaras, budares de arcilla.', 'Barro Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 2500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vasijas y Vajilla de Barro' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Ceramica Decorativa', 'Artesania', 'Ceramica', 'Decoracion', 'internal', 'unidad', 'Figuras, adornos, macetas decorativas, joyeros de arcilla.', 'Hecho a Mano', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ceramica Decorativa' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Canastas y Cesteria', 'Artesania', 'Cesteria', 'Canastas', 'internal', 'unidad', 'Canastos, cestas, petacas, cajas de fibra vegetal, sombreros de paja.', 'Fibra Vegetal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1800, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Canastas y Cesteria' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Tallados y Utensilios de Madera', 'Artesania', 'Madera', 'Tallados', 'internal', 'unidad', 'Cucharas de palo, morteros, pilones, tallas decorativas, juguetes de madera.', 'Madera Noble', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tallados y Utensilios de Madera' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Muebles Rusticos de Madera', 'Artesania', 'Madera', 'Muebles', 'internal', 'unidad', 'Mesas, sillas, bancos, camas, estantes, muebles rusticos de madera local.', 'Muebleria Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 15000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Muebles Rusticos de Madera' AND node_domain = nd.node_domain);

-- ============ SERVICIOS ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Albanileria y Obra Menor', 'Servicios', 'Construccion', 'Albanileria', 'internal', 'hora', 'Mamposteria, repello, acabados, levantamiento de paredes, bahareque, adobe.', 'Constructor', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 350, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Albanileria y Obra Menor' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carpinteria y Ebanisteria', 'Servicios', 'Construccion', 'Carpinteria', 'internal', 'hora', 'Puertas, ventanas, muebles a medida, reparacion de estructuras de madera.', 'Carpintero', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carpinteria y Ebanisteria' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Mecanica General', 'Servicios', 'Reparaciones', 'Mecanica', 'internal', 'hora', 'Reparacion de motores, bicicletas, motos, maquinas agricolas, bombas de agua.', 'Mecanico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mecanica General' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Electricidad y Electrotecnia', 'Servicios', 'Reparaciones', 'Electricidad', 'internal', 'hora', 'Instalaciones electricas, reparaciones, cableado, paneles solares, baterias.', 'Electricista', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 450, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Electricidad y Electrotecnia' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Plomeria y Fontaneria', 'Servicios', 'Reparaciones', 'Plomeria', 'internal', 'hora', 'Reparacion de tuberias, filtros de agua, tanques, baños, instalaciones sanitarias.', 'Plomero', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plomeria y Fontaneria' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Transporte de Carga', 'Servicios', 'Transporte', 'Carga', 'internal', 'viaje', 'Transporte de mercancia, materiales, cosechas dentro y fuera de la comunidad.', 'Traslado', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 200, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Transporte de Carga' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Pasaje de Personas', 'Servicios', 'Transporte', 'Pasaje', 'internal', 'viaje', 'Transporte de personas al pueblo, centro medico, mercado, gestiones.', 'Viaje', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 50, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pasaje de Personas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Clases y Tutorias', 'Servicios', 'Educacion', 'Clases', 'internal', 'hora', 'Alfabetizacion, matematicas, oficios, idiomas, lectura, escritura.', 'Enseñanza', 'https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Clases y Tutorias' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Limpieza de Espacios', 'Servicios', 'Limpieza', 'General', 'internal', 'hora', 'Limpieza de espacios comunes, casas, talleres, desinfeccion, orden.', 'Aseo', 'https://images.unsplash.com/photo-1581578731548-cba46ace809f?auto=format&fit=crop&w=600&q=80', 250, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Limpieza de Espacios' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Consulta Medica y Odontologica', 'Servicios', 'Salud', 'Consulta', 'internal', 'sesion', 'Consulta medica general, odontologia basica, vacunacion, control prenatal, veterinaria.', 'Atencion', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80', 650, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Consulta Medica y Odontologica' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Trabajo Administrativo y Gestion', 'Servicios', 'Oficina', 'Administrativo', 'internal', 'hora', 'Contabilidad, gestion documental, tramites, redaccion de cartas, gestion comunitaria.', 'Gestion', 'https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Trabajo Administrativo y Gestion' AND node_domain = nd.node_domain);

-- ============ CONSTRUCCION ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Bloques, Adobe y Bahareque', 'Construccion', 'Materiales', 'Adobe', 'internal', 'unidad', 'Bloques de tierra comprimida, adobes, bahareque, ladrillos de barro.', 'Construccion Natural', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 150, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bloques, Adobe y Bahareque' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Madera de Construccion', 'Construccion', 'Materiales', 'Madera', 'internal', 'm', 'Madera aserrada, vigas, tablas, latas, listones de madera local.', 'Estructura', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 800, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Madera de Construccion' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Piedra y Agregados', 'Construccion', 'Materiales', 'Piedra', 'internal', 'm3', 'Piedra de rio, grava, arena, cascajo, material de relleno.', 'Base Solida', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Piedra y Agregados' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Pinturas y Recubrimientos Naturales', 'Construccion', 'Acabados', 'Pintura', 'internal', 'litro', 'Pintura a cal, tierra pigmentada, estucos naturales, impermeabilizantes.', 'Acabado Natural', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pinturas y Recubrimientos Naturales' AND node_domain = nd.node_domain);

-- ============ ENERGIA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Sistemas Solares Pequenos', 'Energia', 'Solar', 'Sistemas', 'internal', 'juego', 'Paneles solares pequenos, baterias, controladores, inversores basicos.', 'Energia Limpia', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80', 5000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sistemas Solares Pequenos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Mantenimiento de Sistemas Solares', 'Energia', 'Solar', 'Mantenimiento', 'internal', 'hora', 'Limpieza de paneles, ajuste, revision de baterias, cableado, inversores.', 'Mantencion', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mantenimiento de Sistemas Solares' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Lena Seca para Cocinar', 'Energia', 'Lena', 'Lena', 'internal', 'atado', 'Lena seca de arboles frutales y de sombra, lista para cocinar y calentar.', 'Fuego Natural', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 80, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lena Seca para Cocinar' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carbon Vegetal', 'Energia', 'Lena', 'Carbon', 'internal', 'saco', 'Carbon vegetal de hornos artesanales para cocina y fundicion.', 'Carbon Artesanal', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carbon Vegetal' AND node_domain = nd.node_domain);

-- ============ HERRAMIENTAS ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Herramientas de Campo', 'Herramientas', 'Manuales', 'Agricolas', 'internal', 'unidad', 'Machetes, palas, picos, rastrillos, azadones, guadañas, horquillas, regaderas.', 'Trabajo Duro', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 2000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Herramientas de Campo' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Herramientas de Taller', 'Herramientas', 'Manuales', 'Taller', 'internal', 'unidad', 'Martillos, serruchos, limas, destornilladores, alicates, llaves, tornillos de banco.', 'Taller', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 2000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Herramientas de Taller' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Afilar y Mantener Herramientas', 'Herramientas', 'Manuales', 'Mantenimiento', 'internal', 'unidad', 'Afilar de machetes, cuchillos, tijeras, reparacion de mangos.', 'Mantencion', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 200, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Afilar y Mantener Herramientas' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Equipos Electricos de Taller', 'Herramientas', 'Electricas', 'Equipos', 'internal', 'unidad', 'Taladros, sierras circulares, amoladoras, lijadoras, soldadoras portatiles.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 8000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Equipos Electricos de Taller' AND node_domain = nd.node_domain);

-- ============ TECNOLOGIA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Reparacion de Computadoras', 'Tecnologia', 'Computacion', 'Reparacion', 'internal', 'hora', 'Reparacion de hardware, limpieza, cambio de piezas, instalacion de software.', 'Soporte Tecnico', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Reparacion de Computadoras' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Mantenimiento y Software', 'Tecnologia', 'Computacion', 'Mantenimiento', 'internal', 'hora', 'Limpieza de virus, instalacion de programas, configuracion, respaldos.', 'Software', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mantenimiento y Software' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Reparacion de Electrodomesticos', 'Tecnologia', 'Electrodomesticos', 'Reparacion', 'internal', 'hora', 'Reparacion de neveras, licuadoras, cocinas, lavadoras, ventiladores, planchas.', 'Reparacion', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 450, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Reparacion de Electrodomesticos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Reparacion de Telefonos', 'Tecnologia', 'Telefonos', 'Reparacion', 'internal', 'hora', 'Cambio de pantallas, baterias, cristales, microfonos, conectores de carga.', 'Movil', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 400, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Reparacion de Telefonos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Componentes Electronicos', 'Tecnologia', 'Componentes', 'Piezas', 'internal', 'lote', 'Resistencias, capacitores, cables, conectores, soldadura, plaquetas, fusibles.', 'Electronica', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Componentes Electronicos' AND node_domain = nd.node_domain);

-- ============ TRANSPORTE ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Bicicletas y Refacciones', 'Transporte', 'Vehiculos', 'Bicicletas', 'internal', 'unidad', 'Bicicletas, llantas, cadenas, frenos, asientos, luces, canastos.', 'Transporte Limpio', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 8000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bicicletas y Refacciones' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Mantenimiento de Vehiculos', 'Transporte', 'Vehiculos', 'Mantenimiento', 'internal', 'hora', 'Ajustes, lubricacion, cambio de aceites, frenos, revision general.', 'Mantencion', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 350, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mantenimiento de Vehiculos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Animales de Carga y Montura', 'Transporte', 'Animales', 'Equinos', 'internal', 'unidad', 'Caballos, burros, mulas para carga, montura y trabajo agricola.', 'Traccion Animal', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 15000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Animales de Carga y Montura' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Servicio de Arriero', 'Transporte', 'Animales', 'Arriero', 'internal', 'jornada', 'Transporte de carga con animal, conduccion de ganado, traslado de mercancia.', 'A Caballo', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 2600, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Servicio de Arriero' AND node_domain = nd.node_domain);

-- ============ CULTURA ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Instrumentos Musicales Artesanales', 'Cultura', 'Musica', 'Instrumentos', 'internal', 'unidad', 'Tambores, maracas, cuatros, guitarras, marimbas, flautas de cana.', 'Musica Viva', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 5000, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Instrumentos Musicales Artesanales' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Clases de Musica', 'Cultura', 'Musica', 'Clases', 'internal', 'hora', 'Enseñanza de cuatro, guitarra, percusion, canto, teoria musical.', 'Enseñanza', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Clases de Musica' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Animacion y Cuentacuentos', 'Cultura', 'Eventos', 'Animacion', 'internal', 'hora', 'Animacion de fiestas, cuentacuentos, teatro comunitario, payasos.', 'Fiesta', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Animacion y Cuentacuentos' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Pintura y Artes Visuales', 'Cultura', 'Artes', 'Pintura', 'internal', 'unidad', 'Cuadros, murales, retratos, artesania decorativa, cartelera.', 'Arte', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 2500, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pintura y Artes Visuales' AND node_domain = nd.node_domain);

-- ============ EDUCACION ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Talleres de Oficios', 'Educacion', 'Talleres', 'Oficios', 'internal', 'hora', 'Carpinteria, costura, cocina, mecanica, electricidad, albanileria.', 'Aprender Haciendo', 'https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Talleres de Oficios' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Talleres de Agroecologia', 'Educacion', 'Talleres', 'Agricultura', 'internal', 'hora', 'Permacultura, agroecologia, huertos urbanos, conservacion de semillas, compostaje.', 'Conuco', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Talleres de Agroecologia' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Talleres de Salud Comunitaria', 'Educacion', 'Talleres', 'Salud', 'internal', 'hora', 'Primeros auxilios, medicina natural, nutricion, prevencion, salud reproductiva.', 'Salud', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Talleres de Salud Comunitaria' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Alfabetizacion y Educacion Basica', 'Educacion', 'Alfabetizacion', 'Basica', 'internal', 'hora', 'Lectura, escritura, matematicas basicas, educacion primaria para adultos.', 'Aprender', 'https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80', 300, true, true, '', 0,0,0,0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Alfabetizacion y Educacion Basica' AND node_domain = nd.node_domain);

-- ============ Actualizar productos existentes con nuevos nombres/descripciones ============
-- Renombrar productos existentes para alinear con el catalogo completo
UPDATE products SET
  name = 'Hojas Verdes y Aromaticas',
  description = 'Lechuga, repollo, espinaca, acelga, cilantro, perejil, cebollin, apio, hierbabuena, toronjil.',
  badge = 'Fresco del Dia',
  image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Hortalizas y Hojas Verdes de El Junquito';

UPDATE products SET
  name = 'Dulces y Conservas Tradicionales',
  description = 'Cafunga de Barlovento, dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo.',
  badge = 'Plato Patrimonial',
  image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 200
WHERE name = 'La Tradicional Cafunga de Barlovento';

UPDATE products SET
  name = 'Lacteos Artesanales',
  description = 'Queso fresco, queso de mano, queso guayanes, suero, cuajada, dulce de leche, yogurt natural, mantequilla.',
  badge = 'Pastoreo Libre',
  image_url = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 300
WHERE name = 'Quesos Artesanales de Bufala y Cabra';

UPDATE products SET
  name = 'Cacao, Chocolate y Cafe',
  description = 'Cacao fermentado de Barlovento y Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena.',
  badge = 'Origen Venezolano',
  image_url = 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 2500
WHERE name = 'Cacao Puro, Chocolates y Cafe de Montana';

UPDATE products SET
  name = 'Plantulas Medicinales y Aromaticas',
  description = 'Poleo, estevia, malojillo, romero, ruda, oregano orejon, sabila, llanten, calendula.',
  badge = 'Para tu Huerto',
  image_url = 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Plantulas Medicinales y Semillas Criollas';

UPDATE products SET
  name = 'Tinturas Madres y Botica Conuquera',
  description = 'Extractos de propoleo, tinturas de moringa, curcuma, jengibre, pomadas de arnica, jarabes naturales.',
  badge = '100% Puro',
  image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 1200
WHERE name = 'Tinturas Madres y Botica Conuquera';

UPDATE products SET
  name = 'Cosmetica Natural sin Quimicos',
  description = 'Desodorantes de coco, balsamos labiales de cera de abeja, jabones artesanales, cremas de calendula.',
  badge = 'Residuo Cero',
  image_url = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 800
WHERE name = 'Cosmetica Natural sin Quimicos';

UPDATE products SET
  name = 'Prendas de Vestir Artesanales',
  description = 'Camisas, pantalones, vestidos, faldas, blusas, ropa interior de algodon de lana o algodon.',
  badge = 'Hecho a Mano',
  image_url = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 4200
WHERE name = 'Prenda artesanal (lana/algodon)';

UPDATE products SET
  name = 'Telas Naturales',
  description = 'Tela de algodon, lino, lana, cañamo, tela cruda, tela teñida natural.',
  badge = 'Natural',
  image_url = 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 1500
WHERE name = 'Tela de algodon 1m';

UPDATE products SET
  name = 'Jornal Agricola',
  description = 'Siembra, cosecha, limpieza, riego, desmalece, preparacion de tierra.',
  badge = 'Conuquero',
  image_url = 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 325
WHERE name = 'Hora de labor agricola';

UPDATE products SET
  name = 'Granos Basicos Criollos',
  description = 'Maiz criollo blanco y amarillo, frijol, caraota, quinchoncho, lentejas, garbanzos, habas.',
  badge = 'Criollo',
  image_url = 'https://images.unsplash.com/photo-1765144815957-6bc44c13fc2c?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 90
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  name = 'Harinas Integrales',
  description = 'Harina de maiz, harina de trigo integral, harina de yuca (casabe), harina de platanos, harina de quinoa.',
  badge = 'Base Criolla',
  image_url = 'https://images.unsplash.com/photo-1699315529894-402495fddb8b?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 200
WHERE name = 'Harina de maiz 50kg';

UPDATE products SET
  name = 'Verduras y Hortalizas de Conuco',
  description = 'Tomate, pimenton, pepino, berenjena, zanahoria, remolacha, ajo, cebolla, ahuyama, calabacin.',
  badge = 'Del Conuco',
  image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 50
WHERE name = 'Verduras frescas 1kg';

UPDATE products SET
  name = 'Miel Pura de Abejas',
  description = 'Miel multifleural de montana, miel de bosque, miel de azahar.',
  badge = 'Pura',
  image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80',
  price_per_unit = 3500
WHERE name = 'Miel 1L';
