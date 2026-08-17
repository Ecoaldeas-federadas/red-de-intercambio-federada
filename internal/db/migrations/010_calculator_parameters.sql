-- Migracion 010: Parametros editables de la calculadora
-- Permite gestionar tipos de trabajo e insumos con categorias y subcategorias
-- Toda nueva entrada requiere aprobacion de asamblea

CREATE TABLE IF NOT EXISTS calculator_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  parameter_type TEXT NOT NULL,  -- 'work' o 'material'
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, parameter_type, name)
);

CREATE TABLE IF NOT EXISTS calculator_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  parameter_type TEXT NOT NULL,  -- 'work' o 'material'
  category TEXT NOT NULL,
  subcategory TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,                     -- 'kg', 'litros', 'horas', etc
  kwh_per_unit DECIMAL(10,4) NOT NULL,
  effort_factor DECIMAL(3,2) NOT NULL DEFAULT 1.0,  -- para tipos de trabajo
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_calc_params_search
  ON calculator_parameters (node_domain, parameter_type, category, is_active);

-- Datos iniciales: tipos de trabajo
INSERT INTO calculator_parameters (node_domain, parameter_type, category, name, description, unit, kwh_per_unit, effort_factor, approved)
SELECT 'localhost', 'work', category, name, description, 'horas', kwh_per_unit, 1.0, true
FROM (VALUES
  ('Agricultura', 'Siembra manual', 'Sembrar semillas a mano en el campo', 0.15),
  ('Agricultura', 'Cosecha manual', 'Recolectar frutos, verduras o granos a mano', 0.18),
  ('Agricultura', 'Cavado de tierra', 'Cavar o arar la tierra con pala/azadon', 0.22),
  ('Agricultura', 'Riego manual', 'Regar plantas con regadera o manguera', 0.12),
  ('Agricultura', 'Cuidado de animales', 'Alimentar, limpiar y cuidar animales', 0.10),
  ('Agricultura', 'Ordeño manual', 'Ordeñar vacas o cabras a mano', 0.14),
  ('Produccion de alimentos', 'Cocina a leña', 'Cocinar usando fogon o leña', 0.08),
  ('Produccion de alimentos', 'Cocina a gas', 'Cocinar usando estufa de gas', 0.06),
  ('Produccion de alimentos', 'Panaderia manual', 'Amasar, formar y hornear pan a mano', 0.12),
  ('Produccion de alimentos', 'Conservas y envasado', 'Preparar conservas, mermeladas, encurtidos', 0.10),
  ('Produccion de alimentos', 'Lacteos (queso/yogurt)', 'Elaborar queso, yogurt o mantequilla', 0.11),
  ('Produccion de alimentos', 'Molienda manual', 'Moler granos, cafe o especias a mano', 0.16),
  ('Artesania y manufactura', 'Costura a mano', 'Coser, bordar o tejer a mano', 0.07),
  ('Artesania y manufactura', 'Costura a maquina', 'Coser con maquina de coser electrica', 0.05),
  ('Artesania y manufactura', 'Carpinteria manual', 'Trabajar madera con herramientas manuales', 0.17),
  ('Artesania y manufactura', 'Carpinteria electrica', 'Trabajar madera con herramientas electricas', 0.09),
  ('Artesania y manufactura', 'Ceramica/alfareria', 'Modelar y cocer ceramica', 0.13),
  ('Artesania y manufactura', 'Herreria', 'Trabajar el metal con fragua', 0.20),
  ('Artesania y manufactura', 'Joyeria manual', 'Elaborar joyas a mano', 0.08),
  ('Construccion', 'Albañileria', 'Levantar muros, mezclar cemento', 0.19),
  ('Construccion', 'Pintura', 'Pintar paredes o superficies', 0.09),
  ('Construccion', 'Plomeria', 'Instalar o reparar tuberias', 0.11),
  ('Construccion', 'Electricidad', 'Instalar o reparar cableado electrico', 0.10),
  ('Servicios', 'Limpieza', 'Limpieza de espacios o viviendas', 0.06),
  ('Servicios', 'Cuidado de personas', 'Cuidar niños, ancianos o enfermos', 0.07),
  ('Servicios', 'Enseñanza', 'Dar clases o talleres', 0.05),
  ('Servicios', 'Transporte manual', 'Cargar y transportar objetos pesados', 0.14),
  ('Servicios', 'Reparaciones generales', 'Reparar electrodomesticos, muebles, etc', 0.10),
  ('Trabajo intelectual', 'Oficina/administracion', 'Trabajo de oficina, contabilidad, gestion', 0.03),
  ('Trabajo intelectual', 'Computacion/programacion', 'Trabajo con computadora', 0.04),
  ('Trabajo intelectual', 'Diseno/escritura', 'Disenar, escribir, crear contenido', 0.04)
) AS t(category, name, description, kwh_per_unit)
WHERE NOT EXISTS (SELECT 1 FROM calculator_parameters WHERE parameter_type = 'work' LIMIT 1);

