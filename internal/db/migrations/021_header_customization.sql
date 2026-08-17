-- Migracion 021: Personalizacion de cabecera (sticky, colores, banner, transparencia)
--
-- Anade columnas para:
-- - header_sticky: si el menu queda fijo al hacer scroll
-- - header_banner_image: URL de imagen de fondo para el estilo banner
-- - header_banner_height: altura del banner en px
-- - header_transparency: nivel de transparencia (0-80) para hero_overlay
-- - header_transparency_color: color de la transparencia
-- - header_blur: nivel de blur/distorsion en px
-- - Colores personalizables del header (vacio = usar paleta general)
-- - Colores para doble fila (editorial_latam)

ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_sticky BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_banner_image TEXT DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_banner_images TEXT DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_banner_duration INT NOT NULL DEFAULT 5;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_banner_transition VARCHAR(20) DEFAULT 'fade';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_banner_height INT NOT NULL DEFAULT 120;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_transparency INT NOT NULL DEFAULT 25;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_transparency_color VARCHAR(7) DEFAULT '#000000';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_blur INT NOT NULL DEFAULT 4;

-- Colores generales del header (vacio = usar paleta)
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_bg_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_text_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_active_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_active_bg_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_hover_color VARCHAR(7) DEFAULT '';

-- Colores para doble fila (editorial_latam)
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_top_bg_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_top_text_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_bottom_bg_color VARCHAR(7) DEFAULT '';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_bottom_text_color VARCHAR(7) DEFAULT '';

-- Tambien anadir parent_slug a public_pages para soporte de submenus
ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS parent_slug VARCHAR(100) DEFAULT NULL;
