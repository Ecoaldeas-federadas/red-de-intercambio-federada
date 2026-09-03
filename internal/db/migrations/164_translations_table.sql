-- Migracion 164: Tabla translations
-- Overrides de traducciones por nodo.
-- Las traducciones default vienen en archivos JSON del frontend.
-- Esta tabla permite editar traducciones desde la web sin tocar codigo.

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'common',
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  node_domain TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  UNIQUE(key, namespace, language, node_domain)
);

CREATE INDEX IF NOT EXISTS idx_translations_lang_ns
  ON translations(language, namespace);

CREATE INDEX IF NOT EXISTS idx_translations_node
  ON translations(node_domain);
