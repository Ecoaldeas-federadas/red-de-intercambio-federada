-- 065_public_proposals.sql

-- Propuestas publicas para mejorar el sistema
-- Cualquier persona puede proponer y votar (sin necesidad de cuenta)
CREATE TABLE IF NOT EXISTS public_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'funcionalidad',
    author_name TEXT DEFAULT 'Anonimo',
    author_email TEXT DEFAULT '',
    votes INT DEFAULT 0,
    status TEXT DEFAULT 'open', -- open, under_review, implemented, rejected
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_proposals_status ON public_proposals(status);
CREATE INDEX IF NOT EXISTS idx_public_proposals_votes ON public_proposals(votes DESC);

-- Votos individuales (para evitar doble voto por IP/sesion)
CREATE TABLE IF NOT EXISTS public_proposal_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public_proposals(id) ON DELETE CASCADE,
    voter_ip TEXT DEFAULT '',
    voter_session TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, voter_session)
);

-- Configuracion del usuario demo
CREATE TABLE IF NOT EXISTS demo_user_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT false,
    username TEXT DEFAULT 'demo',
    password_hash TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar config por defecto (deshabilitado)
INSERT INTO demo_user_config (is_enabled) VALUES (false) ON CONFLICT DO NOTHING;
