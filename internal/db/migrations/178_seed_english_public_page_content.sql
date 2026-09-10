-- Migracion 178: Poblar traducciones completas en ingles para el contenido de paginas publicas.
--
-- Inserta en public_page_translations y content_translations los bloques JSON
-- traducidos al ingles para inicio y demas paginas publicas.
-- Totalmente idempotente con ON CONFLICT.

-- 1. Asegurar que las fuentes de traduccion para content existan
INSERT INTO content_translation_sources (
  translation_key, node_domain, entity_type, entity_id, field_name,
  source_language, source_text, source_hash, is_active, updated_at
)
SELECT
  'public_page:' || p.id || ':content',
  p.node_domain,
  'public_page',
  p.id::text,
  'content',
  'es',
  p.content,
  md5(p.content),
  true,
  NOW()
FROM public_pages p
ON CONFLICT (translation_key) DO UPDATE SET
  source_text = EXCLUDED.source_text,
  source_hash = EXCLUDED.source_hash,
  is_active = true,
  updated_at = NOW();

-- 2. Poblar public_page_translations para 'inicio' en inglés
INSERT INTO public_page_translations (page_id, language, title, subtitle, content, updated_at)
SELECT
  p.id,
  'en',
  'Home',
  'Open-Air Market and Food Sovereignty Network',
  '[
  {
    "type": "hero",
    "badge": "🌱 Open-Air Market",
    "title": "Our Community",
    "subtitle": "Fresh harvest, healthy food and peasant knowledge for the entire community.",
    "description": "We open our open-air market to the general public in local currency. A self-managed space where you buy directly from the producer without intermediaries or agrochemicals, and where network members also trade in barter and mutual credit.",
    "image_url": "/placeholder.svg",
    "primary_cta": {
      "text": "View Products Catalog",
      "link": "/p/productos"
    },
    "secondary_cta": {
      "text": "Hours and Location",
      "link": "/p/contacto"
    },
    "style": "split"
  },
  {
    "type": "event_schedule",
    "badge": "📍 Market Open to the General Public",
    "title": "Monthly Gathering",
    "date_text": "",
    "time_text": "",
    "location_name": "",
    "address": "",
    "guidelines": [
      "Open sale to the general public in local currency (no membership required to purchase).",
      "No single-use plastic bags allowed: bring your backpack, cloth bag or basket.",
      "Open barter of native and heritage seeds among farmers and neighbors.",
      "Donate and adopt a book area for free reading exchange.",
      "Live learning workshops (vermicomposting, bio-inputs, botanical health).",
      "Folk music, cultural activities and games for children.",
      "Barter and mutual credit system available for registered members."
    ],
    "cta_text": "Apply for Membership as Producer or Member",
    "cta_link": "/p/unirse"
  },
  {
    "type": "stats",
    "title": "Building Popular Sovereignty",
    "subtitle": "Real figures of an autonomous community movement.",
    "bg_theme": "primary",
    "items": [
      {
        "value": "+10 Years",
        "label": "Continuous Gathering",
        "description": "Monthly open-air market since our beginnings"
      },
      {
        "value": "+45 Collectives",
        "label": "Producer Families",
        "description": "Diverse producing communities"
      },
      {
        "value": "0% Agrochemicals",
        "label": "100% Clean Production",
        "description": "Living soils, organic fertilizers and ancestral seeds"
      },
      {
        "value": "Open Sales",
        "label": "Local Currency & Barter",
        "description": "Open to everyone with barter option for network members"
      }
    ]
  },
  {
    "type": "carousel",
    "title": "Living Gallery of Our Gatherings",
    "subtitle": "Moments from our market days, workshops, culture and solidarity barter in every edition.",
    "autoplay": true,
    "items": [
      {
        "image_url": "/placeholder.svg",
        "title": "Fresh Vegetables and Ancestral Crops",
        "caption": "Harvested at dawn for direct sale in local currency.",
        "tag": "Daily Harvest"
      },
      {
        "image_url": "/placeholder.svg",
        "title": "Community Apothecary and Traditional Medicine",
        "caption": "Propolis tinctures, botanical ointments, essential oils and medicinal herbs.",
        "tag": "Botanical Health"
      },
      {
        "image_url": "/placeholder.svg",
        "title": "Artisanal and Ancestral Gastronomy",
        "caption": "Traditional Cafunga, gluten-free flours, pure cocoa and mountain coffee.",
        "tag": "Sovereign Flavors"
      },
      {
        "image_url": "/placeholder.svg",
        "title": "Live Workshops & Seed Barter",
        "caption": "Solidarity exchange of knowledge, native seeds and books for the whole community.",
        "tag": "Popular Education"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Network Dynamics and Organization",
    "subtitle": "How our community works both at the monthly market and in its internal democratic life.",
    "columns": 3,
    "items": [
      {
        "icon": "shopping-cart",
        "title": "Monthly Open-Air Market",
        "description": "Direct sale to the general public in local currency at every monthly meeting. No middlemen or usury.",
        "badge": "Public Sales"
      },
      {
        "icon": "scale",
        "title": "Barter & Mutual Credit",
        "description": "Network members can exchange products and labor through the zero-sum accounting system (1 TQ = 1 kWh).",
        "badge": "For Members"
      },
      {
        "icon": "users",
        "title": "Quarterly Assemblies",
        "description": "Governance meetings every 3 months where members decide on admissions, taxes, fund distribution, and policies.",
        "badge": "Governance"
      },
      {
        "icon": "leaf",
        "title": "Workshops & Popular Education",
        "description": "Open educational spaces during the fair and field visits to conucos on vermiculture, bio-inputs, and agroecology.",
        "badge": "Education"
      },
      {
        "icon": "heart",
        "title": "Culture, Music & Community",
        "description": "Musical performances, folk poetry, children activities, and community meals at each edition.",
        "badge": "Living Culture"
      },
      {
        "icon": "home",
        "title": "Work Commissions & Field Cayapas",
        "description": "Collective labor outside the park: thematic working groups, technical conuco visits, and ecovillage networking.",
        "badge": "Community"
      }
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🤝 Join the Network",
    "title": "Are you an agroecological producer or looking to join?",
    "subtitle": "Anyone can buy at the fair. If you wish to join as a producer or take part in assemblies and barter, submit your application to the assembly.",
    "button_text": "Complete Admission Application",
    "button_link": "/p/unirse",
    "secondary_text": "Frequently Asked Questions",
    "secondary_link": "/p/faq",
    "theme": "forest"
  }
]',
  NOW()
FROM public_pages p
WHERE p.slug = 'inicio'
ON CONFLICT (page_id, language) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  content = EXCLUDED.content,
  updated_at = NOW();

-- 3. Sincronizar en content_translations para 'inicio'
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT
  'public_page:' || p.id || ':content',
  'en',
  t.content,
  md5(p.content),
  NOW()
FROM public_pages p
JOIN public_page_translations t ON t.page_id = p.id AND t.language = 'en'
WHERE p.slug = 'inicio'
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW();

-- 4. Asegurar filas en public_page_translations para las demas paginas publicas
INSERT INTO public_page_translations (page_id, language, title, subtitle, content, updated_at)
SELECT
  p.id,
  'en',
  CASE p.slug
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
  CASE p.slug
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
  p.content,
  NOW()
FROM public_pages p
WHERE p.slug != 'inicio'
ON CONFLICT (page_id, language) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  updated_at = NOW();
