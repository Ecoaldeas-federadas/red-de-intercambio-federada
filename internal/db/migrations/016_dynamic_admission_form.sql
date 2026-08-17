-- Migracion 016: Formulario de admision dinamico y configurable
-- Permite que los administradores construyan su propio formulario personalizado
-- con campos de texto corto, texto largo, desplegables, seleccion multiple, casillas, etc.

ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS admission_form_schema JSONB;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS admission_form_title VARCHAR(255) DEFAULT 'Solicitud de Ingreso a la Red';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS admission_form_subtitle TEXT DEFAULT 'Completa tus datos para postularte como productor conuquero, artesano o miembro de la comunidad.';

ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS custom_fields JSONB;
