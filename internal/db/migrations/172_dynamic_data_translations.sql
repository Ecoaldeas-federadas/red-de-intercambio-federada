-- Migracion 172: Traducciones de datos dinamicos
--
-- Crea tablas de traducción para:
-- 1. Reglas de gobernanza (governance_rules)
-- 2. Parametros de calculadora (calculator_parameters)
-- 3. Categorias de calculadora (calculator_categories)
-- 4. Productos (products)
-- 5. Configuracion de asamblea (assembly_config)
-- 6. Constantes federadas (federation_constants)
--
-- Patron: cada tabla tiene (entity_id/key, language, campos_traducibles)
-- con UNIQUE(entity_id/key, language) y ON DELETE CASCADE.

-- 1. Traducciones de reglas de gobernanza
CREATE TABLE IF NOT EXISTS governance_rule_translations (
  id SERIAL PRIMARY KEY,
  rule_id UUID REFERENCES governance_rules(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rule_id, language)
);
CREATE INDEX IF NOT EXISTS idx_gov_rule_trans_rule ON governance_rule_translations (rule_id);
CREATE INDEX IF NOT EXISTS idx_gov_rule_trans_lang ON governance_rule_translations (language);

-- 2. Traducciones de parametros de calculadora
CREATE TABLE IF NOT EXISTS calculator_parameter_translations (
  id SERIAL PRIMARY KEY,
  parameter_id UUID REFERENCES calculator_parameters(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parameter_id, language)
);
CREATE INDEX IF NOT EXISTS idx_calc_param_trans_param ON calculator_parameter_translations (parameter_id);
CREATE INDEX IF NOT EXISTS idx_calc_param_trans_lang ON calculator_parameter_translations (language);

-- 3. Traducciones de categorias de calculadora
CREATE TABLE IF NOT EXISTS calculator_category_translations (
  id SERIAL PRIMARY KEY,
  category_id UUID REFERENCES calculator_categories(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, language)
);
CREATE INDEX IF NOT EXISTS idx_calc_cat_trans_cat ON calculator_category_translations (category_id);
CREATE INDEX IF NOT EXISTS idx_calc_cat_trans_lang ON calculator_category_translations (language);

-- 4. Traducciones de productos
CREATE TABLE IF NOT EXISTS product_translations (
  id SERIAL PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, language)
);
CREATE INDEX IF NOT EXISTS idx_product_trans_prod ON product_translations (product_id);
CREATE INDEX IF NOT EXISTS idx_product_trans_lang ON product_translations (language);

-- 5. Traducciones de configuracion de asamblea
CREATE TABLE IF NOT EXISTS assembly_config_translations (
  id SERIAL PRIMARY KEY,
  config_id UUID REFERENCES assembly_config(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(config_id, language)
);
CREATE INDEX IF NOT EXISTS idx_assembly_cfg_trans_cfg ON assembly_config_translations (config_id);
CREATE INDEX IF NOT EXISTS idx_assembly_cfg_trans_lang ON assembly_config_translations (language);

-- 6. Traducciones de constantes federadas
CREATE TABLE IF NOT EXISTS federation_constant_translations (
  id SERIAL PRIMARY KEY,
  constant_key TEXT NOT NULL,
  language VARCHAR(10) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(constant_key, language)
);
CREATE INDEX IF NOT EXISTS idx_fed_const_trans_key ON federation_constant_translations (constant_key);
CREATE INDEX IF NOT EXISTS idx_fed_const_trans_lang ON federation_constant_translations (language);

-- 7. Migrar contenido existente al idioma por defecto del nodo
DO $$
DECLARE
  default_lang VARCHAR(10) := 'es';
  rec RECORD;
BEGIN
  BEGIN
    SELECT COALESCE(default_language, 'es') INTO default_lang
    FROM node_config LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_lang := 'es';
  END;

  -- Migrar reglas de gobernanza
  FOR rec IN SELECT id, title, COALESCE(description, '') AS description FROM governance_rules LOOP
    INSERT INTO governance_rule_translations (rule_id, language, title, description)
    VALUES (rec.id, default_lang, rec.title, rec.description)
    ON CONFLICT (rule_id, language) DO NOTHING;
  END LOOP;

  -- Migrar parametros de calculadora
  FOR rec IN SELECT id, name, COALESCE(description, '') AS description FROM calculator_parameters LOOP
    INSERT INTO calculator_parameter_translations (parameter_id, language, name, description)
    VALUES (rec.id, default_lang, rec.name, rec.description)
    ON CONFLICT (parameter_id, language) DO NOTHING;
  END LOOP;

  -- Migrar categorias de calculadora
  FOR rec IN SELECT id, name, COALESCE(description, '') AS description FROM calculator_categories LOOP
    INSERT INTO calculator_category_translations (category_id, language, name, description)
    VALUES (rec.id, default_lang, rec.name, rec.description)
    ON CONFLICT (category_id, language) DO NOTHING;
  END LOOP;

  -- Migrar productos
  FOR rec IN SELECT id, name, COALESCE(description, '') AS description FROM products LOOP
    INSERT INTO product_translations (product_id, language, name, description)
    VALUES (rec.id, default_lang, rec.name, rec.description)
    ON CONFLICT (product_id, language) DO NOTHING;
  END LOOP;

  -- Migrar configuracion de asamblea
  FOR rec IN SELECT id, COALESCE(description, '') AS description FROM assembly_config LOOP
    INSERT INTO assembly_config_translations (config_id, language, description)
    VALUES (rec.id, default_lang, rec.description)
    ON CONFLICT (config_id, language) DO NOTHING;
  END LOOP;

  -- Migrar constantes federadas
  FOR rec IN SELECT key, COALESCE(description, '') AS description FROM federation_constants LOOP
    INSERT INTO federation_constant_translations (constant_key, language, description)
    VALUES (rec.key, default_lang, rec.description)
    ON CONFLICT (constant_key, language) DO NOTHING;
  END LOOP;
END $$;
