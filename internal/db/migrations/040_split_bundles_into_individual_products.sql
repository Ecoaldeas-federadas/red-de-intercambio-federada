-- Migracion 040: Dividir productos bundle/kit en productos individuales
-- Problema: varios productos agrupaban items distintos bajo un solo precio ambiguo
-- Solucion: cada producto individual tiene su propio precio basado en energia incorporada
-- Los productos que eran bundles se ocultan (is_hidden = true) y se insertan los individuales

-- ============ 1. SISTEMAS DE RIEGO -> dividir en componentes individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en componentes individuales. Ver: Manguera de Riego PVC, Aspersor, Gotero, Bomba Manual de Agua, Tanque de Agua 200L.'
WHERE name = 'Sistemas de Riego';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Manguera de Riego PVC 1m', 'Agricultura', 'Riego', 'Tuberias', 'metro', 'Manguera de PVC de 1 metro para riego. Energia: PVC 10.6 MJ/kg x ~0.3kg/m = 3.2 MJ = 0.9 TQ. Fuente: ICE Database.', 'Riego', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 1),
  ('Aspersor de Riego', 'Agricultura', 'Riego', 'Aspersores', 'unidad', 'Aspersor de plastico para riego por aspersion. Energia: PVC ~0.1kg = 1 MJ = 0.3 TQ + manufactura. Fuente: ICE Database.', 'Riego', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 1),
  ('Gotero de Riego', 'Agricultura', 'Riego', 'Goteros', 'unidad', 'Gotero individual para riego por goteo. Energia: plastico ~0.02kg = 0.2 MJ = 0.06 TQ + manufactura. Fuente: ICE Database.', 'Riego', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 1),
  ('Bomba Manual de Agua', 'Agricultura', 'Riego', 'Bombas', 'unidad', 'Bomba manual de agua para extraer de pozo o tanque. Energia: acero ~2kg x 20 MJ/kg + PVC = 43 MJ = 12 TQ. Fuente: ICE Database.', 'Riego', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 12),
  ('Tanque de Agua 200L', 'Agricultura', 'Riego', 'Tanques', 'unidad', 'Tanque de agua plastico HDPE 200 litros. Energia: HDPE ~5kg x 52.5 MJ/kg = 262 MJ = 73 TQ. Fuente: ICE Database, Ecoinvent.', 'Almacenamiento', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 73),
  ('Tanque de Agua 1000L', 'Agricultura', 'Riego', 'Tanques', 'unidad', 'Tanque de agua plastico HDPE 1000 litros. Energia: HDPE ~25kg x 52.5 MJ/kg = 1313 MJ = 365 TQ. Fuente: ICE Database, Ecoinvent.', 'Almacenamiento', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80', 365)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 2. BOTIQUIN -> dividir en componentes individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en componentes individuales. Ver: Vendas y Gasas, Alcohol Medicinal, Yodo, Tijeras, Apositos.'
WHERE name = 'Botiquin y Primeros Auxilios';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Vendas y Gasas (Paquete)', 'Salud y Medicina', 'Primeros Auxilios', 'Vendas', 'paquete', 'Paquete de vendas y gasas esteriles de algodon. Energia: algodon ~0.2kg x 50 MJ/kg = 10 MJ = 3 TQ. Fuente: Ecoinvent.', 'Curacion', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 3),
  ('Alcohol Medicinal 1L', 'Salud y Medicina', 'Primeros Auxilios', 'Desinfectantes', 'litro', 'Alcohol etilico medicinal 70% en frasco de 1 litro. Energia: destilacion + empaque ~3.6 MJ = 1 TQ.', 'Desinfeccion', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 1),
  ('Yodo (Frasco 30ml)', 'Salud y Medicina', 'Primeros Auxilios', 'Antisepticos', 'frasco', 'Frasco de yodo antiseptico 30ml. Energia: extraccion + empaque ~1 TQ.', 'Antiseptico', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 1),
  ('Tijeras de Primeros Auxilios', 'Salud y Medicina', 'Primeros Auxilios', 'Instrumentos', 'unidad', 'Tijeras de acero para cortar vendas. Energia: acero ~0.1kg x 35 MJ/kg = 3.5 MJ = 1 TQ + manufactura. Fuente: ICE Database.', 'Instrumental', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 2),
  ('Apositos y Tiritas (Caja)', 'Salud y Medicina', 'Primeros Auxilios', 'Apositos', 'caja', 'Caja de apositos y tiritas adhesivas. Energia: plastico + algodon + adhesivo ~1 TQ.', 'Curacion', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80', 1)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 3. HERRAMIENTAS DE CAMPO -> dividir en herramientas individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en herramientas individuales. Ver: Machete, Pala, Pico, Rastrillo, Azadon.'
WHERE name = 'Herramientas de Campo';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Machete', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Machete de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 4 MJ = 14 MJ = 4 TQ. Fuente: ICE Database.', 'Conuquero', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 4),
  ('Pala', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Pala de acero con mango de madera. Energia: acero ~1.5kg x 20 MJ/kg + mango 4 MJ = 34 MJ = 9 TQ. Fuente: ICE Database.', 'Excavacion', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 9),
  ('Pico', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Pico de acero con mango de madera. Energia: acero ~2kg x 20 MJ/kg + mango 4 MJ = 44 MJ = 12 TQ. Fuente: ICE Database.', 'Excavacion', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 12),
  ('Rastrillo', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Rastrillo de acero con mango de madera. Energia: acero ~1kg x 20 MJ/kg + mango 4 MJ = 24 MJ = 7 TQ. Fuente: ICE Database.', 'Limpieza', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 7),
  ('Azadon', 'Herramientas', 'Manuales', 'Agricolas', 'unidad', 'Azadon de acero con mango de madera. Energia: acero ~0.8kg x 20 MJ/kg + mango 4 MJ = 20 MJ = 6 TQ. Fuente: ICE Database.', 'Cultivo', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 6)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 4. HERRAMIENTAS DE TALLER -> dividir en herramientas individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en herramientas individuales. Ver: Martillo, Serrucho, Lima, Destornillador, Alicates.'
WHERE name = 'Herramientas de Taller';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Martillo', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Martillo de acero con mango de madera. Energia: acero ~0.3kg x 20 MJ/kg + mango 2 MJ = 8 MJ = 2 TQ. Fuente: ICE Database.', 'Taller', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 2),
  ('Serrucho', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Serrucho de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 2 MJ = 12 MJ = 3 TQ. Fuente: ICE Database.', 'Corte', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 3),
  ('Lima', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Lima de acero para desbaste. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Desbaste', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 2),
  ('Destornillador', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Destornillador de acero con mango de plastico. Energia: acero ~0.1kg x 20 MJ/kg + plastico 1 MJ = 3 MJ = 1 TQ. Fuente: ICE Database.', 'Tornillos', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 1),
  ('Alicates', 'Herramientas', 'Manuales', 'Taller', 'unidad', 'Alicates de acero. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Pinza', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 2)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 5. EQUIPOS ELECTRICOS DE TALLER -> dividir en equipos individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en equipos individuales. Ver: Taladro Electrico, Sierra Circular, Amoladora, Lijadora, Soldadora Electrica.'
WHERE name = 'Equipos Electricos de Taller';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Taladro Electrico', 'Herramientas', 'Electricas', 'Taladros', 'unidad', 'Taladro electrico portatil 600W. Energia: motor + plastico + cobre ~100 TQ. Fuente: ICE Database.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 100),
  ('Sierra Circular', 'Herramientas', 'Electricas', 'Sierras', 'unidad', 'Sierra circular electrica 1200W con disco. Energia: motor + acero + plastico ~120 TQ. Fuente: ICE Database.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 120),
  ('Amoladora', 'Herramientas', 'Electricas', 'Amoladoras', 'unidad', 'Amoladora angular electrica 700W con discos. Energia: motor + acero ~80 TQ. Fuente: ICE Database.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 80),
  ('Lijadora Electrica', 'Herramientas', 'Electricas', 'Lijadoras', 'unidad', 'Lijadora orbital electrica 300W. Energia: motor + plastico ~60 TQ. Fuente: ICE Database.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 60),
  ('Soldadora Electrica', 'Herramientas', 'Electricas', 'Soldadoras', 'unidad', 'Soldadora electrica 150A con electrodos. Energia: transformador cobre + acero ~200 TQ. Fuente: ICE Database.', 'Electrico', 'https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80', 200)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 6. COMPONENTES ELECTRONICOS -> dividir en componentes individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en componentes individuales. Ver: Cable Electrico, Resistencias, Capacitores, Conectores, Soldadura, Plaquetas, Fusibles.'
WHERE name = 'Componentes Electronicos';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Cable Electrico (metro)', 'Tecnologia', 'Componentes', 'Cables', 'metro', 'Cable de cobre 1 metro para instalaciones. Energia: cobre ~0.1kg x 42 MJ/kg = 4.2 MJ = 1 TQ. Fuente: ICE Database.', 'Cable', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 1),
  ('Resistencias (Paquete 10)', 'Tecnologia', 'Componentes', 'Resistencias', 'paquete', 'Paquete de 10 resistencias electronicas. Energia: manufactura ~1 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 1),
  ('Capacitores (Paquete 10)', 'Tecnologia', 'Componentes', 'Capacitores', 'paquete', 'Paquete de 10 capacitores electronicos. Energia: manufactura ~1 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 1),
  ('Conectores (Paquete)', 'Tecnologia', 'Componentes', 'Conectores', 'paquete', 'Paquete de conectores electronicos variados. Energia: plastico + metal ~2 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 2),
  ('Soldadura Electronica (Rollo)', 'Tecnologia', 'Componentes', 'Soldadura', 'rollo', 'Rollo de soldadura de estano para electronica. Energia: estano + plomo ~3 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 3),
  ('Plaquetas PCB (Unidad)', 'Tecnologia', 'Componentes', 'Plaquetas', 'unidad', 'Plaqueta PCB virgen para circuitos. Energia: cobre + fibra de vidrio ~2 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 2),
  ('Fusibles (Paquete 10)', 'Tecnologia', 'Componentes', 'Fusibles', 'paquete', 'Paquete de 10 fusibles electricos. Energia: vidrio + metal ~1 TQ.', 'Componente', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 1)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 7. BICICLETAS Y REFACCIONES -> dividir ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en componentes individuales. Ver: Bicicleta Completa, Llanta de Bicicleta, Cadena de Bicicleta, Frenos de Bicicleta.'
WHERE name = 'Bicicletas y Refacciones';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Bicicleta Completa', 'Transporte', 'Vehiculos', 'Bicicletas', 'unidad', 'Bicicleta completa lista para usar. Energia: acero ~15kg x 6 kWh/kg + caucho + ensamblaje = 100 TQ. Fuente: ICE Database.', 'Transporte Limpio', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 100),
  ('Llanta de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'unidad', 'Llanta de caucho para bicicleta. Energia: caucho ~1kg x 24 MJ/kg = 24 MJ = 7 TQ. Fuente: Ecoinvent.', 'Refaccion', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 7),
  ('Cadena de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'unidad', 'Cadena de acero para bicicleta. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.', 'Refaccion', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 2),
  ('Frenos de Bicicleta', 'Transporte', 'Vehiculos', 'Refacciones', 'par', 'Par de frenos completos para bicicleta. Energia: acero + caucho ~5 TQ.', 'Refaccion', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 5)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 8. ANIMALES DE CARGA -> dividir en animales individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en animales individuales. Ver: Caballo, Burro, Mula.'
WHERE name = 'Animales de Carga y Montura';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Caballo de Silla', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Caballo entrenado para montura. Energia incorporada: crianza + alimentacion 3 anos ~500 TQ (estimacion comunitaria).', 'Traccion Animal', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 500),
  ('Burro de Carga', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Burro entrenado para carga. Energia incorporada: crianza + alimentacion 2 anos ~300 TQ (estimacion comunitaria).', 'Traccion Animal', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 300),
  ('Mula de Carga', 'Transporte', 'Animales', 'Equinos', 'unidad', 'Mula para carga y trabajo de campo. Energia incorporada: crianza + alimentacion 3 anos ~400 TQ (estimacion comunitaria).', 'Traccion Animal', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80', 400)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 9. INSTRUMENTOS MUSICALES -> dividir en instrumentos individuales ============
UPDATE products SET is_hidden = true, description = 'OBSOLETO: dividido en instrumentos individuales. Ver: Cuatro, Guitarra, Tambor, Maracas, Flauta de Caña.'
WHERE name = 'Instrumentos Musicales Artesanales';

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.desc, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Cuatro Venezolano', 'Cultura', 'Musica', 'Cuerdas', 'unidad', 'Cuatro venezolano artesanal de madera. Energia: madera ~2kg x 8.5 MJ/kg + cuerdas + manufactura = 25 TQ. Fuente: ICE Database.', 'Musica Criolla', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 25),
  ('Guitarra Artesanal', 'Cultura', 'Musica', 'Cuerdas', 'unidad', 'Guitarra acustica artesanal de madera. Energia: madera ~4kg x 8.5 MJ/kg + cuerdas + manufactura = 40 TQ. Fuente: ICE Database.', 'Musica', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 40),
  ('Tambor (Caja)', 'Cultura', 'Musica', 'Percusion', 'unidad', 'Tambor de madera con cuero. Energia: madera ~3kg x 8.5 MJ/kg + cuero + manufactura = 30 TQ. Fuente: ICE Database.', 'Percusion', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 30),
  ('Maracas (Par)', 'Cultura', 'Musica', 'Percusion', 'par', 'Par de maracas de totuma con semillas y mango de madera. Energia: madera + semillas + manufactura = 8 TQ.', 'Percusion', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 8),
  ('Flauta de Caña', 'Cultura', 'Musica', 'Vientos', 'unidad', 'Flauta traversa de caña. Energia: caña + manufactura = 3 TQ.', 'Viento', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80', 3)
) AS p(name, parent, cat, subcat, unit, desc, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ 10. CANASTA BASICA -> aclarar contenido exacto ============
UPDATE products SET
  description = 'Canasta semanal para familia 4-5 personas. Contenido exacto: 3kg granos basicos (maiz, frijol, arroz), 2kg verduras frescas (tomate, cebolla, pimenton), 1kg frutas de temporada, 0.5kg carne de pollo, 1L leche fresca, 0.5L aceite vegetal, 0.5kg panela/azucar, 1 docena huevos, 100g especias (sal, comino, ajo). Energia total estimada: 3x10 + 2x2 + 1x2 + 0.5x8 + 1x2 + 0.5x10 + 0.5x15 + 1x10 + 1 = 30+4+2+4+2+5+7.5+10+1 = 65.5 TQ. Precio redondeado: 66 TQ.',
  price_per_unit = 66
WHERE name = 'Canasta Basica Familiar Semanal';
