-- Reemplazar todas las URLs de Unsplash con /placeholder.svg
-- Las URLs de Unsplash devuelven 404 y ensucian la consola del navegador.
-- Cada UPDATE se ejecuta solo si la columna existe (DO block).

DO $$
BEGIN
  -- products.image_url
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
    UPDATE products SET image_url = '/placeholder.svg' WHERE image_url LIKE '%unsplash%';
  END IF;

  -- store_items.image_url
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_items' AND column_name = 'image_url') THEN
    UPDATE store_items SET image_url = '/placeholder.svg' WHERE image_url LIKE '%unsplash%' AND image_url IS NOT NULL;
  END IF;

  -- public_settings.value (campo de imagen)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_settings' AND column_name = 'value') THEN
    UPDATE public_settings SET value = '/placeholder.svg' WHERE value LIKE '%unsplash%' AND key LIKE '%image%';
  END IF;

  -- public_pages.hero_image
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_pages' AND column_name = 'hero_image') THEN
    UPDATE public_pages SET hero_image = '/placeholder.svg' WHERE hero_image LIKE '%unsplash%';
  END IF;
END
$$;
