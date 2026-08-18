-- Migracion 031: Anadir parent_category a products para jerarquia de 3 niveles
--
-- Estructura: parent_category > category > subcategory
-- Ejemplo: Alimentacion > Cosecha Fresca > Hojas Verdes

ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_category TEXT DEFAULT '';