-- Datos iniciales: insumos/materiales
INSERT INTO calculator_parameters (node_domain, parameter_type, category, name, description, unit, kwh_per_unit, effort_factor, approved)
SELECT 'localhost', 'material', category, name, description, unit, kwh_per_unit, 1.0, true
FROM (VALUES
  ('Energia', 'Agua potable', 'Agua para consumo o proceso', 'litros', 0.0003),
  ('Energia', 'Electricidad', 'Energia electrica de la red', 'kWh', 1.0),
  ('Energia', 'Gas natural', 'Gas natural de la red', 'm3', 10.5),
  ('Energia', 'Gas de cilindro', 'Gas en cilindro/GLP', 'kg', 13.9),
  ('Energia', 'Leña', 'Madera para combustion', 'kg', 4.0),
  ('Energia', 'Carbón', 'Carbon mineral o vegetal', 'kg', 8.0),
  ('Alimentos basicos', 'Sal', 'Sal de mesa', 'kg', 0.7),
  ('Alimentos basicos', 'Azúcar', 'Azucar refinada o cruda', 'kg', 1.5),
  ('Alimentos basicos', 'Harina de trigo', 'Harina de trigo', 'kg', 1.8),
  ('Alimentos basicos', 'Harina de maiz', 'Harina de maiz', 'kg', 1.6),
  ('Alimentos basicos', 'Arroz', 'Arroz', 'kg', 2.0),
  ('Alimentos basicos', 'Frijoles', 'Frijoles o porotos', 'kg', 2.2),
  ('Alimentos basicos', 'Aceite vegetal', 'Aceite para cocinar', 'litros', 5.0),
  ('Alimentos basicos', 'Leche', 'Leche fresca', 'litros', 0.8),
  ('Alimentos basicos', 'Huevos', 'Huevos de gallina', 'docena', 1.2),
  ('Materiales de construccion', 'Madera', 'Madera aserrada', 'kg', 2.5),
  ('Materiales de construccion', 'Cemento', 'Cemento portland', 'kg', 1.4),
  ('Materiales de construccion', 'Alambre/hierro', 'Alambre o hierro para construccion', 'kg', 8.5),
  ('Textiles', 'Tela de algodon', 'Tela de algodon', 'metros', 3.0),
  ('Textiles', 'Hilo', 'Hilo para coser', 'rollos', 0.5)
) AS t(category, name, description, unit, kwh_per_unit)
WHERE NOT EXISTS (SELECT 1 FROM calculator_parameters WHERE parameter_type = 'material' LIMIT 1);

-- Categorias iniciales
INSERT INTO calculator_categories (node_domain, parameter_type, name, description)
SELECT 'localhost', 'work', name, desc_text
FROM (VALUES
  ('Agricultura', 'Trabajos relacionados con la agricultura y ganaderia'),
  ('Produccion de alimentos', 'Elaboracion de alimentos y bebidas'),
  ('Artesania y manufactura', 'Trabajos manuales y artesanales'),
  ('Construccion', 'Construccion y reparaciones'),
  ('Servicios', 'Servicios diversos'),
  ('Trabajo intelectual', 'Trabajo intelectual y administrativo')
) AS t(name, desc_text)
WHERE NOT EXISTS (SELECT 1 FROM calculator_categories WHERE parameter_type = 'work' LIMIT 1);

INSERT INTO calculator_categories (node_domain, parameter_type, name, description)
SELECT 'localhost', 'material', name, desc_text
FROM (VALUES
  ('Energia', 'Fuentes de energia'),
  ('Alimentos basicos', 'Insumos alimentarios basicos'),
  ('Materiales de construccion', 'Materiales para construccion'),
  ('Textiles', 'Materiales textiles')
) AS t(name, desc_text)
WHERE NOT EXISTS (SELECT 1 FROM calculator_categories WHERE parameter_type = 'material' LIMIT 1);

-- Permiso para gestionar parametros de calculadora
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
VALUES ('calculator.manage_params', 'Gestionar parametros de la calculadora', 'pricing', true, 2)
ON CONFLICT (name) DO NOTHING;
