-- Migracion 169: Traducciones de contenido del sitio publico
--
-- Permite que las paginas publicas, la configuracion del sitio y el
-- formulario de admision tengan contenido en multiples idiomas.
--
-- Las tablas originales (public_pages, public_settings, admission_form_schema)
-- mantienen los metadatos no traducibles y el contenido por defecto.
-- Estas nuevas tablas guardan las traducciones por idioma.

-- 1. Traducciones de paginas publicas
CREATE TABLE IF NOT EXISTS public_page_translations (
  id SERIAL PRIMARY KEY,
  page_id UUID REFERENCES public_pages(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  title VARCHAR(255),
  subtitle TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, language)
);

CREATE INDEX IF NOT EXISTS idx_page_translations_page
  ON public_page_translations (page_id);
CREATE INDEX IF NOT EXISTS idx_page_translations_lang
  ON public_page_translations (language);

-- 2. Traducciones de la configuracion del sitio (site_title, site_subtitle)
CREATE TABLE IF NOT EXISTS public_settings_translations (
  id SERIAL PRIMARY KEY,
  node_domain VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL,
  site_title VARCHAR(255),
  site_subtitle TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, language)
);

-- 3. Traducciones del formulario de admision
CREATE TABLE IF NOT EXISTS admission_form_translations (
  id SERIAL PRIMARY KEY,
  node_domain VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL,
  title VARCHAR(255),
  subtitle TEXT,
  schema JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, language)
);

-- 4. Migrar contenido existente al idioma por defecto del nodo
-- Obtener el idioma por defecto de node_config, o 'es' si no esta configurado
DO $$
DECLARE
  default_lang VARCHAR(10) := 'es';
  node_dom VARCHAR(255);
  page RECORD;
BEGIN
  -- Intentar obtener el idioma por defecto del nodo
  BEGIN
    SELECT COALESCE(default_language, 'es') INTO default_lang
    FROM node_config LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_lang := 'es';
  END;

  -- Migrar paginas publicas
  FOR page IN SELECT id, title, subtitle, content, node_domain FROM public_pages LOOP
    INSERT INTO public_page_translations (page_id, language, title, subtitle, content)
    VALUES (page.id, default_lang, page.title, page.subtitle, page.content)
    ON CONFLICT (page_id, language) DO NOTHING;
  END LOOP;

  -- Migrar configuracion del sitio
  FOR node_dom IN SELECT DISTINCT node_domain FROM public_settings LOOP
    INSERT INTO public_settings_translations (node_domain, language, site_title, site_subtitle)
    SELECT node_dom, default_lang, site_title, site_subtitle
    FROM public_settings
    WHERE node_domain = node_dom
    ON CONFLICT (node_domain, language) DO NOTHING;
  END LOOP;

  -- Migrar formulario de admision
  FOR node_dom IN SELECT DISTINCT node_domain FROM public_settings LOOP
    INSERT INTO admission_form_translations (node_domain, language, title, subtitle, schema)
    SELECT node_dom, default_lang,
      COALESCE(admission_form_title, ''), COALESCE(admission_form_subtitle, ''),
      admission_form_schema
    FROM public_settings
    WHERE node_domain = node_dom
    ON CONFLICT (node_domain, language) DO NOTHING;
  END LOOP;
END $$;
