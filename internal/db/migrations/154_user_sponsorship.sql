-- Migracion 154: Apadrinamiento de usuarios + asegurar columnas de admission_requests
--
-- Problema: Hay dos definiciones de admission_requests (migracion 001 y 013)
-- con columnas diferentes. El query de ListAdmissionRequests selecciona columnas
-- que pueden no existir si la tabla se creo con la migracion 013.
--
-- Esta migracion:
-- 1. Agrega las columnas faltantes de admission_requests si no existen
-- 2. Agrega columnas de apadrinamiento (sponsored_by, sponsor_amount_held)
-- 3. Agrega sponsored_by a users para vincular padrino-ahijado

-- ===== Asegurar columnas de admission_requests =====
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS proposed_username TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS proposed_level TEXT DEFAULT 'new';
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS contact_info JSONB;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS created_user_id UUID REFERENCES users(id);

-- ===== Apadrinamiento: columnas nuevas en admission_requests =====
-- El padrino es el miembro que invita/apadrina al solicitante
-- sponsor_amount_held es cuanto del limite del padrino se retiene para el ahijado
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS sponsored_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS sponsor_amount_held BIGINT NOT NULL DEFAULT 0;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS requested_credit_limit BIGINT NOT NULL DEFAULT 0;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS requested_debit_limit BIGINT NOT NULL DEFAULT 0;

-- ===== Apadrinamiento: columna en users =====
-- Vincula al usuario con su padrino (quien lo apadrino al entrar)
ALTER TABLE users ADD COLUMN IF NOT EXISTS sponsored_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sponsor_amount_held BIGINT NOT NULL DEFAULT 0;

-- Indice para buscar solicitudes por padrino
CREATE INDEX IF NOT EXISTS idx_admission_requests_sponsored_by
    ON admission_requests(sponsored_by) WHERE sponsored_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_sponsored_by
    ON users(sponsored_by) WHERE sponsored_by IS NOT NULL;
