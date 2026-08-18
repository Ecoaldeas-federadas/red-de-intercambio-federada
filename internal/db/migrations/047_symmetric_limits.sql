-- Migracion 047: Limites simetricos (positivo = negativo)
--
-- PROBLEMA: Los limites eran asimetricos (ej: -50 negativo, +500 positivo),
-- lo que favorecia recibir mas de lo que se da. En un sistema de moneda
-- saldo cero, los limites deben ser iguales para garantizar equidad.
--
-- CALCULO DE CANASTA BASICA MENSUAL (familia 4 personas):
-- Granos (8kg x 10 TQ) = 80
-- Arroz (4kg x 11 TQ) = 44
-- Harina (4kg x 10 TQ) = 40
-- Tuberculos (10kg x 2 TQ) = 20
-- Verduras (8kg x 2 TQ) = 16
-- Frutas (6kg x 2 TQ) = 12
-- Hojas verdes (2kg x 2 TQ) = 4
-- Leche (8L x 2 TQ) = 16
-- Huevos (3kg x 10 TQ) = 30
-- Pollo (4kg x 8 TQ) = 32
-- Pan (4kg x 5 TQ) = 20
-- Aceite (1L x 10 TQ) = 10
-- Papelon (2kg x 15 TQ) = 30
-- Agua (30 dias x 1 TQ) = 30
-- Servicios (30 dias x 2 TQ) = 60
-- TOTAL = ~444 TQ -> Redondeado a 500 TQ
--
-- Nuevos limites (simetricos):
-- Persona natural nueva: -500 / +500 (cubre 1 canasta basica mensual)
-- Persona natural activa: -1000 / +1000 (cubre 2 canastas basicas)
-- Persona natural honoraria: -500 / +500
-- Organizacion produccion: -5000 / +5000
-- Organizacion consumo: -3000 / +3000
-- Institucion publica: -10000 / +10000

-- Actualizar niveles de miembro existentes
UPDATE member_levels SET
  credit_limit = CASE
    WHEN name = 'nuevo' OR name = 'new' THEN -500
    WHEN name = 'activo' OR name = 'active' THEN -1000
    WHEN name = 'honorario' OR name = 'honorary' THEN -500
    ELSE credit_limit
  END,
  debit_limit = CASE
    WHEN name = 'nuevo' OR name = 'new' THEN 500
    WHEN name = 'activo' OR name = 'active' THEN 1000
    WHEN name = 'honorario' OR name = 'honorary' THEN 500
    ELSE debit_limit
  END
WHERE node_domain = 'localhost';

-- Actualizar niveles de organizacion existentes
UPDATE organization_levels SET
  credit_limit = CASE
    WHEN name = 'org_produccion' THEN -5000
    WHEN name = 'org_consumo' THEN -3000
    WHEN name = 'org_publica' THEN -10000
    ELSE credit_limit
  END,
  debit_limit = CASE
    WHEN name = 'org_produccion' THEN 5000
    WHEN name = 'org_consumo' THEN 3000
    WHEN name = 'org_publica' THEN 10000
    ELSE debit_limit
  END
WHERE node_domain = 'localhost';

-- Actualizar usuarios existentes con limites antiguos
-- Si tenian -100/+100, subir a -500/+500
UPDATE users SET
  credit_limit = -500,
  debit_limit = 500
WHERE node_domain = 'localhost'
  AND account_type = 'individual'
  AND credit_limit = -100
  AND debit_limit = 100;

-- Si tenian -500/+500, subir a -1000/+1000 (miembros activos)
UPDATE users SET
  credit_limit = -1000,
  debit_limit = 1000
WHERE node_domain = 'localhost'
  AND account_type = 'individual'
  AND credit_limit = -500
  AND debit_limit = 500
  AND membership_status = 'active';

-- Si tenian -200/+200, subir a -500/+500
UPDATE users SET
  credit_limit = -500,
  debit_limit = 500
WHERE node_domain = 'localhost'
  AND account_type = 'individual'
  AND credit_limit = -200
  AND debit_limit = 200;
