-- Migracion 027: Borrar TODOS los productos y reinsertar limpios
--
-- El ON CONFLICT DO NOTHING no funciona sin indice unico.
-- YugabyteDB no soporta crear indices unicos aqui sin errores.
-- Solucion: DELETE ALL + INSERT limpio.

-- 1. Borrar TODOS los productos del sistema
DELETE FROM products WHERE is_system = true;

-- 2. Reinsertar los 8 productos Conuqueros
INSERT INTO products (node_domain, name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code)
VALUES
  ('default', 'Hortalizas y Hojas Verdes de El Junquito', 'Cosecha Fresca', 'internal', 'manojo',
   'Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollin, cilantro de monte y apio Espana cosechados en la manana.',
   'Fresco del Dia',
   'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
   50, true, true, ''),
  ('default', 'Tuberculos Ancestrales y Platanos', 'Cosecha Fresca', 'internal', 'kg',
   'Name morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura y cambur morado.',
   'Rubro Olvidado',
   'https://images.unsplash.com/photo-1607305387299-a3d96abfd2a8?auto=format&fit=crop&w=600&q=80',
   70, true, true, ''),
  ('default', 'Tinturas Madres y Botica Conuquera', 'Medicina Botanica & Cosmetica', 'internal', 'frasco',
   'Extractos de propoleo puro, tinturas de moringa, curcuma, jengibre, pomadas desinflamatorias de arnica y jarabes naturales.',
   '100% Puro',
   'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80',
   120, true, true, ''),
  ('default', 'Cosmetica Natural sin Quimicos', 'Medicina Botanica & Cosmetica', 'internal', 'unidad',
   'Desodorantes ecologicos de aceite de coco y bicarbonato, balsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.',
   'Residuo Cero',
   'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
   90, true, true, ''),
  ('default', 'La Tradicional Cafunga de Barlovento', 'Gastronomia Artesanal', 'internal', 'porcion',
   'Dulce patrimonial afrovenezolano elaborado a base de platano maduro, coco rallado, papelon y anis dulce, horneado en hoja de platano.',
   'Plato Estrella',
   'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
   60, true, true, ''),
  ('default', 'Quesos Artesanales de Bufala y Cabra', 'Gastronomia Artesanal', 'internal', 'kg',
   'Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequenos rebanos pastoreados.',
   'Pastoreo Libre',
   'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
   150, true, true, ''),
  ('default', 'Cacao Puro, Chocolates y Cafe de Montana', 'Gastronomia Artesanal', 'internal', 'barra',
   'Barras de chocolate bean-to-bar 70% cacao de Barlovento y Chuao, licor de cacao artesanal y cafe lavado tostado a lena.',
   'Origen Venezolano',
   'https://images.unsplash.com/photo-1516045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
   200, true, true, ''),
  ('default', 'Plantulas Medicinales y Semillas Criollas', 'Semillas & Plantulas', 'internal', 'maceta',
   'Plantas en maceta de poleo, estevia, malojillo, romero, ruda, oregano orejon y sobres de semillas adaptadas al clima caraqueno.',
   'Para tu Huerto',
   'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
   40, true, true, '');

-- 3. Insertar productos basicos del sistema (7)
INSERT INTO products (node_domain, name, category, origin, unit, quantity_per_batch, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_unit, is_approved, is_system, product_code)
VALUES
  ('default', 'Granos basicos (maiz, frijol) 1kg', 'alimentos', 'internal', 'kg', 1, 10, 60, 15, 5, 90, true, true, ''),
  ('default', 'Harina de maiz 50kg', 'alimentos', 'internal', 'saco', 1, 500, 5000, 2000, 2500, 10000, true, true, ''),
  ('default', 'Verduras frescas 1kg', 'alimentos', 'internal', 'kg', 1, 5, 30, 10, 5, 50, true, true, ''),
  ('default', 'Miel 1L', 'alimentos', 'internal', 'litro', 1, 50, 2000, 800, 650, 3500, true, true, ''),
  ('default', 'Prenda artesanal (lana/algodon)', 'textiles', 'internal', 'unidad', 1, 100, 3000, 800, 300, 4200, true, true, ''),
  ('default', 'Tela de algodon 1m', 'textiles', 'internal', 'm', 1, 50, 800, 500, 150, 1500, true, true, ''),
  ('default', 'Hora de labor agricola', 'servicios', 'internal', 'hora', 1, 0, 325, 0, 0, 325, true, true, '');

-- 4. Copiar a localhost
INSERT INTO products (node_domain, name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, quantity_per_batch, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT 'localhost', name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, quantity_per_batch, energy_direct, energy_human, energy_inputs, energy_amortization
FROM products
WHERE node_domain = 'default' AND is_system = true;
