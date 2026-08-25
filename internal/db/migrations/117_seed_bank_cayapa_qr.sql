-- Migracion 117: Banco de Semillas + Asistencia Cayapa NFC/QR + Toggle QR
-- Adaptaciones especificas para la Feria Conuquera de Caracas:
-- 1. Banco de Semillas Criollas (prestamo con retorno fisico)
-- 2. Asistencia masiva a cayapas via NFC o QR
-- 3. Toggle para activar/desactivar QR cuando hay NFC disponible

-- ============================================================
-- 1. BANCO DE SEMILLAS CRIOLLAS
-- ============================================================
-- El banco de semillas funciona con prestamo y devolucion:
-- el agricultor retira semillas, las siembra, y al cosechar devuelve
-- la misma cantidad mas un porcentaje adicional (ej: 20% mas)
-- para que el banco crezca comunitariamente.

CREATE TABLE IF NOT EXISTS seed_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Usuario que toma el prestamo
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Producto del catalogo (la semilla)
    product_id UUID,
    -- Nombre de la semilla (ej: "Maiz cariaco", "Frijol bayo")
    seed_name TEXT NOT NULL,
    -- Cantidad prestada
    quantity_borrowed NUMERIC(12,2) NOT NULL,
    -- Unidad (ej: "sobres", "kg", "gramos")
    unit TEXT DEFAULT 'sobres',
    -- Cantidad esperada de retorno (ej: cantidad * 1.20 = 20% mas)
    expected_return_qty NUMERIC(12,2) NOT NULL,
    -- Cantidad ya devuelta
    returned_qty NUMERIC(12,2) DEFAULT 0,
    -- Porcentaje de retorno solidario (ej: 20 = 20%)
    return_percentage NUMERIC(5,2) DEFAULT 20.0,
    -- Estado: active, returned, overdue, defaulted
    status TEXT NOT NULL DEFAULT 'active',
    -- Fecha del prestamo
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Fecha limite de retorno (ej: 6 meses despues)
    due_date TIMESTAMPTZ,
    -- Fecha real de retorno completo
    returned_at TIMESTAMPTZ,
    -- Quien autorizo el prestamo (responsable de bioinsumos)
    authorized_by UUID REFERENCES users(id),
    -- Notas
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_loans_user ON seed_loans (user_id, status);
CREATE INDEX IF NOT EXISTS idx_seed_loans_domain ON seed_loans (node_domain, status);

-- Registro de devoluciones parciales
CREATE TABLE IF NOT EXISTS seed_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES seed_loans(id) ON DELETE CASCADE,
    -- Cantidad devuelta en esta devolucion
    quantity_returned NUMERIC(12,2) NOT NULL,
    -- Quien recibe la devolucion
    received_by UUID REFERENCES users(id),
    -- Notas
    notes TEXT,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_returns_loan ON seed_returns (loan_id);

-- ============================================================
-- 2. ASISTENCIA A CAYAPAS VIA NFC/QR
-- ============================================================
-- Extiende community_work_sessions con soporte para asistencia masiva.
-- El coordinador crea la cayapa, los participantes se registran
-- acercando su tarjeta NFC o mostrando su codigo QR.
-- El encargado escanea el QR de cada participante para validar.

-- Anadir columnas a community_work_sessions para soporte de asistencia
ALTER TABLE community_work_sessions ADD COLUMN IF NOT EXISTS attendance_method TEXT DEFAULT 'manual';
-- manual, nfc, qr, nfc_qr

ALTER TABLE community_work_sessions ADD COLUMN IF NOT EXISTS check_in_open BOOLEAN DEFAULT false;
ALTER TABLE community_work_sessions ADD COLUMN IF NOT EXISTS check_out_open BOOLEAN DEFAULT false;
ALTER TABLE community_work_sessions ADD COLUMN IF NOT EXISTS check_in_code TEXT;
-- Codigo unico para la sesion (para QR de asistencia)

