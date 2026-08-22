-- Migracion 084: Corregir descubrimiento de nodos
--
-- Cambios importantes:
-- 1. La federacion NO se hace aceptando/rechazando en el sistema.
--    La clave publica se comparte personalmente entre personas.
--    El sistema solo muestra info de contacto (pais, ubicacion, gobernanza, web)
--    para que la gente se contacte fisicamente.
-- 2. Un nodo inactivo se decide por CONSENSO de toda la red, no por un solo nodo.
--    Si tu no puedes conectar, puede ser que tu no tengas internet.
--    Hay que preguntar a los demas nodos. Solo cuando todos reportan
--    que no pueden conectar, se marca inactivo.
-- 3. Los nodos inactivos se ocultan de la lista visible pero se mantienen
--    internamente para seguir consultando si reaparecen.
-- 4. Los nodos federados offline no se eliminan - solo se muestran como "offline".

-- Agregar pais y ubicacion a federation_known_nodes
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS governance_url TEXT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS admission_url TEXT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS member_count INT;
ALTER TABLE federation_known_nodes ADD COLUMN IF NOT EXISTS peer_count INT;

-- Agregar pais y ubicacion a node_config (para que el nodo diga donde esta)
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Tabla de reportes de salud entre nodos (consensus)
-- Cuando un nodo no puede conectar con otro, registra un reporte.
-- Otros nodos consultan los reportes para saber si TODOS reportan
-- que no pueden conectar, no solo uno.
CREATE TABLE IF NOT EXISTS node_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nodo que hace el reporte
  reporter_node VARCHAR(128) NOT NULL,
  -- Nodo que se verifica
  target_node VARCHAR(128) NOT NULL,
  -- true = el reporter pudo conectar con target, false = no pudo
  reachable BOOLEAN NOT NULL,
  -- Cuando se hizo el check
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Fecha del check (sin hora) para unique constraint
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Unique: un reportero solo reporta una vez por dia por nodo
  UNIQUE(reporter_node, target_node, check_date)
);

-- Indice para buscar reportes de un nodo target
CREATE INDEX IF NOT EXISTS idx_node_health_reports_target
  ON node_health_reports (target_node, checked_at DESC);

-- Indice para buscar reportes recientes
CREATE INDEX IF NOT EXISTS idx_node_health_reports_recent
  ON node_health_reports (checked_at DESC);

-- Quitar response_public_key de federation_requests
-- (la clave publica NO se comparte por el sistema, se comparte personalmente)
ALTER TABLE federation_requests DROP COLUMN IF EXISTS response_public_key;

-- Agregar campos de info de contacto a federation_requests
ALTER TABLE federation_requests ADD COLUMN IF NOT EXISTS from_country VARCHAR(100);
ALTER TABLE federation_requests ADD COLUMN IF NOT EXISTS from_location VARCHAR(255);
ALTER TABLE federation_requests ADD COLUMN IF NOT EXISTS from_governance_url TEXT;
