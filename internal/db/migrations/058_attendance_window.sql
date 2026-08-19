-- Migracion 058: Ventana de anticipacion para registrar asistencia
--
-- Anade un campo configurable a assembly_frequency_config para indicar
-- cuantas horas antes de la asamblea se puede empezar a registrar asistencia.
-- Por defecto 1 hora antes.
-- Antes de esa ventana, la sesion esta 'programada' y no se pueden hacer
-- acciones de quorum, asistencia, cerrar, etc.

ALTER TABLE assembly_frequency_config ADD COLUMN IF NOT EXISTS attendance_window_hours INT NOT NULL DEFAULT 1;

-- Mismo campo para sesiones scoped (config de org/depto)
-- Ya que usan la misma tabla assembly_frequency_config con scope='organization' o 'department'
