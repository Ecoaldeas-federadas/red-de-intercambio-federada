-- Migracion 176: Backfill de traducciones inglesas del contenido seed.
--
-- Puebla content_translations con traducciones inglesas reales para el contenido
-- mas visible que ya tiene fuentes registradas (migraciones 173-174): niveles de
-- miembro, niveles de organizacion, constantes federadas, categorias de calculadora
-- y reglas de gobernanza. Los productos seed y demas contenido quedaran como
-- `missing` y se traduciran desde el editor de traducciones.
--
-- La migracion es idempotente: usa ON CONFLICT para no sobrescribir traducciones
-- existentes que un traductor ya haya guardado manualmente.

-- Niveles de miembro: traducciones de name y description.
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT s.translation_key, 'en',
  CASE s.field_name
    WHEN 'name' THEN
      CASE s.source_text
        WHEN 'Miembro Honorario' THEN 'Honorary Member'
        WHEN 'Miembro Nuevo' THEN 'New Member'
        WHEN 'Miembro Activo' THEN 'Active Member'
        WHEN 'Miembro nuevo recien admitido. Sin voto ni voz hasta ser promovido.' THEN 'New member recently admitted. No voice or vote until promoted.'
        WHEN 'Miembro activo con voz y voto. Participa en asamblea.' THEN 'Active member with voice and vote. Participates in assembly.'
        WHEN 'Miembro honorario con voz pero sin voto ni obligacion de quorum.' THEN 'Honorary member with voice but no vote or quorum obligation.'
        ELSE s.source_text
      END
    WHEN 'description' THEN
      CASE s.source_text
        WHEN 'Invitados, colaboradores externos' THEN 'Guests, external collaborators'
        WHEN 'Recien admitido, limites reducidos' THEN 'Recently admitted, reduced limits'
        WHEN 'Miembro pleno con topes completos' THEN 'Full member with complete limits'
        ELSE s.source_text
      END
    ELSE s.source_text
  END,
  s.source_hash, NOW()
FROM content_translation_sources s
WHERE s.entity_type = 'member_level'
  AND s.source_language = 'es'
  AND s.is_active = true
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW()
WHERE content_translations.value = '' OR content_translations.value IS NULL;

-- Niveles de organizacion: traducciones de name y description.
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT s.translation_key, 'en',
  CASE s.field_name
    WHEN 'name' THEN
      CASE s.source_text
        WHEN 'Organizacion Nueva' THEN 'New Organization'
        WHEN 'Organizacion Activa' THEN 'Active Organization'
        WHEN 'Organizacion Honoraria' THEN 'Honorary Organization'
        ELSE s.source_text
      END
    ELSE s.source_text
  END,
  s.source_hash, NOW()
FROM content_translation_sources s
WHERE s.entity_type = 'organization_level'
  AND s.source_language = 'es'
  AND s.is_active = true
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW()
WHERE content_translations.value = '' OR content_translations.value IS NULL;

-- Constantes federadas: traducciones de description.
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT s.translation_key, 'en',
  CASE s.source_text
    WHEN 'Costo de la canasta basica interna en TQ. Es el mismo en todos los nodos. Solo se puede cambiar via propuesta federada aprobada.' THEN 'Cost of the internal basic basket in TQ. It is the same in all nodes. It can only be changed via an approved federated proposal.'
    WHEN 'Porcentaje de nodos que deben aprobar un cambio federado para que se aplique. Por defecto 75% (mayoria). Se puede cambiar a 100% o cualquier otro valor via propuesta federada.' THEN 'Percentage of nodes that must approve a federated change for it to apply. Default 75% (majority). Can be changed to 100% or any other value via federated proposal.'
    WHEN 'Dias para que una propuesta expire si no alcanza consenso.' THEN 'Days for a proposal to expire if it does not reach consensus.'
    ELSE s.source_text
  END,
  s.source_hash, NOW()
FROM content_translation_sources s
WHERE s.entity_type = 'federation_constant'
  AND s.source_language = 'es'
  AND s.is_active = true
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW()
WHERE content_translations.value = '' OR content_translations.value IS NULL;

-- Categorias de calculadora: traducciones de name.
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT s.translation_key, 'en',
  CASE s.source_text
    WHEN 'Trabajo Humano' THEN 'Human Labor'
    WHEN 'Materias Primas' THEN 'Raw Materials'
    WHEN 'Insumos' THEN 'Inputs'
    WHEN 'Amortizacion Herramientas' THEN 'Tool Amortization'
    WHEN 'Energia Directa' THEN 'Direct Energy'
    ELSE s.source_text
  END,
  s.source_hash, NOW()
FROM content_translation_sources s
WHERE s.entity_type = 'calculator_category'
  AND s.source_language = 'es'
  AND s.is_active = true
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW()
WHERE content_translations.value = '' OR content_translations.value IS NULL;

-- Reglas de gobernanza: traducciones de title mas comunes.
INSERT INTO content_translations (translation_key, language, value, source_hash, updated_at)
SELECT s.translation_key, 'en',
  CASE s.source_text
    WHEN 'Ley de la Aldea' THEN 'Village Law'
    WHEN 'Principios Fundamentales' THEN 'Fundamental Principles'
    WHEN 'Admision de Miembros' THEN 'Member Admission'
    WHEN 'Gobernanza de la Asamblea' THEN 'Assembly Governance'
    WHEN 'Derechos y Deberes' THEN 'Rights and Duties'
    WHEN 'Gestion de Recursos' THEN 'Resource Management'
    WHEN 'Resolucion de Conflictos' THEN 'Conflict Resolution'
    WHEN 'Modificacion de Reglas' THEN 'Rule Modification'
    ELSE s.source_text
  END,
  s.source_hash, NOW()
FROM content_translation_sources s
WHERE s.entity_type = 'governance_rule'
  AND s.field_name = 'title'
  AND s.source_language = 'es'
  AND s.is_active = true
ON CONFLICT (translation_key, language) DO UPDATE SET
  value = EXCLUDED.value,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW()
WHERE content_translations.value = '' OR content_translations.value IS NULL;
