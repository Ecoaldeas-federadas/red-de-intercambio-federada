-- Migration 004: NFC Terminals, Departments, Permissions
-- Compatible with YugabyteDB / PostgreSQL

-- ============================================================
-- PART 1: Departments, Roles and Permissions
-- ============================================================

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'department',
  head_user_id UUID REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, name)
);

-- Department roles
CREATE TABLE IF NOT EXISTS department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, name)
);

-- Department members (users assigned to departments with a role)
CREATE TABLE IF NOT EXISTS department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES department_roles(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, user_id)
);

-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  requires_multisig BOOLEAN NOT NULL DEFAULT false,
  required_approvals INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role permissions (permissions granted to a role)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES department_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- User permissions (direct override, bypassing roles)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, permission_id)
);

-- Seed permissions
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
VALUES
  ('nfc.issue_card', 'Emitir tarjeta NFC a usuario', 'nfc', false, 1),
  ('nfc.deactivate_card', 'Desactivar tarjeta NFC', 'nfc', false, 1),
  ('nfc.reset_pin', 'Resetear PIN de tarjeta', 'nfc', false, 1),
  ('nfc.register_terminal', 'Registrar terminal ESP32', 'nfc', false, 1),
  ('nfc.deactivate_terminal', 'Desactivar terminal', 'nfc', false, 1),
  ('nfc.view_transactions', 'Ver transacciones NFC', 'nfc', false, 1),
  ('accounts.approve_admission', 'Aprobar admision de miembro', 'accounts', true, 2),
  ('accounts.reject_admission', 'Rechazar admision', 'accounts', false, 1),
  ('accounts.change_level', 'Cambiar nivel de miembro', 'accounts', true, 2),
  ('federation.set_limits', 'Establecer limites bilaterales', 'federation', true, 2),
  ('federation.change_config', 'Cambiar config de federacion', 'federation', true, 2),
  ('assembly.create_session', 'Crear sesion de asamblea', 'assembly', false, 1),
  ('assembly.sign_decision', 'Firmar decision de asamblea', 'assembly', false, 1),
  ('recovery.configure', 'Configurar recuperacion', 'recovery', true, 2),
  ('recovery.approve', 'Aprobar recuperacion de cuenta', 'recovery', false, 1),
  ('org.approve', 'Aprobar organizacion', 'org', true, 2),
  ('org.budget_increase', 'Aumentar presupuesto', 'org', true, 2),
  ('external.approve_operation', 'Aprobar operacion externa', 'external', true, 2),
  ('external.recalculate_fc', 'Recalcular factor de conversion', 'external', true, 2),
  ('dept.manage', 'Gestionar departamentos y roles', 'admin', true, 2),
  ('dept.assign_members', 'Asignar miembros a departamentos', 'admin', false, 1)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PART 2: NFC Terminal Infrastructure
-- ============================================================

-- NFC server keys (for mutual ECDH)
CREATE TABLE IF NOT EXISTS nfc_server_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  private_key_encrypted BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFC terminals
CREATE TABLE IF NOT EXISTS nfc_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  terminal_id TEXT NOT NULL UNIQUE,
  label TEXT,
  terminal_type TEXT NOT NULL DEFAULT 'keypad',
  location TEXT,
  wifi_ssid TEXT,
  terminal_public_key TEXT,
  server_public_key TEXT,
  registration_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ,
  firmware_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFC card cryptographic keys
CREATE TABLE IF NOT EXISTS nfc_card_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid TEXT NOT NULL UNIQUE,
  node_domain TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL DEFAULT 'uid_only',
  secret_key_encrypted BYTEA,
  hmac_counter BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

-- NFC terminal sessions
CREATE TABLE IF NOT EXISTS nfc_terminal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID NOT NULL REFERENCES nfc_terminals(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  merchant_user_id UUID REFERENCES users(id),
  current_amount BIGINT,
  status TEXT NOT NULL DEFAULT 'idle',
  seller_card_uid TEXT,
  seller_pin_verified BOOLEAN NOT NULL DEFAULT false,
  buyer_card_uid TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFC transactions log
CREATE TABLE IF NOT EXISTS nfc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID NOT NULL REFERENCES nfc_terminals(id),
  card_uid TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  amount BIGINT NOT NULL,
  status TEXT NOT NULL,
  crypto_token TEXT,
  pin_verified BOOLEAN NOT NULL DEFAULT false,
  transaction_type TEXT NOT NULL DEFAULT 'single',
  seller_user_id UUID REFERENCES users(id),
  buyer_user_id UUID REFERENCES users(id),
  server_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFC card PIN attempts
CREATE TABLE IF NOT EXISTS nfc_card_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid TEXT NOT NULL UNIQUE,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ
);

-- Alter nfc_cards to add card_type, crypto, PIN fields
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'uid_only';
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS crypto_enabled BOOLEAN DEFAULT false;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS pin_attempts INT DEFAULT 0;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS last_token_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nfc_terminals_node ON nfc_terminals(node_domain);
CREATE INDEX IF NOT EXISTS idx_nfc_terminals_type ON nfc_terminals(terminal_type);
CREATE INDEX IF NOT EXISTS idx_nfc_card_keys_user ON nfc_card_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_transactions_terminal ON nfc_transactions(terminal_id);
CREATE INDEX IF NOT EXISTS idx_nfc_transactions_user ON nfc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_department_members_user ON department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_department_members_dept ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_terminal_sessions_token ON nfc_terminal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_nfc_terminal_sessions_status ON nfc_terminal_sessions(status);

-- User credentials (password-based auth for setup wizard and admin login)
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
