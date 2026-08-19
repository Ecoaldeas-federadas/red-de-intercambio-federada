-- Migracion 050: Tiempo limite de votacion
--
-- Las propuestas de asamblea ahora tienen un deadline para votar.
-- Se elige al crear la propuesta:
--   - 5 minutos (votacion en asamblea presencial)
--   - 10 minutos (votacion en asamblea presencial)
--   - 1 hora (discusion extendida)
--   - 24 horas (votacion remota, gente vota desde casa)
--   - 7 dias (consulta prolongada)
--
-- Cuando se vence el tiempo:
--   - Si no se ejecuto manualmente, se marca como 'expired'
--   - No se puede ejecutar ni votar mas
--   - Para revotar hay que crear una propuesta nueva

ALTER TABLE assembly_decisions ADD COLUMN IF NOT EXISTS voting_deadline TIMESTAMPTZ;
ALTER TABLE assembly_decisions ADD COLUMN IF NOT EXISTS voting_duration_minutes INT;

-- Las propuestas existentes sin deadline se marcan como expiradas
-- para que no queden pendientes indefinidamente
UPDATE assembly_decisions
SET voting_deadline = created_at + INTERVAL '7 days'
WHERE voting_deadline IS NULL AND status = 'pending';
