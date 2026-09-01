-- Migracion 155: Niveles de miembro con solo voz (sin voto) y limites altos
--
-- El usuario pidio niveles que tengan derecho a voz pero NO a voto,
-- con limites mas altos. El limite del nivel es el maximo que se puede
-- asignar a alguien en ese nivel, pero se puede asignar un monto inferior.
--
-- Estos niveles coexisten con los existentes sin romper la gobernanza.

-- Nivel: Miembro con Voz (sin voto)
-- Limite alto pero sin derecho a voto en asambleas
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
    credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
    auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
    can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
    can_request_limit_increase, is_system)
SELECT gen_random_uuid(), 'localhost', 'voz', 'Miembro con Voz - Sin derecho a voto pero con limite alto',
    3, true, false, false,
    -50000, 50000, 10000, 20000, 100000, 0,
    0, '', false, true,
    true, false, false, 1,
    true, false
WHERE NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = 'localhost' AND name = 'voz');

-- Nivel: Miembro Activo con Voz (sin voto, limite mas alto)
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
    credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
    auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
    can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
    can_request_limit_increase, is_system)
SELECT gen_random_uuid(), 'localhost', 'voz_plena', 'Miembro con Voz Plena - Sin voto, limite muy alto, participacion plena',
    4, true, false, false,
    -100000, 100000, 20000, 50000, 200000, 0,
    0, '', true, true,
    true, true, false, 3,
    true, false
WHERE NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = 'localhost' AND name = 'voz_plena');
