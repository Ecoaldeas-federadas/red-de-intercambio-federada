-- Migracion 013: Sitio web publico + nombre completo de moneda + solicitudes de admision
--
-- Permite que personas externas vean informacion del nodo sin iniciar sesion,
-- y que puedan solicitar unirse llenando un formulario.

-- 1. Agregar nombre completo de la moneda (ademas de la abreviatura)
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS currency_full_name VARCHAR(100) DEFAULT 'Trueque';

-- 2. Configuracion del sitio publico (logo, colores, redes sociales, etc)
CREATE TABLE IF NOT EXISTS public_settings (
  node_domain VARCHAR(255) NOT NULL UNIQUE,
  site_title VARCHAR(255) NOT NULL DEFAULT 'Feria Conuquera Agroecologica',
  site_subtitle TEXT DEFAULT 'Cuando el conuco viene a la ciudad, la soberania alimenta el alma',
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#2d5016',
  secondary_color VARCHAR(7) DEFAULT '#f4a261',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(100),
  contact_address TEXT DEFAULT 'Parque Los Caobos, Caracas, Venezuela',
  social_instagram VARCHAR(255) DEFAULT 'feriaconuquera',
  social_facebook VARCHAR(255) DEFAULT 'feriaconuquera',
  social_twitter VARCHAR(255),
  show_join_form BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Paginas del sitio publico (contenido configurable)
CREATE TABLE IF NOT EXISTS public_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL DEFAULT '',
  icon VARCHAR(50),
  menu_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  show_in_menu BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, slug)
);

CREATE INDEX IF NOT EXISTS idx_public_pages_node ON public_pages (node_domain, is_published, menu_order);

-- 4. Solicitudes de admision (formulario publico)
CREATE TABLE IF NOT EXISTS admission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  location TEXT,
  reason TEXT,
  skills TEXT,
  how_heard TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_requests_node ON admission_requests (node_domain, status, created_at);

-- 5. Configuracion por defecto del sitio publico
INSERT INTO public_settings (node_domain) VALUES ('localhost')
ON CONFLICT (node_domain) DO NOTHING;

