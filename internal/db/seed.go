package db

import (
	"context"
	"fmt"
)

type seedPage struct {
	Slug      string
	Title     string
	Subtitle  string
	Content   string
	Icon      string
	MenuOrder int
}

// SeedPublicPages inserta las paginas por defecto del sitio publico
// si aun no existen. Usa queries parametrizadas para evitar problemas
// de parsing de strings multi-linea en YugabyteDB.
func (d *DB) SeedPublicPages(ctx context.Context, nodeDomain string) error {
	// Verificar si ya existen paginas
	var count int
	err := d.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM public_pages WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if err != nil {
		return fmt.Errorf("checking existing pages: %w", err)
	}
	if count > 0 {
		return nil // Ya hay paginas, no insertar
	}

	pages := []seedPage{
		{
			Slug:     "inicio",
			Title:    "Bienvenida a la Feria Conuquera Agroecologica",
			Subtitle: "Cuando el conuco viene a la ciudad, la soberania alimenta el alma y la tierra florece en comunidad",
			Content: `# Bienvenida a la fiesta de la cosecha sana!

El primer sabado de cada mes, las faldas del Parque Los Caobos en Caracas se transforman en un lienzo de verdor, fragancias y buenas vibras colectivas para celebrar el encuentro de la Feria Conuquera Agroecologica.

Desde las primeras luces del amanecer, conuqueros, artesanos y asiduos visitantes colman este historico pulmon vegetal de la ciudad en una jornada de sano compartir.

Este no es un mercado comun regido por la especulacion comercial. La Feria Conuquera es un espacio autogestionado de economia solidaria, cultura y soberania alimentaria que busca tender puentes directos y sin intermediarios entre las familias campesinas y los consumidores urbanos.

## Datos Clave

- Cuando nos reunimos: El primer sabado de cada mes
- Horario: Desde las 9:00 de la manana hasta pasado el mediodia
- Donde: Parque Los Caobos, Caracas. Zona sur, cerca del estacionamiento principal y la Fuente Venezuela

## Compromiso Ecologico

Esta estrictamente prohibido el uso de bolsas plasticas desechables. Trae tu propia bolsa reutilizable, morral o envases de tela.`,
			Icon:      "home",
			MenuOrder: 1,
		},
		{
			Slug:     "filosofia",
			Title:    "Nuestra Historia y Filosofia",
			Subtitle: "Quienes somos y de donde venimos",
			Content: `# El Origen: Un Movimiento Nacido al Calor de la Semilla Libre

Nuestra red comunitaria germino formalmente el 29 de octubre de 2014. Nacimos en un momento crucial de la historia agricola nacional, al calor de los intensos debates populares organizados por el Movimiento Semillas del Pueblo para la construccion colectiva de la Ley de Semillas de Venezuela (promulgada en diciembre de 2015).

Surgimos no solo como un mercado, sino como un grito de resistencia activa y autogestionada frente al desabastecimiento, la usura y el sabotaje economico. Ante las dificultades de la epoca, decidimos reencontrarnos con la tierra y tejer redes populares de produccion-distribucion-consumo que protegieran a la ciudadania del agronegocio transnacional y de los alimentos transgenicos.

## El Conuco como Horizonte Historico e Integral

Para nosotros, el conuco no es una tecnica atrasada de cultivo, sino un laboratorio de vida integral y una forma de resistencia ecosocialista. Es un sistema biodiverso que respeta los tiempos de la naturaleza y rompe de raiz con la logica destructiva del monocultivo agroindustrial.

Heredamos los saberes de nuestros antepasados indigenas, campesinos y afrodescendientes para demostrar que la agricultura urbana no es una medida transitoria de emergencia, sino un proyecto politico que transforma la conciencia humana.

## Nuestros Colectivos y Familias Conuqueras

- Melissa Produccion Diversificada: Fundada por Monica Perez y Luis Araujo en Camino de los Espanoles, La Pastora.
- Unidad Productiva La Buhardilla: Dirigida por Giselle Perdomo, biologa que comenzo a sembrar para el cuidado de su hijo con discapacidad.
- Unidad Productiva Totobaca: Conducida por Luz Pimienta, integrante clave del equipo organizador.
- Cooperativa Escuela Popular de Agricultura Urbana (EPAU): Colectivo surgido en 2015 al calor del rescate del organoponico Bolivar 1 en Bellas Artes.
- Silio Sanchez: Abogado, vegetariano y productor de gallinas criollas y cabras en el campo.`,
			Icon:      "heart",
			MenuOrder: 2,
		},
		{
			Slug:     "productos",
			Title:    "Nuestros Productos y Sabores",
			Subtitle: "Catalogo de cosecha fresca y gastronomia artesanal",
			Content: `# Cosecha Fresca de Temporada y Rubros Ancestrales

Nos enfocamos en restaurar y dar a conocer sabores tradicionales que han sido desplazados por el mercado de consumo masivo:

- Rubros Olvidados: Cambur morado, col rizada (kale portuguesa) de El Junquito, name morado
- Cosecha del Dia: Hortalizas de hojas verdes, auyama, platano, ocumo, yuca, papas, cebollin, cilantro fresco
- Sazones de Pedro Arellano: Conuquero andino con cuatro decadas de experiencia sembrando en Caracas

## Medicina Botanica y Cosmetica Eco-Sustentable

- Plantulas Medicinales: Poleo, estevia, malojillo, romero, ruda, menta y oregano orejon
- Botica Conuquera: Tinturas de propoleo y cremas a base de miel pura
- Cosmetica sin Venenos: Desodorantes y labiales ecologicos a base de aceite de coco
- Reduccion de Desechos: Desmaquillantes reutilizables, toallas sanitarias ecologicas, panales reutilizables

## Alimentos Procesados y Gastronomia Artesanal

- La Cafunga de Barlovento: Dulce estrella de la feria, preparado por Estilita Ruiz, La Reina de la Cafunga, a sus 75 anos
- Economia de Sabores: Harinas artesanales sin gluten, mermeladas, cacao puro, chocolates artesanales, cafe de montana
- Almuerzos Comunitarios: Gastronomia mexicana tradicional y cocina arabe preparada al momento`,
			Icon:      "shopping-cart",
			MenuOrder: 3,
		},
		{
			Slug:     "comunidad",
			Title:    "Comunidad, Saberes y Trueque",
			Subtitle: "Mas que un mercado: un territorio de intercambio espiritual, pedagogico y cultural",
			Content: `# Aula Conuquera Abierta: Intercambio de Saberes

No creemos en el conocimiento privatizado. Inspirados en el metodo de campesino a campesino, nuestros productores dictan talleres gratuitos y abiertos:

- Elaboracion de kokedamas y preparacion de sustratos con fibra de coco
- Lombricultura comunitaria y elaboracion de abonos organicos
- Tecnicas de medicina tradicional y salud botanica
- Alternativas de alimentacion infantil y amamantamiento libre

## Iniciativas Solidarias y Espacios de Trueque

- Trueque de Semillas Criollas: Trae tus semillas locales, limpias y seleccionadas. Intercambio libre de semillas nativas para proteger nuestra agrodiversidad
- Dona y adopta un libro: Stand donde puedes llevarte novelas y textos de forma gratuita con la promesa de seguir compartiendo el saber

## El Son de la Resistencia: Cultura y Musica

Cada edicion es animada por colectivos artisticos locales:
- The BigLandin: Agrupacion caraquena de ritmos ska
- Suenos Repetidos: Banda local de musica tradicional y fusiones
- Gino Gonzalez: Cantautor popular que nos acompana con su cuatro`,
			Icon:      "users",
			MenuOrder: 4,
		},
		{
			Slug:     "como-funciona",
			Title:    "Como Funciona el Trueque",
			Subtitle: "Sistema de credito mutuo con saldo cero",
			Content: `# Que es el Trueque?

El trueque no es una moneda en el sentido tradicional. No es dinero que se compra o se vende. Es un sistema de contabilidad comunitaria que registra cuanto has dado a la comunidad y cuanto has recibido de ella.

## Como funciona?

### 1. Empiezas en cero
Cuando te unes a la comunidad, tu cuenta empieza en 0. No necesitas aportar dinero para comenzar.

### 2. Cuando compras o recibes
Si compras alimentos a alguien por valor de 50 trueques, tu cuenta pasa a -50 (saldo negativo). Esto significa que has recibido 50 trueques en bienes o servicios y tienes un compromiso de retribuir a la comunidad.

### 3. Cuando vendes o trabajas
Si vendes tus productos o trabajas para alguien por valor de 50 trueques, tu cuenta pasa a +50 (saldo positivo). Esto significa que la comunidad te debe 50 trueques en bienes o servicios.

### 4. La suma siempre es cero
La suma de todas las cuentas de todos los miembros siempre da exactamente cero. Nadie crea dinero de la nada. Lo que uno da, otro recibe. Es un sistema de suma cero: no hay inflacion, no hay devaluacion, no hay especulacion.

## Que significa el saldo negativo?

Un saldo negativo no es una deuda bancaria. Es un compromiso explicito de prestar servicios o entregar productos futuros a la comunidad. Es completamente normal: significa que has recibido bienes o servicios y despues compensaras produciendo, trabajando o vendiendo.

## Que significa el saldo positivo?

Un saldo positivo significa que has dado mas de lo que has recibido. La comunidad te debe bienes o servicios por ese monto. Puedes gastar tu saldo positivo comprando cosas de otros miembros.

## Limites de credito y debito

- Limite de debito (negativo): Es el maximo que puedes deber. Por ejemplo, -500 trueques. Al llegar a este limite, no puedes comprar mas hasta que recibas trueques (vendiendo o trabajando).
- Limite de credito (positivo): Es el maximo que puedes acumular. Por ejemplo, +1000 trueques. Al llegar a este limite, no puedes recibir mas hasta que gastes algo.

Estos limites evitan que alguien compre sin limite o acumule sin aportar. Los define la asamblea de la comunidad.

## Sin intereses

No existe interes positivo sobre el ahorro ni interes negativo sobre el saldo negativo. El trueque no es una moneda financiera: es una herramienta de intercambio.

## Quien emite los trueques?

Nadie los emite. No hay un banco central ni una autoridad que crea trueques. El trueque se crea en el momento del intercambio: cuando tu compras, tu saldo baja y el del vendedor sube en la misma cantidad. Se destruye igual: cuando el vendedor compra a alguien mas, su saldo baja.

## Es como una moneda?

No. Una moneda se emite, se acumula, se especula y se devalua. El trueque es credito mutuo: un registro contable de compromisos entre miembros de una comunidad. Su valor no fluctua porque esta basado en la confianza mutua, no en mercados financieros.

## Como se calcula el valor?

El valor de un producto se calcula en base a la energia que costo producirlo. La idea es que 1 trueque = 1 kWh de energia. Con esto, todo tiene un precio objetivo: la energia total (directa, humana, de insumos y de herramientas) que se necesitó para producirlo.

## Que pasa si me voy de la comunidad?

Si tu saldo es cero, puedes irte sin problema. Si tu saldo es negativo, debes compensar produciendo o trabajando antes de irte. Si es positivo, debes gastar tu saldo antes de irte. Esto garantiza que nadie se aproveche del sistema.`,
			Icon:      "help-circle",
			MenuOrder: 5,
		},
		{
			Slug:     "campo-soberano",
			Title:    "Proyecto Campo Soberano",
			Subtitle: "Comunidad Agroecologica Autonoma y Regenerativa",
			Content: `# Vision Fundacional

El Campo Soberano es un proyecto para fundar una comunidad intencional agroecologica en un predio rural colectivo, disenada bajo los principios de la soberania alimentaria, energetica, digital y financiera.

El objetivo es estructurar un habitat de ciclo cerrado (residuo cero) donde cada desecho se transforme en un insumo biologico o energetico, articulado por una economia de credito mutuo no especulativa y una infraestructura digital autonoma.

## Principios Rectores

- Regeneracion Ecosistemica: Toda actividad productiva incrementa la fertilidad del suelo y la biodiversidad
- Ciclos Cerrados: Los desechos organicos nutren biodigestores para generar gas y biofertilizantes
- Soberania Off-Grid: Capacidad de subsistir independientemente de redes comerciales
- Economia Libre de Acumulacion: Flujo monetario interno basado en confianza mutua y topes de saldo

## Zonificacion Permacultural

- Zona 0: Nucleo Habitacional - Viviendas bioclimaticas con materiales locales
- Zona 1: Huerto Intensivo - Hortalizas diarias, aromaticas, semilleros
- Zona 2: Animales Menores - Gallineros moviles, acuaponia, biodigestor
- Zona 3: Granos Extensivos - Maiz, legumbres, pastoreo rotacional
- Zona 4: Agroforesteria - Maderables, frutales, biomasa
- Zona 5: Reserva Silvestre - Proteccion absoluta de fuentes hidricas

## Infraestructura de Ciclos Cerrados

- Gas de Cocina: Biodigestores continuos tubulares (estiercol -> metano -> cocinas)
- Nutricion Vegetal: Biol foliar y biosolidos del biodigestor
- Energia: Microrred hibrida aislada (Solar + Eolica + Hidraulica)
- Agua: Zanjas Keyline, reservorios de tierra y sanitarios secos

## Soberania Digital

- Red Mesh con antenas solares en cada vivienda
- Matrix/Element para comunicaciones internas
- PeerTube comunitario para tutoriales y asambleas
- Kiwix con Wikipedia, guias agronomicas y enciclopedias medicas offline

## Gobernanza

El predio permanece bajo propiedad colectiva indivisible mediante un Fideicomiso Comunitario. Las decisiones siguen principios de Sociocracia 3.0 mediante circulos tematicos y consentimiento fundamentado.`,
			Icon:      "leaf",
			MenuOrder: 6,
		},
		{
			Slug:     "faq",
			Title:    "Preguntas Frecuentes",
			Subtitle: "Dudas frecuentes para nuevos visitantes y productores",
			Content: `# Preguntas Frecuentes

## Quienes organizan la feria y como se financia?

La feria es una iniciativa completamente autogestionada por los propios productores y colectivos agroecologicos. No dependemos de intermediarios comerciales ni corporaciones especulativas, lo que nos permite mantener precios solidarios.

## Soy productor y quiero participar, como puedo hacerlo?

Debes cumplir con dos requisitos: que tu produccion sea completamente agroecologica (libre de venenos quimicos y transgenicos) y que participes en las asambleas formativas y de organizacion colectiva. Escribenos a nuestras redes o visitanos el primer sabado de mes.

## Por que no se permiten bolsas de plastico?

La agroecologia es un compromiso etico de cuidado hacia la vida. Las bolsas de plastico generan desechos daninos. Trae bolsas reutilizables de tela, morrales o canastas.

## Tienen actividades para ninos?

Totalmente! Cada edicion cuenta con talleres para ninos, trueque de libros escolares, titeres y dinamicas educativas al aire libre.

## Como funciona el trueque?

El trueque es un sistema de contabilidad comunitaria. Empiezas en cero, cuando recibes tu saldo baja (negativo = debes a la comunidad), cuando das tu saldo sube (positivo = te deben). La suma de todos siempre da cero. No es dinero, es un registro de intercambios. Revisa la pagina Como Funciona el Trueque para mas detalles.`,
			Icon:      "help-circle",
			MenuOrder: 7,
		},
		{
			Slug:     "contacto",
			Title:    "Contacto",
			Subtitle: "Mantente en contacto con la red",
			Content: `# Contacto

## Redes Sociales

- Instagram: @feriaconuquera
- Facebook: Feria Conuquera Agroecologica

## Ubicacion

Parque Los Caobos, area del estacionamiento sur, cerca de la Fuente Venezuela, Caracas, Distrito Capital, Venezuela.

## Horario

Primer sabado de cada mes, desde las 9:00 AM hasta pasado el mediodia.

## Quieres unirte?

Si quieres ser parte de nuestra comunidad, completa el formulario de solicitud de admision y nos pondremos en contacto contigo.`,
			Icon:      "mail",
			MenuOrder: 8,
		},
	}

	for _, p := range pages {
		_, err := d.Pool.Exec(ctx,
			`INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
			 ON CONFLICT (node_domain, slug) DO NOTHING`,
			nodeDomain, p.Slug, p.Title, p.Subtitle, p.Content, p.Icon, p.MenuOrder)
		if err != nil {
			return fmt.Errorf("seeding page %s: %w", p.Slug, err)
		}
	}

	return nil
}
