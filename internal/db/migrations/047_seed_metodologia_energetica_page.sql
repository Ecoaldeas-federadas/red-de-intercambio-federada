-- 047_seed_metodologia_energetica_page.sql
-- Inserta la pagina "Metodologia Energetica" directamente en la base de datos
-- para todos los nodos que ya tienen paginas publicas.
--
-- Esta pagina explica como se calculan los precios usando energia objetiva
-- (kWh/MJ) en vez de dinero, oro o mercado. Incluye:
-- - Historia: Ford y Edison (1921), Movimiento Tecnocratico (1930s), Howard Odum
-- - Como funciona: la formula fundamental, energia incorporada
-- - Quienes la usan: SolarCoin, Som Energia, ecoaldeas
-- - Catalogo de energia incorporada por material (ICE Database)
-- - Ejemplos practicos: pan artesanal, olla de barro
-- - Fuentes: ICE, Ecoinvent, Agribalyse, FAO, USDA, Pimentel

-- Paso 1: Insertar para 'localhost' (dominio por defecto usado por el sistema)
INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
VALUES ('localhost', 'metodologia-energetica', 'Metodologia Energetica',
'Como Calculamos los Precios: Energia Objetiva, no Dinero',
'[
  {
    "type": "hero",
    "badge": "1 TQ = 1 kWh = 3.6 MJ",
    "title": "Precios Basados en Energia, no en Mercado",
    "subtitle": "Nuestro sistema de precios no usa oro, dolares ni especulacion. Usa la energia fisica real invertida en producir cada bien.",
    "description": "El TQ no esta anclado al oro ni a ninguna moneda. Esta anclado al julio (J), la unidad universal de energia del Sistema Internacional. 1 TQ = 1 kWh = 3.6 megajulios (MJ). Esto hace que el valor sea objetivo, medible y auditable: cualquier persona puede verificar cuanta energia se invirtio en producir algo.",
    "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Por que Energia y no Dinero?",
    "subtitle": "El dinero se devalua, la energia no. El dinero se especula, la energia se mide.",
    "columns": 2,
    "items": [
      {
        "icon": "zap",
        "title": "Universal e invariable",
        "description": "El julio (J) es la unidad de energia del Sistema Internacional de Unidades (SI). Es la misma en Caracas, en Tokio y en la Luna. No depende de ningun gobierno, banco central ni mercado. 1 kWh siempre sera 3.6 MJ, sin importar la inflacion, la politica ni la especulacion.",
        "badge": "Universal"
      },
      {
        "icon": "scale",
        "title": "Objetivo y auditable",
        "description": "Cuando decimos que una olla de barro cuesta 8 TQ, cualquiera puede verificar el calculo: 2 kg de arcilla x 2.5 MJ/kg + 18 MJ de coccion + 3 horas de trabajo x 3.6 MJ/hora = 33.8 MJ = 9.4 TQ. No hay precio porque si: hay una formula transparente.",
        "badge": "Transparente"
      },
      {
        "icon": "trending-down",
        "title": "Sin inflacion ni devaluacion",
        "description": "El dinero fiduciario se devalua con la inflacion. El oro sube y baja con la especulacion. La energia incorporada en un producto no cambia: si hoy cuesta 5 kWh producir un kilo de pan, manana costara lo mismo (a menos que mejore la tecnologia, en cuyo caso baja, lo cual es bueno para todos).",
        "badge": "Sin inflacion"
      },
      {
        "icon": "leaf",
        "title": "Refleja el costo real del planeta",
        "description": "El precio de mercado no incluye el dano ambiental: la contaminacion, la deforestacion, el agotamiento de suelos. La energia incorporada si lo refleja: un producto transportado desde China tiene mas energia incorporada (combustible del barco) que uno producido localmente. El sistema energetico premia lo local y lo sostenible.",
        "badge": "Ecologico"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Historia: La Moneda Energetica",
    "subtitle": "La idea de usar energia como unidad de valor tiene mas de 100 anos de historia",
    "columns": 2,
    "items": [
      {
        "icon": "history",
        "title": "Ford y Edison (1921)",
        "description": "En diciembre de 1921, Henry Ford y Thomas Edison propusieron publicamente reemplazar el patron oro por una Moneda Energetica respaldada por la capacidad de generacion hidroelectrica de la presa Wilson Dam en Muscle Shoals, Alabama. El plan planteaba emitir dinero directamente indexado a 1.000.000 de caballos de fuerza generados por el rio Tennessee, argumentando que la electricidad constituia un valor verdadero e inamovible que liberaria al sistema productivo de los intereses bancarios y de los ciclos de inflacion fiduciaria.",
        "badge": "1921"
      },
      {
        "icon": "history",
        "title": "Movimiento Tecnocratico (1930s)",
        "description": "Durante la decada de 1930, el Movimiento Tecnocratico en Norteamerica, liderado por Howard Scott y Marion King Hubbert, formalizo la propuesta de reemplazar el sistema monetario por Certificados de Energia. En este modelo, la capacidad energetica total de la nacion se distribuia equitativamente entre los ciudadanos mediante creditos intransferibles denominados en unidades fisicas (Ergios o Julios), anulando la acumulacion especulativa.",
        "badge": "1930s"
      },
      {
        "icon": "history",
        "title": "Howard T. Odum (1970s)",
        "description": "Ecologo estadounidense que desarrollo el concepto de emergia (energy memory): la energia total incorporada en un producto o servicio. Su libro Energy Basis for Man and Nature (1976) es fundacional para la economia ecologica. La emergia cuantifica la energia solar equivalente necesaria para generar un flujo o producto, midiendo el trabajo gratuito de la biosfera.",
        "badge": "Emergia"
      },
      {
        "icon": "history",
        "title": "LETS y Clubes de Trueque",
        "description": "LETS (Local Exchange Trading System, 1983, Canada) creo el primer sistema de credito mutuo comunitario sin dinero. Los Clubes de Trueque argentinos (1995) llegaron a tener 500.000 participantes durante la crisis de 2001, demostrando que el credito mutuo funciona a gran escala.",
        "badge": "1983-2001"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "La Formula Fundamental",
    "subtitle": "Como se calcula el precio de cualquier producto",
    "columns": 1,
    "items": [
      {
        "icon": "calculator",
        "title": "Energia Total Incorporada",
        "description": "EE_total = E_directa + E_insumos + E_trabajo + E_transporte\n\nE_directa: energia consumida en el proceso (electricidad, gas, lena)\nE_insumos: energia incorporada en las materias primas usadas\nE_trabajo: energia humana invertida (horas x tarifa energetica)\nE_transporte: energia del traslado de materiales y producto final\n\nEl resultado en MJ se divide entre 3.6 para obtener TQ.\n\nEjemplo: Olla de barro de 2 kg\nMaterial: 2 kg x 2.5 MJ/kg = 5 MJ\nCoccion: 18 MJ\nTrabajo: 3 horas x 3.6 MJ/h = 10.8 MJ\nTotal: 33.8 MJ / 3.6 = 9.4 TQ -> precio: 8 TQ",
        "badge": "Formula"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Energia Incorporada por Material (ICE Database)",
    "subtitle": "Usamos el estandar internacional ICE Database de la University of Bath (UK)",
    "columns": 3,
    "items": [
      {
        "icon": "layers",
        "title": "Arcilla / Ceramica",
        "description": "2.5 MJ/kg = 0.7 TQ/kg. Fuente: ICE Database. Material fundamental para ollas, vasijas, construccion de bahareque.",
        "badge": "0.7 TQ/kg"
      },
      {
        "icon": "package",
        "title": "Madera blanda",
        "description": "0.3 MJ/kg = 0.08 TQ/kg. Madera secada al aire. Fuente: ICE Database. Usada en muebles, cercas, herramientas.",
        "badge": "0.08 TQ/kg"
      },
      {
        "icon": "package",
        "title": "Madera dura",
        "description": "2.0 MJ/kg = 0.56 TQ/kg. Madera secada en horno. Fuente: ICE Database. Usada en muebles finos, construccion.",
        "badge": "0.56 TQ/kg"
      },
      {
        "icon": "shirt",
        "title": "Algodon / Tela",
        "description": "143 MJ/kg = 39.7 TQ/kg. Fuente: ICE Database + Ecoinvent. La tela es uno de los materiales con mayor energia incorporada.",
        "badge": "39.7 TQ/kg"
      },
      {
        "icon": "shirt",
        "title": "Lana",
        "description": "67.5 MJ/kg = 18.75 TQ/kg. Fuente: ICE Database. Material natural para textiles, mantas, ropa de abrigo.",
        "badge": "18.75 TQ/kg"
      },
      {
        "icon": "droplet",
        "title": "Vidrio",
        "description": "12.7 MJ/kg = 3.5 TQ/kg. Fuente: ICE Database. Usado en envases retornables, ventanas, decoracion.",
        "badge": "3.5 TQ/kg"
      },
      {
        "icon": "file",
        "title": "Papel kraft",
        "description": "25 MJ/kg = 6.9 TQ/kg. Fuente: ICE Database. Usado en bolsas, embalaje, etiquetas.",
        "badge": "6.9 TQ/kg"
      },
      {
        "icon": "leaf",
        "title": "Fibra vegetal",
        "description": "0.5 MJ/kg = 0.14 TQ/kg. Estimacion comunitaria. Cesteria, sogas, artesanias con materiales del conuco.",
        "badge": "0.14 TQ/kg"
      },
      {
        "icon": "recycle",
        "title": "HDPE (plastico)",
        "description": "52.5 MJ/kg = 14.6 TQ/kg. Fuente: ICE Database + Ecoinvent. Tanques de agua, tuberias, envases.",
        "badge": "14.6 TQ/kg"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Energia Incorporada en Alimentos",
    "subtitle": "Datos de Agribalyse (Francia), USDA (EE.UU.) y Pimentel (Cornell)",
    "columns": 3,
    "items": [
      {
        "icon": "wheat",
        "title": "Trigo en grano",
        "description": "33.6 MJ/kg = 9.33 TQ/kg. Siembra mecanizada, sintesis de nitrogeno, cosecha y secado. Fuente: Agribalyse, USDA, Pimentel.",
        "badge": "9.33 TQ/kg"
      },
      {
        "icon": "wheat",
        "title": "Arroz procesado",
        "description": "39.5 MJ/kg = 10.97 TQ/kg. Bombeo de agua para inundacion, trilla y pulido. Fuente: Agribalyse, Ecoinvent, FAO.",
        "badge": "10.97 TQ/kg"
      },
      {
        "icon": "wheat",
        "title": "Maiz en grano",
        "description": "36.3 MJ/kg = 10.09 TQ/kg. Labranza, fertilizacion, cosecha y molienda. Fuente: Agribalyse, USDA.",
        "badge": "10.09 TQ/kg"
      },
      {
        "icon": "beef",
        "title": "Carne de vacuno",
        "description": "80-100 MJ/kg = 22-28 TQ/kg. Elevada tasa de conversion de grano/forraje (31.7 kg/kg). Fuente: Pimentel, Ecoinvent.",
        "badge": "22-28 TQ/kg"
      },
      {
        "icon": "beef",
        "title": "Carne de cerdo",
        "description": "47.5 MJ/kg = 13.19 TQ/kg. Conversion alimenticia (10.7 kg/kg), climatizacion de granjas. Fuente: USDA, Agribalyse.",
        "badge": "13.19 TQ/kg"
      },
      {
        "icon": "beef",
        "title": "Carne de pollo",
        "description": "30 MJ/kg = 8.33 TQ/kg. Conversion de pienso (4.2 kg/kg carne), incubacion y faenado. Fuente: Pimentel, Agribalyse.",
        "badge": "8.33 TQ/kg"
      },
      {
        "icon": "milk",
        "title": "Leche fresca",
        "description": "5-7 MJ/L = 1.47-1.67 TQ/L. Produccion de forraje, ordeno mecanico y pasteurizacion. Fuente: Ecoinvent, USDA.",
        "badge": "1.67 TQ/L"
      },
      {
        "icon": "egg",
        "title": "Huevos",
        "description": "34.4 MJ/kg = 9.57 TQ/kg. Mantenimiento termico/luminico de ponedoras y alimento concentrado. Fuente: Agribalyse.",
        "badge": "9.57 TQ/kg"
      },
      {
        "icon": "droplet",
        "title": "Aceite vegetal",
        "description": "34.9 MJ/L = 9.68 TQ/L. Prensado mecanico de oleaginosas, extraccion, refinado. Fuente: Ecoinvent, FAO.",
        "badge": "9.68 TQ/L"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Trabajo Humano: Tarifa Energetica",
    "subtitle": "El trabajo humano se valora segun la energia vital que sostiene al trabajador",
    "columns": 2,
    "items": [
      {
        "icon": "users",
        "title": "Tarifa vital por hora",
        "description": "El trabajo humano se calcula segun la energia necesaria para sostener la vida del trabajador: alimentacion, agua, vivienda y servicios basicos. La tarifa base es aproximadamente 1 TQ por hora de trabajo (2.2 MJ/h = 0.61 kWh/h segun estudios metabolicos), ajustada por el tipo de esfuerzo.",
        "badge": "1 TQ/hora base"
      },
      {
        "icon": "trending-up",
        "title": "Factores de esfuerzo",
        "description": "No todo el trabajo exige la misma energia:\nTrabajo administrativo: x 1.0\nTrabajo tecnico/especializado: x 1.15\nTrabajo agricola/fisico: x 1.3\n\nUn agricultor que trabaja 6 horas recibe 6 x 1.3 = 7.8 TQ. Un administrador que trabaja 6 horas recibe 6 x 1.0 = 6 TQ.",
        "badge": "Por esfuerzo"
      },
      {
        "icon": "clock",
        "title": "Parametros laborales",
        "description": "Jornada estandar: 6 horas/dia, 24 dias/mes. Estos parametros son configurables por cada nodo segun las decisiones de su asamblea. Lo importante es que el trabajo se mide en horas reales, no en productividad subjetiva.",
        "badge": "6 h/dia"
      },
      {
        "icon": "heart",
        "title": "Trabajo no remunerado",
        "description": "El sistema puede reconocer el trabajo domestico, de cuidados y comunitario que la economia convencional no valora. Cuidar a un anciano, cocinar para la comunidad, organizar una asamblea: todo es trabajo que consume energia humana y merece ser registrado.",
        "badge": "Inclusivo"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Ejemplo Practico: Pan Artesanal (1 kg)",
    "subtitle": "Como se calcula paso a paso el precio de un kilo de pan integral",
    "columns": 1,
    "items": [
      {
        "icon": "wheat",
        "title": "Desglose energetico del pan",
        "description": "Harina de trigo integral: 1.1 kg x 33.6 MJ/kg = 36.96 MJ\nLevadura natural: 0.02 kg x 5 TQ/kg = 0.1 TQ\nSal marina: 0.01 kg x 3 TQ/kg = 0.03 TQ\nAgua: 0.35 L x 0.5 TQ/L = 0.18 TQ\nElectricidad (horno): 0.5 kWh x 1 TQ/kWh = 0.5 TQ\nLena (horno mixto): 0.3 kg x 4.5 TQ/kg = 1.35 TQ\nTrabajo del panadero: 0.25 horas x 5 MJ/h = 1.25 MJ\nTransporte local: 2 km x 0.5 TQ/km = 1.0 TQ\n\nTOTAL: 42.21 MJ / 3.6 = 11.73 TQ por kg de pan\nPrecio redondeado: 12 TQ/kg",
        "badge": "12 TQ/kg"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Quienes Usan Sistemas Energeticos Hoy",
    "subtitle": "Experiencias contemporaneas que aplican monedas o contabilidad energetica",
    "columns": 2,
    "items": [
      {
        "icon": "sun",
        "title": "SolarCoin (SLR)",
        "description": "Sistema que emite un token criptografico por cada megavatio-hora (1 MWh) de energia solar fotovoltaica generada y verificada. La Fundacion SolarCoin incentiva la transicion ecologica vinculando la emision monetaria directamente a la produccion de energia limpia.",
        "badge": "Cripto-energia"
      },
      {
        "icon": "zap",
        "title": "Som Energia (Espana)",
        "description": "Cooperativa espanola con el modelo Generation kWh: los miembros adquieren acciones energeticas que otorgan el derecho a recibir un volumen determinado de electricidad renovable anual al precio de costo de generacion, aislando a los usuarios de la volatilidad de los mercados financieros.",
        "badge": "Espana"
      },
      {
        "icon": "home",
        "title": "Ecoaldeas (Sieben Linden, Tamera, Findhorn)",
        "description": "Diversas ecoaldeas internacionales aplican sistemas internos de compensacion energetica. Las contribuciones laborales en instalacion de paneles fotovoltaicos, tala de biomasa o mantenimiento de micro-redes se registran en un libro mayor comunitario expresado en horas de trabajo y kWh.",
        "badge": "Comunitario"
      },
      {
        "icon": "globe",
        "title": "Proof of Behavior (PoB)",
        "description": "Modelos como EcoMobiCoin reemplazan el gasto computacional del Proof of Work tradicional por la verificacion de acciones ambientalmente responsables: uso de transporte no motorizado, reforestacion, agricultura regenerativa. La creacion de valor proviene de acciones con impacto ambiental positivo.",
        "badge": "PoB"
      },
      {
        "icon": "users",
        "title": "Sarvodaya Shramadana (Sri Lanka)",
        "description": "Movimiento que integra mas de 11.000 aldeas que aplican principios de autogestion economica mediante el regalo de trabajo (Shramadana), construyendo infraestructura comunitaria sin endeudamiento bancario.",
        "badge": "Sri Lanka"
      },
      {
        "icon": "users",
        "title": "Longo Mai (Europa)",
        "description": "Red de cooperativas agricolas fundada en 1973 con mas de diez comunidades en Europa y America Central. Opera sin salarios individuales: la totalidad de los ingresos se destina a una caja comun. El intercambio entre cooperativas se realiza sin mediacion monetaria.",
        "badge": "Europa"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Fuentes de Datos Energeticos",
    "subtitle": "Usamos estandares internacionales reconocidos, no inventamos los numeros",
    "columns": 2,
    "items": [
      {
        "icon": "book",
        "title": "ICE Database",
        "description": "Inventory of Carbon and Energy, University of Bath (Reino Unido). Base de datos de energia incorporada por kg de material. Es el estandar mas usado en el mundo para calculos de huella energetica de materiales de construccion y manufactura.",
        "badge": "University of Bath"
      },
      {
        "icon": "book",
        "title": "Ecoinvent",
        "description": "Base de datos suiza de analisis de ciclo de vida (LCA). Contiene datos detallados de energia incorporada, emisiones y uso de recursos para miles de productos y procesos industriales. Estandar para software como SimaPro y GaBi.",
        "badge": "Suiza"
      },
      {
        "icon": "book",
        "title": "Agribalyse",
        "description": "Base de datos francesa del INRAE/ADEME especializada en agricultura y alimentacion. Contabiliza mas de 2.500 productos alimenticios y platos preparados, extendiendo el analisis hasta la fase de consumo final (Cradle-to-Plate).",
        "badge": "Francia"
      },
      {
        "icon": "book",
        "title": "FAO Statistics",
        "description": "Organizacion de las Naciones Unidas para la Alimentacion y Agricultura. Datos globales de produccion agricola, uso de energia en la agricultura y balances energeticos nacionales.",
        "badge": "ONU"
      },
      {
        "icon": "book",
        "title": "USDA",
        "description": "Departamento de Agricultura de Estados Unidos. Datos nutricionales, de produccion y energia en sistemas alimentarios. Referencia para calculos de eficiencia energetica agricola.",
        "badge": "EE.UU."
      },
      {
        "icon": "book",
        "title": "Pimentel (Cornell)",
        "description": "David Pimentel, ecologo de la Universidad de Cornell. Pionero en estudios de energia en agricultura. Sus datos sobre EROI (Energy Return on Investment) son referencia mundial.",
        "badge": "Cornell"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Equivalencias Energeticas",
    "subtitle": "Para entender que significa 1 TQ en la vida real",
    "columns": 3,
    "items": [
      {
        "icon": "zap",
        "title": "1 TQ = 1 kWh",
        "description": "Un kilovatio-hora de electricidad. Lo que consume un bombillo LED de 10W encendido durante 100 horas, o un refrigerador durante medio dia.",
        "badge": "Electricidad"
      },
      {
        "icon": "flame",
        "title": "1 TQ = 3.6 MJ",
        "description": "3.6 megajulios. La unidad del Sistema Internacional. Es la energia de 100 gramos de gasolina o 0.1 litros.",
        "badge": "Julios"
      },
      {
        "icon": "flame",
        "title": "1 TQ = 0.08 L gasolina",
        "description": "Unos 80 mililitros de gasolina. La energia que contiene un vaso pequeno de combustible.",
        "badge": "Gasolina"
      },
      {
        "icon": "flame",
        "title": "1 TQ = 0.2 kg lena",
        "description": "200 gramos de lena seca. La energia de un punado de ramas secas para cocinar.",
        "badge": "Lena"
      },
      {
        "icon": "sun",
        "title": "1 TQ = 1 hora solar",
        "description": "Aproximadamente la energia que un panel solar de 1 kW produce en 1 hora de sol pleno.",
        "badge": "Solar"
      },
      {
        "icon": "user",
        "title": "1 TQ = 1 hora trabajo",
        "description": "Una hora de trabajo humano base. El esfuerzo de una persona trabajando normalmente durante 60 minutos.",
        "badge": "Trabajo"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Diferencia con el Dinero Convencional",
    "subtitle": "Por que el TQ no es dinero y nunca lo sera",
    "columns": 2,
    "items": [
      {
        "icon": "x",
        "title": "No es dinero",
        "description": "El TQ no es una moneda legal, no se puede comprar ni vender en mercados financieros, no se puede depositar en un banco, no genera intereses, no se puede especular con el. Es una unidad contable interna de la red.",
        "badge": "No es dinero"
      },
      {
        "icon": "x",
        "title": "No es criptomoneda",
        "description": "El TQ no se mina, no tiene blockchain publica, no cotiza en exchanges, no tiene valor de mercado fluctuante. Su valor es fijo: 1 TQ siempre sera 1 kWh de energia objetiva.",
        "badge": "No es cripto"
      },
      {
        "icon": "x",
        "title": "No genera intereses",
        "description": "Tener saldo positivo no genera mas TQ. Tener saldo negativo no genera deuda creciente. El sistema esta disenado para que la riqueza circule, no para que se acumule ni se concentre.",
        "badge": "Sin interes"
      },
      {
        "icon": "check",
        "title": "Es un registro contable",
        "description": "El TQ es un registro transparente de quien aporto que y quien recibio que. La suma de todos los saldos siempre da cero. No hay emision de moneda, no hay inflacion, no hay devaluacion. Solo hay registro honesto de intercambios.",
        "badge": "Registro contable"
      }
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Transparencia",
    "title": "Quieres ver como se calcula un producto especifico?",
    "subtitle": "Usa nuestra calculadora energetica para ver el desglose de energia y precio de cualquier producto del catalogo. Puedes ver la energia directa, humana, de insumos y de amortizacion que hay en cada cosa que producimos.",
    "button_text": "Ver Catalogo de Productos",
    "button_link": "/p/productos",
    "theme": "emerald"
  }
]',
'zap', 13, true, true
ON CONFLICT (node_domain, slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  content = EXCLUDED.content,
  icon = EXCLUDED.icon,
  menu_order = EXCLUDED.menu_order,
  is_published = true,
  show_in_menu = true,
  updated_at = NOW();

-- Paso 2: Copiar la pagina a cualquier otro node_domain que ya tenga paginas
-- (excluyendo localhost que ya se inserto arriba)
INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
SELECT DISTINCT p.node_domain, 'metodologia-energetica', p2.title, p2.subtitle, p2.content, p2.icon, p2.menu_order, true, true
FROM public_pages p
CROSS JOIN public_pages p2
WHERE p2.node_domain = 'localhost' AND p2.slug = 'metodologia-energetica'
  AND p.node_domain != 'localhost'
  AND NOT EXISTS (
    SELECT 1 FROM public_pages p3
    WHERE p3.node_domain = p.node_domain AND p3.slug = 'metodologia-energetica'
  )
ON CONFLICT (node_domain, slug) DO NOTHING;
