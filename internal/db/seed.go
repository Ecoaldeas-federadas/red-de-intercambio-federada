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
// la plantilla modular rica (Hero, Carrusel, Tarjetas, Estadisticas, etc.)
func (d *DB) SeedPublicPages(ctx context.Context, nodeDomain string) error {
	pages := []seedPage{
		{
			Slug:     "inicio",
			Title:    "Inicio",
			Subtitle: "Bienvenida a la Feria Conuquera Agroecologica",
			Content: `[
  {
    "type": "hero",
    "badge": "🌱 10 Años Tejiendo Soberanía Alimentaria en Caracas",
    "title": "Feria Conuquera Agroecológica",
    "subtitle": "Cuando el conuco viene a la ciudad, la soberanía alimenta el alma y florece la comunidad.",
    "description": "Un espacio autogestionado de encuentro popular, economía solidaria y trueque en las faldas del Parque Los Caobos. Conectamos directamente a familias campesinas y conuqueras con los habitantes de Caracas, sin intermediarios, especulación ni agrotóxicos.",
    "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    "primary_cta": {
      "text": "Conoce Nuestros Productos",
      "link": "/p/productos"
    },
    "secondary_cta": {
      "text": "¿Cómo Funciona el Trueque?",
      "link": "/p/como-funciona"
    },
    "style": "split"
  },
  {
    "type": "event_schedule",
    "badge": "📍 Próxima Cita en Los Caobos",
    "title": "Encuentro Mensual Conuquero",
    "date_text": "El primer sábado de cada mes",
    "time_text": "Desde las 9:00 AM hasta pasado el mediodía",
    "location_name": "Parque Los Caobos, Caracas",
    "address": "Zona Sur, área del estacionamiento principal, cerca de la Fuente Venezuela (Metro Bellas Artes / Colegio de Ingenieros)",
    "guidelines": [
      "🚫 Prohibido el uso de bolsas plásticas desechables: trae tu morral, bolsa de tela o canasta.",
      "🌾 Trueque abierto de semillas nativas y criollas libres de transgénicos.",
      "📚 Espacio 'Dona y adopta un libro' de intercambio libre de saberes.",
      "🎵 Música en vivo, poesía campesina y talleres abiertos para toda la familia.",
      "💳 Registro de crédito mutuo y pagos digitales autónomos disponibles en el nodo."
    ],
    "cta_text": "Solicitar Unirse como Productor o Miembro",
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
        "description": "Mes a mes en Parque Los Caobos desde octubre de 2014"
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
        "value": "0 Bolsas Plásticas",
        "label": "Compromiso Ecológico",
        "description": "Respeto absoluto a la Madre Tierra y ciclos naturales"
      }
    ]
  },
  {
    "type": "carousel",
    "title": "Galería Viva de Nuestras Cosechas",
    "subtitle": "Postales de las jornadas de encuentro, intercambio y saberes en Los Caobos.",
    "autoplay": true,
    "items": [
      {
        "image_url": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80",
        "title": "Hortalizas Frescas y Rubros Ancestrales",
        "caption": "Cosechadas en la madrugada en El Junquito y La Pastora y traídas directamente al parque.",
        "tag": "Cosecha del Día"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80",
        "title": "Botica Conuquera y Medicina Tradicional",
        "caption": "Tinturas de propóleo, pomadas botánicas, aceites esenciales y plantas vivas medicinales.",
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
        "title": "Trueque de Semillas Libres",
        "caption": "Intercambio solidario de maíces criollos, frijoles ancestrales y tubérculos autóctonos.",
        "tag": "Semilla Campesina"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Nuestros Pilares de Acción Comunitaria",
    "subtitle": "Principios que guían cada jornada de la red conuquera y agroecológica.",
    "columns": 3,
    "items": [
      {
        "icon": "leaf",
        "title": "Agroecología Ecosocialista",
        "description": "El conuco como laboratorio de vida integral frente a la lógica destructiva del monocultivo y el agronegocio transnacional.",
        "badge": "Suelo Vivo"
      },
      {
        "icon": "users",
        "title": "Comercio Justo y Directo",
        "description": "Relación fraterna entre quien siembra y quien consume, eliminando intermediarios usureros y especulación.",
        "badge": "Sin Intermediarios"
      },
      {
        "icon": "scale",
        "title": "Crédito Mutuo y Trueque",
        "description": "Sistema contable de suma cero respaldado en valor energético (1 TQ = 1 kWh) y confianza comunitaria, sin intereses bancarios.",
        "badge": "Moneda Social"
      },
      {
        "icon": "heart",
        "title": "Semillas Libres y Nativas",
        "description": "Defensa irrestricta de la Ley de Semillas de Venezuela: protección de variedades criollas frente a semillas transgénicas patentadas.",
        "badge": "Biodiversidad"
      },
      {
        "icon": "shopping-cart",
        "title": "Gastronomía y Saberes",
        "description": "Rescate de recetas patrimoniales como la cafunga de Barlovento, harinas ancestrales, fermentos y medicina botánica.",
        "badge": "Tradición Viva"
      },
      {
        "icon": "home",
        "title": "Comunidad Ecoaldeana",
        "description": "Articulación con el Proyecto Campo Soberano para el desarrollo de hábitats rurales de ciclo cerrado y soberanía integral.",
        "badge": "Permacultura"
      }
    ]
  },
  {
    "type": "cta_banner",
    "badge": "🤝 Participa en la Red",
    "title": "¿Eres productor agroecológico o artesano?",
    "subtitle": "Súmate a la red comunitaria. La asamblea evalúa solicitudes de familias productoras, colectivos y vecinos que deseen integrarse al sistema de intercambio solidario.",
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
			Title:    "Historia y Filosofía",
			Subtitle: "Nuestra Trayectoria, Conuco y Resistencia",
			Content: `[
  {
    "type": "hero",
    "badge": "📜 Nacidos el 29 de Octubre de 2014",
    "title": "Un Movimiento al Calor de la Semilla Libre",
    "subtitle": "El conuco como horizonte histórico, político y espiritual de soberanía integral.",
    "description": "Nacimos en un momento crucial de la historia agrícola nacional, al calor de los intensos debates populares organizados por el Movimiento Semillas del Pueblo para la construcción colectiva de la Ley de Semillas de Venezuela.",
    "image_url": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "🌱 Concepción Agroecológica",
    "title": "El Conuco como Laboratorio de Vida",
    "subtitle": "Resistencia frente al monocultivo y la usura comercial",
    "content": "Para nosotros, el conuco no es una técnica atrasada de cultivo, sino un laboratorio de vida integral y una forma de resistencia activa. Es un policultivo biodiverso que respeta los tiempos de la naturaleza, regenera los microorganismos del suelo y rompe de raíz con la dependencia del agronegocio transnacional y los venenos químicos.\n\nHeredamos los saberes de nuestros antepasados indígenas, campesinos y afrodescendientes para demostrar que la producción sana en la ciudad y sus periferias es un proyecto político y pedagógico que transforma la conciencia humana.",
    "image_url": "https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80",
    "image_position": "left",
    "highlights": [
      "Policultivo sin venenos químicos ni semillas transgénicas.",
      "Manejo biológico de plagas con extractos botánicos (neem, ajo, ají).",
      "Abonos orgánicos: compost, biol, bocashi y lombricultura comunitaria.",
      "Soberanía hídrica con recolección de aguas de lluvia y acequias de infiltración."
    ],
    "quote": {
      "text": "El conuco es la escuela donde la tierra nos enseña que la abundancia nace de la diversidad y el respeto mutuo.",
      "author": "Vocería Colectiva de la Feria Conuquera"
    }
  },
  {
    "type": "testimonials",
    "title": "Colectivos y Familias Fundadoras",
    "subtitle": "Algunas de las experiencias que hacen vida mes a mes en la red.",
    "items": [
      {
        "name": "Melissa Producción Diversificada",
        "role": "Mónica Pérez y Luis Araujo",
        "project": "Camino de los Españoles, La Pastora",
        "quote": "Comenzamos sembrando en las faldas de El Ávila para demostrar que la montaña puede alimentar a Caracas con dignidad y amor a la naturaleza.",
        "location": "Caracas, Dto. Capital"
      },
      {
        "name": "Unidad Productiva La Buhardilla",
        "role": "Giselle Perdomo (Bióloga)",
        "project": "Salud Botánica y Cosmética Eco-Sustentable",
        "quote": "Empecé a investigar y formular cosmética y medicina natural para el cuidado de mi hijo con discapacidad. Hoy es nuestro aporte para la salud comunitaria.",
        "location": "Caracas"
      },
      {
        "name": "Alfivegetales Km 38",
        "role": "Familia Miranda",
        "project": "Hortalizas y Caprinos en El Junquito",
        "quote": "Llevamos 10 años ininterrumpidos en Los Caobos trayendo acelgas, col rizada, queso de cabra y tubérculos 100% agroecológicos.",
        "location": "El Junquito, Miranda"
      },
      {
        "name": "Cooperativa EPAU",
        "role": "Escuela Popular de Agricultura Urbana",
        "project": "Organopónico Bolívar 1, Bellas Artes",
        "quote": "Formamos a cientos de jóvenes y vecinos en lombricultura, compostaje y bioinsumos para llenar de huertos urbanos toda la ciudad.",
        "location": "Bellas Artes, Caracas"
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
			Subtitle: "Catálogo de Cosecha Fresca, Medicina y Gastronomía",
			Content: `[
  {
    "type": "hero",
    "badge": "Del Campo a tu Mesa sin Intermediarios",
    "title": "Sabores, Cosecha Sana y Bienestar",
    "subtitle": "Todo lo que necesitas para una alimentación nutritiva, limpia y libre de agrotóxicos.",
    "description": "Encuentra hortalizas frescas de temporada, semillas ancestrales, tubérculos autóctonos, derivados lácteos artesanales, botica conuquera, cosmética natural y delicias gastronómicas tradicionales.",
    "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "products_showcase",
    "title": "Catálogo de Rubros y Especialidades",
    "subtitle": "Conoce la variedad de bienes disponibles cada primer sábado de mes.",
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
        "description": "Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollín, cilantro de monte y apio España cosechados el mismo día.",
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
        "description": "Desodorantes ecológicos de aceite de coco y bicarbonato, bálsamos labiales de cera de abeja, jabones artesanales y toallas ecológicas reutilizables.",
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
        "description": "Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla artesanal de pequeños rebaños pastoreados.",
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
			Subtitle: "Educación Popular, Trueque de Semillas y Cultura",
			Content: `[
  {
    "type": "hero",
    "badge": "🎨 Un Espacio de Intercambio Integral",
    "title": "Más que un Mercado: Aula Abierta y Cultura",
    "subtitle": "Talleres gratuitos, trueque libre de semillas y libros, y música en vivo.",
    "description": "Inspirados en la metodología 'de campesino a campesino', cada jornada en Parque Los Caobos cuenta con actividades pedagógicas gratuitas para compartir conocimientos de lombricultura, salud botánica, fermentos y agroecología.",
    "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Espacios Solidarios Permanentes",
    "subtitle": "Dinámicas que puedes disfrutar en cada edición de la feria.",
    "columns": 3,
    "items": [
      {
        "icon": "leaf",
        "title": "Trueque de Semillas Nativas",
        "description": "Mesa comunitaria para entregar y recibir semillas libres de patentes. Protegemos nuestra agrobiodiversidad compartiendo variedades locales.",
        "badge": "Libre y Gratuito"
      },
      {
        "icon": "heart",
        "title": "Dona y Adopta un Libro",
        "description": "Punto de intercambio de novelas, manuales agrícolas, textos de ecología y poesía. Llévate un libro con la promesa de seguir compartiendo el saber.",
        "badge": "Lectura Libre"
      },
      {
        "icon": "users",
        "title": "Aula Conuquera Abierta",
        "description": "Talleres prácticos: elaboración de kokedamas, preparación de sustratos con fibra de coco, extractos botánicos y crianza de lombrices.",
        "badge": "Talleres en Vivo"
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
			Subtitle: "Sistema Contable de Crédito Mutuo con Saldo Cero",
			Content: `[
  {
    "type": "hero",
    "badge": "⚡ 1 TQ = 1 kWh de Energía Objetiva",
    "title": "Contabilidad Mutua, No Dinero Tradicional",
    "subtitle": "Una herramienta de registro comunitario donde lo que das y lo que recibes siempre suma cero.",
    "description": "El trueque no es dinero emitido por un banco ni se compra ni se vende. Es un registro transparente de compromisos entre miembros de la comunidad que permite el intercambio de bienes, trabajo y saberes sin intermediación financiera.",
    "image_url": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "trueque_explainer",
    "title": "Los 4 Pasos del Crédito Mutuo",
    "subtitle": "Comprende la lógica solidaria y transparente del sistema contable.",
    "energy_rate_text": "El valor de referencia es 1 TQ = 1 kWh de energía total invertida en la producción.",
    "steps": [
      {
        "step": 1,
        "title": "Empiezas en Cero (0 TQ)",
        "description": "Al unirte a la red, tu cuenta inicia en balance 0. No necesitas comprar monedas ni aportar capital para participar.",
        "icon": "users"
      },
      {
        "step": 2,
        "title": "Cuando Compras o Recibes Bienes",
        "description": "Tu cuenta registra saldo negativo (ej: -50 TQ). No es una deuda bancaria usurera: es un compromiso de entregar productos o trabajo futuro a la comunidad.",
        "icon": "shopping-cart"
      },
      {
        "step": 3,
        "title": "Cuando Vendes o Aportas Trabajo",
        "description": "Tu cuenta registra saldo positivo (ej: +50 TQ). Significa que has entregado valor a la comunidad y tienes derecho a adquirir bienes de otros miembros.",
        "icon": "leaf"
      },
      {
        "step": 4,
        "title": "La Suma Total Siempre es Cero",
        "description": "La suma de todas las cuentas de la red da exactamente 0 TQ. No existe inflación, devaluación ni emisión descontrolada.",
        "icon": "scale"
      }
    ],
    "key_points": {
      "positive_balance": "Indica que has aportado más de lo que has consumido. Puedes canjearlo por bienes de cualquier otro miembro de la red.",
      "negative_balance": "Es un saldo deudor ético: has recibido sustento y lo retribuirás con tu propia producción o servicios. Existen topes definidos por la asamblea.",
      "zero_sum": "Nadie lucra con la emisión. No hay tasas de interés sobre el ahorro ni penalizaciones financieras sobre el saldo negativo."
    }
  },
  {
    "type": "faq",
    "title": "Preguntas Clave sobre el Trueque",
    "subtitle": "Dudas comunes sobre valor, límites y gobernanza.",
    "items": [
      {
        "question": "¿Por qué se utiliza la energía (kWh) como referencia de valor?",
        "answer": "Porque la energía es una medida objetiva y física del esfuerzo humano, de los insumos y de las herramientas utilizadas para producir cualquier bien, protegiendo a la comunidad de la especulación monetaria."
      },
      {
        "question": "¿Qué evita que alguien acumule o gaste sin límite?",
        "answer": "La asamblea establece límites máximos de crédito (tope positivo) y límites de débito (tope negativo) según el nivel de cada miembro u organización."
      },
      {
        "question": "¿Qué pasa si un miembro decide retirarse de la red?",
        "answer": "Si su saldo es cero, se retira sin obligaciones. Si tiene saldo negativo, debe compensar entregando bienes o trabajo. Si tiene saldo positivo, puede consumir su balance antes de salir."
      }
    ]
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
			Subtitle: "Dudas Frecuentes para Visitantes y Nuevos Productores",
			Content: `[
  {
    "type": "hero",
    "badge": "💡 Centro de Respuestas",
    "title": "Preguntas Frecuentes",
    "subtitle": "Todo lo que necesitas saber para visitarnos, comprar, truequear o sumarte a la feria.",
    "image_url": "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Información General y Participación",
    "items": [
      {
        "question": "¿Cuándo y dónde se realiza la Feria Conuquera?",
        "answer": "Se celebra el primer sábado de cada mes en el Parque Los Caobos de Caracas (zona sur, cerca del estacionamiento y la Fuente Venezuela), desde las 9:00 AM hasta la 1:00 PM aproximadamente."
      },
      {
        "question": "¿Cómo llegar en transporte público?",
        "answer": "Puedes llegar en Metro de Caracas bajándote en la estación Bellas Artes o Colegio de Ingenieros. Desde allí caminas 5 minutos hacia el Parque Los Caobos."
      },
      {
        "question": "¿Por qué no se permiten bolsas plásticas desechables?",
        "answer": "Porque la agroecología es un compromiso integral con la vida. El plástico contamina ríos y suelos. Te invitamos a traer bolsas de tela, morrales, recipientes o canastas reutilizables."
      },
      {
        "question": "Soy productor agroecológico y quiero participar, ¿qué debo hacer?",
        "answer": "Debes llenar el formulario de solicitud de admisión en esta plataforma. La asamblea conuquera evalúa que la producción sea 100% agroecológica (sin agrotóxicos) y coordina una visita formativa."
      },
      {
        "question": "¿Se puede pagar con moneda convencional o solo trueque?",
        "answer": "Se promueve activamente el trueque directo y el sistema de crédito mutuo (Trueque TQ), pero los visitantes que aún no tienen cuenta pueden coordinar intercambios o adquirir productos con aportes solidarios directos a los productores."
      },
      {
        "question": "¿Tienen actividades para niños y familias?",
        "answer": "¡Sí! Cada edición incluye títeres, trueque de libros infantiles, talleres de siembra para niños y música popular venezolana al aire libre."
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
			Subtitle: "Canales de Comunicación y Cómo Llegar",
			Content: `[
  {
    "type": "contact_location",
    "title": "Ponte en Contacto con la Red Conuquera",
    "subtitle": "Estamos a tu disposición para dudas, voluntariado o articulación comunitaria.",
    "address": "Parque Los Caobos, área del estacionamiento sur, cerca de la Fuente Venezuela, Caracas, Distrito Capital, Venezuela.",
    "schedule": "Primer sábado de cada mes, de 9:00 AM a 1:00 PM",
    "instagram": "feriaconuquera",
    "facebook": "feriaconuquera",
    "email": "contacto@feriaconuquera.org",
    "phone": "+58 212 000-0000",
    "transport_info": "Estación Metro Bellas Artes (Línea 1) o Colegio de Ingenieros. Acceso vehicular por la avenida México y Plaza Venezuela."
  },
  {
    "type": "cta_banner",
    "badge": "📩 Formulario Abierto",
    "title": "¿Deseas enviar una solicitud de ingreso formal?",
    "subtitle": "Llena nuestro formulario público y un vocero de la asamblea te contactará.",
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
		// Inserta o actualiza para garantizar que el contenido modular rico este presente
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
