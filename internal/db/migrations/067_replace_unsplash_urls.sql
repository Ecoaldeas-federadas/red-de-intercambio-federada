-- Reemplazar todas las URLs de Unsplash con /placeholder.svg
-- Las URLs de Unsplash devuelven 404 y ensucian la consola del navegador.
-- Esto afecta productos, store_items, y cualquier tabla con image_url.

UPDATE products SET image_url = '/placeholder.svg' WHERE image_url LIKE '%images.unsplash.com%';
UPDATE products SET image_url = '/placeholder.svg' WHERE image_url LIKE '%unsplash%';

-- Tambien limpiar store_items si tiene URLs de Unsplash
UPDATE store_items SET image_url = '/placeholder.svg' WHERE image_url LIKE '%unsplash%' AND image_url IS NOT NULL;

-- Limpiar public_settings si tiene URLs de Unsplash en campos de imagen
UPDATE public_settings SET value = '/placeholder.svg' WHERE value LIKE '%unsplash%' AND key LIKE '%image%';

-- Limpiar public_pages si tiene URLs de Unsplash en contenido
UPDATE public_pages SET hero_image = '/placeholder.svg' WHERE hero_image LIKE '%unsplash%';
