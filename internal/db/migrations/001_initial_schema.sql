-- Federated Mutual Credit System - Initial Schema
-- Compatible with YugabyteDB / PostgreSQL

-- Users (accounts: individual, organization, public_institution, fund)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'individual',
  organization_subtype TEXT,
  member_level_id TEXT,
  has_voice BOOLEAN NOT NULL DEFAULT true,
  has_vote BOOLEAN NOT NULL DEFAULT true,
  counts_in_quorum BOOLEAN NOT NULL DEFAULT true,
  membership_status TEXT NOT NULL DEFAULT 'pending',
  admitted_at TIMESTAMPTZ,
  balance BIGINT NOT NULL DEFAULT 0,
  credit_limit BIGINT NOT NULL DEFAULT -50000,
  debit_limit BIGINT NOT NULL DEFAULT 50000,
  annual_budget_limit BIGINT,
  tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID[],
  public_key TEXT,
  encrypted_private_key BYTEA,
  encryption_key_salt BYTEA,
  required_signatures INT NOT NULL DEFAULT 1,
  authorized_signers UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, username)
);

-- WebAuthn passkeys
CREATE TABLE IF NOT EXISTS user_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL,
  public_key BYTEA NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- NFC cards
CREATE TABLE IF NOT EXISTS nfc_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_uid TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_type TEXT NOT NULL,
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  sender_node TEXT,
  receiver_node TEXT,
  amount BIGINT NOT NULL,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  tax_target_account UUID REFERENCES users(id),
  user_signature TEXT,
  node_signature TEXT,
  multi_sig_signatures JSONB DEFAULT '[]',
  multi_sig_required INT DEFAULT 1,
  prev_hash TEXT,
  current_hash TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Ledger entries (double entry)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  account_id UUID NOT NULL REFERENCES users(id),
  entry_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  account_category TEXT NOT NULL,
  counterpart_node TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Node config (key-value store)
CREATE TABLE IF NOT EXISTS node_config (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member levels
CREATE TABLE IF NOT EXISTS member_levels (
  id TEXT PRIMARY KEY,
  node_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INT NOT NULL,
  has_voice BOOLEAN NOT NULL DEFAULT true,
  has_vote BOOLEAN NOT NULL DEFAULT true,
  counts_in_quorum BOOLEAN NOT NULL DEFAULT true,
  credit_limit BIGINT NOT NULL DEFAULT -20000,
  debit_limit BIGINT NOT NULL DEFAULT 20000,
  per_transaction_limit BIGINT,
  daily_limit BIGINT,
  monthly_limit BIGINT,
  tax_rate DECIMAL(5,4),
  auto_upgrade_after_days INT,
  upgrade_to TEXT,
  can_create_organization BOOLEAN NOT NULL DEFAULT false,
  can_cross_node_trade BOOLEAN NOT NULL DEFAULT true,
  can_receive_nfc_card BOOLEAN NOT NULL DEFAULT true,
  can_view_audit BOOLEAN NOT NULL DEFAULT true,
  can_use_external_bridge BOOLEAN NOT NULL DEFAULT false,
  max_organizations INT NOT NULL DEFAULT 0,
  can_request_limit_increase BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, id)
);

-- Member groups
CREATE TABLE IF NOT EXISTS member_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  group_type TEXT NOT NULL,
  institution_id UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member group members
CREATE TABLE IF NOT EXISTS member_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES member_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Approval rules
CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  institution_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  applies_to TEXT[] NOT NULL,
  conditions JSONB NOT NULL,
  amount_threshold JSONB,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approval signatures
