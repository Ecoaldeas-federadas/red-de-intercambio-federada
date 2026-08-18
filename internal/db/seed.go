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

// SeedPublicPages inserta o actualiza las paginas del sitio publico con
// la plantilla modular rica y datos reales de la Feria Conuquera en Caracas.
func (d *DB) SeedPublicPages(ctx context.Context, nodeDomain string) error {
	pages := []seedPage{
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
    "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
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
        "image_url": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80",
        "title": "Hortalizas Frescas y Rubros Ancestrales",
        "caption": "Cosechadas en la madrugada en El Junquito y La Pastora para venta directa en moneda local.",
        "tag": "Cosecha del Día"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80",
        "title": "Botica Conuquera y Medicina Tradicional",
        "caption": "Tinturas de propóleo, pomadas botánicas, aceites esenciales y plantas medicinales.",
        "tag": "Salud Botánica"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80",
        "title": "Gastronomía Artesanal y Ancestral",
        "caption": "La tradicional Cafunga de Barlovento, harinas sin gluten, cacao puro y café de montaña.",
        "tag": "Sabores Soberanos"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=1000&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "�️ Estructura y Organización",
    "title": "Vida Organizativa Más Allá del Mercado",
    "subtitle": "Asambleas trimestrales, comisiones y trabajo colectivo",
    "content": "La Feria Conuquera no es solo el evento de venta del primer sábado de cada mes. Contamos con una estructura organizativa sólida y horizontal:\n\n• Asambleas Trimestrales: Cada 3 meses, todos los colectivos y familias productoras se reúnen en asamblea formal para evaluar el funcionamiento, admitir nuevos proyectos y debatir políticas colectivas.\n• Comisiones de Trabajo: Se conforman comisiones periódicas para la logística, comunicación, bioinsumos, cultura y articulación comunitaria.\n• Actividades y Cayapas de Campo: Organizamos jornadas de trabajo voluntario y formativo en los conucos y unidades productivas en El Junquito, La Pastora, Baruta y Valles del Tuy.",
    "image_url": "https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
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
    "title": "Límites y Confianza Progresiva",
    "subtitle": "El sistema crece contigo: entre más participas, más confianza acumulas",
    "columns": 3,
    "items": [
      {"icon":"users","title":"Personas Naturales","description":"Cada persona natural que ingresa recibe un límite inicial de saldo negativo (por ejemplo, -50 TQ) y un límite positivo equivalente. Esto significa que puedes recibir hasta 50 TQ en bienes y servicios sin haber aportado nada todavía. Es la confianza inicial que la comunidad te otorga para que empieces a participar.","badge":"Límite inicial"},
      {"icon":"building","title":"Organizaciones y Colectivos","description":"Las organizaciones, cooperativas y colectivos registrados tienen límites más amplios porque su volumen de intercambio es mayor. Una organización puede tener un límite de -200 TQ o más, según su tamaño y trayectoria. Esto permite que las organizaciones puedan recibir insumos y herramientas a crédito y retribuir con su producción colectiva.","badge":"Límite ampliado"},
      {"icon":"trending-up","title":"Tu límite sube con el tiempo","description":"A medida que participas activamente, aportas regularmente y cumples tus compromisos, la asamblea puede aumentar tu límite. La confianza se construye con hechos, no con dinero. Un miembro con un año de participación activa y buen cumplimiento puede tener un límite 3 o 4 veces mayor que al ingresar.","badge":"Crece contigo"},
      {"icon":"shield","title":"Sin dinero para entrar","description":"No necesitas dinero para ingresar ni para recibir beneficios. No pagas inscripción, no compras monedas, no necesitas tener ahorros. El sistema está diseñado para incluir a quienes no tienen acceso al dinero o al sistema bancario. Tu capacidad de recibir y aportar se basa en tu compromiso comunitario, no en tu capital.","badge":"Sin barreras"},
      {"icon":"heart","title":"Recibir sin tener","description":"Puedes recibir beneficios sin tener nada previo. Recibes alimentos, medicinas, servicios o herramientas y quedas en compromiso negativo. Ese compromiso lo saldas aportando tu trabajo, tu cosecha o tus productos cuando puedas. Es la esencia del trueque diferido: hoy recibes, mañana aportas.","badge":"Recibir primero"},
      {"icon":"rotate-cw","title":"Aportar para salir de deuda","description":"Cuando tu saldo es negativo, no hay cobradores ni intereses. Simplemente aportas lo que produces: cosecha, pan, artesanía, trabajo en la feria, talleres, cayapas. Cada aporte reduce tu saldo negativo hasta llegar a cero o volverse positivo. La comunidad te acompaña, no te presiona.","badge":"Aportar y sanar"}
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
      {"icon":"beef","title":"Carnes y proteína animal","description":"Vacuno: 80-100 MJ/kg = 22-28 TQ/kg (conversión 31.7 kg forraje/kg). Cerdo: 47.5 MJ/kg = 13.2 TQ/kg (conversión 10.7 kg pienso/kg). Pollo: 30 MJ/kg = 8.3 TQ/kg (conversión 4.2 kg pienso/kg). Huevos: 34.4 MJ/kg = 9.6 TQ/kg. La jerarquía trófica explica por qué la carne de res cuesta 3 veces más que el pollo: requiere 7.5 veces más pienso por kilogramo. Fuentes: Pimentel, Ecoinvent, Agribalyse.","badge":"Carnes"},
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
    "image_url": "https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Preguntas Frecuentes de Visitantes y Productores",
    "items": [
      {
        "question": "¿Necesito ser miembro de la feria para comprar productos?",
        "answer": "¡No! El evento del primer sábado de cada mes en Parque Los Caobos es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local."
      },
      {
        "question": "¿Quiénes pueden participar en los intercambios de trueque?",
        "answer": "El trueque directo y el sistema de crédito mutuo (Trueque TQ) está disponible para los miembros y colectivos registrados en la red. Si deseas participar formalmente en los intercambios de crédito mutuo o traer tu propia producción a la feria, puedes llenar la solicitud de admisión para ser evaluado por la asamblea."
      },
      {
        "question": "¿Cómo se organiza la Feria Conuquera más allá del día de mercado?",
        "answer": "La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos fuera de Caracas."
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
        "answer": "En cada jornada mensual se ofrecen talleres gratuitos de siembra y lombricultura, trueque libre de semillas criollas, intercambio de libros ('Dona y adopta un libro'), música popular en vivo y actividades lúdicas para niños y familias."
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
    "image_url": "https://images.unsplash.com/photo-1746474072546-9fbda10daffe?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
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
	}

	for _, p := range pages {
		_, err := d.Pool.Exec(ctx,
			`INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
			 ON CONFLICT (node_domain, slug) DO UPDATE SET
			   title = EXCLUDED.title,
			   subtitle = EXCLUDED.subtitle,
			   content = EXCLUDED.content,
			   icon = EXCLUDED.icon,
			   menu_order = EXCLUDED.menu_order,
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
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 1, 0, 1, 0, 0},
		{"Jornada Agricola Completa", "Servicios", "Trabajo Agricola", "Jornadas", "jornada",
			"Jornada completa de trabajo manual agricola (8h x 0.61 kWh/h = 4.88 kWh).", "Conuquero",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 5, 0, 5, 0, 0},
		// --- Trabajo General (1.0 kWh/h) ---
		{"Jornada de Trabajo General", "Servicios", "Trabajo General", "Jornadas", "jornada",
			"Jornada completa de trabajo general/servicios (8h x 1.0 kWh/h = 8 kWh). Limpieza, atencion, gestion.", "General",
			"https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80", 8, 0, 8, 0, 0},
		{"Limpieza de Espacios", "Servicios", "Limpieza", "General", "hora",
			"Limpieza de espacios comunes, casas, talleres, desinfeccion. Metabolismo basal + herramientas.", "Aseo",
			"https://images.unsplash.com/photo-1581578731548-cba46ace809f?auto=format&fit=crop&w=600&q=80", 1, 0, 1, 0, 0},
		{"Trabajo Administrativo y Gestion", "Servicios", "Oficina", "Administrativo", "hora",
			"Contabilidad, gestion documental, tramites, redaccion. Trabajo general 1.0 kWh/h.", "Gestion",
			"https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80", 1, 0, 1, 0, 0},
		// --- Trabajo Tecnico (3.0 kWh/h) ---
		{"Jornada de Trabajo Tecnico", "Servicios", "Trabajo Tecnico", "Jornadas", "jornada",
			"Jornada completa de trabajo tecnico especializado (8h x 3.0 kWh/h = 24 kWh). Mecanica, electricidad, plomeria.", "Tecnico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 24, 0, 24, 0, 0},
		{"Albanileria y Obra Menor", "Servicios", "Construccion", "Albanileria", "hora",
			"Mamposteria, repello, acabados, bahareque, adobe. Trabajo tecnico 3.0 kWh/h.", "Constructor",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Carpinteria y Ebanisteria", "Servicios", "Construccion", "Carpinteria", "hora",
			"Puertas, ventanas, muebles a medida. Trabajo tecnico con herramientas electricas 3.0 kWh/h.", "Carpintero",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Mecanica General", "Servicios", "Reparaciones", "Mecanica", "hora",
			"Reparacion de motores, bicicletas, motos, maquinas agricolas. Trabajo tecnico 3.0 kWh/h.", "Mecanico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Electricidad y Electrotecnia", "Servicios", "Reparaciones", "Electricidad", "hora",
			"Instalaciones electricas, cableado, paneles solares. Trabajo tecnico 3.0 kWh/h.", "Electricista",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Plomeria y Fontaneria", "Servicios", "Reparaciones", "Plomeria", "hora",
			"Reparacion de tuberias, filtros de agua, instalaciones sanitarias. Trabajo tecnico 3.0 kWh/h.", "Plomero",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Reparacion de Computadoras", "Tecnologia", "Computacion", "Reparacion", "hora",
			"Reparacion de hardware, limpieza, cambio de piezas. Trabajo tecnico 3.0 kWh/h.", "Soporte Tecnico",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Reparacion de Electrodomesticos", "Tecnologia", "Electrodomesticos", "Reparacion", "hora",
			"Reparacion de neveras, licuadoras, cocinas, lavadoras. Trabajo tecnico 3.0 kWh/h.", "Reparacion",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Reparacion de Telefonos", "Tecnologia", "Telefonos", "Reparacion", "hora",
			"Cambio de pantallas, baterias, cristales. Trabajo tecnico 3.0 kWh/h.", "Movil",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Mantenimiento de Sistemas Solares", "Energia", "Solar", "Mantenimiento", "hora",
			"Limpieza de paneles, revision de baterias, cableado. Trabajo tecnico 3.0 kWh/h.", "Mantencion",
			"https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Mantenimiento de Vehiculos", "Transporte", "Vehiculos", "Mantenimiento", "hora",
			"Ajustes, lubricacion, cambio de aceites, frenos. Trabajo tecnico 3.0 kWh/h.", "Mantencion",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Terapias Manuales y Alternativas", "Salud y Medicina", "Terapias", "Sesiones", "sesion",
			"Masaje terapeutico, acupuntura, reflexologia. Trabajo tecnico 3.0 kWh/h.", "Salud Integral",
			"https://images.unsplash.com/photo-1544161515-4ab6ce7db09c?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Consulta Medica y Odontologica", "Servicios", "Salud", "Consulta", "sesion",
			"Consulta medica general, odontologia basica, vacunacion. Trabajo tecnico 3.0 kWh/h.", "Atencion",
			"https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		// --- Educacion (3.0 kWh/h trabajo tecnico) ---
		{"Clases y Tutorias", "Servicios", "Educacion", "Clases", "hora",
			"Alfabetizacion, matematicas, oficios, idiomas. Trabajo tecnico de instruccion 3.0 kWh/h.", "Ensenanza",
			"https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Clases de Musica", "Cultura", "Musica", "Clases", "hora",
			"Ensenanza de cuatro, guitarra, percusion, canto. Trabajo tecnico 3.0 kWh/h.", "Ensenanza",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Talleres de Oficios", "Educacion", "Talleres", "Oficios", "hora",
			"Carpinteria, costura, cocina, mecanica, electricidad. Trabajo tecnico 3.0 kWh/h.", "Aprender Haciendo",
			"https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Talleres de Agroecologia", "Educacion", "Talleres", "Agricultura", "hora",
			"Permacultura, agroecologia, huertos urbanos, compostaje. Trabajo tecnico 3.0 kWh/h.", "Conuco",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Talleres de Salud Comunitaria", "Educacion", "Talleres", "Salud", "hora",
			"Primeros auxilios, medicina natural, nutricion. Trabajo tecnico 3.0 kWh/h.", "Salud",
			"https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Alfabetizacion y Educacion Basica", "Educacion", "Alfabetizacion", "Basica", "hora",
			"Lectura, escritura, matematicas basicas. Trabajo tecnico 3.0 kWh/h.", "Aprender",
			"https://images.unsplash.com/photo-1503676263721-6a1f61fcacd6?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		{"Animacion y Cuentacuentos", "Cultura", "Eventos", "Animacion", "hora",
			"Animacion de fiestas, cuentacuentos, teatro comunitario. Trabajo tecnico 3.0 kWh/h.", "Fiesta",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 3, 0, 3, 0, 0},
		// --- Transporte ---
		{"Transporte de Carga", "Servicios", "Transporte", "Carga", "viaje",
			"Transporte de mercancia con combustible fosil (~0.5L diesel = 5.8 kWh).", "Traslado",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		{"Pasaje de Personas", "Servicios", "Transporte", "Pasaje", "viaje",
			"Pasaje local en vehiculo compartido. ~1 kWh por viaje.", "Viaje",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Servicio de Arriero", "Transporte", "Animales", "Arriero", "jornada",
			"Jornada completa de arriero con animal de carga (8h tecnico + animal).", "A Caballo",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 20, 0, 20, 0, 0},

		// ============ ALIMENTOS: Cosecha Fresca (local, farm-gate) ============
		{"Hojas Verdes y Aromaticas", "Alimentacion", "Cosecha Fresca", "Hojas Verdes", "manojo",
			"Lechuga, repollo, espinaca, acelga, cilantro, perejil, cebollin, apio, hierbabuena, toronjil. Energia: 3.6-7.2 MJ/kg = 1-2 kWh/kg (riego solar, compostaje, trabajo manual).", "Fresco del Dia",
			"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Tuberculos Ancestrales y Platanos", "Alimentacion", "Cosecha Fresca", "Tuberculos", "kg",
			"Name morado, ocumo, yuca, auyama, cambur morado, platano. Tuberculos de conuco: ~5-7 MJ/kg = 1.5-2 kWh/kg.", "Rubro Olvidado",
			"https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Verduras y Hortalizas de Conuco", "Alimentacion", "Cosecha Fresca", "Verduras", "kg",
			"Tomate, pimenton, pepino, berenjena, zanahoria, remolacha, ajo, cebolla, ahuyama, calabacin. ~3.2-7.2 MJ/kg = 1-2 kWh/kg (cultivo local).", "Del Conuco",
			"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Frutas de Temporada", "Alimentacion", "Cosecha Fresca", "Frutas", "kg",
			"Mango, papaya, guayaba, patilla, melon, pina, lechosa, cambur, limon, naranja, mandarina, aguacate. ~2.8 MJ/kg farm-gate = 0.8 kWh/kg + procesamiento local.", "De Estacion",
			"https://images.unsplash.com/photo-1619566636856-adf8ab172aa0?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Raices y Bulbos", "Alimentacion", "Cosecha Fresca", "Raices", "kg",
			"Apio, name topi, mapuey, batata, borugo, rabano. Raices criollas de conuco, energia similar a tuberculos.", "Raices Criollas",
			"https://images.unsplash.com/photo-1578269830911-6159f1aee3b4?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Frutos Secos y Mani", "Alimentacion", "Cosecha Fresca", "Frutos Secos", "kg",
			"Nueces, almendras, mani, cachuates, avellanas. Energia: 40.87 MJ/kg = 11.35 kWh/kg (cultivo + secado + descascarado). Fuente: Agribalyse.", "Seco",
			"https://images.unsplash.com/photo-1619566636856-adf8ab172aa0?auto=format&fit=crop&w=600&q=80", 11, 0, 0, 11, 0},

		// ============ ALIMENTOS: Granos y Cereales (ciclo completo) ============
		{"Granos Basicos Criollos", "Alimentacion", "Granos y Cereales", "Granos", "kg",
			"Maiz criollo blanco y amarillo, cebada, avena, centeno. Energia: 31-37 MJ/kg = 9-10 kWh/kg (siembra, fertilizacion, cosecha, secado). Fuente: Agribalyse, USDA, Pimentel.", "Criollo",
			"https://images.unsplash.com/photo-1765144815957-6bc44c13fc2c?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},
		{"Arroz y Legumbres", "Alimentacion", "Granos y Cereales", "Arroz y Legumbres", "kg",
			"Arroz procesado, sorgo, caraota, frijol, quinchoncho, lentejas, garbanzos, habas. Energia: 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, Ecoinvent, FAO.", "Cereal",
			"https://images.unsplash.com/photo-1765144815957-6bc44c13fc2c?auto=format&fit=crop&w=600&q=80", 11, 0, 0, 11, 0},
		{"Harinas Integrales", "Alimentacion", "Granos y Cereales", "Harinas", "kg",
			"Harina de maiz, trigo integral, yuca (casabe), platano, quinoa. Energia del grano + molienda: ~36 MJ/kg = 10 kWh/kg.", "Base Criolla",
			"https://images.unsplash.com/photo-1699315529894-402495fddb8b?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},

		// ============ ALIMENTOS: Transformados ============
		{"Panaderia y Masas Caseras", "Alimentacion", "Gastronomia Artesanal", "Panaderia", "kg",
			"Pan de maiz, trigo integral, arepas, cachapas, bollos, empanadas. Energia: 16-18 MJ/kg = 4.5-5 kWh/kg (molienda + amasado + horneado). Fuente: Agribalyse.", "Hecho en Casa",
			"https://images.unsplash.com/photo-1509444154694-2c20049b1c1e?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		{"Dulces y Conservas Tradicionales", "Alimentacion", "Gastronomia Artesanal", "Dulces Tradicionales", "kg",
			"Dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo, encurtidos, salsas. Energia: 25-30 MJ/kg = 7-8 kWh/kg (cocccion + conservacion).", "Plato Patrimonial",
			"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},
		{"Lacteos Artesanales", "Alimentacion", "Gastronomia Artesanal", "Lacteos", "kg",
			"Queso fresco, de mano, guayanes, suero, cuajada, yogurt, mantequilla. Energia: 25-36 MJ/kg = 7-10 kWh/kg (10L leche/kg + fermentacion + frio). Fuente: Agribalyse.", "Pastoreo Libre",
			"https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},
		{"Leche Fresca", "Alimentacion", "Carnes y Pescados", "Lacteos Frescos", "litro",
			"Leche fresca de vaca, cabra. Energia: 5-7 MJ/L = 1.5-1.7 kWh/L (forraje + ordeÃ±o + pasteurizacion). Fuente: Ecoinvent, JRC, USDA.", "Fresca",
			"https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Cacao, Chocolate y Cafe", "Alimentacion", "Gastronomia Artesanal", "Cacao y Cafe", "kg",
			"Cacao fermentado de Barlovento/Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena. Energia: 80-90 MJ/kg = 22-25 kWh/kg (fermentacion + secado + torrefaccion).", "Origen Venezolano",
			"https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80", 25, 25, 0, 0, 0},
		{"Encurtidos y Salsas", "Alimentacion", "Gastronomia Artesanal", "Conservas", "frasco",
			"Encurtidos de vegetales, tomate enlatado, salsa picante, guasacaca, pesto. Energia: ~25 MJ/kg = 7 kWh/kg (cocccion + envasado).", "Conserva Viva",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},

		// ============ ALIMENTOS: Endulzantes ============
		{"Miel Pura de Abejas", "Alimentacion", "Endulzantes", "Miel", "litro",
			"Miel multifleural de montana, bosque, azahar. Energia: ~35 MJ/L = 10 kWh/L (apicultura + extraccion + filtrado).", "Pura",
			"https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},
		{"Papelon y Panela", "Alimentacion", "Endulzantes", "Panela", "kg",
			"Papelon en bloque, panela granulada, rapadura, melaza de cana. Energia: 53 MJ/kg = 14.8 kWh/kg (cultivo + refinacion). Fuente: Agribalyse.", "De Cana",
			"https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80", 15, 15, 0, 0, 0},

		// ============ ALIMENTOS: Carnes y Pescados ============
		{"Carnes de Pollo y Aves", "Alimentacion", "Carnes y Pescados", "Aves", "kg",
			"Pollo de patio, gallina, pato, conejo. Energia: 30 MJ/kg = 8.3 kWh/kg (conversion 4.2 kg pienso/kg carne). Fuente: Pimentel, Agribalyse.", "De Patio",
			"https://images.unsplash.com/photo-1607623814025-e3df5d8d6e1e?auto=format&fit=crop&w=600&q=80", 8, 0, 0, 8, 0},
		{"Carnes de Cerdo y Chivo", "Alimentacion", "Carnes y Pescados", "Cerdo y Chivo", "kg",
			"Cerdo criollo, chivo. Energia: 47.5 MJ/kg = 13.2 kWh/kg (conversion 10.7 kg pienso/kg + climatizacion). Fuente: USDA, Agribalyse.", "Criollo",
			"https://images.unsplash.com/photo-1607623814025-e3df5d8d6e1e?auto=format&fit=crop&w=600&q=80", 13, 0, 0, 13, 0},
		{"Carnes de Vacuno", "Alimentacion", "Carnes y Pescados", "Vacuno", "kg",
			"Carne de res, vacuno pastoreado. Energia: 80-100 MJ/kg = 22-28 kWh/kg (conversion 31.7 kg forraje/kg). Fuente: Pimentel, Ecoinvent, Agribalyse.", "Pastoreo Libre",
			"https://images.unsplash.com/photo-1607623814025-e3df5d8d6e1e?auto=format&fit=crop&w=600&q=80", 25, 0, 0, 25, 0},
		{"Pescados y Mariscos", "Alimentacion", "Carnes y Pescados", "Pescados", "kg",
			"Pescado fresco de rio, salado, carite, cazon, camarones. Energia: ~35 MJ/kg = 10 kWh/kg (captura + cadena de frio).", "Del Rio/Mar",
			"https://images.unsplash.com/photo-1535140728325-a4d3707eee61?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},
		{"Huevos Frescos", "Alimentacion", "Carnes y Pescados", "Huevos", "docena",
			"Huevos de gallina criolla, pato, codorniz. Energia: 34.4 MJ/kg = 9.6 kWh/kg (mantenimiento ponedoras + alimento). Fuente: Agribalyse.", "De Patio",
			"https://images.unsplash.com/photo-1569288063648-8a3d4f5e2f4e?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},

		// ============ ALIMENTOS: Bebidas y Condimentos ============
		{"Bebidas Fermentadas", "Alimentacion", "Bebidas", "Fermentadas", "litro",
			"Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha. Energia: ~18 MJ/L = 5 kWh/L (fermentacion natural).", "Fermentacion Natural",
			"https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		{"Infusiones y Tes", "Alimentacion", "Bebidas", "Infusiones", "kg",
			"Te de hierbas, manzanilla, anis, tilo, boldo, hierbabuena seca. Energia: ~10 MJ/kg = 3 kWh/kg (secado + empaque).", "Botica Natural",
			"https://images.unsplash.com/photo-1597318181409-1e81af9b8d3e?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Especias y Condimentos", "Alimentacion", "Condimentos", "Especias", "kg",
			"Comino, oregano, pimienta, aji dulce/picante, onoto, cilantro seco, laurel. Energia: ~53 MJ/kg = 15 kWh/kg (secado + molienda).", "Sazon Criolla",
			"https://images.unsplash.com/photo-1596040033229-a3c5b59a5c21?auto=format&fit=crop&w=600&q=80", 15, 15, 0, 0, 0},
		{"Aceites y Vinagres", "Alimentacion", "Condimentos", "Aceites", "litro",
			"Aceite de coco, ajonjoli, palma, vinagre de cana. Energia: 35-40 MJ/L = 9.7-11.1 kWh/L (prensado, extraccion, refinado). Fuente: Agribalyse, Ecoinvent.", "Prensado en Frio",
			"https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80", 10, 10, 0, 0, 0},

		// ============ ALIMENTOS: Canasta Basica (contenido exacto especificado) ============
		{"Canasta Basica Familiar Semanal", "Alimentacion", "Canasta Basica", "Semanal", "canasta",
			"Canasta semanal para familia 4-5 personas. Contenido exacto: 3kg granos basicos (maiz, frijol, arroz), 2kg verduras frescas (tomate, cebolla, pimenton), 1kg frutas de temporada, 0.5kg carne de pollo, 1L leche fresca, 0.5L aceite vegetal, 0.5kg panela/azucar, 1 docena huevos, 100g especias (sal, comino, ajo). Energia total estimada: 3x10 + 2x2 + 1x2 + 0.5x8 + 1x2 + 0.5x10 + 0.5x15 + 1x10 + 1 = 65.5 TQ. Precio redondeado: 66 TQ.", "Necesidad Vital",
			"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", 66, 0, 0, 66, 0},

		// ============ AGRICULTURA ============
		{"Plantulas Medicinales y Aromaticas", "Agricultura", "Semillas y Plantulas", "Plantulas Medicinales", "maceta",
			"Poleo, estevia, malojillo, romero, ruda, oregano, sabila, llanten, calendula. Energia: ~3.6 MJ/maceta = 1 kWh (propagacion + sustrato).", "Para tu Huerto",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Semillas Criollas Adaptadas", "Agricultura", "Semillas y Plantulas", "Semillas", "sobre",
			"Semillas de maiz, frijol, caraota, ahuyama, tomate, pimenton, lechuga, cilantro. Energia: ~3.6 MJ/sobre = 1 kWh (seleccion + secado).", "Semilla Nativa",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Estacas y Esquejes", "Agricultura", "Semillas y Plantulas", "Estacas", "unidad",
			"Estacas de yuca, platano, frutales (mango, aguacate, citricos), mora, parchita. Energia: ~3.6 MJ/unidad = 1 kWh.", "Propagacion",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Abonos Organicos", "Agricultura", "Insumos Agricolas", "Abonos", "saco",
			"Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza. Energia: ~5-7 MJ/kg = 1.5-2 kWh/kg.", "Fertilidad Natural",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Bioinsumos y Preparados", "Agricultura", "Insumos Agricolas", "Bioinsumos", "litro",
			"Biofertilizantes, biopreparados fungicos, te de compost, purines, microorganismos eficientes. Energia: ~10 MJ/L = 3 kWh/L.", "Agroecologia",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Tierra Fertil y Sustratos", "Agricultura", "Tierra y Compost", "Sustratos", "saco",
			"Tierra preparada, sustrato para semilleros, turba, arena de rio. Energia: ~3.6 MJ/saco = 1 kWh.", "Tierra Viva",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		// ============ AGRICULTURA: Riego (componentes individuales) ============
		{"Manguera de Riego PVC 1m", "Agricultura", "Riego", "Tuberias", "metro",
			"Manguera de PVC de 1 metro para riego. Energia: PVC 10.6 MJ/kg x ~0.3kg/m = 3.2 MJ = 0.9 TQ. Fuente: ICE Database.", "Riego",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Aspersor de Riego", "Agricultura", "Riego", "Aspersores", "unidad",
			"Aspersor de plastico para riego por aspersion. Energia: PVC ~0.1kg = 1 MJ = 0.3 TQ + manufactura. Fuente: ICE Database.", "Riego",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Gotero de Riego", "Agricultura", "Riego", "Goteros", "unidad",
			"Gotero individual para riego por goteo. Energia: plastico ~0.02kg = 0.2 MJ = 0.06 TQ + manufactura. Fuente: ICE Database.", "Riego",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Bomba Manual de Agua", "Agricultura", "Riego", "Bombas", "unidad",
			"Bomba manual de agua para extraer de pozo o tanque. Energia: acero ~2kg x 20 MJ/kg + PVC = 43 MJ = 12 TQ. Fuente: ICE Database.", "Riego",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 12, 0, 0, 12, 0},
		{"Tanque de Agua 200L", "Agricultura", "Riego", "Tanques", "unidad",
			"Tanque de agua plastico HDPE 200 litros. Energia: HDPE ~5kg x 52.5 MJ/kg = 262 MJ = 73 TQ. Fuente: ICE Database, Ecoinvent.", "Almacenamiento",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 73, 0, 0, 73, 0},
		{"Tanque de Agua 1000L", "Agricultura", "Riego", "Tanques", "unidad",
			"Tanque de agua plastico HDPE 1000 litros. Energia: HDPE ~25kg x 52.5 MJ/kg = 1313 MJ = 365 TQ. Fuente: ICE Database, Ecoinvent.", "Almacenamiento",
			"https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80", 365, 0, 0, 365, 0},

		// ============ SALUD Y MEDICINA ============
		{"Tinturas Madres y Botica Conuquera", "Salud y Medicina", "Medicina Botanica", "Tinturas", "frasco",
			"Extractos de propoleo, tinturas de moringa, curcuma, jengibre, pomadas de arnica, jarabes. Energia: ~28 MJ/frasco = 8 kWh (extraccion + alcohol).", "100% Puro",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},
		{"Cosmetica Natural sin Quimicos", "Salud y Medicina", "Medicina Botanica", "Cosmetica", "unidad",
			"Desodorantes de coco, balsamos labiales de cera de abeja, jabones artesanales, cremas de calendula. Energia: ~18 MJ/unidad = 5 kWh.", "Residuo Cero",
			"https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		{"Hierbas Medicinales Secas", "Salud y Medicina", "Medicina Botanica", "Hierbas Secas", "kg",
			"Manzanilla, toronjil, valeriana, eucalipto, llanten, malojillo, sauco, tila. Energia: ~10 MJ/kg = 3 kWh/kg (secado al sol).", "Secado al Sol",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Jabones y Productos de Higiene", "Salud y Medicina", "Higiene", "Jabones", "unidad",
			"Jabon de lavar, jabon corporal natural, champu solido, dentifrico natural. Energia: ~10 MJ/unidad = 3 kWh (saponificacion).", "Limpieza Natural",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Detergentes y Suavizantes Naturales", "Salud y Medicina", "Higiene", "Detergentes", "litro",
			"Detergente biodegradable, suavizante, limpiador multiusos, desinfectante natural. Energia: ~18 MJ/L = 5 kWh.", "Eco Limpieza",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		// ============ SALUD: Primeros Auxilios (componentes individuales) ============
		{"Vendas y Gasas (Paquete)", "Salud y Medicina", "Primeros Auxilios", "Vendas", "paquete",
			"Paquete de vendas y gasas esteriles de algodon. Energia: algodon ~0.2kg x 50 MJ/kg = 10 MJ = 3 TQ. Fuente: Ecoinvent.", "Curacion",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 3, 0, 0, 3, 0},
		{"Alcohol Medicinal 1L", "Salud y Medicina", "Primeros Auxilios", "Desinfectantes", "litro",
			"Alcohol etilico medicinal 70% en frasco de 1 litro. Energia: destilacion + empaque ~3.6 MJ = 1 TQ.", "Desinfeccion",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Yodo (Frasco 30ml)", "Salud y Medicina", "Primeros Auxilios", "Antisepticos", "frasco",
			"Frasco de yodo antiseptico 30ml. Energia: extraccion + empaque ~1 TQ.", "Antiseptico",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Tijeras de Primeros Auxilios", "Salud y Medicina", "Primeros Auxilios", "Instrumentos", "unidad",
			"Tijeras de acero para cortar vendas. Energia: acero ~0.1kg x 35 MJ/kg = 3.5 MJ = 1 TQ + manufactura. Fuente: ICE Database.", "Instrumental",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Apositos y Tiritas (Caja)", "Salud y Medicina", "Primeros Auxilios", "Apositos", "caja",
			"Caja de apositos y tiritas adhesivas. Energia: plastico + algodon + adhesivo ~1 TQ.", "Curacion",
			"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},

		// ============ TEXTILES ============
		// ============ TEXTILES: materias primas por kg + productos especificos ============
		{"Tela de Algodon Cruda (kg)", "Textiles", "Tejidos", "Materia Prima", "kg",
			"Tela de algodon cruda sin teñir para confeccion. Precio por kg. Energia: 143 MJ/kg = 39.7 TQ/kg (cultivo + hilado + tejido). Fuente: ICE Database, Ecoinvent.", "Materia Prima",
			"https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80", 40, 0, 0, 40, 0},
		{"Lana Cruda para Tejer (kg)", "Textiles", "Hilos y Materiales", "Materia Prima", "kg",
			"Lana de oveja cruda lavada para tejer. Precio por kg. Energia: ~67.5 MJ/kg = 18.75 TQ/kg (crianza + esquila + lavado). Fuente: ICE Database.", "Materia Prima",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 19, 0, 0, 19, 0},
		{"Hilo de Algodon (rollo 100g)", "Textiles", "Hilos y Materiales", "Hilos", "rollo",
			"Rollo de hilo de algodon de 100g para coser o tejer. Energia: 143 MJ/kg x 0.1kg = 14.3 MJ = 4 TQ. Fuente: ICE Database.", "Materia Prima",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 4, 0, 0, 4, 0},
		// --- Productos especificos con peso definido ---
		{"Camisa de Algodon Artesanal (0.3 kg)", "Textiles", "Confeccion", "Prendas", "unidad",
			"Camisa de algodon artesanal, 0.3 kg de tela. Energia: tela 0.3kg x 143 MJ/kg + trabajo 4h = 55 MJ = 15 TQ. Precio: 16 TQ.", "Hecho a Mano",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 16, 0, 0, 16, 0},
		{"Pantalon de Algodon Artesanal (0.5 kg)", "Textiles", "Confeccion", "Prendas", "unidad",
			"Pantalon de algodon artesanal, 0.5 kg de tela. Energia: tela 0.5kg x 143 MJ/kg + trabajo 5h = 87 MJ = 24 TQ. Precio: 25 TQ.", "Hecho a Mano",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 25, 0, 0, 25, 0},
		{"Frazada de Lana Artesanal (1.5 kg)", "Textiles", "Tejidos", "Cobijas", "unidad",
			"Frazada de lana tejida a mano, 1.5 kg. Energia: lana 1.5kg x 67.5 MJ/kg + trabajo 8h = 132 MJ = 37 TQ. Precio: 37 TQ.", "Calor Artesanal",
			"https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80", 37, 0, 0, 37, 0},
		{"Hamaca de Cañamo (1.2 kg)", "Textiles", "Tejidos", "Cobijas", "unidad",
			"Hamaca de fibra de cañamo tejida a mano, 1.2 kg. Energia: fibra 1.2kg x 143 MJ/kg + trabajo 10h = 292 MJ = 81 TQ. Precio: 30 TQ (ajuste comunitario por fibra local).", "Descanso",
			"https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80", 30, 0, 0, 30, 0},
		{"Reparacion y Adaptacion de Prendas", "Textiles", "Confeccion", "Reparaciones", "prenda",
			"Parches, costuras, ajustes, dobladillos, cremalleras. Energia: ~5h trabajo general = 5 kWh.", "Reutilizar",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		// --- Trabajo textil por hora ---
		{"Trabajo de Costura (hora)", "Textiles", "Confeccion", "Trabajo", "hora",
			"Trabajo artesanal de costura y confeccion por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},

		// ============ ARTESANIA: materias primas por kg + productos especificos ============
		// --- Materia prima por kg ---
		{"Arcilla para Ceramica (cruda)", "Artesania", "Ceramica", "Materia Prima", "kg",
			"Arcilla cruda para alfareria y ceramica. Precio por kg de material. Energia: 2.5 MJ/kg = 0.7 TQ/kg (extraccion + preparacion). Fuente: ICE Database, University of Bath.", "Materia Prima",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Madera Blanda para Tallado", "Artesania", "Madera", "Materia Prima", "kg",
			"Madera blanda secada al aire para tallado artesanal (cedro, ceiba, saman). Precio por kg. Energia: 0.3 MJ/kg = 0.08 TQ/kg (tala + aserrado + secado natural). Fuente: ICE Database.", "Materia Prima",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Madera Dura para Muebles", "Artesania", "Madera", "Materia Prima", "kg",
			"Madera dura secada al horno para muebles (roble, caoba, apamate). Precio por kg. Energia: 2.0 MJ/kg = 0.56 TQ/kg (tala + aserrado + secado horno). Fuente: ICE Database.", "Materia Prima",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Fibra Vegetal para Cesteria", "Artesania", "Cesteria", "Materia Prima", "kg",
			"Fibra vegetal seca para cesteria (mimbre, paja, caña brava, coco). Precio por kg. Energia: ~0.5 MJ/kg = 0.14 TQ/kg (recoleccion + secado solar). Estimacion comunitaria.", "Materia Prima",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		// --- Ceramica: productos especificos con peso ---
		{"Taza de Barro (0.3 kg)", "Artesania", "Ceramica", "Vajilla", "unidad",
			"Taza de barro artesanal de 0.3 kg. Energia: arcilla 0.3kg x 2.5 MJ/kg + coccion 3.6 MJ + trabajo 1h = 5.35 MJ = 1.5 TQ. Precio: 2 TQ.", "Barro Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 2, 2, 0, 0, 0},
		{"Plato de Barro (0.5 kg)", "Artesania", "Ceramica", "Vajilla", "unidad",
			"Plato de barro artesanal de 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.", "Barro Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Olla de Barro (2 kg)", "Artesania", "Ceramica", "Vasijas", "unidad",
			"Olla de barro artesanal de 2 kg para cocina. Energia: arcilla 2kg x 2.5 MJ/kg + coccion 18 MJ + trabajo 3h = 27 MJ = 7.5 TQ. Precio: 8 TQ.", "Barro Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},
		{"Cantarola de Barro (5 kg)", "Artesania", "Ceramica", "Vasijas", "unidad",
			"Cantarola de barro artesanal de 5 kg para almacenar agua. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 5h = 53.5 MJ = 15 TQ. Precio: 15 TQ.", "Barro Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 15, 15, 0, 0, 0},
		{"Maceta de Arcilla Pequena (0.5 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa pequena 10cm diametro, 0.5 kg. Energia: arcilla 0.5kg x 2.5 MJ/kg + coccion + trabajo 1h = 7 MJ = 2 TQ. Precio: 3 TQ.", "Maceta",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Maceta de Arcilla Mediana (2 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa mediana 20cm diametro, 2 kg. Energia: arcilla 2kg x 2.5 MJ/kg + coccion 18 MJ + trabajo 2h = 27 MJ = 7.5 TQ. Precio: 8 TQ.", "Maceta",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 8, 8, 0, 0, 0},
		{"Maceta de Arcilla Grande (5 kg)", "Artesania", "Ceramica", "Macetas", "unidad",
			"Maceta de arcilla decorativa grande 35cm diametro, 5 kg. Energia: arcilla 5kg x 2.5 MJ/kg + coccion 36 MJ + trabajo 3h = 53.5 MJ = 15 TQ. Precio: 15 TQ.", "Maceta",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 15, 15, 0, 0, 0},
		// --- Madera: productos especificos con peso ---
		{"Cuchara de Palo (0.1 kg)", "Artesania", "Madera", "Utensilios", "unidad",
			"Cuchara de palo tallado a mano, 0.1 kg. Energia: madera 0.1kg x 0.3 MJ/kg + trabajo 1h = 3.6 MJ = 1 TQ. Precio: 1 TQ.", "Madera Noble",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Mortero de Madera (1 kg)", "Artesania", "Madera", "Utensilios", "unidad",
			"Mortero de madera tallado a mano, 1 kg. Energia: madera 1kg x 0.3 MJ/kg + trabajo 3h = 11 MJ = 3 TQ. Precio: 3 TQ.", "Madera Noble",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 3, 3, 0, 0, 0},
		{"Silla Rustica de Madera (8 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Silla rustica de madera dura, 8 kg. Energia: madera 8kg x 2.0 MJ/kg + trabajo 6h = 38 MJ = 10.5 TQ. Precio: 11 TQ.", "Muebleria Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 11, 0, 0, 11, 0},
		{"Mesa Rustica de Madera (20 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Mesa rustica de madera dura, 20 kg. Energia: madera 20kg x 2.0 MJ/kg + trabajo 10h = 82 MJ = 23 TQ. Precio: 23 TQ.", "Muebleria Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 23, 0, 0, 23, 0},
		{"Banco Rustico de Madera (12 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Banco rustico de madera dura, 12 kg. Energia: madera 12kg x 2.0 MJ/kg + trabajo 5h = 51 MJ = 14 TQ. Precio: 14 TQ.", "Muebleria Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 14, 0, 0, 14, 0},
		{"Cama Rustica de Madera (35 kg)", "Artesania", "Madera", "Muebles", "unidad",
			"Cama rustica de madera dura, 35 kg. Energia: madera 35kg x 2.0 MJ/kg + trabajo 12h = 127 MJ = 35 TQ. Precio: 35 TQ.", "Muebleria Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 35, 0, 0, 35, 0},
		// --- Cesteria: productos especificos con peso ---
		{"Canasto Pequeno (0.3 kg)", "Artesania", "Cesteria", "Canastas", "unidad",
			"Canasto pequeno de fibra vegetal tejido a mano, 0.3 kg. Energia: fibra 0.3kg x 0.5 MJ/kg + trabajo 2h = 7 MJ = 2 TQ. Precio: 2 TQ.", "Fibra Vegetal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 2, 2, 0, 0, 0},
		{"Cesta Mediana (1 kg)", "Artesania", "Cesteria", "Canastas", "unidad",
			"Cesta mediana de fibra vegetal tejida a mano, 1 kg. Energia: fibra 1kg x 0.5 MJ/kg + trabajo 4h = 14.5 MJ = 4 TQ. Precio: 4 TQ.", "Fibra Vegetal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 4, 4, 0, 0, 0},
		{"Sombrero de Paja (0.2 kg)", "Artesania", "Cesteria", "Sombreros", "unidad",
			"Sombrero de paja tejido a mano, 0.2 kg. Energia: fibra 0.2kg x 0.5 MJ/kg + trabajo 5h = 18 MJ = 5 TQ. Precio: 5 TQ.", "Fibra Vegetal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},
		// --- Trabajo artesanal por hora ---
		{"Trabajo de Alfareria (hora)", "Artesania", "Ceramica", "Trabajo", "hora",
			"Trabajo artesanal de alfareria y ceramica por hora. Incluye modelado, esmaltado y control de horno. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Trabajo de Carpinteria (hora)", "Artesania", "Madera", "Trabajo", "hora",
			"Trabajo artesanal de carpinteria y tallado de madera por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Trabajo de Cesteria (hora)", "Artesania", "Cesteria", "Trabajo", "hora",
			"Trabajo artesanal de cesteria y tejido de fibra vegetal por hora. Energia: 1 kWh/hora de trabajo humano.", "Trabajo Artesanal",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Coccion de Ceramica en Horno (carga)", "Artesania", "Ceramica", "Trabajo", "carga",
			"Coccion de una carga de horno ceramico (incluye leña o gas). Energia: ~18 MJ/kg de arcilla cocida = 5 TQ/kg. Una carga tipica cuece 10-20 piezas.", "Coccion",
			"https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80", 5, 5, 0, 0, 0},

		// ============ CONSTRUCCION: Materiales ============
		{"Bloques, Adobe y Bahareque", "Construccion", "Materiales", "Adobe", "unidad",
			"Bloques de tierra comprimida, adobes, bahareque. Energia: 1.8-3.6 MJ/unidad = 0.5-1 kWh (mezcla + prensado + secado solar). Fuente: ICE Database.", "Construccion Natural",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Madera de Construccion", "Construccion", "Materiales", "Madera", "kg",
			"Madera aserrada, vigas, tablas, listones. Energia: 8.5 MJ/kg = 2.36 kWh/kg (tala + aserrado + secado). Fuente: ICE Database.", "Estructura",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 3, 0, 0, 3, 0},
		{"Piedra y Agregados", "Construccion", "Materiales", "Piedra", "kg",
			"Piedra de rio, grava, arena, cascajo. Energia: 0.083 MJ/kg = 0.023 kWh/kg (extraccion + clasificacion). Fuente: ICE Database.", "Base Solida",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Hormigon Estructural", "Construccion", "Materiales", "Hormigon", "kg",
			"Hormigon M20 (1:1.5:3). Energia: 1.55 MJ/kg = 0.43 kWh/kg (calcina de clinker + mezclado). Fuente: ICE Database, Ecoinvent.", "Estructural",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Ladrillo de Arcilla", "Construccion", "Materiales", "Ladrillos", "unidad",
			"Ladrillo comun de arcilla cocida. Energia: 4.75 MJ/unidad = 1.32 kWh (extraccion + moldeado + coccion). Fuente: ICE Database.", "Cocido",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Bloque de Paja", "Construccion", "Materiales", "Bioconstruccion", "bloque",
			"Bloque de paja (straw bale). Energia: 0.91 MJ/kg = 0.25 kWh/kg (empacado agricola). Fuente: ICE Database.", "Bioconstruccion",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		{"Pinturas y Recubrimientos Naturales", "Construccion", "Acabados", "Pintura", "litro",
			"Pintura a cal, tierra pigmentada, estucos naturales, impermeabilizantes. Energia: ~15 MJ/L = 4 kWh.", "Acabado Natural",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 4, 4, 0, 0, 0},
		// --- Metales ---
		{"Acero Reciclado", "Construccion", "Metales", "Acero", "kg",
			"Acero reciclado en horno de arco electrico. Energia: 20 MJ/kg = 5.56 kWh/kg. Fuente: ICE Database, Ecoinvent.", "Reciclado",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 6, 0, 0, 6, 0},
		{"Acero Virgen", "Construccion", "Metales", "Acero", "kg",
			"Acero estructural virgen. Energia: 35 MJ/kg = 9.72 kWh/kg (alto horno + laminacion). Fuente: ICE Database, WorldSteel.", "Industrial",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},
		{"Aluminio", "Construccion", "Metales", "Aluminio", "kg",
			"Aluminio comercial (33% reciclado). Energia: 193 MJ/kg = 53.6 kWh/kg (electrolisis Hall-Heroult). Fuente: ICE Database.", "Ligero",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 54, 0, 0, 54, 0},
		{"Vidrio Plano", "Construccion", "Materiales", "Vidrio", "kg",
			"Vidrio plano para ventanas. Energia: 15 MJ/kg = 4.17 kWh/kg (fusion de silice >1500C). Fuente: ICE Database.", "Transparente",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 4, 0, 0, 4, 0},
		{"Tuberia PVC", "Construccion", "Materiales", "Polimeros", "kg",
			"Tuberia de PVC. Energia: 10.64-77.2 MJ/kg = 3-21 kWh/kg (polimerizacion etileno + cloro). Fuente: ICE Database.", "Plastico",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 10, 0, 0, 10, 0},

		// ============ ENERGIA Y COMBUSTIBLES ============
		{"Panel Solar Fotovoltaico", "Energia", "Solar", "Paneles", "m2",
			"Panel solar monocristalino 1m2. Energia: 4750 MJ/m2 = 1319 kWh (silicio grado solar + obleas + cristal). Fuente: ICE Database, Ecoinvent.", "Energia Limpia",
			"https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80", 1319, 0, 0, 1319, 0},
		{"Lena Seca para Cocinar", "Energia", "Lena", "Lena", "kg",
			"Lena seca de arboles frutales y de sombra. Energia: 15.3 MJ/kg = 4.25 kWh (corte + secado). Fuente: Ecoinvent.", "Fuego Natural",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 4, 4, 0, 0, 0},
		{"Carbon Vegetal", "Energia", "Lena", "Carbon", "kg",
			"Carbon vegetal de hornos artesanales. Energia: ~22 MJ/kg = 6 kWh (pirolisis + transporte).", "Carbon Artesanal",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 6, 6, 0, 0, 0},
		{"Diesel Agricola", "Energia", "Combustibles", "Diesel", "litro",
			"Diesel/gasoil agricola. Energia: 41.7 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: Ecoinvent, ResearchGate.", "Combustible",
			"https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80", 12, 12, 0, 0, 0},
		{"Gasolina", "Energia", "Combustibles", "Gasolina", "kg",
			"Gasolina comercial. Energia: 47.1 MJ/kg = 13.08 kWh/kg (refinacion del petroleo). Fuente: Ecoinvent.", "Combustible",
			"https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80", 13, 13, 0, 0, 0},
		{"Gas GLP", "Energia", "Combustibles", "GLP", "kg",
			"Gas licuado de petroleo. Energia: 50.1 MJ/kg = 13.92 kWh/kg (refinacion + envasado). Fuente: Ecoinvent.", "Domestico",
			"https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80", 14, 14, 0, 0, 0},
		{"Biomasa Seca (Pellets)", "Energia", "Combustibles", "Biomasa", "kg",
			"Pellets de madera seca. Energia: 15.3 MJ/kg = 4.25 kWh/kg (secado + compactacion). Fuente: Ecoinvent.", "Renovable",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 4, 4, 0, 0, 0},

		// ============ HERRAMIENTAS: Campo (individuales) ============
		{"Machete", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Machete de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 4 MJ = 14 MJ = 4 TQ. Fuente: ICE Database.", "Conuquero",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 4, 0, 0, 4, 0},
		{"Pala", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Pala de acero con mango de madera. Energia: acero ~1.5kg x 20 MJ/kg + mango 4 MJ = 34 MJ = 9 TQ. Fuente: ICE Database.", "Excavacion",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 9, 0, 0, 9, 0},
		{"Pico", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Pico de acero con mango de madera. Energia: acero ~2kg x 20 MJ/kg + mango 4 MJ = 44 MJ = 12 TQ. Fuente: ICE Database.", "Excavacion",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 12, 0, 0, 12, 0},
		{"Rastrillo", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Rastrillo de acero con mango de madera. Energia: acero ~1kg x 20 MJ/kg + mango 4 MJ = 24 MJ = 7 TQ. Fuente: ICE Database.", "Limpieza",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 7, 0, 0, 7, 0},
		{"Azadon", "Herramientas", "Manuales", "Agricolas", "unidad",
			"Azadon de acero con mango de madera. Energia: acero ~0.8kg x 20 MJ/kg + mango 4 MJ = 20 MJ = 6 TQ. Fuente: ICE Database.", "Cultivo",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 6, 0, 0, 6, 0},
		// --- Taller (individuales) ---
		{"Martillo", "Herramientas", "Manuales", "Taller", "unidad",
			"Martillo de acero con mango de madera. Energia: acero ~0.3kg x 20 MJ/kg + mango 2 MJ = 8 MJ = 2 TQ. Fuente: ICE Database.", "Taller",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Serrucho", "Herramientas", "Manuales", "Taller", "unidad",
			"Serrucho de acero con mango de madera. Energia: acero ~0.5kg x 20 MJ/kg + mango 2 MJ = 12 MJ = 3 TQ. Fuente: ICE Database.", "Corte",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 3, 0, 0, 3, 0},
		{"Lima", "Herramientas", "Manuales", "Taller", "unidad",
			"Lima de acero para desbaste. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Desbaste",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Destornillador", "Herramientas", "Manuales", "Taller", "unidad",
			"Destornillador de acero con mango de plastico. Energia: acero ~0.1kg x 20 MJ/kg + plastico 1 MJ = 3 MJ = 1 TQ. Fuente: ICE Database.", "Tornillos",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Alicates", "Herramientas", "Manuales", "Taller", "unidad",
			"Alicates de acero. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Pinza",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Afilar y Mantener Herramientas", "Herramientas", "Manuales", "Mantenimiento", "unidad",
			"Afilar machetes, cuchillos, tijeras, reparacion de mangos. Energia: ~1h trabajo general = 1 kWh.", "Mantencion",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
		// --- Electricas (individuales) ---
		{"Taladro Electrico", "Herramientas", "Electricas", "Taladros", "unidad",
			"Taladro electrico portatil 600W. Energia: motor + plastico + cobre ~100 TQ. Fuente: ICE Database.", "Electrico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 100, 0, 0, 100, 0},
		{"Sierra Circular", "Herramientas", "Electricas", "Sierras", "unidad",
			"Sierra circular electrica 1200W con disco. Energia: motor + acero + plastico ~120 TQ. Fuente: ICE Database.", "Electrico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 120, 0, 0, 120, 0},
		{"Amoladora", "Herramientas", "Electricas", "Amoladoras", "unidad",
			"Amoladora angular electrica 700W con discos. Energia: motor + acero ~80 TQ. Fuente: ICE Database.", "Electrico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 80, 0, 0, 80, 0},
		{"Lijadora Electrica", "Herramientas", "Electricas", "Lijadoras", "unidad",
			"Lijadora orbital electrica 300W. Energia: motor + plastico ~60 TQ. Fuente: ICE Database.", "Electrico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 60, 0, 0, 60, 0},
		{"Soldadora Electrica", "Herramientas", "Electricas", "Soldadoras", "unidad",
			"Soldadora electrica 150A con electrodos. Energia: transformador cobre + acero ~200 TQ. Fuente: ICE Database.", "Electrico",
			"https://images.unsplash.com/photo-1632823469850-1e6a3d1c14e1?auto=format&fit=crop&w=600&q=80", 200, 0, 0, 200, 0},

		// ============ TECNOLOGIA Y ELECTRODOMESTICOS ============
		{"Telefono Inteligente", "Tecnologia", "Electronica", "Telefonos", "unidad",
			"Smartphone completo. Energia: 1000 MJ = 278 kWh (tierras raras + microprocesadores + ensamblado). Fuente: ICE Database, Marspedia.", "Dispositivo",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 278, 0, 0, 278, 0},
		{"Computadora Portatil", "Tecnologia", "Electronica", "Computadoras", "unidad",
			"Laptop completa. Energia: 4500 MJ = 1250 kWh (placa madre + LCD + bateria litio + chasis). Fuente: Ecoinvent, Marspedia.", "Dispositivo",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1250, 0, 0, 1250, 0},
		{"Computadora de Sobremesa", "Tecnologia", "Electronica", "Computadoras", "unidad",
			"PC de sobremesa. Energia: 2085 MJ = 579 kWh (torre + componentes). Fuente: Marspedia.", "Dispositivo",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 579, 0, 0, 579, 0},
		{"Monitor LCD", "Tecnologia", "Electronica", "Monitores", "unidad",
			"Monitor LCD. Energia: 963 MJ = 268 kWh (pantalla + electronicos). Fuente: ICE Database.", "Pantalla",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 268, 0, 0, 268, 0},
		{"Lavadora Domestica", "Tecnologia", "Electrodomesticos", "Lavanderia", "unidad",
			"Lavadora domestica. Energia: 3900 MJ = 1083 kWh (acero + motor + contrapesos + electronica). Fuente: ICE Database.", "Electrodomestico",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1083, 0, 0, 1083, 0},
		{"Refrigerador Domestico", "Tecnologia", "Electrodomesticos", "Refrigeracion", "unidad",
			"Refrigerador domestico. Energia: 5900 MJ = 1639 kWh (compresor + poliuretano + cobre + acero). Fuente: ICE Database.", "Electrodomestico",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1639, 0, 0, 1639, 0},
		{"Cafetera Electrica", "Tecnologia", "Electrodomesticos", "Cocina", "unidad",
			"Cafetera electrica. Energia: 184 MJ = 51 kWh (plastico + resistencia + cableado). Fuente: ICE Database.", "Electrodomestico",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 51, 0, 0, 51, 0},
		{"Secador de Pelo", "Tecnologia", "Electrodomesticos", "Cuidado Personal", "unidad",
			"Secador de pelo. Energia: 79 MJ = 22 kWh (plastico + motor + resistencia). Fuente: ICE Database.", "Electrodomestico",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 22, 0, 0, 22, 0},
		// --- Componentes electronicos (individuales) ---
		{"Cable Electrico (metro)", "Tecnologia", "Componentes", "Cables", "metro",
			"Cable de cobre 1 metro para instalaciones. Energia: cobre ~0.1kg x 42 MJ/kg = 4.2 MJ = 1 TQ. Fuente: ICE Database.", "Cable",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Resistencias (Paquete 10)", "Tecnologia", "Componentes", "Resistencias", "paquete",
			"Paquete de 10 resistencias electronicas. Energia: manufactura ~1 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Capacitores (Paquete 10)", "Tecnologia", "Componentes", "Capacitores", "paquete",
			"Paquete de 10 capacitores electronicos. Energia: manufactura ~1 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},
		{"Conectores (Paquete)", "Tecnologia", "Componentes", "Conectores", "paquete",
			"Paquete de conectores electronicos variados. Energia: plastico + metal ~2 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Soldadura Electronica (Rollo)", "Tecnologia", "Componentes", "Soldadura", "rollo",
			"Rollo de soldadura de estano para electronica. Energia: estano + plomo ~3 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 3, 0, 0, 3, 0},
		{"Plaquetas PCB (Unidad)", "Tecnologia", "Componentes", "Plaquetas", "unidad",
			"Plaqueta PCB virgen para circuitos. Energia: cobre + fibra de vidrio ~2 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Fusibles (Paquete 10)", "Tecnologia", "Componentes", "Fusibles", "paquete",
			"Paquete de 10 fusibles electricos. Energia: vidrio + metal ~1 TQ.", "Componente",
			"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80", 1, 0, 0, 1, 0},

		// ============ TRANSPORTE: Bicicletas (individuales) ============
		{"Bicicleta Completa", "Transporte", "Vehiculos", "Bicicletas", "unidad",
			"Bicicleta completa lista para usar. Energia: acero ~15kg x 6 kWh/kg + caucho + ensamblaje = 100 TQ. Fuente: ICE Database.", "Transporte Limpio",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 100, 0, 0, 100, 0},
		{"Llanta de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "unidad",
			"Llanta de caucho para bicicleta. Energia: caucho ~1kg x 24 MJ/kg = 24 MJ = 7 TQ. Fuente: Ecoinvent.", "Refaccion",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 7, 0, 0, 7, 0},
		{"Cadena de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "unidad",
			"Cadena de acero para bicicleta. Energia: acero ~0.3kg x 20 MJ/kg = 6 MJ = 2 TQ. Fuente: ICE Database.", "Refaccion",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 2, 0, 0, 2, 0},
		{"Frenos de Bicicleta", "Transporte", "Vehiculos", "Refacciones", "par",
			"Par de frenos completos para bicicleta. Energia: acero + caucho ~5 TQ.", "Refaccion",
			"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80", 5, 0, 0, 5, 0},
		// --- Animales (individuales) ---
		{"Caballo de Silla", "Transporte", "Animales", "Equinos", "unidad",
			"Caballo entrenado para montura. Energia incorporada: crianza + alimentacion 3 anos ~500 TQ (estimacion comunitaria).", "Traccion Animal",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 500, 0, 0, 500, 0},
		{"Burro de Carga", "Transporte", "Animales", "Equinos", "unidad",
			"Burro entrenado para carga. Energia incorporada: crianza + alimentacion 2 anos ~300 TQ (estimacion comunitaria).", "Traccion Animal",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 300, 0, 0, 300, 0},
		{"Mula de Carga", "Transporte", "Animales", "Equinos", "unidad",
			"Mula para carga y trabajo de campo. Energia incorporada: crianza + alimentacion 3 anos ~400 TQ (estimacion comunitaria).", "Traccion Animal",
			"https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80", 400, 0, 0, 400, 0},

		// ============ CULTURA: Instrumentos (individuales) ============
		{"Cuatro Venezolano", "Cultura", "Musica", "Cuerdas", "unidad",
			"Cuatro venezolano artesanal de madera. Energia: madera ~2kg x 8.5 MJ/kg + cuerdas + manufactura = 25 TQ. Fuente: ICE Database.", "Musica Criolla",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 25, 0, 0, 25, 0},
		{"Guitarra Artesanal", "Cultura", "Musica", "Cuerdas", "unidad",
			"Guitarra acustica artesanal de madera. Energia: madera ~4kg x 8.5 MJ/kg + cuerdas + manufactura = 40 TQ. Fuente: ICE Database.", "Musica",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 40, 0, 0, 40, 0},
		{"Tambor (Caja)", "Cultura", "Musica", "Percusion", "unidad",
			"Tambor de madera con cuero. Energia: madera ~3kg x 8.5 MJ/kg + cuero + manufactura = 30 TQ. Fuente: ICE Database.", "Percusion",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 30, 0, 0, 30, 0},
		{"Maracas (Par)", "Cultura", "Musica", "Percusion", "par",
			"Par de maracas de totuma con semillas y mango de madera. Energia: madera + semillas + manufactura = 8 TQ.", "Percusion",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 8, 0, 0, 8, 0},
		{"Flauta de Caña", "Cultura", "Musica", "Vientos", "unidad",
			"Flauta traversa de caña. Energia: caña + manufactura = 3 TQ.", "Viento",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 3, 0, 0, 3, 0},
		{"Pintura y Artes Visuales", "Cultura", "Artes", "Pintura", "unidad",
			"Cuadros, murales, retratos, cartelera. Energia: pinturas + tela/lienzo + trabajo ~54 MJ = 15 kWh.", "Arte",
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", 15, 15, 0, 0, 0},

		// ============ RECURSOS BASICOS ============
		{"Agua Purificada", "Recursos Basicos", "Agua", "Potable", "litro",
			"Agua filtrada/purificada. Energia: 0.5 MJ/L = 0.14 kWh/L (bombeo + microfiltracion). Fuente: ICE Database.", "Vital",
			"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", 1, 1, 0, 0, 0},
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

	log.Printf("Seeded %d products to node_domain=%s", len(products), nodeDomain)
	return nil
}
