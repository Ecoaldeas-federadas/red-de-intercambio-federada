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
    "title": "Catálogo de Rubros en la Feria",
    "subtitle": "Variedad de alimentos y productos artesanales disponibles en cada jornada.",
    "categories": [
      "Cosecha Fresca",
      "Medicina Botánica & Cosmética",
      "Gastronomía Artesanal",
      "Semillas & Plántulas"
    ],
    "items": [
      {
        "name": "Hortalizas y Hojas Verdes de El Junquito",
        "category": "Cosecha Fresca",
        "description": "Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollín, cilantro de monte y apio España cosechados en la mañana.",
        "badge": "Fresco del Día",
        "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Tubérculos Ancestrales y Plátanos",
        "category": "Cosecha Fresca",
        "description": "Ñame morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura y cambur morado.",
        "badge": "Rubro Olvidado",
        "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Tinturas Madres y Botica Conuquera",
        "category": "Medicina Botánica & Cosmética",
        "description": "Extractos de propóleo puro, tinturas de moringa, cúrcuma, jengibre, pomadas desinflamatorias de árnica y jarabes naturales.",
        "badge": "100% Puro",
        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Cosmética Natural sin Químicos",
        "category": "Medicina Botánica & Cosmética",
        "description": "Desodorantes ecológicos de aceite de coco y bicarbonato, bálsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.",
        "badge": "Residuo Cero",
        "image_url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "La Tradicional Cafunga de Barlovento",
        "category": "Gastronomía Artesanal",
        "description": "Dulce patrimonial afrovenezolano elaborado a base de plátano maduro, coco rallado, papelón y anís dulce, horneado en hoja de plátano.",
        "badge": "Plato Estrella",
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Quesos Artesanales de Búfala y Cabra",
        "category": "Gastronomía Artesanal",
        "description": "Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequeños rebaños pastoreados.",
        "badge": "Pastoreo Libre",
        "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Cacao Puro, Chocolates y Café de Montaña",
        "category": "Gastronomía Artesanal",
        "description": "Barras de chocolate bean-to-bar 70% cacao de Barlovento y Chuao, licor de cacao artesanal y café lavado tostado a leña.",
        "badge": "Origen Venezolano",
        "image_url": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80"
      },
      {
        "name": "Plántulas Medicinales y Semillas Criollas",
        "category": "Semillas & Plántulas",
        "description": "Plantas en maceta de poleo, estevia, malojillo, romero, ruda, orégano orejón y sobres de semillas adaptadas al clima caraqueño.",
        "badge": "Para tu Huerto",
        "image_url": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=600&q=80"
      }
    ]
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
    "description": "En la feria, la venta al público general se realiza de forma directa en moneda local. Paralelamente, los miembros registrados cuentan con una herramienta contable de crédito mutuo donde lo que das y lo que recibes se calcula en base a la energía física invertida (1 TQ = 1 kWh).",
    "image_url": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "trueque_explainer",
    "title": "Los 4 Pasos del Crédito Mutuo para Miembros",
    "subtitle": "Comprende la lógica solidaria y transparente del sistema de trueque.",
    "energy_rate_text": "Valor de referencia objetivo: 1 TQ = 1 kWh de energía",
    "steps": [
      {
        "step": 1,
        "title": "Empiezas en Cero (0 TQ)",
        "description": "Al ingresar formalmente a la red, tu cuenta inicia en balance 0. No necesitas comprar monedas ni aportar capital.",
        "icon": "users"
      },
      {
        "step": 2,
        "title": "Al Recibir Bienes en Trueque",
        "description": "Tu cuenta registra saldo negativo (-TQ). Es un compromiso ético de entregar productos o trabajo futuro a la comunidad.",
        "icon": "shopping-cart"
      },
      {
        "step": 3,
        "title": "Al Aportar Cosecha o Trabajo",
        "description": "Tu cuenta registra saldo positivo (+TQ). Significa que has entregado valor a la comunidad y puedes adquirir bienes de otros miembros.",
        "icon": "leaf"
      },
      {
        "step": 4,
        "title": "La Suma Total Siempre es Cero",
        "description": "El total de todas las cuentas de la red da exactamente 0 TQ. No existe inflación, devaluación ni intermediarios bancarios.",
        "icon": "scale"
      }
    ],
    "key_points": {
      "positive_balance": "Indica que has aportado más de lo que has recibido. Tienes derecho a adquirir bienes o servicios de otros miembros.",
      "negative_balance": "Es un saldo deudor solidario: has recibido sustento y lo retribuirás con tu propia cosecha, productos o trabajo.",
      "zero_sum": "El sistema no crea dinero de la nada ni cobra intereses usureros. Se basa en el trabajo real y la confianza mutua."
    }
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
