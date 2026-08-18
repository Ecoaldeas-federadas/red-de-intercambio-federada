-- Migracion 028: Solo 8 productos Conuqueros + arreglar imagenes rotas
--
-- 1. Borrar los 7 productos basicos que no son de la Feria
-- 2. Arreglar 2 URLs de imagenes rotas (404 en Unsplash)

-- 1. Borrar productos basicos del sistema (no son Conuqueros)
DELETE FROM products WHERE is_system = true AND category IN ('alimentos', 'textiles', 'servicios', 'energeticos');

-- 2. Arreglar imagen de Tuberculos (URL original daba 404)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Tuberculos Ancestrales y Platanos' AND is_system = true;

-- 3. Arreglar imagen de Cacao (URL original daba 404)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Cacao Puro, Chocolates y Cafe de Montana' AND is_system = true;
