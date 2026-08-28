-- 132_user_preferences.sql
-- Preferencias de formato por usuario (locale, formato de fecha/hora/numero).
-- El sistema almacena los montos en centavos (1.00 TQ = 100). Actualmente todo
-- el formato esta hardcodeado al locale espanol. Esta tabla permite configurar
-- los formatos de numero, fecha y hora por usuario, con defaults a nivel nodo.

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locale TEXT NOT NULL DEFAULT 'es',
    number_locale TEXT NOT NULL DEFAULT 'es-VE',
    date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    time_format TEXT NOT NULL DEFAULT '24h',
    first_day_of_week INT NOT NULL DEFAULT 1,
    timezone TEXT NOT NULL DEFAULT 'America/Caracas',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los defaults a nivel nodo se guardan en node_config.settings JSONB bajo la
-- clave "format_settings". Se usan como fallback cuando un usuario no ha
-- configurado sus propias preferencias. El admin puede configurarlos via
-- PUT /api/config enviando "format_settings" dentro del body.
--
-- Estructura esperada en node_config.settings->'format_settings':
-- {
--   "locale": "es",
--   "number_locale": "es-VE",
--   "date_format": "DD/MM/YYYY",
--   "time_format": "24h",
--   "first_day_of_week": 1,
--   "timezone": "America/Caracas"
-- }
