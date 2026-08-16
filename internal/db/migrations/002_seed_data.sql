-- Seed data: default member levels and energy tariff

-- Insert default member levels
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate, auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade, can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase, is_system)
VALUES
  ('honorary', 'default', 'Miembro Honorario', 'Invitados, colaboradores externos', 0, true, false, false, -10000, 10000, 5000, 20000, 100000, 0.01, NULL, NULL, false, false, true, true, false, 0, false, true),
  ('new', 'default', 'Miembro Nuevo', 'Recien admitido, limites reducidos', 1, true, true, true, -20000, 20000, 10000, 50000, 200000, 0.01, 90, 'active', false, true, true, true, false, 0, true, true),
  ('active', 'default', 'Miembro Activo', 'Miembro pleno con topes completos', 2, true, true, true, -50000, 50000, NULL, NULL, NULL, 0.01, NULL, NULL, true, true, true, true, true, 3, true, true)
ON CONFLICT (node_domain, id) DO NOTHING;

-- Insert default energy tariff
INSERT INTO energy_tariff (node_domain, vital_food, vital_water, vital_domestic, vital_services, work_hours_per_day, work_days_per_month, effort_admin, effort_technical, effort_agricultural)
VALUES ('default', 800, 150, 350, 200, 6, 24, 1.0, 1.15, 1.3)
ON CONFLICT (node_domain) DO NOTHING;

-- Insert default system products
INSERT INTO products (node_domain, name, category, origin, unit, quantity_per_batch, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_unit, is_approved, is_system)
VALUES
  ('default', 'Granos basicos (maiz, frijol) 1kg', 'alimentos', 'internal', 'kg', 1, 10, 60, 15, 5, 90, true, true),
  ('default', 'Harina de maiz 50kg', 'alimentos', 'internal', 'saco', 1, 500, 5000, 2000, 2500, 10000, true, true),
  ('default', 'Verduras frescas 1kg', 'alimentos', 'internal', 'kg', 1, 5, 30, 10, 5, 50, true, true),
  ('default', 'Miel 1L', 'alimentos', 'internal', 'litro', 1, 50, 2000, 800, 650, 3500, true, true),
  ('default', 'Prenda artesanal (lana/algodon)', 'textiles', 'internal', 'unidad', 1, 100, 3000, 800, 300, 4200, true, true),
  ('default', 'Tela de algodon 1m', 'textiles', 'internal', 'm', 1, 50, 800, 500, 150, 1500, true, true),
  ('default', 'Hora de labor agricola', 'servicios', 'internal', 'hora', 1, 0, 325, 0, 0, 325, true, true),
  ('default', 'Hora de labor administrativa', 'servicios', 'internal', 'hora', 1, 0, 250, 0, 0, 250, true, true),
  ('default', 'Hora de labor tecnica', 'servicios', 'internal', 'hora', 1, 0, 287, 0, 0, 287, true, true),
  ('default', '1 kWh electrico', 'energeticos', 'internal', 'kWh', 1, 100, 0, 0, 0, 100, true, true),
  ('default', 'Biogas 1m3', 'energeticos', 'internal', 'm3', 1, 400, 0, 0, 0, 400, true, true)
ON CONFLICT DO NOTHING;
