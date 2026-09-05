-- Migracion 170: Traducciones en ingles para contenido dinamico
--
-- Inserta traducciones en ingles ('en') para:
-- 1. public_settings_translations (site_title, site_subtitle)
-- 2. admission_form_translations (title, subtitle)
-- 3. public_page_translations (title, subtitle para cada pagina seed)
--
-- El contenido completo (JSON) de las paginas se gestiona desde el admin
-- o se actualizara en futuras migraciones.

-- 1. Traducciones de configuracion del sitio (site_title, site_subtitle)
INSERT INTO public_settings_translations (node_domain, language, site_title, site_subtitle)
SELECT node_domain, 'en',
  COALESCE(site_title, 'Community Exchange Network'),
  COALESCE(site_subtitle, 'When the community garden comes to the city, sovereignty feeds the soul')
FROM public_settings
ON CONFLICT (node_domain, language) DO UPDATE SET
  site_title = EXCLUDED.site_title,
  site_subtitle = EXCLUDED.site_subtitle,
  updated_at = NOW();

-- 2. Traducciones del formulario de admision
INSERT INTO admission_form_translations (node_domain, language, title, subtitle, schema)
SELECT node_domain, 'en',
  'Network Membership Application',
  'Fill in your details to apply as a producer, artisan, or community member.',
  admission_form_schema
FROM public_settings
ON CONFLICT (node_domain, language) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  updated_at = NOW();

-- 3. Traducciones de titulos y subtitulos de paginas publicas
-- Mapeo de slugs a traducciones en ingles
INSERT INTO public_page_translations (page_id, language, title, subtitle, content)
SELECT p.id, 'en',
  CASE p.slug
    WHEN 'inicio' THEN 'Home'
    WHEN 'filosofia' THEN 'History and Organization'
    WHEN 'productos' THEN 'Our Products'
    WHEN 'comunidad' THEN 'Community and Knowledge'
    WHEN 'como-funciona' THEN 'How Barter Works'
    WHEN 'campo-soberano' THEN 'Sovereign Field'
    WHEN 'faq' THEN 'Frequently Asked Questions'
    WHEN 'contacto' THEN 'Contact and Location'
    WHEN 'semillas' THEN 'Seeds and Seed Bank'
    WHEN 'saberes-ancestrales' THEN 'Ancestral Knowledge'
    WHEN 'filosofia-conuquera' THEN 'Conuquero Philosophy'
    WHEN 'ecoaldeas-mundo' THEN 'Eco-villages of the World'
    WHEN 'metodologia-energetica' THEN 'Energy Methodology'
    WHEN 'gobernanza' THEN 'Community Governance'
    WHEN 'comercio-exterior' THEN 'External Trade'
    WHEN 'servicios-federados' THEN 'Federated Services'
    WHEN 'federacion' THEN 'Federation'
    WHEN 'unirse' THEN 'Join the Network'
    ELSE p.title
  END,
  CASE p.slug
    WHEN 'inicio' THEN 'Open-Air Market and Food Sovereignty Network'
    WHEN 'filosofia' THEN 'Our Journey, Assemblies, and Community Life'
    WHEN 'productos' THEN 'Open Sale in Local Currency and Harvest Catalog'
    WHEN 'comunidad' THEN 'Live Workshops, Culture, Seeds, and Assemblies'
    WHEN 'como-funciona' THEN 'Community Mutual Credit for Registered Members'
    WHEN 'campo-soberano' THEN 'Autonomous and Regenerative Agroecological Community'
    WHEN 'faq' THEN 'Questions about Local Currency Purchases, Barter, and Assemblies'
    WHEN 'contacto' THEN 'Communication Channels and How to Find Us'
    WHEN 'semillas' THEN 'Collective Heritage, Food Sovereignty, and Biodiversity'
    WHEN 'saberes-ancestrales' THEN 'Traditional Knowledge that Sustains Community Life'
    WHEN 'filosofia-conuquera' THEN 'Agroecology, Sovereignty, and Community Life'
    WHEN 'ecoaldeas-mundo' THEN 'Self-sustaining Communities that Inspire: Global References'
    WHEN 'metodologia-energetica' THEN 'How We Calculate Prices: Objective Energy, not Money'
    WHEN 'gobernanza' THEN 'How the Community is Governed, Who Decides, What is Allowed'
    WHEN 'comercio-exterior' THEN 'How External Exchange Works'
    WHEN 'servicios-federados' THEN 'Replace Commercial Services with Self-hosted Alternatives'
    WHEN 'federacion' THEN 'Add your eco-village to the network'
    WHEN 'unirse' THEN 'Join the Network'
    ELSE p.subtitle
  END,
  p.content
FROM public_pages p
WHERE NOT EXISTS (
  SELECT 1 FROM public_page_translations pt
  WHERE pt.page_id = p.id AND pt.language = 'en'
);

-- 4. Actualizar el anuncio (announcement_text) con version en ingles
-- Esto se guarda en public_settings directamente ya que no hay tabla de traduccion para ello
-- El admin puede cambiarlo desde el panel de configuracion
