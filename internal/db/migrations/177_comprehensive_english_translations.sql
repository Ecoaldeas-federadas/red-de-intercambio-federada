-- Migracion 177: Traducciones integrales al ingles para niveles y paginas publicas.
--
-- Resuelve la ausencia de datos traducidos para:
-- 1. member_level_translations (para /api/member-levels)
-- 2. organization_level_translations (para /api/organization-levels)
-- 3. public_pages (titulos y subtitulos en content_translations para /api/site/pages y /api/public/pages)
--
-- La migracion es completamente idempotente con ON CONFLICT.

-- =========================================================================
-- 1. TRADUCCIONES DE NIVELES DE MIEMBRO (member_level_translations)
-- =========================================================================

INSERT INTO member_level_translations (level_id, language, name, description, updated_at)
SELECT ml.id, 'en',
  CASE
    WHEN ml.id = 'honorary' OR ml.name = 'Miembro Honorario' THEN 'Honorary Member'
    WHEN ml.id = 'new' OR ml.name = 'Miembro Nuevo' THEN 'New Member'
    WHEN ml.id = 'active' OR ml.name = 'Miembro Activo' THEN 'Active Member'
    WHEN ml.id = 'nuevo' OR ml.name = 'nuevo' THEN 'new'
    WHEN ml.id = 'activo' OR ml.name = 'activo' THEN 'active'
    WHEN ml.id = 'honorario' OR ml.name = 'honorario' THEN 'honorary'
    WHEN ml.id = 'voz' OR ml.name = 'voz' THEN 'voice'
    WHEN ml.id = 'voz_plena' OR ml.name = 'voz_plena' THEN 'full_voice'
    ELSE ml.name
  END AS name,
  CASE
    WHEN ml.id = 'honorary' OR ml.description = 'Invitados, colaboradores externos' THEN 'Guests, external collaborators'
    WHEN ml.id = 'new' OR ml.description = 'Recien admitido, limites reducidos' THEN 'Recently admitted, reduced limits'
    WHEN ml.id = 'active' OR ml.description = 'Miembro pleno con topes completos' THEN 'Full member with complete limits'
    WHEN ml.id = 'nuevo' OR ml.description = 'Miembro nuevo recien admitido. Sin voto ni voz hasta ser promovido.' THEN 'Recently admitted new member. No voice or vote until promoted.'
    WHEN ml.id = 'activo' OR ml.description = 'Miembro activo con voz y voto. Participa en asamblea.' THEN 'Active member with voice and vote. Participates in assembly.'
    WHEN ml.id = 'honorario' OR ml.description = 'Miembro honorario con voz pero sin voto ni obligacion de quorum.' THEN 'Honorary member with voice but without vote or quorum obligation.'
    WHEN ml.id = 'voz' OR ml.description = 'Miembro con Voz - Sin derecho a voto pero con limite alto' THEN 'Member with Voice - No voting rights but high limit'
    WHEN ml.id = 'voz_plena' OR ml.description = 'Miembro con Voz Plena - Sin voto, limite muy alto, participacion plena' THEN 'Member with Full Voice - No vote, very high limit, full participation'
    ELSE COALESCE(ml.description, '')
  END AS description,
  NOW()
FROM member_levels ml
ON CONFLICT (level_id, language) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Tambien asegurar que content_translations tenga estos valores
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT 'member_level:' || ml.id || ':name', 'en',
  CASE
    WHEN ml.id = 'honorary' OR ml.name = 'Miembro Honorario' THEN 'Honorary Member'
    WHEN ml.id = 'new' OR ml.name = 'Miembro Nuevo' THEN 'New Member'
    WHEN ml.id = 'active' OR ml.name = 'Miembro Activo' THEN 'Active Member'
    WHEN ml.id = 'nuevo' OR ml.name = 'nuevo' THEN 'new'
    WHEN ml.id = 'activo' OR ml.name = 'activo' THEN 'active'
    WHEN ml.id = 'honorario' OR ml.name = 'honorario' THEN 'honorary'
    WHEN ml.id = 'voz' OR ml.name = 'voz' THEN 'voice'
    WHEN ml.id = 'voz_plena' OR ml.name = 'voz_plena' THEN 'full_voice'
    ELSE ml.name
  END,
  md5(ml.name), NOW()
