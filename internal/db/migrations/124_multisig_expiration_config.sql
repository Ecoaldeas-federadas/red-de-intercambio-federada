-- Migracion 124: Cambiar expiracion de pagos multi-sig a 10 minutos (configurable)
--
-- El tiempo de expiracion por defecto era 24 horas, lo cual es absurdo
-- para un pago en un punto de venta. Ahora es 10 minutos por defecto
-- y configurable por el administrador del nodo.

-- Cambiar el default a 10 minutos
ALTER TABLE pending_multisig_payments
    ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '10 minutes');

-- Tabla de configuracion multi-sig por nodo
CREATE TABLE IF NOT EXISTS multisig_config (
    node_domain TEXT PRIMARY KEY,
    -- Tiempo de expiracion en minutos (default 10)
    expiration_minutes INT NOT NULL DEFAULT 10,
    -- Si enviar notificaciones a los firmantes
    notify_signers BOOLEAN NOT NULL DEFAULT true,
    -- Mensaje de notificacion (plantilla)
    notification_message TEXT NOT NULL DEFAULT 'Tienes un pago pendiente que requiere tu firma. Ingresa al sistema para confirmar.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar config por defecto para nodos existentes que tengan pagos multi-sig
INSERT INTO multisig_config (node_domain, expiration_minutes)
SELECT DISTINCT node_domain, 10 FROM pending_multisig_payments
ON CONFLICT (node_domain) DO NOTHING;
