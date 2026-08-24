-- Migracion 102: Comercio Exterior - Cuentas bancarias, compras y ventas detalladas
--
-- El Comercio Exterior (DEX) necesita:
-- 1. Cuentas bancarias externas (dinero REAL: USD, EUR, COP, etc.)
-- 2. Registro detallado de compras (import) y ventas (export)
-- 3. Recalculo de canasta basica real desde compras reales

-- Cuentas bancarias externas del DEX
-- Puede ser cuenta bancaria o efectivo en caja
CREATE TABLE IF NOT EXISTS external_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  account_name TEXT NOT NULL,          -- nombre descriptivo: "Banco Nacional USD", "Caja efectivo COP"
  bank_name TEXT,                      -- nombre del banco (NULL si es efectivo)
  account_number TEXT,                 -- numero de cuenta (NULL si es efectivo)
  currency TEXT NOT NULL DEFAULT 'USD', -- moneda: USD, EUR, COP, etc.
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,  -- saldo en la moneda de la cuenta
  is_cash BOOLEAN NOT NULL DEFAULT false,    -- true = efectivo en caja, false = cuenta bancaria
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_bank_accounts_domain ON external_bank_accounts(node_domain);

-- Configuracion del Comercio Exterior
CREATE TABLE IF NOT EXISTS external_commerce_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES users(id),  -- cuenta-organizacion del DEX
  requires_multisig BOOLEAN NOT NULL DEFAULT true,
  required_signatures INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compras externas detalladas (import)
CREATE TABLE IF NOT EXISTS external_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  operation_id UUID REFERENCES external_bridge_operations(id),  -- operacion DEX asociada
  product_name TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL,
  unit TEXT,
  unit_cost_external DECIMAL(10,2) NOT NULL,   -- precio por unidad en moneda externa
  currency TEXT NOT NULL DEFAULT 'USD',
  total_external DECIMAL(14,2) NOT NULL,        -- total en moneda externa
  bank_account_id UUID REFERENCES external_bank_accounts(id),  -- de donde salio el dinero
  exchange_rate_used DECIMAL(10,4) NOT NULL,    -- FC usado para conversion
  total_local_tq BIGINT NOT NULL,               -- total en TQ local
  suggested_internal_price DECIMAL(10,2),       -- precio interno sugerido por unidad
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,                                -- proveedor/vendedor externo
  invoice_number TEXT,                          -- numero de factura
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending, approved, rejected, completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID[]
);

CREATE INDEX IF NOT EXISTS idx_external_purchases_domain ON external_purchases(node_domain);
CREATE INDEX IF NOT EXISTS idx_external_purchases_status ON external_purchases(status);

-- Ventas externas detalladas (export)
CREATE TABLE IF NOT EXISTS external_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  operation_id UUID REFERENCES external_bridge_operations(id),
  product_name TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL,
  unit TEXT,
  unit_price_external DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  total_external DECIMAL(14,2) NOT NULL,
  bank_account_id UUID REFERENCES external_bank_accounts(id),  -- a donde entro el dinero
  exchange_rate_used DECIMAL(10,4) NOT NULL,
  total_local_tq BIGINT NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  buyer TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID[]
);

CREATE INDEX IF NOT EXISTS idx_external_sales_domain ON external_sales(node_domain);
CREATE INDEX IF NOT EXISTS idx_external_sales_status ON external_sales(status);

-- Recalculo de canasta basica real desde compras
CREATE TABLE IF NOT EXISTS external_basket_recalculation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  basket_cost_external_real DECIMAL(14,2),  -- promedio ponderado de compras reales
  currency TEXT NOT NULL DEFAULT 'USD',
  basket_cost_local_tq BIGINT NOT NULL,
  suggested_fc DECIMAL(10,4) NOT NULL,
  previous_fc DECIMAL(10,4),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_basket_recalc_domain ON external_basket_recalculation(node_domain);
