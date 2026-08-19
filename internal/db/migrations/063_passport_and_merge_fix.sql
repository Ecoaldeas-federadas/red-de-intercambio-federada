-- 063_passport_and_merge_fix.sql

-- Pasaporte: documento de identidad internacional separado del ID nacional
-- No todos tienen pasaporte, pero los que lo tienen pueden validarse por el
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_country TEXT DEFAULT '';

-- Indice para busqueda por pasaporte
CREATE INDEX IF NOT EXISTS idx_users_passport ON users(passport_number) WHERE passport_number <> '';

-- Tambien en admission_requests
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS passport_number TEXT DEFAULT '';
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS passport_country TEXT DEFAULT '';

-- Anadir campos de pasaporte a node_merge_conflicts
ALTER TABLE node_merge_conflicts ADD COLUMN IF NOT EXISTS passport_number TEXT DEFAULT '';
ALTER TABLE node_merge_conflicts ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'national_id'; -- national_id, passport, both
