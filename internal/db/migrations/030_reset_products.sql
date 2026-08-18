-- Migracion 030: Borrar todos los productos para que SeedProductsToNode
-- los reinserte correctamente con subcategorias y categorias en mayuscula.
--
-- Los productos existentes tienen:
-- - Subcategorias vacias (los 8 Conuqueros)
-- - Categorias en minuscula (los 7 basicos: alimentos, textiles, servicios)
-- - Solo 8 se muestran en el frontend por inconsistencias
--
-- Al borrarlos, SeedProductsToNode los reinserta con:
-- - Subcategorias correctas (Hojas Verdes, Tuberculos, Tinturas, etc.)
-- - Categorias con mayuscula inicial (Alimentos, Textiles, Servicios)
-- - Los 15 productos completos

DELETE FROM products WHERE node_domain = 'localhost';
