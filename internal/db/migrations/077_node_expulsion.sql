-- Migracion 077: Expulsion de nodos de la federacion
--
-- Permite que la federacion vote para expulsar un nodo con mal comportamiento
-- (por ejemplo, un nodo que se niega a votar y bloquea cambios).
--
-- Proceso:
-- 1. Un nodo propone expulsar a otro (propuesta tipo 'expel_node')
-- 2. Todos los nodos votan (bajo el umbral actual, default 100%)
-- 3. Si se aprueba, el nodo expulsado se marca como 'expelled'
-- 4. El nodo expulsado no puede participar en la federacion
-- 5. Para volver a entrar, debe solicitar ingreso nuevamente
-- 6. Al reingresar, hereda automaticamente todas las reglas existentes

-- Registro de nodos expulsados
CREATE TABLE IF NOT EXISTS federation_expelled_nodes (
  node_domain VARCHAR(128) PRIMARY KEY,    -- dominio del nodo expulsado
  expelled_by_proposal UUID,               -- propuesta que aprobo la expulsion
  reason TEXT,                             -- razon de la expulsion
  expelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Si se permite reingreso despues de un tiempo (null = no permitido)
  reentry_allowed_at TIMESTAMPTZ
);

-- Registro de nodos conocidos en la red federada
-- No solo los peers directos, sino todos los nodos de la red
-- (descubiertos via gossip/propagacion)
CREATE TABLE IF NOT EXISTS federation_known_nodes (
  node_domain VARCHAR(128) PRIMARY KEY,    -- dominio del nodo
  node_name VARCHAR(128),                  -- nombre descriptivo
  discovered_via VARCHAR(128),             -- a traves de que nodo se descubrio
  is_direct_peer BOOLEAN NOT NULL DEFAULT false,  -- true si es peer directo
  is_expelled BOOLEAN NOT NULL DEFAULT false,     -- true si fue expulsado
  node_number INT,                         -- numero de nodo SIP (si tiene)
  last_seen TIMESTAMPTZ,                   -- ultima vez que se supo de el
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar este nodo como conocido
-- (Se hace desde el backend, no aqui, para no hardcodear el dominio)
