-- Migracion 116: FRNE (Fair exit), planificacion biodinamica, toggle pagina adaptaciones
-- Tres funcionalidades faltantes:
-- 1. FRNE: modulo de liquidacion para socios que se retiran de la comunidad
-- 2. Calendario biodinamico para planificacion agricola (Camphill, Steiner)
-- 3. Toggle para activar/desactivar la pagina publica /p/adaptaciones por nodo

-- ============================================================
-- 1. FRNE - Fair exit / Salida Justa al Retirarse
-- ============================================================
-- Resuelve como liquidar de forma no especulativa la vivienda de un socio
-- que decide retirarse de la comunidad, sin descapitalizar el fondo comun.
-- El socio recibe el valor de su aporte original (ajustado por inflacion TQ)
-- mas el valor de las mejoras que hizo, pero NO el valor especulativo
-- de la propiedad (que pertenece a la comunidad).

CREATE TABLE IF NOT EXISTS frne_exit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Usuario que solicita retirarse
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Vivienda/propiedad que ocupa (descripcion, no necesariamente un producto)
    property_description TEXT,
    -- Fecha de ingreso a la comunidad
    join_date DATE,
    -- Fecha solicitada de salida
    requested_exit_date DATE,
    -- Aporte original en TQ (lo que pago al ingresar)
    original_contribution_tq DECIMAL(10,2) DEFAULT 0,
    -- Mejoras realizadas por el socio (en TQ, valoradas por la asamblea)
    improvements_value_tq DECIMAL(10,2) DEFAULT 0,
    -- Valor especulativo de la propiedad (NO se paga al socio)
    speculative_value_tq DECIMAL(10,2) DEFAULT 0,
    -- Total a pagar al socio = original + mejoras (no especulativo)
    total_payout_tq DECIMAL(10,2) DEFAULT 0,
    -- Estado: pending, assembly_review, approved, paid, disputed, cancelled
    status TEXT NOT NULL DEFAULT 'pending',
    -- Metodo de pago: lump_sum (pago unico), installments (cuotas), transfer_to_newcomer (nuevo socio paga)
    payout_method TEXT DEFAULT 'lump_sum',
    -- Numero de cuotas si es installments
    installments_count INT DEFAULT 1,
    -- Notas de la asamblea
    assembly_notes TEXT,
    -- Aprobado por (usuario_id de quien aprueba)
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frne_user ON frne_exit_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_frne_status ON frne_exit_requests (node_domain, status);

-- Pagos de FRNE en cuotas
CREATE TABLE IF NOT EXISTS frne_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_request_id UUID NOT NULL REFERENCES frne_exit_requests(id) ON DELETE CASCADE,
    installment_number INT NOT NULL,
    amount_tq DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    paid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exit_request_id, installment_number)
);

-- ============================================================
-- 2. Calendario biodinamico
-- ============================================================
-- Planificacion agricola basada en calendario biodinamico (Rudolf Steiner).
-- Dias de raiz, flor, hoja, fruto segun posicion de la luna en constelaciones.
-- Cada nodo puede activarlo y configurar que cultivos sigue.

CREATE TABLE IF NOT EXISTS biodynamic_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Fecha del dia
    calendar_date DATE NOT NULL,
    -- Tipo de dia: root, flower, leaf, fruit
    -- root = dias ideales para raices (zanahoria, papa, rabano)
    -- flower = dias ideales para flores y medicinales (manzanilla, calendula)
    -- leaf = dias ideales para hojas (lechuga, espinaca, hierbas)
    -- fruit = dias ideales para frutos (tomate, pimenton, calabaza)
    day_type TEXT NOT NULL,
    -- Constelacion asociada (Tierra, Aire, Agua, Fuego)
    constellation TEXT,
    -- Si es dia de node (no trabajar la tierra)
    is_node_day BOOLEAN DEFAULT false,
    -- Notas
    notes TEXT,
    UNIQUE(node_domain, calendar_date)
);

CREATE INDEX IF NOT EXISTS idx_biodynamic_date ON biodynamic_calendar (node_domain, calendar_date);

-- Configuracion del calendario biodinamico por nodo
CREATE TABLE IF NOT EXISTS biodynamic_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL UNIQUE,
    -- Si el calendario biodinamico esta activo
    is_active BOOLEAN NOT NULL DEFAULT false,
    -- Si mostrar el calendario en la pagina publica
    show_in_public_page BOOLEAN NOT NULL DEFAULT false,
    -- Notas sobre la practica biodinamica del nodo
    practice_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Toggle pagina de adaptaciones
-- ============================================================
-- Permite que cada nodo active o desactive la pagina publica /p/adaptaciones
-- y el menu que la enlaza. Por defecto esta activa.

CREATE TABLE IF NOT EXISTS public_page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL UNIQUE,
    -- Pagina de adaptaciones
    adaptations_page_active BOOLEAN NOT NULL DEFAULT true,
    -- Otras paginas publicas que se pueden togglear en el futuro
    -- (extensible sin migracion nueva)
    extra_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar configuracion por defecto para el nodo local
INSERT INTO public_page_settings (node_domain, adaptations_page_active)
VALUES ('__LOCAL__', true)
ON CONFLICT (node_domain) DO NOTHING;
