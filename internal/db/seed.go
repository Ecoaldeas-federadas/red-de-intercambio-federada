package db

import (
	"context"
	"fmt"
	"log"
)

type seedPage struct {
	Slug      string
	Title     string
	Subtitle  string
	Content   string
	Icon      string
	MenuOrder int
}

// GetDefaultPageContent devuelve el contenido por defecto de una pagina
// del seed segun su slug. Se usa para restablecer paginas al contenido
// original sin afectar el titulo que el admin haya puesto.
func (d *DB) GetDefaultPageContent(slug string) (title, subtitle, content, icon string, menuOrder int, found bool) {
	pages := getSeedPages()
	for _, p := range pages {
		if p.Slug == slug {
			return p.Title, p.Subtitle, p.Content, p.Icon, p.MenuOrder, true
		}
	}
	return "", "", "", "", 0, false
}

// getSeedPages devuelve la lista de paginas por defecto del seed.
func getSeedPages() []seedPage {
	return []seedPage{
		{
			Slug:     "inicio",
			Title:    "Inicio",
			Subtitle: "Mercado a Cielo Abierto y Red de Soberania Alimentaria",
			Content: `[
  {
    "type": "hero",
    "badge": "🌱 Mercado a Cielo Abierto & 10 Años de Historia",
    "title": "Feria Conuquera Agroecológica",
    "subtitle": "Cosecha fresca, alimentos sanos y saberes campesinos para toda Caracas.",
    "description": "El primer sábado de cada mes abrimos nuestro mercado a cielo abierto en Parque Los Caobos para todo el público general en moneda local. Un espacio autogestionado donde compras directo al productor sin intermediarios ni agrotóxicos, y donde los miembros de la red además intercambian en trueque y crédito mutuo.",
    "image_url": "/images/pages/hero-feria-conuquera.jpg",
    "primary_cta": {
      "text": "Ver Catálogo de Productos",
      "link": "/p/productos"
    },
    "secondary_cta": {
      "text": "Horarios y Ubicación",
      "link": "/p/contacto"
    },
    "style": "split"
  },
  {
    "type": "event_schedule",
    "badge": "📍 Mercado Abierto al Público General",
    "title": "Encuentro Mensual en Los Caobos",
    "date_text": "El primer sábado de cada mes",
    "time_text": "Desde las 9:00 AM hasta pasado el mediodía",
    "location_name": "Parque Los Caobos, Caracas",
    "address": "Zona Sur, área del estacionamiento principal, cerca de la Fuente Venezuela (Metro Bellas Artes / Colegio de Ingenieros)",
    "guidelines": [
      "�️ Venta abierta a todo el público en moneda local (no necesitas ser miembro para comprar).",
      "�🚫 Prohibido el uso de bolsas plásticas desechables: trae tu morral, bolsa de tela o canasta.",
      "🌾 Trueque abierto de semillas criollas y nativas entre agricultores y vecinos.",
      "📚 Espacio 'Dona y adopta un libro' de intercambio libre de lectura.",
      "� Talleres de aprendizaje en vivo (lombricultura, bioinsumos, salud botánica).",
      "🎵 Música popular, actividades culturales y dinámicas para niños.",
      "💳 Sistema de trueque y crédito mutuo disponible para miembros registrados."
    ],
    "cta_text": "Solicitar Ingreso como Productor o Miembro",
    "cta_link": "/p/unirse"
  },
  {
    "type": "stats",
    "title": "Diez Años Construyendo Soberanía Popular",
    "subtitle": "Cifras reales de un movimiento autónomo nacido en 2014 al calor de la Ley de Semillas.",
    "bg_theme": "primary",
    "items": [
      {
        "value": "+10 Años",
        "label": "De Encuentro Continuo",
        "description": "Mercado mensual en Parque Los Caobos desde octubre de 2014"
      },
      {
        "value": "+45 Colectivos",
        "label": "Familias Productoras",
        "description": "Valles del Tuy, El Junquito, El Hatillo, La Pastora y Baruta"
      },
      {
        "value": "0% Agrotóxicos",
        "label": "Producción 100% Limpia",
        "description": "Suelos vivos, abonos orgánicos y semillas ancestrales"
      },
      {
        "value": "Venta Libre",
        "label": "Moneda Local & Trueque",
        "description": "Abierto a toda Caracas con opción de trueque para miembros"
      }
    ]
  },
  {
    "type": "carousel",
    "title": "Galería Viva de Nuestras Jornadas",
    "subtitle": "Postales de las jornadas de mercado, talleres, cultura y trueque en Los Caobos.",
    "autoplay": true,
    "items": [
      {
        "image_url": "/images/pages/stats-feria.jpg",
        "title": "Hortalizas Frescas y Rubros Ancestrales",
        "caption": "Cosechadas en la madrugada en El Junquito y La Pastora para venta directa en moneda local.",
        "tag": "Cosecha del Día"
      },
      {
        "image_url": "/images/pages/stats-productores.jpg",
        "title": "Botica Conuquera y Medicina Tradicional",
        "caption": "Tinturas de propóleo, pomadas botánicas, aceites esenciales y plantas medicinales.",
        "tag": "Salud Botánica"
      },
      {
        "image_url": "/images/pages/stats-agroecologia.jpg",
        "title": "Gastronomía Artesanal y Ancestral",
        "caption": "La tradicional Cafunga de Barlovento, harinas sin gluten, cacao puro y café de montaña.",
        "tag": "Sabores Soberanos"
      },
      {
        "image_url": "/images/pages/stats-trueque.jpg",
        "title": "Talleres en Vivo & Trueque de Semillas",
        "caption": "Intercambio solidario de saberes, semillas nativas y libros para toda la comunidad.",
        "tag": "Formación Popular"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Dinámica y Organización de la Red",
    "subtitle": "Cómo funciona la Feria Conuquera tanto en el mercado mensual como en su vida interna.",
    "columns": 3,
    "items": [
      {
        "icon": "shopping-cart",
        "title": "Mercado Mensual a Cielo Abierto",
        "description": "Venta directa al público general en moneda local cada primer sábado de mes en Parque Los Caobos. Sin intermediarios ni usura.",
        "badge": "Venta Pública"
      },
      {
        "icon": "scale",
        "title": "Trueque & Crédito Mutuo",
        "description": "Los miembros de la red pueden intercambiar productos y trabajo mediante el sistema contable de suma cero (1 TQ = 1 kWh).",
        "badge": "Para Miembros"
      },
      {
        "icon": "users",
        "title": "Asambleas Trimestrales",
        "description": "Encuentros de gobernanza cada 3 meses donde los colectivos y productores deciden acuerdos, normas y planificación.",
        "badge": "Gobernanza"
      },
      {
        "icon": "leaf",
        "title": "Talleres & Formación Popular",
        "description": "Espacios educativos abiertos durante la feria y visitas a conucos sobre lombricultura, bioinsumos y agroecología.",
        "badge": "Educación"
      },
      {
        "icon": "heart",
        "title": "Cultura, Música & Comunidad",
        "description": "Presentaciones musicales, poesía popular, actividades infantiles y comidas comunitarias en cada edición.",
        "badge": "Cultura Viva"
      },
      {
        "icon": "home",
        "title": "Comisiones & Cayapas de Campo",
        "description": "Trabajo colectivo fuera del parque: comisiones temáticas, visitas técnicas a conucos y articulación ecoaldeana.",
        "badge": "Comunidad"
      }
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🤝 Participa en la Red",
    "title": "¿Eres productor agroecológico o deseas sumarte?",
    "subtitle": "Cualquier persona puede comprar en la feria. Si deseas ingresar como productor o participar en las asambleas y trueques, postúlate ante la asamblea.",
    "button_text": "Completar Solicitud de Admisión",
    "button_link": "/p/unirse",
    "secondary_text": "Preguntas Frecuentes",
    "secondary_link": "/p/faq",
    "theme": "forest"
  }
]`,
			Icon:      "home",
			MenuOrder: 1,
		},
		{
			Slug:     "filosofia",
			Title:    "Historia y Organización",
			Subtitle: "Nuestra Trayectoria, Asambleas y Vida Comunitaria",
			Content: `[
  {
    "type": "hero",
    "badge": "📜 Nacidos el 29 de Octubre de 2014",
    "title": "Un Movimiento al Calor de la Semilla Libre",
    "subtitle": "El conuco como horizonte histórico, político y espiritual de soberanía integral.",
    "description": "Nacimos en un momento crucial de la historia agrícola nacional, al calor de los debates populares del Movimiento Semillas del Pueblo para la construcción de la Ley de Semillas de Venezuela. La feria es tanto un mercado mensual como una organización viva con asambleas y comisiones activas.",
    "image_url": "/images/pages/conuco-horizonte.jpg",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "�️ Estructura y Organización",
    "title": "Vida Organizativa Más Allá del Mercado",
    "subtitle": "Asambleas trimestrales, comisiones y trabajo colectivo",
    "content": "La Feria Conuquera no es solo el evento de venta del primer sábado de cada mes. Contamos con una estructura organizativa sólida y horizontal:\n\n• Asambleas Trimestrales: Cada 3 meses, todos los colectivos y familias productoras se reúnen en asamblea formal para evaluar el funcionamiento, admitir nuevos proyectos y debatir políticas colectivas.\n• Comisiones de Trabajo: Se conforman comisiones periódicas para la logística, comunicación, bioinsumos, cultura y articulación comunitaria.\n• Actividades y Cayapas de Campo: Organizamos jornadas de trabajo voluntario y formativo en los conucos y unidades productivas en El Junquito, La Pastora, Baruta y Valles del Tuy.",
    "image_url": "/images/pages/asambleas-gobernanza.jpg",
    "image_position": "left",
    "highlights": [
      "Mercado mensual a cielo abierto con venta al público en moneda local.",
      "Asamblea general cada 3 meses para toma de decisiones democráticas.",
      "Talleres y actividades pedagógicas permanentes de campesino a campesino.",
      "Comisiones de trabajo voluntario para el cuidado colectivo."
    ],
    "quote": {
      "text": "El conuco es la escuela donde la tierra nos enseña que la abundancia nace de la diversidad y la organización comunitaria.",
      "author": "Vocería Colectiva de la Feria Conuquera"
    }
  },
  {
    "type": "timeline_history",
    "badge": "Hitos",
    "title": "Nuestra Línea de Tiempo",
    "subtitle": "Más de una década de siembra, trueque y organización popular.",
    "items": [
      {
        "year": "Octubre 2014",
        "title": "Nacimiento de la Feria Conuquera",
        "description": "Primer mercado en Los Caobos articulando a productores urbanos y rurales en resistencia económica.",
        "badge": "Fundación"
      },
      {
        "year": "Diciembre 2015",
        "title": "Aprobación de la Ley de Semillas",
        "description": "Victoria popular protegiendo las semillas nativas y prohibiendo transgénicos y patentes agrícolas.",
        "badge": "Ley Popular"
      },
      {
        "year": "2016 - 2023",
        "title": "Consolidación de Asambleas y Talleres",
        "description": "Encuentros trimestrales continuos, formación en bioinsumos y articulación con escuelas y organopónicos.",
        "badge": "Crecimiento"
      },
      {
        "year": "Octubre 2024",
        "title": "10 Años de Encuentro Ininterrumpido",
        "description": "Celebración de una década en Los Caobos e integración de sistemas digitales de trueque y crédito mutuo.",
        "badge": "Presente"
      }
    ]
  },
  {
    "type": "testimonials",
    "title": "Colectivos y Familias Fundadoras",
    "subtitle": "Algunas de las experiencias que hacen vida activa en la red.",
    "items": [
      {
        "name": "Melissa Producción Diversificada",
        "role": "Mónica Pérez y Luis Araujo",
        "project": "Camino de los Españoles, La Pastora",
        "quote": "Sembrar en las faldas de El Ávila nos ha permitido alimentar a Caracas con dignidad, amor a la tierra y precios justos para nuestro pueblo.",
        "location": "Caracas, Dto. Capital"
      },
      {
        "name": "Alfivegetales Km 38",
        "role": "Familia Miranda",
        "project": "El Junquito Km 38",
        "quote": "Llevamos 10 años trayendo acelgas, col rizada, queso de cabra y tubérculos 100% agroecológicos para venta directa en moneda local a toda la ciudad.",
        "location": "El Junquito, Miranda"
      }
    ]
  }
]`,
			Icon:      "heart",
			MenuOrder: 2,
		},
		{
			Slug:     "productos",
			Title:    "Nuestros Productos",
			Subtitle: "Venta Abierta en Moneda Local y Catálogo de Cosecha",
			Content: `[
  {
    "type": "hero",
    "badge": "🥦 Venta Directa en Moneda Local",
    "title": "Cosecha Sana, Sabores y Medicina",
    "subtitle": "Compra directamente a los productores en moneda local cada primer sábado de mes.",
    "description": "No necesitas ser miembro de la feria para comprar. Ven a Parque Los Caobos y encuentra hortalizas recién cosechadas, tubérculos ancestrales, quesos artesanales, botica conuquera, cosmética natural y delicias tradicionales a precios solidarios.",
    "image_url": "/images/pages/mercado-productores.jpg",
    "style": "standard"
  },
  {
    "type": "products_showcase",
    "source": "backend",
    "title": "Catálogo de Rubros en la Feria",
    "subtitle": "Variedad de alimentos y productos artesanales disponibles en cada jornada.",
    "categories": [],
    "items": []
  }
]`,
			Icon:      "shopping-cart",
			MenuOrder: 3,
		},
		{
			Slug:     "comunidad",
			Title:    "Comunidad y Saberes",
			Subtitle: "Talleres en Vivo, Cultura, Semillas y Asambleas",
			Content: `[
  {
    "type": "hero",
    "badge": "🎨 Aula Abierta, Cultura & Deportes",
    "title": "Más que un Mercado: Espacio de Formación Popular",
    "subtitle": "Talleres gratuitos, música en vivo, trueque de libros y semillas para toda la familia.",
    "description": "Inspirados en la metodología 'de campesino a campesino', cada jornada en Parque Los Caobos cuenta con actividades pedagógicas gratuitas para compartir conocimientos de siembra, lombricultura, salud botánica y fermentos.",
    "image_url": "/images/pages/talleres-cultura.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Actividades Permanentes en la Feria",
    "subtitle": "Dinámicas formativas y culturales gratuitas en cada edición.",
    "columns": 3,
    "items": [
      {
        "icon": "leaf",
        "title": "Trueque Libre de Semillas Criollas",
        "description": "Mesa comunitaria de intercambio de semillas nativas y locales. Trae las tuyas y llévate variedades adaptadas sin costo alguno.",
        "badge": "Intercambio"
      },
      {
        "icon": "heart",
        "title": "Dona y Adopta un Libro",
        "description": "Punto de intercambio de novelas, manuales de siembra y poesía. Llévate un libro con el compromiso de seguir compartiendo el saber.",
        "badge": "Lectura Libre"
      },
      {
        "icon": "users",
        "title": "Aula Conuquera Abierta",
        "description": "Talleres prácticos en vivo: sustratos con fibra de coco, biofertilizantes, kokedamas, medicina tradicional y bioinsumos.",
        "badge": "Talleres Gratis"
      },
      {
        "icon": "shopping-cart",
        "title": "Música & Expresiones Culturales",
        "description": "Música tradicional venezolana, ska popular, cantautores populares con cuatro y poesía campesina en vivo.",
        "badge": "Música en Vivo"
      },
      {
        "icon": "scale",
        "title": "Dinámicas Infantiles & Familiares",
        "description": "Juegos educativos, títeres y actividades recreativas y deportivas al aire libre para los más pequeños.",
        "badge": "Para la Familia"
      },
      {
        "icon": "home",
        "title": "Encuentros y Asambleas Trimestrales",
        "description": "Espacios de deliberación y planificación interna entre colectivos, además de visitas y cayapas en conucos periurbanos.",
        "badge": "Organización"
      }
    ]
  }
]`,
			Icon:      "users",
			MenuOrder: 4,
		},
		{
			Slug:     "como-funciona",
			Title:    "Cómo Funciona el Trueque",
			Subtitle: "Crédito Mutuo Comunitario para Miembros Registrados",
			Content: `[
  {
    "type": "hero",
    "badge": "⚡ 1 TQ = 1 kWh de Energía Objetiva",
    "title": "Venta en Moneda Local vs. Trueque Comunitario",
    "subtitle": "Todo el público puede comprar en moneda local; los miembros además intercambian en Trueque TQ.",
    "description": "En la feria, la venta al público general se realiza de forma directa en moneda local. Paralelamente, los miembros registrados cuentan con una herramienta contable de crédito mutuo donde lo que das y lo que recibes se calcula en base a la energía física invertida (1 TQ = 1 kWh = 3.6 MJ). Nuestros precios se basan en bases de datos científicas internacionales: ICE Database (Universidad de Bath), Agribalyse (ADEME/INRAE Francia) y Ecoinvent (Suiza).",
    "image_url": "/images/pages/trueque-tq.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "¿Qué es el Trueque?",
    "subtitle": "Una forma milenaria de intercambio que renace en las comunidades contemporáneas",
    "columns": 2,
    "items": [
      {"icon":"users","title":"Intercambio sin dinero","description":"El trueque es una forma de intercambio basada en la colaboración y el valor compartido. A través de la red, personas y comunidades intercambian bienes y servicios directamente, sin necesidad de dinero, bancos ni intermediarios financieros. Promueve la autosuficiencia, el apoyo mutuo y el desarrollo sostenible.","badge":"Sin dinero"},
      {"icon":"scale","title":"Valor por energía incorporada, no por precio","description":"No existe un precio en unidades monetarias. El valor lo determina la energía física invertida en producir cada bien o servicio: horas de trabajo, esfuerzo, insumos, herramientas y amortización. Los precios se calculan sumando toda la energía directa e indirecta necesaria (energía incorporada o embodied energy), medida en kilovatios-hora (kWh) o megajulios (MJ), donde 1 kWh = 3.6 MJ. Una hora de trabajo manual agrícola equivale a 0.61 kWh (consumo metabólico de ~525 kcal/h); una hora de trabajo general equivale a 1.0 kWh; una hora de trabajo técnico con herramientas eléctricas equivale a 3.0 kWh.","badge":"Energía objetiva"},
      {"icon":"heart","title":"Multilateral y diferido","description":"No necesitas encontrar a alguien que tenga exactamente lo que tú quieres y quiera exactamente lo que tú ofreces. El sistema de crédito mutuo permite que aportes hoy a una persona y recibas mañana de otra. El trueque se vuelve diferido y multilateral: aportas cuando puedes, recibes cuando necesitas.","badge":"Diferido"},
      {"icon":"leaf","title":"Sin interés, sin acumulación","description":"No se cobra interés sobre los saldos negativos ni se premia la acumulación de saldos positivos. El sistema está diseñado para que la riqueza circule, no para que se concentre. Las experiencias históricas de clubes de trueque en Argentina, LETS en Europa y redes de moneda social demuestran que el crédito mutuo sin interés fomenta el intercambio equitativo.","badge":"Sin interés"}
    ]
  },
  {
    "type": "trueque_explainer",
    "title": "Los 4 Pasos del Crédito Mutuo para Miembros",
    "subtitle": "Comprende la lógica solidaria y transparente del sistema de trueque.",
    "energy_rate_text": "Valor de referencia objetivo: 1 TQ = 1 kWh de energía",
    "steps": [
      {"step":1,"title":"Empiezas en Cero (0 TQ)","description":"Al ingresar formalmente a la red, tu cuenta inicia en balance 0. No necesitas comprar monedas, pagar inscripción ni aportar capital. Tampoco necesitas tener nada ahorrado para empezar a recibir beneficios.","icon":"users"},
      {"step":2,"title":"Al Recibir Bienes en Trueque","description":"Tu cuenta registra saldo negativo (-TQ). No es una deuda financiera: es un compromiso ético de entregar productos o trabajo futuro a la comunidad. Puedes recibir alimentos, medicinas naturales, servicios o artesanías sin tener saldo positivo previo.","icon":"shopping-cart"},
      {"step":3,"title":"Al Aportar Cosecha o Trabajo","description":"Tu cuenta registra saldo positivo (+TQ). Significa que has entregado valor a la comunidad y puedes adquirir bienes de otros miembros. Cada vez que aportas, tu saldo sube; cada vez que recibes, baja.","icon":"leaf"},
      {"step":4,"title":"La Suma Total Siempre es Cero","description":"El total de todas las cuentas de la red da exactamente 0 TQ. No existe inflación, devaluación ni intermediarios bancarios. Nadie emite moneda: cada intercambio crea un saldo positivo y uno negativo equivalente. Es un registro contable puro de compromisos y aportes.","icon":"scale"}
    ],
    "key_points": {
      "positive_balance": "Indica que has aportado más de lo que has recibido. Tienes derecho a recibir bienes o labores equivalentes de otros miembros en el futuro.",
      "negative_balance": "Es un compromiso adquirido: has recibido sustento de la comunidad y lo retribuirás con tu propia cosecha, productos o trabajo. No hay vergüenza en tener saldo negativo: es la prueba de que el sistema funciona, de que alguien recibió lo que necesitaba.",
      "zero_sum": "No es dinero bancario ni financiero: es un registro contable de compromisos adquiridos y aportes recíprocos. Permite el trueque diferido y multilateral: aportas trabajo o cosecha hoy, queda registrado su costo objetivo en energía (kWh), y en el futuro recibes esa misma energía cuando la necesites."
    }
  },
  {
    "type": "features_grid",
    "title": "Sistema de Moneda Saldo Cero: Los 5 Pilares",
    "subtitle": "Conocido como LETS (Local Exchange Trading System) o Credito Mutuo. No es dinero, no es criptomoneda, no es banco. Es un registro contable comunitario.",
    "columns": 1,
    "items": [
      {"icon":"circle-dot","title":"Pilar 1: Punto de Partida - Saldo Inicial Cero","description":"Ningun miembro necesita aportar capital bancario externo, dinero fiduciario nacional ni ahorros para empezar a operar. Todas las cuentas de los participantes inician exactamente en cero. La moneda no existe previamente de forma fisica o acumulada en bovedas; en su lugar, se genera y se salda dinamicamente en el momento exacto en el que se realiza un intercambio. No hay emision de moneda, no hay banco central, no hay inflacion. El TQ se crea en el instante del intercambio y se destruye cuando se salda.","badge":"Saldo cero"},
      {"icon":"arrow-right-left","title":"Pilar 2: Dinamica del Intercambio - Credito Mutuo","description":"Cuando se realiza una transaccion, el intercambio se registra de manera contable y equilibrada dentro de la red. Ejemplo: si un productor de huevos te entrega su producto, la cuenta del productor se acredita (suma saldo positivo) y tu cuenta se debita (resta saldo y pasa a negativo) de forma equitativa. La suma de todos los saldos existentes en la comunidad siempre es igual a cero. No hay dinero circulando: hay un registro de quien aporto que y quien recibio que.","badge":"Credito mutuo"},
      {"icon":"trending-down","title":"Pilar 3: Limite Inferior - Piso Negativo","description":"El hecho de que no tengas dinero o saldo positivo en un momento dado no te impide adquirir lo que necesitas para vivir. Tu cuenta simplemente descendera a terreno negativo, funcionando como una linea de credito comunitaria. Para evitar el endeudamiento irresponsable o que un miembro consuma de manera ilimitada a expensas del esfuerzo de los demas, se establece un limite inferior o piso negativo. Al tocar este limite, la cuenta se bloquea temporalmente para nuevas compras. Para reactivar su capacidad de intercambio, la persona debe saldar su saldo negativo aportando valor de vuelta a la ecoaldea: ofreciendo bienes de su propia parcela o dedicando horas de trabajo comunitario.","badge":"Piso negativo"},
      {"icon":"trending-up","title":"Pilar 4: Limite Superior - Techo Positivo","description":"Para evitar el acaparamiento y la acumulacion innecesaria de creditos, se implementa un limite superior o techo positivo. Una vez que un miembro alcanza este tope maximo de creditos acumulados por sus ventas, su cuenta se bloquea y no puede recibir mas abonos. Esto lo obliga a gastar o reinvertir sus creditos adquiriendo bienes de otros productores, utilizando servicios de la aldea o financiando proyectos comunales. Esto asegura que la riqueza circule constantemente y no se estanque de forma ociosa. Nadie puede acumular riqueza indefinidamente: el sistema esta disenado para que la riqueza circule.","badge":"Techo positivo"},
      {"icon":"zap","title":"Pilar 5: Respaldo y Unidad de Cuenta - Energia Fisica Real","description":"Para que la moneda tenga credibilidad y estabilidad frente a la inflacion externa, su unidad de cuenta (el TQ - Trueque) esta anclada directamente a energia fisica real invertida en producir cada bien o servicio. 1 TQ = 1 kWh = 3.6 megajulios (MJ). No esta respaldada por oro ni por dolares ni por la promesa de un gobierno. Esta respaldada por la energia que costo producir lo que intercambias. Esto hace que el valor sea objetivo, medible y auditable: cualquier persona puede verificar cuanta energia se invirtio en producir algo. No hay especulacion posible: la energia no se devalua, no se infla, no se manipula.","badge":"Energia objetiva"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Por Que el TQ No es Dinero",
    "subtitle": "Es importante entender la diferencia entre el TQ y el dinero convencional",
    "columns": 2,
    "items": [
      {"icon":"x","title":"No es dinero fiduciario","description":"El dinero fiduciario (dolares, bolivares, euros) es emitido por un banco central, su valor depende de la confianza en el gobierno, se devalua con la inflacion y puede ser manipulado por la politica economica. El TQ no es emitido por ningun banco, no se devalua, no tiene inflacion y no depende de ningun gobierno. Su valor es fijo: 1 TQ siempre sera 1 kWh de energia.","badge":"No es fiduciario"},
      {"icon":"x","title":"No es criptomoneda","description":"Las criptomonedas (Bitcoin, Ethereum) se minan con gasto computacional, cotizan en exchanges, tienen valor de mercado fluctuante y pueden ser objeto de especulacion financiera. El TQ no se mina, no cotiza en ningun exchange, no tiene valor de mercado fluctuante y no se puede especular con el. Su valor es fijo y objetivo: energia fisica real.","badge":"No es cripto"},
      {"icon":"x","title":"No es dinero bancario","description":"El dinero bancario se deposita en bancos, genera intereses, puede ser prestado a terceros y multiplicarse mediante el sistema de reserva fraccionaria. El TQ no se deposita en ningun banco, no genera intereses, no se puede prestar a terceros y no se multiplica. Es un registro contable de intercambios reales, no un instrumento financiero.","badge":"No es bancario"},
      {"icon":"check","title":"Es un registro contable comunitario","description":"El TQ es un registro transparente de quien aporto que y quien recibio que. La suma de todos los saldos siempre da cero. No hay emision de moneda, no hay inflacion, no hay devaluacion. Solo hay registro honesto de intercambios. Es una herramienta de contabilidad social, no un instrumento financiero. Permite el trueque diferido y multilateral sin necesidad de dinero.","badge":"Registro contable"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Límites y Confianza Progresiva",
    "subtitle": "El sistema crece contigo: entre más participas, más confianza acumulas",
    "columns": 3,
    "items": [
      {"icon":"users","title":"Personas Naturales","description":"Cada persona natural que ingresa recibe un limite simetrico de -500 TQ (saldo negativo) y +500 TQ (saldo positivo). Esto significa que puedes recibir hasta 500 TQ en bienes y servicios sin haber aportado nada todavia, lo que cubre aproximadamente una canasta basica familiar mensual. Es la confianza inicial que la comunidad te otorga para que empieces a participar. Los limites positivo y negativo son iguales para garantizar equidad: lo que puedes recibir equivale a lo que puedes aportar.","badge":"Limite 500 TQ"},
      {"icon":"building","title":"Organizaciones y Colectivos","description":"Las organizaciones, cooperativas y colectivos registrados tienen limites simetricos mas amplios porque su volumen de intercambio es mayor. Una organizacion de produccion tiene un limite de -5000 TQ y +5000 TQ; una de consumo -3000 TQ y +3000 TQ. Esto permite que las organizaciones puedan recibir insumos y herramientas a credito y retribuir con su produccion colectiva. Los limites siempre son simetricos: lo que puedes recibir equivale a lo que puedes aportar.","badge":"Limite 3000-5000 TQ"},
      {"icon":"trending-up","title":"Tu limite sube con el tiempo","description":"A medida que participas activamente, aportas regularmente y cumples tus compromisos, la asamblea puede aumentar tu limite. Un miembro activo pasa de -500/+500 a -1000/+1000 TQ. La confianza se construye con hechos, no con dinero. Un miembro con un ano de participacion activa y buen cumplimiento puede tener un limite 2 o 3 veces mayor que al ingresar, siempre manteniendo simetria entre positivo y negativo.","badge":"Crece contigo"},
      {"icon":"shield","title":"Sin dinero para entrar","description":"No necesitas dinero para ingresar ni para recibir beneficios. No pagas inscripción, no compras monedas, no necesitas tener ahorros. El sistema está diseñado para incluir a quienes no tienen acceso al dinero o al sistema bancario. Tu capacidad de recibir y aportar se basa en tu compromiso comunitario, no en tu capital.","badge":"Sin barreras"},
      {"icon":"heart","title":"Recibir sin tener","description":"Puedes recibir beneficios sin tener nada previo. Recibes alimentos, medicinas, servicios o herramientas y quedas en compromiso negativo. Ese compromiso lo saldas aportando tu trabajo, tu cosecha o tus productos cuando puedas. Es la esencia del trueque diferido: hoy recibes, mañana aportas.","badge":"Recibir primero"},
      {"icon":"rotate-cw","title":"Aportar para salir de deuda","description":"Cuando tu saldo es negativo, no hay cobradores ni intereses. Simplemente aportas lo que produces: cosecha, pan, artesanía, trabajo en la feria, talleres, cayapas. Cada aporte reduce tu saldo negativo hasta llegar a cero o volverse positivo. La comunidad te acompaña, no te presiona.","badge":"Aportar y sanar"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Por Que 500 TQ: Calculo de la Canasta Basica",
    "subtitle": "El limite minimo de 500 TQ no es arbitrario: se calcula del costo energetico real de alimentar a una familia de 4 personas durante un mes",
    "columns": 1,
    "items": [
      {"icon":"calculator","title":"Como se calcula la canasta basica","description":"Usamos los precios reales del catalogo de productos de la feria, calculados en base a la energia incorporada (kWh) de cada alimento. Sumamos las cantidades mensuales necesarias para una familia de 4 personas y multiplicamos por el precio en TQ de cada producto. El resultado es el costo energetico total de la canasta basica mensual.","badge":"Metodo"},
      {"icon":"wheat","title":"Granos y cereales: 164 TQ","description":"Granos basicos (caraota, frijol, maiz criollo): 8 kg/mes x 10 TQ/kg = 80 TQ. Arroz: 4 kg/mes x 11 TQ/kg = 44 TQ. Harina de maiz: 4 kg/mes x 10 TQ/kg = 40 TQ. Total granos: 164 TQ/mes. Los granos son la base calorica de la alimentacion y tienen mayor energia incorporada por el ciclo completo de siembra, cosecha y secado.","badge":"164 TQ"},
      {"icon":"carrot","title":"Verduras, hortalizas y frutas: 52 TQ","description":"Tuberculos (yuca, name, platano): 10 kg/mes x 2 TQ/kg = 20 TQ. Verduras y hortalizas: 8 kg/mes x 2 TQ/kg = 16 TQ. Frutas de temporada: 6 kg/mes x 2 TQ/kg = 12 TQ. Hojas verdes: 2 kg/mes x 2 TQ/kg = 4 TQ. Total frescos: 52 TQ/mes. Los productos frescos de conuco tienen baja energia incorporada porque se cultivan localmente con trabajo manual.","badge":"52 TQ"},
      {"icon":"milk","title":"Proteina animal: 58 TQ","description":"Leche fresca: 8 L/mes x 2 TQ/L = 16 TQ. Huevos: 3 docenas/mes x 3 TQ/docena = 9 TQ. Pollo de patio: 4 kg/mes x 5 TQ/kg = 20 TQ. Pescado: 2 kg/mes x 7 TQ/kg = 14 TQ. Total proteina animal: 59 TQ/mes (redondeado a 58). La proteina animal tiene mayor energia incorporada por la conversion alimenticia. Jerarquia: vacuno > cerdo > pollo > huevos > leche (FAO 2013).","badge":"58 TQ"},
      {"icon":"bread","title":"Transformados y otros: 60 TQ","description":"Panaderia casera: 4 kg/mes x 5 TQ/kg = 20 TQ. Aceite vegetal: 1 L/mes x 10 TQ/L = 10 TQ. Papelon/panela: 2 kg/mes x 15 TQ/kg = 30 TQ. Total transformados: 60 TQ/mes. Los productos transformados incluyen molienda, amasado, horneado o refinacion.","badge":"60 TQ"},
      {"icon":"droplets","title":"Agua y servicios basicos: 90 TQ","description":"Agua: 30 dias x 1 TQ/dia = 30 TQ. Servicios basicos (electricidad, gas, mantenimiento): 30 dias x 2 TQ/dia = 60 TQ. Total servicios: 90 TQ/mes. El agua y los servicios basicos tienen un costo energetico minimo pero necesario.","badge":"90 TQ"},
      {"icon":"scale","title":"TOTAL: 424 TQ -> Redondeado a 500 TQ","description":"Sumando todos los rubros: 164 (granos) + 52 (frescos) + 58 (proteina) + 60 (transformados) + 90 (servicios) = 424 TQ. Redondeamos a 500 TQ para dar un margen de seguridad. Por eso el limite minimo para una persona natural nueva es -500 TQ / +500 TQ: cubre exactamente una canasta basica familiar mensual. Esto garantiza que cualquier miembro nuevo pueda recibir lo necesario para alimentar a su familia durante un mes sin haber aportado nada todavia.","badge":"500 TQ"},
      {"icon":"users","title":"Por que los limites son simetricos","description":"El limite negativo y el limite positivo tienen el mismo valor absoluto. Si el negativo es -500, el positivo tambien es +500. Esto garantiza equidad: lo que puedes recibir de la comunidad equivale exactamente a lo que puedes aportar. Si los limites fueran dispares (ej: -50 negativo, +500 positivo), el sistema favoreceria recibir mas de lo que se da, rompiendo el principio de suma cero del credito mutuo. La simetria es fundamental para que el sistema sea justo.","badge":"Simetria"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Filosofía Agroecológica",
    "subtitle": "Más que una técnica de cultivo, una forma de habitar la Tierra",
    "columns": 2,
    "items": [
      {"icon":"leaf","title":"Agroecología: ciencia, práctica y movimiento","description":"La agroecología no es solo una forma de cultivar sin agrotóxicos. Es una ciencia que aplica principios ecológicos a la agricultura, una práctica productiva que respeta los ciclos naturales, y un movimiento social que defiende la soberanía alimentaria, la justicia social y los derechos de los pueblos. La FAO la reconoce como método capaz de transformar los sistemas alimentarios hacia la sostenibilidad.","badge":"Ciencia viva"},
      {"icon":"sprout","title":"Producción natural vs. sintética","description":"La agricultura industrial se basa en fertilizantes químicos, plaguicidas, semillas modificadas genéticamente, alta mecanización y consumo de combustibles fósiles. Contamina suelo, agua y aire; reduce la biodiversidad; y excluye a los pequeños productores. La agroecología, en cambio, recicla nutrientes, fija nitrógeno biológicamente, controla plagas con biodiversidad asociada y produce alimentos seguros y de mayor calidad nutricional.","badge":"Natural"},
      {"icon":"users","title":"Sin explotación de personas","description":"La agroecología promueve el respeto de los derechos laborales, la igualdad de género, el intercambio justo entre productores y consumidores, y la valoración de los conocimientos tradicionales. Ningún alimento agroecológico debe provenir de explotación humana. La producción se basa en relaciones justas, no en el lucro a costa del trabajo ajeno.","badge":"Justicia"},
      {"icon":"heart","title":"Soberanía alimentaria","description":"La soberanía alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios: qué sembrar, cómo sembrar, para quién producir y cómo distribuir. No es solo seguridad alimentaria (tener qué comer), es autonomía: que la comunidad controle su alimentación, no las corporaciones transnacionales que monopolizan las semillas y los agroquímicos.","badge":"Autonomía"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Semillas: Patrimonio de los Pueblos",
    "subtitle": "Conservar nuestras semillas criollas y nativas es conservar nuestra libertad",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"Semillas criollas y nativas","description":"Desde épocas ancestrales, las poblaciones humanas dieron origen a la agricultura domesticando, mejorando y adaptando una gran diversidad de cultivos. Las civilizaciones de América Latina desarrollaron innumerables variedades nativas de maíz, frijol, papa, yuca, tomate, frutales y otros cultivos. Estas semillas son patrimonio colectivo de los pueblos y han circulado libremente, garantizando autonomía frente a las crisis.","badge":"Patrimonio"},
      {"icon":"shield","title":"Libres de transgénicos","description":"Las semillas transgénicas son modificadas genéticamente en laboratorios y patentadas por corporaciones. Su uso obliga a los agricultores a comprar semillas nuevas cada temporada, crea dependencia económica, contamina las variedades nativas por polinización cruzada y reduce la biodiversidad. En la feria promovemos territorios libres de transgénicos: nuestras semillas criollas son libres, reproducibles y adaptadas a nuestro clima.","badge":"Sin transgénicos"},
      {"icon":"leaf","title":"Semillas no procesadas","description":"Las semillas que intercambiamos no son procesadas, tratadas con fungicidas industriales ni recubiertas con químicos. Son semillas vivas, recién cosechadas, que conservan su vitalidad natural. Cada semilla que intercambias en la feria puede ser sembrada, reproducida y compartida nuevamente. Es un ciclo de vida que no se puede comprar en una tienda.","badge":"Vivas"},
      {"icon":"rotate-cw","title":"Trueque libre de semillas","description":"En cada encuentro mensual abrimos un espacio de trueque libre de semillas criollas y nativas entre agricultores y vecinos. Traes tus semillas, llevas las de otros. No hay dinero de por medio. Es la forma más antigua de garantizar que la diversidad agrícola se mantenga viva: cada semilla que viaja de una mano a otra es un acto de soberanía.","badge":"Intercambio"}
    ]
  },
  {
    "type": "features_grid",
    "title": "El Sueño de la Ecoaldea",
    "subtitle": "Comunidades intencionales que concretizan el Buen Vivir",
    "columns": 2,
    "items": [
      {"icon":"home","title":"¿Qué es una ecoaldea?","description":"Una ecoaldea es un asentamiento humano a escala humana, diseñado conscientemente mediante procesos participativos para asegurar la sostenibilidad a largo plazo. Integran las cuatro dimensiones de la sostenibilidad: ecológica, económica, social y cultural. La Red Global de Ecoaldeas (GEN), fundada en 1995, conecta comunidades en todos los continentes que regeneran sus entornos sociales y naturales.","badge":"Comunidad"},
      {"icon":"leaf","title":"Más que una utopía","description":"Las ecoaldeas no son utopías aisladas: son modelos funcionales de lo que significa vivir en armonía con la naturaleza de forma sostenible y espiritualmente satisfactoria. En casi todos los casos, son construidas por personas con pocos recursos personales pero con alto grado de idealismo y dedicación. El mundo necesita buenos ejemplos de convivencia regenerativa, y las ecoaldeas son laboratorios vivos de la sociedad futura.","badge":"Modelo real"},
      {"icon":"globe","title":"Un movimiento global","description":"Desde la Cumbre de la Tierra de Río en 1992, las ecoaldeas se han expandido como respuesta local a problemas globales urgentes. Hay ecoaldeas en Filipinas, granjas de permacultura en Senegal, proyectos de cohousing urbano en Berlín, comunidades tradicionales en los Andes. La Feria Conuquera comparte principios con este movimiento: soberanía alimentaria, energía limpia, gobernanza comunitaria y economía solidaria.","badge":"Global"},
      {"icon":"sparkles","title":"Nuestro Campo Soberano","description":"Soñamos con estructurar una comunidad intencional agroecológica de ciclo cerrado: permacultura, propiedad colectiva indivisible, energía solar y eólica off-grid, biodigestores, gobernanza sociocrática y economía de crédito mutuo. No es escapar del mundo: es crear el mundo que queremos ver. Conocer más sobre este proyecto en la sección Campo Soberano.","badge":"Nuestro sueño"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Otras Experiencias en el Mundo",
    "subtitle": "Referentes y movimientos que inspiran prácticas similares a las nuestras. No son aliados ni socios: son experiencias que compartimos y de las cuales aprendemos.",
    "columns": 3,
    "items": [
      {"icon":"globe","title":"Red Global de Ecoaldeas (GEN)","description":"Fundada en 1995, conecta ecoaldeas en todos los continentes. Promueve el intercambio de conocimientos, soluciones y mejores prácticas entre comunidades regenerativas. Su lema: El mundo necesita más ecoaldeas. Es la red más importante del movimiento global de ecoaldeas.","badge":"GEN"},
      {"icon":"globe","title":"CASA Latina","description":"El Consejo de Asentamientos Sustentables de América Latina es la rama de GEN para Latinoamérica. Agrupa redes nacionales de bioconstrucción, permacultura y ecoaldeas. Es el punto de partida para buscar proyectos hispanohablantes orientados al rescate de saberes indígenas y campesinos.","badge":"CASA Latina"},
      {"icon":"scale","title":"Sistemas LETS","description":"Los Local Exchange Trading Systems (LETS) nacieron en Canadá en 1983 y se expandieron por Europa y Oceanía. Son sistemas de crédito mutuo donde los miembros intercambian bienes y servicios sin dinero, usando una unidad de cuenta interna. Todas las cuentas empiezan en cero y la suma total siempre es cero. Inspiraron nuestro sistema TQ.","badge":"LETS"},
      {"icon":"users","title":"Club del Trueque (Argentina)","description":"En Argentina, las redes de trueque surgieron en los años 90 como respuesta a la crisis económica. Llegaron a tener millones de participantes que intercambiaban bienes y servicios con créditos sin usar dinero oficial. Demostraron que el crédito mutuo es una herramienta poderosa de inclusión para quienes el sistema financiero excluye.","badge":"Argentina"},
      {"icon":"sprout","title":"Red de Semillas Libres","description":"Movimientos como la Red de Semillas Libres de Colombia y la Red Guardianes de Semillas de Vida defienden las semillas nativas y criollas frente al avance corporativo. Promueven territorios libres de transgénicos y la soberanía alimentaria como derecho inalienable de los pueblos.","badge":"Semillas libres"},
      {"icon":"leaf","title":"Vía Campesina","description":"La Vía Campesina es el movimiento internacional de campesinos, pueblos indígenas y trabajadores agrícolas más grande del mundo, presente en más de 80 países. Defiende la agricultura campesina y la agroecología como alternativa al modelo agroindustrial. Acuñó el concepto de soberanía alimentaria.","badge":"Vía Campesina"},
      {"icon":"heart","title":"Slow Food","description":"Movimiento global nacido en Italia en 1986 que promueve alimentos buenos, limpios y justos: buenos para quien los come, limpios para el planeta, justos para quien los produce. Defiende la biodiversidad alimentaria y las tradiciones culinarias locales frente a la homogeneización de la comida rápida.","badge":"Slow Food"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Estándares Internacionales de Contabilidad Energética",
    "subtitle": "Nuestros precios no son arbitrarios: se basan en bases de datos científicas internacionales de energía incorporada",
    "columns": 2,
    "items": [
      {"icon":"database","title":"ICE Database (Universidad de Bath)","description":"La Inventory of Carbon and Energy Database es la base de datos más reconocida para energía incorporada de materiales de construcción e insumos industriales. Contiene valores cradle-to-gate (de la cuna a la puerta de fábrica) para acero, aluminio, cemento, vidrio, madera, polímeros y más. Nuestros precios de materiales se basan en estos datos.","badge":"ICE Database"},
      {"icon":"leaf","title":"Agribalyse (ADEME / INRAE, Francia)","description":"Base de datos francesa con más de 2,500 productos alimenticios analizados desde la granja hasta el plato (cradle-to-plate). Incluye energía incorporada de cultivos, carnes, lácteos, granos y productos transformados. Nuestros precios de alimentos se alinean con estos valores.","badge":"Agribalyse"},
      {"icon":"globe","title":"Ecoinvent (Suiza)","description":"La base de datos suiza Ecoinvent es el estándar global para análisis de ciclo de vida (LCA). Contiene inventarios industriales multisectoriales modulables utilizados por software como SimaPro y GaBi. Proporciona valores de energía incorporada para combustibles, transporte, manufactura y servicios.","badge":"Ecoinvent"},
      {"icon":"zap","title":"1 TQ = 1 kWh = 3.6 MJ","description":"La equivalencia física fundamental: 1 kilovatio-hora equivale a 3.6 megajulios. Esta es una constante inmutable de la física, no una convención monetaria. Nuestro Trueque (TQ) se ancla directamente a esta unidad física. No hay inflación posible: la energía no se devalúa.","badge":"Conversión física"},
      {"icon":"users","title":"Trabajo humano medido en kWh","description":"El consumo metabólico de un trabajador agrícola en esfuerzo físico intenso es de ~525 kcal/hora = 0.61 kWh/hora. El trabajo general (oficina, servicios) consume ~1.0 kWh/hora. El trabajo técnico con herramientas eléctricas consume 2.0-4.0 kWh/hora. Estos valores provienen de estudios fisiológicos y del Ecoinvent.","badge":"Metabolismo"},
      {"icon":"trending-up","title":"Tasa de Retorno Energético (EROI)","description":"Un sistema productivo es viable a largo plazo solo si su EROI neto es significativamente superior a 1:1. La energía invertida en producir un bien debe ser menor que la energía que el bien aporta a la comunidad. Nuestro catálogo refleja esta jerarquía: los productos locales de baja transformación son más accesibles que los productos industriales de alta transformación.","badge":"EROI"},
      {"icon":"book","title":"Howard T. Odum y la Emergía","description":"El ecólogo Howard T. Odum desarrolló el análisis de emergía: cuantifica la energía solar equivalente necesaria para generar un flujo o producto, incluyendo el trabajo gratuito de la biosfera (fotosíntesis, ciclo hidrológico, formación de suelos). Es el marco científico más completo para fijar precios ecológicos reales sin externalidades ocultas.","badge":"Emergía"},
      {"icon":"coins","title":"Henry Ford y el Dólar de Energía (1921)","description":"En 1921, Henry Ford y Thomas Edison propusieron reemplazar el patrón oro por una moneda respaldada por la capacidad de generación hidroeléctrica de la presa Wilson Dam. Argumentaban que la electricidad constituía un valor verdadero e inmutable que liberaría al sistema productivo de los intereses bancarios y la inflación fiduciaria. Nuestro sistema retoma esta visión centenaria.","badge":"Ford y Edison"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Cómo se Calcula el Precio de un Producto",
    "subtitle": "La fórmula de energía incorporada total y su conversión a Trueques (TQ)",
    "columns": 1,
    "items": [
      {"icon":"calculator","title":"Fórmula: EE_total = E_directa + E_insumos + E_trabajo + E_transporte","description":"El precio en TQ de cualquier producto se calcula sumando cuatro componentes: (1) E_directa = energía térmica o eléctrica consumida en el proceso local, medida en kWh; (2) E_insumos = energía incorporada de cada materia prima utilizada (masa × coeficiente de energía incorporada en kWh/kg); (3) E_trabajo = horas de trabajo humano × coeficiente de intensidad (0.61 kWh/h manual, 1.0 kWh/h general, 3.0 kWh/h técnico); (4) E_transporte = gasto energético de flete (masa × distancia × eficiencia del vehículo). El total en MJ se divide entre 3.6 para obtener el precio en TQ (kWh).","badge":"Fórmula"},
      {"icon":"bread","title":"Ejemplo: 1 kg de pan artesanal","description":"Harina de trigo: 1.1 kg × 33.6 MJ/kg = 36.96 MJ. Horneado térmico: 4.00 MJ. Mano de obra: 0.25 horas × 5.0 MJ/h = 1.25 MJ. Total: 42.21 MJ ÷ 3.6 = 11.73 kWh = 12 TQ. Este cálculo se basa en datos de Agribalyse y refleja el costo energético real de producir pan en una infraestructura comunitaria.","badge":"Ejemplo práctico"},
      {"icon":"layers","title":"Productos agrupados por equivalencia energética","description":"Productos con energía incorporada similar se agrupan bajo un mismo precio. Por ejemplo: todas las hortalizas frescas locales cuestan 2 TQ/kg porque su energía incorporada es de 3.6-7.2 MJ/kg (1-2 kWh/kg). Todos los granos básicos cuestan 10 TQ/kg porque su energía incorporada es de 31-37 MJ/kg (9-10 kWh/kg). Esto simplifica el catálogo sin perder precisión: productos equivalentes en costo energético tienen el mismo precio.","badge":"Agrupación"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Historia de la Moneda Energética",
    "subtitle": "Más de un siglo de propuestas científicas e industriales para anclar el valor en la física, no en la especulación",
    "columns": 2,
    "items": [
      {"icon":"zap","title":"Ford y Edison: el Dólar de Energía (1921)","description":"En diciembre de 1921, Henry Ford y Thomas Edison inspeccionaban la presa Wilson Dam en Muscle Shoals, Alabama. Allí propusieron reemplazar el patrón oro por una moneda respaldada por la capacidad de generación hidroeléctrica del río Tennessee (1.000.000 de caballos de fuerza). Argumentaban que el oro y los bonos con interés eran ficciones financieras susceptibles a especulación. La electricidad, en cambio, constituía un valor verdadero, medible e inmutable. Al emitir moneda vinculada a kilovatios reales, se eliminaba la inflación y el endeudamiento sistémico. Esta propuesta centenaria es la raíz conceptual de nuestro sistema.","badge":"1921"},
      {"icon":"users","title":"Movimiento Tecnocrático (1930s)","description":"En la década de 1930, Howard Scott y Marion King Hubbert lideraron el Movimiento Tecnocrático en Norteamérica. Propusieron reemplazar el sistema monetario por Certificados de Energía: la capacidad energética total de la nación se distribuía equitativamente entre los ciudadanos mediante créditos intransferibles denominados en julios o ergios. Esto anulaba la acumulación especulativa y equilibraba oferta con demanda real. Aunque nunca se implementó a escala nacional, sus ideas influyeron en la economía biofísica moderna.","badge":"1930s"},
      {"icon":"book","title":"Howard T. Odum y la Emergía (1980s)","description":"El ecólogo Howard T. Odum desarrolló el análisis de emergía (emergy synthesis), la metodología más completa para fijar precios ecológicos. Cuantifica cuánta energía solar equivalente (seJ, solar emjoules) fue necesaria directa e indirectamente para generar un producto. A diferencia de la energía incorporada convencional (que mide solo combustibles fósiles y electricidad), la emergía contabiliza el trabajo gratuito de la biosfera: radiación solar, fotosíntesis, ciclo hidrológico, viento y formación de suelos. La transformidad (seJ/J) mide la calidad biofísica de la energía.","badge":"Emergía"},
      {"icon":"globe","title":"Ecoaldeas y micro-redes (1990s-presente)","description":"Ecoaldeas como Sieben Linden (Alemania), Findhorn (Escocia) y Tamera (Portugal) aplican sistemas internos de compensación energética. Las contribuciones laborales en instalación de paneles fotovoltaicos, tala de biomasa o mantenimiento de micro-redes se registran en un libro mayor comunitario expresado en horas de trabajo y su equivalente en kilovatios-hora. Los participantes canjean estos créditos por alimentos locales, lácteos artesanales o uso de maquinaria en talleres comunitarios. Nuestro sistema se inspira directamente en estas prácticas.","badge":"Ecoaldeas"},
      {"icon":"leaf","title":"Som Energia: Generation kWh (España)","description":"Som Energia es una cooperativa española que desarrolló el modelo Generation kWh. Los miembros adquieren Acciones Energéticas que otorgan el derecho a recibir un volumen determinado de electricidad renovable anual al precio de costo de generación. El saldo de la cuenta personal no se expresa en euros, sino en kilovatios-hora producidos por instalaciones eólicas o solares de la comunidad. Esto aísla a los usuarios de la volatilidad de los mercados financieros y demuestra que la energía puede funcionar como unidad de cuenta real.","badge":"Som Energia"},
      {"icon":"coins","title":"SolarCoin (SLR): criptomoneda solar","description":"SolarCoin es una criptomoneda que incentiva la transición ecológica emitiendo tokens a razón de 1 SLR por cada megavatio-hora (1 MWh) de energía solar fotovoltaica generada y verificada. Es una implementación contemporánea del concepto de Ford y Edison: la moneda se emite solo cuando se inyecta energía física real al sistema. Modelos alternativos basados en Proof of Behavior (PoB), como EcoMobiCoin, premian a los ciudadanos por el ahorro directo de megajulios en movilidad y consumo eficiente.","badge":"SolarCoin"},
      {"icon":"database","title":"Bases de datos científicas abiertas","description":"La contabilidad energética no es teoría: existen bases de datos públicas con miles de productos analizados. ICE Database (Universidad de Bath, Reino Unido) especializada en materiales de construcción. Agribalyse (ADEME/INRAE, Francia) con más de 2,500 alimentos analizados cradle-to-plate. Ecoinvent (Suiza) estándar global para análisis de ciclo de vida utilizado por software SimaPro y GaBi. Nuestro catálogo toma los promedios centrados de estas bases para fijar precios realistas y verificables.","badge":"Bases abiertas"},
      {"icon":"scale","title":"¿Por qué la energía y no el dinero?","description":"El dinero fiduciario se devalúa con la inflación, se especula en los mercados y se concentra en pocas manos. La energía, en cambio, es una magnitud física inmutable regida por las leyes de la termodinámica. 1 kWh de hoy es exactamente igual a 1 kWh de hace 100 años o de dentro de 100 años. No hay inflación energética. Al anclar el valor en kWh, eliminamos las distorsiones especulativas y las externalidades ocultas del mercado financiero. Los productos locales de baja huella resultan automáticamente más accesibles que los productos industriales importados.","badge":"Invarianza"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Metodologías Científicas de Cálculo",
    "subtitle": "Tres enfoques complementarios para medir el costo energético real de un producto",
    "columns": 3,
    "items": [
      {"icon":"calculator","title":"Energía Incorporada (Embodied Energy / GER)","description":"El Requerimiento Bruto de Energía (Gross Energy Requirement) o Análisis de Ciclo de Vida (LCA) cuantifica los insumos industriales directos e indirectos desde la extracción de materias primas hasta la puerta de fábrica (cradle-to-gate) o el consumidor final (cradle-to-consumer). Es la metodología más transparente y repetible. Nuestro catálogo utiliza principalmente este enfoque. Frontera: se define qué etapas se incluyen (producción, transporte, empaque, uso, disposición final).","badge":"GER / LCA"},
      {"icon":"sun","title":"Emergía (Emergy Synthesis)","description":"Desarrollada por Howard T. Odum, cuantifica la energía solar equivalente (seJ) necesaria para generar un producto, incluyendo el trabajo gratuito de la biosfera: radiación solar, fotosíntesis, ciclo hidrológico, viento y formación de suelos. A diferencia del GER, contabiliza servicios ecosistémicos no mercantiles. La transformidad (seJ/J) indica la jerarquía termodinámica: 1 MJ de electricidad de alta pureza vale más que 1 MJ de calor a baja temperatura.","badge":"Emergía"},
      {"icon":"grid","title":"Análisis Insumo-Producto (EEIOA)","description":"El Análisis de Insumo-Producto Extendido Ambientalmente utiliza matrices macroeconómicas intersectoriales para proyectar intensidades energéticas medias por rama de actividad. Permite calcular la energía incorporada de sectores completos de la economía nacional. Es útil para productos manufacturados complejos con cadenas de suministro globales, pero menos preciso para productos artesanales locales.","badge":"EEIOA"},
      {"icon":"trending-up","title":"Tasa de Retorno Energético (EROI)","description":"La Energy Return on Investment evalúa cuánta energía utilizable se obtiene de un proceso dividida entre la energía invertida en conseguirla. Un EROI neto > 1:1 significa que el sistema produce más energía de la que consume, garantizando superávit para actividades culturales, educativas y de mantenimiento. Un EROI < 1:1 indica que el proceso consume más energía de la que aporta: es insostenible. Nuestro catálogo refleja esta jerarquía.","badge":"EROI"},
      {"icon":"layers","title":"Fronteras del sistema (cradle-to-X)","description":"La energía incorporada varía según dónde se trace la frontera. Cradle-to-gate: de la extracción a la puerta de fábrica. Cradle-to-consumer: incluye transporte y distribución. Cradle-to-grave: incluye uso y disposición final. Para alimentos, la fase post-cosecha (transporte, empaque, refrigeración) puede absorber más del 70% de la energía total en sistemas industrializados. Por eso los productos locales de conuco tienen menor energía incorporada.","badge":"Fronteras"},
      {"icon":"alert-triangle","title":"Desafíos y limitaciones","description":"1 MJ de calor a baja temperatura no tiene la misma capacidad de trabajo que 1 MJ de electricidad de alta pureza. Las economías biofísicas avanzadas incorporan factores de ponderación basados en la transformidad de Odum (seJ/J) para ajustar la escala según la jerarquía termodinámica. Además, los valores varían según la matriz eléctrica de cada región (nuclear vs. fósil vs. renovable). Nuestros precios usan promedios centrados de múltiples bases para minimizar estas discrepancias.","badge":"Limitaciones"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Tabla de Equivalencias Energéticas de Referencia",
    "subtitle": "Valores promedio centrados de las bases de datos internacionales que utilizamos para fijar nuestros precios",
    "columns": 3,
    "items": [
      {"icon":"wheat","title":"Cereales y granos","description":"Trigo: 33.6 MJ/kg = 9.3 TQ/kg. Arroz: 39.5 MJ/kg = 11 TQ/kg. Maíz: 36.3 MJ/kg = 10 TQ/kg. Cebada: 31.8 MJ/kg = 8.8 TQ/kg. Avena: 31.5 MJ/kg = 8.8 TQ/kg. Legumbres: 35.9 MJ/kg = 10 TQ/kg. Frutos secos: 40.9 MJ/kg = 11.4 TQ/kg. Fuentes: Agribalyse, USDA, Pimentel, Ecoinvent.","badge":"Cereales"},
      {"icon":"beef","title":"Carnes y proteína animal","description":"Vacuno: ~40 MJ/kg = 11 TQ/kg (conversión 25 kg forraje/kg). Cerdo: ~20 MJ/kg = 6 TQ/kg (conversión 6.5 kg pienso/kg). Pollo: ~18 MJ/kg = 5 TQ/kg (conversión 2.0 kg pienso/kg). Huevos: ~15 MJ/kg = 3 TQ/docena (una docena pesa ~0.65 kg). La jerarquía energetica correcta es: vacuno > cerdo > pollo > huevos > leche. El pollo usa 45% mas energia que los huevos por kg (FAO 2013). Fuentes: FAO, Pimentel, Agribalyse, Leinonen et al.","badge":"Carnes"},
      {"icon":"milk","title":"Lácteos","description":"Leche fresca: 5-7 MJ/L = 1.5-1.7 TQ/L (forraje + ordeño + pasteurización). Queso: 25-36 MJ/kg = 7-10 TQ/kg (10 L de leche por kg de queso + fermentación + frío). Yogurt: ~20 MJ/kg = 5.5 TQ/kg. Mantequilla: ~25 MJ/kg = 7 TQ/kg. Fuentes: Ecoinvent, JRC Europa, USDA, Agribalyse.","badge":"Lácteos"},
      {"icon":"tool","title":"Materiales de construcción","description":"Adobe: 1.8-3.6 MJ/unidad = 0.5-1 TQ. Hormigón: 1.55 MJ/kg = 0.43 TQ/kg. Ladrillo de arcilla: 4.75 MJ/unidad = 1.3 TQ. Madera estructural: 8.5 MJ/kg = 2.4 TQ/kg. Vidrio: 15 MJ/kg = 4.2 TQ/kg. Acero reciclado: 20 MJ/kg = 5.6 TQ/kg. Acero virgen: 35 MJ/kg = 9.7 TQ/kg. Aluminio: 193 MJ/kg = 53.6 TQ/kg. Fuentes: ICE Database, Ecoinvent, WorldSteel.","badge":"Construcción"},
      {"icon":"smartphone","title":"Electrónica y electrodomésticos","description":"Smartphone: 1000 MJ = 278 TQ. Monitor LCD: 963 MJ = 268 TQ. PC sobremesa: 2085 MJ = 579 TQ. Lavadora: 3900 MJ = 1083 TQ. Laptop: 4500 MJ = 1250 TQ. Refrigerador: 5900 MJ = 1639 TQ. Panel solar 1m²: 4750 MJ = 1319 TQ. La mayor parte de la huella energética de un dispositivo electrónico se acumula en su fabricación, no en su uso. Fuentes: ICE Database, Marspedia, Ecoinvent.","badge":"Electrónica"},
      {"icon":"user","title":"Trabajo humano y combustibles","description":"Trabajo manual: 2.2 MJ/h = 0.61 TQ/h. Trabajo general: 3.6-5 MJ/h = 1-1.4 TQ/h. Trabajo técnico: 7.2-14.4 MJ/h = 2-4 TQ/h. Diesel: 41.7 MJ/L = 11.6 TQ/L. Gasolina: 47.1 MJ/kg = 13.1 TQ/kg. GLP: 50.1 MJ/kg = 13.9 TQ/kg. Biomasa seca: 15.3 MJ/kg = 4.25 TQ/kg. Carbón mineral: 22.4 MJ/kg = 6.2 TQ/kg. Fuentes: Ecoinvent, ResearchGate, Mantoam et al.","badge":"Trabajo"}
    ]
  },
  {
    "type": "calculator_preview",
    "title": "Simula el Valor Energético de tu Producción",
    "subtitle": "Prueba cómo se calcula el valor objetivo según horas de trabajo y factores de esfuerzo."
  }
]`,
			Icon:      "help-circle",
			MenuOrder: 5,
		},
		{
			Slug:     "campo-soberano",
			Title:    "Campo Soberano",
			Subtitle: "Comunidad Agroecológica Autónoma y Regenerativa",
			Content: `[
  {
    "type": "hero",
    "badge": "🏡 Proyecto de Ecoaldea de Ciclo Cerrado",
    "title": "Proyecto Campo Soberano",
    "subtitle": "Hábitat colectivo rural con soberanía alimentaria, energética, digital y financiera.",
    "description": "Estructuración de una comunidad intencional agroecológica diseñada bajo principios de permacultura, propiedad colectiva indivisible, energía solar/eólica off-grid y economía de crédito mutuo libre de acumulación.",
    "image_url": "/images/pages/habitat-rural.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Infraestructura de Ciclos Cerrados",
    "subtitle": "Cada desecho se transforma en un insumo biológico o energético.",
    "columns": 3,
    "items": [
      {
        "icon": "leaf",
        "title": "Biodigestores Continuos",
        "description": "Estiércol animal y restos orgánicos transformados en biogás metano para cocinas y biol fertilizante líquido.",
        "badge": "Biogás & Biol"
      },
      {
        "icon": "zap",
        "title": "Microrred Híbrida Aislada",
        "description": "Generación solar fotovoltaica con respaldo eólico e hidráulico para autonomía energética 100% desconectada.",
        "badge": "Energía Limpia"
      },
      {
        "icon": "heart",
        "title": "Diseño Keyline y Aguas",
        "description": "Zanjas de infiltración en curvas de nivel, reservorios de tierra y sanitarios secos con compostaje termófilo.",
        "badge": "Cosecha de Agua"
      },
      {
        "icon": "users",
        "title": "Soberanía Digital Mesh",
        "description": "Red inalámbrica comunitaria con servidores locales para mensajería Matrix, enciclopedias Kiwix y educación offline.",
        "badge": "Red Mesh"
      },
      {
        "icon": "scale",
        "title": "Gobernanza Sociocrática",
        "description": "Toma de decisiones por círculos temáticos y consentimiento fundamentado, con fideicomiso de tierra comunitaria.",
        "badge": "Sociocracia 3.0"
      },
      {
        "icon": "shopping-cart",
        "title": "Zonificación Permacultural",
        "description": "Organización de zonas 0 a 5: núcleo habitacional bioclimático, huerto intensivo, animales menores, granos y reserva silvestre.",
        "badge": "Permacultura"
      }
    ]
  }
]`,
			Icon:      "leaf",
			MenuOrder: 6,
		},
		{
			Slug:     "faq",
			Title:    "Preguntas Frecuentes",
			Subtitle: "Dudas sobre Compras en Moneda Local, Trueque y Asambleas",
			Content: `[
  {
    "type": "hero",
    "badge": "💡 Centro de Respuestas",
    "title": "Preguntas Frecuentes",
    "subtitle": "Información clara sobre cómo comprar, participar, truequear y sumarte a la feria.",
    "image_url": "/placeholder.svg",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Para Visitantes y Compradores",
    "items": [
      {
        "question": "¿Necesito ser miembro de la feria para comprar productos?",
        "answer": "¡No! Nuestro evento mensual es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local."
      },
      {
        "question": "¿Cuándo y en qué horario se realiza el mercado mensual?",
        "answer": "Se realiza el primer sábado de cada mes en el Parque Los Caobos de Caracas (área sur, cerca del estacionamiento y la Fuente Venezuela), desde las 9:00 AM hasta la 1:00 PM aproximadamente."
      },
      {
        "question": "¿Cómo llegar en transporte público?",
        "answer": "Puedes llegar cómodamente en Metro de Caracas bajándote en la estación Bellas Artes o Colegio de Ingenieros (Línea 1). Desde ambas estaciones caminas unos 5 minutos hacia el Parque Los Caobos."
      },
      {
        "question": "¿Por qué está prohibido el uso de bolsas plásticas desechables?",
        "answer": "Porque la agroecología es un compromiso ético de cuidado hacia la Madre Tierra. El plástico contamina suelos y ríos. Te invitamos a traer bolsas reutilizables de tela, morrales, recipientes o canastas."
      },
      {
        "question": "¿Qué actividades culturales y formativas se realizan durante la feria?",
        "answer": "En cada jornada mensual se ofrecen talleres gratuitos de siembra y lombricultura, trueque libre de semillas criollas, intercambio de libros (\"Dona y adopta un libro\"), música popular en vivo y actividades lúdicas para niños y familias."
      },
      {
        "question": "¿Puedo pagar con tarjeta de débito o crédito?",
        "answer": "El comercio exterior (ventas al público general) se realiza en moneda local del país (pesos, bolívares, soles, etc.). Algunos puestos pueden aceptar transferencias o pagos digitales, pero le recomendamos traer efectivo. El trueque interno entre miembros funciona con la moneda TQ, pero eso es solo para miembros registrados."
      },
      {
        "question": "¿Puedo llevar mis propios productos para vender?",
        "answer": "Para vender necesitas ser miembro registrado. Si eres productor agroecológico, artesano o tienes un emprendimiento compatible con los valores de la feria, puedes solicitar admisión. La asamblea evaluará tu solicitud y, si eres aceptado, recibirás un puesto y acceso al sistema de trueque."
      },
      {
        "question": "¿La feria es solo para productores agroecológicos?",
        "answer": "No necesariamente. Aunque la agroecología es nuestro corazón, también hay lugar para artesanos, productores de alimentos procesados (panes, quesos, conservas), herbolaria, productos de higiene natural, y servicios comunitarios. Lo importante es que lo que ofrezcas sea coherente con los valores de cuidado de la tierra y el trueque."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Trueque y la Moneda TQ",
    "items": [
      {
        "question": "¿Qué es la moneda TQ?",
        "answer": "TQ es la unidad de medida del trueque interno entre miembros. No es dinero físico ni se puede comprar ni vender por dinero. Es una unidad contable que mide cuánto aportas y cuánto recibes dentro de la comunidad. 1 TQ equivale a 1 kWh de energía, es decir, a una hora de trabajo humano. No tiene inflación porque no está atada al dólar ni al oro, sino a las leyes de la física."
      },
      {
        "question": "¿Por qué el saldo perfecto es cero?",
        "answer": "El objetivo de todo miembro es que su saldo sea cero. Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si tu saldo está muy negativo, significa que estás recibiendo mucho pero aportando poco: tienes que aportar más para llegar a cero. Si tu saldo está muy positivo, significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece: tienes que recibir más para llegar a cero. El saldo cero es la meta de todos."
      },
      {
        "question": "¿Es preferible tener saldo positivo o negativo?",
        "answer": "Técnicamente, si tu saldo está en positivo es porque alguien más está en negativo. Lo ideal es que todos tiendan a cero. Pero si vas a estar en un lado, es preferible estar ligeramente en positivo (aportando un poco más de lo que recibes) que en negativo (recibiendo más de lo que aportas). Un saldo muy negativo sostenido significa que la comunidad te está sosteniendo, y eso no es sostenible a largo plazo."
      },
      {
        "question": "¿Qué pasa si mi saldo se va muy negativo?",
        "answer": "Si tu saldo baja demasiado, el sistema te avisa. Tienes que aportar más (vender productos, ofrecer trabajo, dar talleres) para subir tu saldo. Si no logras subirlo, la asamblea puede revisar tu caso. La idea no es castigar, sino ayudarte a encontrar equilibrio. Pero si una persona solo recibe y nunca aporta, la asamblea puede decidir que ya no puede seguir en el sistema."
      },
      {
        "question": "¿Por qué para entrar a la comunidad tengo que tener algo que aportar?",
        "answer": "Porque el trueque funciona así: tú aportas algo que la comunidad necesita, y la comunidad te aporta algo que tú necesitas. Si entras sin nada que aportar, solo estarías recibiendo de los demás sin devolver nada. Eso desequilibra el sistema y no es justo para los demás miembros. Muchas monedas comunitarias fracasan precisamente porque entra mucha gente que solo quiere recibir y poca gente que aporta. Por eso, antes de entrar, tienes que preguntarte: ¿Qué tengo yo que la comunidad pueda necesitar? ¿Qué tiene la comunidad que yo pueda necesecer? Si ambas respuestas son positivas, vale la pena que te integres."
      },
      {
        "question": "¿Qué cosas puedo aportar?",
        "answer": "Puedes aportar productos (frutas, verduras, huevos, panes, artesanías, conservas, medicina natural), servicios (reparaciones, transporte, clases, cuidado de niños, peluquería), trabajo (ayuda en conucos, construcción, limpieza, organización de eventos), o conocimientos (talleres, asesorías, mentorías). Todo lo que la comunidad valore puede ser un aporte. No tiene que ser solo cosas materiales: el tiempo y el talento también cuentan."
      },
      {
        "question": "¿Cómo sé si vale la pena integrarme a la comunidad?",
        "answer": "Hazte estas preguntas antes de solicitar admisión: 1) ¿Tengo algo que aportar que la comunidad pueda necesitar? (productos, trabajo, talentos, servicios). 2) ¿Tiene la comunidad algo que yo necesite o me interese? (alimentos, trabajo, servicios, conexión con otras personas). 3) ¿Estoy dispuesto a participar activamente, no solo a recibir? Si las tres respuestas son sí, entonces vale la pena que te integres. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar."
      },
      {
        "question": "¿La moneda TQ tiene inflación?",
        "answer": "No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años. Esto significa que lo que ahorras en TQ mantiene su valor real con el tiempo, a diferencia del dinero en el banco que pierde valor cada mes por la inflación."
      },
      {
        "question": "¿Puedo acumular TQ para hacerme \"rico\"?",
        "answer": "El sistema no está diseñado para que nadie se haga rico acumulando números. El objetivo es el equilibrio: aportar y recibir en proporción similar. Acumular mucho TQ significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece. En lugar de acumular TQ, te invitamos a acumular riqueza real y tangible: tu vivienda, tu conuco, tus herramientas, tus semillas, tus relaciones comunitarias. Eso sí es riqueza de verdad."
      },
      {
        "question": "¿Qué son los límites de crédito?",
        "answer": "Los límites de crédito son como escalones de confianza. Un miembro nuevo inicia con un límite bajo, equivalente a su canasta básica familiar, para proteger a la comunidad. A medida que participas, aportas y demuestras compromiso, la asamblea puede subir tu límite. No es un castigo ni una restricción: es una medida de protección para que nadie entre, reciba mucho y se vaya sin aportar."
      },
      {
        "question": "¿Las ventas al público se mezclan con el trueque?",
        "answer": "¡No! Las ventas al público general son externas y se pagan en moneda local del país (pesos, bolívares, etc.). El trueque TQ es solo entre miembros registrados. Los compradores externos no tienen cuentas TQ ni participan del trueque. Esto es muy importante: no podemos mezclar las ventas al público con el trueque, porque son cosas distintas con reglas distintas."
      },
      {
        "question": "¿Qué pasa si quiero salir de la comunidad?",
        "answer": "Puedes salir cuando quieras. Lo ideal es que antes de salir, tu saldo esté en cero o cercano a cero. Si tu saldo está muy negativo (recibiste más de lo que aportaste), la asamblea puede pedirte que aportes algo antes de irte para equilibrar tu cuenta. Si tu saldo está positivo, simplemente pierdes ese saldo al salir, ya que el TQ no tiene valor fuera de la comunidad."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Para Quienes Quieren Unirse",
    "items": [
      {
        "question": "¿Quiénes pueden solicitar admisión?",
        "answer": "Cualquier persona, familia, cooperativa o colectivo que tenga algo que aportar a la comunidad y que esté dispuesto a participar activamente. Esto incluye productores agroecológicos, artesanos, personas con oficios (carpintería, costura, reparaciones), profesionales que quieran ofrecer servicios, y personas dispuestas a aportar su trabajo y talento."
      },
      {
        "question": "¿Cómo sé si soy apto para integrarme?",
        "answer": "La métrica inicial es simple: ¿Tienes algo que aportar que la comunidad necesite? ¿Tiene la comunidad algo que tú necesites? Si ambas respuestas son positivas, eres un buen candidato. Si solo quieres recibir pero no tienes nada que aportar, el sistema no te va a funcionar. El trueque requiere que ambos lados ganen: tú aportas algo y recibes algo a cambio."
      },
      {
        "question": "¿Qué evalúa la asamblea antes de aceptar a alguien?",
        "answer": "La asamblea evalúa: 1) ¿Qué aporta esta persona a la comunidad? (productos, trabajo, talentos, servicios). 2) ¿Hay interés en la comunidad por lo que esta persona aporta? 3) ¿Hay cosas en la comunidad que esta persona pueda necesecer o recibir? 4) ¿Esta persona entiende y comparte los valores del trueque y la agroecología? 5) ¿Está dispuesta a participar activamente en asambleas y actividades?"
      },
      {
        "question": "¿Necesito tener tierra o un conuco para entrar?",
        "answer": "No necesariamente. Hay miembros que son productores con tierra, pero también hay artesanos, panaderos, herbolarios, personas que ofrecen servicios, y personas que aportan su trabajo en los conucos de otros. Lo importante no es qué tienes, sino qué puedes aportar con lo que tienes."
      },
      {
        "question": "¿Puedo entrar si solo quiero consumir productos sanos?",
        "answer": "Si solo quieres consumir, puedes venir a la feria como visitante y comprar en moneda local. Para ser miembro del trueque interno, necesitas aportar algo. No puedes solo recibir. Si quieres ser miembro pero no tienes productos, puedes aportar trabajo: ayudar en la organización, en los conucos, en la logística, dar talleres, etc."
      },
      {
        "question": "¿Cuánto tiempo toma el proceso de admisión?",
        "answer": "Depende de cada comunidad. Generalmente: llenas la solicitud, la asamblea la revisa en su próxima reunión, te invitan a una entrevista o visita, y luego votan. Puede tomar de unas semanas a un mes. Mientras esperas, puedes participar en las ferias como visitante y conocer a los miembros."
      },
      {
        "question": "¿Qué compromisos asumo al ser miembro?",
        "answer": "Al ser miembro te comprometes a: 1) Aportar algo a la comunidad de forma regular. 2) Mantener tu saldo TQ cercano a cero. 3) Participar en las asambleas (presenciales o digitales). 4) Respetar los valores de agroecología, trueque y cuidado de la tierra. 5) Ser honesto en tus intercambios. 6) No acumular saldo negativo sin plan para recuperarlo."
      },
      {
        "question": "¿Puedo entrar siendo parte de otra comunidad o red?",
        "answer": "Sí, siempre y cuando no haya conflicto de intereses. Muchos miembros participan en varias redes. La idea es sumar, no excluir. Si ya eres parte de otra comunidad de trueque, nos encantará conocer tu experiencia y aprender de ella."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Organización y las Asambleas",
    "items": [
      {
        "question": "¿Cómo se organiza la feria más allá del día de mercado?",
        "answer": "La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos."
      },
      {
        "question": "¿Qué es una asamblea y por qué es importante?",
        "answer": "La asamblea es el espacio donde todos los miembros toman decisiones juntos. No hay un jefe ni un dueño: las decisiones se toman colectivamente, por consenso o por votación. La asamblea decide quién entra, quién sale, cómo se reparten los recursos, qué reglas se cambian, y cómo se resuelven los conflictos. Si no participas en la asamblea, no tienes voz en las decisiones que afectan a la comunidad."
      },
      {
        "question": "¿Tengo que asistir a todas las asambleas?",
        "answer": "Se espera que los miembros participen en las asambleas, pero entendemos que a veces no es posible asistir físicamente. Por eso existe la asamblea digital: puedes participar y votar desde tu teléfono o computadora. Lo importante es que tu voz se escuche, aunque no puedas estar presente."
      },
      {
        "question": "¿Cómo se toman las decisiones en la asamblea?",
        "answer": "Por defecto, las decisiones se toman por consenso: se busca que todos estén de acuerdo. Si no hay consenso, se vota. El umbral de aprobación por defecto es del 100%, lo que significa que una decisión se aprueba solo si nadie se opone. Esto asegura que las decisiones sean verdaderamente colectivas y que nadie quede marginado."
      },
      {
        "question": "¿Qué pasa si no estoy de acuerdo con una decisión?",
        "answer": "Puedes expresar tu desacuerdo en la asamblea. Tu voz cuenta. Si una decisión se aprueba y tú no estás de acuerdo, puedes proponer revisarla en la próxima asamblea. La comunidad escucha a sus miembros. Si un miembro sistemáticamente no está de acuerdo con nada, puede ser que esta comunidad no sea el lugar adecuado para esa persona."
      },
      {
        "question": "¿Quién puede proponer cambios?",
        "answer": "Cualquier miembro puede proponer cambios: nuevos productos, nuevas reglas, nuevos miembros, nuevas actividades. La propuesta se presenta en la asamblea y se discute colectivamente. No hay jerarquías: la palabra de un miembro nuevo vale igual que la de un miembro antiguo."
      },
      {
        "question": "¿Qué son las comisiones?",
        "answer": "Las comisiones son grupos de miembros que se encargan de áreas específicas: logística, comunicación, bioinsumos, cultura, educación, etc. Cada comisión tiene cierta autonomía para tomar decisiones dentro de su área, pero siempre rinde cuentas a la asamblea general. Cualquier miembro puede unirse a una comisión."
      },
      {
        "question": "¿Qué es una cayapa?",
        "answer": "Una cayapa es un trabajo colectivo donde varios miembros se juntan para ayudar a uno de ellos con una tarea grande: preparar un terreno, construir una casa, cosechar, etc. Es una forma de mutualidad: hoy te ayudamos tú, mañana ayudamos a otro. Las cayapas son el corazón del trueque de trabajo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Federación y Otras Comunidades",
    "items": [
      {
        "question": "¿Qué significa que esta comunidad sea parte de una federación?",
        "answer": "Significa que nuestra comunidad no está sola. Somos parte de una red de comunidades que comparten los mismos principios de trueque, agroecología y gobernanza asamblearia. Cada comunidad es autónoma y toma sus propias decisiones internas, pero todas usamos el mismo sistema de trueque, la misma moneda TQ, y los mismos protocolos de comunicación. Esto nos permite comerciar entre comunidades cuando es beneficioso para todos."
      },
      {
        "question": "¿Puedo usar mi saldo TQ en otra comunidad federada?",
        "answer": "Sí, gracias a la piscina global multilateral real. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos, lo que limitaba el intercambio. Ahora existe una piscina global compartida: el saldo que ganas en el nodo B es gastable en el nodo C. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir mediante la piscina global multilateral."
      },
      {
        "question": "¿Qué pasa mientras hay pocas comunidades federadas?",
        "answer": "Al principio, con pocas comunidades, el espectro de lo que puedes aportar y recibir es más limitado. Por eso es crucial que cada comunidad que se federé garantice que sus miembros tienen algo real que aportar. A medida que más comunidades se federen, el espectro se amplía: más productos, más servicios, más lugares donde aportar trabajo, más cosas que recibir. La federación se hace más sólida cuantas más comunidades participen."
      },
      {
        "question": "¿Mi comunidad tiene que usar el mismo software?",
        "answer": "Sí, todas las comunidades federadas usan el mismo software base, porque es la única forma de garantizar que los intercambios funcionen correctamente entre comunidades. Pero cada comunidad puede personalizar los colores, textos, idioma, y reglas internas de su plataforma. La base técnica es compartida, pero la identidad de cada comunidad es propia."
      },
      {
        "question": "¿Una comunidad nueva puede crear su propio software?",
        "answer": "El software es de código abierto, lo que significa que cualquiera puede verlo, modificarlo y adaptarlo. Pero para federarse, tiene que usar el mismo protocolo de comunicación. Si alguien quiere desarrollar una versión distinta del software, puede hacerlo, siempre y cuando sea 100% compatible con el protocolo federado. La idea es que todas las comunidades puedan comunicarse e intercambiar sin problemas."
      },
      {
        "question": "¿Quién gobierna la federación?",
        "answer": "La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación (como la canasta básica TQ, el límite de crédito global, o la expulsión de un nodo problemático) se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Piscinas de la Federación (Global vs. Bilateral)",
    "items": [
      {
        "question": "¿Qué es la piscina global multilateral real?",
        "answer": "Es una piscina de saldo compartida por todos los nodos federados. El saldo que ganas intercambiando con el nodo B es gastable con el nodo C. Por ejemplo: si un productor del nodo B vende productos a un usuario del nodo A, el saldo positivo que genera el productor del nodo B puede usarse para comprar productos del nodo C. Esto permite un trueque multilateral real entre todas las comunidades federadas, no solo de par en par."
      },
      {
        "question": "¿Qué son las piscinas bilaterales?",
        "answer": "Cada par de nodos mantiene un saldo bilateral independiente que refleja el intercambio directo entre esos dos nodos. El saldo bilateral con el nodo B es separado del saldo bilateral con el nodo C. Estas piscinas bilaterales coexisten con la piscina global y permiten llevar un registro detallado del intercambio entre cada par de comunidades."
      },
      {
        "question": "¿Antes no existía ya una piscina global?",
        "answer": "No. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos. Es decir, solo se podía intercambiar con un nodo si el saldo bilateral con ese nodo específico estaba dentro del límite. No existía una piscina global real que permitiera gastar en el nodo C el saldo ganado en el nodo B. Ahora la piscina global multilateral real hace posible el trueque multilateral completo entre todos los nodos federados."
      },
      {
        "question": "¿Cómo se relacionan la piscina global y las bilaterales?",
        "answer": "Son independientes. La piscina global permite el multilateralismo: lo que ganas en un nodo lo puedes gastar en cualquier otro. Las piscinas bilaterales llevan el registro del intercambio directo entre cada par de nodos. Ambas coexisten: la piscina global amplía las posibilidades de intercambio, mientras que las bilaterales mantienen la trazabilidad entre pares específicos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre los Niveles de Nodo Federado",
    "items": [
      {
        "question": "¿Cuáles son los niveles de nodo federado?",
        "answer": "Existen tres niveles: Nivel 1 (Nodo Nuevo) con un límite de 1.000 TQ, sin derecho a voto y sin capacidad de patrocinar nuevos nodos. Nivel 2 (Nodo Aceptado) con un límite de 5.000 TQ, derecho a voto en la federación y capacidad de patrocinar nuevos nodos. Nivel 3 (Nodo Pleno) con un límite de 20.000 TQ, derecho a voto y capacidad de patrocinio, con acceso completo a la piscina global multilateral."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 1 a Nivel 2?",
        "answer": "La promoción a Nivel 2 (Nodo Aceptado) requiere una votación de toda la federación. El nodo debe haber permanecido un mínimo de 90 días como Nodo Nuevo antes de poder ser propuesto para promoción. La votación la realizan todos los nodos que ya tienen derecho a voto (Nivel 2 y Nivel 3). Si la federación aprueba la promoción, el nodo pasa a tener límite de 5.000 TQ, derecho a voto y capacidad de patrocinar."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 2 a Nivel 3?",
        "answer": "La promoción a Nivel 3 (Nodo Pleno) es automática. Se alcanza cuando el nodo cumple los requisitos de reciprocidad y el límite promedio de la federación. No requiere votación: el sistema detecta que el nodo ha mantenido relaciones de intercambio recíprocas con otros nodos y que su actividad justifica un límite mayor de 20.000 TQ."
      },
      {
        "question": "¿Por qué los nodos nuevos no tienen derecho a voto?",
        "answer": "Porque la confianza se construye con el tiempo. Un nodo nuevo (Nivel 1) aún no ha demostrado su compromiso con la federación ni ha establecido relaciones de reciprocidad con los demás nodos. Sin derecho a voto, el nodo puede participar en los intercambios pero no influye en las decisiones colectivas hasta que la federación lo apruebe como Nodo Aceptado (Nivel 2) tras un mínimo de 90 días."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Sistema de Padrino (Patrocinador)",
    "items": [
      {
        "question": "¿Qué es el sistema de padrino?",
        "answer": "Cuando un nodo de Nivel 2 (Aceptado) o Nivel 3 (Pleno) patrocina a un nodo nuevo que ingresa a la federación, se convierte en su \"padrino\". El padrino asume responsabilidad solidaria sobre el nodo patrocinado: si el nodo nuevo incumple (default), la deuda se transfiere al padrino. A cambio, el nodo nuevo obtiene acceso a la federación con el respaldo de un nodo establecido."
      },
      {
        "question": "¿Quién puede ser padrino de un nodo nuevo?",
        "answer": "Solo los nodos de Nivel 2 (Nodo Aceptado) o Nivel 3 (Nodo Pleno) pueden ser padrinos. Los nodos de Nivel 1 (Nodo Nuevo) no tienen capacidad de patrocinar. Esto asegura que solo los nodos que ya han demostrado compromiso y han sido aprobados por la federación puedan respaldar a nuevos nodos."
      },
      {
        "question": "¿Qué pasa con el límite del padrino al patrocinar?",
        "answer": "Al patrocinar un nodo nuevo, el límite del padrino se reduce en el monto del límite del nodo patrocinado (1.000 TQ). Por ejemplo, si un nodo de Nivel 2 tiene un límite de 5.000 TQ y patrocina un nodo nuevo, su límite efectivo pasa a 4.000 TQ. El límite se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado)."
      },
      {
        "question": "¿Qué pasa si el nodo patrocinado incumple?",
        "answer": "Si el nodo patrocinado no cumple con sus compromisos (default), la deuda se transfiere al padrino. Esto significa que el padrino debe cubrir el saldo negativo del nodo patrocinado. Por eso es importante que el padrino solo patrocine nodos en los que confía y que conoce bien. El sistema de padrino fomenta relaciones de confianza real entre nodos."
      },
      {
        "question": "¿Cuándo se libera el límite retenido del padrino?",
        "answer": "El límite retenido se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado). Esto significa que el nodo patrocinado ha sido aprobado por votación de toda la federación tras un mínimo de 90 días, demostrando que es confiable. Al liberarse el límite, el padrino recupera su capacidad de crédito completa y puede patrocinar a otros nodos nuevos si lo desea."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Verificación de 4 Opciones",
    "items": [
      {
        "question": "¿Qué es la verificación de 4 opciones?",
        "answer": "Es un sistema de seguridad que se utiliza tanto en el emparejamiento de terminales POS como en la incorporación de nuevos nodos a la federación. Cuando un dispositivo o nodo solicita emparejamiento, el confirmador (administrador del nodo receptor) ve 4 opciones de código en pantalla. Solo una de las 4 opciones es el código correcto. El confirmador debe seleccionar el código correcto entre las 4 opciones."
      },
      {
        "question": "¿Por qué se usan 4 opciones en lugar de ingresar el código directamente?",
        "answer": "Porque previene ataques de intermediario. Si un atacante intercepta la comunicación, no puede forzar la aprobación sin conocer visualmente cuál de las 4 opciones es la correcta. El código correcto solo lo muestra el dispositivo solicitante en su pantalla física. El confirmador debe verlo y seleccionar la opción coincidente, lo que requiere acceso visual al dispositivo."
      },
      {
        "question": "¿Qué pasa si selecciono el código equivocado?",
        "answer": "Si el confirmador selecciona el código equivocado, el emparejamiento se rechaza automáticamente. El dispositivo solicitante deberá iniciar un nuevo proceso de emparejamiento con un código nuevo. Esto es una medida de seguridad: es preferible rechazar un emparejamiento válido antes que aprobar uno fraudulento."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Integridad Distribuida",
    "items": [
      {
        "question": "¿Qué es la integridad distribuida en las transacciones federadas?",
        "answer": "Es un sistema de seguridad que protege las transacciones entre nodos federados mediante doble firma criptográfica y hashes encadenados. Cada transacción entre nodos requiere la firma de ambos (emisor y receptor), y cada transacción incluye el hash de la anterior, creando una cadena inmutable."
      },
      {
        "question": "¿Qué es la doble firma?",
        "answer": "Cada transacción entre nodos federados requiere la firma criptográfica de ambos nodos: el emisor y el receptor. Ningún nodo puede falsificar una transacción en nombre del otro. Ambas partes deben confirmar criptográficamente la transacción para que sea válida. Esto garantiza que todas las transacciones federadas son consentidas por ambos nodos."
      },
      {
        "question": "¿Qué son los hashes encadenados?",
        "answer": "Cada transacción entre nodos incluye el hash (una huella digital criptográfica) de la transacción anterior. Esto crea una cadena donde cualquier modificación de una transacción pasada invalida todas las posteriores. Permite verificar la integridad completa del historial de intercambios entre dos nodos: si alguien intenta alterar una transacción, la cadena se rompe y la alteración es detectable inmediatamente."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Tarjetas NFC y el POS",
    "items": [
      {
        "question": "¿Qué es la tarjeta NFC y cómo funciona?",
        "answer": "La tarjeta NFC es como una tarjeta de identidad del trueque. La acercas al terminal POS y este reconoce quién eres. Cada tarjeta tiene un chip que la hace única e inimitable. Con ella puedes recibir pagos por tus productos, pagar por lo que recibes, y consultar tu saldo. Es más segura que una contraseña porque usa criptografía de nivel bancario."
      },
      {
        "question": "¿Qué pasa si pierdo mi tarjeta?",
        "answer": "Puedes bloquearla tú mismo inmediatamente desde tu perfil en la web (Mi Perfil → Mis Tarjetas NFC → Desactivar). Nadie podrá usar la tarjeta bloqueada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física. Para obtener una tarjeta nueva, sí necesitas comunicarte con el administrador, quien verificará tu identidad y emitirá una nueva tarjeta."
      },
      {
        "question": "¿Necesito tener la tarjeta para participar?",
        "answer": "La tarjeta NFC es la forma más fácil y segura de participar en los intercambios. Si no tienes tarjeta, también puedes usar códigos QR desde tu teléfono. La comunidad te puede ayudar a conseguir una tarjeta si eres miembro."
      },
      {
        "question": "¿El terminal POS funciona sin internet?",
        "answer": "El terminal POS requiere conexión al servidor del nodo (por intranet o internet). Sin conexión no puede procesar pagos porque necesita validar el saldo del usuario y registrar la transacción en la base de datos. Solo el cierre de turno puede hacerse sin conexión y sincronizarse después. Para ferias en lugares sin señal, existe el modo Nodo Satélite (consultá la documentación)."
      },
      {
        "question": "¿Puedo ver mi saldo desde mi teléfono?",
        "answer": "Sí. Entra desde el navegador de tu teléfono a la dirección del nodo (pregúntasela al administrador). Puedes ver tu saldo, historial de transacciones, participar en asambleas digitales y gestionar tu tarjeta NFC. No necesitas instalar nada — es una aplicación web. Si en el futuro existe una app móvil nativa, el administrador te informará cómo acceder."
      },
      {
        "question": "¿Qué pasa si me paso de mi límite de crédito?",
        "answer": "Si tu saldo queda por debajo de tu límite de crédito (por ejemplo, por compras offline concurrentes en un nodo satélite que se sincronizaron después), tu cuenta se marca como \"sobre límite\". No podrás hacer nuevas compras hasta que recibas suficientes TQ (vendiendo o recibiendo transferencias) para volver a estar dentro de tu límite. Eres responsable de no exceder tu límite. Si te excedes, regulariza lo antes posible. La asamblea puede penalizar a miembros que excedan su límite repetidamente."
      },
      {
        "question": "¿Qué es el emparejamiento del terminal?",
        "answer": "Cuando un terminal POS nuevo llega a la comunidad, necesita ser \"emparejado\" con el servidor. El administrador genera un código de 6 dígitos que el terminal usa para registrarse. Una vez emparejado, el terminal sabe quién es y puede operar. Si el terminal se pierde o se daña, el administrador puede desactivarlo desde el panel y emparejar uno nuevo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Preguntas que Debes Hacerte Antes de Entrar",
    "items": [
      {
        "question": "¿Tengo algo que aportar?",
        "answer": "Esta es la pregunta más importante. El trueque funciona porque todos aportan y todos reciben. Si no tienes nada que aportar, el sistema no te va a funcionar. Aportar puede ser: productos de tu conuco o huerta, artesanías, alimentos procesados, servicios (reparaciones, clases, transporte), trabajo (ayuda en conucos, construcción, organización), o conocimientos (talleres, asesorías). Todo cuenta. Lo importante es que la comunidad valore lo que tú aportas."
      },
      {
        "question": "¿Hay algo en la comunidad que yo necesite o me interese?",
        "answer": "La otra cara del trueque: ¿qué tiene la comunidad que tú puedes recibir? Alimentos, trabajo, servicios, productos artesanales, conexión con personas afines, talleres, participación en eventos. Si nada de lo que la comunidad ofrece te interesa, no tiene sentido que te integres. El trueque es bidireccional: tú aportas y recibes."
      },
      {
        "question": "¿Estoy dispuesto a participar activamente?",
        "answer": "Ser miembro no es solo tener una cuenta. Es participar: asistir a asambleas, aportar de forma regular, ayudar en cayapas, respetar los valores de la comunidad. Si solo quieres tener una cuenta para recibir y nunca participar, el sistema no es para ti. La comunidad se sostiene con la participación de todos."
      },
      {
        "question": "¿Comparto los valores de la agroecología y el trueque?",
        "answer": "Nuestra comunidad se basa en el cuidado de la tierra, la agroecología, el trueque, y la mutualidad. Si no compartes estos valores, probablemente no te sentirás cómodo aquí. No es un requisito ser productor agroecológico, pero sí respetar y apoyar estos principios."
      },
      {
        "question": "¿Estoy dispuesto a que mi saldo sea cero?",
        "answer": "El objetivo del trueque no es acumular, sino equilibrar. Si tu meta es acumular mucho TQ para ser \"rico\", este sistema no es para ti. La meta es que tu saldo esté en cero: aportar lo que recibes. Si entiendes y aceptas esto, vas a disfrutar el trueque. Si no, vas a frustrarte."
      },
      {
        "question": "¿Qué hago si mis respuestas son positivas?",
        "answer": "¡Excelente! Si tienes algo que aportar, hay algo que te interesa recibir, y estás dispuesto a participar, puedes solicitar admisión. Llena la solicitud, asiste a una feria como visitante, conoce a los miembros, y presenta tu propuesta en la asamblea. Te recibiremos con los brazos abiertos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Gobernanza del Sistema",
    "items": [
      {
        "question": "¿Cómo funciona exactamente la gobernanza que propone el software?",
        "answer": "La gobernanza se basa en una Asamblea Digital con votos formales. El software no impone una ideología única; su rol es automatizar y hacer cumplir las normas locales (la \"Ley de la Aldea\") que cada comunidad decide establecer en su propio servidor descentralizado. Cada nodo es autónomo y define sus propias reglas de convivencia."
      },
      {
        "question": "¿Cómo se toman las decisiones? ¿Por consenso, votación, delegación? ¿Qué ocurre cuando hay desacuerdos?",
        "answer": "Las decisiones se toman por votación digital donde cada miembro tiene un voto que se firma con criptografía Ed25519 (un sistema de firmas digitales que hace que cada voto sea inalterable y verificable). Cada comunidad configura sus propios porcentajes de aprobación: mayoría simple (51%) para lo cotidiano, consenso alto (90%) para decisiones críticas como admitir nuevos miembros. Para evitar la parálisis, la Asamblea delega tareas administrativas en una Junta Directiva. Si una propuesta no alcanza el porcentaje requerido, el sistema bloquea su aplicación automáticamente. Ante desacuerdos insalvables, cualquier miembro puede retirarse y unirse a otro nodo de la red."
      },
      {
        "question": "¿Qué sucede cuando alguien incumple las reglas?",
        "answer": "Las normas se registran clasificadas por severidad (leves, graves, muy graves) con sus sanciones correspondientes. Ante infracciones graves, la Asamblea General puede votar digitalmente la suspensión temporal o expulsión del miembro, requiriendo 75% de aprobación para la expulsión. El sistema garantiza que las sanciones se apliquen de forma transparente y registrada."
      },
      {
        "question": "¿Cómo evita que una persona o pequeño grupo concentre demasiado poder?",
        "answer": "Tres mecanismos lo evitan: 1) Ningún administrador puede cambiar reglas unilateralmente; todo pasa por la asamblea y queda registrado públicamente. 2) Topes de saldo simétricos: el sistema bloquea automáticamente la cuenta de quien alcanza su techo positivo (igual al límite negativo), impidiendo el acaparamiento y obligando a gastar o reinvertir en la comunidad. 3) Multi-firma: las transacciones grandes requieren la firma conjunta de múltiples signatarios autorizados, neutralizando que un solo individuo controle los activos colectivos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Aplicación Práctica y el Estado del Proyecto",
    "items": [
      {
        "question": "Háblanos más acerca de este software... ¿Qué aplicación concreta tiene en el día a día... para que las comunidades lo quieran instalar?",
        "answer": "Funciona como un sistema operativo de soberanía económica y de convivencia. En el día a día: intercambiar productos en la feria sin dinero convencional (mediante tarjetas NFC y un punto de venta de bajo costo); organizar y recompensar el trabajo comunitario (1 TQ por hora de trabajo base, con multiplicadores según intensidad); desplegar servicios locales con un clic (Matrix para mensajería cifrada que reemplaza WhatsApp, Nextcloud para archivos, Asterisk para llamadas gratuitas); llevar la asamblea en el bolsillo (votar propuestas desde el móvil); y para comunidades religiosas, el \"Sabbath Lock\" congela automáticamente todas las transacciones durante el sábado."
      },
      {
        "question": "¿Qué problemas concretos soluciona?",
        "answer": "1) Parálisis económica por escasez de dinero o inflación: el trueque TQ permite comerciar sin capital previo, anclado a 1 kWh de energía. 2) Burnout y parasitismo: los límites simétricos de saldo obligan a la circularidad. 3) Falta de internet en zonas rurales: funciona 100% off-grid con servidor local. 4) Estancamiento del trueque tradicional: el crédito mutuo diferido permite intercambios multilaterales. 5) Filtración de datos: todo se almacena local y encriptado. 6) Aislamiento entre ecoaldeas: la federación mediante conexiones seguras (mTLS, un sistema de encriptación mutua entre servidores) permite comerciar entre comunidades distantes."
      },
      {
        "question": "¿Hay ecoaldeas que ya lo estén usando?",
        "answer": "Al 30 de agosto de 2026, ninguna ecoaldea está usando el sistema en producción. El proyecto nació hace apenas un mes desde la Feria Conuquera Agroecológica de Caracas, donde los productores tenemos parcelas aisladas y nos reunimos los primeros sábados de cada mes. El sistema está en desarrollo activo y se buscan personas que quieran sumarse a co-crear: ideas, programación, todos los aportes son válidos. El software es de código abierto y 100% adaptable a cada comunidad. Si quieres verlo en acción, podemos organizar una videollamada para mostrar el panel de administración, la app de Android y las tarjetas NFC funcionando."
      }
    ]
  }
]`,
			Icon:      "help-circle",
			MenuOrder: 7,
		},
		{
			Slug:     "contacto",
			Title:    "Contacto y Ubicación",
			Subtitle: "Canales de Comunicación y Cómo Llegar a Los Caobos",
			Content: `[
  {
    "type": "contact_location",
    "title": "Visítanos en Parque Los Caobos",
    "subtitle": "Abierto al público general cada primer sábado de mes.",
    "address": "Parque Los Caobos, área del estacionamiento sur, cerca de la Fuente Venezuela, Caracas, Distrito Capital, Venezuela.",
    "schedule": "Primer sábado de cada mes, de 9:00 AM a 1:00 PM (Venta en moneda local y actividades abiertas)",
    "instagram": "feriaconuquera",
    "facebook": "feriaconuquera",
    "email": "contacto@feriaconuquera.org",
    "phone": "+58 212 000-0000",
    "transport_info": "Estaciones de Metro Bellas Artes o Colegio de Ingenieros (Línea 1). Acceso peatonal y vehicular por Plaza Venezuela o Av. México."
  },
  {
    "type": "cta_banner",
    "badge": "📩 Postulación Comunitaria",
    "title": "¿Deseas postularte como productor conuquero o miembro?",
    "subtitle": "Llena nuestro formulario público de postulación para ser evaluado por la asamblea trimestral.",
    "button_text": "Ir al Formulario de Admisión",
    "button_link": "/p/unirse",
    "theme": "forest"
  }
]`,
			Icon:      "mail",
			MenuOrder: 8,
		},
		{
			Slug:     "semillas",
			Title:    "Semillas & Banco de Semillas",
			Subtitle: "Patrimonio Colectivo, Soberanía Alimentaria y Biodiversidad",
			Content: `[
  {
    "type": "hero",
    "badge": "🌱 Las Semillas Son Vida",
    "title": "Banco Comunitario de Semillas Criollas",
    "subtitle": "Conservar nuestras semillas es conservar nuestra libertad.",
    "description": "Las semillas son el primer eslabón de la cadena alimentaria. Quien controla las semillas controla la alimentación. Por eso defendemos las semillas criollas y nativas: porque son patrimonio colectivo de los pueblos, se reproducen libremente, están adaptadas a nuestro clima y han sido seleccionadas por generaciones de campesinos y campesinas.",
    "image_url": "/images/pages/semillas-libertad.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "¿Qué es un Banco Comunitario de Semillas?",
    "subtitle": "Una alternativa de conservación colectiva de la agrobiodiversidad",
    "columns": 2,
    "items": [
      {"icon":"users","title":"Administración colectiva","description":"Un banco comunitario de semillas es un modelo de administración colectiva de la reserva de semillas necesaria para la siembra entre los productores de una comunidad. Su funcionamiento se basa en el sistema de préstamo y devolución: los productores asociados toman prestada una cantidad de semilla y, tras la cosecha, la devuelven con un porcentaje adicional. Así cada agricultor produce y mejora su propia semilla.","badge":"Colectivo"},
      {"icon":"leaf","title":"Conservación de agrobiodiversidad","description":"Los bancos comunitarios conservan importantes genes que aportan sabor, color, olor, resistencia a plagas y adaptación al clima. La FAO reconoce que estos bancos son vitales para perpetuar el acervo genético de las especies vegetales y asegurar la seguridad alimentaria frente al cambio climático y la homogeneización corporativa.","badge":"Biodiversidad"},
      {"icon":"shield","title":"Confianza en la propia semilla","description":"Los agricultores confían en sus semillas porque han sido seleccionadas por ellos mismos, conocen el desempeño de las plantas de las que provienen y saben cómo se comportarán bajo las condiciones agroecológicas locales. Esta confianza es la base de la autonomía campesina: no dependes de una tienda ni de una corporación para sembrar.","badge":"Autonomía"},
      {"icon":"rotate-cw","title":"Sistema de préstamo y devolución","description":"El banco define colectivamente cuánta semilla deposita cada agricultor y qué porcentaje debe agregar al devolverla. Este sistema permite que el banco crezca con cada ciclo, que la semilla se adapte a las condiciones locales y que nuevos productores puedan acceder a semilla de calidad sin comprarla. Es un círculo de vida que se multiplica.","badge":"Círculo virtuoso"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Semillas Criollas vs. Transgénicas",
    "subtitle": "La diferencia entre libertad y dependencia",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"Semillas criollas y nativas","description":"Las semillas criollas son aquellas que han sido seleccionadas y adaptadas por los campesinos durante generaciones. Son libres: puedes guardarlas, intercambiarlas, venderlas y sembrarlas sin restricciones. Se adaptan a las condiciones locales, resisten plagas nativas, requieren menos insumos externos y conservan la diversidad genética. Cada variedad criolla es resultado de siglos de conocimiento campesino.","badge":"Libres"},
      {"icon":"alert-triangle","title":"Semillas transgénicas","description":"Las semillas transgénicas son modificadas genéticamente en laboratorios y patentadas por corporaciones. Su uso obliga a comprar semillas nuevas cada temporada, crea dependencia económica, contamina las variedades nativas por polinización cruzada, reduce la biodiversidad y concentra el control de la alimentación en unas pocas empresas transnacionales.","badge":"Dependencia"},
      {"icon":"shield","title":"Territorios libres de transgénicos","description":"En América Latina, comunidades indígenas y campesinas han declarado Territorios Libres de Transgénicos como acto de autodeterminación. En Colombia, resguardos indígenas Zenú y comunidades afrodescendientes de la Región Caribe han recuperado decenas de variedades de maíz criollo y declarado sus territorios libres de transgénicos.","badge":"Resistencia"},
      {"icon":"globe","title":"Patrimonio de los pueblos","description":"Las semillas constituyen un don sagrado, patrimonio colectivo de los pueblos. Han circulado libremente entre la población rural latinoamericana garantizando soberanía y autonomía alimentaria frente a las crisis. Los derechos colectivos de uso, manejo, intercambio y control local de las semillas tienen carácter inalienable e imprescriptible.","badge":"Patrimonio"}
    ]
  },
  {
    "type": "features_grid",
    "title": "El Trueque de Semillas en la Feria Conuquera",
    "subtitle": "Cada encuentro mensual en Parque Los Caobos es un intercambio libre de vida",
    "columns": 3,
    "items": [
      {"icon":"rotate-cw","title":"Cómo funciona","description":"Traes tus semillas en sobres o frascos etiquetados con el nombre de la variedad, fecha de cosecha y lugar de procedencia. Las intercambias por las semillas de otros agricultores y vecinos. No hay dinero de por medio. Una semilla de maíz criollo por una de frijol, un puñado de ají dulce por semillas de lechuga.","badge":"Intercambio"},
      {"icon":"leaf","title":"Por qué importa","description":"Cada semilla que viaja de una mano a otra es un acto de soberanía. Si las semillas solo estuvieran en una tienda, perderíamos la diversidad. El trueque mantiene vivas variedades que no se consiguen comercialmente: el maíz cariaco, el frijol caraota de enredadera, el ají topito, la lechuga de hoja suelta.","badge":"Soberanía"},
      {"icon":"heart","title":"Para todos","description":"No necesitas ser productor profesional para participar. Si tienes un balcón con hierbas, un patio con un árbol frutal o un huerto comunitario, puedes traer tus semillas. También puedes llevar semillas para empezar tu propio huerto en casa. La semilla es el primer paso hacia la soberanía alimentaria urbana.","badge":"Abierto"}
    ]
  },
  {
    "type": "features_grid",
    "title": "La Campaña Semillas de Identidad",
    "subtitle": "Recuperar, visibilizar y multiplicar nuestras semillas nativas",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"Recuperación de variedades perdidas","description":"En Colombia, la campaña Semillas de Identidad identificó 27 variedades de maíz criollo entre Urabá y Boliván. En Venezuela, colectivos agroecológicos recuperan variedades de caraota, maíz, ají y tubérculos que habían desaparecido del mercado pero seguían vivas en los conucos de los abuelos. Cada variedad recuperada es un triunfo contra la homogeneización.","badge":"Recuperación"},
      {"icon":"users","title":"Guardianes de semillas","description":"Los guardianes de semillas son campesinos, indígenas y urbanos que conservan variedades específicas en sus huertos y conucos. No lo hacen por lucro: lo hacen por convicción. Saben que si ellos no guardan esa semilla, se pierde para siempre. Las Redes de Guardianes de Semillas articulan a estos custodios en toda América Latina.","badge":"Guardianes"},
      {"icon":"book-open","title":"Diálogo de saberes","description":"El banco de semillas no es solo un depósito: es un espacio de diálogo entre el conocimiento campesino ancestral y la ciencia agroecológica. Los abuelos saben cuándo sembrar según las lluvias, qué variedad va mejor en cada suelo, cómo preparar remedios naturales contra plagas. Los jóvenes aportan técnicas de documentación, registro y experimentación.","badge":"Diálogo"},
      {"icon":"globe","title":"Redes de semillas libres","description":"La Red de Semillas Libres de Colombia, la Red de Guardianes de Semillas de Vida, la Campaña Global por la Soberanía de las Semillas: movimientos que defienden el derecho de los pueblos a guardar, intercambiar y mejorar sus semillas frente a las leyes que pretenden privatizar la vida.","badge":"Red global"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🌱 Participa",
    "title": "Trae tus semillas a la próxima feria",
    "subtitle": "Cada primer sábado de mes en Parque Los Caobos. Intercambio libre de semillas criollas, plántulas medicinales y esquejes. No necesitas ser miembro para participar en el trueque de semillas.",
    "button_text": "Ver Próxima Feria",
    "button_link": "/p/contacto",
    "theme": "forest"
  }
]`,
			Icon:      "sprout",
			MenuOrder: 9,
		},
		{
			Slug:     "saberes-ancestrales",
			Title:    "Saberes Ancestrales",
			Subtitle: "Conocimientos Tradicionales que Sostienen la Vida Comunitaria",
			Content: `[
  {
    "type": "hero",
    "badge": "🏺 Saberes que Vienen del Conuco",
    "title": "Saberes Ancestrales y Conocimiento Tradicional",
    "subtitle": "La sabiduría de los abuelos no es pasado: es futuro.",
    "description": "Los saberes ancestrales son conocimientos transmitidos de generación en generación, nacidos de la observación paciente de la naturaleza y de la relación respetuosa entre las personas y la tierra. No son recetas del pasado: son tecnologías vivas, adaptadas y vigentes, que ofrecen respuestas a los problemas contemporáneos de alimentación, salud, vivienda y comunidad.",
    "image_url": "/images/pages/saberes-ancestrales.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Casas de Bahareque: Construcción Natural Ancestral",
    "subtitle": "Cuatro siglos de arquitectura sostenible en Venezuela",
    "columns": 2,
    "items": [
      {"icon":"home","title":"¿Qué es el bahareque?","description":"El bahareque es una técnica constructiva prehispánica que ha sobrevivido hasta nuestros días en Venezuela, especialmente en el estado Zulia, desde el siglo XVII. Está compuesto por columnas de madera (horconadura), varas horizontales amarradas a ambos lados (enlatado), un relleno de barro con piedras y paja (embutido), y un acabado de barro con o sin cal (empañetado). Es arquitectura de tierra: vernácula, sostenible y patrimonial.","badge":"Técnica ancestral"},
      {"icon":"leaf","title":"Construcción sostenible","description":"El bahareque usa materiales locales y reciclables: madera, barro, caña, bejucos, paja. Requiere poca energía y agua para construirse. No contamina. Se integra al paisaje. Regula la temperatura naturalmente. Estudios de la Universidad Central de Venezuela demuestran que es posible construir y reparar bahareque con materiales disponibles hoy, aplicando principios de construcción sostenible.","badge":"Sostenible"},
      {"icon":"users","title":"Construcción comunitaria (cayapas)","description":"Las casas de bahareque se construían mediante cayapas: jornadas colectivas donde toda la comunidad ayudaba voluntariamente. Cada quien contribuía con lo que tenía: horcones, latas, bejucos, varas. El barro se traía en mapires y cajones al hombro o sobre burros. Era una fiesta pueblerina, llena de camaradería, donde viejos, mozos, niños, varones y hembras participaban.","badge":"Cayapa"},
      {"icon":"shield","title":"Patrimonio que se pierde","description":"A mediados del siglo XX, el bahareque fue desplazado por el ladrillo y el cemento en las ciudades. Varias edificaciones de bahareque que aún están en pie son consideradas patrimonio nacional o regional. Pero el conocimiento se está perdiendo: los jóvenes ya no saben construir con barro. Recuperar esta técnica es recuperar autonomía habitacional, patrimonio cultural y una forma de construcción que no destruye el planeta.","badge":"Patrimonio"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Ollas de Barro: Cocina Ancestral",
    "subtitle": "4.000 años de tradición cerámica que transforma el sabor y nutre el cuerpo",
    "columns": 2,
    "items": [
      {"icon":"utensils","title":"Cocción lenta y uniforme","description":"La olla de barro permite una cocción lenta y uniforme que resalta los sabores naturales de los ingredientes. La porosidad del barro hace que los alimentos se cocinen de manera suave, manteniendo la humedad y potenciando los aromas. El secreto del buen sabor es que la cocción es lenta: los ingredientes necesitan su tiempo para sacar sus sabores, texturas y aromas.","badge":"Sabor"},
      {"icon":"heart","title":"Beneficios para la salud","description":"El barro contiene minerales que se transfieren a los alimentos durante la cocción, enriqueciéndolos naturalmente. Las ollas de barro retienen el calor de manera uniforme, preservando las vitaminas y minerales que otros materiales degradan. La cocción suave favorece la digestión. A diferencia del aluminio o el teflón, el barro no libera sustancias tóxicas a altas temperaturas.","badge":"Salud"},
      {"icon":"history","title":"4.000 años de tradición","description":"El uso de ollas de barro se remonta a las culturas originarias de América. En Ecuador, la cultura Valdivia ya elaboraba vasijas para procesar, servir y guardar alimentos hace 4.000 años. En Venezuela, comunidades de Barinas, Mérida y los Andes mantienen viva la tradición alfarera. Cada olla es única: hecha a mano, cocida en horno a 1000°C, con la arcilla del lugar.","badge":"Tradición"},
      {"icon":"leaf","title":"Cocina sin dependencia industrial","description":"Usar ollas de barro es un acto de soberanía: no dependes de utensilios industriales importados, apoyas a los alfareros locales, reduces el consumo de metal y plástico, y recuperas una forma de cocinar que es más sabrosa, más saludable y más justa. En la feria conseguimos ollas, budares, tiestos y vasijas de barro hechas por artesanos venezolanos.","badge":"Soberanía"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Casas de Cultivo e Invernaderos",
    "subtitle": "Agricultura urbana protegida para producir alimentos todo el año",
    "columns": 2,
    "items": [
      {"icon":"home","title":"¿Qué es una casa de cultivo?","description":"Las casas de cultivo son estructuras protegidas que permiten producir hortalizas durante todo el año, protegiendo los cultivos del sol intenso, la lluvia excesiva y las plagas. En Caracas, experiencias como el AVIVIR La Limonera (Baruta) y casas de cultivo en El Junquito han demostrado que se pueden producir tomates, pimentones, pepinos y lechugas de forma agroecológica en espacios urbanos.","badge":"Cultivo protegido"},
      {"icon":"leaf","title":"Producción agroecológica urbana","description":"En las casas de cultivo se usan abonos orgánicos (humus de lombriz, biol), control biológico de plagas (Trichoderma, Bacillus thuringiensis, Beauveria bassiana) y caldos naturales (sulfocalcico). No se usan agrotóxicos. En El Junquito, una casa de cultivo de 300 m² produce hasta 8.000 kg de tomate por ciclo, libre de agrotóxicos.","badge":"Sin agrotóxicos"},
      {"icon":"users","title":"Agricultura comunitaria","description":"En barrios como Catia, los huertos urbanos se han convertido en centros de desarrollo comunitario. El Centro Agro Catia, en un predio que fue campamento de damnificados, ahora produce tomate, cebollín, ají, pimentón, repollo y lechuga. Escolares visitan para aprender a cultivar. La siembra urbana es herramienta de soberanía alimentaria, educación y tejido social.","badge":"Comunidad"},
      {"icon":"sparkles","title":"Huerto en casa","description":"No necesitas un campo grande: un balcón, un patio, un terrario o un cantero vertical basta para empezar. En la feria conseguimos plántulas, semillas, sustratos orgánicos, lombrices californianas para compostaje y asesoría para montar tu huerto familiar. Producir tus propias hierbas y hortalizas es el primer paso hacia la autonomía alimentaria.","badge":"Huerto familiar"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Medicina Natural y Botica Conuquera",
    "subtitle": "El conocimiento etnobotánico de las comunidades venezolanas",
    "columns": 2,
    "items": [
      {"icon":"heart","title":"Plantas medicinales: patrimonio vivo","description":"Estudios etnobotánicos en comunidades campesinas de Aragua, Mérida, Anzoátegui y Barinas documentan cientos de especies de plantas medicinales usadas por los venezolanos. En El Onoto (Aragua), todas las familias usan plantas medicinales, desde niños hasta ancianos. Es patrimonio cultural y ancestral que se transmite oralmente, de abuelos a nietos.","badge":"Etnobotánica"},
      {"icon":"leaf","title":"Tinturas madres y preparados","description":"En la feria conseguimos tinturas madres de propóleo, moringa, cúrcuma, jengibre y árnica; ungüentos naturales; jarabes para la tos; aceites esenciales. Cada preparado se hace con plantas cultivadas agroecológicamente o recolectadas respetando los ciclos naturales. La farmacopea tradicional no reemplaza la medicina moderna, la complementa.","badge":"Botica"},
      {"icon":"shield","title":"Primer recurso de salud","description":"En comunidades rurales con deficiencias en servicios de salud, las plantas medicinales son el primer recurso para atender afecciones respiratorias, digestivas, cutáneas y renales. Las hojas, frutos y cortezas se preparan en decocción o maceración. Este conocimiento es una alternativa real de atención primaria, especialmente donde el Estado no llega.","badge":"Salud comunitaria"},
      {"icon":"alert-triangle","title":"Conocimiento en riesgo","description":"Los estudios advierten que el conocimiento tradicional se está erosionando por la modernización, la migración y la pérdida de transmisión intergeneracional. Por eso es vital documentar, visibilizar y transmitir estos saberes. La feria es un espacio de diálogo de saberes: los abuelos comparten, los jóvenes registran y experimentan.","badge":"Urgente"}
    ]
  },
  {
    "type": "features_grid",
    "title": "La Cosmovisión Conuquera",
    "subtitle": "El conuco como forma de vida, no solo de producción",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"¿Qué es el conuco?","description":"El conuco es el sistema agrícola tradicional de los pueblos originarios y campesinos de Venezuela y el Caribe. No es solo una parcela: es una forma de relación con la tierra basada en la diversidad, la reciprocidad y el respeto. En el conuco se siembran juntos maíz, caraota, frijol, yuca, ají, lechosa: cada planta protege y nutre a las demás. Es el modelo original de la agroecología.","badge":"Conuco"},
      {"icon":"heart","title":"La Pachamama y la Cruz de Mayo","description":"Cada mayo, los productores de la Feria Conuquera celebran un convite en honor a la Cruz de Mayo, un sentido homenaje a la Pachamama que les provee sustento y vida. No es solo una festividad: es un acto de gratitud a la tierra. La cosmovisión conuquera entiende que la tierra no es un recurso que se explota, sino un ser vivo del que se es parte y al que se debe respeto.","badge":"Pachamama"},
      {"icon":"users","title":"El convite y la cayapa","description":"El convite es la jornada colectiva de siembra, cosecha o construcción donde toda la comunidad participa voluntariamente. La cayapa es lo mismo: ayuda mutua sin pago monetario. Estas prácticas ancestrales son la base de la economía solidaria: no necesitas dinero para construir una casa, sembrar un conuco o cosechar una parcela. Necesitas comunidad.","badge":"Convite"},
      {"icon":"book-open","title":"Diálogo intergeneracional","description":"La feria es un puente entre generaciones: los abuelos enseñan a seleccionar semillas, preparar remedios y cocinar recetas ancestrales; los jóvenes aportan técnicas de documentación, redes sociales y experimentación agroecológica. El conocimiento no se pierde cuando circula. La Feria Conuquera busca rescatar las recetas y alimentos soberanos y restaurar la cultura alimentaria de los ancestros.","badge":"Diálogo"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🏺 Recupera tus Saberes",
    "title": "Los saberes ancestrales son tecnología vigente",
    "subtitle": "Bahareque, ollas de barro, medicina natural, conuco, convite: no son pasado, son futuro. Conócelos, practícalos, transmítelos. Visita la próxima feria y participa en los talleres formativos.",
    "button_text": "Ver Próximas Actividades",
    "button_link": "/p/contacto",
    "theme": "forest"
  }
]`,
			Icon:      "book-open",
			MenuOrder: 10,
		},
		{
			Slug:     "filosofia-conuquera",
			Title:    "Filosofía Conuquera",
			Subtitle: "Agroecología, Soberanía y Vida Comunitaria",
			Content: `[
  {
    "type": "hero",
    "badge": "🌱 Más que un Mercado, una Forma de Vida",
    "title": "Filosofía Conuquera",
    "subtitle": "La Feria Conuquera no es solo un mercado: es una organización que aglutina a colectivos, familias y comunidades que buscan transformar cómo producimos, distribuimos y consumimos alimentos.",
    "description": "Nacimos en 2014 como respuesta a la crisis alimentaria y la guerra económica. Frente a las colas, el desabastecimiento y la comida procesada, retomamos el concepto y la práctica conuquera: producir sin agrotóxicos, distribuir sin intermediarios, consumir alimentos soberanos y tejer comunidad alrededor de la tierra.",
    "image_url": "/images/pages/feria-organizacion.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Nuestra Filosofía",
    "subtitle": "Los principios que guían todo lo que hacemos",
    "columns": 2,
    "items": [
      {"icon":"leaf","title":"Agroecología como modelo de vida","description":"La agroecología no es solo una técnica de cultivo: es una ciencia, una práctica y un movimiento. Ciencia que aplica principios ecológicos a la agricultura. Práctica que respeta los ciclos naturales, recicla nutrientes y controla plagas con biodiversidad. Movimiento que defiende la soberanía alimentaria, la justicia social y los derechos de los pueblos. La FAO la reconoce como método capaz de transformar los sistemas alimentarios hacia la sostenibilidad.","badge":"Agroecología"},
      {"icon":"shield","title":"Soberanía alimentaria","description":"La soberanía alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios: qué sembrar, cómo sembrar, para quién producir y cómo distribuir. No es solo tener qué comer: es autonomía. Que la comunidad controle su alimentación, no las corporaciones transnacionales que monopolizan semillas y agroquímicos. La Vía Campesina acuñó este concepto y lo defendemos.","badge":"Soberanía"},
      {"icon":"users","title":"Economía solidaria","description":"Frente al capitalismo que explota personas y tierra, proponemos la economía solidaria: trueque, crédito mutuo, convite, cayapa, distribución sin intermediarios, precios justos. El dinero no es el centro: el centro son las personas. Producimos para el bien común, no para la acumulación. La Feria Conuquera es un mercado a costo solidario, no a precio de mercado.","badge":"Solidaridad"},
      {"icon":"heart","title":"Respeto a la Madre Tierra","description":"La tierra no es un recurso: es un ser vivo del que somos parte. La cosmovisión conuquera entiende que la Pachamama nos provee sustento y vida, y merece gratitud y respeto. Por eso prohibimos el plástico desechable, usamos agroecología sin agrotóxicos, reciclamos nutrientes y promovemos construcciones naturales como el bahareque. Cuidar la tierra es cuidarnos a nosotros mismos.","badge":"Pachamama"},
      {"icon":"book-open","title":"Saberes ancestrales","description":"Los conocimientos de los abuelos no son pasado: son tecnología vigente. El conuco, las semillas criollas, las ollas de barro, la medicina natural, el bahareque, el convite: todo eso son saberes que ofrecen respuestas contemporáneas a los problemas de alimentación, salud, vivienda y comunidad. La feria es un espacio de diálogo intergeneracional donde estos saberes circulan.","badge":"Saberes"},
      {"icon":"globe","title":"Red global de resistencia","description":"No estamos solos. La Feria Conuquera es parte de un movimiento planetario: la Red Global de Ecoaldeas, la Vía Campesina, Slow Food, las Redes de Semillas Libres, los sistemas LETS, los clubes de trueque. En todos los continentes hay comunidades que están construyendo alternativas al modelo agroindustrial. Somos parte de esa red global de resistencia regenerativa.","badge":"Global"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Nuestra Historia",
    "subtitle": "De la crisis a la organización, de la organización a la soberanía",
    "columns": 2,
    "items": [
      {"icon":"calendar","title":"2014: Nacimiento en la crisis","description":"La Feria Conuquera Agroecológica nace en 2014 como respuesta al contexto de guerra económica. La compra compulsiva de alimentos procesados y las colas llevaron a miles de personas a asumir prácticas nuevas para acceder a bienes. Frente a ese panorama, un colectivo de productores decidió articular una red popular para generar una alternativa de distribución de alimentos sanos, producidos agroecológicamente.","badge":"2014"},
      {"icon":"leaf","title":"2015: Primera feria en Los Caobos","description":"La primera Feria Conuquera se realizó en el Parque Los Caobos de Caracas. El objetivo era visibilizar el trabajo del productor y la productora de alimentos e incentivar al caraqueño a incorporarse al sector productivo. Desde entonces, cada primer sábado de mes, el parque se transforma en un mercado a cielo abierto donde se venden e intercambian alimentos agroecológicos.","badge":"2015"},
      {"icon":"users","title":"Crecimiento y red de colectivos","description":"La feria creció. Hoy aglutina a más de 40 productores de Valles del Tuy, El Hatillo, Baruta, El Junquito, Puerta Caracas y otras comunidades alrededor de Caracas. Se venden frutas, verduras, quesos de búfala y cabra, productos de miel, licores artesanales, cosmética natural, semillas criollas, plántulas medicinales y comida ancestral. Más que un mercado, es una red de colectivos.","badge":"Red"},
      {"icon":"sparkles","title":"10 años de resistencia","description":"En octubre celebramos nuestro aniversario. Diez años de organización, formación y trabajo colectivo. Diez años demostrando que es posible producir alimentos sanos sin agrotóxicos, distribuir sin intermediarios, intercambiar sin dinero y tejer comunidad alrededor de la tierra. La Feria Conuquera es prueba viviente de que otra forma de vida es posible.","badge":"10 años"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Qué Consigues en la Feria",
    "subtitle": "Productos reales de productores reales, sin intermediarios",
    "columns": 3,
    "items": [
      {"icon":"leaf","title":"Cosecha fresca","description":"Hortalizas y hojas verdes de El Junquito: col rizada, acelgas, lechugas variadas, cebollín, cilantro, perejil, espinaca. Tubérculos ancestrales: ñame morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura, cambur morado. Todo cosechado en la mañana, sin agrotóxicos.","badge":"Fresco"},
      {"icon":"heart","title":"Medicina botánica","description":"Tinturas madres de propóleo, moringa, cúrcuma, jengibre y árnica. Ungüentos naturales. Jarabes para la tos. Cosmética sin químicos: desodorantes de aceite de coco y bicarbonato, bálsamos labiales de cera de abejas, jabones artesanales, toallas reutilizables.","badge":"Botica"},
      {"icon":"utensils","title":"Gastronomía artesanal","description":"Cafunga de Barlovento (postre afro-venezolano con plátano maduro, coco y papelón). Quesos de búfala y cabra: añejados, frescos, dulce de leche, yogur, mantequilla. Cacao puro, chocolates bean-to-bar de Barlovento y Chuao. Café de montaña tostado en leña.","badge":"Gastronomía"},
      {"icon":"sprout","title":"Semillas y plántulas","description":"Semillas criollas libres de transgénicos: maíz cariaco, caraota de enredadera, ají topito, lechuga de hoja suelta. Plántulas medicinales: poleo, stevia, hierbaluisa, romero, ruda, orégano orejón. Esquejes de frutales. Todo para tu huerto familiar.","badge":"Semillas"},
      {"icon":"home","title":"Artesanía y ollas de barro","description":"Ollas, budares y tiestos de barro hechos por alfareros venezolanos. Cestería tradicional. Vasijas de arcilla. Productos de fibras naturales. Cada pieza es única, hecha a mano con técnicas ancestrales y materiales del lugar.","badge":"Artesanía"},
      {"icon":"zap","title":"Miel y derivados","description":"Miel pura de abejas criollas. Polen. Propóleo. Cera de abejas. Productos de la colmena producidos por apicultores que respetan los ciclos naturales y no alimentan a las abejas con azúcar.","badge":"Miel"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Actividades de la Feria",
    "subtitle": "Más que comprar y vender: formación, cultura y comunidad",
    "columns": 2,
    "items": [
      {"icon":"book-open","title":"Talleres formativos gratuitos","description":"En cada jornada se ofrecen talleres gratuitos: siembra y lombricultura, preparación de bioinsumos, conservación de semillas, medicina natural, cocina ancestral, construcción con barro. La formación es continua: no solo aprendes a comprar, aprendes a producir.","badge":"Formación"},
      {"icon":"rotate-cw","title":"Trueque libre de semillas","description":"Espacio abierto donde agricultores y vecinos intercambian semillas criollas, plántulas y esquejes sin dinero. Traes lo que tienes, llevas lo que necesitas. Cada semilla que viaja es un acto de soberanía.","badge":"Trueque"},
      {"icon":"book","title":"Dona y adopta un libro","description":"Intercambio libre de libros: traes los que ya leíste, te llevas los que quieres leer. No es una librería: es un círculo de lectura comunitaria que promueve el acceso al conocimiento sin barreras económicas.","badge":"Libros"},
      {"icon":"music","title":"Música y cultura popular","description":"Música popular en vivo: tambores, cuatros, cantos de trabajo y décimas. Actividades lúdicas para niños y familias. La feria es celebración: no solo se vende, se canta, se baila, se comparte.","badge":"Cultura"},
      {"icon":"users","title":"Asambleas y comisiones","description":"Asambleas Generales cada 3 meses para la toma de decisiones colectivas. Comisiones temáticas: logística, comunicación, bioinsumos, cultura. La feria se gobierna horizontalmente, por consentimiento y no por jerarquía.","badge":"Gobernanza"},
      {"icon":"leaf","title":"Cayapas y visitas a conucos","description":"Organizamos cayapas (jornadas colectivas de trabajo) y visitas a los conucos de los productores fuera de Caracas. Es ayuda mutua: vas a sembrar o cosechar con el compañero, aprendes de su práctica y fortaleces el vínculo rural-urbano.","badge":"Cayapa"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🤝 Únete a la Red",
    "title": "La Feria Conuquera es una forma de vida",
    "subtitle": "No solo vienes a comprar: vienes a aprender, a intercambiar, a compartir, a construir comunidad. Si deseas ingresar como productor o participar en las asambleas y trueques, postúlate ante la asamblea.",
    "button_text": "Completar Solicitud de Admisión",
    "button_link": "/p/unirse",
    "theme": "forest"
  }
]`,
			Icon:      "heart",
			MenuOrder: 11,
		},
		{
			Slug:     "ecoaldeas-mundo",
			Title:    "Ecoaldeas en el Mundo",
			Subtitle: "Comunidades Autosustentables que Inspiran: Referentes Globales",
			Content: `[
  {
    "type": "hero",
    "badge": "🌍 Un Movimiento Planetario",
    "title": "Ecoaldeas en el Mundo",
    "subtitle": "Comunidades que viven en armonía con la naturaleza, libres de contaminación y químicos, recuperando saberes ancestrales.",
    "description": "Estas son experiencias reales de comunidades en distintos continentes que han decidido vivir de otra manera: cultivando sus propios alimentos sin agrotóxicos, construyendo con materiales naturales, usando energías limpias y practicando la economía solidaria. No son nuestros aliados ni socios: son referentes que nos inspiran y de los cuales aprendemos. Cada una demuestra que otra forma de vida es posible.",
    "image_url": "/images/pages/feria-organizacion.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Redes Globales",
    "subtitle": "Plataformas que conectan comunidades autosustentables en todo el mundo",
    "columns": 2,
    "items": [
      {"icon":"globe","title":"Global Ecovillage Network (GEN)","description":"Es la organización mundial más importante del movimiento de ecoaldeas. Conecta a miles de comunidades en los cinco continentes. Su sitio web incluye un mapa interactivo mundial donde se pueden buscar proyectos activos, opciones de voluntariado y programas educativos sobre diseño sustentable. Fundada en 1995, su lema es: El mundo necesita más ecoaldeas.","badge":"GEN"},
      {"icon":"globe","title":"CASA Latina","description":"El Consejo de Asentamientos Sustentables de América Latina es la rama de GEN para Latinoamérica. Agrupa redes nacionales de bioconstrucción, permacultura y ecoaldeas. Es el mejor punto de partida para buscar proyectos hispanohablantes orientados al rescate de saberes indígenas y campesinos. Su proceso de formación comenzó en el Llamado de la Montaña, Colombia, en enero de 2012.","badge":"CASA Latina"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Ecoaldeas Emblemáticas",
    "subtitle": "Comunidades referentes que llevan décadas demostrando que es posible vivir de otra manera",
    "columns": 2,
    "items": [
      {"icon":"home","title":"Findhorn (Escocia, 1962)","description":"Una de las comunidades ecológicas más antiguas del mundo. Fundada en 1962 en Moray, Escocia. Destaca por sus viviendas construidas con materiales locales, el uso de energías renovables (incluyendo una turbina eólica Vestas de 75 kW) y su sistema avanzado de tratamiento de aguas residuales llamado Living Machine. Recibió la designación de UN-Habitat Best Practice en 1998 y 2018. Es un laboratorio viviente de sostenibilidad con más de 60 años de evolución.","badge":"Escocia"},
      {"icon":"sparkles","title":"Damanhur (Italia, 1975)","description":"Federación de comunidades espirituales fundada en 1975 por Oberto Airaudi en el Piamonte, norte de Italia. Sus 600 habitantes han creado una sociedad multilingüe con su propia constitución y su propia moneda, el Credito. Son reconocidos mundialmente por su alta autosuficiencia alimentaria y energética, sus Templos de la Humanidad subterráneos, y un profundo enfoque en el desarrollo espiritual y las artes. Es un laboratorio viviente del futuro.","badge":"Italia"},
      {"icon":"droplet","title":"Tamera (Portugal, 1995)","description":"Centro de Investigación y Educación para la Paz en Alentejo, la región más árida de Portugal. Han transformado terrenos áridos en oasis mediante técnicas ancestrales de retención de agua de lluvia: crearon 29 lagos y espacios de retención entre 2006 y 2015, pasando de 0.62 ha a 8.32 ha de cuerpos de agua. Promueven la agricultura libre de pesticidas, la soberanía alimentaria regional y el Nuevo Paradigma del Agua. Un biotopo de paz que investiga cómo habitar la Tierra sin violencia.","badge":"Portugal"},
      {"icon":"palette","title":"Huehuecoyotl (México, 1982)","description":"Primera ecoaldea de México, fundada en 1982 por un grupo de artistas y activistas de varias nacionalidades en las montañas de Morelos, cerca de Tepoztlán. Sus fundadores vivieron 14 años como tribu artística nómada (Los Elefantes Iluminados) recorriendo el mundo en autobuses convertidos antes de establecerse. El nombre significa El Muy Viejo Coyote, dios azteca de la música, la poesía y el teatro. Es referente latinoamericano de vida comunitaria, medicina natural, ecología profunda, permacultura y preservación cultural.","badge":"México"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Los 4 Pilares de la Vida en una Ecoaldea",
    "subtitle": "Los principios que guían a estas comunidades autosustentables",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"Permacultura y Agroecología","description":"Cultivan sus propios alimentos replicando los patrones de la naturaleza. No utilizan fertilizantes químicos, pesticidas ni semillas transgénicas. Usan abonos orgánicos (compost, humus de lombriz, biol) y asocian cultivos para proteger la tierra. Cada desecho se transforma en insumo: el estiércol en biogás, la basura orgánica en compost, el agua gris en riego.","badge":"Permacultura"},
      {"icon":"home","title":"Bioconstrucción","description":"Construyen sus casas utilizando materiales naturales del entorno que no contaminan ni generan desechos tóxicos: adobe, bahareque, barro, paja, madera, piedra, bambú. Las casas se integran al paisaje, regulan la temperatura naturalmente y se construyen comunitariamente mediante cayapas. No dependen del cemento ni del ladrillo industrial.","badge":"Bioconstrucción"},
      {"icon":"zap","title":"Energías limpias y gestión de residuos","description":"Usan paneles solares, energía eólica, microhidroeléctricas y biodigestores. Implementan baños secos (que no gastan agua y generan abono seguro). Reciclan el agua de lluvia para riego. Tratan aguas residuales con humedales construidos y Living Machines. La meta es autonomía energética e hídrica descentralizada.","badge":"Energía limpia"},
      {"icon":"heart","title":"Economía solidaria y saberes ancestrales","description":"Muchas comunidades practican el trueque, usan monedas locales (como el Credito de Damanhur) o comparten recursos. Rescatan el uso de plantas medicinales, la partería natural, la conservación tradicional de alimentos, las ollas de barro, la construcción con barro. Toman decisiones por consenso o sociocracia, no por jerarquía.","badge":"Economía solidaria"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Otras Experiencias que nos Inspiran",
    "subtitle": "Movimientos y prácticas relacionadas en distintas partes del mundo. No son aliados ni socios: son referentes de los cuales aprendemos.",
    "columns": 3,
    "items": [
      {"icon":"scale","title":"Sistemas LETS","description":"Local Exchange Trading Systems: nacieron en Canadá en 1983 y se expandieron por Europa y Oceanía. Sistemas de crédito mutuo sin dinero donde todas las cuentas empiezan en cero. Inspiraron nuestro sistema TQ.","badge":"LETS"},
      {"icon":"users","title":"Club del Trueque (Argentina)","description":"Redes de trueque que surgieron en los años 90 como respuesta a la crisis. Llegaron a tener millones de participantes intercambiando con créditos sin dinero oficial. Demostraron la fuerza del crédito mutuo.","badge":"Argentina"},
      {"icon":"leaf","title":"Vía Campesina","description":"Movimiento internacional de campesinos, pueblos indígenas y trabajadores agrícolas presente en más de 80 países. Defiende la agricultura campesina y la agroecología. Acuñó el concepto de soberanía alimentaria.","badge":"Vía Campesina"},
      {"icon":"heart","title":"Slow Food","description":"Movimiento nacido en Italia en 1986 que promueve alimentos buenos, limpios y justos. Defiende la biodiversidad alimentaria y las tradiciones culinarias locales frente a la comida rápida y homogeneizada.","badge":"Slow Food"},
      {"icon":"sprout","title":"Red de Semillas Libres","description":"Movimientos que defienden las semillas nativas y criollas frente al avance corporativo. Promueven territorios libres de transgénicos y la soberanía alimentaria como derecho inalienable de los pueblos.","badge":"Semillas libres"},
      {"icon":"book-open","title":"Permacultura","description":"Sistema de diseño creado por Bill Mollison y David Holmgren en Australia en los años 70. Diseña asentamientos humanos y sistemas agrícolas que imitan los patrones y relaciones de la naturaleza. Es la base teórica de muchas ecoaldeas.","badge":"Permacultura"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🌱 Nuestro Sueño",
    "title": "Campo Soberano: nuestra ecoaldea",
    "subtitle": "Nos inspiramos en estas experiencias para construir nuestra propia comunidad intencional agroecológica en Venezuela. Conoce el proyecto Campo Soberano: permacultura, energía solar, bahareque, crédito mutuo y gobernanza sociocrática.",
    "button_text": "Conocer Campo Soberano",
    "button_link": "/p/campo-soberano",
    "theme": "forest"
  }
]`,
			Icon:      "globe",
			MenuOrder: 12,
		},
		{
			Slug:     "metodologia-energetica",
			Title:    "Metodologia Energetica",
			Subtitle: "Como Calculamos los Precios: Energia Objetiva, no Dinero",
			Content: `[
  {
    "type": "hero",
    "badge": "1 TQ = 1 kWh = 3.6 MJ",
    "title": "Precios Basados en Energia, no en Mercado",
    "subtitle": "Nuestro sistema de precios no usa oro, dolares ni especulacion. Usa la energia fisica real invertida en producir cada bien.",
    "description": "El TQ no esta anclado al oro ni a ninguna moneda. Esta anclado al julio (J), la unidad universal de energia del Sistema Internacional. 1 TQ = 1 kWh = 3.6 megajulios (MJ). Esto hace que el valor sea objetivo, medible y auditable: cualquier persona puede verificar cuanta energia se invirtio en producir algo.",
    "image_url": "/images/pages/sistema-precios.jpg",
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
        "description": "EE_total = E_directa + E_insumos + E_trabajo + E_transporte. E_directa: energia consumida en el proceso (electricidad, gas, lena). E_insumos: energia incorporada en las materias primas usadas. E_trabajo: energia humana invertida (horas x tarifa energetica). E_transporte: energia del traslado de materiales y producto final. El resultado en MJ se divide entre 3.6 para obtener TQ. Ejemplo: Olla de barro de 2 kg. Material: 2 kg x 2.5 MJ/kg = 5 MJ. Coccion: 18 MJ. Trabajo: 3 horas x 3.6 MJ/h = 10.8 MJ. Total: 33.8 MJ / 3.6 = 9.4 TQ.",
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
        "description": "No todo el trabajo exige la misma energia. Trabajo administrativo: x 1.0. Trabajo tecnico/especializado: x 1.15. Trabajo agricola/fisico: x 1.3. Un agricultor que trabaja 6 horas recibe 6 x 1.3 = 7.8 TQ. Un administrador que trabaja 6 horas recibe 6 x 1.0 = 6 TQ.",
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
        "description": "Harina de trigo integral: 1.1 kg x 33.6 MJ/kg = 36.96 MJ. Levadura natural: 0.02 kg x 5 TQ/kg = 0.1 TQ. Sal marina: 0.01 kg x 3 TQ/kg = 0.03 TQ. Agua: 0.35 L x 0.5 TQ/L = 0.18 TQ. Electricidad (horno): 0.5 kWh x 1 TQ/kWh = 0.5 TQ. Lena (horno mixto): 0.3 kg x 4.5 TQ/kg = 1.35 TQ. Trabajo del panadero: 0.25 horas x 5 MJ/h = 1.25 MJ. Transporte local: 2 km x 0.5 TQ/km = 1.0 TQ. TOTAL: 42.21 MJ / 3.6 = 11.73 TQ por kg de pan. Precio redondeado: 12 TQ/kg.",
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
]`,
			Icon:      "zap",
			MenuOrder: 13,
		},
		{
			Slug:     "gobernanza",
			Title:    "Gobernanza de la Aldea",
			Subtitle: "Como se Gobierna, Quien Decide, Que se Puede y Que No",
			Content: `[
  {
    "type": "hero",
    "badge": " Ley de la Aldea",
    "title": "Gobernanza Sociocratica de la Ecoaldea",
    "description": "La aldea se gobierna por consentimiento, no por mayoria. Las decisiones se toman en circulos operativos semi-autonomos y en la Asamblea General mensual. Aqui encontraras la estructura de gobierno, tus deberes, lo que esta permitido, lo que esta prohibido y como se resuelven los conflictos.",
    "theme": "forest"
  },
  {
    "type": "features_grid",
    "title": "Estructura de Gobernanza",
    "subtitle": "Como se organiza la toma de decisiones en la aldea",
    "columns": 3,
    "items": [
      {"icon":"users","title":"Asamblea General","description":"Organo maximo de decision. Se reune trimestralmente. Todos los miembros plenos tienen voz y voto. Decide sobre admision, expulsion, impuestos, tarifas energeticas, federacion, reglas de gobernanza y politicas generales. Las decisiones grandes requieren mayoria calificada (2/3 o 75% segun el caso).","badge":"Trimestral"},
      {"icon":"circle","title":"Circulos Operativos","description":"La gobernanza se divide en circulos semi-autonomos: Circulo de Agua y Tierra, Circulo de Habitabilidad, Circulo de Agroecologia, Circulo de Economia Solidaria, Circulo de Convivencia y Admisiones. Cada circulo gestiona su area sin esperar aprobacion de la asamblea para decisiones operativas.","badge":"Semi-autonomos"},
      {"icon":"briefcase","title":"Junta Directiva del Nodo","description":"Organo ejecutivo del nodo. Toma decisiones operativas frecuentes: creacion de cuentas, cambios de limites, modificacion de productos, distribucion de fondos y aumento de presupuesto. Compuesto por miembros elegidos por la asamblea. El quorum se calcula sobre los miembros de la junta (no sobre todos los miembros). La Asamblea decide que decisiones delega a la junta.","badge":"Ejecutivo"},
      {"icon":"link","title":"Doble Enlace Sociocratico","description":"Cada circulo elige dos personas que lo conectan con la Asamblea: un Coordinador (informacion de arriba hacia abajo) y un Delegado (inquietudes del circulo hacia la asamblea). Garantiza flujo bidireccional de informacion.","badge":"Flujo"},
      {"icon":"building","title":"Organizaciones","description":"Colectivos de produccion, consumo o servicios registrados en el sistema: Grupo de Produccion, Grupo de Consumo, Comision, Proyecto, Institucion Publica o Cooperativa. Tienen su propia junta directiva y limites simetricos mas amplios (-5000/+5000 TQ).","badge":"Colectivos"},
      {"icon":"folder","title":"Departamentos","description":"Unidades administrativas con roles y permisos especificos. Cada departamento tiene un jefe, miembros asignados y roles con permisos granulares. Los departamentos se mapean a los circulos operativos.","badge":"Administrativo"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Deberes de los Miembros",
    "subtitle": "Obligaciones que asume cada miembro al unirse a la aldea",
    "columns": 2,
    "items": [
      {"icon":"leaf","title":"Produccion Agroecologica","description":"Toda siembra en conucos familiares y comunes debe ser 100% agroecologica: libre de agroquimicos y semillas transgenicas. Solo se permite compost, bioinsumos, microorganismos eficientes y abonos verdes.","badge":"Obligatorio"},
      {"icon":"tool","title":"Cayapa Semanal","description":"Cada miembro adulto debe aportar un minimo de 12 horas semanales de trabajo en proyectos comunes: mantenimiento de caminos, siembra comunitaria, cuidado de animales, reparacion de la microrred o cocina comun. Estas horas se registran en la cuenta TQ.","badge":"12h/semana"},
      {"icon":"coins","title":"Uso Exclusivo de TQ","description":"Todo intercambio comercial dentro de la aldea debe realizarse exclusivamente mediante la plataforma contable TQ. No se permite usar dinero fiat (bolivares, dolares) para transacciones internas.","badge":"Solo TQ"},
      {"icon":"sprout","title":"Banco de Semillas","description":"Cada miembro debe participar en el Banco de Semillas devolviendo un porcentaje superior de semillas nativas tras cada cosecha para que la reserva crezca.","badge":"Semillas"},
      {"icon":"calendar","title":"Asistencia a Asambleas","description":"La asistencia a las asambleas mensuales es obligatoria. Tres faltas injustificadas consecutivas son una falta leve.","badge":"Mensual"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Lo Que Esta Permitido",
    "subtitle": "Derechos y facultades de los miembros de la aldea",
    "columns": 2,
    "items": [
      {"icon":"home","title":"Bioconstruccion","description":"Construir viviendas con materiales locales de baja huella de carbono: adobe, tapia, bahareque, madera certificada, bambu, techos verdes o de paja. El diseño debe ser bioclimatico (ventilacion natural, captacion solar pasiva).","badge":"Permitido"},
      {"icon":"droplets","title":"Banos Secos Composteros","description":"El uso de banos secos composteros es obligatorio para todas las viviendas. Las aguas grises deben tratarse con biofiltros de plantas (humedales artificiales).","badge":"Obligatorio"},
      {"icon":"sun","title":"Microrred Solar","description":"Abastecimiento energetico a traves de la microrred solar e hidraulica de la aldea. Cada vivienda tiene un limite de consumo asignado.","badge":"Permitido"},
      {"icon":"shopping-cart","title":"Comercio con TQ","description":"Comprar y vender libremente dentro de la aldea usando TQ, respetando los limites de saldo simetricos (-500/+500 para nuevos, -1000/+1000 para activos).","badge":"Permitido"},
      {"icon":"plus","title":"Crear Organizaciones","description":"Los miembros plenos pueden crear organizaciones de produccion, consumo o servicios con aprobacion de la asamblea.","badge":"Permitido"},
      {"icon":"globe","title":"Federacion entre Nodos","description":"Comercio federado con otras ecoaldeas de la red usando TQ, respetando los limites bilaterales establecidos.","badge":"Permitido"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Lo Que Esta Prohibido",
    "subtitle": "Acciones que vulneran el proposito de la aldea y estan terminantemente prohibidas",
    "columns": 2,
    "items": [
      {"icon":"x-circle","title":"Agroquimicos y Transgenicos","description":"Esta estrictamente prohibido el ingreso, uso o almacenamiento de fertilizantes quimicos sinteticos, pesticidas industriales o semillas transgenicas patentadas.","badge":"Grave"},
      {"icon":"x-circle","title":"Venta de Tierra","description":"Ningun miembro puede vender su parcela o vivienda a un tercero en el mercado abierto. La tierra pertenece colectivamente a la comunidad organizada (Fideicomiso de la Tierra).","badge":"Grave"},
      {"icon":"x-circle","title":"Usura e Intereses","description":"Esta prohibido cobrar intereses sobre deudas, prestar con usura o negociar con divisas fiat de forma directa en transacciones internas eludiendo el sistema TQ.","badge":"Grave"},
      {"icon":"x-circle","title":"Acumular mas alla del limite","description":"Esta prohibido eludir el control de limites de saldo con intercambios informales fuera del sistema para acumular mas de lo permitido.","badge":"Grave"},
      {"icon":"x-circle","title":"Quema de plasticos","description":"Esta prohibida la quema de cualquier tipo de plastico o basura. Los empaques plasticos de un solo uso deben evitarse al maximo.","badge":"Leve"},
      {"icon":"x-circle","title":"Productos no biodegradables","description":"Esta prohibido el uso de productos de higiene personal o limpieza del hogar que contengan quimicos no biodegradables. La aldea provee jabones y detergentes ecologicos.","badge":"Leve"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Faltas y Sanciones",
    "subtitle": "Escala de infracciones y consecuencias",
    "columns": 3,
    "items": [
      {"icon":"alert-triangle","title":"Faltas Leves","description":"Faltar injustificadamente a asambleas, no cumplir de forma aislada con las horas de cayapa, o ruidos molestos fuera de horario. Sancion: amonestacion verbal y compromiso de compensar las horas perdidas en la siguiente cayapa.","badge":"Leves"},
      {"icon":"alert-octagon","title":"Faltas Graves","description":"Desperdicio consciente de agua comun, maltrato animal, comercio no autorizado usando dinero fiat dentro de la aldea para eludir el sistema TQ, o inactividad prolongada sin justificacion. Sancion: suspension temporal de la cuenta TQ y jornadas obligatorias de trabajo.","badge":"Graves"},
      {"icon":"ban","title":"Faltas Muy Graves","description":"Introduccion voluntaria de agroquimicos o transgenicos, agresion fisica o verbal grave, robo de bienes comunes, sabotaje a los sistemas comunes, o especulacion inmobiliaria. Causal de expulsion obligatoria.","badge":"Expulsion"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Proceso de Admision",
    "subtitle": "Como unirse a la aldea - camino de integracion en tres fases",
    "columns": 3,
    "items": [
      {"icon":"user-plus","title":"Fase 1: Aspirante (1-3 meses)","description":"La persona o familia vive en el area de visitantes. Participa diariamente en cayapas comunes y talleres de agroecologia. Tiene acceso limitado a la Tienda Comunitaria en TQ (cuenta de visitante con limite estricto). No puede construir.","badge":"1-3 meses"},
      {"icon":"user-check","title":"Fase 2: Residente Provisional (6-12 meses)","description":"Tras recibir el consentimiento de la comunidad, se le asigna un espacio temporal. Se integra a un circulo de trabajo. Puede proponer ideas (voz) pero no tiene voto en decisiones estructurales.","badge":"6-12 meses"},
      {"icon":"award","title":"Fase 3: Miembro Pleno","description":"Aprobado por consentimiento en el Circulo de Convivencia y refrendado en Asamblea General. Se firma el Acuerdo de Vida Conuquera, se le asigna parcela y conuco, y se abren los limites completos de TQ (-500/+500 simetricos).","badge":"Pleno"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Proceso de Salida y Restitucion",
    "subtitle": "Que pasa cuando un miembro se retira o es expulsado",
    "columns": 2,
    "items": [
      {"icon":"log-out","title":"Retiro Voluntario","description":"Un miembro puede retirarse voluntariamente comunicando su decision al Circulo de Convivencia. Se aplica la Formula de Restitucion No Especulativa (FRNE) para reembolsar su inversion en materiales.","badge":"Voluntario"},
      {"icon":"calculator","title":"Formula FRNE","description":"R_neto = I_ini - D_desgaste - C_restauracion +/- B_TQ - T_salida. I_ini = inversion en materiales, D_desgaste = amortizacion anual, C_restauracion = costo de reparar danos, B_TQ = balance TQ, T_salida = 15% de retencion solidaria para el Fondo Comunitario.","badge":"FRNE"},
      {"icon":"calendar","title":"Pago Diferido","description":"El reembolso se paga en cuotas mensuales distribuidas en 12-24 meses usando el Factor de Conversion vigente, o cuando una nueva familia tome posesion de la parcela. No se paga de inmediato para no desestabilizar la economia del nodo.","badge":"12-24 meses"},
      {"icon":"user-x","title":"Expulsion","description":"Si el Circulo de Armonia agota la mediacion y el miembro reincide en faltas graves o comete una falta muy grave, la Asamblea General decide por consentimiento la desincorporacion. El terreno y usufructo regresan inmediatamente al control comun.","badge":"Obligatoria"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Tenencia de la Tierra",
    "subtitle": "La tierra es colectiva, no especulativa",
    "columns": 3,
    "items": [
      {"icon":"map","title":"Fideicomiso Comunitario","description":"La tierra de la ecoaldea pertenece unica y exclusivamente a la comunidad organizada. Ningun miembro tiene titulo de propiedad individual sobre la tierra. Es indivisible e inalienable.","badge":"Colectiva"},
      {"icon":"key","title":"Derecho de Usufructo","description":"A cada miembro o familia admitida se le otorga un derecho de usufructo exclusivo sobre una parcela habitacional y su conuco. Este derecho dura mientras mantenga su membresia activa.","badge":"Usufructo"},
      {"icon":"lock","title":"Prohibicion de Venta","description":"Un habitante nunca puede vender su parcela o vivienda a un tercero en el mercado abierto. Si decide marcharse, el derecho de usufructo regresa a la Asamblea, que lo asigna a una nueva familia.","badge":"No venta"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Impuestos y Fondo Comunitario",
    "subtitle": "Como se financian los proyectos comunales",
    "columns": 3,
    "items": [
      {"icon":"percent","title":"Impuesto de Transaccion","description":"Cada transaccion en TQ tiene un porcentaje de impuesto definido por el nivel del miembro (ej: 1% para activos, 0% para instituciones publicas). El impuesto va al Fondo Comunitario.","badge":"1%"},
      {"icon":"piggy-bank","title":"Fondo Comunitario","description":"Cuenta especial que recibe los impuestos y se usa para proyectos comunales: infraestructura, equipos, emergencias. La distribucion de fondos la aprueba la Junta Directiva (decision operativa).","badge":"Fondo"},
      {"icon":"check-square","title":"Aprobacion de Gastos","description":"Los gastos del Fondo Comunitario los aprueba la Junta Directiva (mayoria simple). Los cambios a la tasa de impuesto requieren 2/3 de la Asamblea General. La Asamblea decide que decisiones delega a la junta.","badge":"Asamblea y Junta"}
    ]
  },
  {
    "type": "cta_banner",
    "title": "Quieres unirte a la aldea?",
    "subtitle": "Revisa el proceso de admision y envia tu solicitud. Te contactaremos para iniciar la Fase 1: Aspirante.",
    "button_text": "Solicitar Admision",
    "button_link": "/p/comunidad",
    "theme": "emerald"
  }
]`,
			Icon:      "scale",
			MenuOrder: 14,
		},
		{
			Slug:     "comercio-exterior",
			Title:    "Comercio Exterior",
			Subtitle: "Como Funciona el Intercambio con el Exterior",
			Content: `[
  {
    "type": "hero",
    "badge": "Comercio Externo",
    "title": "Comerciar con el Exterior sin Dinero Fiat",
    "description": "La aldea puede comprar y vender productos con el exterior usando el Factor de Conversion (FC), que relaciona el TQ con monedas externas (USD, EUR, COP, etc). El FC no es una tasa de cambio especulativa: se calcula comparando el costo de la canasta basica alla y aca.",
    "theme": "ocean"
  },
  {
    "type": "features_grid",
    "title": "Factor de Conversion (FC)",
    "subtitle": "Como se relaciona el TQ con monedas externas",
    "columns": 3,
    "items": [
      {"icon":"calculator","title":"Calculo desde Canasta Basica","description":"Se compara el costo de la misma canasta basica de alimentos alla (en su moneda) y aca (en TQ). FC = canasta_interna_TQ / canasta_externa. Ejemplo: si alla cuesta 300 USD y aca 500 TQ, entonces 1 USD = 1.67 TQ.","badge":"Metodo"},
      {"icon":"globe","title":"Moneda de Referencia","description":"Se puede elegir la moneda del pais con el que se comercia: USD, EUR, COP, MXN, ARS, etc. El FC se calcula para esa moneda especifica.","badge":"Multi-moneda"},
      {"icon":"lock","title":"Canasta Federada","description":"El costo de la canasta interna en TQ es el mismo en todos los nodos de la federacion. Solo se puede cambiar mediante una propuesta federada aprobada por consenso. Esto asegura que el TQ valga lo mismo en todas las aldeas.","badge":"Federado"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Quien Actualiza el FC",
    "subtitle": "La Asamblea decide quien puede actualizar el FC",
    "columns": 2,
    "items": [
      {"icon":"user","title":"Persona Autorizada","description":"En paises con economia inestable (ej: Venezuela), conviene asignar una persona que actualice el FC frecuentemente segun los precios reales del mercado.","badge":"Frecuente"},
      {"icon":"briefcase","title":"Junta Directiva","description":"La junta directiva puede actualizar el FC como decision operativa, sin necesidad de convocar asamblea.","badge":"Operativo"},
      {"icon":"users","title":"Solo por Asamblea","description":"En paises estables, la asamblea puede decidir que el FC solo se actualice por votacion de todos los miembros.","badge":"Estable"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Calculadora de Precios Externos",
    "subtitle": "Verifica si el FC esta bien calibrado",
    "columns": 1,
    "items": [
      {"icon":"table","title":"Tabla Comparativa","description":"El sistema muestra una tabla con todos los productos del nodo y su precio equivalente en moneda externa segun el FC actual. Es informativo: ayuda a comparar si el FC calculado desde la canasta basica esta cerca del precio real externo. Si los precios calculados estan muy diferentes de los reales, hay que recalcular el FC.","badge":"Informativo"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Operaciones de Comercio",
    "subtitle": "Importacion y exportacion con el exterior",
    "columns": 2,
    "items": [
      {"icon":"download","title":"Importacion","description":"Traer productos de fuera (sal, herramientas, medicinas, telas). Se paga en TQ, el sistema convierte al precio externo usando el FC. Incluye logistica e impuestos externos.","badge":"Importar"},
      {"icon":"upload","title":"Exportacion","description":"Vender productos al exterior (cafe, miel, textiles). Se recibe en TQ, el externo paga en su moneda. El sistema registra la operacion con el FC aplicado.","badge":"Exportar"}
    ]
  },
  {
    "type": "cta_banner",
    "title": "Quieres comerciar con el exterior?",
    "subtitle": "El sistema gestiona automaticamente la conversion de moneda. Solo necesitas configurar el FC y crear operaciones.",
    "button_text": "Ver Comercio Exterior",
    "button_link": "/app/external",
    "theme": "ocean"
  }
]`,
			Icon:      "globe",
			MenuOrder: 15,
		},
		{
			Slug:     "servicios-federados",
			Title:    "Servicios Federados",
			Subtitle: "Reemplaza Servicios Comerciales con Alternativas Autohospedadas",
			Content: `[
  {
    "type": "hero",
    "badge": "Soberania Digital",
    "title": "Servicios Autohospedados y Federados",
    "description": "La aldea puede instalar mas de 20 servicios que reemplazan plataformas comerciales: videos, redes sociales, almacenamiento, comunicacion, productividad y mas. Todo se hospeda en el servidor de la aldea, sin anuncios, sin vigilancia, sin empresas intermediarias.",
    "theme": "forest"
  },
  {
    "type": "features_grid",
    "title": "Redes Sociales Federadas",
    "subtitle": "Reemplaza las redes sociales comerciales",
    "columns": 3,
    "items": [
      {"icon":"video","title":"PeerTube","description":"Plataforma de videos. Reemplaza YouTube. Los videos se almacenan en el servidor de la aldea. Las aldeas federadas pueden ver videos entre ellas.","badge":"Reemplaza YouTube"},
      {"icon":"message-circle","title":"Mastodon","description":"Red social de mensajes cortos. Reemplaza Twitter/X. Cada aldea tiene su propio servidor. Sin anuncios, sin algoritmos.","badge":"Reemplaza Twitter"},
      {"icon":"image","title":"Pixelfed","description":"Red social de fotografias. Reemplaza Instagram. Sin filtros que alteran tu imagen, sin anuncios.","badge":"Reemplaza Instagram"},
      {"icon":"users","title":"Friendica","description":"Red social completa con perfiles, grupos, eventos. Reemplaza Facebook. Sin vender tus datos.","badge":"Reemplaza Facebook"},
      {"icon":"message-square","title":"Lemmy","description":"Plataforma de foros y discusiones. Reemplaza Reddit. La comunidad vota lo util de cada respuesta.","badge":"Reemplaza Reddit"},
      {"icon":"book-open","title":"BookWyrm","description":"Red social para amantes de libros. Reemplaza Goodreads. Sin que Amazon vigile tus lecturas.","badge":"Reemplaza Goodreads"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Comunicacion",
    "subtitle": "Reemplaza las apps de mensajeria y llamadas comerciales",
    "columns": 3,
    "items": [
      {"icon":"phone","title":"VoIP - Telefonía","description":"Sistema telefonico de la aldea. Llamadas internas gratis, llamadas al exterior via pasarela SIP. Cada miembro tiene su extension.","badge":"Telefonia"},
      {"icon":"message-circle","title":"Sylk Suite (Blink + SylkServer)","description":"Mensajeria, llamadas y videoconferencias federadas en una sola app. Cliente para Android, iOS, Windows, macOS, Linux y web. Colocas el dominio del nodo y se conecta automaticamente. Cifrado extremo a extremo. Federacion entre aldeas como correo electronico: usuario@aldea-a.com llama a amigo@aldea-b.com. Reemplaza WhatsApp + Zoom en uno.","badge":"Recomendado"},
      {"icon":"mail","title":"Mailu (Servidor de Correo Ligero)","description":"Servidor de correo 100% libre (MIT). Todo en uno: SMTP, IMAP, panel admin, webmail. Cada miembro tiene su correo @tu-dominio. Cuotas de espacio configurables por usuario. Federacion automatica con cualquier servidor del mundo. Solo 1-2 GB RAM. Ideal para hardware limitado.","badge":"Recomendado"},
      {"icon":"mail","title":"Mailcow (Servidor de Correo Completo)","description":"Suite completa con groupware: correo, calendario compartido, contactos CardDAV/CalDAV. Mas completo que Mailu pero requiere 3-4 GB RAM. Ideal para instalar en otro servidor o nodo con mas hardware. Incluye antispam, antivirus, SSL automatico.","badge":"Completo"},
      {"icon":"message-circle","title":"Delta Chat (Cliente de Chat por Correo)","description":"CLIENTE que se ve como WhatsApp pero envia mensajes via correo federado. Cifrado extremo a extremo. App para Android, iOS y escritorio. REQUIERE Mailu o Mailcow instalado en el nodo. Cada miembro instala la app, coloca su correo@tu-dominio y se conecta automaticamente. Federacion entre aldeas.","badge":"Chat federado"},
      {"icon":"mail","title":"SnappyMail (Webmail)","description":"Webmail rapido y moderno estilo Gmail. Leer y escribir correos desde el navegador sin instalar nada. Se conecta a Mailu o Mailcow. Adaptable a moviles.","badge":"Webmail"},
      {"icon":"mic","title":"Mumble","description":"Chat de voz para reuniones y coordinacion. Bajo consumo de ancho de banda. Ideal para conexiones lentas.","badge":"Voz"},
      {"icon":"cloud","title":"Nextcloud","description":"Almacenamiento y colaboracion. Reemplaza Google Drive, Dropbox. Archivos, calendarios, contactos, documentos compartidos.","badge":"Reemplaza GDrive"},
      {"icon":"message-square","title":"Matrix","description":"Mensajeria instantanea descentralizada. Reemplaza WhatsApp, Telegram. Mensajes cifrados de extremo a extremo.","badge":"Reemplaza WhatsApp"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Productividad y Multimedia",
    "subtitle": "Herramientas de trabajo y entretenimiento",
    "columns": 3,
    "items": [
      {"icon":"file-text","title":"MediaWiki","description":"Enciclopedia y documentacion colaborativa. Reemplaza Wikipedia privada. La aldea documenta su conocimiento.","badge":"Wiki"},
      {"icon":"film","title":"Jellyfin","description":"Servidor de medios. Reemplaza Netflix, Spotify. Peliculas, series, musica almacenadas en la aldea.","badge":"Reemplaza Netflix"},
      {"icon":"music","title":"Navidrome","description":"Servidor de musica. Reemplaza Spotify. Tu musica en tu servidor, sin anuncios, sin tracking.","badge":"Reemplaza Spotify"},
      {"icon":"git-branch","title":"Gitea","description":"Servidor Git. Reemplaza GitHub, GitLab. Repositorios de codigo y proyectos de la aldea.","badge":"Reemplaza GitHub"},
      {"icon":"graduation-cap","title":"BigBlueButton","description":"Aula virtual para clases y talleres. Reemplaza Zoom, Google Classroom. Pizarra compartida, grabacion.","badge":"Reemplaza Zoom"},
      {"icon":"home","title":"Home Assistant","description":"Automatizacion del hogar. Reemplaza Google Home, Alexa. Controla luces, sensores, energia solar. Todo local.","badge":"IoT local"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Como Funciona",
    "subtitle": "Instalacion y gestion de servicios",
    "columns": 2,
    "items": [
      {"icon":"server","title":"Instalacion con un Clic","description":"Cada servicio se instala con un clic desde el panel de administracion. El sistema genera el docker-compose.yml y las instrucciones. Solo necesitas un servidor con suficiente RAM y disco.","badge":"1 clic"},
      {"icon":"settings","title":"Gestion Centralizada","description":"Desde el panel puedes iniciar, detener, desinstalar y ver el estado de cada servicio. Tambien puedes descargar el docker-compose para instalarlo manualmente en otro servidor.","badge":"Gestion"},
      {"icon":"shield","title":"Sin Empresas Intermediarias","description":"Todos los servicios se hospedan en el servidor de la aldea. No hay anuncios, no hay recopilacion de datos, no hay empresas vigilando. Los datos pertenecen a la comunidad.","badge":"Soberano"},
      {"icon":"link","title":"Federacion entre Aldeas","description":"Los servicios que soportan ActivityPub (PeerTube, Mastodon, Pixelfed, Friendica, Lemmy, BookWyrm) pueden federarse con otras aldeas. El contenido se comparte entre nodos federados.","badge":"Federado"}
    ]
  },
  {
    "type": "cta_banner",
    "title": "Quieres instalar servicios?",
    "subtitle": "Accede al catalogo completo desde el panel de administracion.",
    "button_text": "Ver Catalogo",
    "button_link": "/app/services",
    "theme": "forest"
  }
]`,
			Icon:      "server",
			MenuOrder: 16,
		},
	}
}

