-- Migracion 060: Arreglar member_levels para usuarios cuyo nivel pertenece a otro node_domain
--
-- Problema: Al crear el usuario admin en setup.go, el member_level_id se seleccionaba
-- sin filtrar por node_domain, lo que podia asignar un nivel de 'default' o 'localhost'
-- a un usuario de otro dominio. Esto causaba "No se encontro tu nivel" en el perfil.
--
-- Solucion: Para cada node_domain que tiene usuarios pero no tiene niveles propios,
-- copiar los niveles desde un dominio origen ('default' o 'localhost').
-- Luego, para los usuarios cuyo member_level_id apunta a un nivel de otro dominio,
-- actualizar el member_level_id al nivel equivalente en su propio dominio.

-- Paso 1: Determinar un dominio origen que tenga niveles (preferir 'default', luego 'localhost')
-- y copiar sus niveles a cada dominio que tenga usuarios pero no tenga niveles.

-- Copiar desde 'default' a dominios sin niveles
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
    credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
    auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
    can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
    can_request_limit_increase, is_system, is_active)
SELECT gen_random_uuid(), d.node_domain,
    ml.name, ml.description, ml.level, ml.has_voice, ml.has_vote, ml.counts_in_quorum,
    ml.credit_limit, ml.debit_limit, ml.per_transaction_limit, ml.daily_limit, ml.monthly_limit, ml.tax_rate,
    ml.auto_upgrade_after_days, ml.upgrade_to, ml.can_create_organization, ml.can_cross_node_trade,
    ml.can_receive_nfc_card, ml.can_view_audit, ml.can_use_external_bridge, ml.max_organizations,
    ml.can_request_limit_increase, ml.is_system, ml.is_active
FROM (SELECT DISTINCT node_domain FROM users WHERE node_domain IS NOT NULL AND node_domain != '') d
CROSS JOIN member_levels ml
WHERE ml.node_domain = 'default'
  AND NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = d.node_domain);

-- Si no habia niveles en 'default', copiar desde 'localhost'
INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum,
    credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit, tax_rate,
    auto_upgrade_after_days, upgrade_to, can_create_organization, can_cross_node_trade,
    can_receive_nfc_card, can_view_audit, can_use_external_bridge, max_organizations,
    can_request_limit_increase, is_system, is_active)
SELECT gen_random_uuid(), d.node_domain,
    ml.name, ml.description, ml.level, ml.has_voice, ml.has_vote, ml.counts_in_quorum,
    ml.credit_limit, ml.debit_limit, ml.per_transaction_limit, ml.daily_limit, ml.monthly_limit, ml.tax_rate,
    ml.auto_upgrade_after_days, ml.upgrade_to, ml.can_create_organization, ml.can_cross_node_trade,
    ml.can_receive_nfc_card, ml.can_view_audit, ml.can_use_external_bridge, ml.max_organizations,
    ml.can_request_limit_increase, ml.is_system, ml.is_active
FROM (SELECT DISTINCT node_domain FROM users WHERE node_domain IS NOT NULL AND node_domain != '') d
CROSS JOIN member_levels ml
WHERE ml.node_domain = 'localhost'
  AND NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = d.node_domain)
  AND NOT EXISTS (SELECT 1 FROM member_levels WHERE node_domain = 'default');

-- Paso 2: Para usuarios cuyo member_level_id apunta a un nivel de otro dominio,
-- actualizar al nivel equivalente (mismo name) en su propio dominio
UPDATE users u
SET member_level_id = local_ml.id
FROM member_levels foreign_ml
JOIN member_levels local_ml ON local_ml.name = foreign_ml.name AND local_ml.node_domain = u.node_domain
WHERE u.member_level_id = foreign_ml.id
  AND foreign_ml.node_domain != u.node_domain
  AND local_ml.node_domain = u.node_domain;

-- Paso 3: Para usuarios cuyo member_level_id apunta a un nivel que ya no existe,
-- asignar el nivel mas alto de su propio dominio
UPDATE users u
SET member_level_id = (
    SELECT id FROM member_levels
    WHERE node_domain = u.node_domain AND is_active = true
    ORDER BY level DESC LIMIT 1
)
WHERE u.member_level_id IS NOT NULL
  AND u.member_level_id != ''
  AND NOT EXISTS (SELECT 1 FROM member_levels WHERE id = u.member_level_id)
  AND EXISTS (SELECT 1 FROM member_levels WHERE node_domain = u.node_domain AND is_active = true);