FROM member_levels ml
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT 'member_level:' || ml.id || ':description', 'en',
  CASE
    WHEN ml.id = 'honorary' OR ml.description = 'Invitados, colaboradores externos' THEN 'Guests, external collaborators'
    WHEN ml.id = 'new' OR ml.description = 'Recien admitido, limites reducidos' THEN 'Recently admitted, reduced limits'
    WHEN ml.id = 'active' OR ml.description = 'Miembro pleno con topes completos' THEN 'Full member with complete limits'
    WHEN ml.id = 'nuevo' OR ml.description = 'Miembro nuevo recien admitido. Sin voto ni voz hasta ser promovido.' THEN 'Recently admitted new member. No voice or vote until promoted.'
    WHEN ml.id = 'activo' OR ml.description = 'Miembro activo con voz y voto. Participa en asamblea.' THEN 'Active member with voice and vote. Participates in assembly.'
    WHEN ml.id = 'honorario' OR ml.description = 'Miembro honorario con voz pero sin voto ni obligacion de quorum.' THEN 'Honorary member with voice but without vote or quorum obligation.'
    WHEN ml.id = 'voz' OR ml.description = 'Miembro con Voz - Sin derecho a voto pero con limite alto' THEN 'Member with Voice - No voting rights but high limit'
    WHEN ml.id = 'voz_plena' OR ml.description = 'Miembro con Voz Plena - Sin voto, limite muy alto, participacion plena' THEN 'Member with Full Voice - No vote, very high limit, full participation'
    ELSE COALESCE(ml.description, '')
  END,
  md5(COALESCE(ml.description, '')), NOW()
FROM member_levels ml
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =========================================================================
-- 2. TRADUCCIONES DE NIVELES DE ORGANIZACION (organization_level_translations)
-- =========================================================================

INSERT INTO organization_level_translations (level_id, language, name, description, updated_at)
SELECT ol.id, 'en',
  CASE
    WHEN ol.name = 'org_consumo' THEN 'org_consumption'
    WHEN ol.name = 'org_cooperativa' THEN 'org_cooperative'
    WHEN ol.name = 'org_produccion' THEN 'org_production'
    WHEN ol.name = 'org_publica' THEN 'org_public'
    WHEN ol.name = 'Organizacion Nueva' THEN 'New Organization'
    WHEN ol.name = 'Organizacion Activa' THEN 'Active Organization'
    WHEN ol.name = 'Organizacion Honoraria' THEN 'Honorary Organization'
    ELSE ol.name
  END AS name,
  CASE
    WHEN ol.name = 'org_consumo' OR ol.description LIKE '%consumo%' THEN 'Consumer organization. Buys goods to distribute.'
    WHEN ol.name = 'org_cooperativa' OR ol.description LIKE '%Cooperativa%' THEN 'Cooperative. Shared member ownership.'
    WHEN ol.name = 'org_produccion' OR ol.description LIKE '%produccion%' THEN 'Production organization. Manufactures or produces goods.'
    WHEN ol.name = 'org_publica' OR ol.description LIKE '%publica%' THEN 'Public institution. Non-profit, tax-exempt.'
    ELSE COALESCE(ol.description, '')
  END AS description,
  NOW()
FROM organization_levels ol
ON CONFLICT (level_id, language) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Asegurar content_translations para niveles de organizacion
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT 'organization_level:' || ol.id || ':name', 'en',
  CASE
    WHEN ol.name = 'org_consumo' THEN 'org_consumption'
    WHEN ol.name = 'org_cooperativa' THEN 'org_cooperative'
    WHEN ol.name = 'org_produccion' THEN 'org_production'
    WHEN ol.name = 'org_publica' THEN 'org_public'
    WHEN ol.name = 'Organizacion Nueva' THEN 'New Organization'
    WHEN ol.name = 'Organizacion Activa' THEN 'Active Organization'
    WHEN ol.name = 'Organizacion Honoraria' THEN 'Honorary Organization'
    ELSE ol.name
  END,
  md5(ol.name), NOW()
FROM organization_levels ol
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT 'organization_level:' || ol.id || ':description', 'en',
  CASE
    WHEN ol.name = 'org_consumo' OR ol.description LIKE '%consumo%' THEN 'Consumer organization. Buys goods to distribute.'
    WHEN ol.name = 'org_cooperativa' OR ol.description LIKE '%Cooperativa%' THEN 'Cooperative. Shared member ownership.'
    WHEN ol.name = 'org_produccion' OR ol.description LIKE '%produccion%' THEN 'Production organization. Manufactures or produces goods.'
    WHEN ol.name = 'org_publica' OR ol.description LIKE '%publica%' THEN 'Public institution. Non-profit, tax-exempt.'
    ELSE COALESCE(ol.description, '')
  END,
  md5(COALESCE(ol.description, '')), NOW()
FROM organization_levels ol
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =========================================================================
-- 3. FUENTES Y TRADUCCIONES DE PAGINAS PUBLICAS (public_pages)
-- =========================================================================

