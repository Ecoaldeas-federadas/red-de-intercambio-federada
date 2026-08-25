-- Migracion 111: Contabilidad departamental
-- Permite que departamentos/comisiones tengan su propia contabilidad
-- para comunidades con economias compartidas (hutteritas, bruderhof, etc.)
-- donde los balances individuales no aplican.
-- No afecta a nodos existentes ni a la Feria Conuquera.

CREATE TABLE IF NOT EXISTS department_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    -- Nombre de la cuenta (ej: "Fondo de semillas", "Caja chica")
    name TEXT NOT NULL,
    -- Tipo: asset, liability, income, expense, equity
    account_type TEXT NOT NULL DEFAULT 'asset',
    -- Balance actual en TQ (o la unidad del nodo)
    balance BIGINT NOT NULL DEFAULT 0,
    -- Limites
    credit_limit BIGINT DEFAULT 0,
    debit_limit BIGINT DEFAULT 0,
    -- Si la cuenta esta activa
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_accounts_dept ON department_accounts (department_id, is_active);
CREATE INDEX IF NOT EXISTS idx_department_accounts_domain ON department_accounts (node_domain, is_active);

-- Transacciones departamentales (entradas/salidas/transferencias)
CREATE TABLE IF NOT EXISTS department_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES department_accounts(id) ON DELETE CASCADE,
    -- Tipo: input, output, transfer, labor, budget
    tx_type TEXT NOT NULL DEFAULT 'input',
    -- Cantidad en TQ (positivo para input, negativo para output)
    amount BIGINT NOT NULL,
    -- Descripcion
    description TEXT,
    -- Referencia a producto o servicio (opcional)
    product_ref TEXT,
    -- Usuario que registro la transaccion
    registered_by UUID REFERENCES users(id),
    -- Aprobado por (para gobernanza)
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    -- Si requiere aprobacion
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    -- Metadata adicional (JSON)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_tx_dept ON department_transactions (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dept_tx_account ON department_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dept_tx_domain ON department_transactions (node_domain, created_at DESC);

-- Presupuestos departamentales
CREATE TABLE IF NOT EXISTS department_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    -- Periodo: monthly, quarterly, yearly
    period TEXT NOT NULL DEFAULT 'monthly',
    -- Fecha de inicio del periodo
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Presupuesto de ingresos
    income_budget BIGINT NOT NULL DEFAULT 0,
    -- Presupuesto de gastos
    expense_budget BIGINT NOT NULL DEFAULT 0,
    -- Presupuesto de trabajo (horas)
    labor_hours_budget BIGINT NOT NULL DEFAULT 0,
    -- Estado: draft, approved, active, closed
    status TEXT NOT NULL DEFAULT 'draft',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_budgets_dept ON department_budgets (department_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dept_budgets_domain ON department_budgets (node_domain, status);