CREATE TABLE IF NOT EXISTS approval_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  assembly_decision_id UUID REFERENCES assembly_decisions(id),
  admission_request_id UUID,
  signer_id UUID NOT NULL REFERENCES users(id),
  signature TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  group_id UUID REFERENCES member_groups(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admission requests
CREATE TABLE IF NOT EXISTS admission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  proposed_username TEXT NOT NULL,
  display_name TEXT,
  contact_info JSONB,
  proposed_level TEXT DEFAULT 'new',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_user_id UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membership history
CREATE TABLE IF NOT EXISTS membership_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  old_level TEXT,
  new_level TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  approved_by UUID[],
  decision_reference UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Federation global config
CREATE TABLE IF NOT EXISTS federation_global_config (
  id SERIAL PRIMARY KEY,
  node_global_credit_limit BIGINT NOT NULL,
  node_global_debit_limit BIGINT NOT NULL,
  node_bilateral_base_limit BIGINT NOT NULL,
  warning_threshold_1 INT NOT NULL DEFAULT 80,
  warning_threshold_2 INT NOT NULL DEFAULT 90,
  warning_threshold_3 INT NOT NULL DEFAULT 95,
  parity_suggestion_threshold INT NOT NULL DEFAULT 80,
  updated_by_assembly UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bilateral limits
CREATE TABLE IF NOT EXISTS bilateral_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_node TEXT NOT NULL,
  remote_node TEXT NOT NULL,
  credit_limit BIGINT NOT NULL,
  debit_limit BIGINT NOT NULL,
  is_customized BOOLEAN NOT NULL DEFAULT false,
  local_approved BOOLEAN NOT NULL DEFAULT false,
  local_approved_by UUID[],
  local_approved_at TIMESTAMPTZ,
  remote_confirmed BOOLEAN NOT NULL DEFAULT false,
  remote_approved_by UUID[],
  remote_approved_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(local_node, remote_node)
);

-- Bilateral limit history
CREATE TABLE IF NOT EXISTS bilateral_limit_history (
  id BIGSERIAL PRIMARY KEY,
  local_node TEXT NOT NULL,
  remote_node TEXT NOT NULL,
  old_credit_limit BIGINT,
  new_credit_limit BIGINT,
  old_debit_limit BIGINT,
  new_debit_limit BIGINT,
  change_reason TEXT,
  approved_by UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Node balance (multilateral)
CREATE TABLE IF NOT EXISTS node_balance (
  remote_node TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_sync TIMESTAMPTZ,
  last_hash TEXT
);

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'internal',
  unit TEXT NOT NULL,
  quantity_per_batch INT NOT NULL DEFAULT 1,
  energy_direct BIGINT NOT NULL DEFAULT 0,
  energy_human BIGINT NOT NULL DEFAULT 0,
  energy_inputs BIGINT NOT NULL DEFAULT 0,
  energy_amortization BIGINT NOT NULL DEFAULT 0,
  energy_total BIGINT GENERATED ALWAYS AS (energy_direct + energy_human + energy_inputs + energy_amortization) STORED,
  price_per_unit BIGINT NOT NULL DEFAULT 0,
  external_price_usd DECIMAL(10,2),
  external_logistics_pct DECIMAL(5,2) DEFAULT 0,
  external_tax_rate DECIMAL(5,2) DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID[],
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product price history
CREATE TABLE IF NOT EXISTS product_price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price BIGINT,
  new_price BIGINT,
  old_energy_total BIGINT,
  new_energy_total BIGINT,
  change_reason TEXT,
  approved_by UUID[],
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product producers
CREATE TABLE IF NOT EXISTS product_producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES users(id),
  producer_energy_direct BIGINT NOT NULL DEFAULT 0,
  producer_energy_human BIGINT NOT NULL DEFAULT 0,
  producer_energy_inputs BIGINT NOT NULL DEFAULT 0,
  producer_energy_amortization BIGINT NOT NULL DEFAULT 0,
  producer_energy_total BIGINT GENERATED ALWAYS AS (producer_energy_direct + producer_energy_human + producer_energy_inputs + producer_energy_amortization) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, producer_id)
);

-- Energy tariff
CREATE TABLE IF NOT EXISTS energy_tariff (
  id SERIAL PRIMARY KEY,
  node_domain TEXT NOT NULL,
  vital_food BIGINT NOT NULL DEFAULT 800,
  vital_water BIGINT NOT NULL DEFAULT 150,
  vital_domestic BIGINT NOT NULL DEFAULT 350,
  vital_services BIGINT NOT NULL DEFAULT 200,
  work_hours_per_day INT NOT NULL DEFAULT 6,
  work_days_per_month INT NOT NULL DEFAULT 24,
  effort_admin DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  effort_technical DECIMAL(3,2) NOT NULL DEFAULT 1.15,
  effort_agricultural DECIMAL(3,2) NOT NULL DEFAULT 1.3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain)
);

-- Conversion factor
CREATE TABLE IF NOT EXISTS conversion_factor (
  id BIGSERIAL PRIMARY KEY,
  node_domain TEXT NOT NULL,
  reference_product_id UUID REFERENCES products(id),
  internal_cost BIGINT NOT NULL,
  external_price_usd DECIMAL(10,2) NOT NULL,
  factor DECIMAL(10,4) NOT NULL,
  external_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.30,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID[],
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- External bridge operations
CREATE TABLE IF NOT EXISTS external_bridge_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  internal_value BIGINT NOT NULL,
  external_value_usd DECIMAL(10,2) NOT NULL,
  fc_applied DECIMAL(10,4),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID[],
  buyer_seller TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- External bridge (legacy)
CREATE TABLE IF NOT EXISTS external_bridge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  product_description TEXT,
  quantity DECIMAL(10,2),
  internal_amount BIGINT,
  external_amount DECIMAL(10,2),
  external_currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  public_key TEXT NOT NULL,
  certificate_pem TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multi-sig approvals
CREATE TABLE IF NOT EXISTS multi_sig_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_type TEXT NOT NULL,
  from_account UUID NOT NULL REFERENCES users(id),
  to_account UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  required_signatures INT NOT NULL,
  collected_signatures JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- Assembly sessions
CREATE TABLE IF NOT EXISTS assembly_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  session_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  participants UUID[],
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assembly decisions
CREATE TABLE IF NOT EXISTS assembly_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assembly_sessions(id),
  decision_type TEXT NOT NULL,
  target_account UUID REFERENCES users(id),
  description TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  required_signatures INT NOT NULL,
  collected_signatures JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processed messages (idempotency)
CREATE TABLE IF NOT EXISTS processed_messages (
  id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_node TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON user_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_nfc_user ON nfc_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_origin ON products(origin);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_producers_product ON product_producers(product_id);
CREATE INDEX IF NOT EXISTS idx_bilateral_local ON bilateral_limits(local_node);
CREATE INDEX IF NOT EXISTS idx_bilateral_remote ON bilateral_limits(remote_node);
CREATE INDEX IF NOT EXISTS idx_admission_status ON admission_requests(status);
CREATE INDEX IF NOT EXISTS idx_membership_history_user ON membership_history(user_id);

-- Insert default federation global config if not exists
INSERT INTO federation_global_config (node_global_credit_limit, node_global_debit_limit, node_bilateral_base_limit)
SELECT -1000000, 1000000, 500000
WHERE NOT EXISTS (SELECT 1 FROM federation_global_config);
