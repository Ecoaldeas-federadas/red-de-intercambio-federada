-- Migracion 157: Tabla user_sponsorships para trazabilidad de apadrinamiento de usuarios
--
-- Equivalente a federation_sponsorships pero para usuarios dentro de un nodo.
-- Registra: quien apadrina, a quien, cuanto se retiene, y el estado (active/released/defaulted).
--
-- Ademas pobla la tabla desde los datos existentes en users.sponsored_by y
-- users.sponsor_amount_held (creados por la migracion 154).

CREATE TABLE IF NOT EXISTS user_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sponsored_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_held BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, released, defaulted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  UNIQUE(sponsor_id, sponsored_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sponsorships_sponsor
    ON user_sponsorships(sponsor_id, status);
CREATE INDEX IF NOT EXISTS idx_user_sponsorships_sponsored
    ON user_sponsorships(sponsored_id, status);

-- Poblar desde datos existentes en users (migracion 154)
-- Solo crear registros para usuarios que tienen sponsored_by y sponsor_amount_held > 0
INSERT INTO user_sponsorships (sponsor_id, sponsored_id, amount_held, status, created_at)
SELECT sponsored_by, id, sponsor_amount_held, 'active', created_at
FROM users
WHERE sponsored_by IS NOT NULL AND sponsor_amount_held > 0
ON CONFLICT (sponsor_id, sponsored_id) DO NOTHING;
