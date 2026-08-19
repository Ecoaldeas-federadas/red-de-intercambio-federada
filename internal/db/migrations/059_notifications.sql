-- Migracion 059: Modulo de notificaciones general
--
-- Crea un sistema unificado de notificaciones que reemplaza y amplía
-- el sistema parcial de assembly_notifications.
--
-- Incluye:
-- 1. Tabla notifications — notificaciones por usuario
-- 2. Tabla notification_channels — canales disponibles
-- 3. Tabla notification_gateway_config — configuracion de pasarelas
-- 4. Tabla notification_preferences — preferencias por usuario

-- ===== Tabla principal de notificaciones =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB,
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  channels_tried TEXT[],
  channels_delivered TEXT[],
  delivery_errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_domain ON notifications(node_domain);

-- ===== Canales disponibles =====
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  requires_config BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO notification_channels (channel_code, name, description, is_enabled, requires_config, sort_order) VALUES
  ('in_app', 'In-App', 'Notificaciones dentro de la aplicacion (campana)', true, false, 1),
  ('matrix', 'Matrix', 'Red federada soberana (Matrix Client-Server API). Compatible con Synapse, Dendrite, Conduit.', false, true, 2),
  ('telegram', 'Telegram', 'Bot de Telegram (Bot API). Facil de configurar.', false, true, 3),
  ('xmpp', 'XMPP', 'Red federada Jabber/XMPP (estandar abierto, self-hostable)', false, true, 4),
  ('email', 'Email', 'Correo electronico via SMTP (estandar abierto, universal)', false, true, 5),
  ('webpush', 'Web Push', 'Notificaciones push del navegador (W3C, sin terceros)', false, true, 6),
  ('whatsapp', 'WhatsApp', 'WhatsApp Cloud API o API propia (red proprietaria, opcional)', false, true, 7),
  ('webhook', 'Webhook', 'Webhook generico para integrar cualquier servicio via HTTP', false, true, 8)
ON CONFLICT (channel_code) DO NOTHING;

-- ===== Configuracion de pasarelas por nodo =====
CREATE TABLE IF NOT EXISTS notification_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  channel_code VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, channel_code)
);

-- ===== Preferencias por usuario =====
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  channel_code VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, notification_type, channel_code)
);

-- ===== Vista unificada: assembly_notifications + notifications =====
-- Para compatibilidad, las notificaciones de asamblea existentes siguen en assembly_notifications.
-- Las nuevas notificaciones van a notifications.
-- El frontend consulta ambas tablas y las unifica.

-- ===== Datos de contacto en users =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS matrix_user_id VARCHAR(255); -- ej: @usuario:homeserver.org
ALTER TABLE users ADD COLUMN IF NOT EXISTS xmpp_jid VARCHAR(255); -- ej: usuario@jabber.org
ALTER TABLE users ADD COLUMN IF NOT EXISTS webpush_subscription JSONB; -- suscripcion del navegador
