-- Migracion 040: Dividir productos bundle/kit en productos individuales
-- Problema: varios productos agrupaban items distintos bajo un solo precio ambiguo
-- Solucion: cada producto individual tiene su propio precio basado en energia incorporada
-- Los productos que eran bundles se ELIMINAN y se insertan los individuales
-- (proyecto en fase de desarrollo, no hay produccion que preservar)

-- ============ 1. SISTEMAS DE RIEGO -> dividir en componentes individuales ============
DELETE FROM products WHERE name = 'Sistemas de Riego';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Manguera de Riego PVC 1m', 'Agricultura', 'Riego', 'Tuberias', 'metro', 'Manguera de PVC de 1 metro para riego. Energia: PVC 10.6 MJ/kg x ~0.3kg/m = 3.2 MJ = 0.9 TQ. Fuente: ICE Database.', 'Riego', '/placeholder.svg', 1),
  ('Aspersor de Riego', 'Agricultura', 'Riego', 'Aspersores', 'unidad', 'Aspersor de plastico para riego por aspersion. Energia: PVC ~0.1kg = 1 MJ = 0.3 TQ + manufactura. Fuente: ICE Database.', 'Riego', '/placeholder.svg', 1),
  ('Gotero de Riego', 'Agricultura', 'Riego', 'Goteros', 'unidad', 'Gotero individual para riego por goteo. Energia: plastico ~0.02kg = 0.2 MJ = 0.06 TQ + manufactura. Fuente: ICE Database.', 'Riego', '/placeholder.svg', 1),
  ('Bomba Manual de Agua', 'Agricultura', 'Riego', 'Bombas', 'unidad', 'Bomba manual de agua para extraer de pozo o tanque. Energia: acero ~2kg x 20 MJ/kg + PVC = 43 MJ = 12 TQ. Fuente: ICE Database.', 'Riego', '/placeholder.svg', 12),
  ('Tanque de Agua 200L', 'Agricultura', 'Riego', 'Tanques', 'unidad', 'Tanque de agua plastico HDPE 200 litros. Energia: HDPE ~5kg x 52.5 MJ/kg = 262 MJ = 73 TQ. Fuente: ICE Database, Ecoinvent.', 'Almacenamiento', '/placeholder.svg', 73),
  ('Tanque de Agua 1000L', 'Agricultura', 'Riego', 'Tanques', 'unidad', 'Tanque de agua plastico HDPE 1000 litros. Energia: HDPE ~25kg x 52.5 MJ/kg = 1313 MJ = 365 TQ. Fuente: ICE Database, Ecoinvent.', 'Almacenamiento', '/placeholder.svg', 365)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 2. BOTIQUIN -> dividir en componentes individuales ============
DELETE FROM products WHERE name = 'Botiquin y Primeros Auxilios';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Vendas y Gasas (Paquete)', 'Salud y Medicina', 'Primeros Auxilios', 'Vendas', 'paquete', 'Paquete de vendas y gasas esteriles de algodon. Energia: algodon ~0.2kg x 50 MJ/kg = 10 MJ = 3 TQ. Fuente: Ecoinvent.', 'Curacion', '/placeholder.svg', 3),
  ('Alcohol Medicinal 1L', 'Salud y Medicina', 'Primeros Auxilios', 'Desinfectantes', 'litro', 'Alcohol etilico medicinal 70% en frasco de 1 litro. Energia: destilacion + empaque ~3.6 MJ = 1 TQ.', 'Desinfeccion', '/placeholder.svg', 1),
  ('Yodo (Frasco 30ml)', 'Salud y Medicina', 'Primeros Auxilios', 'Antisepticos', 'frasco', 'Frasco de yodo antiseptico 30ml. Energia: extraccion + empaque ~1 TQ.', 'Antiseptico', '/placeholder.svg', 1),
  ('Tijeras de Primeros Auxilios', 'Salud y Medicina', 'Primeros Auxilios', 'Instrumentos', 'unidad', 'Tijeras de acero para cortar vendas. Energia: acero ~0.1kg x 35 MJ/kg = 3.5 MJ = 1 TQ + manufactura. Fuente: ICE Database.', 'Instrumental', '/placeholder.svg', 2),
  ('Apositos y Tiritas (Caja)', 'Salud y Medicina', 'Primeros Auxilios', 'Apositos', 'caja', 'Caja de apositos y tiritas adhesivas. Energia: plastico + algodon + adhesivo ~1 TQ.', 'Curacion', '/placeholder.svg', 1)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 3. HERRAMIENTAS DE CAMPO -> dividir en herramientas individuales ============
