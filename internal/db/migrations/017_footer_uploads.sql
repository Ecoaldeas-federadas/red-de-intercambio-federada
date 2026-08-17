-- Migracion 017: Campos editables del footer (about, schedule) + uploads

-- Campos del footer editables desde el admin
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_about TEXT DEFAULT 'Mercado a cielo abierto para todo el publico en moneda local, agroecologia, trueque y soberania alimentaria en Caracas desde octubre de 2014.';
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS footer_schedule TEXT DEFAULT 'Primer sabado de cada mes (9:00 AM a 1:00 PM). Venta en moneda local.';

-- Tabla para almacenar imagenes subidas
CREATE TABLE IF NOT EXISTS uploaded_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(100) DEFAULT 'image/jpeg',
    file_size BIGINT DEFAULT 0,
    url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_images_created ON uploaded_images(created_at DESC);
