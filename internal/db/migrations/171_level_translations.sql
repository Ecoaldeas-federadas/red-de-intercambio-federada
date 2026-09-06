-- Migracion 171: Traducciones de niveles de miembro y organizacion
--
-- Permite que los nombres y descripciones de los niveles de miembro
-- y niveles de organizacion tengan traducciones en multiples idiomas.
-- Las tablas originales mantienen los datos por defecto (español),
-- y estas nuevas tablas guardan las traducciones por idioma.

-- 1. Traducciones de niveles de miembro
CREATE TABLE IF NOT EXISTS member_level_translations (
  id SERIAL PRIMARY KEY,
  level_id UUID REFERENCES member_levels(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level_id, language)
);

CREATE INDEX IF NOT EXISTS idx_member_level_translations_level
  ON member_level_translations (level_id);
CREATE INDEX IF NOT EXISTS idx_member_level_translations_lang
  ON member_level_translations (language);

-- 2. Traducciones de niveles de organizacion
CREATE TABLE IF NOT EXISTS organization_level_translations (
  id SERIAL PRIMARY KEY,
  level_id UUID REFERENCES organization_levels(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level_id, language)
);

CREATE INDEX IF NOT EXISTS idx_org_level_translations_level
  ON organization_level_translations (level_id);
CREATE INDEX IF NOT EXISTS idx_org_level_translations_lang
  ON organization_level_translations (language);

-- 3. Migrar contenido existente al idioma por defecto del nodo
DO $$
DECLARE
  default_lang VARCHAR(10) := 'es';
  lvl RECORD;
BEGIN
  BEGIN
    SELECT COALESCE(default_language, 'es') INTO default_lang
    FROM node_config LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_lang := 'es';
  END;

  -- Migrar niveles de miembro
  FOR lvl IN SELECT id, name, COALESCE(description, '') AS description FROM member_levels LOOP
    INSERT INTO member_level_translations (level_id, language, name, description)
    VALUES (lvl.id, default_lang, lvl.name, lvl.description)
    ON CONFLICT (level_id, language) DO NOTHING;
  END LOOP;

  -- Migrar niveles de organizacion
  FOR lvl IN SELECT id, name, COALESCE(description, '') AS description FROM organization_levels LOOP
    INSERT INTO organization_level_translations (level_id, language, name, description)
    VALUES (lvl.id, default_lang, lvl.name, lvl.description)
    ON CONFLICT (level_id, language) DO NOTHING;
  END LOOP;
END $$;
