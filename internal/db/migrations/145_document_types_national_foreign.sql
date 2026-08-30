-- 145_document_types_national_foreign.sql
-- Separar cedula nacional (V) y extranjera (E) en tipos distintos
-- para que el POS solo pida el numero, sin necesidad de escribir la letra.
-- El tipo de documento (seleccionado en el perfil) define si es V o E.

INSERT INTO document_types (code, name, spanish_name, is_international, sort_order) VALUES
('cedula_v', 'National ID (V)', 'Cedula de identidad (V - Nacional)', false, 1),
('cedula_e', 'National ID (E)', 'Cedula de identidad (E - Extranjero)', false, 2)
ON CONFLICT (code) DO NOTHING;

-- Mover el sort_order de los tipos existentes para que los nuevos queden primero
UPDATE document_types SET sort_order = 3 WHERE code = 'cedula';
UPDATE document_types SET sort_order = 4 WHERE code = 'dni';
UPDATE document_types SET sort_order = 5 WHERE code = 'pasaporte';
UPDATE document_types SET sort_order = 6 WHERE code = 'rut';
UPDATE document_types SET sort_order = 7 WHERE code = 'curp';
UPDATE document_types SET sort_order = 8 WHERE code = 'carnet_conducir';
UPDATE document_types SET sort_order = 9 WHERE code = 'cedula_juridica';
UPDATE document_types SET sort_order = 10 WHERE code = 'residencia';
UPDATE document_types SET sort_order = 11 WHERE code = 'refugiado';
UPDATE document_types SET sort_order = 99 WHERE code = 'otro';