// SeedPublicPages inserta las paginas del sitio publico con la plantilla
// modular rica. Si la pagina ya existe, actualiza el contenido pero
// preserva el titulo que el admin haya puesto.
func (d *DB) SeedPublicPages(ctx context.Context, nodeDomain string) error {
	pages := getSeedPages()

	for _, p := range pages {
		// Si la pagina existe, actualizar contenido pero preservar titulo.
		// Si no existe, insertar con todos los valores por defecto.
		_, err := d.Pool.Exec(ctx,
			`INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
			 ON CONFLICT (node_domain, slug) DO UPDATE SET
			   content = EXCLUDED.content,
			   subtitle = EXCLUDED.subtitle,
			   icon = EXCLUDED.icon,
			   is_published = true,
			   show_in_menu = true`,
			nodeDomain, p.Slug, p.Title, p.Subtitle, p.Content, p.Icon, p.MenuOrder)
		if err != nil {
			return fmt.Errorf("seeding page %s: %w", p.Slug, err)
		}
	}

	return nil
}

// SeedProductsToNode inserta los 8 productos Conuqueros directamente con el
// dominio del nodo. No usa 'default' ni copia de otro dominio.
// Si el nodo ya tiene productos, no hace nada.
// Si el dominio cambia, los productos se actualizan al nuevo dominio.
func (d *DB) SeedProductsToNode(ctx context.Context, nodeDomain string) error {
	if nodeDomain == "" {
		return fmt.Errorf("nodeDomain is empty")
	}

	// 1. Si el dominio cambio, actualizar todos los productos al nuevo dominio
	// Buscar productos system que no pertenecen a este dominio ni a 'default'
	var oldDomain string
	err := d.Pool.QueryRow(ctx, `
		SELECT node_domain FROM products
		WHERE is_system = true AND node_domain != $1 AND node_domain != 'default'
		LIMIT 1`, nodeDomain).Scan(&oldDomain)
	if err == nil && oldDomain != "" {
		// El dominio cambio: mover todos los productos al nuevo dominio
		_, err = d.Pool.Exec(ctx,
			`UPDATE products SET node_domain = $1 WHERE node_domain = $2`, nodeDomain, oldDomain)
		if err != nil {
			return fmt.Errorf("updating products to new domain: %w", err)
		}
		log.Printf("Updated products from domain '%s' to '%s'", oldDomain, nodeDomain)
	}

	// 2. Catalogo alineado a estandares internacionales de contabilidad energetica
	// Fuentes: ICE Database (Univ. Bath), Agribalyse (ADEME/INRAE), Ecoinvent, Pimentel
	// Estandar: 1 TQ = 1 kWh = 3.6 MJ (energia incorporada)
	// Trabajo manual agricola: 0.61 kWh/h | General: 1.0 kWh/h | Tecnico: 3.0 kWh/h
	products := []struct {
		name, parentCategory, category, subcategory, unit, description, badge, imageURL string
		price                                                                           int64
		energyDirect, energyHuman, energyInputs, energyAmort                            int64
	}{
		// ============ TRABAJO Y SERVICIOS (1 TQ = 1 kWh) ============
		// --- Trabajo Agricola (0.61 kWh/h metabolico) ---
		{"Jornal Agricola", "Servicios", "Trabajo Agricola", "Jornales", "hora",
			"Siembra, cosecha, limpieza, riego, desmalece. Consumo metabolico ~525 kcal/h = 0.61 kWh.", "Conuquero",
			"/images/products/servicios/jornal-agricola.jpg", 1, 0, 1, 0, 0},
		{"Jornada Agricola Completa", "Servicios", "Trabajo Agricola", "Jornadas", "jornada",
			"Jornada completa de trabajo manual agricola (8h x 0.61 kWh/h = 4.88 kWh).", "Conuquero",
			"/images/products/servicios/jornada-agricola.jpg", 5, 0, 5, 0, 0},
		// --- Trabajo General (1.0 kWh/h) ---
		{"Jornada de Trabajo General", "Servicios", "Trabajo General", "Jornadas", "jornada",
			"Jornada completa de trabajo general/servicios (8h x 1.0 kWh/h = 8 kWh). Limpieza, atencion, gestion.", "General",
			"/images/products/servicios/jornada-trabajo-general.jpg", 8, 0, 8, 0, 0},
		{"Limpieza de Espacios", "Servicios", "Limpieza", "General", "hora",
			"Limpieza de espacios comunes, casas, talleres, desinfeccion. Metabolismo basal + herramientas.", "Aseo",
			"/images/products/servicios/limpieza-espacios.jpg", 1, 0, 1, 0, 0},
		{"Trabajo Administrativo y Gestion", "Servicios", "Oficina", "Administrativo", "hora",
			"Contabilidad, gestion documental, tramites, redaccion. Trabajo general 1.0 kWh/h.", "Gestion",
			"/images/products/servicios/trabajo-administrativo.jpg", 1, 0, 1, 0, 0},
		// --- Trabajo Tecnico (3.0 kWh/h) ---
		{"Jornada de Trabajo Tecnico", "Servicios", "Trabajo Tecnico", "Jornadas", "jornada",
			"Jornada completa de trabajo tecnico especializado (8h x 3.0 kWh/h = 24 kWh). Mecanica, electricidad, plomeria.", "Tecnico",
			"/images/products/servicios/jornada-trabajo-tecnico.jpg", 24, 0, 24, 0, 0},
		{"Albanileria y Obra Menor", "Servicios", "Construccion", "Albanileria", "hora",
			"Mamposteria, repello, acabados, bahareque, adobe. Trabajo tecnico 3.0 kWh/h.", "Constructor",
			"/images/products/servicios/albanileria.jpg", 3, 0, 3, 0, 0},
		{"Carpinteria y Ebanisteria", "Servicios", "Construccion", "Carpinteria", "hora",
			"Puertas, ventanas, muebles a medida. Trabajo tecnico con herramientas electricas 3.0 kWh/h.", "Carpintero",
			"/images/products/servicios/carpinteria.jpg", 3, 0, 3, 0, 0},
		{"Mecanica General", "Servicios", "Reparaciones", "Mecanica", "hora",
			"Reparacion de motores, bicicletas, motos, maquinas agricolas. Trabajo tecnico 3.0 kWh/h.", "Mecanico",
			"/images/products/servicios/mecanica-general.jpg", 3, 0, 3, 0, 0},
		{"Electricidad y Electrotecnia", "Servicios", "Reparaciones", "Electricidad", "hora",
			"Instalaciones electricas, cableado, paneles solares. Trabajo tecnico 3.0 kWh/h.", "Electricista",
			"/images/products/servicios/electricidad.jpg", 3, 0, 3, 0, 0},
		{"Plomeria y Fontaneria", "Servicios", "Reparaciones", "Plomeria", "hora",
			"Reparacion de tuberias, filtros de agua, instalaciones sanitarias. Trabajo tecnico 3.0 kWh/h.", "Plomero",
			"/images/products/servicios/plomeria.jpg", 3, 0, 3, 0, 0},
		{"Reparacion de Computadoras", "Tecnologia", "Computacion", "Reparacion", "hora",
			"Reparacion de hardware, limpieza, cambio de piezas. Trabajo tecnico 3.0 kWh/h.", "Soporte Tecnico",
			"/images/products/tecnologia/reparacion-computadoras.jpg", 3, 0, 3, 0, 0},
		{"Reparacion de Electrodomesticos", "Tecnologia", "Electrodomesticos", "Reparacion", "hora",
			"Reparacion de neveras, licuadoras, cocinas, lavadoras. Trabajo tecnico 3.0 kWh/h.", "Reparacion",
			"/images/products/tecnologia/reparacion-electrodomesticos.jpg", 3, 0, 3, 0, 0},
		{"Reparacion de Telefonos", "Tecnologia", "Telefonos", "Reparacion", "hora",
			"Cambio de pantallas, baterias, cristales. Trabajo tecnico 3.0 kWh/h.", "Movil",
			"/images/products/tecnologia/reparacion-telefonos.jpg", 3, 0, 3, 0, 0},
		{"Mantenimiento de Sistemas Solares", "Energia", "Solar", "Mantenimiento", "hora",
			"Limpieza de paneles, revision de baterias, cableado. Trabajo tecnico 3.0 kWh/h.", "Mantencion",
			"/images/products/energia/mantenimiento-solar.jpg", 3, 0, 3, 0, 0},
		{"Mantenimiento de Vehiculos", "Transporte", "Vehiculos", "Mantenimiento", "hora",
			"Ajustes, lubricacion, cambio de aceites, frenos. Trabajo tecnico 3.0 kWh/h.", "Mantencion",
			"/images/products/transporte/mantenimiento-vehiculos.jpg", 3, 0, 3, 0, 0},
		{"Terapias Manuales y Alternativas", "Salud y Medicina", "Terapias", "Sesiones", "sesion",
			"Masaje terapeutico, acupuntura, reflexologia. Trabajo tecnico 3.0 kWh/h.", "Salud Integral",
			"/images/products/salud/terapias-manuales.jpg", 3, 0, 3, 0, 0},
		{"Consulta Medica y Odontologica", "Servicios", "Salud", "Consulta", "sesion",
			"Consulta medica general, odontologia basica, vacunacion. Trabajo tecnico 3.0 kWh/h.", "Atencion",
			"/images/products/salud/consulta-medica.jpg", 3, 0, 3, 0, 0},
		// --- Educacion (3.0 kWh/h trabajo tecnico) ---
		{"Clases y Tutorias", "Servicios", "Educacion", "Clases", "hora",
			"Alfabetizacion, matematicas, oficios, idiomas. Trabajo tecnico de instruccion 3.0 kWh/h.", "Ensenanza",
			"/images/products/servicios/clases-tutorias.jpg", 3, 0, 3, 0, 0},
		{"Clases de Musica", "Cultura", "Musica", "Clases", "hora",
			"Ensenanza de cuatro, guitarra, percusion, canto. Trabajo tecnico 3.0 kWh/h.", "Ensenanza",
			"/images/products/cultura/clases-musica.jpg", 3, 0, 3, 0, 0},
		{"Talleres de Oficios", "Educacion", "Talleres", "Oficios", "hora",
			"Carpinteria, costura, cocina, mecanica, electricidad. Trabajo tecnico 3.0 kWh/h.", "Aprender Haciendo",
			"/images/products/educacion/talleres-oficios.jpg", 3, 0, 3, 0, 0},
		{"Talleres de Agroecologia", "Educacion", "Talleres", "Agricultura", "hora",
			"Permacultura, agroecologia, huertos urbanos, compostaje. Trabajo tecnico 3.0 kWh/h.", "Conuco",
			"/images/products/educacion/talleres-agroecologia.jpg", 3, 0, 3, 0, 0},
		{"Talleres de Salud Comunitaria", "Educacion", "Talleres", "Salud", "hora",
			"Primeros auxilios, medicina natural, nutricion. Trabajo tecnico 3.0 kWh/h.", "Salud",
			"/images/products/educacion/talleres-salud.jpg", 3, 0, 3, 0, 0},
		{"Alfabetizacion y Educacion Basica", "Educacion", "Alfabetizacion", "Basica", "hora",
			"Lectura, escritura, matematicas basicas. Trabajo tecnico 3.0 kWh/h.", "Aprender",
			"/images/products/educacion/alfabetizacion.jpg", 3, 0, 3, 0, 0},
		{"Animacion y Cuentacuentos", "Cultura", "Eventos", "Animacion", "hora",
			"Animacion de fiestas, cuentacuentos, teatro comunitario. Trabajo tecnico 3.0 kWh/h.", "Fiesta",
			"/images/products/cultura/animacion-cuentacuentos.jpg", 3, 0, 3, 0, 0},
		// --- Transporte ---
		{"Transporte de Carga", "Servicios", "Transporte", "Carga", "viaje",
			"Transporte de mercancia con combustible fosil (~0.5L diesel = 5.8 kWh).", "Traslado",
			"/images/products/servicios/transporte-carga.jpg", 5, 5, 0, 0, 0},
		{"Pasaje de Personas", "Servicios", "Transporte", "Pasaje", "viaje",
			"Pasaje local en vehiculo compartido. ~1 kWh por viaje.", "Viaje",
			"/images/products/servicios/pasaje-personas.jpg", 1, 1, 0, 0, 0},
		{"Servicio de Arriero", "Transporte", "Animales", "Arriero", "jornada",
			"Jornada completa de arriero con animal de carga (8h tecnico + animal).", "A Caballo",
			"/images/products/transporte/servicio-arriero.jpg", 20, 0, 20, 0, 0},

		// ============ ALIMENTOS: Cosecha Fresca (local, farm-gate) ============
		{"Hojas Verdes y Aromaticas", "Alimentacion", "Cosecha Fresca", "Hojas Verdes", "manojo",
			"Lechuga, repollo, espinaca, acelga, cilantro, perejil, cebollin, apio, hierbabuena, toronjil. Energia: 3.6-7.2 MJ/kg = 1-2 kWh/kg (riego solar, compostaje, trabajo manual).", "Fresco del Dia",
			"/images/products/alimentacion/hojas-verdes.jpg", 2, 0, 0, 2, 0},
		{"Tuberculos Ancestrales y Platanos", "Alimentacion", "Cosecha Fresca", "Tuberculos", "kg",
			"Name morado, ocumo, yuca, auyama, cambur morado, platano. Tuberculos de conuco: ~5-7 MJ/kg = 1.5-2 kWh/kg.", "Rubro Olvidado",
			"/images/products/alimentacion/tuberculos.jpg", 2, 0, 0, 2, 0},
		{"Verduras y Hortalizas de Conuco", "Alimentacion", "Cosecha Fresca", "Verduras", "kg",
			"Tomate, pimenton, pepino, berenjena, zanahoria, remolacha, ajo, cebolla, ahuyama, calabacin. ~3.2-7.2 MJ/kg = 1-2 kWh/kg (cultivo local).", "Del Conuco",
			"/images/products/alimentacion/verduras-hortalizas.jpg", 2, 0, 0, 2, 0},
		{"Frutas de Temporada", "Alimentacion", "Cosecha Fresca", "Frutas", "kg",
			"Mango, papaya, guayaba, patilla, melon, pina, lechosa, cambur, limon, naranja, mandarina, aguacate. ~2.8 MJ/kg farm-gate = 0.8 kWh/kg + procesamiento local.", "De Estacion",
			"/images/products/alimentacion/frutas-temporada.jpg", 2, 0, 0, 2, 0},
		{"Raices y Bulbos", "Alimentacion", "Cosecha Fresca", "Raices", "kg",
			"Apio, name topi, mapuey, batata, borugo, rabano. Raices criollas de conuco, energia similar a tuberculos.", "Raices Criollas",
			"/images/products/alimentacion/raices-bulbos.jpg", 2, 0, 0, 2, 0},
		{"Frutos Secos y Mani", "Alimentacion", "Cosecha Fresca", "Frutos Secos", "kg",
			"Nueces, almendras, mani, cachuates, avellanas. Energia: 40.87 MJ/kg = 11.35 kWh/kg (cultivo + secado + descascarado). Fuente: Agribalyse.", "Seco",
			"/images/products/alimentacion/frutos-secos.jpg", 11, 0, 0, 11, 0},

		// ============ ALIMENTOS: Granos y Cereales (ciclo completo) ============
		{"Granos Basicos Criollos", "Alimentacion", "Granos y Cereales", "Granos", "kg",
			"Maiz criollo blanco y amarillo, cebada, avena, centeno. Energia: 31-37 MJ/kg = 9-10 kWh/kg (siembra, fertilizacion, cosecha, secado). Fuente: Agribalyse, USDA, Pimentel.", "Criollo",
			"/images/products/alimentacion/granos-basicos.jpg", 10, 0, 0, 10, 0},
		{"Arroz y Legumbres", "Alimentacion", "Granos y Cereales", "Arroz y Legumbres", "kg",
			"Arroz procesado, sorgo, caraota, frijol, quinchoncho, lentejas, garbanzos, habas. Energia: 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, Ecoinvent, FAO.", "Cereal",
			"/images/products/alimentacion/arroz-legumbres.jpg", 11, 0, 0, 11, 0},
		{"Harinas Integrales", "Alimentacion", "Granos y Cereales", "Harinas", "kg",
			"Harina de maiz, trigo integral, yuca (casabe), platano, quinoa. Energia del grano + molienda: ~36 MJ/kg = 10 kWh/kg.", "Base Criolla",
			"/images/products/alimentacion/harinas-integrales.jpg", 10, 0, 0, 10, 0},

		// ============ ALIMENTOS: Transformados ============
		{"Panaderia y Masas Caseras", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "kg",
			"Pan de maiz, trigo integral, arepas, cachapas, bollos, empanadas. Energia: 16-18 MJ/kg = 4.5-5 kWh/kg (molienda + amasado + horneado). Fuente: Agribalyse.", "Hecho en Casa",
			"/images/products/alimentacion/panaderia.jpg", 5, 5, 0, 0, 0},
		{"Dulces y Conservas Tradicionales", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "kg",
			"Dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo, encurtidos, salsas. Energia: 25-30 MJ/kg = 7-8 kWh/kg (cocccion + conservacion).", "Plato Patrimonial",
			"/images/products/alimentacion/dulces-conservas.jpg", 8, 8, 0, 0, 0},
		{"Lacteos Artesanales", "Alimentacion", "Gastronomia Artesanal", "Lacteos", "kg",
			"Queso fresco, de mano, guayanes, suero, cuajada, yogurt, mantequilla. Energia: 25-36 MJ/kg = 7-10 kWh/kg (10L leche/kg + fermentacion + frio). Fuente: Agribalyse.", "Pastoreo Libre",
			"/images/products/alimentacion/lacteos-artesanales.jpg", 8, 8, 0, 0, 0},
		{"Leche Fresca", "Alimentacion", "Carnes y Pescados", "Lacteos Frescos", "litro",
			"Leche fresca de vaca, cabra. Energia: 5-7 MJ/L = 1.5-1.7 kWh/L (forraje + ordeÃ±o + pasteurizacion). Fuente: Ecoinvent, JRC, USDA.", "Fresca",
			"/images/products/alimentacion/leche-fresca.jpg", 2, 0, 0, 2, 0},
		{"Cacao, Chocolate y Cafe", "Alimentacion", "Gastronomia Artesanal", "Cacao y Cafe", "kg",
			"Cacao fermentado de Barlovento/Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena. Energia: 80-90 MJ/kg = 22-25 kWh/kg (fermentacion + secado + torrefaccion).", "Origen Venezolano",
			"/images/products/alimentacion/cacao-chocolate-cafe.jpg", 25, 25, 0, 0, 0},
		{"Encurtidos y Salsas", "Alimentacion", "Gastronomia Artesanal", "Conservas", "frasco",
			"Encurtidos de vegetales, tomate enlatado, salsa picante, guasacaca, pesto. Energia: ~25 MJ/kg = 7 kWh/kg (cocccion + envasado).", "Conserva Viva",
			"/images/products/alimentacion/encurtidos-salsas.jpg", 8, 8, 0, 0, 0},

		// ============ ALIMENTOS: Endulzantes ============
		{"Miel Pura de Abejas", "Alimentacion", "Endulzantes", "Miel", "litro",
			"Miel multifleural de montana, bosque, azahar. Energia: ~35 MJ/L = 10 kWh/L (apicultura + extraccion + filtrado).", "Pura",
			"/images/products/alimentacion/miel-pura.jpg", 10, 0, 0, 10, 0},
		{"Papelon y Panela", "Alimentacion", "Endulzantes", "Panela", "kg",
			"Papelon en bloque, panela granulada, rapadura, melaza de cana. Energia: 53 MJ/kg = 14.8 kWh/kg (cultivo + refinacion). Fuente: Agribalyse.", "De Cana",
			"/images/products/alimentacion/papelon-panela.jpg", 15, 15, 0, 0, 0},

		// ============ ALIMENTOS: Carnes y Pescados ============
		{"Carnes de Pollo y Aves", "Alimentacion", "Carnes y Pescados", "Aves", "kg",
			"Pollo de patio, gallina, pato, conejo. Energia: 30 MJ/kg = 8.3 kWh/kg (conversion 4.2 kg pienso/kg carne). Fuente: Pimentel, Agribalyse.", "De Patio",
			"/images/products/alimentacion/carnes-pollo.jpg", 8, 0, 0, 8, 0},
		{"Carnes de Cerdo y Chivo", "Alimentacion", "Carnes y Pescados", "Cerdo y Chivo", "kg",
			"Cerdo criollo, chivo. Energia: 47.5 MJ/kg = 13.2 kWh/kg (conversion 10.7 kg pienso/kg + climatizacion). Fuente: USDA, Agribalyse.", "Criollo",
			"/images/products/alimentacion/carnes-cerdo-chivo.jpg", 13, 0, 0, 13, 0},
		{"Carnes de Vacuno", "Alimentacion", "Carnes y Pescados", "Vacuno", "kg",
			"Carne de res, vacuno pastoreado. Energia: 80-100 MJ/kg = 22-28 kWh/kg (conversion 31.7 kg forraje/kg). Fuente: Pimentel, Ecoinvent, Agribalyse.", "Pastoreo Libre",
			"/images/products/alimentacion/carnes-vacuno.jpg", 25, 0, 0, 25, 0},
		{"Pescados y Mariscos", "Alimentacion", "Carnes y Pescados", "Pescados", "kg",
			"Pescado fresco de rio, salado, carite, cazon, camarones. Energia: ~35 MJ/kg = 10 kWh/kg (captura + cadena de frio).", "Del Rio/Mar",
			"/images/products/alimentacion/pescados-mariscos.jpg", 10, 0, 0, 10, 0},
		// Huevos: 3 categorias segun sistema de produccion (corregido por migraciones 090-092)
		{"Huevos Comerciales (Jaula)", "Alimentacion", "Cosecha Fresca", "Huevos", "docena",
			"Huevos de gallinas criadas en jaula (produccion comercial masiva). Sistema mas barato. Precio de referencia para comparar con precios reales del mercado y validar la canasta basica. Una docena pesa ~0.65 kg. Precio por docena: 3 TQ.", "Comercial",
			"", 3, 0, 0, 6, 0},
		{"Huevos Criollos (Semilibres)", "Alimentacion", "Cosecha Fresca", "Huevos", "docena",
			"Huevos de gallinas criollas semilibres. Gallinas que caminan en corral o patio, comen del suelo + maiz/legumbres. Energia total: ~33 MJ/kg = 9.23 kWh/kg. Precio base: 9.23 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 9.23 x 0.65 = 6.00 TQ.", "Criollo",
			"", 6, 0, 0, 9, 0},
		{"Huevos de Gallinas Felices (Pastoreo)", "Alimentacion", "Cosecha Fresca", "Huevos", "docena",
			"Huevos de gallinas felices en pastoreo rotativo libre. Gallinas con acceso total al exterior, pastoreo organico, sin jaula ni confinamiento. Energia total: ~44 MJ/kg = 12.31 kWh/kg. Precio base: 12.31 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 12.31 x 0.65 = 8.00 TQ.", "Gallina Feliz",
			"", 8, 0, 0, 12, 0},

		// ============ ALIMENTOS: Bebidas y Condimentos ============
		{"Bebidas Fermentadas", "Alimentacion", "Bebidas", "Fermentadas", "litro",
			"Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha. Energia: ~18 MJ/L = 5 kWh/L (fermentacion natural).", "Fermentacion Natural",
			"/images/products/alimentacion/bebidas-fermentadas.jpg", 5, 5, 0, 0, 0},
		{"Infusiones y Tes", "Alimentacion", "Bebidas", "Infusiones", "kg",
			"Te de hierbas, manzanilla, anis, tilo, boldo, hierbabuena seca. Energia: ~10 MJ/kg = 3 kWh/kg (secado + empaque).", "Botica Natural",
			"/images/products/alimentacion/infusiones-tes.jpg", 3, 3, 0, 0, 0},
		{"Zumos y Jugos Naturales", "Alimentacion", "Bebidas", "Zumos", "litro",
			"Jugos de frutas naturales exprimidos: naranja, limon, mango, guayaba, parchita, piña. Energia: ~4 MJ/L = 1.1 kWh/L (extraccion + empaque).", "Fresco Natural",
			"/images/products/alimentacion/zumos-jugos.jpg", 2, 2, 0, 0, 0},
		{"Refrescos Efervescentes", "Alimentacion", "Bebidas", "Refrescos", "litro",
			"Bebidas efervescentes artesanales: ginger beer, limonada con gas, refrescos de frutas con carbonatacion natural. Energia: ~6 MJ/L = 1.7 kWh/L.", "Efervescente",
			"/images/products/alimentacion/refrescos.jpg", 2, 2, 0, 0, 0},
		{"Licores y Destilados", "Alimentacion", "Bebidas", "Licores", "litro",
			"Licores artesanales: aguardiente de cana, ron artesanal, licores de frutas (guaro, cocuy). Energia: ~50 MJ/L = 14 kWh/L (destilacion + fermentacion).", "Destilado Artesanal",
			"/images/products/alimentacion/licores-destilados.jpg", 14, 14, 0, 0, 0},
		{"Bebidas Lacteas", "Alimentacion", "Bebidas", "Lacteas", "litro",
			"Leche fresca, suero, yogurt liquido, kefir de leche. Energia: ~6 MJ/L = 1.7 kWh/L (ordeño + procesamiento).", "Lacteo Fresco",
			"/images/products/alimentacion/bebidas-lacteas.jpg", 2, 2, 0, 0, 0},
		{"Aguas y Bebidas Hidratantes", "Alimentacion", "Bebidas", "Aguas", "litro",
			"Agua de coco, agua de cebada, horchata, agua de panela, bebidas isotonicas naturales. Energia: ~3 MJ/L = 0.8 kWh/L.", "Hidratante Natural",
			"/images/products/alimentacion/aguas-hidratantes.jpg", 1, 1, 0, 0, 0},
		{"Especias y Condimentos", "Alimentacion", "Condimentos", "Especias", "kg",
			"Comino, oregano, pimienta, aji dulce/picante, onoto, cilantro seco, laurel. Energia: ~53 MJ/kg = 15 kWh/kg (secado + molienda).", "Sazon Criolla",
			"/images/products/alimentacion/especias-condimentos.jpg", 15, 15, 0, 0, 0},
		{"Aceites y Vinagres", "Alimentacion", "Condimentos", "Aceites", "litro",
			"Aceite de coco, ajonjoli, palma, vinagre de cana. Energia: 35-40 MJ/L = 9.7-11.1 kWh/L (prensado, extraccion, refinado). Fuente: Agribalyse, Ecoinvent.", "Prensado en Frio",
			"/images/products/alimentacion/aceites-vinagres.jpg", 10, 10, 0, 0, 0},

		// ============ ALIMENTOS: Canasta Basica (contenido exacto especificado) ============
		{"Canasta Basica Familiar Semanal", "Alimentacion", "Canasta Basica", "Semanal", "canasta",
			"Canasta semanal para familia 4-5 personas. Contenido exacto: 3kg granos basicos (maiz, frijol, arroz), 2kg verduras frescas (tomate, cebolla, pimenton), 1kg frutas de temporada, 0.5kg carne de pollo, 1L leche fresca, 0.5L aceite vegetal, 0.5kg panela/azucar, 1 docena huevos, 100g especias (sal, comino, ajo). Energia total estimada: 3x10 + 2x2 + 1x2 + 0.5x8 + 1x2 + 0.5x10 + 0.5x15 + 1x10 + 1 = 65.5 TQ. Precio redondeado: 66 TQ.", "Necesidad Vital",
			"/images/products/alimentacion/canasta-basica.jpg", 66, 0, 0, 66, 0},

		// ============ AGRICULTURA ============
		{"Plantulas Medicinales y Aromaticas", "Agricultura", "Semillas y Plantulas", "Plantulas Medicinales", "maceta",
			"Poleo, estevia, malojillo, romero, ruda, oregano, sabila, llanten, calendula. Energia: ~3.6 MJ/maceta = 1 kWh (propagacion + sustrato).", "Para tu Huerto",
			"/images/products/agricultura/plantulas-medicinales.jpg", 1, 0, 0, 1, 0},
		{"Semillas Criollas Adaptadas", "Agricultura", "Semillas y Plantulas", "Semillas", "sobre",
			"Semillas de maiz, frijol, caraota, ahuyama, tomate, pimenton, lechuga, cilantro. Energia: ~3.6 MJ/sobre = 1 kWh (seleccion + secado).", "Semilla Nativa",
			"/images/products/agricultura/semillas-criollas.jpg", 1, 0, 0, 1, 0},
		{"Estacas y Esquejes", "Agricultura", "Semillas y Plantulas", "Estacas", "unidad",
			"Estacas de yuca, platano, frutales (mango, aguacate, citricos), mora, parchita. Energia: ~3.6 MJ/unidad = 1 kWh.", "Propagacion",
			"/images/products/agricultura/estacas-esquejes.jpg", 1, 0, 0, 1, 0},
		{"Abonos Organicos", "Agricultura", "Insumos Agricolas", "Abonos", "saco",
			"Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza. Energia: ~5-7 MJ/kg = 1.5-2 kWh/kg.", "Fertilidad Natural",
			"/images/products/agricultura/abonos-organicos.jpg", 2, 0, 0, 2, 0},
		{"Bioinsumos y Preparados", "Agricultura", "Insumos Agricolas", "Bioinsumos", "litro",
			"Biofertilizantes, biopreparados fungicos, te de compost, purines, microorganismos eficientes. Energia: ~10 MJ/L = 3 kWh/L.", "Agroecologia",
			"/images/products/agricultura/bioinsumos.jpg", 3, 3, 0, 0, 0},
		{"Tierra Fertil y Sustratos", "Agricultura", "Tierra y Compost", "Sustratos", "saco",
			"Tierra preparada, sustrato para semilleros, turba, arena de rio. Energia: ~3.6 MJ/saco = 1 kWh.", "Tierra Viva",
			"/images/products/agricultura/tierra-fertil.jpg", 1, 0, 0, 1, 0},
		// ============ AGRICULTURA: Riego (componentes individuales) ============
		{"Manguera de Riego PVC 1m", "Agricultura", "Riego", "Tuberias", "metro",
			"Manguera de PVC de 1 metro para riego. Energia: PVC 10.6 MJ/kg x ~0.3kg/m = 3.2 MJ = 0.9 TQ. Fuente: ICE Database.", "Riego",
			"/images/products/agricultura/manguera-riego.jpg", 1, 0, 0, 1, 0},
		{"Aspersor de Riego", "Agricultura", "Riego", "Aspersores", "unidad",
			"Aspersor de plastico para riego por aspersion. Energia: PVC ~0.1kg = 1 MJ = 0.3 TQ + manufactura. Fuente: ICE Database.", "Riego",
			"/images/products/agricultura/aspersor-riego.jpg", 1, 0, 0, 1, 0},
		{"Gotero de Riego", "Agricultura", "Riego", "Goteros", "unidad",
			"Gotero individual para riego por goteo. Energia: plastico ~0.02kg = 0.2 MJ = 0.06 TQ + manufactura. Fuente: ICE Database.", "Riego",
			"/images/products/agricultura/gotero-riego.jpg", 1, 0, 0, 1, 0},
		{"Bomba Manual de Agua", "Agricultura", "Riego", "Bombas", "unidad",
			"Bomba manual de agua para extraer de pozo o tanque. Energia: acero ~2kg x 20 MJ/kg + PVC = 43 MJ = 12 TQ. Fuente: ICE Database.", "Riego",
			"/images/products/agricultura/bomba-manual-agua.jpg", 12, 0, 0, 12, 0},
		{"Tanque de Agua 200L", "Agricultura", "Riego", "Tanques", "unidad",
			"Tanque de agua plastico HDPE 200 litros. Energia: HDPE ~5kg x 52.5 MJ/kg = 262 MJ = 73 TQ. Fuente: ICE Database, Ecoinvent.", "Almacenamiento",
			"/images/products/agricultura/tanque-agua-200l.jpg", 73, 0, 0, 73, 0},
		{"Tanque de Agua 1000L", "Agricultura", "Riego", "Tanques", "unidad",
			"Tanque de agua plastico HDPE 1000 litros. Energia: HDPE ~25kg x 52.5 MJ/kg = 1313 MJ = 365 TQ. Fuente: ICE Database, Ecoinvent.", "Almacenamiento",
			"/images/products/agricultura/tanque-agua-1000l.jpg", 365, 0, 0, 365, 0},

		// ============ SALUD Y MEDICINA ============
		{"Tinturas Madres y Botica Conuquera", "Salud y Medicina", "Medicina Botanica", "Tinturas", "frasco",
			"Extractos de propoleo, tinturas de moringa, curcuma, jengibre, pomadas de arnica, jarabes. Energia: ~28 MJ/frasco = 8 kWh (extraccion + alcohol).", "100% Puro",
			"/images/products/salud/tinturas-madres.jpg", 8, 8, 0, 0, 0},
		{"Cosmetica Natural sin Quimicos", "Salud y Medicina", "Medicina Botanica", "Cosmetica", "unidad",
			"Desodorantes de coco, balsamos labiales de cera de abeja, jabones artesanales, cremas de calendula. Energia: ~18 MJ/unidad = 5 kWh.", "Residuo Cero",
			"/images/products/salud/cosmetica-natural.jpg", 5, 5, 0, 0, 0},
		{"Hierbas Medicinales Secas", "Salud y Medicina", "Medicina Botanica", "Hierbas Secas", "kg",
			"Manzanilla, toronjil, valeriana, eucalipto, llanten, malojillo, sauco, tila. Energia: ~10 MJ/kg = 3 kWh/kg (secado al sol).", "Secado al Sol",
			"/images/products/salud/hierbas-medicinales-secas.jpg", 3, 3, 0, 0, 0},
		{"Jabones y Productos de Higiene", "Salud y Medicina", "Higiene", "Jabones", "unidad",
			"Jabon de lavar, jabon corporal natural, champu solido, dentifrico natural. Energia: ~10 MJ/unidad = 3 kWh (saponificacion).", "Limpieza Natural",
			"/images/products/salud/jabones-higiene.jpg", 3, 3, 0, 0, 0},
		{"Detergentes y Suavizantes Naturales", "Salud y Medicina", "Higiene", "Detergentes", "litro",
			"Detergente biodegradable, suavizante, limpiador multiusos, desinfectante natural. Energia: ~18 MJ/L = 5 kWh.", "Eco Limpieza",
			"/images/products/salud/detergentes-naturales.jpg", 5, 5, 0, 0, 0},
		// ============ SALUD: Primeros Auxilios (componentes individuales) ============
		{"Vendas y Gasas (Paquete)", "Salud y Medicina", "Primeros Auxilios", "Vendas", "paquete",
			"Paquete de vendas y gasas esteriles de algodon. Energia: algodon ~0.2kg x 50 MJ/kg = 10 MJ = 3 TQ. Fuente: Ecoinvent.", "Curacion",
			"/images/products/salud/vendas-gasas.jpg", 3, 0, 0, 3, 0},
		{"Alcohol Medicinal 1L", "Salud y Medicina", "Primeros Auxilios", "Desinfectantes", "litro",
			"Alcohol etilico medicinal 70% en frasco de 1 litro. Energia: destilacion + empaque ~3.6 MJ = 1 TQ.", "Desinfeccion",
			"/images/products/salud/alcohol-medicinal.jpg", 1, 1, 0, 0, 0},
		{"Yodo (Frasco 30ml)", "Salud y Medicina", "Primeros Auxilios", "Antisepticos", "frasco",
			"Frasco de yodo antiseptico 30ml. Energia: extraccion + empaque ~1 TQ.", "Antiseptico",
			"/images/products/salud/yodo.jpg", 1, 1, 0, 0, 0},
		{"Tijeras de Primeros Auxilios", "Salud y Medicina", "Primeros Auxilios", "Instrumentos", "unidad",
			"Tijeras de acero para cortar vendas. Energia: acero ~0.1kg x 35 MJ/kg = 3.5 MJ = 1 TQ + manufactura. Fuente: ICE Database.", "Instrumental",
			"/images/products/salud/tijeras-auxilios.jpg", 2, 0, 0, 2, 0},
		{"Apositos y Tiritas (Caja)", "Salud y Medicina", "Primeros Auxilios", "Apositos", "caja",
			"Caja de apositos y tiritas adhesivas. Energia: plastico + algodon + adhesivo ~1 TQ.", "Curacion",
			"/images/products/salud/apositos-tiritas.jpg", 1, 0, 0, 1, 0},

		// ============ TEXTILES ============
		// ============ TEXTILES: materias primas por kg + productos especificos ============
		{"Tela de Algodon Cruda (kg)", "Textiles", "Tejidos", "Materia Prima", "kg",
			"Tela de algodon cruda sin teñir para confeccion. Precio por kg. Energia: 143 MJ/kg = 39.7 TQ/kg (cultivo + hilado + tejido). Fuente: ICE Database, Ecoinvent.", "Materia Prima",
			"/images/products/textiles/tela-algodon.jpg", 40, 0, 0, 40, 0},
		{"Lana Cruda para Tejer (kg)", "Textiles", "Hilos y Materiales", "Materia Prima", "kg",
			"Lana de oveja cruda lavada para tejer. Precio por kg. Energia: ~67.5 MJ/kg = 18.75 TQ/kg (crianza + esquila + lavado). Fuente: ICE Database.", "Materia Prima",
			"/images/products/textiles/lana-cruda.jpg", 19, 0, 0, 19, 0},
		{"Hilo de Algodon (rollo 100g)", "Textiles", "Hilos y Materiales", "Hilos", "rollo",
			"Rollo de hilo de algodon de 100g para coser o tejer. Energia: 143 MJ/kg x 0.1kg = 14.3 MJ = 4 TQ. Fuente: ICE Database.", "Materia Prima",
			"/images/products/textiles/hilo-algodon.jpg", 4, 0, 0, 4, 0},
		// --- Productos especificos con peso definido ---
		{"Camisa de Algodon Artesanal (0.3 kg)", "Textiles", "Confeccion", "Prendas", "unidad",
			"Camisa de algodon artesanal, 0.3 kg de tela. Energia: tela 0.3kg x 143 MJ/kg + trabajo 4h = 55 MJ = 15 TQ. Precio: 16 TQ.", "Hecho a Mano",
			"/images/products/textiles/camisa-algodon.jpg", 16, 0, 0, 16, 0},
		{"Pantalon de Algodon Artesanal (0.5 kg)", "Textiles", "Confeccion", "Prendas", "unidad",
			"Pantalon de algodon artesanal, 0.5 kg de tela. Energia: tela 0.5kg x 143 MJ/kg + trabajo 5h = 87 MJ = 24 TQ. Precio: 25 TQ.", "Hecho a Mano",
			"/images/products/textiles/pantalon-algodon.jpg", 25, 0, 0, 25, 0},
		{"Frazada de Lana Artesanal (1.5 kg)", "Textiles", "Tejidos", "Cobijas", "unidad",
			"Frazada de lana tejida a mano, 1.5 kg. Energia: lana 1.5kg x 67.5 MJ/kg + trabajo 8h = 132 MJ = 37 TQ. Precio: 37 TQ.", "Calor Artesanal",
			"/images/products/textiles/frazada-lana.jpg", 37, 0, 0, 37, 0},
		{"Hamaca de Cañamo (1.2 kg)", "Textiles", "Tejidos", "Cobijas", "unidad",
			"Hamaca de fibra de cañamo tejida a mano, 1.2 kg. Energia: fibra 1.2kg x 143 MJ/kg + trabajo 10h = 292 MJ = 81 TQ. Precio: 30 TQ (ajuste comunitario por fibra local).", "Descanso",
			"/images/products/textiles/hamoca-canamo.jpg", 30, 0, 0, 30, 0},
		{"Reparacion y Adaptacion de Prendas", "Textiles", "Confeccion", "Reparaciones", "prenda",
			"Parches, costuras, ajustes, dobladillos, cremalleras. Energia: ~5h trabajo general = 5 kWh.", "Reutilizar",
			"/images/products/textiles/reparacion-prendas.jpg", 5, 5, 0, 0, 0},
		// --- Trabajo textil por hora ---
		{"Trabajo de Costura (hora)", "Textiles", "Confeccion", "Trabajo", "hora",
			"Trabajo artesanal de costura y confeccion por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"/images/products/textiles/trabajo-costura.jpg", 1, 1, 0, 0, 0},

		// ============ ARTESANIA: materias primas por kg + productos especificos ============
		// --- Materia prima por kg ---
		{"Arcilla para Ceramica (cruda)", "Artesania", "Ceramica", "Materia Prima", "kg",
			"Arcilla cruda para alfareria y ceramica. Precio por kg de material. Energia: 2.5 MJ/kg = 0.7 TQ/kg (extraccion + preparacion). Fuente: ICE Database, University of Bath.", "Materia Prima",
			"/images/products/artesania/arcilla-ceramica.jpg", 1, 0, 0, 1, 0},
		{"Madera Blanda para Tallado", "Artesania", "Madera", "Materia Prima", "kg",
			"Madera blanda secada al aire para tallado artesanal (cedro, ceiba, saman). Precio por kg. Energia: 0.3 MJ/kg = 0.08 TQ/kg (tala + aserrado + secado natural). Fuente: ICE Database.", "Materia Prima",
			"/images/products/artesania/madera-blanda.jpg", 1, 0, 0, 1, 0},
		{"Madera Dura para Muebles", "Artesania", "Madera", "Materia Prima", "kg",
			"Madera dura secada al horno para muebles (roble, caoba, apamate). Precio por kg. Energia: 2.0 MJ/kg = 0.56 TQ/kg (tala + aserrado + secado horno). Fuente: ICE Database.", "Materia Prima",
			"/images/products/artesania/madera-dura.jpg", 1, 0, 0, 1, 0},
		{"Fibra Vegetal para Cesteria", "Artesania", "Cesteria", "Materia Prima", "kg",
			"Fibra vegetal seca para cesteria (mimbre, paja, caña brava, coco). Precio por kg. Energia: ~0.5 MJ/kg = 0.14 TQ/kg (recoleccion + secado solar). Estimacion comunitaria.", "Materia Prima",
			"/images/products/artesania/fibra-vegetal.jpg", 1, 0, 0, 1, 0},
		// --- Ceramica: productos especificos con peso ---
		{"Taza de Barro (0.3 kg)", "Artesania", "Ceramica", "Vajilla", "unidad",
			"Taza de barro artesanal de 0.3 kg. Energia: arcilla 0.3kg x 2.5 MJ/kg + coccion 3.6 MJ + trabajo 1h = 5.35 MJ = 1.5 TQ. Precio: 2 TQ.", "Barro Artesanal",
			"/images/products/artesania/taza-barro.jpg", 2, 2, 0, 0, 0},
		{"Plato de Barro (0.5 kg)", "Artesania", "Ceramica", "Vajilla", "unidad",
			"Plato de barro artesanal de 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.", "Barro Artesanal",
			"/images/products/artesania/plato-barro.jpg", 3, 3, 0, 0, 0},
		{"Olla de Barro (2 kg)", "Artesania", "Ceramica", "Vasijas", "unidad",
			"Olla de barro artesanal de 2 kg para cocina. Energia: arcilla 2kg x 2.5 MJ/kg + coccion 18 MJ + trabajo 3h = 27 MJ = 7.5 TQ. Precio: 8 TQ.", "Barro Artesanal",
			"/images/products/artesania/olla-barro.jpg", 8, 8, 0, 0, 0},
		{"Cantarola de Barro (5 kg)", "Artesania", "Ceramica", "Vasijas", "unidad",
			"Cantarola de barro artesanal de 5 kg para almacenar agua. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 5h = 53.5 MJ = 15 TQ. Precio: 15 TQ.", "Barro Artesanal",
			"/images/products/artesania/cantarola-barro.jpg", 15, 15, 0, 0, 0},
		{"Maceta de Arcilla Pequena (0.5 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa pequena 10cm diametro, 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.", "Maceta",
			"/images/products/artesania/maceta-arcilla-pequena.jpg", 3, 3, 0, 0, 0},
		{"Maceta de Arcilla Mediana (2 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa mediana 20cm diametro, 2 kg. Energia: arcilla 2kg x 2.5 MJ/kg + coccion 18 MJ + trabajo 2h = 27 MJ = 7.5 TQ. Precio: 8 TQ.", "Maceta",
			"/images/products/artesania/maceta-arcilla-mediana.jpg", 8, 8, 0, 0, 0},
		{"Maceta de Arcilla Grande (5 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa grande 35cm diametro, 5 kg. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 3h = 53.5 MJ = 15 TQ. Precio: 15 TQ.", "Maceta",
			"/images/products/artesania/maceta-arcilla-grande.jpg", 15, 15, 0, 0, 0},
		// --- Madera: productos especificos con peso ---
		{"Cuchara de Palo (0.1 kg)", "Artesania", "Madera", "Utensilios", "unidad",
			"Cuchara de palo tallado a mano, 0.1 kg. Energia: madera 0.1kg x 0.3 MJ/kg + trabajo 1h = 3.6 MJ = 1 TQ. Precio: 1 TQ.", "Madera Noble",
			"/images/products/artesania/cuchara-palo.jpg", 1, 1, 0, 0, 0},
		{"Mortero de Madera (1 kg)", "Artesania", "Madera", "Utensilios", "unidad",
			"Mortero de madera tallado a mano, 1 kg. Energia: madera 1kg x 0.3 MJ/kg + trabajo 3h = 11 MJ = 3 TQ. Precio: 3 TQ.", "Madera Noble",
			"/images/products/artesania/mortero-madera.jpg", 3, 3, 0, 0, 0},
		{"Silla Rustica de Madera (8 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Silla rustica de madera dura, 8 kg. Energia: madera 8kg x 2.0 MJ/kg + trabajo 6h = 38 MJ = 10.5 TQ. Precio: 11 TQ.", "Muebleria Artesanal",
			"/images/products/artesania/silla-madera.jpg", 11, 0, 0, 11, 0},
		{"Mesa Rustica de Madera (20 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Mesa rustica de madera dura, 20 kg. Energia: madera 20kg x 2.0 MJ/kg + trabajo 10h = 82 MJ = 23 TQ. Precio: 23 TQ.", "Muebleria Artesanal",
			"/images/products/artesania/mesa-madera.jpg", 23, 0, 0, 23, 0},
		{"Banco Rustico de Madera (12 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Banco rustico de madera dura, 12 kg. Energia: madera 12kg x 2.0 MJ/kg + trabajo 5h = 51 MJ = 14 TQ. Precio: 14 TQ.", "Muebleria Artesanal",
			"/images/products/artesania/banco-madera.jpg", 14, 0, 0, 14, 0},
		{"Cama Rustica de Madera (35 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Cama rustica de madera dura, 35 kg. Energia: madera 35kg x 2.0 MJ/kg + trabajo 12h = 127 MJ = 35 TQ. Precio: 35 TQ.", "Muebleria Artesanal",
			"/images/products/artesania/cama-madera.jpg", 35, 0, 0, 35, 0},
		// --- Cesteria: productos especificos con peso ---
		{"Canasto Pequeno (0.3 kg)", "Artesania", "Cesteria", "Canastas", "unidad",
			"Canasto pequeno de fibra vegetal tejido a mano, 0.3 kg. Energia: fibra 0.3kg x 0.5 MJ/kg + trabajo 2h = 7 MJ = 2 TQ. Precio: 2 TQ.", "Fibra Vegetal",
			"/images/products/artesania/canasto-pequeno.jpg", 2, 2, 0, 0, 0},
		{"Cesta Mediana (1 kg)", "Artesania", "Cesteria", "Canastas", "unidad",
			"Cesta mediana de fibra vegetal tejida a mano, 1 kg. Energia: fibra 1kg x 0.5 MJ/kg + trabajo 4h = 14.5 MJ = 4 TQ. Precio: 4 TQ.", "Fibra Vegetal",
			"/images/products/artesania/cesta-mediana.jpg", 4, 4, 0, 0, 0},
		{"Sombrero de Paja (0.2 kg)", "Artesania", "Cesteria", "Sombreros", "unidad",
			"Sombrero de paja tejido a mano, 0.2 kg. Energia: fibra 0.2kg x 0.5 MJ/kg + trabajo 5h = 18 MJ = 5 TQ. Precio: 5 TQ.", "Fibra Vegetal",
			"/images/products/artesania/sombrero-paja.jpg", 5, 5, 0, 0, 0},
		// --- Trabajo artesanal por hora ---
		{"Trabajo de Alfareria (hora)", "Artesania", "Ceramica", "Trabajo", "hora",
			"Trabajo artesanal de alfareria y ceramica por hora. Incluye modelado, esmaltado y control de horno. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"/images/products/artesania/trabajo-alfareria.jpg", 1, 1, 0, 0, 0},
		{"Trabajo de Carpinteria (hora)", "Artesania", "Madera", "Trabajo", "hora",
			"Trabajo artesanal de carpinteria y tallado de madera por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"/images/products/artesania/trabajo-carpinteria.jpg", 1, 1, 0, 0, 0},
		{"Trabajo de Cesteria (hora)", "Artesania", "Cesteria", "Trabajo", "hora",
			"Trabajo artesanal de cesteria y tejido de fibra vegetal por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"/images/products/artesania/trabajo-cesteria.jpg", 1, 1, 0, 0, 0},
		{"Coccion de Ceramica en Horno (carga)", "Artesania", "Ceramica", "Trabajo", "carga",
			"Coccion de una carga de horno ceramico (incluye leña o gas). Energia: ~18 MJ/kg de arcilla cocida = 5 TQ/kg. Una carga tipica cuece 10-20 piezas.", "Coccion",
			"/images/products/artesania/coccion-ceramica.jpg", 5, 5, 0, 0, 0},

		// ============ CONSTRUCCION: Materiales ============
		{"Bloques, Adobe y Bahareque", "Construccion", "Materiales", "Adobe", "unidad",
			"Bloques de tierra comprimida, adobes, bahareque. Energia: 1.8-3.6 MJ/unidad = 0.5-1 kWh (mezcla + prensado + secado solar). Fuente: ICE Database.", "Construccion Natural",
			"/images/products/construccion/bloques-adobe.jpg", 1, 1, 0, 0, 0},
		{"Madera de Construccion", "Construccion", "Materiales", "Madera", "kg",
			"Madera aserrada, vigas, tablas, listones. Energia: 8.5 MJ/kg = 2.36 kWh/kg (tala + aserrado + secado). Fuente: ICE Database.", "Estructura",
			"/images/products/construccion/madera-construccion.jpg", 3, 0, 0, 3, 0},
		{"Piedra y Agregados", "Construccion", "Materiales", "Piedra", "kg",
			"Piedra de rio, grava, arena, cascajo. Energia: 0.083 MJ/kg = 0.023 kWh/kg (extraccion + clasificacion). Fuente: ICE Database.", "Base Solida",
			"/images/products/construccion/piedra-agregados.jpg", 1, 1, 0, 0, 0},
		{"Hormigon Estructural", "Construccion", "Materiales", "Hormigon", "kg",
			"Hormigon M20 (1:1.5:3). Energia: 1.55 MJ/kg = 0.43 kWh/kg (calcina de clinker + mezclado). Fuente: ICE Database, Ecoinvent.", "Estructural",
			"/images/products/construccion/hormigon.jpg", 1, 1, 0, 0, 0},
		{"Ladrillo de Arcilla", "Construccion", "Materiales", "Ladrillos", "unidad",
			"Ladrillo comun de arcilla cocida. Energia: 4.75 MJ/unidad = 1.32 kWh (extraccion + moldeado + coccion). Fuente: ICE Database.", "Cocido",
			"/images/products/construccion/ladrillo-arcilla.jpg", 1, 1, 0, 0, 0},
		{"Bloque de Paja", "Construccion", "Materiales", "Bioconstruccion", "bloque",
			"Bloque de paja (straw bale). Energia: 0.91 MJ/kg = 0.25 kWh/kg (empacado agricola). Fuente: ICE Database.", "Bioconstruccion",
			"/images/products/construccion/bloque-paja.jpg", 1, 1, 0, 0, 0},
		{"Pinturas y Recubrimientos Naturales", "Construccion", "Acabados", "Pintura", "litro",
			"Pintura a cal, tierra pigmentada, estucos naturales, impermeabilizantes. Energia: ~15 MJ/L = 4 kWh.", "Acabado Natural",
			"/images/products/construccion/pinturas-naturales.jpg", 4, 4, 0, 0, 0},
		// --- Metales ---
		{"Acero Reciclado", "Construccion", "Metales", "Acero", "kg",
			"Acero reciclado en horno de arco electrico. Energia: 20 MJ/kg = 5.56 kWh/kg. Fuente: ICE Database, Ecoinvent.", "Reciclado",
			"/images/products/construccion/acero-reciclado.jpg", 6, 0, 0, 6, 0},
		{"Acero Virgen", "Construccion", "Metales", "Acero", "kg",
			"Acero estructural virgen. Energia: 35 MJ/kg = 9.72 kWh/kg (alto horno + laminacion). Fuente: ICE Database, WorldSteel.", "Industrial",
			"/images/products/construccion/acero-virgen.jpg", 10, 0, 0, 10, 0},
		{"Aluminio", "Construccion", "Metales", "Aluminio", "kg",
			"Aluminio comercial (33% reciclado). Energia: 193 MJ/kg = 53.6 kWh/kg (electrolisis Hall-Heroult). Fuente: ICE Database.", "Ligero",
			"/images/products/construccion/aluminio.jpg", 54, 0, 0, 54, 0},
		{"Vidrio Plano", "Construccion", "Materiales", "Vidrio", "kg",
			"Vidrio plano para ventanas. Energia: 15 MJ/kg = 4.17 kWh/kg (fusion de silice >1500C). Fuente: ICE Database.", "Transparente",
			"/images/products/construccion/vidrio-plano.jpg", 4, 0, 0, 4, 0},
		{"Tuberia PVC", "Construccion", "Materiales", "Polimeros", "kg",
			"Tuberia de PVC. Energia: 10.64-77.2 MJ/kg = 3-21 kWh/kg (polimerizacion etileno + cloro). Fuente: ICE Database.", "Plastico",
			"/images/products/construccion/tuberia-pvc.jpg", 10, 0, 0, 10, 0},

		// ============ ENERGIA Y COMBUSTIBLES ============
		{"Panel Solar Fotovoltaico", "Energia", "Solar", "Paneles", "m2",
			"Panel solar monocristalino 1m2. Energia: 4750 MJ/m2 = 1319 kWh (silicio grado solar + obleas + cristal). Fuente: ICE Database, Ecoinvent.", "Energia Limpia",
			"/images/products/energia/panel-solar.jpg", 1319, 0, 0, 1319, 0},
		{"Lena Seca para Cocinar", "Energia", "Lena", "Lena", "kg",
			"Lena seca de arboles frutales y de sombra. Energia: 15.3 MJ/kg = 4.25 kWh (corte + secado). Fuente: Ecoinvent.", "Fuego Natural",
			"/images/products/energia/lena-seca.jpg", 4, 4, 0, 0, 0},
		{"Carbon Vegetal", "Energia", "Lena", "Carbon", "kg",
			"Carbon vegetal de hornos artesanales. Energia: ~22 MJ/kg = 6 kWh (pirolisis + transporte).", "Carbon Artesanal",
			"/images/products/energia/carbon-vegetal.jpg", 6, 6, 0, 0, 0},
		{"Diesel Agricola", "Energia", "Combustibles", "Diesel", "litro",
			"Diesel/gasoil agricola. Energia: 41.7 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: Ecoinvent, ResearchGate.", "Combustible",
			"/images/products/energia/diesel-agricola.jpg", 12, 12, 0, 0, 0},
		{"Gasolina", "Energia", "Combustibles", "Gasolina", "kg",
			"Gasolina comercial. Energia: 47.1 MJ/kg = 13.08 kWh/kg (refinacion del petroleo). Fuente: Ecoinvent.", "Combustible",
			"/images/products/energia/gasolina.jpg", 13, 13, 0, 0, 0},
		{"Gas GLP", "Energia", "Combustibles", "GLP", "kg",
			"Gas licuado de petroleo. Energia: 50.1 MJ/kg = 13.92 kWh/kg (refinacion + envasado). Fuente: Ecoinvent.", "Domestico",
			"/images/products/energia/gas-glp.jpg", 14, 14, 0, 0, 0},
		{"Biomasa Seca (Pellets)", "Energia", "Combustibles", "Biomasa", "kg",
			"Pellets de madera seca. Energia: 15.3 MJ/kg = 4.25 kWh/kg (secado + compactacion). Fuente: Ecoinvent.", "Renovable",
			"/images/products/energia/biomasa-pellets.jpg", 4, 4, 0, 0, 0},

		// ============ HERRAMIENTAS: Campo (individuales) ============
		{"Machete", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Machete de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 4 MJ = 14 MJ = 4 TQ. Fuente: ICE Database.", "Conuquero",
			"/images/products/herramientas/machete.jpg", 4, 0, 0, 4, 0},
		{"Pala", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Pala de acero con mango de madera. Energia: acero ~1.5kg x 20 MJ/kg + mango 4 MJ = 34 MJ = 9 TQ. Fuente: ICE Database.", "Excavacion",
			"/images/products/herramientas/pala.jpg", 9, 0, 0, 9, 0},
		{"Pico", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Pico de acero con mango de madera. Energia: acero ~2kg x 20 MJ/kg + mango 4 MJ = 44 MJ = 12 TQ. Fuente: ICE Database.", "Excavacion",
			"/images/products/herramientas/pico.jpg", 12, 0, 0, 12, 0},
		{"Rastrillo", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Rastrillo de acero con mango de madera. Energia: acero ~1kg x 20 MJ/kg + mango 4 MJ = 24 MJ = 7 TQ. Fuente: ICE Database.", "Limpieza",
			"/images/products/herramientas/rastrillo.jpg", 7, 0, 0, 7, 0},
		{"Azadon", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Azadon de acero con mango de madera. Energia: acero ~0.8kg x 20 MJ/kg + mango 4 MJ = 20 MJ = 6 TQ. Fuente: ICE Database.", "Cultivo",
			"/images/products/herramientas/azadon.jpg", 6, 0, 0, 6, 0},
		// --- Taller (individuales) ---
		{"Martillo", "Herramientas", "Manuales", "Taller", "unidad",
			"Martillo de acero con mango de madera. Energia: acero ~0.3kg x 20 MJ/kg + mango 2 MJ = 8 MJ = 2 TQ. Fuente: ICE Database.", "Taller",
			"/images/products/herramientas/martillo.jpg", 2, 0, 0, 2, 0},
		{"Serrucho", "Herramientas", "Manuales", "Taller", "unidad",
			"Serrucho de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 2 MJ = 12 MJ = 3 TQ. Fuente: ICE Database.", "Corte",
			"/images/products/herramientas/serrucho.jpg", 3, 0, 0, 3, 0},
		{"Lima", "Herramientas", "Manuales", "Taller", "unidad",
			"Lima de acero para desbaste. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Desbaste",
			"/images/products/herramientas/lima.jpg", 2, 0, 0, 2, 0},
		{"Destornillador", "Herramientas", "Manuales", "Taller", "unidad",
			"Destornillador de acero con mango de plastico. Energia: acero ~0.1kg x 20 MJ/kg + plastico 1 MJ = 3 MJ = 1 TQ. Fuente: ICE Database.", "Tornillos",
			"/images/products/herramientas/destornillador.jpg", 1, 0, 0, 1, 0},
		{"Alicates", "Herramientas", "Manuales", "Taller", "unidad",
			"Alicates de acero. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Pinza",
			"/images/products/herramientas/alicates.jpg", 2, 0, 0, 2, 0},
		{"Afilar y Mantener Herramientas", "Herramientas", "Manuales", "Mantenimiento", "unidad",
			"Afilar machetes, cuchillos, tijeras, reparacion de mangos. Energia: ~1h trabajo general = 1 kWh.", "Mantencion",
			"/images/products/herramientas/afilar-herramientas.jpg", 1, 1, 0, 0, 0},
		// --- Electricas (individuales) ---
		{"Taladro Electrico", "Herramientas", "Electricas", "Taladros", "unidad",
			"Taladro electrico portatil 600W. Energia: motor + plastico + cobre ~100 TQ. Fuente: ICE Database.", "Electrico",
			"/images/products/herramientas/taladro-electrico.jpg", 100, 0, 0, 100, 0},
		{"Sierra Circular", "Herramientas", "Electricas", "Sierras", "unidad",
			"Sierra circular electrica 1200W con disco. Energia: motor + acero + plastico ~120 TQ. Fuente: ICE Database.", "Electrico",
			"/images/products/herramientas/sierra-circular.jpg", 120, 0, 0, 120, 0},
		{"Amoladora", "Herramientas", "Electricas", "Amoladoras", "unidad",
			"Amoladora angular electrica 700W con discos. Energia: motor + acero ~80 TQ. Fuente: ICE Database.", "Electrico",
			"/images/products/herramientas/amoladora.jpg", 80, 0, 0, 80, 0},
		{"Lijadora Electrica", "Herramientas", "Electricas", "Lijadoras", "unidad",
			"Lijadora orbital electrica 300W. Energia: motor + plastico ~60 TQ. Fuente: ICE Database.", "Electrico",
			"/images/products/herramientas/lijadora.jpg", 60, 0, 0, 60, 0},
		{"Soldadora Electrica", "Herramientas", "Electricas", "Soldadoras", "unidad",
			"Soldadora electrica 150A con electrodos. Energia: transformador cobre + acero ~200 TQ. Fuente: ICE Database.", "Electrico",
			"/images/products/herramientas/soldadora.jpg", 200, 0, 0, 200, 0},

		// ============ TECNOLOGIA Y ELECTRODOMESTICOS ============
		{"Telefono Inteligente", "Tecnologia", "Electronica", "Telefonos", "unidad",
			"Smartphone completo. Energia: 1000 MJ = 278 kWh (tierras raras + microprocesadores + ensamblado). Fuente: ICE Database, Marspedia.", "Dispositivo",
			"/images/products/tecnologia/telefono-inteligente.jpg", 278, 0, 0, 278, 0},
		{"Computadora Portatil", "Tecnologia", "Electronica", "Computadoras", "unidad",
			"Laptop completa. Energia: 4500 MJ = 1250 kWh (placa madre + LCD + bateria litio + chasis). Fuente: Ecoinvent, Marspedia.", "Dispositivo",
			"/images/products/tecnologia/computadora-portatil.jpg", 1250, 0, 0, 1250, 0},
		{"Computadora de Sobremesa", "Tecnologia", "Electronica", "Computadoras", "unidad",
			"PC de sobremesa. Energia: 2085 MJ = 579 kWh (torre + componentes). Fuente: Marspedia.", "Dispositivo",
			"/images/products/tecnologia/computadora-sobremesa.jpg", 579, 0, 0, 579, 0},
		{"Monitor LCD", "Tecnologia", "Electronica", "Monitores", "unidad",
			"Monitor LCD. Energia: 963 MJ = 268 kWh (pantalla + electronicos). Fuente: ICE Database.", "Pantalla",
			"/images/products/tecnologia/monitor-lcd.jpg", 268, 0, 0, 268, 0},
		{"Lavadora Domestica", "Tecnologia", "Electrodomesticos", "Lavanderia", "unidad",
			"Lavadora domestica. Energia: 3900 MJ = 1083 kWh (acero + motor + contrapesos + electronica). Fuente: ICE Database.", "Electrodomestico",
			"/images/products/tecnologia/lavadora.jpg", 1083, 0, 0, 1083, 0},
		{"Refrigerador Domestico", "Tecnologia", "Electrodomesticos", "Refrigeracion", "unidad",
			"Refrigerador domestico. Energia: 5900 MJ = 1639 kWh (compresor + poliuretano + cobre + acero). Fuente: ICE Database.", "Electrodomestico",
			"/images/products/tecnologia/refrigerador.jpg", 1639, 0, 0, 1639, 0},
		{"Cafetera Electrica", "Tecnologia", "Electrodomesticos", "Cocina", "unidad",
			"Cafetera electrica. Energia: 184 MJ = 51 kWh (plastico + resistencia + cableado). Fuente: ICE Database.", "Electrodomestico",
			"/images/products/tecnologia/cafetera-electrica.jpg", 51, 0, 0, 51, 0},
		{"Secador de Pelo", "Tecnologia", "Electrodomesticos", "Cuidado Personal", "unidad",
			"Secador de pelo. Energia: 79 MJ = 22 kWh (plastico + motor + resistencia). Fuente: ICE Database.", "Electrodomestico",
			"/images/products/tecnologia/secador-pelo.jpg", 22, 0, 0, 22, 0},
		// --- Componentes electronicos (individuales) ---
		{"Cable Electrico (metro)", "Tecnologia", "Componentes", "Cables", "metro",
			"Cable de cobre 1 metro para instalaciones. Energia: cobre ~0.1kg x 42 MJ/kg = 4.2 MJ = 1 TQ. Fuente: ICE Database.", "Cable",
			"/images/products/tecnologia/cable-electrico.jpg", 1, 0, 0, 1, 0},
		{"Resistencias (Paquete 10)", "Tecnologia", "Componentes", "Resistencias", "paquete",
			"Paquete de 10 resistencias electronicas. Energia: manufactura ~1 TQ.", "Componente",
			"/images/products/tecnologia/resistencias.jpg", 1, 0, 0, 1, 0},
		{"Capacitores (Paquete 10)", "Tecnologia", "Componentes", "Capacitores", "paquete",
			"Paquete de 10 capacitores electronicos. Energia: manufactura ~1 TQ.", "Componente",
			"/images/products/tecnologia/capacitores.jpg", 1, 0, 0, 1, 0},
		{"Conectores (Paquete)", "Tecnologia", "Componentes", "Conectores", "paquete",
			"Paquete de conectores electronicos variados. Energia: plastico + metal ~2 TQ.", "Componente",
			"/images/products/tecnologia/conectores.jpg", 2, 0, 0, 2, 0},
		{"Soldadura Electronica (Rollo)", "Tecnologia", "Componentes", "Soldadura", "rollo",
			"Rollo de soldadura de estano para electronica. Energia: estano + plomo ~3 TQ.", "Componente",
			"/images/products/tecnologia/soldadura-electronica.jpg", 3, 0, 0, 3, 0},
		{"Plaquetas PCB (Unidad)", "Tecnologia", "Componentes", "Plaquetas", "unidad",
			"Plaqueta PCB virgen para circuitos. Energia: cobre + fibra de vidrio ~2 TQ.", "Componente",
			"/images/products/tecnologia/plaquetas-pcb.jpg", 2, 0, 0, 2, 0},
		{"Fusibles (Paquete 10)", "Tecnologia", "Componentes", "Fusibles", "paquete",
			"Paquete de 10 fusibles electricos. Energia: vidrio + metal ~1 TQ.", "Componente",
			"/images/products/tecnologia/fusibles.jpg", 1, 0, 0, 1, 0},

		// ============ TRANSPORTE: Bicicletas (individuales) ============
		{"Bicicleta Completa", "Transporte", "Vehiculos", "Bicicletas", "unidad",
			"Bicicleta completa lista para usar. Energia: acero ~15kg x 6 kWh/kg + caucho + ensamblaje = 100 TQ. Fuente: ICE Database.", "Transporte Limpio",
			"/images/products/transporte/bicicleta.jpg", 100, 0, 0, 100, 0},
		{"Llanta de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "unidad",
			"Llanta de caucho para bicicleta. Energia: caucho ~1kg x 24 MJ/kg = 24 MJ = 7 TQ. Fuente: Ecoinvent.", "Refaccion",
			"/images/products/transporte/llanta-bicicleta.jpg", 7, 0, 0, 7, 0},
		{"Cadena de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "unidad",
			"Cadena de acero para bicicleta. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Refaccion",
			"/images/products/transporte/cadena-bicicleta.jpg", 2, 0, 0, 2, 0},
		{"Frenos de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "par",
			"Par de frenos completos para bicicleta. Energia: acero + caucho ~5 TQ.", "Refaccion",
			"/images/products/transporte/frenos-bicicleta.jpg", 5, 0, 0, 5, 0},
		// --- Animales (individuales) ---
		{"Caballo de Silla", "Transporte", "Animales", "Equinos", "unidad",
			"Caballo entrenado para montura. Energia incorporada: crianza + alimentacion 3 anos ~500 TQ (estimacion comunitaria).", "Traccion Animal",
			"/images/products/transporte/caballo-silla.jpg", 500, 0, 0, 500, 0},
		{"Burro de Carga", "Transporte", "Animales", "Equinos", "unidad",
			"Burro entrenado para carga. Energia incorporada: crianza + alimentacion 2 anos ~300 TQ (estimacion comunitaria).", "Traccion Animal",
			"/images/products/transporte/burro-carga.jpg", 300, 0, 0, 300, 0},
		{"Mula de Carga", "Transporte", "Animales", "Equinos", "unidad",
			"Mula para carga y trabajo de campo. Energia incorporada: crianza + alimentacion 3 anos ~400 TQ (estimacion comunitaria).", "Traccion Animal",
			"/images/products/transporte/mula-carga.jpg", 400, 0, 0, 400, 0},

		// ============ CULTURA: Instrumentos (individuales) ============
		{"Cuatro Venezolano", "Cultura", "Musica", "Cuerdas", "unidad",
			"Cuatro venezolano artesanal de madera. Energia: madera ~2kg x 8.5 MJ/kg + cuerdas + manufactura = 25 TQ. Fuente: ICE Database.", "Musica Criolla",
			"/images/products/cultura/cuatro-venezolano.jpg", 25, 0, 0, 25, 0},
		{"Guitarra Artesanal", "Cultura", "Musica", "Cuerdas", "unidad",
			"Guitarra acustica artesanal de madera. Energia: madera ~4kg x 8.5 MJ/kg + cuerdas + manufactura = 40 TQ. Fuente: ICE Database.", "Musica",
			"/images/products/cultura/guitarra-artesanal.jpg", 40, 0, 0, 40, 0},
		{"Tambor (Caja)", "Cultura", "Musica", "Percusion", "unidad",
			"Tambor de madera con cuero. Energia: madera ~3kg x 8.5 MJ/kg + cuero + manufactura = 30 TQ. Fuente: ICE Database.", "Percusion",
			"/images/products/cultura/tambor.jpg", 30, 0, 0, 30, 0},
		{"Maracas (Par)", "Cultura", "Musica", "Percusion", "par",
			"Par de maracas de totuma con semillas y mango de madera. Energia: madera + semillas + manufactura = 8 TQ.", "Percusion",
			"/images/products/cultura/maracas.jpg", 8, 0, 0, 8, 0},
		{"Flauta de Caña", "Cultura", "Musica", "Vientos", "unidad",
			"Flauta traversa de caña. Energia: caña + manufactura = 3 TQ.", "Viento",
			"/images/products/cultura/flauta-cana.jpg", 3, 0, 0, 3, 0},
		{"Pintura y Artes Visuales", "Cultura", "Artes", "Pintura", "unidad",
			"Cuadros, murales, retratos, cartelera. Energia: pinturas + tela/lienzo + trabajo ~54 MJ = 15 kWh.", "Arte",
			"/images/products/cultura/pintura-artes.jpg", 15, 15, 0, 0, 0},

		// ============ RECURSOS BASICOS ============
		{"Agua Purificada", "Recursos Basicos", "Agua", "Potable", "litro",
			"Agua filtrada/purificada. Energia: 0.5 MJ/L = 0.14 kWh/L (bombeo + microfiltracion). Fuente: ICE Database.", "Vital",
			"/images/products/recursos/agua-purificada.jpg", 1, 1, 0, 0, 0},

		// ============ AGRICULTURA: Subcategorias faltantes ============
		{"Fertilizantes Organicos", "Agricultura", "Insumos Agricolas", "Fertilizantes", "kg",
			"Compost maduro, humus de lombriz, estiercol curado, gallinaza. Energia: ~2 MJ/kg = 0.6 kWh/kg (compostaje + empaque).", "Fertilidad",
			"/images/products/agricultura/fertilizantes-organicos.jpg", 1, 1, 0, 0, 0},
		{"Plaguicidas Naturales", "Agricultura", "Insumos Agricolas", "Plaguicidas", "litro",
			"Extracto de neem, ajo, aji, repelentes botanicos. Energia: ~5 MJ/L = 1.4 kWh/L (extraccion + procesamiento).", "Control Natural",
			"/images/products/agricultura/plaguicidas-naturales.jpg", 2, 2, 0, 0, 0},
		{"Hongos Comestibles", "Agricultura", "Insumos Agricolas", "Hongos", "kg",
			"Champiñones, setas, hongos ostra cultivados. Energia: ~8 MJ/kg = 2.2 kWh/kg (sustrato + incubacion + cosecha).", "Cultivo",
			"/images/products/agricultura/hongos-comestibles.jpg", 2, 2, 0, 0, 0},

		// ============ ALIMENTACION: Subcategorias faltantes ============
		{"Carne de Res", "Alimentacion", "Carnes y Pescados", "Res", "kg",
			"Carne de vacuno fresca. Energia: ~200 MJ/kg = 55 kWh/kg (alimentacion animal + procesamiento).", "Proteina Animal",
			"/images/products/alimentacion/carne-res.jpg", 55, 55, 0, 0, 0},
		{"Cereales y Avena", "Alimentacion", "Granos y Cereales", "Cereales", "kg",
			"Avena, maiz en hojuelas, cereales para desayuno. Energia: ~15 MJ/kg = 4.2 kWh/kg (procesamiento + hojuelado).", "Cereal",
			"/images/products/alimentacion/cereales-avena.jpg", 4, 4, 0, 0, 0},
		{"Sal de Mar", "Alimentacion", "Condimentos", "Sales", "kg",
			"Sal marina de grano, sal de roca, sal de mesa. Energia: ~3 MJ/kg = 0.8 kWh/kg (evaporacion solar + molienda).", "Mineral",
			"/images/products/alimentacion/sal-mar.jpg", 1, 1, 0, 0, 0},
		{"Mantequilla y Queso", "Alimentacion", "Carnes y Pescados", "Lacteos Frescos", "kg",
			"Mantequilla artesanal, queso fresco, cuajada. Energia: ~40 MJ/kg = 11 kWh/kg (ordeño + procesamiento).", "Lacteo",
			"/images/products/alimentacion/mantequilla-queso.jpg", 11, 11, 0, 0, 0},

		// ============ ARTESANIA: Subcategorias faltantes ============
		{"Cuero Artesanal", "Artesania", "Cuero", "Materia Prima", "kg",
			"Cuero curtido vegetal para marroquineria, calzado, cinturones. Energia: ~85 MJ/kg = 24 kWh/kg (curtido + secado).", "Cuero",
			"/images/products/artesania/cuero-artesanal.jpg", 24, 24, 0, 0, 0},
		{"Calzado de Cuero", "Artesania", "Cuero", "Calzado", "par",
			"Sandalias, zapatos, botines de cuero artesanal. Energia: cuero + suela + costura = ~80 MJ = 22 kWh.", "Calzado",
			"/images/products/artesania/calzado-cuero.jpg", 22, 22, 0, 0, 0},
		{"Metal Forjado", "Artesania", "Metal", "Forja", "kg",
			"Hierro forjado: cuchillos, herramientas, decoracion. Energia: ~30 MJ/kg = 8.3 kWh/kg (forja + templado).", "Forja",
			"/images/products/artesania/metal-forjado.jpg", 8, 8, 0, 0, 0},
		{"Vidrio Soplado", "Artesania", "Vidrio", "Soplado", "unidad",
			"Vasos, botellas, decoracion de vidrio soplado artesanal. Energia: ~25 MJ/unidad = 7 kWh (horno + soplado).", "Vidrio",
			"/images/products/artesania/vidrio-soplado.jpg", 7, 7, 0, 0, 0},

		// ============ CONSTRUCCION: Subcategorias faltantes ============
		{"Impermeabilizantes", "Construccion", "Acabados", "Impermeabilizantes", "litro",
			"Impermeabilizantes naturales: brea, cera, mezclas vegetales. Energia: ~15 MJ/L = 4.2 kWh/L.", "Impermeable",
			"/images/products/construccion/impermeabilizantes.jpg", 4, 4, 0, 0, 0},
		{"Revestimientos y Estucos", "Construccion", "Acabados", "Revestimientos", "kg",
			"Estuco de cal, revestimientos de tierra, acabados naturales. Energia: ~5 MJ/kg = 1.4 kWh/kg.", "Acabado",
			"/images/products/construccion/revestimientos.jpg", 1, 1, 0, 0, 0},
		{"Carpinteria de Obra", "Construccion", "Materiales", "Carpinteria", "unidad",
			"Puertas, ventanas, marcos de madera para construccion. Energia: ~80 MJ/unidad = 22 kWh.", "Carpinteria",
			"/images/products/construccion/carpinteria-obra.jpg", 22, 22, 0, 0, 0},

		// ============ CULTURA: Subcategorias faltantes ============
		{"Taller de Teatro", "Cultura", "Artes", "Teatro", "sesion",
			"Taller de teatro comunitario, dramatizacion, expresion corporal. Energia: ~8 kWh/sesion (espacio + direccion).", "Escena",
			"/images/products/cultura/taller-teatro.jpg", 8, 8, 0, 0, 0},
		{"Danza Tradicional", "Cultura", "Artes", "Danza", "sesion",
			"Taller de danza tradicional, folclor, expresion corporal. Energia: ~6 kWh/sesion.", "Danza",
			"/images/products/cultura/danza-tradicional.jpg", 6, 6, 0, 0, 0},
		{"Taller de Literatura", "Cultura", "Artes", "Literatura", "sesion",
			"Taller de escritura creativa, poesia, narrativa oral. Energia: ~4 kWh/sesion.", "Letras",
			"/images/products/cultura/taller-literatura.jpg", 4, 4, 0, 0, 0},
		{"Produccion Audiovisual", "Cultura", "Artes", "Audiovisual", "hora",
			"Grabacion, edicion, fotografia documental comunitaria. Energia: ~3 kWh/h (equipos + edicion).", "Audiovisual",
			"/images/products/cultura/produccion-audiovisual.jpg", 3, 3, 0, 0, 0},

		// ============ EDUCACION: Subcategorias faltantes ============
		{"Matematicas y Numeracion", "Educacion", "Alfabetizacion", "Numeracion", "sesion",
			"Clases de matematicas basicas, aritmetica, geometria aplicada. Energia: ~4 kWh/sesion.", "Numeracion",
			"/images/products/educacion/matematicas.jpg", 4, 4, 0, 0, 0},
		{"Tecnologia y Computacion", "Educacion", "Talleres", "Tecnologia", "sesion",
			"Taller de computacion basica, ofimatica, internet. Energia: ~5 kWh/sesion (equipos + espacio).", "Tecnologia",
			"/images/products/educacion/tecnologia-computacion.jpg", 5, 5, 0, 0, 0},
		{"Idiomas", "Educacion", "Talleres", "Idiomas", "sesion",
			"Clases de idiomas: ingles, portugues, lengua de señas. Energia: ~4 kWh/sesion.", "Idiomas",
			"/images/products/educacion/idiomas.jpg", 4, 4, 0, 0, 0},

		// ============ ENERGIA: Subcategorias faltantes ============
		{"Energia Eolica", "Energia", "Eolica", "Aerogeneradores", "unidad",
			"Aerogeneradores pequenos para zonas rurales. Energia: ~500 MJ/unidad = 139 kWh (fabricacion + instalacion).", "Eolica",
			"/images/products/energia/energia-eolica.jpg", 139, 139, 0, 0, 0},
		{"Energia Hidraulica", "Energia", "Hidraulica", "Microturbinas", "unidad",
			"Microturbinas hidraulicas para arroyos y rios pequenos. Energia: ~800 MJ/unidad = 222 kWh.", "Hidraulica",
			"/images/products/energia/energia-hidraulica.jpg", 222, 222, 0, 0, 0},

		// ============ HERRAMIENTAS: Subcategorias faltantes ============
		{"Instrumentos de Medicion", "Herramientas", "Manuales", "Medicion", "unidad",
			"Flexometro, nivel, plomada, escuadra, calibrador. Energia: ~20 MJ/unidad = 5.5 kWh (fabricacion metal/plastico).", "Medicion",
			"/images/products/herramientas/instrumentos-medicion.jpg", 6, 6, 0, 0, 0},
		{"Herramientas de Corte", "Herramientas", "Manuales", "Corte", "unidad",
			"Sierras manuales, cuchillos de trabajo, tijeras de podar, machetes. Energia: ~15 MJ/unidad = 4.2 kWh (acero + templado).", "Corte",
			"/images/products/herramientas/herramientas-corte.jpg", 4, 4, 0, 0, 0},

		// ============ SALUD: Subcategorias faltantes ============
		{"Apiterapia", "Salud y Medicina", "Medicina Botanica", "Apiterapia", "sesion",
			"Terapia con productos de la colmena: miel, propoleo, jalea real, apitoxina. Energia: ~3 kWh/sesion.", "Apiterapia",
			"/images/products/salud/apiterapia.jpg", 3, 3, 0, 0, 0},
		{"Homeopatia y Flores de Bach", "Salud y Medicina", "Medicina Botanica", "Homeopatia", "sesion",
			"Consultas homeopaticas, preparados florales, remedios vibracionales. Energia: ~2 kWh/sesion.", "Homeopatia",
			"/images/products/salud/homeopatia.jpg", 2, 2, 0, 0, 0},

		// ============ SERVICIOS: Subcategorias faltantes ============
		{"Peluqueria y Barberia", "Servicios", "Cuidado Personal", "Peluqueria", "sesion",
			"Corte de cabello, afeitado, peinado, arreglos. Energia: ~2 kWh/sesion (espacio + herramientas).", "Cuidado",
			"/images/products/servicios/peluqueria-barberia.jpg", 2, 2, 0, 0, 0},
		{"Costura y Confeccion", "Servicios", "Reparaciones", "Costura", "hora",
			"Arreglos de ropa, confeccion a medida, ajustes. Energia: ~1.5 kWh/h (maquina + trabajo).", "Costura",
			"/images/products/servicios/costura-confeccion.jpg", 2, 2, 0, 0, 0},

		// ============ TECNOLOGIA: Subcategorias faltantes ============
		{"Equipos de Red", "Tecnologia", "Componentes", "Redes", "unidad",
			"Routers, switches, access points, tarjetas de red. Energia: ~120 MJ/unidad = 33 kWh (fabricacion + embalaje).", "Redes",
			"/images/products/tecnologia/equipos-red.jpg", 33, 33, 0, 0, 0},
		{"Software y Soporte", "Tecnologia", "Computacion", "Software", "hora",
			"Instalacion de software, soporte tecnico, configuracion de sistemas. Energia: ~2 kWh/h (equipos + trabajo).", "Software",
			"/images/products/tecnologia/software-soporte.jpg", 2, 2, 0, 0, 0},

		// ============ TEXTILES: Subcategorias faltantes ============
		{"Calzado Textil", "Textiles", "Confeccion", "Calzado", "par",
			"Alpargatas, zapatillas de tela, calzado textil artesanal. Energia: ~30 MJ/par = 8.3 kWh.", "Calzado",
			"/images/products/textiles/calzado-textil.jpg", 8, 8, 0, 0, 0},
		{"Sombreros y Gorros", "Textiles", "Tejidos", "Sombrerería", "unidad",
			"Sombreros de paja, gorros de lana, cachuchas textiles. Energia: ~15 MJ/unidad = 4.2 kWh.", "Sombrerería",
			"/images/products/textiles/sombreros-gorros.jpg", 4, 4, 0, 0, 0},

		// ============ TRANSPORTE: Subcategorias faltantes ============
		{"Carga Animal", "Transporte", "Animales", "Carga", "viaje",
			"Transporte de carga con animales de carga (mulas, burros). Energia: ~10 kWh/viaje (alimentacion animal + trabajo).", "Arriero",
			"/images/products/transporte/carga-animal.jpg", 10, 10, 0, 0, 0},
		{"Combustibles para Transporte", "Transporte", "Vehiculos", "Combustibles", "litro",
			"Gasolina, diesel, biodiesel para vehiculos. Energia: ~35 MJ/L = 9.7 kWh/L.", "Combustible",
			"/images/products/transporte/combustibles-transporte.jpg", 10, 10, 0, 0, 0},

		// ============ EMBALAJE: Envases ecologicos para servir y llevar ============
		// Vasos para liquidos
		{"Vasos de Hoja de Platano", "Embalaje", "Vasos", "Hoja de Platano", "unidad",
			"Vasos biodegradables hechos de hojas de platano secadas y prensadas. Se descomponen en 45-60 dias. Energia: ~2 MJ/unidad = 0.6 kWh (cosecha + secado + prensado).", "Biodegradable",
			"/images/products/embalaje/vasos-hoja-platano.jpg", 1, 1, 0, 0, 0},
		{"Vasos de Bagazo de Caña", "Embalaje", "Vasos", "Bagazo", "unidad",
			"Vasos compostables de fibra de bagazo de caña de azucar. Resisten hasta 100°C, aptos para liquidos calientes y frios. Energia: ~3 MJ/unidad = 0.8 kWh (fibra + prensado).", "Compostable",
			"/images/products/embalaje/vasos-bagazo.jpg", 1, 1, 0, 0, 0},
		{"Vasos de PLA (Maiz)", "Embalaje", "Vasos", "PLA", "unidad",
			"Vasos transparentes de PLA (acido polilactico de almidon de maiz). Compostables en 90-180 dias. Para bebidas frias. Energia: ~5 MJ/unidad = 1.4 kWh (extrusion + moldeo).", "Compostable",
			"/images/products/embalaje/vasos-pla.jpg", 1, 1, 0, 0, 0},
		{"Vasos de Totuma/Calabaza", "Embalaje", "Vasos", "Totuma", "unidad",
			"Vasos naturales hechos de totuma (crescentia cujete) secada y tallada. 100% natural, reutilizable, biodegradable. Energia: ~1 MJ/unidad = 0.3 kWh (cosecha + secado + tallado).", "Natural",
			"/images/products/embalaje/vasos-totuma.jpg", 1, 1, 0, 0, 0},
		{"Vasos de Coco", "Embalaje", "Vasos", "Coco", "unidad",
			"Vasos hechos de cascara de coco pulida y sellada con cera natural. Reutilizables, resistentes. Energia: ~2 MJ/unidad = 0.6 kWh (corte + pulido + sellado).", "Natural",
			"/images/products/embalaje/vasos-coco.jpg", 1, 1, 0, 0, 0},
		{"Vasos de Barro/Ceramica", "Embalaje", "Vasos", "Ceramica", "unidad",
			"Vasos de barro cocido artesanal. Reutilizables, mantienen temperatura. Energia: ~15 MJ/unidad = 4.2 kWh (extraccion + modelado + coccion horno).", "Reutilizable",
			"/images/products/embalaje/vasos-barro.jpg", 4, 4, 0, 0, 0},

		// Platos y bandejas para comida
		{"Platos de Hoja de Platano", "Embalaje", "Platos", "Hoja de Platano", "unidad",
			"Platos y bandejas biodegradables de hojas de platano prensadas. Para servir comida al instante. Se descomponen en 45-60 dias. Energia: ~2 MJ/unidad = 0.6 kWh.", "Biodegradable",
			"/images/products/embalaje/platos-hoja-platano.jpg", 1, 1, 0, 0, 0},
		{"Platos de Bagazo", "Embalaje", "Platos", "Bagazo", "unidad",
			"Platos compostables de fibra de bagazo de caña. Resisten alimentos calientes, grasos, liquidos. Energia: ~3 MJ/unidad = 0.8 kWh.", "Compostable",
			"/images/products/embalaje/platos-bagazo.jpg", 1, 1, 0, 0, 0},
		{"Platos de Fibra de Bambu", "Embalaje", "Platos", "Bambu", "unidad",
			"Platos de fibra de bambu moldeada. Compostables, resistentes, ligeros. Energia: ~4 MJ/unidad = 1.1 kWh (fibra + moldeo + secado).", "Compostable",
			"/images/products/embalaje/platos-bambu.jpg", 1, 1, 0, 0, 0},
		{"Platos de Hoja de Palma", "Embalaje", "Platos", "Palma", "unidad",
			"Platos hechos de hojas de palma caidas naturalmente. Sin quimicos, 100% biodegradables. Energia: ~1.5 MJ/unidad = 0.4 kWh (recoleccion + prensado).", "Biodegradable",
			"/images/products/embalaje/platos-hoja-palma.jpg", 1, 1, 0, 0, 0},

		// Contenedores para llevar
		{"Contenedores de Bagazo con Tapa", "Embalaje", "Contenedores", "Bagazo", "unidad",
			"Contenedores compostables de bagazo con tapa para llevar comida. Resisten hasta 120°C. Energia: ~5 MJ/unidad = 1.4 kWh.", "Compostable",
			"/images/products/embalaje/contenedores-bagazo.jpg", 1, 1, 0, 0, 0},
		{"Contenedores de Fibra de Bambu", "Embalaje", "Contenedores", "Bambu", "unidad",
			"Contenedores de fibra de bambu con revestimiento PLA. Compostables, anti-grasa. Energia: ~6 MJ/unidad = 1.7 kWh.", "Compostable",
			"/images/products/embalaje/contenedores-bambu.jpg", 2, 2, 0, 0, 0},
		{"Contenedores de Hoja de Platano", "Embalaje", "Contenedores", "Hoja de Platano", "unidad",
			"Contenedores biodegradables de hoja de platano para llevar alimentos. Energia: ~3 MJ/unidad = 0.8 kWh.", "Biodegradable",
			"/images/products/embalaje/contenedores-hoja-platano.jpg", 1, 1, 0, 0, 0},

		// Bolsas y envolturas ecologicas
		{"Bolsas de Tela de Algodón", "Embalaje", "Bolsas", "Tela", "unidad",
			"Bolsas reutilizables de tela de algodon organico para llevar productos. Duran años, lavables. Energia: ~50 MJ/unidad = 14 kWh (cultivo + hilado + tejido + costura).", "Reutilizable",
			"/images/products/embalaje/bolsas-algodon.jpg", 14, 14, 0, 0, 0},
		{"Bolsas de Tela de Yute", "Embalaje", "Bolsas", "Yute", "unidad",
			"Bolsas de yute natural para granos, harinas, productos a granel. Biodegradables, resistentes. Energia: ~30 MJ/unidad = 8.3 kWh (cultivo + tejido).", "Natural",
			"/images/products/embalaje/bolsas-yute.jpg", 8, 8, 0, 0, 0},
		{"Bolsas de Papel Reciclado", "Embalaje", "Bolsas", "Papel", "unidad",
			"Bolsas de papel 100% reciclado sin blanquear. Biodegradables, compostables. Energia: ~8 MJ/unidad = 2.2 kWh (pulpa reciclada + confeccion).", "Reciclado",
			"/images/products/embalaje/bolsas-papel.jpg", 2, 2, 0, 0, 0},
		{"Bolsas Biodegradables de Almidon", "Embalaje", "Bolsas", "Almidon", "unidad",
			"Bolsas de almidon de papa/maiz (bioplastico). Se descomponen en 90-180 dias. Energia: ~12 MJ/unidad = 3.3 kWh (extrusion + sellado).", "Compostable",
			"/images/products/embalaje/bolsas-almidon.jpg", 3, 3, 0, 0, 0},

		// Envolturas para alimentos
		{"Envoltura de Cera de Abejas", "Embalaje", "Envolturas", "Cera de Abejas", "unidad",
			"Envoltura reutilizable de tela impregnada con cera de abejas. Sustituye el film plastico. Reutilizable por meses. Energia: ~10 MJ/unidad = 2.8 kWh (tela + cera + confeccion).", "Reutilizable",
			"/images/products/embalaje/envoltura-cera.jpg", 3, 3, 0, 0, 0},
		{"Envoltura de Hoja de Platano", "Embalaje", "Envolturas", "Hoja de Platano", "unidad",
			"Hojas frescas de platano para envolver alimentos (tamales, arepas, queso). 100% natural. Energia: ~0.5 MJ/unidad = 0.14 kWh (cosecha + lavado).", "Natural",
			"/images/products/embalaje/envoltura-hoja-platano.jpg", 1, 1, 0, 0, 0},
		{"Envoltura de Papel Encerado", "Embalaje", "Envolturas", "Papel Encerado", "unidad",
			"Papel encerado natural para envolver alimentos. Biodegradable, protege de humedad. Energia: ~4 MJ/unidad = 1.1 kWh (papel + cera).", "Biodegradable",
			"/images/products/embalaje/envoltura-papel.jpg", 1, 1, 0, 0, 0},

		// Cubiertos biodegradables
		{"Cubiertos de Madera", "Embalaje", "Cubiertos", "Madera", "set",
			"Set de tenedor, cuchara, cuchillo de madera biodegradable. Energia: ~5 MJ/set = 1.4 kWh (tallado + acabado).", "Biodegradable",
			"/images/products/embalaje/cubiertos-madera.jpg", 1, 1, 0, 0, 0},
		{"Cubiertos de Bambu", "Embalaje", "Cubiertos", "Bambu", "set",
			"Set de cubiertos de bambu, reutilizables y biodegradables. Energia: ~4 MJ/set = 1.1 kWh (corte + pulido).", "Reutilizable",
			"/images/products/embalaje/cubiertos-bambu.jpg", 1, 1, 0, 0, 0},
		{"Pajitas de Caña Natural", "Embalaje", "Cubiertos", "Caña", "unidad",
			"Pajitas/sorbetes de caña natural. Biodegradables, sustituyen el plastico. Energia: ~0.5 MJ/unidad = 0.14 kWh (corte + lavado).", "Biodegradable",
			"/images/products/embalaje/pajitas-cana.jpg", 1, 1, 0, 0, 0},
		{"Pajitas de Papel", "Embalaje", "Cubiertos", "Papel", "unidad",
			"Pajitas de papel compostable. Se descomponen en 90 dias. Energia: ~1 MJ/unidad = 0.28 kWh (papel + enrollado).", "Compostable",
			"/images/products/embalaje/pajitas-papel.jpg", 1, 1, 0, 0, 0},

		// ============ FERIA CONUQUERA: Productos con energia conocida (migracion 093) ============
		{"Topocho Fresco", "Alimentacion", "Cosecha Fresca", "Frutas", "kg",
			"Topocho fresco de conuco. Similar al platano burro. Energia: ~2.0 MJ/kg = 0.6 kWh/kg. Fuente: FAO. Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Mapuey Fresco", "Alimentacion", "Cosecha Fresca", "Tuberculos", "kg",
			"Mapuey (Dioscorea trifida) fresco de conuco. Tuberculo nativo americano. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: estudios LCA tuberculos andinos. Documentado en Feria Conuquera (Unidad Docovaca).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Name Morado Fresco", "Alimentacion", "Cosecha Fresca", "Tuberculos", "kg",
			"Name morado fresco de conuco. Variedad de Dioscorea con mayor contenido de minerales. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: estudios LCA tuberculos. Documentado en Feria Conuquera (Unidad Docovaca).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Verdolaga Fresca", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Verdolaga (Portulaca oleracea) fresca. Hoja verde comestible rica en omega-3. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Unidad Docovaca).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Pira (Amaranto) Fresca", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Pira o amaranto (Amaranthus) fresco. Hoja verde nutritiva, equivalente a espinaca. Tambien llamada Yerba Caracas. Energia: ~2.5 MJ/kg = 0.7 kWh/kg. Fuente: FAO. Documentado en Feria Conuquera (Unidad Docovaca).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Rucula Fresca", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Rucula (Eruca vesicaria) fresca. Hoja de ensalada con sabor picante. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Alfivegetales, El Junquito).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Col Rizada (Kale) Fresca", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Col rizada o kale (Brassica oleracea var. acephala) fresca. Hoja verde nutritiva. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas verdes). Documentado en Feria Conuquera (Alfivegetales, El Junquito).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Sauco Fresco", "Alimentacion", "Cosecha Fresca", "Aromaticas", "kg",
			"Sauco (Sambucus) fresco. Hoja y flor medicinal/comestible. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hojas aromaticas). Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Aji Picante Fresco", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Aji picante fresco (Capsicum). Variedades criollas de conuco. Energia: ~3.2 MJ/kg = 0.9 kWh/kg. Fuente: Agribalyse. Documentado en Feria Conuquera (Alfivegetales).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Aji Dulce Fresco", "Alimentacion", "Cosecha Fresca", "Hortalizas", "kg",
			"Aji dulce fresco (Capsicum chinense). Base del sofrito venezolano, sin picante. Energia: ~3.2 MJ/kg = 0.9 kWh/kg. Fuente: Agribalyse. Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Toronjil Fresco", "Alimentacion", "Cosecha Fresca", "Aromaticas", "kg",
			"Toronjil (Melissa officinalis) fresco. Hierba aromatica medicinal. Energia: ~1.5 MJ/kg = 0.4 kWh/kg. Fuente: Agribalyse (hierbas aromaticas). Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Moras Frescas", "Alimentacion", "Cosecha Fresca", "Frutas", "kg",
			"Moras (Rubus) frescas. Fruta roja de conuco. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (frutas rojas). Documentado en Feria Conuquera (Alfivegetales, El Junquito).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Leche de Cabra Fresca", "Alimentacion", "Lacteos", "Leche", "L",
			"Leche de cabra fresca. Energia: ~5.0 MJ/kg = 1.4 kWh/kg. Fuente: FAO (produccion animal). Documentado en Feria Conuquera (Silio Sanchez, Lechivita).", "De Patio",
			"", 2, 0, 0, 2, 0},
		{"Queso de Cabra Artesanal", "Alimentacion", "Lacteos", "Quesos", "kg",
			"Queso artesanal de leche de cabra. Energia: ~10 MJ/kg = 2.8 kWh/kg (leche + cuajo + procesamiento). Fuente: LCA productos lacteos. Documentado en Feria Conuquera (Silio Sanchez, Lechivita).", "De Patio",
			"", 3, 0, 0, 3, 0},
		{"Queso de Bufala Artesanal", "Alimentacion", "Lacteos", "Quesos", "kg",
			"Queso artesanal de leche de bufala. Energia: ~12 MJ/kg = 3.3 kWh/kg (leche de bufala + cuajo + procesamiento). Fuente: LCA productos lacteos. Documentado en Feria Conuquera (Lechivita).", "De Patio",
			"", 4, 0, 0, 4, 0},
		{"Ricota Artesanal", "Alimentacion", "Lacteos", "Quesos", "kg",
			"Ricota artesanal. Subproducto del queso, requiere menos energia. Energia: ~8 MJ/kg = 2.2 kWh/kg. Fuente: LCA productos lacteos. Documentado en Feria Conuquera.", "De Patio",
			"", 2, 0, 0, 2, 0},
		{"Yogurt Natural Artesanal", "Alimentacion", "Lacteos", "Yogurt", "kg",
			"Yogurt natural artesanal, sin azucar. Energia: ~4 MJ/kg = 1.1 kWh/kg. Fuente: Agribalyse (yogurt). Documentado en Feria Conuquera (Lechivita).", "De Patio",
			"", 1, 0, 0, 1, 0},
		{"Dulce de Leche Artesanal", "Alimentacion", "Dulces", "Dulce de Leche", "kg",
			"Dulce de leche artesanal. Leche + azucar + coccion prolongada. Energia: ~8 MJ/kg = 2.2 kWh/kg. Fuente: LCA dulce de leche. Documentado en Feria Conuquera (Lechivita).", "De Patio",
			"", 2, 0, 0, 2, 0},
		{"Polen de Abejas", "Alimentacion", "Miel y Apicultura", "Polen", "kg",
			"Polen de abejas. Producto apicola rico en proteinas. Energia: ~3.5 MJ/kg = 1.0 kWh/kg. Fuente: FAO (apicultura). Documentado en Feria Conuquera (Lechivita).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Onoto Natural Fresco", "Alimentacion", "Condimentos", "Especias", "kg",
			"Onoto natural (Bixa orellana) fresco. Condimento tradicional venezolano para hallacas. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (condimentos). Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Curcuma Fresca", "Alimentacion", "Condimentos", "Especias", "kg",
			"Curcuma (Curcuma longa) fresca. Raiz medicinal y condimentaria. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (raices/condimentos). Documentado en Feria Conuquera (SanaTe).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Jengibre Fresco", "Alimentacion", "Condimentos", "Especias", "kg",
			"Jengibre (Zingiber officinale) fresco. Raiz medicinal y condimentaria. Energia: ~3.0 MJ/kg = 0.8 kWh/kg. Fuente: Agribalyse (raices/condimentos). Documentado en Feria Conuquera (SanaTe).", "De Conuco",
			"", 1, 0, 0, 1, 0},
		{"Chocolate Artesanal 80%", "Alimentacion", "Dulces", "Chocolate", "kg",
			"Chocolate artesanal 80% cacao. Variedades Forastero, Criollo y Porcelana de Barlovento y Paria. Sin conservantes ni lecitina. Energia: ~20 MJ/kg = 5.6 kWh/kg. Fuente: LCA chocolate artesanal. Documentado en Feria Conuquera (Cacao Siborori).", "De Conuco",
			"", 6, 0, 0, 6, 0},
		{"Chocolate Artesanal 100%", "Alimentacion", "Dulces", "Chocolate", "kg",
			"Chocolate artesanal 100% cacao (pasta de cacao pura). Sin azucar, sin conservantes, sin lecitina. Variedades Forastero, Criollo y Porcelana. Energia: ~25 MJ/kg = 6.9 kWh/kg. Fuente: LCA cacao puro. Documentado en Feria Conuquera (Cacao Siborori).", "De Conuco",
			"", 7, 0, 0, 7, 0},
		{"Cacao en Polvo Artesanal", "Alimentacion", "Condimentos", "Cacao", "kg",
			"Cacao en polvo artesanal. Molido a partir de grano tostado. Energia: ~20 MJ/kg = 5.6 kWh/kg. Fuente: LCA cacao procesado. Documentado en Feria Conuquera (Cacao Siborori).", "De Conuco",
			"", 6, 0, 0, 6, 0},
		{"Cafe Molido Artesanal", "Alimentacion", "Bebidas", "Cafe", "kg",
			"Cafe molido artesanal. Tostado y molido a partir de grano de conuco. Energia: ~15 MJ/kg = 4.2 kWh/kg. Fuente: Agribalyse (cafe tostado/molido). Documentado en Feria Conuquera (talleres de cultivo de cafe).", "De Conuco",
			"", 4, 0, 0, 4, 0},

		// ============ FERIA CONUQUERA: Productos compuestos (migraciones 094-095) ============
		{"Casabe Artesanal", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "unidad",
			"Casabe artesanal de yuca amarga. Pan ancestral indigena: yuca rallada, prensada en sebucan, tostada en budare. Lote: 1.2 kg yuca -> 6 tortas de ~100g. Energia lote: yuca (3.6 MJ) + coccion 40 min (4 MJ) = 7.6 MJ. Por kg: 12.7 MJ/kg = 3.5 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales + LCA yuca. Documentado en Feria Conuquera (Flor de Tilo).", "De Conuco",
			"", 1, 2, 1, 1, 0},
		{"Naiboa Artesanal", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "unidad",
			"Naiboa artesanal. Primer dulce netamente venezolano. Dos tortas de casabe rellenas con melado de papelon, queso blanco rallado y semillas de anis, horneadas. Lote: 2 casabe (200g) + 50g papelon + 30g queso -> 1 unidad 280g. Energia lote: 5.55 MJ. Por kg: 19.8 MJ/kg = 5.5 kWh/kg. Por unidad (280g): 2 TQ. Fuente: Wikipedia, EcuRed. Documentado en Feria Conuquera (Flor de Tilo).", "De Conuco",
			"", 2, 3, 1, 2, 0},
		{"Catalinas Artesanales", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "unidad",
			"Catalinas (paledonias/cucas negras). Galletas dulces especiadas. Lote: 280g harina + 250g papelon + 100g mantequilla + 1 huevo -> 8 unidades de ~88g. Energia lote: 14.65 MJ. Por kg: 20.9 MJ/kg = 5.8 kWh/kg. Por unidad (88g): 1 TQ. Fuente: recetas tradicionales. Documentado en Feria Conuquera (Flor de Tilo).", "De Conuco",
			"", 1, 3, 1, 2, 0},
		{"Besito de Coco Artesanal", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "unidad",
			"Besito de coco artesanal. Dulce tradicional caribeno. Lote: 200g coco + 300g harina + 200g papelon + 2 huevos -> 20 unidades de ~37g. Energia lote: 13.4 MJ. Por kg: 17.9 MJ/kg = 5 kWh/kg. Por unidad (37g): 1 TQ. Fuente: chefspencil.com, 196flavors.com. Documentado en Feria Conuquera.", "De Conuco",
			"", 1, 2, 1, 2, 0},
		{"Cafunga de Barlovento", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "unidad",
			"Cafunga de Barlovento. Dulce afrovenezolano ancestral. Lote: 500g cambur + 200g papelon + 100g coco -> 5 unidades de ~160g. Energia lote: 8.5 MJ. Por kg: 10.6 MJ/kg = 2.9 kWh/kg. Por unidad (160g): 1 TQ. Productora: Estilita Ruiz. Fuente: Blog oficial Feria Conuquera, Haiman El Troudi.", "De Conuco",
			"", 1, 1, 1, 1, 0},
		{"Pan Artesanal de Masa Madre", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "kg",
			"Pan artesanal de masa madre. Fermentacion natural 24h, horneado en horno artesanal. Lote: 600g harina + 400g agua -> 1 hogaza 800g. Energia lote: 15.4 MJ. Por kg: 19.3 MJ/kg = 5.4 kWh/kg. Precio: 5 TQ/kg. Fuente: LCA pan artesanal. Documentado en Feria Conuquera (Flor de Tilo).", "Hecho en Casa",
			"", 5, 2, 1, 2, 0},
		{"Arepa de Auyama Artesanal", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "unidad",
			"Arepa de auyama artesanal. Lote: 200g harina + 100g auyama -> 6 arepas de ~100g. Energia lote: 5.1 MJ. Por kg: 8.5 MJ/kg = 2.4 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 1, 1, 1, 1, 0},
		{"Arepa de Platano Artesanal", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "unidad",
			"Arepa de platano artesanal. Lote: 200g harina + 100g platano -> 6 arepas de ~100g. Energia lote: 5 MJ. Por kg: 8.3 MJ/kg = 2.3 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales + Lombriz Roja Urbana. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 1, 1, 1, 1, 0},
		{"Torta de Platano Artesanal", "Alimentacion", "Gastronomia Artesanal", "Postres", "porcion",
			"Torta de platano artesanal. Lote: 500g platano + 100g papelon -> 4 porciones de ~150g. Energia lote: 5.5 MJ. Por kg: 9.2 MJ/kg = 2.6 kWh/kg. Por porcion (150g): 1 TQ. Fuente: Prensa Rural. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 1, 1, 1, 1, 0},
		{"Papelon con Limon", "Alimentacion", "Bebidas", "Bebidas Naturales", "L",
			"Papelon con limon (aguapanela). Lote: 200g papelon + 1L agua + 2 limones -> 1L. Energia lote: 4.3 MJ. Por L: 1.2 kWh/L = 1 TQ/L. Fuente: recetas tradicionales + Wikipedia. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 1, 1, 0, 1, 0},
		{"Aguamiel", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Aguamiel. Lote: 150g miel + 1L agua -> 1L. Energia: miel (0.53 MJ) + fermentacion espontanea (0) = 0.53 MJ/L = 0.15 kWh/L. Precio minimo: 1 TQ/L. Fuente: todohidromiel.com. Documentado en Feria Conuquera (Lechivita).", "De Conuco",
			"", 1, 0, 1, 0, 0},
		{"Hidromiel (Vino de Miel)", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Hidromiel (vino de miel). Lote: 300g miel + 2L agua + levadura -> 2L. Energia: miel (1.05 MJ) + levadura (0.1) = 1.15 MJ / 2L = 0.58 MJ/L = 0.16 kWh/L. Precio minimo: 1 TQ/L. Fermentacion 2-4 semanas. Fuente: todohidromiel.com, FAUBA. Documentado en Feria Conuquera (Lechivita).", "De Conuco",
			"", 1, 0, 1, 1, 0},
		{"Cocomiel", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Cocomiel. Lote: 200g miel + 100g coco + 1L agua -> 1L. Energia: miel (0.7) + coco (0.6) + coccion (1.5) = 2.8 MJ/L = 0.8 kWh/L. Precio: 1 TQ/L. Fuente: Ultimas Noticias. Documentado en Feria Conuquera (Lechivita).", "De Conuco",
			"", 1, 1, 1, 1, 0},
		{"Harina de Yuca Artesanal", "Alimentacion", "Gastronomia Artesanal", "Harinas Alternativas", "kg",
			"Harina de yuca artesanal. Lote: 2.5 kg yuca -> 1 kg harina (rendimiento 40%). Energia: yuca (7.5 MJ) + secado (3) + molienda (1) = 11.5 MJ/kg = 3.2 kWh/kg. Precio: 3 TQ/kg. Fuente: LCA cassava flour Nigeria, CIAT. Documentado en Feria Conuquera (Luis Angel Leisiaga).", "De Conuco",
			"", 3, 2, 1, 1, 0},
		{"Harina de Cambur Artesanal", "Alimentacion", "Gastronomia Artesanal", "Harinas Alternativas", "kg",
			"Harina de cambur artesanal. Lote: 5 kg cambur verde -> 1 kg harina (rendimiento 20%). Energia: cambur (9 MJ) + secado (2) + molienda (1) = 12 MJ/kg = 3.3 kWh/kg. Precio: 3 TQ/kg. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).", "De Conuco",
			"", 3, 2, 1, 1, 0},
		{"Jabon Artesanal de Aceite Reciclado", "Salud y Medicina", "Higiene Natural", "Jabones", "unidad",
			"Jabon artesanal de aceite reciclado. Saponificacion en frio. Lote: 500g aceite -> 5-6 barras de 90g. Energia: LCA WCO soap 10 MJ/kg = 2.8 kWh/kg. Por barra (90g): 1 TQ. Curado 4-6 semanas. Fuente: Springer LCA, MDPI Sustainability. Documentado en Feria Conuquera (Territorio K-ribe).", "Limpieza Natural",
			"", 1, 1, 1, 1, 0},
		{"Desodorante Natural Artesanal", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Desodorante natural artesanal. Lote: 150g ingredientes -> 3 barras de 50g. Energia: 11.3 MJ/kg = 3.1 kWh/kg. Por barra (50g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Territorio K-ribe).", "Limpieza Natural",
			"", 1, 1, 1, 1, 0},
		{"Humus de Lombriz Solido", "Agricultura", "Insumos Agroecologicos", "Abonos Organicos", "kg",
			"Humus de lombriz solido. Vermicompostaje con Eisenia foetida, 2-3 meses. Energia: LCA vermicompostaje 2 MJ/kg = 0.6 kWh/kg. Precio minimo: 1 TQ/kg. Fuente: MDPI, scielo.org.mx. Documentado en Feria Conuquera (Lombriz Roja Urbana).", "Agroecologico",
			"", 1, 0, 1, 0, 0},
		{"Humus de Lombriz Liquido", "Agricultura", "Insumos Agroecologicos", "Biofertilizantes", "L",
			"Humus de lombriz liquido (lixiviado). Energia: 1 MJ/L = 0.3 kWh/L. Precio minimo: 1 TQ/L. Presentaciones: 500cc, 1000cc, 1500cc. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.", "Agroecologico",
			"", 1, 0, 1, 0, 0},
		{"Pie de Cria de Lombriz Roja Californiana", "Agricultura", "Insumos Agroecologicos", "Vermicultura", "kg",
			"Pie de cria de lombriz roja californiana (Eisenia foetida). Energia: 3 MJ/kg = 0.8 kWh/kg. Precio minimo: 1 TQ/kg. Presentaciones: 300g, 400g, 1.5kg, 2kg. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.", "Agroecologico",
			"", 1, 0, 1, 1, 0},
		{"Compost Maduro Artesanal", "Agricultura", "Insumos Agroecologicos", "Abonos Organicos", "kg",
			"Compost maduro artesanal. Compostaje 2-6 meses. Energia: LCA compostaje 1.5 MJ/kg = 0.4 kWh/kg. Precio minimo: 1 TQ/kg. Fuente: MDPI. Documentado en Feria Conuquera.", "Agroecologico",
			"", 1, 0, 1, 0, 0},
		{"Microorganismos de Montana", "Agricultura", "Insumos Agroecologicos", "Bioinsumos", "L",
			"Microorganismos de montana (MM). Fermentacion de lactobacilos y levaduras con melaza. Energia: 2 MJ/L = 0.6 kWh/L. Precio minimo: 1 TQ/L. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.", "Agroecologico",
			"", 1, 0, 1, 0, 0},
		{"Croquetas de Soya Artesanales", "Alimentacion", "Gastronomia Artesanal", "Vegetariano", "unidad",
			"Croquetas de soya artesanales. Lote: 200g soya + 50g harina -> 10 croquetas de ~25g. Energia lote: 5.7 MJ. Por kg: 22.8 MJ/kg = 6.3 kWh/kg. Por unidad (25g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).", "Vegetariano",
			"", 1, 2, 1, 2, 0},
		{"Torticas Veganas Artesanales", "Alimentacion", "Gastronomia Artesanal", "Vegetariano", "unidad",
			"Torticas veganas artesanales. Lote: 200g harina + 100g vegetales -> 10 torticas de ~30g. Energia lote: 5.1 MJ. Por kg: 17 MJ/kg = 4.7 kWh/kg. Por unidad (30g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).", "Vegano",
			"", 1, 2, 1, 2, 0},
		{"Chimichurri de Mango Artesanal", "Alimentacion", "Condimentos", "Salsas", "frasco",
			"Chimichurri de mango artesanal. Lote: 300g mango + 100g vinagre -> 1 frasco 250g. Energia lote: 3.9 MJ. Por kg: 15.6 MJ/kg = 4.3 kWh/kg. Por frasco (250g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).", "Hecho en Casa",
			"", 1, 1, 1, 2, 0},
		{"Plantas Medicinales (Maceta)", "Agricultura", "Vivero", "Medicinales", "maceta",
			"Plantas medicinales vivas en maceta. Energia: tierra + semilla/estaca + riego + manejo 2-6 meses = 3.6 MJ/maceta = 1 kWh. Precio: 1 TQ/maceta. Fuente: Blog oficial Feria Conuquera. Documentado en Feria Conuquera (Dokobaka, Madre Selva).", "Agroecologico",
			"", 1, 0, 1, 0, 0},
		{"Semillas Criollas Ancestrales", "Agricultura", "Semillas", "Criollas", "sobre",
			"Semillas criollas y ancestrales. Energia: cosecha + secado + seleccion + almacenamiento = 3.6 MJ/sobre = 1 kWh. Precio: 1 TQ/sobre. 30 especies de leguminosas ancestrales. Fuente: Blog oficial, Diario VEA. Documentado en Feria Conuquera.", "Agroecologico",
			"", 1, 0, 1, 0, 0},

		// ============ FERIA CONUQUERA: Productos compuestos pendientes (migracion 095) ============
		// Estos productos tienen is_composite=true y precio 0 (se calcula por componentes)
		{"Pastelitos de Vegetales Artesanales", "Alimentacion", "Gastronomia Artesanal", "Empanadas", "unidad",
			"Pastelitos de vegetales artesanales. Producto compuesto: harina de trigo, auyama, caraota, queso blanco, aceite vegetal. Energia calculada por componentes. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 0, 0, 0, 0, 0},
		{"Ajiaco Artesanal", "Alimentacion", "Gastronomia Artesanal", "Sopas", "porcion",
			"Ajiaco artesanal. Producto compuesto: carne de res, yuca, name, ocumo, auyama, maiz, caraota, especias. Energia calculada por componentes. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 0, 0, 0, 0, 0},
		{"Hamburguesas Vegetarianas Artesanales", "Alimentacion", "Gastronomia Artesanal", "Vegetariano", "unidad",
			"Hamburguesas vegetarianas artesanales. Producto compuesto: granos (caraota/frijol), vegetales, harina de trigo, condimentos, aceite vegetal. Energia calculada por componentes. Documentado en Feria Conuquera.", "Vegetariano",
			"", 0, 0, 0, 0, 0},
		{"Tacos de Granos Artesanales", "Alimentacion", "Gastronomia Artesanal", "Vegetariano", "unidad",
			"Tacos de granos artesanales. Producto compuesto: granos (caraota/frijol), harina de maiz, encurtidos, chimichurri de mango. Energia calculada por componentes. Documentado en Feria Conuquera.", "Vegetariano",
			"", 0, 0, 0, 0, 0},
		{"Chichas Artesanales", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Chichas artesanales. Producto compuesto: arroz, maiz, papelon, especias. Energia calculada por componentes. Documentado en Feria Conuquera.", "De Conuco",
			"", 0, 0, 0, 0, 0},
		{"Harina Buen Pan", "Alimentacion", "Gastronomia Artesanal", "Harinas Alternativas", "kg",
			"Harina Buen Pan. Producto compuesto: harina de yuca, harina de cambur, harina de trigo. Energia calculada por componentes. Documentado en Feria Conuquera.", "De Conuco",
			"", 0, 0, 0, 0, 0},
		{"Frutos Deshidratados Artesanales", "Alimentacion", "Gastronomia Artesanal", "Snacks", "unidad",
			"Frutos deshidratados artesanales. Producto compuesto: mango, cambur, papaya, guayaba. Energia calculada por componentes. Documentado en Feria Conuquera.", "De Conuco",
			"", 0, 0, 0, 0, 0},
		{"Encurtidos Artesanales", "Alimentacion", "Condimentos", "Salsas", "frasco",
			"Encurtidos artesanales. Producto compuesto: vegetales (cebolla/zanahoria/pimenton), vinagre, sal, especias. Energia calculada por componentes. Documentado en Feria Conuquera.", "Hecho en Casa",
			"", 0, 0, 0, 0, 0},
		{"Infusiones Naturales Mezcladas", "Salud y Medicina", "Medicina Botanica", "Infusiones", "caja",
			"Infusiones naturales mezcladas. Producto compuesto: moringa, toronjil, manzanilla, malojillo, jengibre, curcuma. Energia calculada por componentes. Documentado en Feria Conuquera (SanaTe).", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Vinos Artesanales de Frutas", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Vinos artesanales de frutas. Producto compuesto: frutas, papelon, levadura. Energia calculada por componentes. Documentado en Feria Conuquera.", "De Conuco",
			"", 0, 0, 0, 0, 0},
		{"Licores Artesanales", "Alimentacion", "Bebidas", "Fermentados", "L",
			"Licores artesanales. Producto compuesto: base alcoholica, frutas, especias, papelon. Energia calculada por componentes. Documentado en Feria Conuquera.", "De Conuco",
			"", 0, 0, 0, 0, 0},
		{"Aceite de Coco Cosmetico", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Aceite de coco cosmetico. Producto compuesto: coco. Energia calculada por componentes. Documentado en Feria Conuquera (Territorio K-ribe).", "Limpieza Natural",
			"", 0, 0, 0, 0, 0},
		{"Arcilla para la Piel", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Arcilla para la piel. Producto compuesto: arcilla mineral. Energia calculada por componentes. Documentado en Feria Conuquera.", "Limpieza Natural",
			"", 0, 0, 0, 0, 0},
		{"Cremas y Emulsiones Naturales", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Cremas y emulsiones naturales. Producto compuesto: aceite de coco, cera de abejas, aceites esenciales, agua. Energia calculada por componentes. Documentado en Feria Conuquera.", "Limpieza Natural",
			"", 0, 0, 0, 0, 0},
		{"Mascarillas Faciales Naturales", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Mascarillas faciales naturales. Producto compuesto: arcilla mineral, aceite de coco, extractos vegetales. Energia calculada por componentes. Documentado en Feria Conuquera.", "Limpieza Natural",
			"", 0, 0, 0, 0, 0},
		{"Labiales Naturales", "Salud y Medicina", "Higiene Natural", "Cosmetica", "unidad",
			"Labiales naturales. Producto compuesto: cera de abejas, aceite de coco, onoto (colorante natural). Energia calculada por componentes. Documentado en Feria Conuquera.", "Limpieza Natural",
			"", 0, 0, 0, 0, 0},
		{"Balsamos y Tinturas Naturales", "Salud y Medicina", "Medicina Botanica", "Tinturas", "frasco",
			"Balsamos y tinturas naturales. Producto compuesto: extractos vegetales, alcohol, aceites esenciales. Energia calculada por componentes. Documentado en Feria Conuquera (SanaTe).", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Plantas Ornamentales (Maceta)", "Agricultura", "Vivero", "Ornamentales", "maceta",
			"Plantas ornamentales en maceta. Producto compuesto: tierra abonada, semilla/estaca, maceta. Energia calculada por componentes. Documentado en Feria Conuquera.", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Plantas Frutales (Maceta)", "Agricultura", "Vivero", "Frutales", "maceta",
			"Plantas frutales en maceta. Producto compuesto: tierra abonada, semilla/estaca, maceta. Energia calculada por componentes. Documentado en Feria Conuquera.", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Matas de Moringa", "Agricultura", "Vivero", "Medicinales", "maceta",
			"Matas de moringa. Producto compuesto: tierra abonada, estaca/semilla de moringa, maceta. Energia calculada por componentes. Documentado en Feria Conuquera.", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Moringa en Polvo", "Salud y Medicina", "Medicina Botanica", "Suplementos", "kg",
			"Moringa en polvo. Producto compuesto: hojas de moringa. Energia calculada por componentes. Documentado en Feria Conuquera (SanaTe).", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Gotas de Nin", "Salud y Medicina", "Medicina Botanica", "Tinturas", "frasco",
			"Gotas de Nin. Producto compuesto: extracto de Nin (Justicia pectoralis), alcohol, agua. Energia calculada por componentes. Documentado en Feria Conuquera (SanaTe).", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Biofertilizantes Artesanales", "Agricultura", "Insumos Agroecologicos", "Biofertilizantes", "L",
			"Biofertilizantes artesanales. Producto compuesto: estiercol, melaza/papelon, minerales, microorganismos de montana. Energia calculada por componentes. Documentado en Feria Conuquera.", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Controles Biologicos", "Agricultura", "Insumos Agroecologicos", "Bioinsumos", "L",
			"Controles biologicos. Producto compuesto: hongos beneficiosos, bacterias beneficiosas, agua. Energia calculada por componentes. Documentado en Feria Conuquera.", "Agroecologico",
			"", 0, 0, 0, 0, 0},
		{"Cesteria Artesanal", "Cultura", "Artesania", "Cesteria", "unidad",
			"Cesteria artesanal. Producto compuesto: fibras vegetales (mimbre/paja/bejuco). Energia calculada por componentes. Documentado en Feria Conuquera.", "Artesanal",
			"", 0, 0, 0, 0, 0},
		{"Horno de Barro Artesanal", "Construccion", "Artesanal", "Hornos", "unidad",
			"Horno de barro artesanal. Producto compuesto: barro, arena, ladrillos. Energia calculada por componentes. Documentado en Feria Conuquera.", "Artesanal",
			"", 0, 0, 0, 0, 0},
	}

	for _, p := range products {
		// Solo insertar si no existe ya para este dominio
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url,
			                      price_per_unit, is_approved, is_system, product_code,
			                      energy_direct, energy_human, energy_inputs, energy_amortization)
			SELECT $1, $2, $3, $4, $5, 'internal', $6, $7, $8, $9, $10, true, true, '',
			       $11, $12, $13, $14
			WHERE NOT EXISTS (
				SELECT 1 FROM products WHERE node_domain = $1 AND name = $2
			)`,
			nodeDomain, p.name, p.parentCategory, p.category, p.subcategory, p.unit, p.description, p.badge, p.imageURL, p.price,
			p.energyDirect, p.energyHuman, p.energyInputs, p.energyAmort)
		if err != nil {
			log.Printf("Warning: failed to seed product %s: %v", p.name, err)
		}
	}

	// === Correcciones post-seed: campos adicionales que el struct no tiene ===
	// Estos campos (price_per_kg, base_unit, weight_kg) fueron agregados por
	// migraciones 085-095 y deben estar en el seed permanente para sobrevivir
	// reseteos de BD.

	// Eliminar "Huevos Frescos" viejo si quedo de seeds anteriores
	_, _ = d.Pool.Exec(ctx, `DELETE FROM products WHERE node_domain = $1 AND name = 'Huevos Frescos'`, nodeDomain)

	// Tabla de correcciones: name, price_per_kg, base_unit, weight_kg, price_per_unit, energy_inputs
	// Valores de migraciones 085-092 (correcciones de energia y precios)
	type correction struct {
		name         string
		pricePerKg   float64
		baseUnit     string
		weightKg     float64
		pricePerUnit float64
		energyInputs float64
	}
	corrections := []correction{
		// Huevos (migracion 090-092): 3 categorias
		{"Huevos Comerciales (Jaula)", 4.62, "kg", 0.65, 3.00, 4.62},
		{"Huevos Criollos (Semilibres)", 9.23, "kg", 0.65, 6.00, 9.23},
		{"Huevos de Gallinas Felices (Pastoreo)", 12.31, "kg", 0.65, 8.00, 12.31},
		// Carnes (migracion 085): corregir energia
		{"Carnes de Pollo y Aves", 5, "kg", 1, 5, 5},
		{"Carnes de Cerdo y Chivo", 6, "kg", 1, 6, 6},
		{"Carnes de Vacuno", 11, "kg", 1, 11, 11},
		{"Pescados y Mariscos", 7, "kg", 1, 7, 7},
		// Granos (migracion 086): bajar de 10/11/10 a 3/4/4
		{"Granos Basicos Criollos", 3, "kg", 1, 3, 3},
		{"Arroz y Legumbres", 4, "kg", 1, 4, 4},
		{"Harinas Integrales", 4, "kg", 1, 4, 4},
		// Panaderia (migracion 086): bajar de 5 a 4
		{"Panaderia y Masas Caseras", 4, "kg", 1, 4, 4},
		// Papelon (migracion 086): bajar de 15 a 5
		{"Papelon y Panela", 5, "kg", 1, 5, 5},
		// Aceites (migracion 086): bajar de 10 a 6
		{"Aceites y Vinagres", 6, "L", 0.92, 6, 6},
		// Dulces (migracion 086-091): 5 TQ/kg x 0.5 kg = 2.50
		{"Dulces y Conservas Tradicionales", 5, "kg", 0.5, 2.50, 5},
		{"La Tradicional Cafunga de Barlovento", 5, "kg", 0.5, 2.50, 5},
		{"Encurtidos y Salsas", 5, "kg", 0.5, 2.50, 5},
		// Cacao (migracion 086): bajar de 25 a 15
		{"Cacao, Chocolate y Cafe", 15, "kg", 1, 15, 15},
		{"Cacao Puro, Chocolates y Cafe de Montana", 15, "kg", 1, 15, 15},
		// Miel (migracion 086): bajar de 10 a 7
		{"Miel Pura de Abejas", 7, "L", 1.42, 7, 7},
		// Bebidas fermentadas (migracion 086): bajar de 5 a 3
		{"Bebidas Fermentadas", 3, "L", 1, 3, 3},
		// Especias (migracion 086): bajar de 15 a 4
		{"Especias y Condimentos", 4, "kg", 1, 4, 4},
		// Abonos (migracion 086-088): 0.09 TQ/kg x 25 kg = 2.25
		{"Abonos Organicos", 0.09, "kg", 25, 2.25, 2},
		// Bioinsumos
		{"Bioinsumos y Preparados", 3, "L", 1, 3, 3},
		// Hongos (migracion 086): bajar a 3
		{"Hongos Comestibles", 3, "kg", 1, 3, 3},
		// Plaguicidas (migracion 086): bajar a 2
		{"Plaguicidas Naturales", 2, "L", 1, 2, 2},
		// Tierra/Sustratos: 0.05 TQ/kg x 20 kg = 1.00
		{"Tierra Fertil y Sustratos", 0.05, "kg", 20, 1.00, 1},
		// Leche: 2 TQ/L
		{"Leche Fresca", 2, "L", 1.03, 2, 2},
		// Lena: 4 TQ/kg
		{"Lena Seca para Cocinar", 4, "kg", 1, 4, 4},
		// Carbon: 6 TQ/kg
		{"Carbon Vegetal", 6, "kg", 1, 6, 6},
		// Diesel: 12 TQ/L
		{"Diesel Agricola", 12, "L", 0.832, 12, 12},
		// Infusiones: 3 TQ/kg
		{"Infusiones y Tes", 3, "kg", 1, 3, 3},
		// Hierbas medicinales: 3 TQ/kg
		{"Hierbas Medicinales Secas", 3, "kg", 1, 3, 3},
		// Detergentes: 5 TQ/L
		{"Detergentes y Suavizantes Naturales", 5, "L", 1, 5, 5},
		// Pinturas: 4 TQ/L
		{"Pinturas y Recubrimientos Naturales", 4, "L", 1, 4, 4},
		// Coco: 1.4 TQ/kg x 1.5 kg = 2.10
		{"Coco Fresco", 1.4, "kg", 1.5, 2.10, 2},
		// Canasta basica (migracion 086): recalcular a 30 TQ (era 66)
		{"Canasta Basica Familiar Semanal", 0, "canasta", 0, 30, 30},
	}
	for _, c := range corrections {
		_, _ = d.Pool.Exec(ctx, `
			UPDATE products SET
				price_per_kg = $3, base_unit = $4, weight_kg = $5,
				price_per_unit = $6, energy_inputs = $7
			WHERE node_domain = $1 AND name = $2`,
			nodeDomain, c.name, c.pricePerKg, c.baseUnit, c.weightKg, c.pricePerUnit, c.energyInputs)
	}

	// Actualizar descripciones de productos corregidos (migracion 085-086)
	descUpdates := []struct{ name, desc string }{
		{"Carnes de Pollo y Aves", "Pollo de patio, gallina, pato, conejo. Energia: ~18 MJ/kg = 5 kWh/kg (rango 9.6-25, conversion 2.0 kg pienso/kg carne). El pollo usa 45% mas energia que los huevos por kg (FAO 2013). Fuente: FAO, Pimentel, Agribalyse, Leinonen et al. (2012)."},
		{"Carnes de Cerdo y Chivo", "Cerdo criollo, chivo. Energia: ~20 MJ/kg = 5.5 kWh/kg (rango 15.9-22.7, conversion 6.5 kg pienso/kg). Fuente: FAO, Agribalyse, review de Vries (2010)."},
		{"Carnes de Vacuno", "Carne de res, vacuno pastoreado. Energia: ~40 MJ/kg = 11 kWh/kg (rango 35-50, conversion 25 kg forraje/kg). La carne de vacuno es la que mas energia consume: 7.5x mas que el pollo. Fuente: Pimentel, Cederberg, Ecoinvent, Agribalyse."},
		{"Pescados y Mariscos", "Pescado fresco de rio, salado, carite, cazon, camarones. Energia estimada: ~25 MJ/kg = 7 kWh/kg (captura + cadena de frio). Fuente: FAO, Ecoinvent."},
		{"Granos Basicos Criollos", "Maiz criollo blanco y amarillo, cebada, avena, centeno. Energia: ~10 MJ/kg = 3 kWh/kg (conuco: siembra manual, cosecha, secado). Industrial: 1.9-4.9 MJ/kg. Fuente: Agribalyse, Albania LCA, Canada LCA, Iran LCA."},
		{"Arroz y Legumbres", "Arroz procesado, sorgo, legumbres (caraota, frijol, quinchoncho, lentejas, garbanzos, habas). Energia: ~14 MJ/kg = 4 kWh/kg (conuco). Industrial: 7 MJ/kg. Fuente: Agribalyse, Ecoinvent, FAO."},
		{"Harinas Integrales", "Harina de maiz, trigo integral, yuca (casabe), platano, quinoa. Energia: ~14 MJ/kg = 4 kWh/kg (grano + molienda artesanal). Industrial: 6 MJ/kg. Fuente: Agribalyse, Piringer & Steinberg 2006."},
		{"Panaderia y Masas Caseras", "Pan de maiz, trigo integral, arepas, cachapas, bollos, empanadas. Energia: ~14 MJ/kg = 4 kWh/kg (molienda + amasado + horneado artesanal). Industrial: 5.2 MJ/kg. Fuente: JRC Europa, Agribalyse, FOB UK."},
		{"Papelon y Panela", "Azucar, papelon, panela, rapadura, melaza de cana. Energia: ~18 MJ/kg = 5 kWh/kg (cultivo + coccion con lena). NCS moderno: 5 MJ/kg. Fuente: TechScience NCS study, LCA panela Ecuador."},
		{"Aceites y Vinagres", "Aceite de coco, ajonjisi, palma, vinagre de cana. Energia: ~20 MJ/L = 6 kWh/L (prensado en frio + extraccion). Refinado industrial: 20-40 MJ/L. Fuente: Agribalyse, IOPscience coconut oil LCA, Sciencedirect sunflower oil LCA."},
		{"Dulces y Conservas Tradicionales", "Dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo, encurtidos, salsas. Energia: ~18 MJ/kg = 5 kWh/kg (cocccion + conservacion). Fuente: Agribalyse."},
		{"Cacao, Chocolate y Cafe", "Cacao fermentado de Barlovento/Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena. Energia: ~54 MJ/kg = 15 kWh/kg (fermentacion + secado + torrefaccion artesanal). Chocolate industrial: 91 MJ/kg. Fuente: FOB UK, Agribalyse."},
		{"Miel Pura de Abejas", "Miel multifleural de montana, bosque, azahar. Energia: ~25 MJ/kg = 7 kWh/kg (apicultura + extraccion + filtrado). Fuente: Energy balance lavender honey, Turquia."},
		{"Bebidas Fermentadas", "Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha. Energia: ~10 MJ/L = 3 kWh/L (fermentacion natural). Fuente: Agribalyse."},
		{"Especias y Condimentos", "Comino, oregano, pimienta, aji dulce/picante, onoto, cilantro seco, laurel. Energia: ~14 MJ/kg = 4 kWh/kg (secado + molienda). Fuente: Agribalyse."},
		{"Abonos Organicos", "Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza. Energia: ~0.3 MJ/kg = 0.09 kWh/kg (proceso de descomposicion controlada). Un saco de ~25 kg = ~2 kWh. Fuente: Nigeria organic fertilizer study, Italy on-farm compost LCA."},
		{"Hongos Comestibles", "Hongos comestibles (champinones, setas, hongos ostra). Energia: ~10 MJ/kg = 3 kWh/kg (sustrato + climatizacion + cosecha). Fuente: Iran mushroom LCA."},
		{"Plaguicidas Naturales", "Plaguicidas naturales: extractos de neem, ajo, ajonjoli, repelentes botanicos. Energia: ~7 MJ/L = 2 kWh/L (extraccion + ingredientes). Fuente: Agribalyse."},
		{"Canasta Basica Familiar Semanal", "Canasta semanal para familia de 4-5 personas. Contenido: 3kg granos basicos (maiz, frijol, arroz) = 9 TQ, 2kg verduras frescas = 4 TQ, 1kg frutas de temporada = 2 TQ, 0.5kg carne de pollo = 2.5 TQ, 1L leche fresca = 2 TQ, 0.5L aceite vegetal = 3 TQ, 0.5kg panela/azucar = 2.5 TQ, 1 docena huevos = 3 TQ, 100g especias = 1 TQ. Energia total: ~29 TQ. Precio redondeado: 30 TQ."},
	}
	for _, du := range descUpdates {
		_, _ = d.Pool.Exec(ctx, `UPDATE products SET description = $3 WHERE node_domain = $1 AND name = $2`,
			nodeDomain, du.name, du.desc)
	}

	// === Marcar productos compuestos (is_composite=true) ===
	// Estos productos tienen precio 0 porque su precio se calcula por componentes
	compositeProducts := []string{
		"Pastelitos de Vegetales Artesanales",
		"Ajiaco Artesanal",
		"Hamburguesas Vegetarianas Artesanales",
		"Tacos de Granos Artesanales",
		"Chichas Artesanales",
		"Harina Buen Pan",
		"Frutos Deshidratados Artesanales",
		"Encurtidos Artesanales",
		"Infusiones Naturales Mezcladas",
		"Vinos Artesanales de Frutas",
		"Licores Artesanales",
		"Aceite de Coco Cosmetico",
		"Arcilla para la Piel",
		"Cremas y Emulsiones Naturales",
		"Mascarillas Faciales Naturales",
		"Labiales Naturales",
		"Balsamos y Tinturas Naturales",
		"Plantas Ornamentales (Maceta)",
		"Plantas Frutales (Maceta)",
		"Matas de Moringa",
		"Moringa en Polvo",
		"Gotas de Nin",
		"Biofertilizantes Artesanales",
		"Controles Biologicos",
		"Cesteria Artesanal",
		"Horno de Barro Artesanal",
	}
	for _, cp := range compositeProducts {
		_, _ = d.Pool.Exec(ctx, `UPDATE products SET is_composite = true WHERE node_domain = $1 AND name = $2`,
			nodeDomain, cp)
	}

	log.Printf("Seeded %d products to node_domain=%s", len(products), nodeDomain)
	return nil
}

// SeedAssemblyConfig inserta la configuracion de asamblea para el dominio del nodo.
// Las migraciones 014, 052, 055, 082 insertan configuracion solo para 'localhost'.
// Esta funcion asegura que cualquier nodo tenga su configuracion al instalarse.
func (d *DB) SeedAssemblyConfig(ctx context.Context, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}

	// === 1. Configuracion de quorum (assembly_quorum_config) ===
	// Migracion 052 + 082: quorum por tipo de sesion y tipo de reunion
	quorumConfigs := []struct {
		sessionType  string
		meetingType  string
		quorumFirst  float64
		quorumSecond float64
		gracePeriod  int
		allowResched bool
		maxRecall    int
	}{
		// Asamblea general (meeting_type = '' o 'assembly')
		{"ordinaria", "", 50.00, 30.00, 1, true, 1},
		{"extraordinaria", "", 66.67, 50.00, 1, true, 1},
		{"urgente", "", 75.00, 50.00, 0, true, 2},
		// Junta directiva (meeting_type = 'board') - migracion 082
		{"ordinaria", "board", 50.0, 30.0, 0, true, 1},
		{"extraordinaria", "board", 50.0, 30.0, 0, true, 1},
		{"urgente", "board", 40.0, 25.0, 0, false, 0},
	}
	for _, qc := range quorumConfigs {
		_, _ = d.Pool.Exec(ctx, `
			INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
			SELECT $1, $2, $3, $4, $5, $6, $7, $8, true
			WHERE NOT EXISTS (
				SELECT 1 FROM assembly_quorum_config
				WHERE node_domain = $1 AND session_type = $2
				AND COALESCE(meeting_type, '') = COALESCE($3, '')
			)`,
			nodeDomain, qc.sessionType, qc.meetingType, qc.quorumFirst, qc.quorumSecond,
			qc.gracePeriod, qc.allowResched, qc.maxRecall)
	}

	// === 2. Configuracion de frecuencia (assembly_frequency_config) ===
	// Migracion 055: frecuencia de convocatoria automatica
	_, _ = d.Pool.Exec(ctx, `
		INSERT INTO assembly_frequency_config (node_domain, scope, scope_id, ordinary_frequency_months, preferred_day_of_month, preferred_hour, assemblies_enabled, notification_days_before, is_active)
		SELECT $1, 'node', NULL, 3, 15, 15, true, 7, true
		WHERE NOT EXISTS (
			SELECT 1 FROM assembly_frequency_config
			WHERE node_domain = $1 AND scope = 'node' AND scope_id IS NULL
		)`, nodeDomain)

	// === 3. Configuracion de aprobaciones (assembly_config) ===
	// Migracion 014 + 082: metodo de aprobacion por tipo de propuesta
	// 082 reclasifica algunas decisiones operativas a junta directiva
	assemblyConfigs := []struct {
		proposalType   string
		approvalMethod string
		percentage     float64
		description    string
	}{
		// Decisiones operativas -> junta directiva (migracion 082)
		{"create_account", "board", 50.00, "Creacion de cuentas - junta directiva (mayoria simple)"},
		{"limit_change", "board", 50.00, "Cambios de limites de credito/debito - junta directiva (mayoria simple)"},
		{"product_modification", "board", 50.00, "Modificacion de productos - junta directiva (mayoria simple)"},
		{"fund_distribution", "board", 50.00, "Distribucion del fondo - junta directiva (mayoria simple)"},
		{"budget_increase", "board", 50.00, "Aumento de presupuesto - junta directiva (mayoria simple)"},
		// Decisiones grandes/constitutivas -> asamblea
		{"admission", "assembly", 50.00, "Admision de nuevos miembros - mayoria simple"},
		{"expulsion", "assembly", 75.00, "Expulsion de miembro - 75% de la asamblea"},
		{"member_level", "assembly", 50.00, "Crear/modificar niveles de miembro - mayoria simple"},
		{"org_level", "assembly", 50.00, "Crear/modificar niveles de organizacion - mayoria simple"},
		{"tax_change", "assembly", 66.67, "Cambios de impuestos - 2/3 de la asamblea"},
		{"energy_rate_change", "assembly", 66.67, "Cambio de tarifas energeticas - 2/3 de la asamblea"},
		{"federation_config", "assembly", 66.67, "Configuracion de federacion - 2/3 de la asamblea"},
		{"recovery_config", "multisig", 100.00, "Configuracion de recuperacion - multi-firma"},
		{"policy", "assembly", 50.00, "Politicas generales - mayoria simple"},
		{"free_proposal", "assembly", 50.00, "Propuesta libre - mayoria simple"},
	}
	for _, ac := range assemblyConfigs {
		_, _ = d.Pool.Exec(ctx, `
			INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
			SELECT $1, $2, $3, $4, 0, 1, $5, true
			WHERE NOT EXISTS (
				SELECT 1 FROM assembly_config WHERE node_domain = $1 AND proposal_type = $2
			)`,
			nodeDomain, ac.proposalType, ac.approvalMethod, ac.percentage, ac.description)
	}

	// === 4. Tipos de propuestas (assembly_proposal_types) ===
	// Migracion 055: tipos de propuestas por scope
	// Estos son globales (no por node_domain) pero los insertamos por si acaso
	proposalTypes := []struct {
		scope, proposalType, label, description string
		sortOrder                               int
	}{
		{"node", "limit_change", "Cambio de limites", "Cambiar limites de credito/debito", 1},
		{"node", "tax_change", "Cambio de impuesto", "Cambiar tasa de impuesto", 2},
		{"node", "member_level", "Nivel de miembro", "Crear/modificar niveles de miembro", 3},
		{"node", "admission", "Admision", "Admitir nuevo miembro", 4},
		{"node", "expulsion", "Expulsion", "Expulsar miembro", 5},
		{"node", "budget_increase", "Aumento de presupuesto", "Aumentar presupuesto", 6},
		{"node", "fund_distribution", "Distribucion de fondos", "Distribuir fondos", 7},
		{"node", "energy_rate_change", "Cambio tarifa energetica", "Cambiar tarifa energetica", 8},
		{"node", "federation_config", "Config federacion", "Configuracion de federacion", 9},
		{"node", "recovery_config", "Config recuperacion", "Configuracion de recuperacion", 10},
		{"node", "policy", "Politica general", "Politica general del nodo", 11},
		{"node", "create_account", "Creacion de cuenta", "Crear cuenta contable", 12},
		{"node", "product_modification", "Modificacion de producto", "Modificar producto del catalogo", 13},
		{"node", "governance_rule", "Regla de gobernanza", "Crear/modificar regla de gobernanza", 14},
		{"node", "free_proposal", "Propuesta libre", "Propuesta sobre cualquier tema", 15},
		{"node", "product_import", "Importar producto federado", "Proponer importar un producto de otro nodo federado", 16},
		{"node", "product_remove", "Remover producto", "Proponer remover/desaprobar un producto del catalogo local", 17},
		{"node", "product_to_base", "Convertir a producto base", "Proponer convertir un producto compuesto en producto base/materia prima", 18},
		{"node", "fund_external_commerce", "Fondear Comercio Exterior", "Transferir TQ a la cuenta de Comercio Exterior para compras externas", 19},
		{"node", "external_bank_account", "Cuenta bancaria externa", "Agregar o modificar cuenta bancaria del Comercio Exterior", 20},
		{"node", "external_commerce_config", "Config DEX", "Cambiar configuracion del Comercio Exterior (multi-firma, firmantes)", 21},
	}
	for _, pt := range proposalTypes {
		_, _ = d.Pool.Exec(ctx, `
			INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order, is_active)
			SELECT $1, $2, $3, $4, $5, true
			WHERE NOT EXISTS (
				SELECT 1 FROM assembly_proposal_types WHERE scope = $1 AND proposal_type = $2
			)`,
			pt.scope, pt.proposalType, pt.label, pt.description, pt.sortOrder)
	}

	log.Printf("Seeded assembly config for node_domain=%s", nodeDomain)
	return nil
}
