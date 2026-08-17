-- Migracion 018: Productos de muestra de la Feria Conuquera (sistema, ya aprobados)
-- Estos productos aparecen automaticamente en la pagina publica sin aprobacion de asamblea

-- Agregar columna badge para etiquetas destacadas (Fresco del Dia, Plato Estrella, etc.)
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT '';

-- Agregar columna image_url para fotos de los productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- Insertar los 8 productos de muestra del catalogo Conuquero
INSERT INTO products (node_domain, name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system)
VALUES
  ('default', 'Hortalizas y Hojas Verdes de El Junquito', 'Cosecha Fresca', 'internal', 'manojo',
   'Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollin, cilantro de monte y apio Espana cosechados en la manana.',
   'Fresco del Dia',
   'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
   50, true, true),

  ('default', 'Tuberculos Ancestrales y Platanos', 'Cosecha Fresca', 'internal', 'kg',
   'Name morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura y cambur morado.',
   'Rubro Olvidado',
   'https://images.unsplash.com/photo-1607305387299-a3d96abfd2a8?auto=format&fit=crop&w=600&q=80',
   70, true, true),

  ('default', 'Tinturas Madres y Botica Conuquera', 'Medicina Botanica & Cosmetica', 'internal', 'frasco',
   'Extractos de propoleo puro, tinturas de moringa, curcuma, jengibre, pomadas desinflamatorias de arnica y jarabes naturales.',
   '100% Puro',
   'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80',
   120, true, true),

  ('default', 'Cosmetica Natural sin Quimicos', 'Medicina Botanica & Cosmetica', 'internal', 'unidad',
   'Desodorantes ecologicos de aceite de coco y bicarbonato, balsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.',
   'Residuo Cero',
   'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
   90, true, true),

  ('default', 'La Tradicional Cafunga de Barlovento', 'Gastronomia Artesanal', 'internal', 'porcion',
   'Dulce patrimonial afrovenezolano elaborado a base de platano maduro, coco rallado, papelon y anis dulce, horneado en hoja de platano.',
   'Plato Estrella',
   'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80',
   60, true, true),

  ('default', 'Quesos Artesanales de Bufala y Cabra', 'Gastronomia Artesanal', 'internal', 'kg',
   'Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequenos rebanos pastoreados.',
   'Pastoreo Libre',
   'https://images.unsplash.com/photo-1452251889660-1c3e1c6e1c3a?auto=format&fit=crop&w=600&q=80',
   150, true, true),

  ('default', 'Cacao Puro, Chocolates y Cafe de Montana', 'Gastronomia Artesanal', 'internal', 'barra',
   'Barras de chocolate bean-to-bar 70% cacao de Barlovento y Chuao, licor de cacao artesanal y cafe lavado tostado a lena.',
   'Origen Venezolano',
   'https://images.unsplash.com/photo-1516045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
   200, true, true),

  ('default', 'Plantulas Medicinales y Semillas Criollas', 'Semillas & Plantulas', 'internal', 'maceta',
   'Plantas en maceta de poleo, estevia, malojillo, romero, ruda, oregano orejon y sobres de semillas adaptadas al clima caraqueno.',
   'Para tu Huerto',
   'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
   40, true, true)
ON CONFLICT DO NOTHING;
