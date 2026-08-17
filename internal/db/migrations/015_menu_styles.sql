-- Migracion 015: Estilos de menu, navegacion y plantillas de portal
-- Permite seleccionar estilos de cabecera/menu como:
-- 'modern_eco' (Ecoaldea / Moderno flotante)
-- 'fao_institutional' (Institucional FAO / Portal blanco con submenús)
-- 'editorial_latam' (Revista / Agroecología LATAM con barra doble)
-- 'agrodigital_mincyt' (Tecnológico AgroDigital / Mincyt)
-- 'dropdown_categories' (Menú agrupado por categorías desplegables)

ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS header_style VARCHAR(50) DEFAULT 'modern_eco';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS announcement_text TEXT DEFAULT '🗓️ Próximo Encuentro Conuquero: Primer sábado de cada mes en Parque Los Caobos, Caracas | 9:00 AM';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS show_announcement BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_style VARCHAR(50) DEFAULT 'columns';
