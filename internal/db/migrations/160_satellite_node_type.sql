-- Migracion 160: Tipo de nodo (standard vs satellite)
--
-- node_type = 'standard': nodo normal con asamblea, miembros, gobernanza
-- node_type = 'satellite': nodo portatil para ferias sin señal.
--   Sin asamblea, sin miembros, sin votaciones.
--   Cachea usuarios/saldos de otros nodos y procesa pagos offline.

ALTER TABLE node_config ADD COLUMN IF NOT EXISTS node_type VARCHAR(20) NOT NULL DEFAULT 'standard';
