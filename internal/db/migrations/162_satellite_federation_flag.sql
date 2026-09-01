-- Migracion 162: Flag is_satellite en federation keys
--
-- Permite distinguir los peers que son satelites de los nodos federados
-- normales. Los satelites no tienen voz ni voto en la federacion.

ALTER TABLE node_federation_keys ADD COLUMN IF NOT EXISTS is_satellite BOOLEAN NOT NULL DEFAULT false;
