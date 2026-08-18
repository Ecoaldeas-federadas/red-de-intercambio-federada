-- Migracion 029: Eliminar productos del dominio 'default'
--
-- Los productos seed ya no se insertan en 'default'. Se insertan
-- directamente con el dominio del nodo via SeedProductsToNode().
-- Esta migracion limpia los productos residuales de 'default'.

-- Borrar todos los productos del dominio 'default'
DELETE FROM products WHERE node_domain = 'default';
