-- Migracion 173: Registro unificado de contenido traducible
--
-- Las tablas anteriores de traduccion se conservan para compatibilidad.
-- Este registro permite que cualquier texto visible almacenado en la BD tenga
-- una clave estable, traducciones por idioma, deteccion de cambios e historial.

CREATE TABLE IF NOT EXISTS content_translation_sources (
  translation_key TEXT PRIMARY KEY,
  node_domain TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  source_language VARCHAR(10) NOT NULL,
  source_text TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL DEFAULT '',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, entity_type, entity_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_content_translation_sources_node
  ON content_translation_sources(node_domain, entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_content_translation_sources_entity
  ON content_translation_sources(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_translation_sources_hash
  ON content_translation_sources(source_hash);

CREATE TABLE IF NOT EXISTS content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_key TEXT NOT NULL REFERENCES content_translation_sources(translation_key) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL DEFAULT '',
  translated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(translation_key, language)
);

CREATE INDEX IF NOT EXISTS idx_content_translations_language
  ON content_translations(language, translation_key);
CREATE INDEX IF NOT EXISTS idx_content_translations_translator
  ON content_translations(translated_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_translation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_key TEXT NOT NULL,
  language VARCHAR(10) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source_hash TEXT NOT NULL DEFAULT '',
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_translation_history_key
  ON content_translation_history(translation_key, language, changed_at DESC);

-- Taxonomia estable: los filtros conservan el valor base y muestran label traducido.
CREATE TABLE IF NOT EXISTS product_taxonomy_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('parent', 'category', 'subcategory')),
  parent_source_value TEXT NOT NULL DEFAULT '',
  source_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, level, parent_source_value, source_value)
);

CREATE INDEX IF NOT EXISTS idx_product_taxonomy_terms_lookup
  ON product_taxonomy_terms(node_domain, level, parent_source_value, is_active);

-- Registrar o actualizar una fuente sin borrar sus traducciones. Si cambia el
-- original, source_hash cambia y las traducciones anteriores quedan stale.
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
  v_source_language VARCHAR(10);
