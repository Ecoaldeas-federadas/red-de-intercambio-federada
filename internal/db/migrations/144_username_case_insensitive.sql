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

-- Paso 1: Normalizar usernames existentes a minúsculas
-- Si hay duplicados después de lower() (ej: "Admin" y "admin"), mantener el más antiguo
UPDATE users SET username = LOWER(username)
WHERE username != LOWER(username)
  AND id = (
    SELECT MIN(id) FROM users u2
    WHERE LOWER(u2.username) = LOWER(users.username)
      AND u2.node_domain = users.node_domain
  );

-- Eliminar duplicados que queden (mantener el de menor id)
DELETE FROM users
WHERE id NOT IN (
  SELECT MIN(id) FROM users GROUP BY LOWER(username), node_domain
)
AND username != LOWER(username);

-- Asegurar que todos queden en minúsculas
UPDATE users SET username = LOWER(username) WHERE username != LOWER(username);

-- Paso 2: Crear índice único case-insensitive
-- Esto previene que se creen dos usuarios con el mismo nombre ignorando mayúsculas
DROP INDEX IF EXISTS users_username_node_domain_lower_uniq;
CREATE UNIQUE INDEX users_username_node_domain_lower_uniq
  ON users (LOWER(username), node_domain);

-- Paso 3: Índice regular para búsquedas rápidas (opcional, el único ya sirve)
DROP INDEX IF EXISTS idx_users_username_lower;
CREATE INDEX idx_users_username_lower ON users (LOWER(username));
