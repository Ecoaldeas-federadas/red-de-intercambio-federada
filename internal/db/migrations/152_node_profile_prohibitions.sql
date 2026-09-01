-- Migracion 152: Perfiles de nodo dinamicos + prohibiciones de productos compartidas via federation
--
-- Permite que los nodos federados que comparten un mismo perfil religioso/filosofico
-- (adventista, ISKCON, halal, etc.) compartan automaticamente las prohibiciones de
-- productos entre ellos, sin necesidad de configuracion manual en cada nodo.

-- 1. Perfiles de fe dinamicos (compartidos via federation)
CREATE TABLE IF NOT EXISTS node_faith_profiles (
    id TEXT PRIMARY KEY,                          -- ej: "adventista", "adventista_reforma"
    name TEXT NOT NULL,                           -- ej: "Adventista Reforma"
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'custom',      -- cristiana, hindu, islamica, judia, budista, rastafari, secular, custom
    icon TEXT NOT NULL DEFAULT 'globe',
    default_rules TEXT NOT NULL DEFAULT '',       -- reglas base por categoria (ej: "sin carne, sin alcohol")
    created_by TEXT NOT NULL DEFAULT 'system',    -- node_domain del creador, o 'system' para oficiales
    is_shared BOOLEAN NOT NULL DEFAULT true,      -- si se comparte via federation
    is_official BOOLEAN NOT NULL DEFAULT false,   -- si es un perfil oficial (creado por desarrolladores)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Configuracion de cada nodo respecto a su perfil
CREATE TABLE IF NOT EXISTS node_profile_settings (
    node_domain TEXT PRIMARY KEY,
    faith_profile TEXT NOT NULL DEFAULT '',       -- referencia a node_faith_profiles.id
    auto_approve_prohibitions BOOLEAN NOT NULL DEFAULT false,  -- auto-aprueba prohibiciones de peers
    receive_peer_prohibitions BOOLEAN NOT NULL DEFAULT true,   -- recibe prohibiciones de peers
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Prohibiciones de productos especificos por perfil (compartidas via federation)
CREATE TABLE IF NOT EXISTS profile_product_prohibitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    profile_id TEXT NOT NULL,                     -- referencia a node_faith_profiles.id
    product_name TEXT NOT NULL,                   -- nombre del producto (match entre nodos)
    product_category TEXT,                        -- categoria opcional (ej: "carne", "bebida")
    reason TEXT,                                  -- razon de la prohibicion (ej: "contiene cerdo")
    reported_by TEXT NOT NULL,                    -- nodo que reporto la prohibicion
    approval_status TEXT NOT NULL DEFAULT 'approved',  -- approved, pending, rejected
    auto_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_domain, profile_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_profile_prohibitions_domain
    ON profile_product_prohibitions (node_domain, profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_prohibitions_status
    ON profile_product_prohibitions (node_domain, approval_status);

-- 4. Cola de prohibiciones recibidas de peers, pendientes de aprobacion manual
CREATE TABLE IF NOT EXISTS profile_product_prohibition_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_category TEXT,
    reason TEXT,
    reported_by TEXT NOT NULL,                    -- nodo que reporto
    status TEXT NOT NULL DEFAULT 'pending',       -- pending, approved, rejected
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,                             -- usuario admin que reviso
    UNIQUE(node_domain, profile_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_prohibition_queue_pending
    ON profile_product_prohibition_queue (node_domain, status);

-- 5. Insertar perfiles oficiales (hardcodeados anteriormente en el frontend)
INSERT INTO node_faith_profiles (id, name, description, category, icon, default_rules, created_by, is_official) VALUES
    ('adventista', 'Adventista', 'Adventistas del Septimo Dia. Sin alcohol, tabaco, cerdo, cafe.', 'cristiana', 'book-open', 'Sin alcohol, tabaco, cerdo, cafe', 'system', true),
    ('iskcon', 'ISKCON', 'Conciencia de Krishna. Sin carne, huevo, ajo, cebolla, cafe, alcohol.', 'hindu', 'flower', 'Sin carne, huevo, ajo, cebolla, cafe, alcohol', 'system', true),
    ('plum_village', 'Plum Village', 'Budismo de Thich Nhat Hanh. Sin carne, pescado, alcohol.', 'budista', 'leaf', 'Sin carne, pescado, alcohol', 'system', true),
    ('halal', 'Halal Islamico', 'Dieta halal. Sin alcohol, cerdo, carne no-halal.', 'islamica', 'moon', 'Sin alcohol, cerdo, carne no-halal', 'system', true),
    ('kosher', 'Kosher Judio', 'Dieta kosher. Sin cerdo, mariscos, mezcla carne+leche.', 'judia', 'star', 'Sin cerdo, mariscos, mezcla carne+leche', 'system', true),
    ('jain', 'Jain', 'Jainismo. Sin carne, huevo, raices, ajo, cebolla.', 'hindu', 'sprout', 'Sin carne, huevo, raices, ajo, cebolla', 'system', true),
    ('vegano', 'Vegano secular', 'Veganismo secular. Sin carne, lacteos, huevos, miel.', 'secular', 'leaf', 'Sin carne, lacteos, huevos, miel', 'system', true),
    ('ital', 'Ital Rastafari', 'Ital Rastafari. Sin carne, sal, quimicos procesados.', 'rastafari', 'flame', 'Sin carne, sal, quimicos procesados', 'system', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Migrar faith_profile existente de public_settings a node_profile_settings
INSERT INTO node_profile_settings (node_domain, faith_profile)
SELECT node_domain, faith_profile
FROM public_settings
WHERE faith_profile IS NOT NULL AND faith_profile != ''
ON CONFLICT (node_domain) DO NOTHING;

-- 7. Asegurar que todos los nodos tengan una fila en node_profile_settings
INSERT INTO node_profile_settings (node_domain)
SELECT DISTINCT node_domain FROM public_settings
ON CONFLICT (node_domain) DO NOTHING;
