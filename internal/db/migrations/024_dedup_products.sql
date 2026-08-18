-- Migracion 024: Eliminar productos duplicados (solo DELETE, sin indice)
--
-- No creamos indice unico aqui para evitar errores de transaccion.
-- Las queries del backend ya usan DISTINCT ON para evitar mostrar
-- duplicados al usuario.

-- Eliminar duplicados: mantener solo el de created_at mas reciente
DELETE FROM products
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (node_domain, name) id
    FROM products
    ORDER BY node_domain, name, created_at DESC
  ) AS keep_ids
);
