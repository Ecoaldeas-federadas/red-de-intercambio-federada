-- Migracion 108: Horarios de comercio configurables por nodo
-- Permite que cada nodo configure cuando se permiten transacciones comerciales
-- y cuando se bloquean (ej: adventistas bloquean del viernes al sabado al ponerse el sol)
-- Cada nodo configura sus propios horarios. No afecta a otros nodos.

CREATE TABLE IF NOT EXISTS commerce_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL DEFAULT 'localhost',
    -- Nombre descriptivo (ej: "Reposo del Sabado", "Dia de descanso", etc.)
    name TEXT NOT NULL,
    -- Si esta regla esta activa
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Dia de la semana: 0=Domingo, 1=Lunes, ..., 6=Sabado
    -- Si es NULL, aplica a todos los dias
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    -- Hora de inicio del bloqueo (formato 24h: "18:00")
    -- Si es NULL, el bloqueo empieza a medianoche
    start_time TEXT,
    -- Hora de fin del bloqueo (formato 24h: "18:00")
    -- Si es NULL, el bloqueo termina a medianoche
    end_time TEXT,
    -- Si start_time > end_time, significa que el bloqueo cruza medianoche
    -- (ej: viernes 18:00 -> sabado 18:00)
    -- Para esto, usar dos reglas o usar el campo crosses_midnight
    crosses_midnight BOOLEAN NOT NULL DEFAULT false,
    -- Dia de la semana de fin (para bloqueos que cruzan dias)
    -- Si crosses_midnight es true y end_day_of_week es distinto de day_of_week,
    -- el bloqueo va desde day_of_week start_time hasta end_day_of_week end_time
    end_day_of_week INTEGER CHECK (end_day_of_week >= 0 AND end_day_of_week <= 6),
    -- Tipo de bloqueo:
    -- 'block_all' = bloquear todas las transacciones
    -- 'block_sales' = bloquear solo ventas (permitir transferencias entre miembros)
    -- 'block_purchases' = bloquear solo compras
    block_type TEXT NOT NULL DEFAULT 'block_all' CHECK (block_type IN ('block_all', 'block_sales', 'block_purchases')),
    -- Mensaje a mostrar cuando se bloquea (ej: "Santificando el Sabado. Las transacciones se reanudaran al ponerse el sol.")
    block_message TEXT NOT NULL DEFAULT 'Las transacciones estan bloqueadas en este horario.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_schedule_node ON commerce_schedule (node_domain, is_active);

-- Configuracion global del nodo sobre horarios de comercio
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS commerce_hours_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public_settings ADD COLUMN IF NOT EXISTS commerce_hours_message TEXT DEFAULT '';

-- Configuracion por defecto: desactivado (cada nodo lo activa si lo necesita)
-- La Feria Conuquera NO tiene esto activado - funciona los primeros sabados de cada mes
-- como siempre. Cada nodo decide independientemente.
