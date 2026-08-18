-- Migracion 025: Limpiar indice problematico de migracion 024
--
-- La migracion 024 intento crear un indice unico pero fallo por
-- duplicados existentes, dejando el sistema en estado inconsistente.
-- Esta migracion:
-- 1. Elimina el indice si existe
-- 2. Elimina los duplicados
-- 3. NO crea indice unico (las queries usan DISTINCT ON)

-- 1. Eliminar indice problematico
DROP INDEX IF EXISTS idx_products_node_name_unique;

-- 2. Eliminar duplicados: mantener solo el de created_at mas reciente
DELETE FROM products
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (node_domain, name) id
    FROM products
    ORDER BY node_domain, name, created_at DESC
  ) AS keep_ids
);