-- 6. Paginas preconfiguradas con contenido de la Feria Conuquera
INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
SELECT 'localhost', slug, title, subtitle, content, icon, menu_order, true, show_in_menu
FROM (VALUES
  ('inicio', 'Inicio', 'Bienvenida a la Feria Conuquera Agroecologica',
   'Cuando el conuco viene a la ciudad, la soberania alimenta el alma y la tierra florece en comunidad',
   '# ¡Te damos la bienvenida a la fiesta de la cosecha sana!

El primer sábado de cada mes, las faldas del Parque Los Caobos en Caracas se transforman en un lienzo de verdor, fragancias y buenas vibras colectivas para celebrar el encuentro de la **Feria Conuquera Agroecológica**.

Desde las primeras luces del amanecer, conuqueros, artesanos y asiduos visitantes colman este histórico pulmón vegetal de la ciudad en una jornada de sano compartir.

Este no es un mercado común regido por la especulación comercial. La Feria Conuquera es un espacio autogestionado de economía solidaria, cultura y soberanía alimentaria que busca tender puentes directos y sin intermediarios entre las familias campesinas y los consumidores urbanos.

## Datos Clave

- **¿Cuándo nos reunimos?:** El primer sábado de cada mes
- **¿Horario?:** Desde las 9:00 de la mañana hasta pasado el mediodía
- **¿Dónde?:** Parque Los Caobos, Caracas. Zona sur, cerca del estacionamiento principal y la Fuente Venezuela

## Compromiso Ecológico

Está estrictamente prohibido el uso de bolsas plásticas desechables. Trae tu propia bolsa reutilizable, morral o envases de tela.',
   'home', 1, true, true),

  ('filosofia', 'Nuestra Historia y Filosofía', 'Quiénes somos y de dónde venimos',
   'Un movimiento nacido al calor de la semilla libre y el conuco como forma de vida',
   '# El Origen: Un Movimiento Nacido al Calor de la Semilla Libre

Nuestra red comunitaria germinó formalmente el **29 de octubre de 2014**. Nacimos en un momento crucial de la historia agrícola nacional, al calor de los intensos debates populares organizados por el **Movimiento Semillas del Pueblo** para la construcción colectiva de la **Ley de Semillas** de Venezuela (promulgada en diciembre de 2015).

Surgimos no solo como un mercado, sino como un grito de resistencia activa y autogestionada frente al desabastecimiento, la usura y el sabotaje económico. Ante las dificultades de la época, decidimos reencontrarnos con la tierra y tejer redes populares de producción-distribución-consumo que protegieran a la ciudadanía del agronegocio transnacional y de los alimentos transgénicos.

## El Conuco como Horizonte Histórico e Integral

Para nosotros, **el conuco no es una técnica atrasada de cultivo, sino un laboratorio de vida integral y una forma de resistencia ecosocialista**. Es un sistema biodiverso que respeta los tiempos de la naturaleza y rompe de raíz con la lógica destructiva del monocultivo agroindustrial.

Heredamos los saberes de nuestros antepasados indígenas, campesinos y afrodescendientes para demostrar que la agricultura urbana no es una medida transitoria de emergencia, sino un proyecto político que transforma la conciencia humana.

## Nuestros Colectivos y Familias Conuqueras

- **Melissa Producción Diversificada:** Fundada por Mónica Pérez y Luis Araujo en Camino de los Españoles, La Pastora.
- **Unidad Productiva La Buhardilla:** Dirigida por Giselle Perdomo, bióloga que comenzó a sembrar para el cuidado de su hijo con discapacidad.
- **Unidad Productiva Totobaca:** Conducida por Luz Pimienta, integrante clave del equipo organizador.
- **Cooperativa Escuela Popular de Agricultura Urbana (EPAU):** Colectivo surgido en 2015 al calor del rescate del organopónico Bolívar 1 en Bellas Artes.
- **Silio Sánchez:** Abogado, vegetariano y productor de gallinas criollas y cabras en el campo.',
   'heart', 2, true, true),

  ('productos', 'Nuestros Productos y Sabores', 'Catálogo de cosecha fresca y gastronomía artesanal',
   'Cada rubro que llevas a tu mesa ha sido cultivado con amor y regado con agua limpia',
   '# Cosecha Fresca de Temporada y Rubros Ancestrales

Nos enfocamos en restaurar y dar a conocer sabores tradicionales que han sido desplazados por el mercado de consumo masivo:

- **Rubros Olvidados:** Cambur morado, col rizada (kale portuguesa) de El Junquito, ñame morado
- **Cosecha del Día:** Hortalizas de hojas verdes, auyama, plátano, ocumo, yuca, papas, cebollín, cilantro fresco
- **Sazones de Pedro Arellano:** Conuquero andino con cuatro décadas de experiencia sembrando en Caracas

## Medicina Botánica y Cosmética Eco-Sustentable

- **Plántulas Medicinales:** Poleo, estevia, malojillo, romero, ruda, menta y orégano orejón
- **Botica Conuquera:** Tinturas de propóleo y cremas a base de miel pura
- **Cosmética sin Venenos:** Desodorantes y labiales ecológicos a base de aceite de coco
- **Reducción de Desechos:** Desmaquillantes reutilizables, toallas sanitarias ecológicas, pañales reutilizables

## Alimentos Procesados y Gastronomía Artesanal

- **La Cafunga de Barlovento:** Dulce estrella de la feria, preparado por Estilita Ruiz, "La Reina de la Cafunga", a sus 75 años
- **Economía de Sabores:** Harinas artesanales sin gluten, mermeladas, cacao puro, chocolates artesanales, café de montaña
- **Almuerzos Comunitarios:** Gastronomía mexicana tradicional y cocina árabe preparada al momento',
   'shopping-cart', 3, true, true),

  ('comunidad', 'Comunidad, Saberes y Trueque', 'Más que un mercado: un territorio de intercambio espiritual, pedagógico y cultural',
   'Talleres gratuitos, trueque de semillas, intercambio de libros y música en vivo',
   '# Aula Conuquera Abierta: Intercambio de Saberes

No creemos en el conocimiento privatizado. Inspirados en el método "de campesino a campesino", nuestros productores dictan talleres gratuitos y abiertos:

- Elaboración de kokedamas y preparación de sustratos con fibra de coco
- Lombricultura comunitaria y elaboración de abonos orgánicos
- Técnicas de medicina tradicional y salud botánica
- Alternativas de alimentación infantil y amamantamiento libre

## Iniciativas Solidarias y Espacios de Trueque

- **Trueque de Semillas Criollas:** Trae tus semillas locales, limpias y seleccionadas. Intercambio libre de semillas nativas para proteger nuestra agrodiversidad
- **"Dona y adopta un libro":** Stand donde puedes llevarte novelas y textos de forma gratuita con la promesa de seguir compartiendo el saber

## El Son de la Resistencia: Cultura y Música

Cada edición es animada por colectivos artísticos locales:
- **The BigLandin:** Agrupación caraqueña de ritmos ska
- **Sueños Repetidos:** Banda local de música tradicional y fusiones
- **Gino González:** Cantautor popular que nos acompaña con su cuatro',
   'users', 4, true, true),

  ('como-funciona', 'Cómo Funciona el Trueque', 'Sistema de crédito mutuo con saldo cero',
   'No es una moneda: es un sistema de contabilidad de lo que das y lo que recibes',
   '# ¿Qué es el Trueque?

El trueque no es una moneda en el sentido tradicional. No es dinero que se compra o se vende. Es un **sistema de contabilidad comunitaria** que registra cuánto has dado a la comunidad y cuánto has recibido de ella.

## ¿Cómo funciona?

### 1. Empiezas en cero
Cuando te unes a la comunidad, tu cuenta empieza en **0**. No necesitas aportar dinero para comenzar.

### 2. Cuando compras o recibes
Si compras alimentos a alguien por valor de 50 trueques, tu cuenta pasa a **-50** (saldo negativo). Esto significa que has recibido 50 trueques en bienes o servicios y tienes un compromiso de retribuir a la comunidad.

### 3. Cuando vendes o trabajas
Si vendes tus productos o trabajas para alguien por valor de 50 trueques, tu cuenta pasa a **+50** (saldo positivo). Esto significa que la comunidad te debe 50 trueques en bienes o servicios.

### 4. La suma siempre es cero
La suma de todas las cuentas de todos los miembros **siempre da exactamente cero**. Nadie "crea" dinero de la nada. Lo que uno da, otro recibe. Es un sistema de suma cero: no hay inflación, no hay devaluación, no hay especulación.

## ¿Qué significa el saldo negativo?

Un saldo negativo **no es una deuda bancaria**. Es un compromiso explícito de prestar servicios o entregar productos futuros a la comunidad. Es completamente normal: significa que has recibido bienes o servicios y después compensarás produciendo, trabajando o vendiendo.

## ¿Qué significa el saldo positivo?

Un saldo positivo significa que has dado más de lo que has recibido. La comunidad te debe bienes o servicios por ese monto. Puedes "gastar" tu saldo positivo comprando cosas de otros miembros.

## Límites de crédito y débito

- **Límite de débito (negativo):** Es el máximo que puedes deber. Por ejemplo, -500 trueques. Al llegar a este límite, no puedes comprar más hasta que recibas trueques (vendiendo o trabajando).
- **Límite de crédito (positivo):** Es el máximo que puedes acumular. Por ejemplo, +1000 trueques. Al llegar a este límite, no puedes recibir más hasta que gastes algo.

Estos límites evitan que alguien compre sin límite o acumule sin aportar. Los define la asamblea de la comunidad.

## Sin intereses

No existe interés positivo sobre el ahorro ni interés negativo sobre el saldo negativo. El trueque no es una moneda financiera: es una herramienta de intercambio.

## ¿Quién emite los trueques?

**Nadie los emite.** No hay un banco central ni una autoridad que "crea" trueques. El trueque se crea en el momento del intercambio: cuando tú compras, tu saldo baja y el del vendedor sube en la misma cantidad. Se destruye igual: cuando el vendedor compra a alguien más, su saldo baja.

## ¿Es como una moneda?

No. Una moneda se emite, se acumula, se especula y se devalúa. El trueque es **crédito mutuo**: un registro contable de compromisos entre miembros de una comunidad. Su valor no fluctúa porque está basado en la confianza mutua, no en mercados financieros.

## ¿Cómo se calcula el valor?

El valor de un producto se calcula en base a la **energía** que costó producirlo. La idea es que **1 trueque = 1 kWh de energía**. Con esto, todo tiene un precio objetivo: la energía total (directa, humana, de insumos y de herramientas) que se necesitó para producirlo.

## ¿Qué pasa si me voy de la comunidad?

Si tu saldo es cero, puedes irte sin problema. Si tu saldo es negativo, debes compensar produciendo o trabajando antes de irte. Si es positivo, debes gastar tu saldo antes de irte. Esto garantiza que nadie se aproveche del sistema.',
   'help-circle', 5, true, true),

  ('campo-soberano', 'Proyecto Campo Soberano', 'Comunidad Agroecológica Autónoma y Regenerativa',
   'Una ecoaldea de ciclo cerrado con soberanía alimentaria, energética, digital y financiera',
   '# Visión Fundacional

El **Campo Soberano** es un proyecto para fundar una comunidad intencional agroecológica en un predio rural colectivo, diseñada bajo los principios de la soberanía alimentaria, energética, digital y financiera.

El objetivo es estructurar un hábitat de **ciclo cerrado (residuo cero)** donde cada desecho se transforme en un insumo biológico o energético, articulado por una economía de crédito mutuo no especulativa y una infraestructura digital autónoma.

## Principios Rectores

- **Regeneración Ecosistémica:** Toda actividad productiva incrementa la fertilidad del suelo y la biodiversidad
- **Ciclos Cerrados:** Los desechos orgánicos nutren biodigestores para generar gas y biofertilizantes
- **Soberanía Off-Grid:** Capacidad de subsistir independientemente de redes comerciales
- **Economía Libre de Acumulación:** Flujo monetario interno basado en confianza mutua y topes de saldo

## Zonificación Permacultural

| Zona | Uso |
|------|-----|
| Zona 0 | Núcleo Habitacional - Viviendas bioclimáticas con materiales locales |
| Zona 1 | Huerto Intensivo - Hortalizas diarias, aromáticas, semilleros |
| Zona 2 | Animales Menores - Gallineros móviles, acuaponía, biodigestor |
| Zona 3 | Granos Extensivos - Maíz, legumbres, pastoreo rotacional |
| Zona 4 | Agroforestería - Maderables, frutales, biomasa |
| Zona 5 | Reserva Silvestre - Protección absoluta de fuentes hídricas |

## Infraestructura de Ciclos Cerrados

- **Gas de Cocina:** Biodigestores continuos tubulares (estiércol → metano → cocinas)
- **Nutrición Vegetal:** Biol foliar y biosólidos del biodigestor
- **Energía:** Microrred híbrida aislada (Solar + Eólica + Hidráulica)
- **Agua:** Zanjas Keyline, reservorios de tierra y sanitarios secos

## Soberanía Digital

- Red Mesh con antenas solares en cada vivienda
- Matrix/Element para comunicaciones internas
- PeerTube comunitario para tutoriales y asambleas
- Kiwix con Wikipedia, guías agronómicas y enciclopedias médicas offline

## Gobernanza

El predio permanece bajo **propiedad colectiva indivisible** mediante un Fideicomiso Comunitario. Las decisiones siguen principios de **Sociocracia 3.0** mediante círculos temáticos y consentimiento fundamentado.',
   'leaf', 6, true, true),

  ('faq', 'Preguntas Frecuentes', 'Dudas frecuentes para nuevos visitantes y productores',
   'Todo lo que necesitas saber antes de visitarnos o sumarte',
   '# Preguntas Frecuentes

## ¿Quiénes organizan la feria y cómo se financia?

La feria es una iniciativa completamente **autogestionada por los propios productores y colectivos agroecológicos**. No dependemos de intermediarios comerciales ni corporaciones especulativas, lo que nos permite mantener precios solidarios.

## Soy productor y quiero participar, ¿cómo puedo hacerlo?

Debes cumplir con dos requisitos: que tu producción sea **completamente agroecológica** (libre de venenos químicos y transgénicos) y que participes en las **asambleas formativas y de organización colectiva**. Escríbenos a nuestras redes o visítanos el primer sábado de mes.

## ¿Por qué no se permiten bolsas de plástico?

La agroecología es un compromiso ético de cuidado hacia la vida. Las bolsas plásticas generan desechos dañinos. Trae **bolsas reutilizables de tela, morrales o canastas**.

## ¿Tienen actividades para niños?

¡Totalmente! Cada edición cuenta con talleres para niños, trueque de libros escolares, títeres y dinámicas educativas al aire libre.

## ¿Cómo funciona el trueque?

El trueque es un sistema de contabilidad comunitaria. Empiezas en cero, cuando recibes tu saldo baja (negativo = debes a la comunidad), cuando das tu saldo sube (positivo = te deben). La suma de todos siempre da cero. No es dinero, es un registro de intercambios. Revisa la página "Cómo Funciona el Trueque" para más detalles.',
   'help-circle', 7, true, true),

  ('contacto', 'Contacto', 'Mantente en contacto con la red',
   'Escríbenos, infórmate y comparte tus saberes',
   '# Contacto

## Redes Sociales

- **Instagram:** [@feriaconuquera](https://www.instagram.com/feriaconuquera/)
- **Facebook:** [Feria Conuquera Agroecológica](https://www.facebook.com/feriaconuquera/)

## Ubicación

Parque Los Caobos, área del estacionamiento sur, cerca de la Fuente Venezuela, Caracas, Distrito Capital, Venezuela.

## Horario

Primer sábado de cada mes, desde las 9:00 AM hasta pasado el mediodía.

## ¿Quieres unirte?

Si quieres ser parte de nuestra comunidad, completa el formulario de solicitud de admisión y nos pondremos en contacto contigo.',
   'mail', 8, true, true)
) AS t(slug TEXT, title TEXT, subtitle TEXT, content TEXT, icon TEXT, menu_order INT, show_in_menu BOOLEAN)
WHERE NOT EXISTS (SELECT 1 FROM public_pages WHERE node_domain = 'localhost' LIMIT 1);
