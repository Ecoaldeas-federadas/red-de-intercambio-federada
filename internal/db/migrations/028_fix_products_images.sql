-- Migracion 028: Arreglar 2 imagenes rotas (Tuberculos y Cacao)
--
-- Las URLs originales daban 404 en Unsplash.

-- Arreglar imagen de Tuberculos (URL original daba 404)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Tuberculos Ancestrales y Platanos' AND is_system = true;

-- Arreglar imagen de Cacao (URL original daba 404)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Cacao Puro, Chocolates y Cafe de Montana' AND is_system = true;
