-- Migración 144: Normalizar usernames a minúsculas + índice único case-insensitive
--
-- Problema: El teclado del POS Android escribe en mayúsculas, pero los usernames
-- están guardados en minúsculas. Las búsquedas WHERE username = $1 son case-sensitive
-- y no encuentran el usuario.
--
-- Solución:
-- 1. Normalizar todos los usernames existentes a minúsculas
-- 2. Crear un índice único en (LOWER(username), node_domain) para evitar duplicados
-- 3. Las consultas deben usar LOWER(username) = LOWER($1)

-- Paso 1: Identificar y eliminar duplicados case-insensitive antes de normalizar
-- Si hay "Admin" y "admin" en el mismo nodo, eliminar el duplicado (mantener el de menor id)
DELETE FROM users
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY LOWER(username), node_domain
      ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM users
  ) ranked
  WHERE ranked.rn = 1
);

-- Paso 2: Normalizar todos los usernames restantes a minúsculas
UPDATE users SET username = LOWER(username) WHERE username != LOWER(username);

-- Paso 3: Crear índice único case-insensitive
-- Esto previene que se creen dos usuarios con el mismo nombre ignorando mayúsculas
DROP INDEX IF EXISTS users_username_node_domain_lower_uniq;
CREATE UNIQUE INDEX users_username_node_domain_lower_uniq
  ON users (LOWER(username), node_domain);

-- Paso 4: Índice regular para búsquedas rápidas
DROP INDEX IF EXISTS idx_users_username_lower;
CREATE INDEX idx_users_username_lower ON users (LOWER(username));