-- Registrar fuentes de traduccion para paginas publicas
INSERT INTO content_translation_sources (
  translation_key, node_domain, entity_type, entity_id, field_name,
  source_language, source_text, source_hash, is_active, updated_at
)
SELECT
  'public_page:' || p.id || ':title',
  p.node_domain,
  'public_page',
  p.id::text,
  'title',
  'es',
  p.title,
  md5(p.title),
  true,
  NOW()
FROM public_pages p
ON CONFLICT (translation_key) DO UPDATE SET
  source_text = EXCLUDED.source_text,
  source_hash = EXCLUDED.source_hash,
  is_active = true,
  updated_at = NOW();

INSERT INTO content_translation_sources (
  translation_key, node_domain, entity_type, entity_id, field_name,
  source_language, source_text, source_hash, is_active, updated_at
)
SELECT
  'public_page:' || p.id || ':subtitle',
  p.node_domain,
  'public_page',
  p.id::text,
  'subtitle',
  'es',
  COALESCE(p.subtitle, ''),
  md5(COALESCE(p.subtitle, '')),
  true,
  NOW()
FROM public_pages p
ON CONFLICT (translation_key) DO UPDATE SET
  source_text = EXCLUDED.source_text,
  source_hash = EXCLUDED.source_hash,
  is_active = true,
  updated_at = NOW();

-- Insertar traducciones al ingles para titulos de paginas publicas
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT
  'public_page:' || p.id || ':title',
  'en',
  CASE p.slug
    WHEN 'inicio' THEN 'Home'
    WHEN 'filosofia' THEN 'History and Organization'
    WHEN 'productos' THEN 'Our Products'
    WHEN 'comunidad' THEN 'Community & Knowledge'
    WHEN 'como-funciona' THEN 'How Barter Works'
    WHEN 'campo-soberano' THEN 'Sovereign Field'
    WHEN 'faq' THEN 'Frequently Asked Questions'
    WHEN 'contacto' THEN 'Contact and Location'
    WHEN 'semillas' THEN 'Seeds & Seed Bank'
    WHEN 'saberes-ancestrales' THEN 'Ancestral Knowledge'
    WHEN 'filosofia-conuquera' THEN 'Conuquera Philosophy'
    WHEN 'ecoaldeas-mundo' THEN 'Ecovillages in the World'
    WHEN 'metodologia-energetica' THEN 'Energy Methodology'
    WHEN 'gobernanza' THEN 'Village Governance'
    WHEN 'comercio-exterior' THEN 'Foreign Trade'
    WHEN 'servicios-federados' THEN 'Federated Services'
    WHEN 'federacion' THEN 'Federation'
    ELSE p.title
  END,
  md5(p.title),
  NOW()
FROM public_pages p
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW();

-- Insertar traducciones al ingles para subtitulos de paginas publicas
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT
  'public_page:' || p.id || ':subtitle',
  'en',
  CASE p.slug
    WHEN 'inicio' THEN 'Open-Air Market and Food Sovereignty Network'
    WHEN 'filosofia' THEN 'Our Trajectory, Assemblies, and Community Life'
    WHEN 'productos' THEN 'Open Sales in Local Currency and Harvest Catalog'
    WHEN 'comunidad' THEN 'Live Workshops, Culture, Seeds, and Assemblies'
    WHEN 'como-funciona' THEN 'Community Mutual Credit for Registered Members'
    WHEN 'campo-soberano' THEN 'Autonomous and Regenerative Agroecological Community'
    WHEN 'faq' THEN 'Questions about Local Currency Purchases, Barter, and Assemblies'
    WHEN 'contacto' THEN 'Communication Channels and How to Reach Los Caobos'
    WHEN 'semillas' THEN 'Collective Heritage, Food Sovereignty, and Biodiversity'
    WHEN 'saberes-ancestrales' THEN 'Traditional Knowledge Supporting Community Life'
    WHEN 'filosofia-conuquera' THEN 'Agroecology, Sovereignty, and Community Life'
    WHEN 'ecoaldeas-mundo' THEN 'Self-Sustaining Communities that Inspire: Global Benchmarks'
    WHEN 'metodologia-energetica' THEN 'How We Calculate Prices: Objective Energy, Not Money'
    WHEN 'gobernanza' THEN 'How it is Governed, Who Decides, What is Allowed and What is Not'
    WHEN 'comercio-exterior' THEN 'How Exchange with the Outside Works'
    WHEN 'servicios-federados' THEN 'Replace Commercial Services with Self-Hosted Alternatives'
    WHEN 'federacion' THEN 'Add your ecovillage to the network'
    ELSE COALESCE(p.subtitle, '')
  END,
  md5(COALESCE(p.subtitle, '')),
  NOW()
FROM public_pages p
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW();
