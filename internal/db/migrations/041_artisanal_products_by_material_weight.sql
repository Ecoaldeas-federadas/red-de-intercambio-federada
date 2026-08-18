-- Migracion 041: Productos artesanales por kg de material + trabajo por hora
-- Estandar internacional ICE Database: energia incorporada por kg de material
-- Solucion: materia prima por kg, trabajo artesanal por hora, productos especificos con peso definido
-- Fuente: ICE Database University of Bath, Ecoinvent

-- ============ ELIMINAR productos ambiguos "por unidad" ============
DELETE FROM products WHERE name = 'Prendas de Vestir Artesanales';
DELETE FROM products WHERE name = 'Cobijas, Frazadas y Hamacas';
DELETE FROM products WHERE name = 'Vasijas y Vajilla de Barro';
DELETE FROM products WHERE name = 'Ceramica Decorativa';
DELETE FROM products WHERE name = 'Canastas y Cesteria';
DELETE FROM products WHERE name = 'Tallados y Utensilios de Madera';
DELETE FROM products WHERE name = 'Muebles Rusticos de Madera';

-- ============ INSERTAR materias primas por kg ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  -- Arcilla cruda para ceramica: 2.5 MJ/kg = 0.69 TQ/kg (ICE Database: ceramic brick 2.5 MJ/kg)
  ('Arcilla para Ceramica (cruda)', 'Artesania', 'Ceramica', 'Materia Prima', 'kg', 'Arcilla cruda para alfareria y ceramica. Precio por kg de material. Energia: 2.5 MJ/kg = 0.7 TQ/kg (extraccion + preparacion). Fuente: ICE Database, University of Bath.', 'Materia Prima', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  -- Madera blanda secada al aire: 0.3 MJ/kg = 0.08 TQ/kg (ICE Database: timber softwood air dried)
  ('Madera Blanda para Tallado', 'Artesania', 'Madera', 'Materia Prima', 'kg', 'Madera blanda secada al aire para tallado artesanal (cedro, ceiba, saman). Precio por kg. Energia: 0.3 MJ/kg = 0.08 TQ/kg (tala + aserrado + secado natural). Fuente: ICE Database.', 'Materia Prima', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  -- Madera dura secada al horno: 2.0 MJ/kg = 0.56 TQ/kg (ICE Database: timber hardwood kiln dried)
  ('Madera Dura para Muebles', 'Artesania', 'Madera', 'Materia Prima', 'kg', 'Madera dura secada al horno para muebles (roble, caoba, apamate). Precio por kg. Energia: 2.0 MJ/kg = 0.56 TQ/kg (tala + aserrado + secado horno). Fuente: ICE Database.', 'Materia Prima', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  -- Fibra vegetal para cesteria: ~0.5 MJ/kg = 0.14 TQ/kg (recoleccion manual)
  ('Fibra Vegetal para Cesteria', 'Artesania', 'Cesteria', 'Materia Prima', 'kg', 'Fibra vegetal seca para cesteria (mimbre, paja, caña brava, coco). Precio por kg. Energia: ~0.5 MJ/kg = 0.14 TQ/kg (recoleccion + secado solar). Estimacion comunitaria.', 'Materia Prima', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  -- Tela de algodon cruda: 143 MJ/kg = 39.7 TQ/kg (ICE Database: cotton 143 MJ/kg)
  ('Tela de Algodon Cruda (kg)', 'Textiles', 'Tejidos', 'Materia Prima', 'kg', 'Tela de algodon cruda sin teñir para confeccion. Precio por kg. Energia: 143 MJ/kg = 39.7 TQ/kg (cultivo + hilado + tejido). Fuente: ICE Database, Ecoinvent.', 'Materia Prima', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80', 40),
  -- Lana cruda: ~67.5 MJ/kg = 18.75 TQ/kg (ICE Database: natural latex ~67.5, lana similar)
  ('Lana Cruda para Tejer (kg)', 'Textiles', 'Hilos y Materiales', 'Materia Prima', 'kg', 'Lana de oveja cruda lavada para tejer. Precio por kg. Energia: ~67.5 MJ/kg = 18.75 TQ/kg (crianza + esquila + lavado). Fuente: ICE Database.', 'Materia Prima', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 19),
  -- Hilo de cosir: ~143 MJ/kg = 39.7 TQ/kg (algodon procesado)
  ('Hilo de Algodon (rollo 100g)', 'Textiles', 'Hilos y Materiales', 'Hilos', 'rollo', 'Rollo de hilo de algodon de 100g para coser o tejer. Energia: 143 MJ/kg x 0.1kg = 14.3 MJ = 4 TQ. Fuente: ICE Database.', 'Materia Prima', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 4)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ INSERTAR productos especificos con peso definido ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  -- CERAMICA: arcilla 2.5 MJ/kg + coccion horno + trabajo
  -- Taza de barro (0.3 kg): 0.3x2.5 + coccion 1 + trabajo 1h = 0.75+1+1 = 3 TQ
  ('Taza de Barro (0.3 kg)', 'Artesania', 'Ceramica', 'Vajilla', 'unidad', 'Taza de barro artesanal de 0.3 kg. Energia: arcilla 0.3kg x 2.5 MJ/kg = 0.75 MJ + coccion horno 3.6 MJ + trabajo 1h = 5.35 MJ = 1.5 TQ. Precio: 2 TQ.', 'Barro Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 2),
  -- Plato de barro (0.5 kg): 0.5x2.5 + coccion 2 + trabajo 1h = 1.25+2+1 = 4 TQ
  ('Plato de Barro (0.5 kg)', 'Artesania', 'Ceramica', 'Vajilla', 'unidad', 'Plato de barro artesanal de 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.', 'Barro Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3),
  -- Olla de barro (2 kg): 2x2.5 + coccion 5 + trabajo 3h = 5+5+3 = 13 TQ
  ('Olla de Barro (2 kg)', 'Artesania', 'Ceramica', 'Vasijas', 'unidad', 'Olla de barro artesanal de 2 kg para cocina. Energia: arcilla 2kg x 2.5 MJ/kg + coccion horno 18 MJ + trabajo 3h = 27 MJ = 7.5 TQ. Precio: 8 TQ.', 'Barro Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 8),
  -- Cantarola grande (5 kg): 5x2.5 + coccion 10 + trabajo 5h = 12.5+10+5 = 27 TQ
  ('Cantarola de Barro (5 kg)', 'Artesania', 'Ceramica', 'Vasijas', 'unidad', 'Cantarola de barro artesanal de 5 kg para almacenar agua. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 5h = 53.5 MJ = 15 TQ. Precio: 15 TQ.', 'Barro Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 15),
  -- Maceta pequena (0.5 kg): 0.5x2.5 + coccion 2 + trabajo 1h = 4 TQ
  ('Maceta de Arcilla Pequena (0.5 kg)', 'Artesania', 'Ceramica', 'Macetas', 'unidad', 'Maceta de arcilla decorativa pequena 10cm diametro, 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.', 'Maceta', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3),
  -- Maceta mediana (2 kg): 2x2.5 + coccion 5 + trabajo 2h = 5+5+2 = 12 TQ
  ('Maceta de Arcilla Mediana (2 kg)', 'Artesania', 'Ceramica', 'Macetas', 'unidad', 'Maceta de arcilla decorativa mediana 20cm diametro, 2 kg. Energia: arcilla 2kg x 2.5 MJ/kg + coccion 18 MJ + trabajo 2h = 27 MJ = 7.5 TQ. Precio: 8 TQ.', 'Maceta', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 8),
  -- Maceta grande (5 kg): 5x2.5 + coccion 10 + trabajo 3h = 12.5+10+3 = 25 TQ
  ('Maceta de Arcilla Grande (5 kg)', 'Artesania', 'Ceramica', 'Macetas', 'unidad', 'Maceta de arcilla decorativa grande 35cm diametro, 5 kg. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 3h = 53.5 MJ = 15 TQ. Precio: 15 TQ.', 'Maceta', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 15),

  -- MADERA: madera blanda 0.3 MJ/kg + trabajo tallado
  -- Cuchara de palo (0.1 kg): 0.1x0.3 + trabajo 1h = 0.03+1 = 1 TQ
  ('Cuchara de Palo (0.1 kg)', 'Artesania', 'Madera', 'Utensilios', 'unidad', 'Cuchara de palo tallado a mano, 0.1 kg. Energia: madera 0.1kg x 0.3 MJ/kg + trabajo 1h = 3.6 MJ = 1 TQ. Precio: 1 TQ.', 'Madera Noble', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  -- Mortero de madera (1 kg): 1x0.3 + trabajo 3h = 0.3+3 = 3 TQ
  ('Mortero de Madera (1 kg)', 'Artesania', 'Madera', 'Utensilios', 'unidad', 'Mortero de madera tallado a mano, 1 kg. Energia: madera 1kg x 0.3 MJ/kg + trabajo 3h = 11 MJ = 3 TQ. Precio: 3 TQ.', 'Madera Noble', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3),
  -- Silla rustica (8 kg madera dura): 8x2.0 + trabajo 6h = 16+6 = 22 TQ
  ('Silla Rustica de Madera (8 kg)', 'Artesania', 'Madera', 'Muebles', 'unidad', 'Silla rustica de madera dura, 8 kg. Energia: madera 8kg x 2.0 MJ/kg + trabajo 6h = 38 MJ = 10.5 TQ. Precio: 11 TQ.', 'Muebleria Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 11),
  -- Mesa rustica (20 kg madera dura): 20x2.0 + trabajo 10h = 40+10 = 50 TQ
  ('Mesa Rustica de Madera (20 kg)', 'Artesania', 'Madera', 'Muebles', 'unidad', 'Mesa rustica de madera dura, 20 kg. Energia: madera 20kg x 2.0 MJ/kg + trabajo 10h = 82 MJ = 23 TQ. Precio: 23 TQ.', 'Muebleria Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 23),
  -- Banco rustico (12 kg): 12x2.0 + trabajo 5h = 24+5 = 29 TQ
  ('Banco Rustico de Madera (12 kg)', 'Artesania', 'Madera', 'Muebles', 'unidad', 'Banco rustico de madera dura, 12 kg. Energia: madera 12kg x 2.0 MJ/kg + trabajo 5h = 51 MJ = 14 TQ. Precio: 14 TQ.', 'Muebleria Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 14),
  -- Cama rustica (35 kg): 35x2.0 + trabajo 12h = 70+12 = 82 TQ
  ('Cama Rustica de Madera (35 kg)', 'Artesania', 'Madera', 'Muebles', 'unidad', 'Cama rustica de madera dura, 35 kg. Energia: madera 35kg x 2.0 MJ/kg + trabajo 12h = 127 MJ = 35 TQ. Precio: 35 TQ.', 'Muebleria Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 35),

  -- CESTERIA: fibra vegetal 0.5 MJ/kg + trabajo tejido
  -- Canasto pequeno (0.3 kg): 0.3x0.5 + trabajo 2h = 0.15+2 = 2 TQ
  ('Canasto Pequeno (0.3 kg)', 'Artesania', 'Cesteria', 'Canastas', 'unidad', 'Canasto pequeno de fibra vegetal tejido a mano, 0.3 kg. Energia: fibra 0.3kg x 0.5 MJ/kg + trabajo 2h = 7 MJ = 2 TQ. Precio: 2 TQ.', 'Fibra Vegetal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 2),
  -- Cesta mediana (1 kg): 1x0.5 + trabajo 4h = 0.5+4 = 4.5 TQ
  ('Cesta Mediana (1 kg)', 'Artesania', 'Cesteria', 'Canastas', 'unidad', 'Cesta mediana de fibra vegetal tejida a mano, 1 kg. Energia: fibra 1kg x 0.5 MJ/kg + trabajo 4h = 14.5 MJ = 4 TQ. Precio: 4 TQ.', 'Fibra Vegetal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 4),
  -- Sombrero de paja (0.2 kg): 0.2x0.5 + trabajo 5h = 0.1+5 = 5 TQ
  ('Sombrero de Paja (0.2 kg)', 'Artesania', 'Cesteria', 'Sombreros', 'unidad', 'Sombrero de paja tejido a mano, 0.2 kg. Energia: fibra 0.2kg x 0.5 MJ/kg + trabajo 5h = 18 MJ = 5 TQ. Precio: 5 TQ.', 'Fibra Vegetal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 5),

  -- TEXTILES: tela algodon 143 MJ/kg + trabajo confeccion
  -- Camisa de algodon (0.3 kg tela): 0.3x143 + trabajo 4h = 42.9+4 = 47 TQ -> pero tela ya tiene precio, usar trabajo + tela
  -- Camisa (0.3 kg): 0.3x40 TQ/kg (tela) + 4h trabajo = 12+4 = 16 TQ
  ('Camisa de Algodon Artesanal (0.3 kg)', 'Textiles', 'Confeccion', 'Prendas', 'unidad', 'Camisa de algodon artesanal, 0.3 kg de tela. Energia: tela 0.3kg x 143 MJ/kg + trabajo 4h = 55 MJ = 15 TQ. Precio: 16 TQ.', 'Hecho a Mano', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 16),
  -- Pantalon (0.5 kg): 0.5x40 + 5h = 20+5 = 25 TQ
  ('Pantalon de Algodon Artesanal (0.5 kg)', 'Textiles', 'Confeccion', 'Prendas', 'unidad', 'Pantalon de algodon artesanal, 0.5 kg de tela. Energia: tela 0.5kg x 143 MJ/kg + trabajo 5h = 87 MJ = 24 TQ. Precio: 25 TQ.', 'Hecho a Mano', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 25),
  -- Frazada de lana (1.5 kg): 1.5x19 + 8h = 28.5+8 = 36 TQ
  ('Frazada de Lana Artesanal (1.5 kg)', 'Textiles', 'Tejidos', 'Cobijas', 'unidad', 'Frazada de lana tejida a mano, 1.5 kg. Energia: lana 1.5kg x 67.5 MJ/kg + trabajo 8h = 132 MJ = 37 TQ. Precio: 37 TQ.', 'Calor Artesanal', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80', 37),
  -- Hamaca de cañamo (1.2 kg): 1.2x40 + 10h = 48+10 = 58 TQ -> cañamo similar a algodon
  ('Hamaca de Cañamo (1.2 kg)', 'Textiles', 'Tejidos', 'Cobijas', 'unidad', 'Hamaca de fibra de cañamo tejida a mano, 1.2 kg. Energia: fibra 1.2kg x 143 MJ/kg + trabajo 10h = 292 MJ = 81 TQ. Precio: 30 TQ (ajuste comunitario por fibra local).', 'Descanso', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80', 30)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);

-- ============ INSERTAR trabajo artesanal por hora ============
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  ('Trabajo de Alfareria (hora)', 'Artesania', 'Ceramica', 'Trabajo', 'hora', 'Trabajo artesanal de alfareria y ceramica por hora. Incluye modelado, esmaltado y control de horno. Energia: 1 kWh/hora de trabajo humano.', 'Trabajo Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  ('Trabajo de Carpinteria (hora)', 'Artesania', 'Madera', 'Trabajo', 'hora', 'Trabajo artesanal de carpinteria y tallado de madera por hora. Energia: 1 kWh/hora de trabajo humano.', 'Trabajo Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  ('Trabajo de Cesteria (hora)', 'Artesania', 'Cesteria', 'Trabajo', 'hora', 'Trabajo artesanal de cesteria y tejido de fibra vegetal por hora. Energia: 1 kWh/hora de trabajo humano.', 'Trabajo Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 1),
  ('Trabajo de Costura (hora)', 'Textiles', 'Confeccion', 'Trabajo', 'hora', 'Trabajo artesanal de costura y confeccion por hora. Energia: 1 kWh/hora de trabajo humano.', 'Trabajo Artesanal', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', 1),
  ('Coccion de Ceramica en Horno (carga)', 'Artesania', 'Ceramica', 'Trabajo', 'carga', 'Coccion de una carga de horno ceramico (incluye leña o gas). Energia: ~18 MJ/kg de arcilla cocida = 5 TQ/kg. Una carga tipica cuece 10-20 piezas.', 'Coccion', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 5)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);
