-- Migracion 013: Sitio web publico + nombre completo de moneda + solicitudes de admision
--
-- Permite que personas externas vean informacion del nodo sin iniciar sesion,
-- y que puedan solicitar unirse llenando un formulario.
--
-- NOTA: El contenido de las paginas se inserta desde Go (seed.go) con
-- queries parametrizadas para evitar problemas de parsing de strings
-- multi-linea en YugabyteDB.

-- 1. Agregar nombre completo de la moneda (ademas de la abreviatura)
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS currency_full_name VARCHAR(100) DEFAULT 'Trueque';

-- 2. Configuracion del sitio publico (logo, colores, redes sociales, etc)
CREATE TABLE IF NOT EXISTS public_settings (
  node_domain VARCHAR(255) NOT NULL UNIQUE,
  site_title VARCHAR(255) NOT NULL DEFAULT 'Feria Conuquera Agroecologica',
  site_subtitle TEXT DEFAULT 'Cuando el conuco viene a la ciudad, la soberania alimenta el alma',
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#2d5016',
  secondary_color VARCHAR(7) DEFAULT '#f4a261',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(100),
  contact_address TEXT DEFAULT 'Parque Los Caobos, Caracas, Venezuela',
  social_instagram VARCHAR(255) DEFAULT 'feriaconuquera',
  social_facebook VARCHAR(255) DEFAULT 'feriaconuquera',
  social_twitter VARCHAR(255),
  show_join_form BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Paginas del sitio publico (contenido configurable)
CREATE TABLE IF NOT EXISTS public_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL DEFAULT '',
  icon VARCHAR(50),
  menu_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  show_in_menu BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, slug)
);

CREATE INDEX IF NOT EXISTS idx_public_pages_node ON public_pages (node_domain, is_published, menu_order);

-- 4. Solicitudes de admision (formulario publico)
CREATE TABLE IF NOT EXISTS admission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  location TEXT,
  reason TEXT,
  skills TEXT,
  how_heard TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_requests_node ON admission_requests (node_domain, status, created_at);

-- 5. Configuracion por defecto del sitio publico
INSERT INTO public_settings (node_domain) VALUES ('localhost')
ON CONFLICT (node_domain) DO NOTHING;

-- El contenido de las paginas se inserta desde Go (ver internal/db/seed.go)
