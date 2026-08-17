-- Migracion 011: Niveles de miembro preconfigurados y cuenta de fondo

-- Insertar niveles por defecto si no existen
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, credit_limit, debit_limit, is_active)
SELECT gen_random_uuid(), 'localhost', name, desc_text, lvl, voice, vote, quorum, credit, debit, true
FROM (VALUES
  ('nuevo', 'Miembro nuevo recien admitido. Sin voto ni voz hasta ser promovido.', 1, false, false, false, -100, 100),
  ('activo', 'Miembro activo con voz y voto. Participa en asamblea.', 5, true, true, true, -500, 500),
  ('honorario', 'Miembro honorario con voz pero sin voto ni obligacion de quorum.', 3, true, false, false, -200, 200)
) AS t(name, desc_text, lvl, voice, vote, quorum, credit, debit)
WHERE NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = 'localhost' LIMIT 1);

-- Crear cuenta de fondo comunitario si no existe
-- Nota: la tabla users no tiene columna is_active; usa membership_status='active'
INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, balance, credit_limit, debit_limit)
SELECT gen_random_uuid(), 'localhost', 'fondo_comunitario', 'Fondo Comunitario', 'fund', 'active', 0, 0, 999999999
WHERE NOT EXISTS (SELECT 1 FROM users WHERE account_type = 'fund' AND node_domain = 'localhost');

-- Crear cuenta de impuestos si no existe (separada del fondo general)
INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, balance, credit_limit, debit_limit)
SELECT gen_random_uuid(), 'localhost', 'impuestos', 'Cuenta de Impuestos', 'fund', 'active', 0, 0, 999999999
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'impuestos' AND node_domain = 'localhost');

-- Tipos de organizacion predefinidos
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, credit_limit, debit_limit, is_active)
SELECT gen_random_uuid(), 'localhost', name, desc_text, lvl, false, false, false, credit, debit, true
FROM (VALUES
  ('org_produccion', 'Organizacion de produccion. Fabrica o produce bienes.', 1, -100000, 100000),
  ('org_consumo', 'Organizacion de consumo. Compra bienes para distribuir.', 1, -50000, 50000),
  ('org_publica', 'Institucion publica. Sin fines de lucro, exenta de impuestos.', 1, -1000000, 1000000),
  ('org_cooperativa', 'Cooperativa. Propiedad compartida de miembros.', 1, -200000, 200000)
) AS t(name, desc_text, lvl, credit, debit)
WHERE NOT EXISTS (SELECT 1 FROM member_levels WHERE name LIKE 'org_%' AND node_domain = 'localhost' LIMIT 1);
