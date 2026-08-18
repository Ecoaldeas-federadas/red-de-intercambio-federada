-- 044_store_items_hierarchy.sql
-- Anade jerarquia de 3 niveles a store_items para que los productos compuestos
-- se ubiquen en categoria padre, categoria y subcategoria del catalogo.

ALTER TABLE store_items ADD COLUMN IF NOT EXISTS parent_category TEXT DEFAULT '';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';

-- Actualizar items existentes: si no tienen parent_category, dejar vacio
-- (el frontend ahora exige seleccionar los 3 niveles al crear compuestos)

CREATE INDEX IF NOT EXISTS idx_store_items_parent_category
    ON store_items (node_domain, parent_category, category, subcategory);
