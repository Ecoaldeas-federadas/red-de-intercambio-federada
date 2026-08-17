-- Migracion 020: Mas colores del tema + titulos de columnas del footer editables

-- Colores adicionales del tema
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#1a1a1a';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS button_hover_color TEXT DEFAULT '#15803d';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS module_bg_color TEXT DEFAULT '#ffffff';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS page_bg_color TEXT DEFAULT '#f8faf5';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_bg_color TEXT DEFAULT '#112211';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS link_color TEXT DEFAULT '#15803d';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS link_visited_color TEXT DEFAULT '#6b21a8';

-- Titulos de las columnas del footer (editables)
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_col1_title TEXT DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_col2_title TEXT DEFAULT 'Páginas del Nodo';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_col3_title TEXT DEFAULT 'Lugar de Encuentro';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_col4_title TEXT DEFAULT 'Comunidad & Redes';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_slogan TEXT DEFAULT '100% Autogestión & Suelo Vivo';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_admission_text TEXT DEFAULT 'Llenar Solicitud de Ingreso';
