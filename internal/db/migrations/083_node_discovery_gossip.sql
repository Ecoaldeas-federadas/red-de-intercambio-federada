-- Migracion 083: Descubrimiento de nodos por gossip (chisme) + solicitudes de federacion
--
-- Permite que los nodos compartan su lista de nodos descubiertos
-- con otros nodos, sin necesidad de estar federados directamente.
--
-- Como funciona:
-- 1. Cada nodo mantiene una lista de nodos conocidos (federation_known_nodes)
-- 2. Periodicamente, cada nodo comparte su lista con sus peers directos
-- 3. Los peers reciben la lista y agregan los nodos nuevos como descubiertos
-- 4. Periodicamente, cada nodo verifica si los nodos descubiertos estan activos
-- 5. Si un nodo no responde despues de varios intentos, se marca como inactivo
-- 6. Periodicamente, la lista de inactivos se limpia (configurable por nodo)
--
-- Ademas, los nodos pueden enviar solicitudes de federacion a otros nodos
-- descubiertos, sin necesidad de compartir claves publicas primero.
-- La solicitud incluye informacion de contacto para que el otro nodo responda.

-- Agregar columnas a federation_known_nodes
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS is_inactive BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS failed_checks INT NOT NULL DEFAULT 0;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS contact_info TEXT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS node_type TEXT;

-- Tabla de configuracion de descubrimiento por nodo
CREATE TABLE IF NOT EXISTS node_discovery_config (
  node_domain VARCHAR(128) PRIMARY KEY,
  -- Cada cuanto compartir la lista de nodos conocidos con los peers (en horas)
  discovery_interval_hours INT NOT NULL DEFAULT 24,
  -- Cada cuanto verificar si los nodos descubiertos estan activos (en horas)
  health_check_interval_hours INT NOT NULL DEFAULT 168,
  -- Cada cuanto limpiar la lista de nodos inactivos (en dias)
  inactive_cleanup_interval_days INT NOT NULL DEFAULT 365,
  -- Cuantos intentos fallidos antes de marcar un nodo como inactivo
  max_failed_checks INT NOT NULL DEFAULT 3,
  -- Ultima vez que se compartio la lista de nodos
  last_discovery_sync TIMESTAMPTZ,
  -- Ultima vez que se verifico la salud de los nodos
  last_health_check TIMESTAMPTZ,
  -- Ultima vez que se limpio la lista de inactivos
  last_inactive_cleanup TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitudes de federacion entre nodos
-- Una solicitud es un mensaje de "me gustaria federar contigo"
-- que se envia via HTTP al endpoint publico del otro nodo
CREATE TABLE IF NOT EXISTS federation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Direccion de la solicitud: incoming = recibida, outgoing = enviada
  direction VARCHAR(10) NOT NULL, -- 'incoming' o 'outgoing'
  -- Nodo que envia la solicitud
  from_node_domain VARCHAR(128) NOT NULL,
  from_node_name VARCHAR(128),
  -- Nodo que recibe la solicitud
  to_node_domain VARCHAR(128) NOT NULL,
  -- Mensaje de la solicitud
  message TEXT,
  -- Informacion de contacto de quien envia
  contact_info TEXT,
  -- Estado: pending, accepted, rejected, expired
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Respuesta del nodo receptor (cuando acepta o rechaza)
  response_message TEXT,
  -- Informacion de contacto de quien responde (cuando acepta)
  response_contact TEXT,
  -- Clave publica para federar (cuando acepta)
  response_public_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(from_node_domain, to_node_domain, direction)
);

-- Indice para buscar nodos inactivos rapidamente
CREATE INDEX IF NOT EXISTS idx_federation_known_nodes_inactive
  ON federation_known_nodes (is_inactive) WHERE is_inactive = true;

CREATE INDEX IF NOT EXISTS idx_federation_known_nodes_last_checked
  ON federation_known_nodes (last_checked);

CREATE INDEX IF NOT EXISTS idx_federation_requests_status
  ON federation_requests (status, direction);

-- Agregar campos de descripcion y contacto de federacion a node_config
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS federation_contact TEXT;

