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
   '/placeholder.svg',
   50, true, true, ''),
  ('default', 'Tuberculos Ancestrales y Platanos', 'Cosecha Fresca', 'internal', 'kg',
   'Name morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura y cambur morado.',
   'Rubro Olvidado',
   '/placeholder.svg',
   70, true, true, ''),
  ('default', 'Tinturas Madres y Botica Conuquera', 'Medicina Botanica & Cosmetica', 'internal', 'frasco',
   'Extractos de propoleo puro, tinturas de moringa, curcuma, jengibre, pomadas desinflamatorias de arnica y jarabes naturales.',
   '100% Puro',
   '/placeholder.svg',
   120, true, true, ''),
  ('default', 'Cosmetica Natural sin Quimicos', 'Medicina Botanica & Cosmetica', 'internal', 'unidad',
   'Desodorantes ecologicos de aceite de coco y bicarbonato, balsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.',
   'Residuo Cero',
   '/placeholder.svg',
   90, true, true, ''),
  ('default', 'La Tradicional Cafunga de Barlovento', 'Gastronomia Artesanal', 'internal', 'porcion',
   'Dulce patrimonial afrovenezolano elaborado a base de platano maduro, coco rallado, papelon y anis dulce, horneado en hoja de platano.',
   'Plato Estrella',
   '/placeholder.svg',
   60, true, true, ''),
  ('default', 'Quesos Artesanales de Bufala y Cabra', 'Gastronomia Artesanal', 'internal', 'kg',
   'Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequenos rebanos pastoreados.',
   'Pastoreo Libre',
   '/placeholder.svg',
   150, true, true, ''),
  ('default', 'Cacao Puro, Chocolates y Cafe de Montana', 'Gastronomia Artesanal', 'internal', 'barra',
   'Barras de chocolate bean-to-bar 70% cacao de Barlovento y Chuao, licor de cacao artesanal y cafe lavado tostado a lena.',
   'Origen Venezolano',
   '/placeholder.svg',
   200, true, true, ''),
  ('default', 'Plantulas Medicinales y Semillas Criollas', 'Semillas & Plantulas', 'internal', 'maceta',
   'Plantas en maceta de poleo, estevia, malojillo, romero, ruda, oregano orejon y sobres de semillas adaptadas al clima caraqueno.',
   'Para tu Huerto',
   '/placeholder.svg',
   40, true, true, '');

-- 4. No insertar para localhost - el backend hace fallback a 'default'
-- si no encuentra productos para su node_domain especifico.
