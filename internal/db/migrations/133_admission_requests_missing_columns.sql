-- Migracion 133: Anadir columnas faltantes a admission_requests
--
-- Problema: La migracion 001 crea admission_requests con columnas legacy
-- (proposed_username, display_name, contact_info, etc.), y la migracion 013
-- intenta crear la tabla con full_name, email, phone, etc. pero usa
-- CREATE TABLE IF NOT EXISTS, por lo que no hace nada si la tabla ya existe.
--
-- El codigo backend (internal/api/system.go) usa full_name, email, phone,
-- location, reason, skills, how_heard, custom_fields que no existen en la
-- tabla creada por la migracion 001.
--
-- Esta migracion anade las columnas faltantes con ADD COLUMN IF NOT EXISTS.

ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS how_heard TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS custom_fields JSONB;

-- Migrar datos existentes: si full_name esta vacio pero display_name tiene valor,
-- copiar display_name a full_name.
UPDATE admission_requests
SET full_name = display_name
WHERE full_name IS NULL OR full_name = ''
  AND display_name IS NOT NULL AND display_name != '';

-- Hacer full_name NOT NULL despues de migrar los datos existentes.
-- Si hay filas sin full_name ni display_name, se les asigna un placeholder.
UPDATE admission_requests
SET full_name = 'Sin nombre'
WHERE full_name IS NULL OR full_name = '';

ALTER TABLE admission_requests ALTER COLUMN full_name SET NOT NULL;
