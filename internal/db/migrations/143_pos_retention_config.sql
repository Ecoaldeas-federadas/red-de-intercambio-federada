-- Migracion 143: Configuracion de retencion de datos POS
-- Purga automatica: transacciones y turnos mayores a retention_days se borran.
-- El admin puede configurar retention_days (default 365 = 1 ano).
-- Se ejecuta cada 24h automaticamente.

CREATE TABLE IF NOT EXISTS pos_retention_config (
    id SERIAL PRIMARY KEY,
    node_domain TEXT NOT NULL UNIQUE,
    retention_days INT NOT NULL DEFAULT 365,
    last_purge_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar configuracion por defecto para el nodo local (__LOCAL__)
INSERT INTO pos_retention_config (node_domain, retention_days, enabled)
VALUES ('__LOCAL__', 365, true)
ON CONFLICT (node_domain) DO NOTHING;
