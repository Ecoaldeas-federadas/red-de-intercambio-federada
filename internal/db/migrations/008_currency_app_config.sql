-- Migracion 008: Campos de configuracion de moneda y nombre de app

ALTER TABLE node_config ADD COLUMN IF NOT EXISTS currency_name VARCHAR(50) DEFAULT 'TQ';
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS app_name VARCHAR(255) DEFAULT 'Red de Intercambio';

-- Permiso para gestionar configuracion
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
VALUES ('config.manage', 'Gestionar configuracion del nodo (moneda, nombre, tarifa, niveles)', 'admin', false, 1)
ON CONFLICT (name) DO NOTHING;

-- Tabla energy_tariff puede no tener node_domain como UNIQUE
-- Asegurar que existe el constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'energy_tariff_node_domain_key'
    ) THEN
        ALTER TABLE energy_tariff ADD CONSTRAINT energy_tariff_node_domain_key UNIQUE (node_domain);
    END IF;
END $$;
