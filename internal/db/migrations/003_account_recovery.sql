-- Account Recovery System
-- Configurable approval: assembly, council, multi_sig, department

-- Recovery configuration (per node, configurable by assembly)
CREATE TABLE IF NOT EXISTS recovery_config (
  id SERIAL PRIMARY KEY,
  node_domain TEXT NOT NULL UNIQUE,
  approval_mode TEXT NOT NULL DEFAULT 'multi_sig',
  required_approvals INT NOT NULL DEFAULT 3,
  council_group_id UUID REFERENCES member_groups(id),
  auto_expire_hours INT NOT NULL DEFAULT 72,
  requires_identity_verification BOOLEAN NOT NULL DEFAULT true,
  updated_by_assembly UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recovery requests
CREATE TABLE IF NOT EXISTS recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id),
  target_username TEXT NOT NULL,
  requester_id UUID REFERENCES users(id),
  requester_ip INET,
  reason TEXT NOT NULL,
  identity_verification JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  approval_mode TEXT NOT NULL DEFAULT 'multi_sig',
  required_approvals INT NOT NULL DEFAULT 3,
  council_group_id UUID REFERENCES member_groups(id),
  approved_by UUID[] NOT NULL DEFAULT '{}',
  rejected_by UUID[] NOT NULL DEFAULT '{}',
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  new_public_key TEXT,
  new_passkey_credential_id BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recovery approval votes/signatures
CREATE TABLE IF NOT EXISTS recovery_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_request_id UUID NOT NULL REFERENCES recovery_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id),
  approval_type TEXT NOT NULL,
  signature TEXT,
  group_id UUID REFERENCES member_groups(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recovery_request_id, approver_id)
);

-- Invitation codes for initial registration
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  max_uses INT NOT NULL DEFAULT 1,
  use_count INT NOT NULL DEFAULT 0,
  proposed_level TEXT DEFAULT 'new',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Device registration log (tracks first and subsequent device registrations)
CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passkey_id UUID REFERENCES user_passkeys(id) ON DELETE CASCADE,
  device_label TEXT,
  device_type TEXT,
  registration_type TEXT NOT NULL DEFAULT 'initial',
  registered_from_device UUID REFERENCES user_passkeys(id),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_target ON recovery_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON recovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_recovery_node ON recovery_requests(node_domain);
CREATE INDEX IF NOT EXISTS idx_recovery_approvals_req ON recovery_approvals(recovery_request_id);
CREATE INDEX IF NOT EXISTS idx_recovery_approvals_approver ON recovery_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_hash ON invitation_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_active ON invitation_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_reg_user ON device_registrations(user_id);

-- Insert default recovery config
INSERT INTO recovery_config (node_domain, approval_mode, required_approvals)
SELECT 'default', 'multi_sig', 3
WHERE NOT EXISTS (SELECT 1 FROM recovery_config);
