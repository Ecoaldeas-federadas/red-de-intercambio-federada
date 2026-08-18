-- Migracion 024: Eliminar productos duplicados
--
-- La migracion 018 insertaba productos sin indice unico, causando
-- duplicados cada vez que las migraciones se ejecutaban.
-- Esta migracion elimina los duplicados dejando solo el mas reciente
-- de cada grupo (mismo nombre + node_domain).

-- Eliminar duplicados: mantener solo el de created_at mas reciente
DELETE FROM products
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (node_domain, name) id
    FROM products
    ORDER BY node_domain, name, created_at DESC
  ) AS keep_ids
);

-- Anadir indice unico para prevenir futuros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_node_name_unique
ON products (node_domain, name);
