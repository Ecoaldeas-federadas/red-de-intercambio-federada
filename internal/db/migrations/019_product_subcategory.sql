-- Migracion 019: Subcategorias en productos + ocultar productos

-- Subcategoria para organizar productos dentro de una categoria
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';

-- Campo para ocultar productos de la pagina publica sin eliminarlos
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