DELETE FROM products WHERE name = 'Herramientas de Campo';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Machete', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Machete de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 4 MJ = 14 MJ = 4 TQ. Fuente: ICE Database.', 'Conuquero', '/placeholder.svg', 4),
  ('Pala', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Pala de acero con mango de madera. Energia: acero ~1.5kg x 20 MJ/kg + mango 4 MJ = 34 MJ = 9 TQ. Fuente: ICE Database.', 'Excavacion', '/placeholder.svg', 9),
  ('Pico', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Pico de acero con mango de madera. Energia: acero ~2kg x 20 MJ/kg + mango 4 MJ = 44 MJ = 12 TQ. Fuente: ICE Database.', 'Excavacion', '/placeholder.svg', 12),
  ('Rastrillo', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Rastrillo de acero con mango de madera. Energia: acero ~1kg x 20 MJ/kg + mango 4 MJ = 24 MJ = 7 TQ. Fuente: ICE Database.', 'Limpieza', '/placeholder.svg', 7),
  ('Azadon', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Azadon de acero con mango de madera. Energia: acero ~0.8kg x 20 MJ/kg + mango 4 MJ = 20 MJ = 6 TQ. Fuente: ICE Database.', 'Cultivo', '/placeholder.svg', 6)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 4. HERRAMIENTAS DE TALLER -> dividir en herramientas individuales ============
DELETE FROM products WHERE name = 'Herramientas de Taller';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Martillo', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Martillo de acero con mango de madera. Energia: acero ~0.3kg x 20 MJ/kg + mango 2 MJ = 8 MJ = 2 TQ. Fuente: ICE Database.', 'Taller', '/placeholder.svg', 2),
  ('Serrucho', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Serrucho de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 2 MJ = 12 MJ = 3 TQ. Fuente: ICE Database.', 'Corte', '/placeholder.svg', 3),
  ('Lima', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Lima de acero para desbaste. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Desbaste', '/placeholder.svg', 2),
  ('Destornillador', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Destornillador de acero con mango de plastico. Energia: acero ~0.1kg x 20 MJ/kg + plastico 1 MJ = 3 MJ = 1 TQ. Fuente: ICE Database.', 'Tornillos', '/placeholder.svg', 1),
  ('Alicates', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Alicates de acero. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Pinza', '/placeholder.svg', 2)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 5. EQUIPOS ELECTRICOS DE TALLER -> dividir en equipos individuales ============
DELETE FROM products WHERE name = 'Equipos Electricos de Taller';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Taladro Electrico', 'Herramientas', 'Electricas', 'Taladros', 'unidad', 'Taladro electrico portatil 600W. Energia: motor + plastico + cobre ~100 TQ. Fuente: ICE Database.', 'Electrico', '/placeholder.svg', 100),
  ('Sierra Circular', 'Herramientas', 'Electricas', 'Sierras', 'unidad', 'Sierra circular electrica 1200W con disco. Energia: motor + acero + plastico ~120 TQ. Fuente: ICE Database.', 'Electrico', '/placeholder.svg', 120),
  ('Amoladora', 'Herramientas', 'Electricas', 'Amoladoras', 'unidad', 'Amoladora angular electrica 700W con discos. Energia: motor + acero ~80 TQ. Fuente: ICE Database.', 'Electrico', '/placeholder.svg', 80),
  ('Lijadora Electrica', 'Herramientas', 'Electricas', 'Lijadoras', 'unidad', 'Lijadora orbital electrica 300W. Energia: motor + plastico ~60 TQ. Fuente: ICE Database.', 'Electrico', '/placeholder.svg', 60),
  ('Soldadora Electrica', 'Herramientas', 'Electricas', 'Soldadoras', 'unidad', 'Soldadora electrica 150A con electrodos. Energia: transformador cobre + acero ~200 TQ. Fuente: ICE Database.', 'Electrico', '/placeholder.svg', 200)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 6. COMPONENTES ELECTRONICOS -> dividir en componentes individuales ============
DELETE FROM products WHERE name = 'Componentes Electronicos';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Cable Electrico (metro)', 'Tecnologia', 'Componentes', 'Cables', 'metro', 'Cable de cobre 1 metro para instalaciones. Energia: cobre ~0.1kg x 42 MJ/kg = 4.2 MJ = 1 TQ. Fuente: ICE Database.', 'Cable', '/placeholder.svg', 1),
  ('Resistencias (Paquete 10)', 'Tecnologia', 'Componentes', 'Resistencias', 'paquete', 'Paquete de 10 resistencias electronicas. Energia: manufactura ~1 TQ.', 'Componente', '/placeholder.svg', 1),
  ('Capacitores (Paquete 10)', 'Tecnologia', 'Componentes', 'Capacitores', 'paquete', 'Paquete de 10 capacitores electronicos. Energia: manufactura ~1 TQ.', 'Componente', '/placeholder.svg', 1),
  ('Conectores (Paquete)', 'Tecnologia', 'Componentes', 'Conectores', 'paquete', 'Paquete de conectores electronicos variados. Energia: plastico + metal ~2 TQ.', 'Componente', '/placeholder.svg', 2),
  ('Soldadura Electronica (Rollo)', 'Tecnologia', 'Componentes', 'Soldadura', 'rollo', 'Rollo de soldadura de estano para electronica. Energia: estano + plomo ~3 TQ.', 'Componente', '/placeholder.svg', 3),
  ('Plaquetas PCB (Unidad)', 'Tecnologia', 'Componentes', 'Plaquetas', 'unidad', 'Plaqueta PCB virgen para circuitos. Energia: cobre + fibra de vidrio ~2 TQ.', 'Componente', '/placeholder.svg', 2),
  ('Fusibles (Paquete 10)', 'Tecnologia', 'Componentes', 'Fusibles', 'paquete', 'Paquete de 10 fusibles electricos. Energia: vidrio + metal ~1 TQ.', 'Componente', '/placeholder.svg', 1)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 7. BICICLETAS Y REFACCIONES -> dividir ============
DELETE FROM products WHERE name = 'Bicicletas y Refacciones';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Bicicleta Completa', 'Transporte', 'Vehiculos', 'Bicicletas', 'unidad', 'Bicicleta completa lista para usar. Energia: acero ~15kg x 6 kWh/kg + caucho + ensamblaje = 100 TQ. Fuente: ICE Database.', 'Transporte Limpio', '/placeholder.svg', 100),
  ('Llanta de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'unidad', 'Llanta de caucho para bicicleta. Energia: caucho ~1kg x 24 MJ/kg = 24 MJ = 7 TQ. Fuente: Ecoinvent.', 'Refaccion', '/placeholder.svg', 7),
  ('Cadena de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'unidad', 'Cadena de acero para bicicleta. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Refaccion', '/placeholder.svg', 2),
  ('Frenos de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'par', 'Par de frenos completos para bicicleta. Energia: acero + caucho ~5 TQ.', 'Refaccion', '/placeholder.svg', 5)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 8. ANIMALES DE CARGA -> dividir en animales individuales ============
DELETE FROM products WHERE name = 'Animales de Carga y Montura';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Caballo de Silla', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Caballo entrenado para montura. Energia incorporada: crianza + alimentacion 3 anos ~500 TQ (estimacion comunitaria).', 'Traccion Animal', '/placeholder.svg', 500),
  ('Burro de Carga', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Burro entrenado para carga. Energia incorporada: crianza + alimentacion 2 anos ~300 TQ (estimacion comunitaria).', 'Traccion Animal', '/placeholder.svg', 300),
  ('Mula de Carga', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Mula para carga y trabajo de campo. Energia incorporada: crianza + alimentacion 3 anos ~400 TQ (estimacion comunitaria).', 'Traccion Animal', '/placeholder.svg', 400)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 9. INSTRUMENTOS MUSICALES -> dividir en instrumentos individuales ============
DELETE FROM products WHERE name = 'Instrumentos Musicales Artesanales';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Cuatro Venezolano', 'Cultura', 'Musica', 'Cuerdas', 'unidad', 'Cuatro venezolano artesanal de madera. Energia: madera ~2kg x 8.5 MJ/kg + cuerdas + manufactura = 25 TQ. Fuente: ICE Database.', 'Musica Criolla', '/placeholder.svg', 25),
  ('Guitarra Artesanal', 'Cultura', 'Musica', 'Cuerdas', 'unidad', 'Guitarra acustica artesanal de madera. Energia: madera ~4kg x 8.5 MJ/kg + cuerdas + manufactura = 40 TQ. Fuente: ICE Database.', 'Musica', '/placeholder.svg', 40),
  ('Tambor (Caja)', 'Cultura', 'Musica', 'Percusion', 'unidad', 'Tambor de madera con cuero. Energia: madera ~3kg x 8.5 MJ/kg + cuero + manufactura = 30 TQ. Fuente: ICE Database.', 'Percusion', '/placeholder.svg', 30),
  ('Maracas (Par)', 'Cultura', 'Musica', 'Percusion', 'par', 'Par de maracas de totuma con semillas y mango de madera. Energia: madera + semillas + manufactura = 8 TQ.', 'Percusion', '/placeholder.svg', 8),
  ('Flauta de Caña', 'Cultura', 'Musica', 'Vientos', 'unidad', 'Flauta traversa de caña. Energia: caña + manufactura = 3 TQ.', 'Viento', '/placeholder.svg', 3)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 10. CANASTA BASICA -> aclarar contenido exacto ============
UPDATE products SET
  description = 'Canasta semanal para familia 4-5 personas. Contenido exacto: 3kg granos basicos (maiz, frijol, arroz), 2kg verduras frescas (tomate, cebolla, pimenton), 1kg frutas de temporada, 0.5kg carne de pollo, 1L leche fresca, 0.5L aceite vegetal, 0.5kg panela/azucar, 1 docena huevos, 100g especias (sal, comino, ajo). Energia total estimada: 3x10 + 2x2 + 1x2 + 0.5x8 + 1x2 + 0.5x10 + 0.5x15 + 1x10 + 1 = 30+4+2+4+2+5+7.5+10+1 = 65.5 TQ. Precio redondeado: 66 TQ.',
  price_per_unit = 66
WHERE name = 'Canasta Basica Familiar Semanal';