-- Tabla de check-in/check-out por participante
CREATE TABLE IF NOT EXISTS cayapa_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES community_work_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Metodo usado: nfc, qr, manual
    method TEXT NOT NULL DEFAULT 'manual',
    -- Hora de entrada
    check_in_at TIMESTAMPTZ,
    -- Hora de salida
    check_out_at TIMESTAMPTZ,
    -- Horas trabajadas (calculado al hacer check-out)
    hours_worked NUMERIC(5,2) DEFAULT 0,
    -- TQ acreditados (calculado al cerrar la cayapa)
    tq_credited NUMERIC(10,2) DEFAULT 0,
    -- Quien registro (el encargado/coordinador)
    registered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cayapa_attendance_session ON cayapa_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_cayapa_attendance_user ON cayapa_attendance (user_id);

-- ============================================================
-- 3. TOGGLE QR / NFC
-- ============================================================
-- Permite que cada nodo decida si usa QR, NFC, o ambos.
-- Cuando hay NFC disponible, se puede desactivar QR.
-- Cuando no hay NFC, se activa QR como alternativa.

CREATE TABLE IF NOT EXISTS attendance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL UNIQUE,
    -- Si el codigo QR esta habilitado para asistencia
    qr_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Si NFC esta habilitado para asistencia
    nfc_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Si se requiere check-in y check-out (o solo check-in)
    require_check_out BOOLEAN NOT NULL DEFAULT false,
    -- Factor de esfuerzo agricola (ej: 1.3 = 30% mas TQ por trabajo fisico)
    effort_factor NUMERIC(3,2) DEFAULT 1.0,
    -- Si la acreditacion de TQ es automatica al cerrar la cayapa
    auto_credit_on_close BOOLEAN NOT NULL DEFAULT true,
    -- Cuenta de la que se debita el TQ (ej: asamblea, comision)
    debit_account_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuracion por defecto
INSERT INTO attendance_config (node_domain, qr_enabled, nfc_enabled)
VALUES ('__LOCAL__', true, true)
ON CONFLICT (node_domain) DO NOTHING;

-- ============================================================
-- 4. SEED DATA: COMISIONES DE LA FERIA CONUQUERA
-- ============================================================
-- Las comisiones reales de la Feria Conuquera de Caracas:
-- Logistica, Comunicacion, Bioinsumos, Cultura, Articulacion
-- Solo se crean si no existen ya (no sobreescribe).

INSERT INTO departments (node_domain, name, description, group_type)
SELECT '__LOCAL__', 'Comision de Logistica', 'Montaje, transporte y coordinacion de espacios en Parque Los Caobos. Logistica de ferias y eventos.', 'committee'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE node_domain = '__LOCAL__' AND name = 'Comision de Logistica');

INSERT INTO departments (node_domain, name, description, group_type)
SELECT '__LOCAL__', 'Comision de Comunicacion', 'Redes sociales, prensa, difusion y comunicacion interna de la red.', 'committee'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE node_domain = '__LOCAL__' AND name = 'Comision de Comunicacion');

INSERT INTO departments (node_domain, name, description, group_type)
SELECT '__LOCAL__', 'Comision de Bioinsumos', 'Control de calidad agroecologica, banco de semillas criollas, produccion de bioinsumos.', 'committee'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE node_domain = '__LOCAL__' AND name = 'Comision de Bioinsumos');

INSERT INTO departments (node_domain, name, description, group_type)
SELECT '__LOCAL__', 'Comision de Cultura', 'Musica, tarima, actividades culturales, rescate de tradiciones conuqueras.', 'committee'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE node_domain = '__LOCAL__' AND name = 'Comision de Cultura');

INSERT INTO departments (node_domain, name, description, group_type)
SELECT '__LOCAL__', 'Comision de Articulacion', 'Enlaces con Pueblo a Pueblo, Cecosesola, y otras redes agroecologicas.', 'committee'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE node_domain = '__LOCAL__' AND name = 'Comision de Articulacion');
