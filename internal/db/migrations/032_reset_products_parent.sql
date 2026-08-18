-- Migracion 032: Borrar productos para reinsertar con parent_category
--
-- La migracion 031 anade la columna parent_category.
-- Los productos existentes no tienen parent_category asignada.
-- Al borrarlos, SeedProductsToNode los reinserta con la jerarquia correcta:
-- parent_category > category > subcategory

DELETE FROM products WHERE node_domain = 'localhost';
