-- 060_quiet_hours.sql
-- Horas silenciosas por usuario para notificaciones
-- El usuario puede configurar un rango de horas durante las cuales
-- no se le enviaran notificaciones por pasarelas externas (email, telegram, etc.)
-- Las notificaciones in_app (campana) siempre se entregan.

ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_start INT;  -- 0-23, null = sin quiet hours
ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_end INT;    -- 0-23, null = sin quiet hours

-- Comentario para documentacion
COMMENT ON COLUMN users.quiet_hours_start IS 'Hora de inicio de horas silenciosas (0-23). NULL = desactivado';
COMMENT ON COLUMN users.quiet_hours_end IS 'Hora de fin de horas silenciosas (0-23). NULL = desactivado';
