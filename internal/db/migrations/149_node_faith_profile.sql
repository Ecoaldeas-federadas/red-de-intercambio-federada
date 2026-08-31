-- Migracion 149: Perfil religioso/filosofico del NODO (no por organizacion)
--
-- El perfil religioso/filosofico es del nodo completo, no de cada organizacion.
-- Un nodo tiene una politica hacia otros nodos federados.
-- Cuando se selecciona un perfil (ej: Adventista), los productos prohibidos
-- (alcohol, tabaco, cerdo, cafe) se marcan automaticamente como no permitidos.

ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS faith_profile VARCHAR(50) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS faith_description TEXT DEFAULT '';
