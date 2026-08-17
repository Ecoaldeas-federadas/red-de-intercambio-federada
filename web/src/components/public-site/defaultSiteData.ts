import { SiteBlock } from '../../types/publicSite'

export interface PreconfiguredPageTemplate {
  slug: string
  title: string
  subtitle: string
  icon: string
  menu_order: number
  blocks: SiteBlock[]
}

export const FERIA_CONUQUERA_TEMPLATES: PreconfiguredPageTemplate[] = [
  {
    slug: 'inicio',
    title: 'Inicio',
    subtitle: 'Mercado a Cielo Abierto y Red de Soberanía Alimentaria',
    icon: 'home',
    menu_order: 1,
    blocks: [
      {
        type: 'hero',
        badge: '🌱 Mercado a Cielo Abierto & 10 Años de Historia',
        title: 'Feria Conuquera Agroecológica',
        subtitle: 'Cosecha fresca, alimentos sanos y saberes campesinos para toda Caracas.',
        description:
          'El primer sábado de cada mes abrimos nuestro mercado a cielo abierto en Parque Los Caobos para todo el público general en moneda local. Un espacio autogestionado donde compras directo al productor sin intermediarios ni agrotóxicos, y donde los miembros de la red además intercambian en trueque y crédito mutuo.',
        image_url:
          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
        primary_cta: {
          text: 'Ver Catálogo de Productos',
          link: '/p/productos',
        },
        secondary_cta: {
          text: 'Horarios y Ubicación',
          link: '/p/contacto',
        },
        style: 'split',
      },
      {
        type: 'event_schedule',
        badge: '📍 Mercado Abierto al Público General',
        title: 'Encuentro Mensual en Los Caobos',
        date_text: 'El primer sábado de cada mes',
        time_text: 'Desde las 9:00 AM hasta pasado el mediodía',
        location_name: 'Parque Los Caobos, Caracas',
        address: 'Zona Sur, área del estacionamiento principal, cerca de la Fuente Venezuela (Metro Bellas Artes / Colegio de Ingenieros)',
        guidelines: [
          '�️ Venta abierta a todo el público en moneda local (no necesitas ser miembro para comprar).',
          '�🚫 Prohibido el uso de bolsas plásticas desechables: trae tu morral, bolsa de tela o canasta.',
          '🌾 Trueque abierto de semillas criollas y nativas entre agricultores y vecinos.',
          '📚 Espacio "Dona y adopta un libro" de intercambio libre de lectura.',
          '� Talleres de aprendizaje en vivo (lombricultura, bioinsumos, salud botánica).',
          '🎵 Música popular, actividades culturales y dinámicas para niños.',
          '💳 Sistema de trueque y crédito mutuo disponible para miembros registrados.',
        ],
        cta_text: 'Solicitar Ingreso como Productor o Miembro',
        cta_link: '/p/unirse',
      },
      {
        type: 'stats',
        title: 'Diez Años Construyendo Soberanía Popular',
        subtitle: 'Cifras reales de un movimiento autónomo nacido en 2014 al calor de la Ley de Semillas.',
        bg_theme: 'primary',
        items: [
          {
            value: '+10 Años',
            label: 'De Encuentro Continuo',
            description: 'Mercado mensual en Parque Los Caobos desde octubre de 2014',
          },
          {
            value: '+45 Colectivos',
            label: 'Familias Productoras',
            description: 'Valles del Tuy, El Junquito, El Hatillo, La Pastora y Baruta',
          },
          {
            value: '0% Agrotóxicos',
            label: 'Producción 100% Limpia',
            description: 'Suelos vivos, abonos orgánicos y semillas ancestrales',
          },
          {
            value: 'Venta Libre',
            label: 'Moneda Local & Trueque',
            description: 'Abierto a toda Caracas con opción de trueque para miembros',
          },
        ],
      },
      {
        type: 'carousel',
        title: 'Galería Viva de Nuestras Jornadas',
        subtitle: 'Postales de las jornadas de mercado, talleres, cultura y trueque en Los Caobos.',
        autoplay: true,
        items: [
          {
            image_url:
              'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80',
            title: 'Hortalizas Frescas y Rubros Ancestrales',
            caption: 'Cosechadas en la madrugada en El Junquito y La Pastora para venta directa en moneda local.',
            tag: 'Cosecha del Día',
          },
          {
            image_url:
              'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1000&q=80',
            title: 'Botica Conuquera y Medicina Tradicional',
            caption: 'Tinturas de propóleo, pomadas botánicas, aceites esenciales y plantas medicinales.',
            tag: 'Salud Botánica',
          },
          {
            image_url:
              'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80',
            title: 'Gastronomía Artesanal y Ancestral',
            caption: 'La tradicional Cafunga de Barlovento, harinas sin gluten, cacao puro y café de montaña.',
            tag: 'Sabores Soberanos',
          },
          {
            image_url:
              'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=1000&q=80',
            title: 'Talleres en Vivo & Trueque de Semillas',
            caption: 'Intercambio solidario de saberes, semillas nativas y libros para toda la comunidad.',
            tag: 'Formación Popular',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Dinámica y Organización de la Red',
        subtitle: 'Cómo funciona la Feria Conuquera tanto en el mercado mensual como en su vida interna.',
        columns: 3,
        items: [
          {
            icon: 'shopping-cart',
            title: 'Mercado Mensual a Cielo Abierto',
            description:
              'Venta directa al público general en moneda local cada primer sábado de mes en Parque Los Caobos. Sin intermediarios ni usura.',
            badge: 'Venta Pública',
          },
          {
            icon: 'scale',
            title: 'Trueque & Crédito Mutuo',
            description:
              'Los miembros de la red pueden intercambiar productos y trabajo mediante el sistema contable de suma cero (1 TQ = 1 kWh).',
            badge: 'Para Miembros',
          },
          {
            icon: 'users',
            title: 'Asambleas Trimestrales',
            description:
              'Encuentros de gobernanza cada 3 meses donde los colectivos y productores deciden acuerdos, normas y planificación.',
            badge: 'Gobernanza',
          },
          {
            icon: 'leaf',
            title: 'Talleres & Formación Popular',
            description:
              'Espacios educativos abiertos durante la feria y visitas a conucos sobre lombricultura, bioinsumos y agroecología.',
            badge: 'Educación',
          },
          {
            icon: 'heart',
            title: 'Cultura, Música & Comunidad',
            description:
              'Presentaciones musicales, poesía popular, actividades infantiles y comidas comunitarias en cada edición.',
            badge: 'Cultura Viva',
          },
          {
            icon: 'home',
            title: 'Comisiones & Cayapas de Campo',
            description:
              'Trabajo colectivo fuera del parque: comisiones temáticas, visitas técnicas a conucos y articulación ecoaldeana.',
            badge: 'Comunidad',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🤝 Participa en la Red',
        title: '¿Eres productor agroecológico o deseas sumarte?',
        subtitle:
          'Cualquier persona puede comprar en la feria. Si deseas ingresar como productor o participar en las asambleas y trueques, postúlate ante la asamblea.',
        button_text: 'Completar Solicitud de Admisión',
        button_link: '/p/unirse',
        secondary_text: 'Preguntas Frecuentes',
        secondary_link: '/p/faq',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'filosofia',
    title: 'Historia y Organización',
    subtitle: 'Nuestra Trayectoria, Asambleas y Vida Comunitaria',
    icon: 'heart',
    menu_order: 2,
    blocks: [
      {
        type: 'hero',
        badge: '📜 Nacidos el 29 de Octubre de 2014',
        title: 'Un Movimiento al Calor de la Semilla Libre',
        subtitle: 'El conuco como horizonte histórico, político y espiritual de soberanía integral.',
        description:
          'Nacimos en un momento crucial de la historia agrícola nacional, al calor de los debates populares del Movimiento Semillas del Pueblo para la construcción de la Ley de Semillas de Venezuela. La feria es tanto un mercado mensual como una organización viva con asambleas y comisiones activas.',
        image_url:
          'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
        style: 'split',
      },
      {
        type: 'split_story',
        badge: '�️ Estructura y Organización',
        title: 'Vida Organizativa Más Allá del Mercado',
        subtitle: 'Asambleas trimestrales, comisiones y trabajo colectivo',
        content:
          'La Feria Conuquera no es solo el evento de venta del primer sábado de cada mes. Contamos con una estructura organizativa sólida y horizontal:\n\n• **Asambleas Trimestrales:** Cada 3 meses, todos los colectivos y familias productoras se reúnen en asamblea formal para evaluar el funcionamiento, admitir nuevos proyectos y debatir políticas colectivas.\n• **Comisiones de Trabajo:** Se conforman comisiones periódicas para la logística, comunicación, bioinsumos, cultura y articulación comunitaria.\n• **Actividades y Cayapas de Campo:** Organizamos jornadas de trabajo voluntario y formativo en los conucos y unidades productivas en El Junquito, La Pastora, Baruta y Valles del Tuy.',
        image_url:
          'https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80',
        image_position: 'left',
        highlights: [
          'Mercado mensual a cielo abierto con venta al público en moneda local.',
          'Asamblea general cada 3 meses para toma de decisiones democráticas.',
          'Talleres y actividades pedagógicas permanentes de campesino a campesino.',
          'Comisiones de trabajo voluntario para el cuidado colectivo.',
        ],
        quote: {
          text: 'El conuco es la escuela donde la tierra nos enseña que la abundancia nace de la diversidad y la organización comunitaria.',
          author: 'Vocería Colectiva de la Feria Conuquera',
        },
      },
      {
        type: 'timeline_history',
        badge: 'Hitos',
        title: 'Nuestra Línea de Tiempo',
        subtitle: 'Más de una década de siembra, trueque y organización popular.',
        items: [
          {
            year: 'Octubre 2014',
            title: 'Nacimiento de la Feria Conuquera',
            description: 'Primer mercado en Los Caobos articulando a productores urbanos y rurales en resistencia económica.',
            badge: 'Fundación',
          },
          {
            year: 'Diciembre 2015',
            title: 'Aprobación de la Ley de Semillas',
            description: 'Victoria popular protegiendo las semillas nativas y prohibiendo transgénicos y patentes agrícolas.',
            badge: 'Ley Popular',
          },
          {
            year: '2016 - 2023',
            title: 'Consolidación de Asambleas y Talleres',
            description: 'Encuentros trimestrales continuos, formación en bioinsumos y articulación con escuelas y organopónicos.',
            badge: 'Crecimiento',
          },
          {
            year: 'Octubre 2024',
            title: '10 Años de Encuentro Ininterrumpido',
            description: 'Celebración de una década en Los Caobos e integración de sistemas digitales de trueque y crédito mutuo.',
            badge: 'Presente',
          },
        ],
      },
      {
        type: 'testimonials',
        title: 'Colectivos y Familias Fundadoras',
        subtitle: 'Algunas de las experiencias que hacen vida activa en la red.',
        items: [
          {
            name: 'Melissa Producción Diversificada',
            role: 'Mónica Pérez y Luis Araujo',
            project: 'Camino de los Españoles, La Pastora',
            quote:
              'Sembrar en las faldas de El Ávila nos ha permitido alimentar a Caracas con dignidad, amor a la tierra y precios justos para nuestro pueblo.',
            location: 'Caracas, Dto. Capital',
          },
          {
            name: 'Alfivegetales Km 38',
            role: 'Familia Miranda',
            project: 'El Junquito Km 38',
            quote:
              'Llevamos 10 años trayendo acelgas, col rizada, queso de cabra y tubérculos 100% agroecológicos para venta directa en moneda local a toda la ciudad.',
            location: 'El Junquito, Miranda',
          },
        ],
      },
    ],
  },
  {
    slug: 'productos',
    title: 'Nuestros Productos',
    subtitle: 'Venta Abierta en Moneda Local y Catálogo de Cosecha',
    icon: 'shopping-cart',
    menu_order: 3,
    blocks: [
      {
        type: 'hero',
        badge: '🥦 Venta Directa en Moneda Local',
        title: 'Cosecha Sana, Sabores y Medicina',
        subtitle: 'Compra directamente a los productores en moneda local cada primer sábado de mes.',
        description:
          'No necesitas ser miembro de la feria para comprar. Ven a Parque Los Caobos y encuentra hortalizas recién cosechadas, tubérculos ancestrales, quesos artesanales, botica conuquera, cosmética natural y delicias tradicionales a precios solidarios.',
        image_url:
          'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
        style: 'standard',
      },
      {
        type: 'products_showcase',
        title: 'Catálogo de Rubros en la Feria',
        subtitle: 'Variedad de alimentos y productos artesanales disponibles en cada jornada.',
        categories: [
          'Cosecha Fresca',
          'Medicina Botánica & Cosmética',
          'Gastronomía Artesanal',
          'Semillas & Plántulas',
        ],
        items: [
          {
            name: 'Hortalizas y Hojas Verdes de El Junquito',
            category: 'Cosecha Fresca',
            description:
              'Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollín, cilantro de monte y apio España cosechados en la mañana.',
            badge: 'Fresco del Día',
            image_url:
              'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Tubérculos Ancestrales y Plátanos',
            category: 'Cosecha Fresca',
            description:
              'Ñame morado criollo, ocumo blanco y morado, yuca dulce de Carayaca, auyama madura y cambur morado.',
            badge: 'Rubro Olvidado',
            image_url:
              'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Tinturas Madres y Botica Conuquera',
            category: 'Medicina Botánica & Cosmética',
            description:
              'Extractos de propóleo puro, tinturas de moringa, cúrcuma, jengibre, pomadas desinflamatorias de árnica y jarabes naturales.',
            badge: '100% Puro',
            image_url:
              'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Cosmética Natural sin Químicos',
            category: 'Medicina Botánica & Cosmética',
            description:
              'Desodorantes ecológicos de aceite de coco y bicarbonato, bálsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.',
            badge: 'Residuo Cero',
            image_url:
              'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'La Tradicional Cafunga de Barlovento',
            category: 'Gastronomía Artesanal',
            description:
              'Dulce patrimonial afrovenezolano elaborado a base de plátano maduro, coco rallado, papelón y anís dulce, horneado en hoja de plátano.',
            badge: 'Plato Estrella',
            image_url:
              'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Quesos Artesanales de Búfala y Cabra',
            category: 'Gastronomía Artesanal',
            description:
              'Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequeños rebaños pastoreados.',
            badge: 'Pastoreo Libre',
            image_url:
              'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Cacao Puro, Chocolates y Café de Montaña',
            category: 'Gastronomía Artesanal',
            description:
              'Barras de chocolate bean-to-bar 70% cacao de Barlovento y Chuao, licor de cacao artesanal y café lavado tostado a leña.',
            badge: 'Origen Venezolano',
            image_url:
              'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
          },
          {
            name: 'Plántulas Medicinales y Semillas Criollas',
            category: 'Semillas & Plántulas',
            description:
              'Plantas en maceta de poleo, estevia, malojillo, romero, ruda, orégano orejón y sobres de semillas adaptadas al clima caraqueño.',
            badge: 'Para tu Huerto',
            image_url:
              'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=600&q=80',
          },
        ],
      },
    ],
  },
  {
    slug: 'comunidad',
    title: 'Comunidad y Saberes',
    subtitle: 'Talleres en Vivo, Cultura, Semillas y Asambleas',
    icon: 'users',
    menu_order: 4,
    blocks: [
      {
        type: 'hero',
        badge: '🎨 Aula Abierta, Cultura & Deportes',
        title: 'Más que un Mercado: Espacio de Formación Popular',
        subtitle: 'Talleres gratuitos, música en vivo, trueque de libros y semillas para toda la familia.',
        description:
          'Inspirados en la metodología "de campesino a campesino", cada jornada en Parque Los Caobos cuenta con actividades pedagógicas gratuitas para compartir conocimientos de siembra, lombricultura, salud botánica y fermentos.',
        image_url:
          'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
        style: 'split',
      },
      {
        type: 'features_grid',
        title: 'Actividades Permanentes en la Feria',
        subtitle: 'Dinámicas formativas y culturales gratuitas en cada edición.',
        columns: 3,
        items: [
          {
            icon: 'leaf',
            title: 'Trueque Libre de Semillas Criollas',
            description:
              'Mesa comunitaria de intercambio de semillas nativas y locales. Trae las tuyas y llévate variedades adaptadas sin costo alguno.',
            badge: 'Intercambio',
          },
          {
            icon: 'heart',
            title: 'Dona y Adopta un Libro',
            description:
              'Punto de intercambio de novelas, manuales de siembra y poesía. Llévate un libro con el compromiso de seguir compartiendo el saber.',
            badge: 'Lectura Libre',
          },
          {
            icon: 'users',
            title: 'Aula Conuquera Abierta',
            description:
              'Talleres prácticos en vivo: sustratos con fibra de coco, biofertilizantes, kokedamas, medicina tradicional y bioinsumos.',
            badge: 'Talleres Gratis',
          },
          {
            icon: 'shopping-cart',
            title: 'Música & Expresiones Culturales',
            description:
              'Música tradicional venezolana, ska popular, cantautores populares con cuatro y poesía campesina en vivo.',
            badge: 'Música en Vivo',
          },
          {
            icon: 'scale',
            title: 'Dinámicas Infantiles & Familiares',
            description:
              'Juegos educativos, títeres y actividades recreativas y deportivas al aire libre para los más pequeños.',
            badge: 'Para la Familia',
          },
          {
            icon: 'home',
            title: 'Encuentros y Asambleas Trimestrales',
            description:
              'Espacios de deliberación y planificación interna entre colectivos, además de visitas y cayapas en conucos periurbanos.',
            badge: 'Organización',
          },
        ],
      },
    ],
  },
  {
    slug: 'como-funciona',
    title: 'Cómo Funciona el Trueque',
    subtitle: 'Crédito Mutuo Comunitario para Miembros Registrados',
    icon: 'help-circle',
    menu_order: 5,
    blocks: [
      {
        type: 'hero',
        badge: '⚡ 1 TQ = 1 kWh de Energía Objetiva',
        title: 'Venta en Moneda Local vs. Trueque Comunitario',
        subtitle: 'Todo el público puede comprar en moneda local; los miembros además intercambian en Trueque TQ.',
        description:
          'En la feria, la venta al público general se realiza de forma directa en moneda local. Paralelamente, los miembros registrados cuentan con una herramienta contable de crédito mutuo donde lo que das y lo que recibes se calcula en base a la energía física invertida (1 TQ = 1 kWh).',
        image_url:
          'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
        style: 'standard',
      },
      {
        type: 'features_grid',
        title: '¿Qué es el Trueque?',
        subtitle: 'Una forma milenaria de intercambio que renace en las comunidades contemporáneas',
        columns: 2,
        items: [
          {
            icon: 'users',
            title: 'Intercambio sin dinero',
            description:
              'El trueque es una forma de intercambio basada en la colaboración y el valor compartido. A través de la red, personas y comunidades intercambian bienes y servicios directamente, sin necesidad de dinero, bancos ni intermediarios financieros. Promueve la autosuficiencia, el apoyo mutuo y el desarrollo sostenible.',
            badge: 'Sin dinero',
          },
          {
            icon: 'scale',
            title: 'Valor por energía, no por precio',
            description:
              'No existe un precio en unidades monetarias. El valor lo determina la energía física invertida en producir cada bien o servicio: horas de trabajo, esfuerzo, insumos, herramientas y amortización. Una hora de trabajo manual equivale aproximadamente a 0.1 kWh; un litro de leche de cabra pastoreada libre requiere energía directa, humana y de insumos.',
            badge: 'Energía objetiva',
          },
          {
            icon: 'heart',
            title: 'Multilateral y diferido',
            description:
              'No necesitas encontrar a alguien que tenga exactamente lo que tú quieres y quiera exactamente lo que tú ofreces (la "doble coincidencia" del trueque directo). El sistema de crédito mutuo permite que aportes hoy a una persona y recibas mañana de otra. El trueque se vuelve diferido y multilateral: aportas cuando puedes, recibes cuando necesitas.',
            badge: 'Diferido',
          },
          {
            icon: 'leaf',
            title: 'Sin interés, sin acumulación',
            description:
              'No se cobra interés sobre los saldos negativos ni se premia la acumulación de saldos positivos. El sistema está diseñado para que la riqueza circule, no para que se concentre. Las experiencias históricas de clubes de trueque en Argentina, LETS en Europa y redes de moneda social en América Latina demuestran que el crédito mutuo sin interés fomenta el intercambio equitativo.',
            badge: 'Sin interés',
          },
        ],
      },
      {
        type: 'trueque_explainer',
        title: 'Los 4 Pasos del Crédito Mutuo para Miembros',
        subtitle: 'Comprende la lógica solidaria y transparente del sistema de trueque.',
        energy_rate_text: 'Valor de referencia objetivo: 1 TQ = 1 kWh de energía',
        steps: [
          {
            step: 1,
            title: 'Empiezas en Cero (0 TQ)',
            description:
              'Al ingresar formalmente a la red, tu cuenta inicia en balance 0. No necesitas comprar monedas, pagar inscripción ni aportar capital. Tampoco necesitas tener nada ahorrado para empezar a recibir beneficios.',
            icon: 'users',
          },
          {
            step: 2,
            title: 'Al Recibir Bienes en Trueque',
            description:
              'Tu cuenta registra saldo negativo (-TQ). No es una deuda financiera: es un compromiso ético de entregar productos o trabajo futuro a la comunidad. Puedes recibir alimentos, medicinas naturales, servicios o artesanías sin tener saldo positivo previo.',
            icon: 'shopping-cart',
          },
          {
            step: 3,
            title: 'Al Aportar Cosecha o Trabajo',
            description:
              'Tu cuenta registra saldo positivo (+TQ). Significa que has entregado valor a la comunidad y puedes adquirir bienes de otros miembros. Cada vez que aportas, tu saldo sube; cada vez que recibes, baja.',
            icon: 'leaf',
          },
          {
            step: 4,
            title: 'La Suma Total Siempre es Cero',
            description:
              'El total de todas las cuentas de la red da exactamente 0 TQ. No existe inflación, devaluación ni intermediarios bancarios. Nadie "emite" moneda: cada intercambio crea un saldo positivo y uno negativo equivalente. Es un registro contable puro de compromisos y aportes.',
            icon: 'scale',
          },
        ],
        key_points: {
          positive_balance:
            'Indica que has aportado más de lo que has recibido. Tienes derecho a recibir bienes o labores equivalentes de otros miembros en el futuro.',
          negative_balance:
            'Es un compromiso adquirido: has recibido sustento de la comunidad y lo retribuirás con tu propia cosecha, productos o trabajo. No hay vergüenza en tener saldo negativo: es la prueba de que el sistema funciona, de que alguien recibió lo que necesitaba.',
          zero_sum:
            'No es dinero bancario ni financiero: es un registro contable de compromisos adquiridos y aportes recíprocos. Permite el trueque diferido y multilateral: aportas trabajo o cosecha hoy, queda registrado su costo objetivo en energía (kWh), y en el futuro recibes esa misma energía cuando la necesites.',
        },
      },
      {
        type: 'features_grid',
        title: 'Límites y Confianza Progresiva',
        subtitle: 'El sistema crece contigo: entre más participas, más confianza acumulas',
        columns: 3,
        items: [
          {
            icon: 'users',
            title: 'Personas Naturales',
            description:
              'Cada persona natural que ingresa recibe un límite inicial de saldo negativo (por ejemplo, -50 TQ) y un límite positivo equivalente. Esto significa que puedes recibir hasta 50 TQ en bienes y servicios sin haber aportado nada todavía. Es la confianza inicial que la comunidad te otorga para que empieces a participar.',
            badge: 'Límite inicial',
          },
          {
            icon: 'building',
            title: 'Organizaciones y Colectivos',
            description:
              'Las organizaciones, cooperativas y colectivos registrados tienen límites más amplios porque su volumen de intercambio es mayor. Una organización puede tener un límite de -200 TQ o más, según su tamaño y trayectoria. Esto permite que las organizaciones puedan recibir insumos y herramientas a crédito y retribuir con su producción colectiva.',
            badge: 'Límite ampliado',
          },
          {
            icon: 'trending-up',
            title: 'Tu límite sube con el tiempo',
            description:
              'A medida que participas activamente, aportas regularmente y cumples tus compromisos, la asamblea puede aumentar tu límite. La confianza se construye con hechos, no con dinero. Un miembro con un año de participación activa y buen cumplimiento puede tener un límite 3 o 4 veces mayor que al ingresar.',
            badge: 'Crece contigo',
          },
          {
            icon: 'shield',
            title: 'Sin dinero para entrar',
            description:
              'No necesitas dinero para ingresar ni para recibir beneficios. No pagas inscripción, no compras "monedas", no necesitas tener ahorros. El sistema está diseñado para incluir a quienes no tienen acceso al dinero o al sistema bancario. Tu capacidad de recibir y aportar se basa en tu compromiso comunitario, no en tu capital.',
            badge: 'Sin barreras',
          },
          {
            icon: 'heart',
            title: 'Recibir sin tener',
            description:
              'Puedes recibir beneficios sin tener nada previo. Recibes alimentos, medicinas, servicios o herramientas y quedas en compromiso negativo. Ese compromiso lo saldas aportando tu trabajo, tu cosecha o tus productos cuando puedas. Es la esencia del trueque diferido: hoy recibes, mañana aportas.',
            badge: 'Recibir primero',
          },
          {
            icon: 'rotate-cw',
            title: 'Aportar para salir de deuda',
            description:
              'Cuando tu saldo es negativo, no hay cobradores ni intereses. Simplemente aportas lo que produces: cosecha, pan, artesanía, trabajo en la feria, talleres, cayapas. Cada aporte reduce tu saldo negativo hasta llegar a cero o volverse positivo. La comunidad te acompaña, no te presiona.',
            badge: 'Aportar y sanar',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Filosofía Agroecológica',
        subtitle: 'Más que una técnica de cultivo, una forma de habitar la Tierra',
        columns: 2,
        items: [
          {
            icon: 'leaf',
            title: 'Agroecología: ciencia, práctica y movimiento',
            description:
              'La agroecología no es solo una forma de cultivar sin agrotóxicos. Es una ciencia que aplica principios ecológicos a la agricultura, una práctica productiva que respeta los ciclos naturales, y un movimiento social que defiende la soberanía alimentaria, la justicia social y los derechos de los pueblos. La FAO la reconoce como método capaz de transformar los sistemas alimentarios hacia la sostenibilidad.',
            badge: 'Ciencia viva',
          },
          {
            icon: 'sprout',
            title: 'Producción natural vs. sintética',
            description:
              'La agricultura industrial se basa en fertilizantes químicos, plaguicidas, semillas modificadas genéticamente, alta mecanización y consumo de combustibles fósiles. Contamina suelo, agua y aire; reduce la biodiversidad; y excluye a los pequeños productores que no pueden pagar los costosos insumos. La agroecología, en cambio, recicla nutrientes, fija nitrógeno biológicamente, controla plagas con biodiversidad asociada y produce alimentos seguros y de mayor calidad nutricional.',
            badge: 'Natural',
          },
          {
            icon: 'users',
            title: 'Sin explotación de personas',
            description:
              'La agroecología promueve el respeto de los derechos laborales, la igualdad de género, el intercambio justo entre productores y consumidores, y la valoración de los conocimientos tradicionales. Ningún alimento agroecológico debe provenir de explotación humana. La producción se basa en relaciones justas, no en el lucro a costa del trabajo ajeno.',
            badge: 'Justicia',
          },
          {
            icon: 'heart',
            title: 'Soberanía alimentaria',
            description:
              'La soberanía alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios: qué sembrar, cómo sembrar, para quién producir y cómo distribuir. No es solo seguridad alimentaria (tener qué comer), es autonomía: que la comunidad controle su alimentación, no las corporaciones transnacionales que monopolizan las semillas y los agroquímicos.',
            badge: 'Autonomía',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Semillas: Patrimonio de los Pueblos',
        subtitle: 'Conservar nuestras semillas criollas y nativas es conservar nuestra libertad',
        columns: 2,
        items: [
          {
            icon: 'sprout',
            title: 'Semillas criollas y nativas',
            description:
              'Desde épocas ancestrales, las poblaciones humanas —y en especial las mujeres— dieron origen a la agricultura domesticando, mejorando y adaptando una gran diversidad de cultivos. Las civilizaciones de América Latina desarrollaron innumerables variedades nativas de maíz, frijol, papa, yuca, tomate, frutales y otros cultivos que aún hoy sustentan la alimentación global. Estas semillas son patrimonio colectivo de los pueblos y han circulado libremente entre la población rural, garantizando autonomía frente a las crisis.',
            badge: 'Patrimonio',
          },
          {
            icon: 'shield',
            title: 'Libres de transgénicos',
            description:
              'Las semillas transgénicas son modificadas genéticamente en laboratorios y patentadas por corporaciones. Su uso obliga a los agricultores a comprar semillas nuevas cada temporada, crea dependencia económica, contamina las variedades nativas por polinización cruzada y reduce la biodiversidad. En la feria promovemos territorios libres de transgénicos: nuestras semillas criollas son libres, reproducibles y adaptadas a nuestro clima.',
            badge: 'Sin transgénicos',
          },
          {
            icon: 'leaf',
            title: 'Semillas no procesadas',
            description:
              'Las semillas que intercambiamos no son procesadas, tratadas con fungicidas industriales ni recubiertas con químicos. Son semillas vivas, recién cosechadas, que conservan su vitalidad natural. Cada semilla que intercambias en la feria puede ser sembrada, reproducida y compartida nuevamente. Es un ciclo de vida que no se puede comprar en una tienda.',
            badge: 'Vivas',
          },
          {
            icon: 'rotate-cw',
            title: 'Trueque libre de semillas',
            description:
              'En cada encuentro mensual abrimos un espacio de trueque libre de semillas criollas y nativas entre agricultores y vecinos. Traes tus semillas, llevas las de otros. No hay dinero de por medio. Es la forma más antigua de garantizar que la diversidad agrícola se mantenga viva: cada semilla que viaja de una mano a otra es un acto de soberanía.',
            badge: 'Intercambio',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'El Sueño de la Ecoaldea',
        subtitle: 'Comunidades intencionales que concretizan el Buen Vivir',
        columns: 2,
        items: [
          {
            icon: 'home',
            title: '¿Qué es una ecoaldea?',
            description:
              'Una ecoaldea es un asentamiento humano a escala humana, diseñado conscientemente mediante procesos participativos para asegurar la sostenibilidad a largo plazo. Integran las cuatro dimensiones de la sostenibilidad: ecológica, económica, social y cultural. Pueden ser rurales o urbanas, intencionales o tradicionales. La Red Global de Ecoaldeas (GEN), fundada en 1995, conecta comunidades en África, Europa, América, Asia y Oceanía que regeneran sus entornos sociales y naturales.',
            badge: 'Comunidad',
          },
          {
            icon: 'leaf',
            title: 'Más que una utopía',
            description:
              'Las ecoaldeas no son utopías aisladas: son modelos funcionales de lo que significa vivir en armonía con la naturaleza de forma sostenible y espiritualmente satisfactoria. En casi todos los casos, son construidas por personas con pocos recursos personales pero con alto grado de idealismo y dedicación. El mundo necesita buenos ejemplos de convivencia regenerativa, y las ecoaldeas son laboratorios vivos de la sociedad futura.',
            badge: 'Modelo real',
          },
          {
            icon: 'globe',
            title: 'Un movimiento global',
            description:
              'Desde la Cumbre de la Tierra de Río en 1992, las ecoaldeas se han expandido como respuesta local a problemas globales urgentes. Hay ecoaldeas en Filipinas, granjas de permacultura en Senegal, proyectos de cohousing urbano en Berlín, comunidades tradicionales en los Andes donde los ancianos transmiten la sabiduría de la tierra. La Feria Conuquera comparte principios con este movimiento: soberanía alimentaria, energía limpia, gobernanza comunitaria y economía solidaria.',
            badge: 'Global',
          },
          {
            icon: 'sparkles',
            title: 'Nuestro Campo Soberano',
            description:
              'Soñamos con estructurar una comunidad intencional agroecológica de ciclo cerrado: permacultura, propiedad colectiva indivisible, energía solar y eólica off-grid, biodigestores, gobernanza sociocrática y economía de crédito mutuo. No es escapar del mundo: es crear el mundo que queremos ver. Conocer más sobre este proyecto en la sección Campo Soberano.',
            badge: 'Nuestro sueño',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Movimientos Hermanos en el Mundo',
        subtitle: 'No estamos solos: la agroecología y el trueque son movimientos planetarios',
        columns: 3,
        items: [
          {
            icon: 'globe',
            title: 'Red Global de Ecoaldeas (GEN)',
            description:
              'Fundada en 1995, conecta ecoaldeas en todos los continentes. Promueve el intercambio de conocimientos, soluciones y mejores prácticas entre comunidades regenerativas. Su lema: "El mundo necesita más ecoaldeas".',
            badge: 'GEN',
          },
          {
            icon: 'scale',
            title: 'Sistemas LETS',
            description:
              'Los Local Exchange Trading Systems (LETS) nacieron en Canadá en 1983 y se expandieron por Europa y Oceanía. Son sistemas de crédito mutuo donde los miembros intercambian bienes y servicios sin dinero, usando una unidad de cuenta interna. Todas las cuentas empiezan en cero y la suma total siempre es cero. Inspiraron nuestro sistema TQ.',
            badge: 'LETS',
          },
          {
            icon: 'users',
            title: 'Club del Trueque (Argentina)',
            description:
              'En Argentina, las redes de trueque surgieron en los años 90 como respuesta a la crisis económica. Llegaron a tener millones de participantes que intercambiaban bienes y servicios con "créditos" sin usar dinero oficial. Demostraron que el crédito mutuo es una herramienta poderosa de inclusión para quienes el sistema financiero excluye.',
            badge: 'Argentina',
          },
          {
            icon: 'sprout',
            title: 'Red de Semillas Libres',
            description:
              'Movimientos como la Red de Semillas Libres de Colombia y la Red Guardianes de Semillas de Vida defienden las semillas nativas y criollas frente al avance corporativo. Promueven territorios libres de transgénicos y la soberanía alimentaria como derecho inalienable de los pueblos.',
            badge: 'Semillas libres',
          },
          {
            icon: 'leaf',
            title: 'Vía Campesina',
            description:
              'La Vía Campesina es el movimiento internacional de campesinos, pueblos indígenas y trabajadores agrícolas más grande del mundo, presente en más de 80 países. Defiende la agricultura campesina y la agroecología como alternativa al modelo agroindustrial. Acuñó el concepto de soberanía alimentaria.',
            badge: 'Vía Campesina',
          },
          {
            icon: 'heart',
            title: 'Slow Food',
            description:
              'Movimiento global nacido en Italia en 1986 que promueve alimentos "buenos, limpios y justos": buenos para quien los come, limpios para el planeta, justos para quien los produce. Defiende la biodiversidad alimentaria y las tradiciones culinarias locales frente a la homogeneización de la comida rápida.',
            badge: 'Slow Food',
          },
        ],
      },
      {
        type: 'calculator_preview',
        title: 'Simula el Valor Energético de tu Producción',
        subtitle: 'Prueba cómo se calcula el valor objetivo según horas de trabajo y factores de esfuerzo.',
      },
    ],
  },
  {
    slug: 'campo-soberano',
    title: 'Campo Soberano',
    subtitle: 'Comunidad Agroecológica Autónoma y Regenerativa',
    icon: 'leaf',
    menu_order: 6,
    blocks: [
      {
        type: 'hero',
        badge: '🏡 Proyecto de Ecoaldea de Ciclo Cerrado',
        title: 'Proyecto Campo Soberano',
        subtitle: 'Hábitat colectivo rural con soberanía alimentaria, energética, digital y financiera.',
        description:
          'Estructuración de una comunidad intencional agroecológica diseñada bajo principios de permacultura, propiedad colectiva indivisible, energía solar/eólica off-grid y economía de crédito mutuo libre de acumulación.',
        image_url:
          'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80',
        style: 'split',
      },
      {
        type: 'features_grid',
        title: 'Infraestructura de Ciclos Cerrados',
        subtitle: 'Cada desecho se transforma en un insumo biológico o energético.',
        columns: 3,
        items: [
          {
            icon: 'leaf',
            title: 'Biodigestores Continuos',
            description:
              'Estiércol animal y restos orgánicos transformados en biogás metano para cocinas y biol fertilizante líquido.',
            badge: 'Biogás & Biol',
          },
          {
            icon: 'zap',
            title: 'Microrred Híbrida Aislada',
            description:
              'Generación solar fotovoltaica con respaldo eólico e hidráulico para autonomía energética 100% desconectada.',
            badge: 'Energía Limpia',
          },
          {
            icon: 'heart',
            title: 'Diseño Keyline y Aguas',
            description:
              'Zanjas de infiltración en curvas de nivel, reservorios de tierra y sanitarios secos con compostaje termófilo.',
            badge: 'Cosecha de Agua',
          },
          {
            icon: 'users',
            title: 'Soberanía Digital Mesh',
            description:
              'Red inalámbrica comunitaria con servidores locales para mensajería Matrix, enciclopedias Kiwix y educación offline.',
            badge: 'Red Mesh',
          },
          {
            icon: 'scale',
            title: 'Gobernanza Sociocrática',
            description:
              'Toma de decisiones por círculos temáticos y consentimiento fundamentado, con fideicomiso de tierra comunitaria.',
            badge: 'Sociocracia 3.0',
          },
          {
            icon: 'shopping-cart',
            title: 'Zonificación Permacultural',
            description:
              'Organización de zonas 0 a 5: núcleo habitacional bioclimático, huerto intensivo, animales menores, granos y reserva silvestre.',
            badge: 'Permacultura',
          },
        ],
      },
    ],
  },
  {
    slug: 'faq',
    title: 'Preguntas Frecuentes',
    subtitle: 'Dudas sobre Compras en Moneda Local, Trueque y Asambleas',
    icon: 'help-circle',
    menu_order: 7,
    blocks: [
      {
        type: 'hero',
        badge: '💡 Centro de Respuestas',
        title: 'Preguntas Frecuentes',
        subtitle: 'Información clara sobre cómo comprar, participar, truequear y sumarte a la feria.',
        image_url:
          'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
        style: 'standard',
      },
      {
        type: 'faq',
        title: 'Preguntas Frecuentes de Visitantes y Productores',
        items: [
          {
            question: '¿Necesito ser miembro de la feria para comprar productos?',
            answer:
              '¡No! El evento del primer sábado de cada mes en Parque Los Caobos es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local.',
          },
          {
            question: '¿Quiénes pueden participar en los intercambios de trueque?',
            answer:
              'El trueque directo y el sistema de crédito mutuo (Trueque TQ) está disponible para los miembros y colectivos registrados en la red. Si deseas participar formalmente en los intercambios de crédito mutuo o traer tu propia producción a la feria, puedes llenar la solicitud de admisión para ser evaluado por la asamblea.',
          },
          {
            question: '¿Cómo se organiza la Feria Conuquera más allá del día de mercado?',
            answer:
              'La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos fuera de Caracas.',
          },
          {
            question: '¿Cuándo y en qué horario se realiza el mercado mensual?',
            answer:
              'Se realiza el primer sábado de cada mes en el Parque Los Caobos de Caracas (área sur, cerca del estacionamiento y la Fuente Venezuela), desde las 9:00 AM hasta la 1:00 PM aproximadamente.',
          },
          {
            question: '¿Cómo llegar en transporte público?',
            answer:
              'Puedes llegar cómodamente en Metro de Caracas bajándote en la estación Bellas Artes o Colegio de Ingenieros (Línea 1). Desde ambas estaciones caminas unos 5 minutos hacia el Parque Los Caobos.',
          },
          {
            question: '¿Por qué está prohibido el uso de bolsas plásticas desechables?',
            answer:
              'Porque la agroecología es un compromiso ético de cuidado hacia la Madre Tierra. El plástico contamina suelos y ríos. Te invitamos a traer bolsas reutilizables de tela, morrales, recipientes o canastas.',
          },
          {
            question: '¿Qué actividades culturales y formativas se realizan durante la feria?',
            answer:
              'En cada jornada mensual se ofrecen talleres gratuitos de siembra y lombricultura, trueque libre de semillas criollas, intercambio de libros ("Dona y adopta un libro"), música popular en vivo y actividades lúdicas para niños y familias.',
          },
        ],
      },
    ],
  },
  {
    slug: 'contacto',
    title: 'Contacto y Ubicación',
    subtitle: 'Canales de Comunicación y Cómo Llegar a Los Caobos',
    icon: 'mail',
    menu_order: 8,
    blocks: [
      {
        type: 'contact_location',
        title: 'Visítanos en Parque Los Caobos',
        subtitle: 'Abierto al público general cada primer sábado de mes.',
        address: 'Parque Los Caobos, área del estacionamiento sur, cerca de la Fuente Venezuela, Caracas, Distrito Capital, Venezuela.',
        schedule: 'Primer sábado de cada mes, de 9:00 AM a 1:00 PM (Venta en moneda local y actividades abiertas)',
        instagram: 'feriaconuquera',
        facebook: 'feriaconuquera',
        email: 'contacto@feriaconuquera.org',
        phone: '+58 212 000-0000',
        transport_info: 'Estaciones de Metro Bellas Artes o Colegio de Ingenieros (Línea 1). Acceso peatonal y vehicular por Plaza Venezuela o Av. México.',
      },
      {
        type: 'cta_banner',
        badge: '📩 Postulación Comunitaria',
        title: '¿Deseas postularte como productor conuquero o miembro?',
        subtitle: 'Llena nuestro formulario público de postulación para ser evaluado por la asamblea trimestral.',
        button_text: 'Ir al Formulario de Admisión',
        button_link: '/p/unirse',
        theme: 'forest',
      },
    ],
  },
]
