-- Migracion 112: Registro de trabajo comunitario (cayapa/minga/voluntariado)
-- Permite registrar sesiones de trabajo comunitario, tareas, participantes,
-- duracion, habilidades, y valoracion configurable (horas, TQ, sin valoracion).
-- Soporta gobernanza: las sesiones pueden requerir aprobacion.
-- No afecta a nodos existentes ni a la Feria Conuquera.

CREATE TABLE IF NOT EXISTS community_work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Departamento/comision responsable (opcional)
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    -- Nombre de la sesion (ej: "Cayapa de cosecha", "Minga de construccion")
    name TEXT NOT NULL,
    -- Descripcion
    description TEXT,
    -- Tipo: cayapa, minga, volunteer, work_party, seva
    work_type TEXT NOT NULL DEFAULT 'cayapa',
    -- Fecha y duracion
    session_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    -- Duracion en horas (calculada o manual)
    duration_hours NUMERIC(10,2) DEFAULT 0,
    -- Ubicacion
    location TEXT,
    -- Valoracion: hours_only, tq, no_valuation, departmental
    valuation_type TEXT NOT NULL DEFAULT 'hours_only',
    -- TQ por hora (si valuation_type = 'tq')
    tq_per_hour NUMERIC(10,2) DEFAULT 0,
    -- Estado: planned, in_progress, completed, approved, cancelled
    status TEXT NOT NULL DEFAULT 'planned',
    -- Organizador
    organized_by UUID REFERENCES users(id),
    -- Aprobacion
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    -- Resultados/outputs
    outputs TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_domain ON community_work_sessions (node_domain, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_sessions_dept ON community_work_sessions (department_id, status);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON community_work_sessions (node_domain, status);

-- Tareas dentro de una sesion de trabajo
CREATE TABLE IF NOT EXISTS community_work_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES community_work_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- Habilidad requerida (ej: "carpinteria", "agricultura", "cocina")
    required_skill TEXT,
    -- Numero de personas necesarias
    people_needed INT DEFAULT 1,
    -- Duracion estimada en horas
    estimated_hours NUMERIC(10,2) DEFAULT 0,
    -- Estado: pending, assigned, in_progress, completed
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_session ON community_work_tasks (session_id, status);

-- Participantes en una sesion de trabajo
CREATE TABLE IF NOT EXISTS community_work_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES community_work_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Tarea asignada (opcional)
    task_id UUID REFERENCES community_work_tasks(id) ON DELETE SET NULL,
    -- Horas trabajadas
    hours_worked NUMERIC(10,2) DEFAULT 0,
    -- TQ creditados (si aplica)
    tq_credited NUMERIC(10,2) DEFAULT 0,
    -- Habilidades aportadas
    skills TEXT,
    -- Estado: registered, attended, completed, credited
    status TEXT NOT NULL DEFAULT 'registered',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_participants_session ON community_work_participants (session_id, status);
CREATE INDEX IF NOT EXISTS idx_work_participants_user ON community_work_participants (user_id, registered_at DESC);

-- Registro de habilidades de usuarios (para asignar tareas)
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    proficiency TEXT DEFAULT 'intermediate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_domain ON user_skills (node_domain, skill_name);