BEGIN
  v_key := p_entity_type || ':' || p_entity_id || ':' || p_field_name;
  v_text := COALESCE(p_source_text, '');
  v_source_language := COALESCE(
    NULLIF((SELECT default_language FROM node_config WHERE node_domain = p_node_domain LIMIT 1), ''),
    NULLIF(p_source_language, ''),
    'es'
  );

  INSERT INTO content_translation_sources (
    translation_key, node_domain, entity_type, entity_id, field_name,
    source_language, source_text, source_hash, context, is_active, updated_at
  ) VALUES (
    v_key, COALESCE(NULLIF(p_node_domain, ''), '__GLOBAL__'), p_entity_type,
    p_entity_id, p_field_name, v_source_language,
    v_text, md5(v_text), COALESCE(p_context, '{}'::jsonb), true, NOW()
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

-- Historial automatico de traducciones.
CREATE OR REPLACE FUNCTION audit_content_translation_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value
     AND OLD.source_hash IS NOT DISTINCT FROM NEW.source_hash THEN
    RETURN NEW;
  END IF;

  INSERT INTO content_translation_history (
    translation_key, language, old_value, new_value, source_hash, changed_by
  ) VALUES (
    NEW.translation_key,
    NEW.language,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
    NEW.value,
    NEW.source_hash,
    NEW.translated_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_content_translation ON content_translations;
CREATE TRIGGER trg_audit_content_translation
AFTER INSERT OR UPDATE ON content_translations
FOR EACH ROW EXECUTE FUNCTION audit_content_translation_change();

-- Idioma principal global usado para el backfill. La resolucion por nodo se
-- realiza en la aplicacion; aqui se conserva el idioma configurado actual.
DO $$
DECLARE
  default_lang VARCHAR(10) := 'es';
  rec RECORD;
  tr RECORD;
  source_key TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT code FROM languages WHERE is_default = true LIMIT 1),
    (SELECT default_language FROM node_config WHERE initialized = true LIMIT 1),
    'es'
  ) INTO default_lang;

  -- Paginas publicas.
  FOR rec IN SELECT id::text AS id, node_domain, title, COALESCE(subtitle, '') AS subtitle, content FROM public_pages LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_page', rec.id, 'title', default_lang, rec.title, jsonb_build_object('label', rec.title));
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_page', rec.id, 'subtitle', default_lang, rec.subtitle, jsonb_build_object('label', rec.title));
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_page', rec.id, 'content', default_lang, rec.content, jsonb_build_object('label', rec.title, 'editor', 'page'));
  END LOOP;

  -- Ajustes publicos y formulario de admision.
  FOR rec IN SELECT node_domain, site_title, COALESCE(site_subtitle, '') AS site_subtitle,
                    COALESCE(announcement_text, '') AS announcement_text,
                    COALESCE(contact_address, '') AS contact_address,
                    COALESCE(footer_about, '') AS footer_about,
                    COALESCE(footer_schedule, '') AS footer_schedule,
                    COALESCE(footer_col1_title, '') AS footer_col1_title,
                    COALESCE(footer_col2_title, '') AS footer_col2_title,
                    COALESCE(footer_col3_title, '') AS footer_col3_title,
                    COALESCE(footer_col4_title, '') AS footer_col4_title,
                    COALESCE(footer_slogan, '') AS footer_slogan,
                    COALESCE(footer_admission_text, '') AS footer_admission_text,
                    COALESCE(admission_form_title, '') AS admission_form_title,
                    COALESCE(admission_form_subtitle, '') AS admission_form_subtitle,
                    COALESCE(admission_form_schema::text, '[]') AS admission_form_schema
             FROM public_settings LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'site_title', default_lang, rec.site_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'site_subtitle', default_lang, rec.site_subtitle);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'announcement_text', default_lang, rec.announcement_text);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'contact_address', default_lang, rec.contact_address);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_about', default_lang, rec.footer_about);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_schedule', default_lang, rec.footer_schedule);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_col1_title', default_lang, rec.footer_col1_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_col2_title', default_lang, rec.footer_col2_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_col3_title', default_lang, rec.footer_col3_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_col4_title', default_lang, rec.footer_col4_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_slogan', default_lang, rec.footer_slogan);
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'footer_admission_text', default_lang, rec.footer_admission_text);
    PERFORM upsert_content_translation_source(rec.node_domain, 'admission_form', rec.node_domain, 'title', default_lang, rec.admission_form_title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'admission_form', rec.node_domain, 'subtitle', default_lang, rec.admission_form_subtitle);
    PERFORM upsert_content_translation_source(rec.node_domain, 'admission_form', rec.node_domain, 'schema', default_lang, rec.admission_form_schema, '{"editor":"admission_form"}'::jsonb);
  END LOOP;

  -- Niveles, reglas, calculadora, productos y configuraciones.
  FOR rec IN SELECT id, node_domain, name, COALESCE(description, '') AS description FROM member_levels LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'member_level', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'member_level', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description FROM organization_levels LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_level', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_level', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, title, COALESCE(description, '') AS description FROM governance_rules LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'governance_rule', rec.id, 'title', default_lang, rec.title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'governance_rule', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description FROM calculator_categories LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_category', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_category', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description,
                    COALESCE(subcategory, '') AS subcategory, COALESCE(unit, '') AS unit
             FROM calculator_parameters LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_parameter', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_parameter', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_parameter', rec.id, 'subcategory', default_lang, rec.subcategory);
    PERFORM upsert_content_translation_source(rec.node_domain, 'calculator_parameter', rec.id, 'unit', default_lang, rec.unit);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description,
                    COALESCE(badge, '') AS badge, COALESCE(unit, '') AS unit
             FROM products LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'product', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'product', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source(rec.node_domain, 'product', rec.id, 'badge', default_lang, rec.badge);
    PERFORM upsert_content_translation_source(rec.node_domain, 'product', rec.id, 'unit', default_lang, rec.unit);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, COALESCE(description, '') AS description FROM assembly_config LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_config', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT key, COALESCE(description, '') AS description FROM federation_constants LOOP
    PERFORM upsert_content_translation_source('__GLOBAL__', 'federation_constant', rec.key, 'description', default_lang, rec.description);
  END LOOP;

  -- Taxonomia actual de productos.
  INSERT INTO product_taxonomy_terms(node_domain, level, parent_source_value, source_value)
  SELECT DISTINCT node_domain, 'parent', '', parent_category
  FROM products WHERE COALESCE(parent_category, '') <> ''
  ON CONFLICT (node_domain, level, parent_source_value, source_value) DO NOTHING;

  INSERT INTO product_taxonomy_terms(node_domain, level, parent_source_value, source_value)
  SELECT DISTINCT node_domain, 'category', COALESCE(parent_category, ''), category
  FROM products WHERE COALESCE(category, '') <> ''
  ON CONFLICT (node_domain, level, parent_source_value, source_value) DO NOTHING;

  INSERT INTO product_taxonomy_terms(node_domain, level, parent_source_value, source_value)
  SELECT DISTINCT node_domain, 'subcategory', COALESCE(parent_category, '') || '|' || COALESCE(category, ''), subcategory
  FROM products WHERE COALESCE(subcategory, '') <> ''
  ON CONFLICT (node_domain, level, parent_source_value, source_value) DO NOTHING;

  FOR rec IN SELECT id::text AS id, node_domain, level, parent_source_value, source_value FROM product_taxonomy_terms LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'product_taxonomy', rec.id, 'label', default_lang, rec.source_value,
      jsonb_build_object('level', rec.level, 'parent', rec.parent_source_value));
  END LOOP;

  -- Migrar traducciones especializadas existentes al registro comun.
  FOR tr IN SELECT pt.page_id::text AS entity_id, pt.language, pt.title, pt.subtitle, pt.content
            FROM public_page_translations pt LOOP
    FOREACH source_key IN ARRAY ARRAY[
      'public_page:' || tr.entity_id || ':title',
      'public_page:' || tr.entity_id || ':subtitle',
      'public_page:' || tr.entity_id || ':content'
    ] LOOP
      INSERT INTO content_translations(translation_key, language, value, source_hash)
      SELECT source_key, tr.language,
        CASE split_part(source_key, ':', 3) WHEN 'title' THEN COALESCE(tr.title, '') WHEN 'subtitle' THEN COALESCE(tr.subtitle, '') ELSE COALESCE(tr.content, '') END,
        s.source_hash
      FROM content_translation_sources s WHERE s.translation_key = source_key
      ON CONFLICT (translation_key, language) DO NOTHING;
    END LOOP;
  END LOOP;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'member_level:' || t.level_id || ':name', t.language, COALESCE(t.name, ''), s.source_hash
  FROM member_level_translations t JOIN content_translation_sources s ON s.translation_key = 'member_level:' || t.level_id || ':name'
  ON CONFLICT (translation_key, language) DO NOTHING;
  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'member_level:' || t.level_id || ':description', t.language, COALESCE(t.description, ''), s.source_hash
  FROM member_level_translations t JOIN content_translation_sources s ON s.translation_key = 'member_level:' || t.level_id || ':description'
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'organization_level:' || t.level_id::text || ':name', t.language, COALESCE(t.name, ''), s.source_hash
  FROM organization_level_translations t JOIN content_translation_sources s ON s.translation_key = 'organization_level:' || t.level_id::text || ':name'
  ON CONFLICT (translation_key, language) DO NOTHING;
  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'organization_level:' || t.level_id::text || ':description', t.language, COALESCE(t.description, ''), s.source_hash
  FROM organization_level_translations t JOIN content_translation_sources s ON s.translation_key = 'organization_level:' || t.level_id::text || ':description'
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'governance_rule:' || t.rule_id::text || ':' || f.field_name, t.language,
         CASE f.field_name WHEN 'title' THEN COALESCE(t.title, '') ELSE COALESCE(t.description, '') END, s.source_hash
  FROM governance_rule_translations t
  CROSS JOIN (VALUES ('title'), ('description')) AS f(field_name)
  JOIN content_translation_sources s ON s.translation_key = 'governance_rule:' || t.rule_id::text || ':' || f.field_name
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'calculator_parameter:' || t.parameter_id::text || ':' || f.field_name, t.language,
         CASE f.field_name WHEN 'name' THEN COALESCE(t.name, '') ELSE COALESCE(t.description, '') END, s.source_hash
  FROM calculator_parameter_translations t
  CROSS JOIN (VALUES ('name'), ('description')) AS f(field_name)
  JOIN content_translation_sources s ON s.translation_key = 'calculator_parameter:' || t.parameter_id::text || ':' || f.field_name
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'calculator_category:' || t.category_id::text || ':' || f.field_name, t.language,
         CASE f.field_name WHEN 'name' THEN COALESCE(t.name, '') ELSE COALESCE(t.description, '') END, s.source_hash
  FROM calculator_category_translations t
  CROSS JOIN (VALUES ('name'), ('description')) AS f(field_name)
  JOIN content_translation_sources s ON s.translation_key = 'calculator_category:' || t.category_id::text || ':' || f.field_name
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'product:' || t.product_id::text || ':' || f.field_name, t.language,
         CASE f.field_name WHEN 'name' THEN COALESCE(t.name, '') ELSE COALESCE(t.description, '') END, s.source_hash
  FROM product_translations t
  CROSS JOIN (VALUES ('name'), ('description')) AS f(field_name)
  JOIN content_translation_sources s ON s.translation_key = 'product:' || t.product_id::text || ':' || f.field_name
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'assembly_config:' || t.config_id::text || ':description', t.language, COALESCE(t.description, ''), s.source_hash
  FROM assembly_config_translations t JOIN content_translation_sources s ON s.translation_key = 'assembly_config:' || t.config_id::text || ':description'
  ON CONFLICT (translation_key, language) DO NOTHING;

  INSERT INTO content_translations(translation_key, language, value, source_hash)
  SELECT 'federation_constant:' || t.constant_key || ':description', t.language, COALESCE(t.description, ''), s.source_hash
  FROM federation_constant_translations t JOIN content_translation_sources s ON s.translation_key = 'federation_constant:' || t.constant_key || ':description'
  ON CONFLICT (translation_key, language) DO NOTHING;
END $$;
