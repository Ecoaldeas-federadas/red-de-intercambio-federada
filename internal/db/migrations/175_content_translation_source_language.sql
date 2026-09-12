-- Migracion 175: idioma original por nodo para fuentes de traduccion.
--
-- 173 se ejecuta tambien en instalaciones que ya tienen varios nodos. La
-- funcion debe tomar el idioma principal del nodo propietario, nunca el del
-- usuario que abre el editor de traducciones.

CREATE OR REPLACE FUNCTION upsert_content_translation_source(
  p_node_domain TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_field_name TEXT,
  p_source_language VARCHAR(10),
  p_source_text TEXT,
  p_context JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT AS $$
DECLARE
  v_key TEXT;
  v_text TEXT;
  v_node_domain TEXT;
  v_source_language VARCHAR(10);
BEGIN
  v_key := p_entity_type || ':' || p_entity_id || ':' || p_field_name;
  v_text := COALESCE(p_source_text, '');
  v_node_domain := COALESCE(NULLIF(p_node_domain, ''), '__GLOBAL__');
  v_source_language := COALESCE(
    NULLIF((SELECT default_language FROM node_config WHERE node_domain = v_node_domain LIMIT 1), ''),
    NULLIF(p_source_language, ''),
    'es'
  );

  INSERT INTO content_translation_sources (
    translation_key, node_domain, entity_type, entity_id, field_name,
    source_language, source_text, source_hash, context, is_active, updated_at
  ) VALUES (
    v_key, v_node_domain, p_entity_type, p_entity_id, p_field_name,
    v_source_language, v_text, md5(v_text), COALESCE(p_context, '{}'::jsonb), true, NOW()
  )
  ON CONFLICT (translation_key) DO UPDATE SET
    node_domain = EXCLUDED.node_domain,
    source_language = EXCLUDED.source_language,
    source_text = EXCLUDED.source_text,
    source_hash = EXCLUDED.source_hash,
    context = EXCLUDED.context,
    is_active = true,
    updated_at = CASE
      WHEN content_translation_sources.source_text IS DISTINCT FROM EXCLUDED.source_text
        THEN NOW()
      ELSE content_translation_sources.updated_at
    END;

  RETURN v_key;
END;
$$ LANGUAGE plpgsql;

-- Recalcular el idioma de fuentes no globales ya existentes. No toca el texto,
-- hash ni traducciones; solo corrige el metadato de origen.
UPDATE content_translation_sources s
SET source_language = nc.default_language
FROM node_config nc
WHERE s.node_domain = nc.node_domain
  AND COALESCE(nc.default_language, '') <> ''
  AND s.source_language IS DISTINCT FROM nc.default_language;
