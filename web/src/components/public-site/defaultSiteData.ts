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
        badge: '🌱 Mercado a Cielo Abierto',
        title: 'Nuestra Comunidad',
        subtitle: 'Cosecha fresca, alimentos sanos y saberes campesinos para toda la comunidad.',
        description:
          'Abrimos nuestro mercado a cielo abierto para todo el público general en moneda local. Un espacio autogestionado donde compras directo al productor sin intermediarios ni agrotóxicos, y donde los miembros de la red además intercambian en trueque y crédito mutuo.',
        image_url:
          '/placeholder.svg',
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
        title: 'Encuentro Mensual',
        date_text: '',
        time_text: '',
        location_name: '',
        address: '',
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
        title: 'Construyendo Soberanía Popular',
        subtitle: 'Cifras reales de un movimiento autónomo y comunitario.',
        bg_theme: 'primary',
        items: [
          {
            value: '',
            label: 'De Encuentro Continuo',
            description: 'Mercado mensual desde nuestros inicios',
          },
          {
            value: '+45 Colectivos',
            label: 'Familias Productoras',
            description: 'Diversas comunidades productoras',
          },
          {
            value: '0% Agrotóxicos',
            label: 'Producción 100% Limpia',
            description: 'Suelos vivos, abonos orgánicos y semillas ancestrales',
          },
          {
            value: 'Venta Libre',
            label: 'Moneda Local & Trueque',
            description: 'Abierto a toda la comunidad con opción de trueque para miembros',
          },
        ],
      },
      {
        type: 'carousel',
        title: 'Galería Viva de Nuestras Jornadas',
        subtitle: 'Postales de las jornadas de mercado, talleres, cultura y trueque en cada encuentro.',
        autoplay: true,
        items: [
          {
            image_url:
              '/placeholder.svg',
            title: 'Hortalizas Frescas y Rubros Ancestrales',
            caption: 'Cosechadas en la madrugada para venta directa en moneda local.',
            tag: 'Cosecha del Día',
          },
          {
            image_url:
              '/placeholder.svg',
            title: 'Botica Comunitaria y Medicina Tradicional',
            caption: 'Tinturas de propóleo, pomadas botánicas, aceites esenciales y plantas medicinales.',
            tag: 'Salud Botánica',
          },
          {
            image_url:
              '/placeholder.svg',
            title: 'Gastronomía Artesanal y Ancestral',
            caption: 'La tradicional Cafunga, harinas sin gluten, cacao puro y café de montaña.',
            tag: 'Sabores Soberanos',
          },
          {
            image_url:
              '/placeholder.svg',
            title: 'Talleres en Vivo & Trueque de Semillas',
            caption: 'Intercambio solidario de saberes, semillas nativas y libros para toda la comunidad.',
            tag: 'Formación Popular',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Dinámica y Organización de la Red',
        subtitle: 'Cómo funciona nuestra comunidad tanto en el mercado mensual como en su vida interna.',
        columns: 3,
        items: [
          {
            icon: 'shopping-cart',
            title: 'Mercado Mensual a Cielo Abierto',
            description:
              'Venta directa al público general en moneda local en cada encuentro mensual. Sin intermediarios ni usura.',
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
              'Encuentros de gobernanza cada 3 meses donde los miembros deciden sobre admisiones, impuestos, distribución de fondos y políticas. Convocatoria automática con notificaciones a todos los miembros.',
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
      {
        type: 'cta_banner',
        badge: '🖥️ Prueba el Sistema',
        title: '¿Quieres ver cómo funciona un nodo por dentro?',
        subtitle:
          'Inicia un nodo demo y explora la plataforma completa: catálogo, calculadora, asambleas, gobernanza, tarjetas NFC y más. Sin registro, sin compromiso.',
        button_text: 'Ir al Nodo de Prueba',
        button_link: '/p/federacion',
        secondary_text: 'Ver Página de Federación',
        secondary_link: '/p/federacion',
        theme: 'primary',
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
        badge: '📜 Nuestra Historia',
        title: 'Un Movimiento al Calor de la Semilla Libre',
        subtitle: 'El conuco como horizonte histórico, político y espiritual de soberanía integral.',
        description:
          'Nacimos en un momento crucial, al calor de los debates populares para la construcción de soberanía alimentaria. La feria es tanto un mercado mensual como una organización viva con asambleas y comisiones activas.',
        image_url:
          '/placeholder.svg',
        style: 'split',
      },
      {
        type: 'split_story',
        badge: '�️ Estructura y Organización',
        title: 'Vida Organizativa Más Allá del Mercado',
        subtitle: 'Asambleas trimestrales, organizaciones, departamentos y trabajo colectivo',
        content:
          'Nuestra comunidad no es solo el evento de venta mensual. Contamos con una estructura organizativa sólida y horizontal:\n\n• **Asamblea General Trimestral:** Cada 3 meses, todos los miembros plenos se reúnen en asamblea formal para evaluar el funcionamiento, admitir nuevos miembros, decidir sobre impuestos, tarifas y políticas colectivas. La asamblea se convoca automáticamente con 7 días de anticipación mínima.\n• **Organizaciones:** Los miembros pueden crear organizaciones (cooperativas, colectivos, proyectos). Cada organización puede tener su propia junta directiva y asamblea interna para decidir sobre sus fondos y políticas.\n• **Departamentos:** Las organizaciones y la asamblea pueden crear departamentos (áreas de trabajo como Producción, Distribución, Pagos). Cada departamento puede tener su propia asamblea o funcionar con un responsable único.\n• **Comisiones de Trabajo:** Se conforman comisiones periódicas para la logística, comunicación, bioinsumos, cultura y articulación comunitaria.\n• **Cayapas de Campo:** Organizamos jornadas de trabajo voluntario y formativo en los conucos y unidades productivas de diversas comunidades productoras.',
        image_url:
          '/placeholder.svg',
        image_position: 'left',
        highlights: [
          'Mercado mensual a cielo abierto con venta al público en moneda local.',
          'Asamblea general cada 3 meses con convocatoria automática y notificaciones.',
          'Organizaciones con junta directiva y asambleas internas opcionales.',
          'Departamentos pertenecen a organizaciones o a la asamblea, nunca aislados.',
          'Talleres y actividades pedagógicas permanentes de campesino a campesino.',
          'Comisiones de trabajo voluntario para el cuidado colectivo.',
        ],
        quote: {
          text: 'El conuco es la escuela donde la tierra nos enseña que la abundancia nace de la diversidad y la organización comunitaria.',
          author: 'Vocería Colectiva',
        },
      },
      {
        type: 'timeline_history',
        badge: 'Hitos',
        title: 'Nuestra Línea de Tiempo',
        subtitle: 'Más de una década de siembra, trueque y organización popular.',
        items: [
          {
            year: '',
            title: 'Nacimiento de Nuestra Comunidad',
            description: 'Primer mercado articulando a productores urbanos y rurales en resistencia económica.',
            badge: 'Fundación',
          },
          {
            year: '',
            title: 'Aprobación de la Ley de Semillas',
            description: 'Victoria popular protegiendo las semillas nativas y prohibiendo transgénicos y patentes agrícolas.',
            badge: 'Ley Popular',
          },
          {
            year: '',
            title: 'Consolidación de Asambleas y Talleres',
            description: 'Encuentros trimestrales continuos, formación en bioinsumos y articulación con escuelas y organopónicos.',
            badge: 'Crecimiento',
          },
          {
            year: '',
            title: 'Encuentro Ininterrumpido',
            description: 'Celebración de una década e integración de sistemas digitales de trueque y crédito mutuo.',
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
            project: '',
            quote:
              'Sembrar nos ha permitido alimentar a nuestra comunidad con dignidad, amor a la tierra y precios justos para nuestro pueblo.',
            location: '',
          },
          {
            name: 'Alfivegetales Km 38',
            role: 'Familia Miranda',
            project: '',
            quote:
              'Llevamos 10 años trayendo acelgas, col rizada, queso de cabra y tubérculos 100% agroecológicos para venta directa en moneda local a toda la ciudad.',
            location: '',
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
          'No necesitas ser miembro de la feria para comprar. Ven a nuestra feria y encuentra hortalizas recién cosechadas, tubérculos ancestrales, quesos artesanales, botica comunitaria, cosmética natural y delicias tradicionales a precios solidarios.',
        image_url:
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'products_showcase',
        source: 'backend',
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
            name: 'Hortalizas y Hojas Verdes',
            category: 'Cosecha Fresca',
            description:
              'Col rizada (kale portuguesa), acelgas, lechugas variadas, cebollín, cilantro de monte y apio España cosechados en la mañana.',
            badge: 'Fresco del Día',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Tubérculos Ancestrales y Plátanos',
            category: 'Cosecha Fresca',
            description:
              'Ñame morado criollo, ocumo blanco y morado, yuca dulce, auyama madura y cambur morado.',
            badge: 'Rubro Olvidado',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Tinturas Madres y Botica Comunitaria',
            category: 'Medicina Botánica & Cosmética',
            description:
              'Extractos de propóleo puro, tinturas de moringa, cúrcuma, jengibre, pomadas desinflamatorias de árnica y jarabes naturales.',
            badge: '100% Puro',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Cosmética Natural sin Químicos',
            category: 'Medicina Botánica & Cosmética',
            description:
              'Desodorantes ecológicos de aceite de coco y bicarbonato, bálsamos labiales de cera de abeja, jabones artesanales y toallas reutilizables.',
            badge: 'Residuo Cero',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'La Tradicional Cafunga',
            category: 'Gastronomía Artesanal',
            description:
              'Dulce patrimonial tradicional elaborado a base de plátano maduro, coco rallado, papelón y anís dulce, horneado en hoja de plátano.',
            badge: 'Plato Estrella',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Quesos Artesanales de Búfala y Cabra',
            category: 'Gastronomía Artesanal',
            description:
              'Quesos madurados y frescos, dulce de leche de cabra, yogurt natural y mantequilla de pequeños rebaños pastoreados.',
            badge: 'Pastoreo Libre',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Cacao Puro, Chocolates y Café de Montaña',
            category: 'Gastronomía Artesanal',
            description:
              'Barras de chocolate bean-to-bar 70% cacao, licor de cacao artesanal y café lavado tostado a leña.',
            badge: 'Origen Venezolano',
            image_url:
              '/placeholder.svg',
          },
          {
            name: 'Plántulas Medicinales y Semillas Criollas',
            category: 'Semillas & Plántulas',
            description:
              'Plantas en maceta de poleo, estevia, malojillo, romero, ruda, orégano orejón y sobres de semillas adaptadas al clima local.',
            badge: 'Para tu Huerto',
            image_url:
              '/placeholder.svg',
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
          'Inspirados en la metodología "de campesino a campesino", cada jornada cuenta con actividades pedagógicas gratuitas para compartir conocimientos de siembra, lombricultura, salud botánica y fermentos.',
        image_url:
          '/placeholder.svg',
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
            title: 'Aula Comunitaria Abierta',
            description:
              'Talleres prácticos en vivo: sustratos con fibra de coco, biofertilizantes, kokedamas, medicina tradicional y bioinsumos.',
            badge: 'Talleres Gratis',
          },
          {
            icon: 'shopping-cart',
            title: 'Música & Expresiones Culturales',
            description:
              'Música tradicional, ska popular, cantautores populares con cuatro y poesía campesina en vivo.',
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
          '/placeholder.svg',
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
              'Cada persona natural que ingresa recibe un limite simetrico de -500 TQ (saldo negativo) y +500 TQ (saldo positivo). Esto significa que puedes recibir hasta 500 TQ en bienes y servicios sin haber aportado nada todavia, lo que cubre aproximadamente una canasta basica familiar mensual. Los limites positivo y negativo son iguales para garantizar equidad: lo que puedes recibir equivale a lo que puedes aportar.',
            badge: 'Limite 500 TQ',
          },
          {
            icon: 'building',
            title: 'Organizaciones y Colectivos',
            description:
              'Las organizaciones, cooperativas y colectivos registrados tienen limites simetricos mas amplios porque su volumen de intercambio es mayor. Una organizacion de produccion tiene -5000/+5000 TQ; una de consumo -3000/+3000 TQ. Los limites siempre son simetricos: lo que puedes recibir equivale a lo que puedes aportar.',
            badge: 'Limite 3000-5000 TQ',
          },
          {
            icon: 'trending-up',
            title: 'Tu limite sube con el tiempo',
            description:
              'A medida que participas activamente, aportas regularmente y cumples tus compromisos, la asamblea puede aumentar tu limite. Un miembro activo pasa de -500/+500 a -1000/+1000 TQ. La confianza se construye con hechos, no con dinero. Los limites siempre se mantienen simetricos.',
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
              'Desde la Cumbre de la Tierra de Río en 1992, las ecoaldeas se han expandido como respuesta local a problemas globales urgentes. Hay ecoaldeas en Filipinas, granjas de permacultura en Senegal, proyectos de cohousing urbano en Berlín, comunidades tradicionales en los Andes donde los ancianos transmiten la sabiduría de la tierra. Nuestra comunidad comparte principios con este movimiento: soberanía alimentaria, energía limpia, gobernanza comunitaria y economía solidaria.',
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
        title: 'Otras Experiencias en el Mundo',
        subtitle: 'Referentes y movimientos que inspiran prácticas similares a las nuestras. No son aliados ni socios: son experiencias que compartimos y de las cuales aprendemos.',
        columns: 3,
        items: [
          {
            icon: 'globe',
            title: 'Red Global de Ecoaldeas (GEN)',
            description:
              'Fundada en 1995, conecta ecoaldeas en todos los continentes. Promueve el intercambio de conocimientos, soluciones y mejores prácticas entre comunidades regenerativas. Su lema: "El mundo necesita más ecoaldeas". Es la red más importante del movimiento global de ecoaldeas.',
            badge: 'GEN',
          },
          {
            icon: 'globe',
            title: 'CASA Latina',
            description:
              'El Consejo de Asentamientos Sustentables de América Latina es la rama de GEN para Latinoamérica. Agrupa redes nacionales de bioconstrucción, permacultura y ecoaldeas. Es el punto de partida para buscar proyectos hispanohablantes orientados al rescate de saberes indígenas y campesinos.',
            badge: 'CASA Latina',
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
        type: 'features_grid',
        title: 'Estándares Internacionales de Contabilidad Energética',
        subtitle: 'Nuestro sistema se basa en metodologías científicas reconocidas internacionalmente para medir el valor real de las cosas',
        columns: 2,
        items: [
          {
            icon: 'scale',
            title: 'ICE Database (University of Bath)',
            description:
              'El Inventory of Carbon and Energy (ICE) de la Universidad de Bath es la base de datos más usada mundialmente para calcular la energía incorporada (embodied energy) de los materiales. Proporciona factores en MJ/kg para cerámica, madera, textiles, vidrio, metales, plásticos y más. Nuestro catálogo usa estos factores directamente: arcilla 2.5 MJ/kg, madera blanda 0.3 MJ/kg, algodón 143 MJ/kg, vidrio 12.7 MJ/kg.',
            badge: 'ICE Database',
          },
          {
            icon: 'leaf',
            title: 'Ecoinvent (Suiza)',
            description:
              'Ecoinvent es una de las bases de datos de análisis de ciclo de vida (LCA) más completas del mundo. Contiene miles de procesos documentados con sus flujos de energía y materiales. Usamos datos de Ecoinvent para complementar el ICE Database cuando se necesita información sobre cultivos específicos, procesos industriales y transporte.',
            badge: 'Ecoinvent',
          },
          {
            icon: 'zap',
            title: 'Equivalencia: 1 TQ = 1 kWh = 3.6 MJ',
            description:
              'Un kilovatio-hora (kWh) equivale a 3.6 megajoules (MJ), la unidad estándar de energía del Sistema Internacional. Nuestra unidad TQ equivale a 1 kWh de energía. Así, un producto que requiere 36 MJ para fabricarse tiene un valor de 10 TQ. Esta equivalencia permite que cualquier producto tenga un valor objetivo, verificable y comparable.',
            badge: '1 TQ = 1 kWh',
          },
          {
            icon: 'users',
            title: 'Trabajo humano medido en kWh',
            description:
              'El trabajo humano se mide en horas, y cada hora de trabajo se valora en aproximadamente 0.1 kWh de energía metabólica (100 kcal/h ≈ 0.116 kWh). Sin embargo, en nuestro sistema usamos una convención práctica: 1 hora de trabajo = 1 TQ, independientemente del tipo de trabajo. Esto reconoce que todo trabajo humano merece el mismo valor base, con factores de esfuerzo adicionales para trabajo físico exigente.',
            badge: '1 h = 1 TQ',
          },
          {
            icon: 'trending-up',
            title: 'EROI: Retorno Energético de la Inversión',
            description:
              'El EROI (Energy Return on Investment) es un indicador que mide cuánta energía se obtiene por cada unidad de energía invertida. Un EROI alto significa que el proceso es eficiente energéticamente. La agricultura industrial tiene un EROI bajo (gasta mucha energía fósil por cada caloría producida), mientras que la agroecología tiene un EROI más alto. Nuestro sistema premia implícitamente los procesos energéticamente eficientes.',
            badge: 'EROI',
          },
          {
            icon: 'sparkles',
            title: 'Emergía de Howard Odum',
            description:
              'Howard T. Odum, ecólogo estadounidense, desarrolló el concepto de "emergía": la energía total disponible que se consumió para producir un bien o servicio, expresada en una unidad común. Su trabajo demostró que el valor real de las cosas está determinado por la energía solar incorporada, no por el precio de mercado. Nuestro sistema se inspira en esta visión: el valor es energía, no dinero.',
            badge: 'Emergía',
          },
          {
            icon: 'shield',
            title: 'Propuesta histórica de Ford y Edison',
            description:
              'En 1921, Henry Ford y Thomas Edison propusieron el "dólar energético": una moneda respaldada por energía en lugar de oro. Argumentaban que la energía es la base real de toda riqueza y que una moneda energética sería más estable y justa que el dinero fiat. Aunque nunca se implementó, la idea influyó en posteriores desarrollos de teoría económica energética. Nuestro sistema TQ recoge este espíritu.',
            badge: 'Ford-Edison',
          },
          {
            icon: 'globe',
            title: 'Agribalyse (Francia)',
            description:
              'Agribalyse es la base de datos francesa de análisis de ciclo de vida de productos agrícolas y alimentarios. Proporciona datos detallados sobre la energía incorporada en cultivos específicos, sistemas de producción y cadenas alimentarias. Usamos estos datos para los productos agrícolas del catálogo donde el ICE Database no tiene suficiente granularidad.',
            badge: 'Agribalyse',
          },
        ],
      },
      {
        type: 'richtext',
        title: 'Cómo se Calcula el Precio de un Producto',
        subtitle: 'La fórmula que usamos para asignar valor objetivo a cualquier bien o servicio',
        content: `
<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 16px 0;">
  <p style="font-size: 18px; font-weight: 700; color: #0f766e; margin-bottom: 12px;">Fórmula general:</p>
  <p style="font-size: 16px; font-family: monospace; background: white; padding: 12px; border-radius: 8px; color: #134e4a;">
    EE_total = E_directa + E_insumos + E_trabajo + E_transporte
  </p>
  <p style="font-size: 14px; color: #115e59; margin-top: 8px;">
    <strong>EE_total</strong> = Energía incorporada total (en MJ)<br>
    <strong>E_directa</strong> = Energía directa consumida (combustible, electricidad, cocción)<br>
    <strong>E_insumos</strong> = Energía de los materiales y materias primas (kg × factor MJ/kg)<br>
    <strong>E_trabajo</strong> = Energía humana (horas × 3.6 MJ/hora)<br>
    <strong>E_transporte</strong> = Energía de transporte (distancia × factor)
  </p>
  <p style="font-size: 14px; color: #0d9488; margin-top: 12px;">
    Precio en TQ = EE_total ÷ 3.6 (ya que 1 TQ = 1 kWh = 3.6 MJ)
  </p>
</div>

<h3 style="color: #0f766e; margin-top: 24px;">Ejemplo práctico: Pan artesanal (1 kg)</h3>

<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px;">
  <thead>
    <tr style="background: #ccfbf1; color: #134e4a;">
      <th style="padding: 8px; text-align: left; border: 1px solid #99f6e4;">Componente</th>
      <th style="padding: 8px; text-align: right; border: 1px solid #99f6e4;">Cantidad</th>
      <th style="padding: 8px; text-align: right; border: 1px solid #99f6e4;">Factor</th>
      <th style="padding: 8px; text-align: right; border: 1px solid #99f6e4;">Energía (MJ)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">Harina de trigo (insumo)</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.6 kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">18.0 MJ/kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">10.80</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">Agua (insumo)</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.35 L</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.01 MJ/L</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.00</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">Sal (insumo)</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.01 kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">7.0 MJ/kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">0.07</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">Leña para horno (directa)</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">1.5 kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">10.0 MJ/kg</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">15.00</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e2e8f0;">Trabajo del panadero</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">3 horas</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">3.6 MJ/h</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">10.80</td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">Amortización horno</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">—</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">—</td>
      <td style="padding: 8px; text-align: right; border: 1px solid #e2e8f0;">5.54</td>
    </tr>
    <tr style="background: #f0fdfa; font-weight: bold;">
      <td style="padding: 8px; border: 1px solid #99f6e4; color: #0f766e;">TOTAL</td>
      <td style="padding: 8px; border: 1px solid #99f6e4;"></td>
      <td style="padding: 8px; border: 1px solid #99f6e4;"></td>
      <td style="padding: 8px; text-align: right; border: 1px solid #99f6e4; color: #0f766e;">42.21 MJ</td>
    </tr>
  </tbody>
</table>

<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 16px; margin: 16px 0;">
  <p style="font-size: 16px; color: #0f766e; margin: 0;">
    <strong>Precio del pan de 1 kg:</strong> 42.21 MJ ÷ 3.6 = <strong>11.7 TQ</strong> → <strong>12 TQ</strong>
  </p>
</div>

<p style="font-size: 14px; color: #475569; margin-top: 16px;">
  <strong>Productos con energía similar:</strong> Cuando dos productos tienen valores de energía incorporada similares (por ejemplo, dentro de un rango de ±10%), pueden compartir un precio de referencia. Sin embargo, siguen siendo productos distintos en el catálogo: un pan integral y un pan blanco pueden tener precios cercanos, pero son productos separados con sus propias características.
</p>
`,
      },
      {
        type: 'features_grid',
        title: 'Materias Primas y Productos Compuestos',
        subtitle: 'Cómo funciona el sistema de precios en la práctica: materias primas por kg, trabajo por hora, y productos compuestos',
        columns: 2,
        items: [
          {
            icon: 'scale',
            title: 'Materias primas por kilogramo',
            description:
              'Las materias primas se venden por kg con un precio basado en su energía incorporada (ICE Database). Ejemplos: Arcilla para cerámica 1 TQ/kg (2.5 MJ/kg), Madera blanda 1 TQ/kg (0.3 MJ/kg), Tela de algodón 40 TQ/kg (143 MJ/kg), Lana 19 TQ/kg (67.5 MJ/kg). Una maceta pequeña de 0.5 kg y una grande de 5 kg tienen precios distintos porque consumen cantidades diferentes de material.',
            badge: 'Por kg',
          },
          {
            icon: 'clock',
            title: 'Trabajo artesanal por hora',
            description:
              'El trabajo se vende por hora con un precio de 1 TQ/hora. Tipos: Alfarería (modelado, esmaltado, control de horno), Carpintería (tallado, ensamblaje), Costura (confección, bordado), Cestería (tejido de fibra vegetal). La cocción de cerámica en horno se cobra por carga (5 TQ/carga, incluye leña o gas).',
            badge: 'Por hora',
          },
          {
            icon: 'layers',
            title: 'Productos compuestos: precio automático',
            description:
              'Cualquier miembro puede crear un producto compuesto en su tienda seleccionando materias primas, productos base y horas de trabajo del catálogo aprobado. El sistema calcula el precio automáticamente sumando todos los componentes. No necesita aprobación de asamblea porque usa materiales ya aprobados. Ejemplo: un jugo de naranja = naranja (0.3 kg) + envase de vidrio (1 unidad) + trabajo (0.5 h) = 4 TQ.',
            badge: 'Automático',
          },
          {
            icon: 'package',
            title: 'Productos terminados con peso definido',
            description:
              'Los productos terminados del catálogo tienen peso y dimensiones explícitas. Ejemplos: Taza de barro 0.3 kg = 2 TQ, Olla de barro 2 kg = 8 TQ, Silla de madera 8 kg = 11 TQ, Mesa de madera 20 kg = 23 TQ, Cama de madera 35 kg = 35 TQ. Una silla no vale lo mismo que una cama porque consumen cantidades diferentes de madera y horas de trabajo.',
            badge: 'Peso definido',
          },
          {
            icon: 'truck',
            title: 'Embalaje y envío como componentes',
            description:
              'Al crear un producto compuesto, puedes agregar embalaje (envase de vidrio 2 TQ, bolsa de tela 2 TQ, hoja de plátano 1 TQ) y envío (local 1 TQ, nodo vecino 5 TQ, nodo lejano 15 TQ, recogida en parcela 0 TQ). El precio final incluye todos estos costos de forma transparente.',
            badge: 'Embalaje + envío',
          },
          {
            icon: 'globe',
            title: 'Federación de productos entre nodos',
            description:
              'Cuando un nodo aprueba un producto por asamblea, se distribuye a los demás nodos federados. Cada nodo debe aprobarlo individualmente. Un producto no aprobado en un nodo no se puede usar para producir, comprar ni como componente. Los productos compuestos solo se pueden comprar en un nodo si todos sus componentes están aprobados en ese nodo.',
            badge: 'Federado',
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
          '/placeholder.svg',
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
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'faq',
        title: 'Para Visitantes y Compradores',
        items: [
          {
            question: '¿Necesito ser miembro de la feria para comprar productos?',
            answer:
              '¡No! Nuestro evento mensual es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local.',
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
          {
            question: '¿Puedo pagar con tarjeta de débito o crédito?',
            answer:
              'El comercio exterior (ventas al público general) se realiza en moneda local del país (pesos, bolívares, soles, etc.). Algunos puestos pueden aceptar transferencias o pagos digitales, pero le recomendamos traer efectivo. El trueque interno entre miembros funciona con la moneda TQ, pero eso es solo para miembros registrados.',
          },
          {
            question: '¿Puedo llevar mis propios productos para vender?',
            answer:
              'Para vender necesitas ser miembro registrado. Si eres productor agroecológico, artesano o tienes un emprendimiento compatible con los valores de la feria, puedes solicitar admisión. La asamblea evaluará tu solicitud y, si eres aceptado, recibirás un puesto y acceso al sistema de trueque.',
          },
          {
            question: '¿La feria es solo para productores agroecológicos?',
            answer:
              'No necesariamente. Aunque la agroecología es nuestro corazón, también hay lugar para artesanos, productores de alimentos procesados (panes, quesos, conservas), herbolaria, productos de higiene natural, y servicios comunitarios. Lo importante es que lo que ofrezcas sea coherente con los valores de cuidado de la tierra y el trueque.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre el Trueque y la Moneda TQ',
        items: [
          {
            question: '¿Qué es la moneda TQ?',
            answer:
              'TQ es la unidad de medida del trueque interno entre miembros. No es dinero físico ni se puede comprar ni vender por dinero. Es una unidad contable que mide cuánto aportas y cuánto recibes dentro de la comunidad. 1 TQ equivale a 1 kWh de energía, es decir, a una hora de trabajo humano. No tiene inflación porque no está atada al dólar ni al oro, sino a las leyes de la física.',
          },
          {
            question: '¿Por qué el saldo perfecto es cero?',
            answer:
              'El objetivo de todo miembro es que su saldo sea cero. Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si tu saldo está muy negativo, significa que estás recibiendo mucho pero aportando poco: tienes que aportar más para llegar a cero. Si tu saldo está muy positivo, significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece: tienes que recibir más para llegar a cero. El saldo cero es la meta de todos.',
          },
          {
            question: '¿Es preferible tener saldo positivo o negativo?',
            answer:
              'Técnicamente, si tu saldo está en positivo es porque alguien más está en negativo. Lo ideal es que todos tiendan a cero. Pero si vas a estar en un lado, es preferible estar ligeramente en positivo (aportando un poco más de lo que recibes) que en negativo (recibiendo más de lo que aportas). Un saldo muy negativo sostenido significa que la comunidad te está sosteniendo, y eso no es sostenible a largo plazo.',
          },
          {
            question: '¿Qué pasa si mi saldo se va muy negativo?',
            answer:
              'Si tu saldo baja demasiado, el sistema te avisa. Tienes que aportar más (vender productos, ofrecer trabajo, dar talleres) para subir tu saldo. Si no logras subirlo, la asamblea puede revisar tu caso. La idea no es castigar, sino ayudarte a encontrar equilibrio. Pero si una persona solo recibe y nunca aporta, la asamblea puede decidir que ya no puede seguir en el sistema.',
          },
          {
            question: '¿Por qué para entrar a la comunidad tengo que tener algo que aportar?',
            answer:
              'Porque el trueque funciona así: tú aportas algo que la comunidad necesita, y la comunidad te aporta algo que tú necesitas. Si entras sin nada que aportar, solo estarías recibiendo de los demás sin devolver nada. Eso desequilibra el sistema y no es justo para los demás miembros. Muchas monedas comunitarias fracasan precisamente porque entra mucha gente que solo quiere recibir y poca gente que aporta. Por eso, antes de entrar, tienes que preguntarte: ¿Qué tengo yo que la comunidad pueda necesitar? ¿Qué tiene la comunidad que yo pueda necesecer? Si ambas respuestas son positivas, vale la pena que te integres.',
          },
          {
            question: '¿Qué cosas puedo aportar?',
            answer:
              'Puedes aportar productos (frutas, verduras, huevos, panes, artesanías, conservas, medicina natural), servicios (reparaciones, transporte, clases, cuidado de niños, peluquería), trabajo (ayuda en conucos, construcción, limpieza, organización de eventos), o conocimientos (talleres, asesorías, mentorías). Todo lo que la comunidad valore puede ser un aporte. No tiene que ser solo cosas materiales: el tiempo y el talento también cuentan.',
          },
          {
            question: '¿Cómo sé si vale la pena integrarme a la comunidad?',
            answer:
              'Hazte estas preguntas antes de solicitar admisión: 1) ¿Tengo algo que aportar que la comunidad pueda necesitar? (productos, trabajo, talentos, servicios). 2) ¿Tiene la comunidad algo que yo necesite o me interese? (alimentos, trabajo, servicios, conexión con otras personas). 3) ¿Estoy dispuesto a participar activamente, no solo a recibir? Si las tres respuestas son sí, entonces vale la pena que te integres. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar.',
          },
          {
            question: '¿La moneda TQ tiene inflación?',
            answer:
              'No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años. Esto significa que lo que ahorras en TQ mantiene su valor real con el tiempo, a diferencia del dinero en el banco que pierde valor cada mes por la inflación.',
          },
          {
            question: '¿Puedo acumular TQ para hacerme "rico"?',
            answer:
              'El sistema no está diseñado para que nadie se haga rico acumulando números. El objetivo es el equilibrio: aportar y recibir en proporción similar. Acumular mucho TQ significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece. En lugar de acumular TQ, te invitamos a acumular riqueza real y tangible: tu vivienda, tu conuco, tus herramientas, tus semillas, tus relaciones comunitarias. Eso sí es riqueza de verdad.',
          },
          {
            question: '¿Qué son los límites de crédito?',
            answer:
              'Los límites de crédito son como escalones de confianza. Un miembro nuevo inicia con un límite bajo, equivalente a su canasta básica familiar, para proteger a la comunidad. A medida que participas, aportas y demuestras compromiso, la asamblea puede subir tu límite. No es un castigo ni una restricción: es una medida de protección para que nadie entre, reciba mucho y se vaya sin aportar.',
          },
          {
            question: '¿Las ventas al público se mezclan con el trueque?',
            answer:
              '¡No! Las ventas al público general son externas y se pagan en moneda local del país (pesos, bolívares, etc.). El trueque TQ es solo entre miembros registrados. Los compradores externos no tienen cuentas TQ ni participan del trueque. Esto es muy importante: no podemos mezclar las ventas al público con el trueque, porque son cosas distintas con reglas distintas.',
          },
          {
            question: '¿Qué pasa si quiero salir de la comunidad?',
            answer:
              'Puedes salir cuando quieras. Lo ideal es que antes de salir, tu saldo esté en cero o cercano a cero. Si tu saldo está muy negativo (recibiste más de lo que aportaste), la asamblea puede pedirte que aportes algo antes de irte para equilibrar tu cuenta. Si tu saldo está positivo, simplemente pierdes ese saldo al salir, ya que el TQ no tiene valor fuera de la comunidad.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Para Quienes Quieren Unirse',
        items: [
          {
            question: '¿Quiénes pueden solicitar admisión?',
            answer:
              'Cualquier persona, familia, cooperativa o colectivo que tenga algo que aportar a la comunidad y que esté dispuesto a participar activamente. Esto incluye productores agroecológicos, artesanos, personas con oficios (carpintería, costura, reparaciones), profesionales que quieran ofrecer servicios, y personas dispuestas a aportar su trabajo y talento.',
          },
          {
            question: '¿Cómo sé si soy apto para integrarme?',
            answer:
              'La métrica inicial es simple: ¿Tienes algo que aportar que la comunidad necesite? ¿Tiene la comunidad algo que tú necesites? Si ambas respuestas son positivas, eres un buen candidato. Si solo quieres recibir pero no tienes nada que aportar, el sistema no te va a funcionar. El trueque requiere que ambos lados ganen: tú aportas algo y recibes algo a cambio.',
          },
          {
            question: '¿Qué evalúa la asamblea antes de aceptar a alguien?',
            answer:
              'La asamblea evalúa: 1) ¿Qué aporta esta persona a la comunidad? (productos, trabajo, talentos, servicios). 2) ¿Hay interés en la comunidad por lo que esta persona aporta? 3) ¿Hay cosas en la comunidad que esta persona pueda necesecer o recibir? 4) ¿Esta persona entiende y comparte los valores del trueque y la agroecología? 5) ¿Está dispuesta a participar activamente en asambleas y actividades?',
          },
          {
            question: '¿Necesito tener tierra o un conuco para entrar?',
            answer:
              'No necesariamente. Hay miembros que son productores con tierra, pero también hay artesanos, panaderos, herbolarios, personas que ofrecen servicios, y personas que aportan su trabajo en los conucos de otros. Lo importante no es qué tienes, sino qué puedes aportar con lo que tienes.',
          },
          {
            question: '¿Puedo entrar si solo quiero consumir productos sanos?',
            answer:
              'Si solo quieres consumir, puedes venir a la feria como visitante y comprar en moneda local. Para ser miembro del trueque interno, necesitas aportar algo. No puedes solo recibir. Si quieres ser miembro pero no tienes productos, puedes aportar trabajo: ayudar en la organización, en los conucos, en la logística, dar talleres, etc.',
          },
          {
            question: '¿Cuánto tiempo toma el proceso de admisión?',
            answer:
              'Depende de cada comunidad. Generalmente: llenas la solicitud, la asamblea la revisa en su próxima reunión, te invitan a una entrevista o visita, y luego votan. Puede tomar de unas semanas a un mes. Mientras esperas, puedes participar en las ferias como visitante y conocer a los miembros.',
          },
          {
            question: '¿Qué compromisos asumo al ser miembro?',
            answer:
              'Al ser miembro te comprometes a: 1) Aportar algo a la comunidad de forma regular. 2) Mantener tu saldo TQ cercano a cero. 3) Participar en las asambleas (presenciales o digitales). 4) Respetar los valores de agroecología, trueque y cuidado de la tierra. 5) Ser honesto en tus intercambios. 6) No acumular saldo negativo sin plan para recuperarlo.',
          },
          {
            question: '¿Puedo entrar siendo parte de otra comunidad o red?',
            answer:
              'Sí, siempre y cuando no haya conflicto de intereses. Muchos miembros participan en varias redes. La idea es sumar, no excluir. Si ya eres parte de otra comunidad de trueque, nos encantará conocer tu experiencia y aprender de ella.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Organización y las Asambleas',
        items: [
          {
            question: '¿Cómo se organiza la feria más allá del día de mercado?',
            answer:
              'La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos.',
          },
          {
            question: '¿Qué es una asamblea y por qué es importante?',
            answer:
              'La asamblea es el espacio donde todos los miembros toman decisiones juntos. No hay un jefe ni un dueño: las decisiones se toman colectivamente, por consenso o por votación. La asamblea decide quién entra, quién sale, cómo se reparten los recursos, qué reglas se cambian, y cómo se resuelven los conflictos. Si no participas en la asamblea, no tienes voz en las decisiones que afectan a la comunidad.',
          },
          {
            question: '¿Tengo que asistir a todas las asambleas?',
            answer:
              'Se espera que los miembros participen en las asambleas, pero entendemos que a veces no es posible asistir físicamente. Por eso existe la asamblea digital: puedes participar y votar desde tu teléfono o computadora. Lo importante es que tu voz se escuche, aunque no puedas estar presente.',
          },
          {
            question: '¿Cómo se toman las decisiones en la asamblea?',
            answer:
              'Por defecto, las decisiones se toman por consenso: se busca que todos estén de acuerdo. Si no hay consenso, se vota. El umbral de aprobación por defecto es del 100%, lo que significa que una decisión se aprueba solo si nadie se opone. Esto asegura que las decisiones sean verdaderamente colectivas y que nadie quede marginado.',
          },
          {
            question: '¿Qué pasa si no estoy de acuerdo con una decisión?',
            answer:
              'Puedes expresar tu desacuerdo en la asamblea. Tu voz cuenta. Si una decisión se aprueba y tú no estás de acuerdo, puedes proponer revisarla en la próxima asamblea. La comunidad escucha a sus miembros. Si un miembro sistemáticamente no está de acuerdo con nada, puede ser que esta comunidad no sea el lugar adecuado para esa persona.',
          },
          {
            question: '¿Quién puede proponer cambios?',
            answer:
              'Cualquier miembro puede proponer cambios: nuevos productos, nuevas reglas, nuevos miembros, nuevas actividades. La propuesta se presenta en la asamblea y se discute colectivamente. No hay jerarquías: la palabra de un miembro nuevo vale igual que la de un miembro antiguo.',
          },
          {
            question: '¿Qué son las comisiones?',
            answer:
              'Las comisiones son grupos de miembros que se encargan de áreas específicas: logística, comunicación, bioinsumos, cultura, educación, etc. Cada comisión tiene cierta autonomía para tomar decisiones dentro de su área, pero siempre rinde cuentas a la asamblea general. Cualquier miembro puede unirse a una comisión.',
          },
          {
            question: '¿Qué es una cayapa?',
            answer:
              'Una cayapa es un trabajo colectivo donde varios miembros se juntan para ayudar a uno de ellos con una tarea grande: preparar un terreno, construir una casa, cosechar, etc. Es una forma de mutualidad: hoy te ayudamos tú, mañana ayudamos a otro. Las cayapas son el corazón del trueque de trabajo.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Federación y Otras Comunidades',
        items: [
          {
            question: '¿Qué significa que esta comunidad sea parte de una federación?',
            answer:
              'Significa que nuestra comunidad no está sola. Somos parte de una red de comunidades que comparten los mismos principios de trueque, agroecología y gobernanza asamblearia. Cada comunidad es autónoma y toma sus propias decisiones internas, pero todas usamos el mismo sistema de trueque, la misma moneda TQ, y los mismos protocolos de comunicación. Esto nos permite comerciar entre comunidades cuando es beneficioso para todos.',
          },
          {
            question: '¿Puedo usar mi saldo TQ en otra comunidad federada?',
            answer:
              'Sí, gracias a la piscina global multilateral real. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos, lo que limitaba el intercambio. Ahora existe una piscina global compartida: el saldo que ganas en el nodo B es gastable en el nodo C. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir mediante la piscina global multilateral.',
          },
          {
            question: '¿Qué pasa mientras hay pocas comunidades federadas?',
            answer:
              'Al principio, con pocas comunidades, el espectro de lo que puedes aportar y recibir es más limitado. Por eso es crucial que cada comunidad que se federé garantice que sus miembros tienen algo real que aportar. A medida que más comunidades se federen, el espectro se amplía: más productos, más servicios, más lugares donde aportar trabajo, más cosas que recibir. La federación se hace más sólida cuantas más comunidades participen.',
          },
          {
            question: '¿Mi comunidad tiene que usar el mismo software?',
            answer:
              'Sí, todas las comunidades federadas usan el mismo software base, porque es la única forma de garantizar que los intercambios funcionen correctamente entre comunidades. Pero cada comunidad puede personalizar los colores, textos, idioma, y reglas internas de su plataforma. La base técnica es compartida, pero la identidad de cada comunidad es propia.',
          },
          {
            question: '¿Una comunidad nueva puede crear su propio software?',
            answer:
              'El software es de código abierto, lo que significa que cualquiera puede verlo, modificarlo y adaptarlo. Pero para federarse, tiene que usar el mismo protocolo de comunicación. Si alguien quiere desarrollar una versión distinta del software, puede hacerlo, siempre y cuando sea 100% compatible con el protocolo federado. La idea es que todas las comunidades puedan comunicarse e intercambiar sin problemas.',
          },
          {
            question: '¿Quién gobierna la federación?',
            answer:
              'La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación (como la canasta básica TQ, el límite de crédito global, o la expulsión de un nodo problemático) se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre las Piscinas de la Federación (Global vs. Bilateral)',
        items: [
          {
            question: '¿Qué es la piscina global multilateral real?',
            answer:
              'Es una piscina de saldo compartida por todos los nodos federados. El saldo que ganas intercambiando con el nodo B es gastable con el nodo C. Por ejemplo: si un productor del nodo B vende productos a un usuario del nodo A, el saldo positivo que genera el productor del nodo B puede usarse para comprar productos del nodo C. Esto permite un trueque multilateral real entre todas las comunidades federadas, no solo de par en par.',
          },
          {
            question: '¿Qué son las piscinas bilaterales?',
            answer:
              'Cada par de nodos mantiene un saldo bilateral independiente que refleja el intercambio directo entre esos dos nodos. El saldo bilateral con el nodo B es separado del saldo bilateral con el nodo C. Estas piscinas bilaterales coexisten con la piscina global y permiten llevar un registro detallado del intercambio entre cada par de comunidades.',
          },
          {
            question: '¿Antes no existía ya una piscina global?',
            answer:
              'No. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos. Es decir, solo se podía intercambiar con un nodo si el saldo bilateral con ese nodo específico estaba dentro del límite. No existía una piscina global real que permitiera gastar en el nodo C el saldo ganado en el nodo B. Ahora la piscina global multilateral real hace posible el trueque multilateral completo entre todos los nodos federados.',
          },
          {
            question: '¿Cómo se relacionan la piscina global y las bilaterales?',
            answer:
              'Son independientes. La piscina global permite el multilateralismo: lo que ganas en un nodo lo puedes gastar en cualquier otro. Las piscinas bilaterales llevan el registro del intercambio directo entre cada par de nodos. Ambas coexisten: la piscina global amplía las posibilidades de intercambio, mientras que las bilaterales mantienen la trazabilidad entre pares específicos.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre los Niveles de Nodo Federado',
        items: [
          {
            question: '¿Cuáles son los niveles de nodo federado?',
            answer:
              'Existen tres niveles: Nivel 1 (Nodo Nuevo) con un límite de 1.000 TQ, sin derecho a voto y sin capacidad de patrocinar nuevos nodos. Nivel 2 (Nodo Aceptado) con un límite de 5.000 TQ, derecho a voto en la federación y capacidad de patrocinar nuevos nodos. Nivel 3 (Nodo Pleno) con un límite de 20.000 TQ, derecho a voto y capacidad de patrocinio, con acceso completo a la piscina global multilateral.',
          },
          {
            question: '¿Cómo se promueve un nodo de Nivel 1 a Nivel 2?',
            answer:
              'La promoción a Nivel 2 (Nodo Aceptado) requiere una votación de toda la federación. El nodo debe haber permanecido un mínimo de 90 días como Nodo Nuevo antes de poder ser propuesto para promoción. La votación la realizan todos los nodos que ya tienen derecho a voto (Nivel 2 y Nivel 3). Si la federación aprueba la promoción, el nodo pasa a tener límite de 5.000 TQ, derecho a voto y capacidad de patrocinar.',
          },
          {
            question: '¿Cómo se promueve un nodo de Nivel 2 a Nivel 3?',
            answer:
              'La promoción a Nivel 3 (Nodo Pleno) es automática. Se alcanza cuando el nodo cumple los requisitos de reciprocidad y el límite promedio de la federación. No requiere votación: el sistema detecta que el nodo ha mantenido relaciones de intercambio recíprocas con otros nodos y que su actividad justifica un límite mayor de 20.000 TQ.',
          },
          {
            question: '¿Por qué los nodos nuevos no tienen derecho a voto?',
            answer:
              'Porque la confianza se construye con el tiempo. Un nodo nuevo (Nivel 1) aún no ha demostrado su compromiso con la federación ni ha establecido relaciones de reciprocidad con los demás nodos. Sin derecho a voto, el nodo puede participar en los intercambios pero no influye en las decisiones colectivas hasta que la federación lo apruebe como Nodo Aceptado (Nivel 2) tras un mínimo de 90 días.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre el Sistema de Padrino (Patrocinador)',
        items: [
          {
            question: '¿Qué es el sistema de padrino?',
            answer:
              'Cuando un nodo de Nivel 2 (Aceptado) o Nivel 3 (Pleno) patrocina a un nodo nuevo que ingresa a la federación, se convierte en su "padrino". El padrino asume responsabilidad solidaria sobre el nodo patrocinado: si el nodo nuevo incumple (default), la deuda se transfiere al padrino. A cambio, el nodo nuevo obtiene acceso a la federación con el respaldo de un nodo establecido.',
          },
          {
            question: '¿Quién puede ser padrino de un nodo nuevo?',
            answer:
              'Solo los nodos de Nivel 2 (Nodo Aceptado) o Nivel 3 (Nodo Pleno) pueden ser padrinos. Los nodos de Nivel 1 (Nodo Nuevo) no tienen capacidad de patrocinar. Esto asegura que solo los nodos que ya han demostrado compromiso y han sido aprobados por la federación puedan respaldar a nuevos nodos.',
          },
          {
            question: '¿Qué pasa con el límite del padrino al patrocinar?',
            answer:
              'Al patrocinar un nodo nuevo, el límite del padrino se reduce en el monto del límite del nodo patrocinado (1.000 TQ). Por ejemplo, si un nodo de Nivel 2 tiene un límite de 5.000 TQ y patrocina un nodo nuevo, su límite efectivo pasa a 4.000 TQ. El límite se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado).',
          },
          {
            question: '¿Qué pasa si el nodo patrocinado incumple?',
            answer:
              'Si el nodo patrocinado no cumple con sus compromisos (default), la deuda se transfiere al padrino. Esto significa que el padrino debe cubrir el saldo negativo del nodo patrocinado. Por eso es importante que el padrino solo patrocine nodos en los que confía y que conoce bien. El sistema de padrino fomenta relaciones de confianza real entre nodos.',
          },
          {
            question: '¿Cuándo se libera el límite retenido del padrino?',
            answer:
              'El límite retenido se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado). Esto significa que el nodo patrocinado ha sido aprobado por votación de toda la federación tras un mínimo de 90 días, demostrando que es confiable. Al liberarse el límite, el padrino recupera su capacidad de crédito completa y puede patrocinar a otros nodos nuevos si lo desea.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Verificación de 4 Opciones',
        items: [
          {
            question: '¿Qué es la verificación de 4 opciones?',
            answer:
              'Es un sistema de seguridad que se utiliza tanto en el emparejamiento de terminales POS como en la incorporación de nuevos nodos a la federación. Cuando un dispositivo o nodo solicita emparejamiento, el confirmador (administrador del nodo receptor) ve 4 opciones de código en pantalla. Solo una de las 4 opciones es el código correcto. El confirmador debe seleccionar el código correcto entre las 4 opciones.',
          },
          {
            question: '¿Por qué se usan 4 opciones en lugar de ingresar el código directamente?',
            answer:
              'Porque previene ataques de intermediario. Si un atacante intercepta la comunicación, no puede forzar la aprobación sin conocer visualmente cuál de las 4 opciones es la correcta. El código correcto solo lo muestra el dispositivo solicitante en su pantalla física. El confirmador debe verlo y seleccionar la opción coincidente, lo que requiere acceso visual al dispositivo.',
          },
          {
            question: '¿Qué pasa si selecciono el código equivocado?',
            answer:
              'Si el confirmador selecciona el código equivocado, el emparejamiento se rechaza automáticamente. El dispositivo solicitante deberá iniciar un nuevo proceso de emparejamiento con un código nuevo. Esto es una medida de seguridad: es preferible rechazar un emparejamiento válido antes que aprobar uno fraudulento.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Integridad Distribuida',
        items: [
          {
            question: '¿Qué es la integridad distribuida en las transacciones federadas?',
            answer:
              'Es un sistema de seguridad que protege las transacciones entre nodos federados mediante doble firma criptográfica y hashes encadenados. Cada transacción entre nodos requiere la firma de ambos (emisor y receptor), y cada transacción incluye el hash de la anterior, creando una cadena inmutable.',
          },
          {
            question: '¿Qué es la doble firma?',
            answer:
              'Cada transacción entre nodos federados requiere la firma criptográfica de ambos nodos: el emisor y el receptor. Ningún nodo puede falsificar una transacción en nombre del otro. Ambas partes deben confirmar criptográficamente la transacción para que sea válida. Esto garantiza que todas las transacciones federadas son consentidas por ambos nodos.',
          },
          {
            question: '¿Qué son los hashes encadenados?',
            answer:
              'Cada transacción entre nodos incluye el hash (una huella digital criptográfica) de la transacción anterior. Esto crea una cadena donde cualquier modificación de una transacción pasada invalida todas las posteriores. Permite verificar la integridad completa del historial de intercambios entre dos nodos: si alguien intenta alterar una transacción, la cadena se rompe y la alteración es detectable inmediatamente.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre las Tarjetas NFC y el POS',
        items: [
          {
            question: '¿Qué es la tarjeta NFC y cómo funciona?',
            answer:
              'La tarjeta NFC es como una tarjeta de identidad del trueque. La acercas al terminal POS y este reconoce quién eres. Cada tarjeta tiene un chip que la hace única e inimitable. Con ella puedes recibir pagos por tus productos, pagar por lo que recibes, y consultar tu saldo. Es más segura que una contraseña porque usa criptografía de nivel bancario.',
          },
          {
            question: '¿Qué pasa si pierdo mi tarjeta?',
            answer:
              'Puedes bloquearla tú mismo inmediatamente desde tu perfil en la web (Mi Perfil → Mis Tarjetas NFC → Desactivar). Nadie podrá usar la tarjeta bloqueada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física. Para obtener una tarjeta nueva, sí necesitas comunicarte con el administrador, quien verificará tu identidad y emitirá una nueva tarjeta.',
          },
          {
            question: '¿Necesito tener la tarjeta para participar?',
            answer:
              'La tarjeta NFC es la forma más fácil y segura de participar en los intercambios. Si no tienes tarjeta, también puedes usar códigos QR desde tu teléfono. La comunidad te puede ayudar a conseguir una tarjeta si eres miembro.',
          },
          {
            question: '¿El terminal POS funciona sin internet?',
            answer:
              'El terminal POS requiere conexión al servidor del nodo (por intranet o internet). Sin conexión no puede procesar pagos porque necesita validar el saldo del usuario y registrar la transacción en la base de datos. Solo el cierre de turno puede hacerse sin conexión y sincronizarse después. Para ferias en lugares sin señal, existe el modo Nodo Satélite (consultá la documentación).',
          },
          {
            question: '¿Puedo ver mi saldo desde mi teléfono?',
            answer:
              'Sí. Entra desde el navegador de tu teléfono a la dirección del nodo (pregúntasela al administrador). Puedes ver tu saldo, historial de transacciones, participar en asambleas digitales y gestionar tu tarjeta NFC. No necesitas instalar nada — es una aplicación web. Si en el futuro existe una app móvil nativa, el administrador te informará cómo acceder.',
          },
          {
            question: '¿Qué pasa si me paso de mi límite de crédito?',
            answer:
              'Si tu saldo queda por debajo de tu límite de crédito (por ejemplo, por compras offline concurrentes en un nodo satélite que se sincronizaron después), tu cuenta se marca como "sobre límite". No podrás hacer nuevas compras hasta que recibas suficientes TQ (vendiendo o recibiendo transferencias) para volver a estar dentro de tu límite. Eres responsable de no exceder tu límite. Si te excedes, regulariza lo antes posible. La asamblea puede penalizar a miembros que excedan su límite repetidamente.',
          },
          {
            question: '¿Qué es el emparejamiento del terminal?',
            answer:
              'Cuando un terminal POS nuevo llega a la comunidad, necesita ser "emparejado" con el servidor. El administrador genera un código de 6 dígitos que el terminal usa para registrarse. Una vez emparejado, el terminal sabe quién es y puede operar. Si el terminal se pierde o se daña, el administrador puede desactivarlo desde el panel y emparejar uno nuevo.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Preguntas que Debes Hacerte Antes de Entrar',
        items: [
          {
            question: '¿Tengo algo que aportar?',
            answer:
              'Esta es la pregunta más importante. El trueque funciona porque todos aportan y todos reciben. Si no tienes nada que aportar, el sistema no te va a funcionar. Aportar puede ser: productos de tu conuco o huerta, artesanías, alimentos procesados, servicios (reparaciones, clases, transporte), trabajo (ayuda en conucos, construcción, organización), o conocimientos (talleres, asesorías). Todo cuenta. Lo importante es que la comunidad valore lo que tú aportas.',
          },
          {
            question: '¿Hay algo en la comunidad que yo necesite o me interese?',
            answer:
              'La otra cara del trueque: ¿qué tiene la comunidad que tú puedes recibir? Alimentos, trabajo, servicios, productos artesanales, conexión con personas afines, talleres, participación en eventos. Si nada de lo que la comunidad ofrece te interesa, no tiene sentido que te integres. El trueque es bidireccional: tú aportas y recibes.',
          },
          {
            question: '¿Estoy dispuesto a participar activamente?',
            answer:
              'Ser miembro no es solo tener una cuenta. Es participar: asistir a asambleas, aportar de forma regular, ayudar en cayapas, respetar los valores de la comunidad. Si solo quieres tener una cuenta para recibir y nunca participar, el sistema no es para ti. La comunidad se sostiene con la participación de todos.',
          },
          {
            question: '¿Comparto los valores de la agroecología y el trueque?',
            answer:
              'Nuestra comunidad se basa en el cuidado de la tierra, la agroecología, el trueque, y la mutualidad. Si no compartes estos valores, probablemente no te sentirás cómodo aquí. No es un requisito ser productor agroecológico, pero sí respetar y apoyar estos principios.',
          },
          {
            question: '¿Estoy dispuesto a que mi saldo sea cero?',
            answer:
              'El objetivo del trueque no es acumular, sino equilibrar. Si tu meta es acumular mucho TQ para ser "rico", este sistema no es para ti. La meta es que tu saldo esté en cero: aportar lo que recibes. Si entiendes y aceptas esto, vas a disfrutar el trueque. Si no, vas a frustrarte.',
          },
          {
            question: '¿Qué hago si mis respuestas son positivas?',
            answer:
              '¡Excelente! Si tienes algo que aportar, hay algo que te interesa recibir, y estás dispuesto a participar, puedes solicitar admisión. Llena la solicitud, asiste a una feria como visitante, conoce a los miembros, y presenta tu propuesta en la asamblea. Te recibiremos con los brazos abiertos.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Gobernanza del Sistema',
        items: [
          {
            question: '¿Cómo funciona exactamente la gobernanza que propone el software?',
            answer:
              'La gobernanza se basa en una Asamblea Digital con votos formales. El software no impone una ideología única; su rol es automatizar y hacer cumplir las normas locales (la "Ley de la Aldea") que cada comunidad decide establecer en su propio servidor descentralizado. Cada nodo es autónomo y define sus propias reglas de convivencia.',
          },
          {
            question: '¿Cómo se toman las decisiones? ¿Por consenso, votación, delegación? ¿Qué ocurre cuando hay desacuerdos?',
            answer:
              'Las decisiones se toman por votación digital donde cada miembro tiene un voto que se firma con criptografía Ed25519 (un sistema de firmas digitales que hace que cada voto sea inalterable y verificable). Cada comunidad configura sus propios porcentajes de aprobación: mayoría simple (51%) para lo cotidiano, consenso alto (90%) para decisiones críticas como admitir nuevos miembros. Para evitar la parálisis, la Asamblea delega tareas administrativas en una Junta Directiva. Si una propuesta no alcanza el porcentaje requerido, el sistema bloquea su aplicación automáticamente. Ante desacuerdos insalvables, cualquier miembro puede retirarse y unirse a otro nodo de la red.',
          },
          {
            question: '¿Qué sucede cuando alguien incumple las reglas?',
            answer:
              'Las normas se registran clasificadas por severidad (leves, graves, muy graves) con sus sanciones correspondientes. Ante infracciones graves, la Asamblea General puede votar digitalmente la suspensión temporal o expulsión del miembro, requiriendo 75% de aprobación para la expulsión. El sistema garantiza que las sanciones se apliquen de forma transparente y registrada.',
          },
          {
            question: '¿Cómo evita que una persona o pequeño grupo concentre demasiado poder?',
            answer:
              'Tres mecanismos lo evitan: 1) Ningún administrador puede cambiar reglas unilateralmente; todo pasa por la asamblea y queda registrado públicamente. 2) Topes de saldo simétricos: el sistema bloquea automáticamente la cuenta de quien alcanza su techo positivo (igual al límite negativo), impidiendo el acaparamiento y obligando a gastar o reinvertir en la comunidad. 3) Multi-firma: las transacciones grandes requieren la firma conjunta de múltiples signatarios autorizados, neutralizando que un solo individuo controle los activos colectivos.',
          },
        ],
      },
      {
        type: 'faq',
        title: 'Sobre la Aplicación Práctica y el Estado del Proyecto',
        items: [
          {
            question: 'Háblanos más acerca de este software... ¿Qué aplicación concreta tiene en el día a día... para que las comunidades lo quieran instalar?',
            answer:
              'Funciona como un sistema operativo de soberanía económica y de convivencia. En el día a día: intercambiar productos en la feria sin dinero convencional (mediante tarjetas NFC y un punto de venta de bajo costo); organizar y recompensar el trabajo comunitario (1 TQ por hora de trabajo base, con multiplicadores según intensidad); desplegar servicios locales con un clic (Matrix para mensajería cifrada que reemplaza WhatsApp, Nextcloud para archivos, Asterisk para llamadas gratuitas); llevar la asamblea en el bolsillo (votar propuestas desde el móvil); y para comunidades religiosas, el "Sabbath Lock" congela automáticamente todas las transacciones durante el sábado.',
          },
          {
            question: '¿Qué problemas concretos soluciona?',
            answer:
              '1) Parálisis económica por escasez de dinero o inflación: el trueque TQ permite comerciar sin capital previo, anclado a 1 kWh de energía. 2) Burnout y parasitismo: los límites simétricos de saldo obligan a la circularidad. 3) Falta de internet en zonas rurales: funciona 100% off-grid con servidor local. 4) Estancamiento del trueque tradicional: el crédito mutuo diferido permite intercambios multilaterales. 5) Filtración de datos: todo se almacena local y encriptado. 6) Aislamiento entre ecoaldeas: la federación mediante conexiones seguras (mTLS, un sistema de encriptación mutua entre servidores) permite comerciar entre comunidades distantes.',
          },
          {
            question: '¿Hay ecoaldeas que ya lo estén usando?',
            answer:
              'Al 30 de agosto de 2026, ninguna ecoaldea está usando el sistema en producción. El proyecto nació hace apenas un mes desde la Feria Conuquera Agroecológica de Caracas, donde los productores tenemos parcelas aisladas y nos reunimos los primeros sábados de cada mes. El sistema está en desarrollo activo y se buscan personas que quieran sumarse a co-crear: ideas, programación, todos los aportes son válidos. El software es de código abierto y 100% adaptable a cada comunidad. Si quieres verlo en acción, podemos organizar una videollamada para mostrar el panel de administración, la app de Android y las tarjetas NFC funcionando.',
          },
        ],
      },
    ],
  },
  {
    slug: 'contacto',
    title: 'Contacto y Ubicación',
    subtitle: 'Canales de Comunicación y Cómo Llegar',
    icon: 'mail',
    menu_order: 8,
    blocks: [
      {
        type: 'contact_location',
        title: 'Visítanos',
        subtitle: '',
        address: '',
        schedule: '',
        instagram: '',
        facebook: '',
        email: '',
        phone: '',
        transport_info: '',
      },
      {
        type: 'cta_banner',
        badge: '📩 Postulación Comunitaria',
        title: '¿Deseas postularte como productor comunitario o miembro?',
        subtitle: 'Llena nuestro formulario público de postulación para ser evaluado por la asamblea trimestral.',
        button_text: 'Ir al Formulario de Admisión',
        button_link: '/p/unirse',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'semillas',
    title: 'Semillas & Banco de Semillas',
    subtitle: 'Patrimonio Colectivo, Soberanía Alimentaria y Biodiversidad',
    icon: 'sprout',
    menu_order: 9,
    blocks: [
      {
        type: 'hero',
        badge: '🌱 Las Semillas Son Vida',
        title: 'Banco Comunitario de Semillas Criollas',
        subtitle: 'Conservar nuestras semillas es conservar nuestra libertad.',
        description:
          'Las semillas son el primer eslabón de la cadena alimentaria. Quien controla las semillas controla la alimentación. Por eso defendemos las semillas criollas y nativas: porque son patrimonio colectivo de los pueblos, se reproducen libremente, están adaptadas a nuestro clima y han sido seleccionadas por generaciones de campesinos y campesinas.',
        image_url:
          '/placeholder.svg',
        style: 'split',
      },
      {
        type: 'features_grid',
        title: '¿Qué es un Banco Comunitario de Semillas?',
        subtitle: 'Una alternativa de conservación colectiva de la agrobiodiversidad',
        columns: 2,
        items: [
          {
            icon: 'users',
            title: 'Administración colectiva',
            description:
              'Un banco comunitario de semillas es un modelo de administración colectiva de la reserva de semillas necesaria para la siembra entre los productores de una comunidad. Su funcionamiento se basa en el sistema de préstamo y devolución: los productores asociados toman prestada una cantidad de semilla y, tras la cosecha, la devuelven con un porcentaje adicional. Así cada agricultor produce y mejora su propia semilla.',
            badge: 'Colectivo',
          },
          {
            icon: 'leaf',
            title: 'Conservación de agrobiodiversidad',
            description:
              'Los bancos comunitarios conservan importantes genes que aportan sabor, color, olor, resistencia a plagas y adaptación al clima. La FAO reconoce que estos bancos son vitales para perpetuar el acervo genético de las especies vegetales y asegurar la seguridad alimentaria frente al cambio climático y la homogeneización corporativa.',
            badge: 'Biodiversidad',
          },
          {
            icon: 'shield',
            title: 'Confianza en la propia semilla',
            description:
              'Los agricultores confían en sus semillas porque han sido seleccionadas por ellos mismos, conocen el desempeño de las plantas de las que provienen y saben cómo se comportarán bajo las condiciones agroecológicas locales. Esta confianza es la base de la autonomía campesina: no dependes de una tienda ni de una corporación para sembrar.',
            badge: 'Autonomía',
          },
          {
            icon: 'rotate-cw',
            title: 'Sistema de préstamo y devolución',
            description:
              'El banco define colectivamente cuánta semilla deposita cada agricultor y qué porcentaje debe agregar al devolverla. Este sistema permite que el banco crezca con cada ciclo, que la semilla se adapte a las condiciones locales y que nuevos productores puedan acceder a semilla de calidad sin comprarla. Es un círculo de vida que se multiplica.',
            badge: 'Círculo virtuoso',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Semillas Criollas vs. Transgénicas',
        subtitle: 'La diferencia entre libertad y dependencia',
        columns: 2,
        items: [
          {
            icon: 'sprout',
            title: 'Semillas criollas y nativas',
            description:
              'Las semillas criollas son aquellas que han sido seleccionadas y adaptadas por los campesinos durante generaciones. Son libres: puedes guardarlas, intercambiarlas, venderlas y sembrarlas sin restricciones. Se adaptan a las condiciones locales, resisten plagas nativas, requieren menos insumos externos y conservan la diversidad genética. Cada variedad criolla es resultado de siglos de conocimiento campesino.',
            badge: 'Libres',
          },
          {
            icon: 'alert-triangle',
            title: 'Semillas transgénicas',
            description:
              'Las semillas transgénicas son modificadas genéticamente en laboratorios y patentadas por corporaciones. Su uso obliga a comprar semillas nuevas cada temporada (están diseñadas para no reproroducirse), crea dependencia económica, contamina las variedades nativas por polinización cruzada, reduce la biodiversidad y concentra el control de la alimentación en unas pocas empresas transnacionales.',
            badge: 'Dependencia',
          },
          {
            icon: 'shield',
            title: 'Territorios libres de transgénicos',
            description:
              'En América Latina, comunidades indígenas y campesinas han declarado Territorios Libres de Transgénicos (TLT) como acto de autodeterminación. En Colombia, resguardos indígenas Zenú y comunidades afrodescendientes de la Región Caribe han recuperado decenas de variedades de maíz criollo y declarado sus territorios libres de transgénicos. Es un movimiento que crece.',
            badge: 'Resistencia',
          },
          {
            icon: 'globe',
            title: 'Patrimonio de los pueblos',
            description:
              'Las semillas constituyen un don sagrado, patrimonio colectivo de los pueblos. Han circulado libremente entre la población rural latinoamericana garantizando soberanía y autonomía alimentaria frente a las crisis. Los derechos colectivos de uso, manejo, intercambio y control local de las semillas tienen carácter inalienable e imprescriptible.',
            badge: 'Patrimonio',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'El Trueque de Semillas en la Feria',
        subtitle: 'Cada encuentro mensual es un intercambio libre de vida',
        columns: 3,
        items: [
          {
            icon: 'rotate-cw',
            title: 'Cómo funciona',
            description:
              'Traes tus semillas en sobres o frascos etiquetados con el nombre de la variedad, fecha de cosecha y lugar de procedencia. Las intercambias por las semillas de otros agricultores y vecinos. No hay dinero de por medio. Una semilla de maíz criollo por una de frijol, un puñado de ají dulce por semillas de lechuga.',
            badge: 'Intercambio',
          },
          {
            icon: 'leaf',
            title: 'Por qué importa',
            description:
              'Cada semilla que viaja de una mano a otra es un acto de soberanía. Si las semillas solo estuvieran en una tienda, perderíamos la diversidad. El trueque mantiene vivas variedades que no se consiguen comercialmente: el maíz cariaco, el frijol caraota de enredadera, el ají topito, la lechuga de hoja suelta.',
            badge: 'Soberanía',
          },
          {
            icon: 'heart',
            title: 'Para todos',
            description:
              'No necesitas ser productor profesional para participar. Si tienes un balcón con hierbas, un patio con un árbol frutal o un huerto comunitario, puedes traer tus semillas. También puedes llevar semillas para empezar tu propio huerto en casa. La semilla es el primer paso hacia la soberanía alimentaria urbana.',
            badge: 'Abierto',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'La Campaña Semillas de Identidad',
        subtitle: 'Recuperar, visibilizar y multiplicar nuestras semillas nativas',
        columns: 2,
        items: [
          {
            icon: 'sprout',
            title: 'Recuperación de variedades perdidas',
            description:
              'En Colombia, la campaña "Semillas de Identidad" identificó 27 variedades de maíz criollo entre Urabá y Boliván. En nuestra región, colectivos agroecológicos recuperan variedades de caraota, maíz, ají y tubérculos que habían desaparecido del mercado pero seguían vivas en los conucos de los abuelos. Cada variedad recuperada es un triunfo contra la homogeneización.',
            badge: 'Recuperación',
          },
          {
            icon: 'users',
            title: 'Guardianes de semillas',
            description:
              'Los guardianes de semillas son campesinos, indígenas y urbanos que conservan variedades específicas en sus huertos y conucos. No lo hacen por lucro: lo hacen por convicción. Saben que si ellos no guardan esa semilla, se pierde para siempre. Las Redes de Guardianes de Semillas articulan a estos custodios en toda América Latina.',
            badge: 'Guardianes',
          },
          {
            icon: 'book-open',
            title: 'Diálogo de saberes',
            description:
              'El banco de semillas no es solo un depósito: es un espacio de diálogo entre el conocimiento campesino ancestral y la ciencia agroecológica. Los abuelos saben cuándo sembrar según las lluvias, qué variedad va mejor en cada suelo, cómo preparar remedios naturales contra plagas. Los jóvenes aportan técnicas de documentación, registro y experimentación.',
            badge: 'Diálogo',
          },
          {
            icon: 'globe',
            title: 'Redes de semillas libres',
            description:
              'La Red de Semillas Libres de Colombia, la Red de Guardianes de Semillas de Vida, la Campaña Global por la Soberanía de las Semillas: movimientos que defienden el derecho de los pueblos a guardar, intercambiar y mejorar sus semillas frente a las leyes que pretenden privatizar la vida.',
            badge: 'Red global',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🌱 Participa',
        title: 'Trae tus semillas a la próxima feria',
        subtitle: 'En cada encuentro mensual. Intercambio libre de semillas criollas, plántulas medicinales y esquejes. No necesitas ser miembro para participar en el trueque de semillas.',
        button_text: 'Ver Próxima Feria',
        button_link: '/p/contacto',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'saberes-ancestrales',
    title: 'Saberes Ancestrales',
    subtitle: 'Conocimientos Tradicionales que Sostienen la Vida Comunitaria',
    icon: 'book-open',
    menu_order: 10,
    blocks: [
      {
        type: 'hero',
        badge: '🏺 Saberes que Viene del Conuco',
        title: 'Saberes Ancestrales y Conocimiento Tradicional',
        subtitle: 'La sabiduría de los abuelos no es pasado: es futuro.',
        description:
          'Los saberes ancestrales son conocimientos transmitidos de generación en generación, nacidos de la observación paciente de la naturaleza y de la relación respetuosa entre las personas y la tierra. No son recetas del pasado: son tecnologías vivas, adaptadas y vigentes, que ofrecen respuestas a los problemas contemporáneos de alimentación, salud, vivienda y comunidad.',
        image_url:
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'features_grid',
        title: 'Casas de Bahareque: Construcción Natural Ancestral',
        subtitle: 'Cuatro siglos de arquitectura sostenible en nuestra región',
        columns: 2,
        items: [
          {
            icon: 'home',
            title: '¿Qué es el bahareque?',
            description:
              'El bahareque es una técnica constructiva prehispánica que ha sobrevivido hasta nuestros días, desde el siglo XVII. Está compuesto por columnas de madera (horconadura), varas horizontales amarradas a ambos lados (enlatado), un relleno de barro con piedras y paja (embutido), y un acabado de barro con o sin cal (empañetado). Es arquitectura de tierra: vernácula, sostenible y patrimonial.',
            badge: 'Técnica ancestral',
          },
          {
            icon: 'leaf',
            title: 'Construcción sostenible',
            description:
              'El bahareque usa materiales locales y reciclables: madera, barro, caña, bejucos, paja. Requiere poca energía y agua para construirse. No contamina. Se integra al paisaje. Regula la temperatura naturalmente (fresco durante el día, cálido en la noche). Estudios universitarios demuestran que es posible construir y reparar bahareque con materiales disponibles hoy, aplicando principios de construcción sostenible.',
            badge: 'Sostenible',
          },
          {
            icon: 'users',
            title: 'Construcción comunitaria (cayapas)',
            description:
              'Las casas de bahareque se construían mediante cayapas: jornadas colectivas donde toda la comunidad ayudaba voluntariamente. Cada quien contribuía con lo que tenía: horcones, latas, bejucos, varas. El barro se traía en mapires y cajones al hombro o sobre burros. La paja se transportaba en haces desde los cerros. Era una fiesta pueblerina, llena de camaradería, donde viejos, mozos, niños, varones y hembras participaban.',
            badge: 'Cayapa',
          },
          {
            icon: 'shield',
            title: 'Patrimonio que se pierde',
            description:
              'A mediados del siglo XX, el bahareque fue desplazado por el ladrillo y el cemento en las ciudades. Varias edificaciones de bahareque que aún están en pie son consideradas patrimonio nacional o regional. Pero el conocimiento se está perdiendo: los jóvenes ya no saben construir con barro. Recuperar esta técnica es recuperar autonomía habitacional, patrimonio cultural y una forma de construcción que no destruye el planeta.',
            badge: 'Patrimonio',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Ollas de Barro: Cocina Ancestral',
        subtitle: '4.000 años de tradición cerámica que transforma el sabor y nutre el cuerpo',
        columns: 2,
        items: [
          {
            icon: 'utensils',
            title: 'Cocción lenta y uniforme',
            description:
              'La olla de barro permite una cocción lenta y uniforme que resalta los sabores naturales de los ingredientes. La porosidad del barro hace que los alimentos se cocinen de manera suave, manteniendo la humedad y potenciando los aromas. El secreto del buen sabor es que la cocción es lenta: los ingredientes necesitan su tiempo para sacar sus sabores, texturas y aromas.',
            badge: 'Sabor',
          },
          {
            icon: 'heart',
            title: 'Beneficios para la salud',
            description:
              'El barro contiene minerales que se transfieren a los alimentos durante la cocción, enriqueciéndolos naturalmente. Las ollas de barro retienen el calor de manera uniforme, preservando las vitaminas y minerales que otros materiales degradan. La cocción suave favorece la digestión. A diferencia del aluminio o el teflón, el barro no libera sustancias tóxicas a altas temperaturas.',
            badge: 'Salud',
          },
          {
            icon: 'history',
            title: '4.000 años de tradición',
            description:
              'El uso de ollas de barro se remonta a las culturas originarias de América. En Ecuador, la cultura Valdivia ya elaboraba vasijas para procesar, servir y guardar alimentos hace 4.000 años. En diversas comunidades se mantiene viva la tradición alfarera. Cada olla es única: hecha a mano, cocida en horno a 1000°C, con la arcilla del lugar.',
            badge: 'Tradición',
          },
          {
            icon: 'leaf',
            title: 'Cocina sin dependencia industrial',
            description:
              'Usar ollas de barro es un acto de soberanía: no dependes de utensilios industriales importados, apoyas a los alfareros locales, reduces el consumo de metal y plástico, y recuperas una forma de cocinar que es más sabrosa, más saludable y más justa. En la feria conseguimos ollas, budares, tiestos y vasijas de barro hechas por artesanos locales.',
            badge: 'Soberanía',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Casas de Cultivo e Invernaderos',
        subtitle: 'Agricultura urbana protegida para producir alimentos todo el año',
        columns: 2,
        items: [
          {
            icon: 'home',
            title: '¿Qué es una casa de cultivo?',
            description:
              'Las casas de cultivo son estructuras protegidas que permiten producir hortalizas durante todo el año, protegiendo los cultivos del sol intenso, la lluvia excesiva y las plagas. En diversas comunidades, las casas de cultivo han demostrado que se pueden producir tomates, pimentones, pepinos y lechugas de forma agroecológica en espacios urbanos.',
            badge: 'Cultivo protegido',
          },
          {
            icon: 'leaf',
            title: 'Producción agroecológica urbana',
            description:
              'En las casas de cultivo se usan abonos orgánicos (humus de lombriz, biol), control biológico de plagas (Trichoderma, Bacillus thuringiensis, Beauveria bassiana) y caldos naturales (sulfocalcico). No se usan agrotóxicos. Una casa de cultivo de 300 m² puede producir hasta 8.000 kg de tomate por ciclo, libre de agrotóxicos.',
            badge: 'Sin agrotóxicos',
          },
          {
            icon: 'users',
            title: 'Agricultura comunitaria',
            description:
              'En diversos barrios, los huertos urbanos se han convertido en centros de desarrollo comunitario. Muchos huertos, en predios recuperados, ahora producen tomate, cebollín, ají, pimentón, repollo y lechuga. Escolares visitan para aprender a cultivar. La siembra urbana es herramienta de soberanía alimentaria, educación y tejido social.',
            badge: 'Comunidad',
          },
          {
            icon: 'sparkles',
            title: 'Huerto en casa',
            description:
              'No necesitas un campo grande: un balcón, un patio, un terrario o un cantero vertical basta para empezar. En la feria conseguimos plántulas, semillas, sustratos orgánicos, lombrices californianas para compostaje y asesoría para montar tu huerto familiar. Producir tus own hierbas y hortalizas es el primer paso hacia la autonomía alimentaria.',
            badge: 'Huerto familiar',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Medicina Natural y Botica Comunitaria',
        subtitle: 'El conocimiento etnobotánico de las comunidades locales',
        columns: 2,
        items: [
          {
            icon: 'heart',
            title: 'Plantas medicinales: patrimonio vivo',
            description:
              'Estudios etnobotánicos en comunidades campesinas documentan cientos de especies de plantas medicinales usadas por las comunidades locales. En muchas comunidades rurales, todas las familias usan plantas medicinales, desde niños hasta ancianos. Es patrimonio cultural y ancestral que se transmite oralmente, de abuelos a nietos.',
            badge: 'Etnobotánica',
          },
          {
            icon: 'leaf',
            title: 'Tinturas madres y preparados',
            description:
              'En la feria conseguimos tinturas madres de propóleo, moringa, cúrcuma, jengibre y árnica; ungüentos naturales; jarabes para la tos; aceites esenciales. Cada preparado se hace con plantas cultivadas agroecológicamente o recolectadas respetando los ciclos naturales. La farmacopea tradicional no reemplaza la medicina moderna, la complementa.',
            badge: 'Botica',
          },
          {
            icon: 'shield',
            title: 'Primer recurso de salud',
            description:
              'En comunidades rurales con deficiencias en servicios de salud, las plantas medicinales son el primer recurso para atender afecciones respiratorias, digestivas, cutáneas y renales. Las hojas, frutos y cortezas se preparan en decocción o maceración. Este conocimiento es una alternativa real de atención primaria, especialmente donde el Estado no llega.',
            badge: 'Salud comunitaria',
          },
          {
            icon: 'alert-triangle',
            title: 'Conocimiento en riesgo',
            description:
              'Los estudios advierten que el conocimiento tradicional se está erosionando por la modernización, la migración y la pérdida de transmisión intergeneracional. Por eso es vital documentar, visibilizar y transmitir estos saberes. La feria es un espacio de diálogo de saberes: los abuelos comparten, los jóvenes registran y experimentan.',
            badge: 'Urgente',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'La Cosmovisión Comunitaria',
        subtitle: 'El conuco como forma de vida, no solo de producción',
        columns: 2,
        items: [
          {
            icon: 'sprout',
            title: '¿Qué es el conuco?',
            description:
              'El conuco es el sistema agrícola tradicional de los pueblos originarios y campesinos de nuestra región. No es solo una parcela: es una forma de relación con la tierra basada en la diversidad, la reciprocidad y el respeto. En el conuco se siembran juntos maíz, caraota, frijol, yuca, ají, lechosa: cada planta protege y nutre a las demás. Es el modelo original de la agroecología.',
            badge: 'Conuco',
          },
          {
            icon: 'heart',
            title: 'La Pachamama y la Cruz de Mayo',
            description:
              'Cada mayo, los productores de nuestra comunidad celebran un convite en honor a la Cruz de Mayo, un sentido homenaje a la Pachamama que les provee sustento y vida. No es solo una festividad: es un acto de gratitud a la tierra. La cosmovisión comunitaria entiende que la tierra no es un recurso que se explota, sino un ser vivo del que se es parte y al que se debe respeto.',
            badge: 'Pachamama',
          },
          {
            icon: 'users',
            title: 'El convite y la cayapa',
            description:
              'El convite es la jornada colectiva de siembra, cosecha o construcción donde toda la comunidad participa voluntariamente. La cayapa es lo mismo: ayuda mutua sin pago monetario. Estas prácticas ancestrales son la base de la economía solidaria: no necesitas dinero para construir una casa, sembrar un conuco o cosechar una parcela. Necesitas comunidad.',
            badge: 'Convite',
          },
          {
            icon: 'book-open',
            title: 'Diálogo intergeneracional',
            description:
              'La feria es un puente entre generaciones: los abuelos enseñan a seleccionar semillas, preparar remedios y cocinar recetas ancestrales; los jóvenes aportan técnicas de documentación, redes sociales y experimentación agroecológica. El conocimiento no se pierde cuando circula. Nuestra comunidad busca "rescatar las recetas y alimentos soberanos" y "restaurar la cultura alimentaria de los ancestros".',
            badge: 'Diálogo',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🏺 Recupera tus Saberes',
        title: 'Los saberes ancestrales son tecnología vigente',
        subtitle: 'Bahareque, ollas de barro, medicina natural, conuco, convite: no son pasado, son futuro. Conócelos, practícalos, transmítenos. Visita la próxima feria y participa en los talleres formativos.',
        button_text: 'Ver Próximas Actividades',
        button_link: '/p/contacto',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'filosofia-conuquera',
    title: 'Filosofía Comunitaria',
    subtitle: 'Agroecología, Soberanía y Vida Comunitaria',
    icon: 'heart',
    menu_order: 11,
    blocks: [
      {
        type: 'hero',
        badge: '🌱 Más que un Mercado, una Forma de Vida',
        title: 'Filosofía Comunitaria',
        subtitle: 'Nuestra comunidad no es solo un mercado: es una organización que aglutina a colectivos, familias y comunidades que buscan transformar cómo producimos, distribuimos y consumimos alimentos.',
        description:
          'Nacimos como respuesta a la crisis alimentaria y la guerra económica. Frente a las colas, el desabastecimiento y la comida procesada, retomamos el concepto y la práctica comunitaria: producir sin agrotóxicos, distribuir sin intermediarios, consumir alimentos soberanos y tejer comunidad alrededor de la tierra.',
        image_url:
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'features_grid',
        title: 'Nuestra Filosofía',
        subtitle: 'Los principios que guían todo lo que hacemos',
        columns: 2,
        items: [
          {
            icon: 'leaf',
            title: 'Agroecología como modelo de vida',
            description:
              'La agroecología no es solo una técnica de cultivo: es una ciencia, una práctica y un movimiento. Ciencia que aplica principios ecológicos a la agricultura. Práctica que respeta los ciclos naturales, recicla nutrientes y controla plagas con biodiversidad. Movimiento que defiende la soberanía alimentaria, la justicia social y los derechos de los pueblos. La FAO la reconoce como método capaz de transformar los sistemas alimentarios hacia la sostenibilidad.',
            badge: 'Agroecología',
          },
          {
            icon: 'shield',
            title: 'Soberanía alimentaria',
            description:
              'La soberanía alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios: qué sembrar, cómo sembrar, para quién producir y cómo distribuir. No es solo tener qué comer: es autonomía. Que la comunidad controle su alimentación, no las corporaciones transnacionales que monopolizan semillas y agroquímicos. La Vía Campesina acuñó este concepto y lo defendemos.',
            badge: 'Soberanía',
          },
          {
            icon: 'users',
            title: 'Economía solidaria',
            description:
              'Frente al capitalismo que explota personas y tierra, proponemos la economía solidaria: trueque, crédito mutuo, convite, cayapa, distribución sin intermediarios, precios justos. El dinero no es el centro: el centro son las personas. Producimos para el bien común, no para la acumulación. Nuestra comunidad es un mercado a costo solidario, no a precio de mercado.',
            badge: 'Solidaridad',
          },
          {
            icon: 'heart',
            title: 'Respeto a la Madre Tierra',
            description:
              'La tierra no es un recurso: es un ser vivo del que somos parte. La cosmovisión comunitaria entiende que la Pachamama nos provee sustento y vida, y merece gratitud y respeto. Por eso prohibimos el plástico desechable, usamos agroecología sin agrotóxicos, reciclamos nutrientes y promovemos construcciones naturales como el bahareque. Cuidar la tierra es cuidarnos a nosotros mismos.',
            badge: 'Pachamama',
          },
          {
            icon: 'book-open',
            title: 'Saberes ancestrales',
            description:
              'Los conocimientos de los abuelos no son pasado: son tecnología vigente. El conuco, las semillas criollas, las ollas de barro, la medicina natural, el bahareque, el convite: todo eso son saberes que ofrecen respuestas contemporáneas a los problemas de alimentación, salud, vivienda y comunidad. La feria es un espacio de diálogo intergeneracional donde estos saberes circulan.',
            badge: 'Saberes',
          },
          {
            icon: 'globe',
            title: 'Red global de resistencia',
            description:
              'No estamos solos. Nuestra comunidad es parte de un movimiento planetario: la Red Global de Ecoaldeas, la Vía Campesina, Slow Food, las Redes de Semillas Libres, los sistemas LETS, los clubes de trueque. En todos los continentes hay comunidades que están construyendo alternativas al modelo agroindustrial. Somos parte de esa red global de resistencia regenerativa.',
            badge: 'Global',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Nuestra Historia',
        subtitle: 'De la crisis a la organización, de la organización a la soberanía',
        columns: 2,
        items: [
          {
            icon: 'calendar',
            title: 'Nacimiento en la crisis',
            description:
              'Nuestra Comunidad nace como respuesta al contexto de guerra económica. La compra compulsiva de alimentos procesados y las colas llevaron a miles de personas a asumir prácticas nuevas para acceder a bienes. Frente a ese panorama, un colectivo de productores decidió articular una red popular para generar una alternativa de distribución de alimentos sanos, producidos agroecológicamente.',
            badge: 'Fundación',
          },
          {
            icon: 'leaf',
            title: 'Primera feria',
            description:
              'La primera feria se realizó en nuestro espacio de encuentro. El objetivo era visibilizar el trabajo del productor y la productora de alimentos e incentivar a la comunidad a incorporarse al sector productivo. Desde entonces, en cada encuentro mensual, el espacio se transforma en un mercado a cielo abierto donde se venden e intercambian alimentos agroecológicos.',
            badge: 'Primera feria',
          },
          {
            icon: 'users',
            title: 'Crecimiento y red de colectivos',
            description:
              'La feria creció. Hoy aglutina a más de 40 productores de diversas comunidades aledañas. Se venden frutas, verduras, quesos de búfala y cabra, productos de miel, licores artesanales, cosmética natural, semillas criollas, plántulas medicinales y comida ancestral. Más que un mercado, es una red de colectivos.',
            badge: 'Red',
          },
          {
            icon: 'sparkles',
            title: '10 años de resistencia',
            description:
              'En octubre celebramos nuestro aniversario. Años de organización, formación y trabajo colectivo. Años demostrando que es posible producir alimentos sanos sin agrotóxicos, distribuir sin intermediarios, intercambiar sin dinero y tejer comunidad alrededor de la tierra. Nuestra comunidad es prueba viviente de que otra forma de vida es posible.',
            badge: '10 años',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Qué Consigues en la Feria',
        subtitle: 'Productos reales de productores reales, sin intermediarios',
        columns: 3,
        items: [
          {
            icon: 'leaf',
            title: 'Cosecha fresca',
            description:
              'Hortalizas y hojas verdes: col rizada, acelgas, lechugas variadas, cebollín, cilantro, perejil, espinaca. Tubérculos ancestrales: ñame morado criollo, ocumo blanco y morado, yuca dulce, auyama madura, cambur morado. Todo cosechado en la mañana, sin agrotóxicos.',
            badge: 'Fresco',
          },
          {
            icon: 'heart',
            title: 'Medicina botánica',
            description:
              'Tinturas madres de propóleo, moringa, cúrcuma, jengibre y árnica. Ungüentos naturales. Jarabes para la tos. Cosmética sin químicos: desodorantes de aceite de coco y bicarbonato, bálsamos labiales de cera de abejas, jabones artesanales, toallas reutilizables.',
            badge: 'Botica',
          },
          {
            icon: 'utensils',
            title: 'Gastronomía artesanal',
            description:
              'Cafunga (postre tradicional con plátano maduro, coco y papelón). Quesos de búfala y cabra: añejados, frescos, dulce de leche, yogur, mantequilla. Cacao puro, chocolates bean-to-bar. Café de montaña tostado en leña.',
            badge: 'Gastronomía',
          },
          {
            icon: 'sprout',
            title: 'Semillas y plántulas',
            description:
              'Semillas criollas libres de transgénicos: maíz cariaco, caraota de enredadera, ají topito, lechuga de hoja suelta. Plántulas medicinales: poleo, stevia, hierbaluisa, romero, ruda, orégano orejón. Esquejes de frutales. Todo para tu huerto familiar.',
            badge: 'Semillas',
          },
          {
            icon: 'home',
            title: 'Artesanía y ollas de barro',
            description:
              'Ollas, budares y tiestos de barro hechos por alfareros locales. Cestería tradicional. Vasijas de arcilla. Productos de fibras naturales. Cada pieza es única, hecha a mano con técnicas ancestrales y materiales del lugar.',
            badge: 'Artesanía',
          },
          {
            icon: 'zap',
            title: 'Miel y derivados',
            description:
              'Miel pura de abejas criollas. Polen. Propóleo. Cera de abejas. Productos de la colmena producidos por apicultores que respetan los ciclos naturales y no alimentan a las abejas con azúcar.',
            badge: 'Miel',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Actividades de la Feria',
        subtitle: 'Más que comprar y vender: formación, cultura y comunidad',
        columns: 2,
        items: [
          {
            icon: 'book-open',
            title: 'Talleres formativos gratuitos',
            description:
              'En cada jornada se ofrecen talleres gratuitos: siembra y lombricultura, preparación de bioinsumos, conservación de semillas, medicina natural, cocina ancestral, construcción con barro. La formación es continua: no solo aprendes a comprar, aprendes a producir.',
            badge: 'Formación',
          },
          {
            icon: 'rotate-cw',
            title: 'Trueque libre de semillas',
            description:
              'Espacio abierto donde agricultores y vecinos intercambian semillas criollas, plántulas y esquejes sin dinero. Traes lo que tienes, llevas lo que necesitas. Cada semilla que viaja es un acto de soberanía.',
            badge: 'Trueque',
          },
          {
            icon: 'book',
            title: 'Dona y adopta un libro',
            description:
              'Intercambio libre de libros: traes los que ya leíste, te llevas los que quieres leer. No es una librería: es un círculo de lectura comunitaria que promueve el acceso al conocimiento sin barreras económicas.',
            badge: 'Libros',
          },
          {
            icon: 'music',
            title: 'Música y cultura popular',
            description:
              'Música popular en vivo: tambores, cuatros, cantos de trabajo y decimas. Actividades lúdicas para niños y familias. La feria es celebración: no solo se vende, se canta, se baila, se comparte.',
            badge: 'Cultura',
          },
          {
            icon: 'users',
            title: 'Asambleas y comisiones',
            description:
              'Asambleas Generales cada 3 meses para la toma de decisiones colectivas. Comisiones temáticas: logística, comunicación, bioinsumos, cultura. La feria se gobierna horizontalmente, por consentimiento y no por jerarquía.',
            badge: 'Gobernanza',
          },
          {
            icon: 'leaf',
            title: 'Cayapas y visitas a conucos',
            description:
              'Organizamos cayapas (jornadas colectivas de trabajo) y visitas a los conucos de los productores. Es ayuda mutua: vas a sembrar o cosechar con el compañero, aprendes de su práctica y fortaleces el vínculo rural-urbano.',
            badge: 'Cayapa',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🤝 Únete a la Red',
        title: 'Nuestra comunidad es una forma de vida',
        subtitle: 'No solo vienes a comprar: vienes a aprender, a intercambiar, a compartir, a construir comunidad. Si deseas ingresar como productor o participar en las asambleas y trueques, postúlate ante la asamblea.',
        button_text: 'Completar Solicitud de Admisión',
        button_link: '/p/unirse',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'ecoaldeas-mundo',
    title: 'Ecoaldeas en el Mundo',
    subtitle: 'Comunidades Autosustentables que Inspiran: Referentes Globales',
    icon: 'globe',
    menu_order: 12,
    blocks: [
      {
        type: 'hero',
        badge: '🌍 Un Movimiento Planetario',
        title: 'Ecoaldeas en el Mundo',
        subtitle: 'Comunidades que viven en armonía con la naturaleza, libres de contaminación y químicos, recuperando saberes ancestrales.',
        description:
          'Estas son experiencias reales de comunidades en distintos continentes que han decidido vivir de otra manera: cultivando sus propios alimentos sin agrotóxicos, construyendo con materiales naturales, usando energías limpias y practicando la economía solidaria. No son nuestros aliados ni socios: son referentes que nos inspiran y de los cuales aprendemos. Cada una demuestra que otra forma de vida es posible.',
        image_url:
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'features_grid',
        title: 'Redes Globales',
        subtitle: 'Plataformas que conectan comunidades autosustentables en todo el mundo',
        columns: 2,
        items: [
          {
            icon: 'globe',
            title: 'Global Ecovillage Network (GEN)',
            description:
              'Es la organización mundial más importante del movimiento de ecoaldeas. Conecta a miles de comunidades en los cinco continentes. Su sitio web incluye un mapa interactivo mundial donde se pueden buscar proyectos activos, opciones de voluntariado y programas educativos sobre diseño sustentable. Fundada en 1995, su lema es "El mundo necesita más ecoaldeas".',
            badge: 'GEN',
          },
          {
            icon: 'globe',
            title: 'CASA Latina',
            description:
              'El Consejo de Asentamientos Sustentables de América Latina es la rama de GEN para Latinoamérica. Agrupa redes nacionales de bioconstrucción, permacultura y ecoaldeas. Es el mejor punto de partida para buscar proyectos hispanohablantes orientados al rescate de saberes indígenas y campesinos. Su proceso de formación comenzó en el Llamado de la Montaña, Colombia, en enero de 2012.',
            badge: 'CASA Latina',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Ecoaldeas Emblemáticas',
        subtitle: 'Comunidades referentes que llevan décadas demostrando que es posible vivir de otra manera',
        columns: 2,
        items: [
          {
            icon: 'home',
            title: 'Findhorn (Escocia, 1962)',
            description:
              'Una de las comunidades ecológicas más antiguas del mundo. Fundada en 1962 en Moray, Escocia. Destaca por sus viviendas construidas con materiales locales, el uso de energías renovables (incluyendo una turbina eólica Vestas de 75 kW) y su sistema avanzado de tratamiento de aguas residuales llamado "Living Machine". Recibió la designación de UN-Habitat Best Practice en 1998 y 2018. Es un laboratorio viviente de sostenibilidad con más de 60 años de evolución.',
            badge: 'Escocia',
          },
          {
            icon: 'sparkles',
            title: 'Damanhur (Italia, 1975)',
            description:
              'Federación de comunidades espirituales fundada en 1975 por Oberto Airudi en el Piamonte, norte de Italia. Sus 600 habitantes han creado una sociedad multilingüe con su propia constitución y su propia moneda, el Credito. Son reconocidos mundialmente por su alta autosuficiencia alimentaria y energética, sus Templos de la Humanidad subterráneos, y un profundo enfoque en el desarrollo espiritual y las artes. Es un laboratorio viviente del futuro.',
            badge: 'Italia',
          },
          {
            icon: 'droplet',
            title: 'Tamera (Portugal, 1995)',
            description:
              'Centro de Investigación y Educación para la Paz en Alentejo, la región más árida de Portugal. Han transformado terrenos áridos en oasis mediante técnicas ancestrales de retención de agua de lluvia: crearon 29 lagos y espacios de retención entre 2006 y 2015, pasando de 0.62 ha a 8.32 ha de cuerpos de agua. Promueven la agricultura libre de pesticidas, la soberanía alimentaria regional y el Nuevo Paradigma del Agua. Un biotopo de paz que investiga cómo habitar la Tierra sin violencia.',
            badge: 'Portugal',
          },
          {
            icon: 'palette',
            title: 'Huehuecoyotl (México, 1982)',
            description:
              'Primera ecoaldea de México, fundada en 1982 por un grupo de artistas y activistas de varias nacionalidades en las montañas de Morelos, cerca de Tepoztlán. Sus fundadores vivieron 14 años como tribu artística nómada ("Los Elefantes Iluminados") recorriendo el mundo en autobuses convertidos antes de establecerse. El nombre significa "El Muy Viejo Coyote", dios azteca de la música, la poesía y el teatro. Es referente latinoamericano de vida comunitaria, medicina natural, ecología profunda, permacultura y preservación cultural.',
            badge: 'México',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Los 4 Pilares de la Vida en una Ecoaldea',
        subtitle: 'Los principios que guían a estas comunidades autosustentables',
        columns: 2,
        items: [
          {
            icon: 'sprout',
            title: 'Permacultura y Agroecología',
            description:
              'Cultivan sus propios alimentos replicando los patrones de la naturaleza. No utilizan fertilizantes químicos, pesticidas ni semillas transgénicas. Usan abonos orgánicos (compost, humus de lombriz, biol) y asocian cultivos para proteger la tierra. Cada desecho se transforma en insumo: el estiércol en biogás, la basura orgánica en compost, el agua gris en riego.',
            badge: 'Permacultura',
          },
          {
            icon: 'home',
            title: 'Bioconstrucción',
            description:
              'Construyen sus casas utilizando materiales naturales del entorno que no contaminan ni generan desechos tóxicos: adobe, bahareque, barro, paja, madera, piedra, bambú. Las casas se integran al paisaje, regulan la temperatura naturalmente y se construyen comunitariamente mediante cayapas. No dependen del cemento ni del ladrillo industrial.',
            badge: 'Bioconstrucción',
          },
          {
            icon: 'zap',
            title: 'Energías limpias y gestión de residuos',
            description:
              'Usan paneles solares, energía eólica, microhidroeléctricas y biodigestores. Implementan baños secos (que no gastan agua y generan abono seguro). Reciclan el agua de lluvia para riego. Tratan aguas residuales con humedales construidos y "Living Machines". La meta es autonomía energética e hídrica descentralizada.',
            badge: 'Energía limpia',
          },
          {
            icon: 'heart',
            title: 'Economía solidaria y saberes ancestrales',
            description:
              'Muchas comunidades practican el trueque, usan monedas locales (como el Credito de Damanhur) o comparten recursos. Rescatan el uso de plantas medicinales, la partería natural, la conservación tradicional de alimentos, las ollas de barro, la construcción con barro. Toman decisiones por consenso o sociocracia, no por jerarquía.',
            badge: 'Economía solidaria',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Otras Experiencias que nos Inspiran',
        subtitle: 'Movimientos y prácticas relacionadas en distintas partes del mundo',
        columns: 3,
        items: [
          {
            icon: 'scale',
            title: 'Sistemas LETS',
            description:
              'Local Exchange Trading Systems: nacieron en Canadá en 1983 y se expandieron por Europa y Oceanía. Sistemas de crédito mutuo sin dinero donde todas las cuentas empiezan en cero. Inspiraron nuestro sistema TQ.',
            badge: 'LETS',
          },
          {
            icon: 'users',
            title: 'Club del Trueque (Argentina)',
            description:
              'Redes de trueque que surgieron en los años 90 como respuesta a la crisis. Llegaron a tener millones de participantes intercambiando con "créditos" sin dinero oficial. Demostraron la fuerza del crédito mutuo.',
            badge: 'Argentina',
          },
          {
            icon: 'leaf',
            title: 'Vía Campesina',
            description:
              'Movimiento internacional de campesinos, pueblos indígenas y trabajadores agrícolas presente en más de 80 países. Defiende la agricultura campesina y la agroecología. Acuñó el concepto de soberanía alimentaria.',
            badge: 'Vía Campesina',
          },
          {
            icon: 'heart',
            title: 'Slow Food',
            description:
              'Movimiento nacido en Italia en 1986 que promueve alimentos "buenos, limpios y justos". Defiende la biodiversidad alimentaria y las tradiciones culinarias locales frente a la comida rápida y homogeneizada.',
            badge: 'Slow Food',
          },
          {
            icon: 'sprout',
            title: 'Red de Semillas Libres',
            description:
              'Movimientos que defienden las semillas nativas y criollas frente al avance corporativo. Promueven territorios libres de transgénicos y la soberanía alimentaria como derecho inalienable de los pueblos.',
            badge: 'Semillas libres',
          },
          {
            icon: 'book-open',
            title: 'Permacultura',
            description:
              'Sistema de diseño creado por Bill Mollison y David Holmgren en Australia en los años 70. Diseña asentamientos humanos y sistemas agrícolas que imitan los patrones y relaciones de la naturaleza. Es la base teórica de muchas ecoaldeas.',
            badge: 'Permacultura',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🌱 Nuestro Sueño',
        title: 'Campo Soberano: nuestra ecoaldea',
        subtitle: 'Nos inspiramos en estas experiencias para construir nuestra propia comunidad intencional agroecológica. Conoce el proyecto Campo Soberano: permacultura, energía solar, bahareque, crédito mutuo y gobernanza sociocrática.',
        button_text: 'Conocer Campo Soberano',
        button_link: '/p/campo-soberano',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'metodologia-energetica',
    title: 'Metodología Energética',
    subtitle: 'Cómo Calculamos los Precios: Energía Objetiva, no Dinero',
    icon: 'zap',
    menu_order: 13,
    blocks: [
      {
        type: 'hero',
        badge: '⚡ 1 TQ = 1 kWh = 3.6 MJ',
        title: 'Precios Basados en Energía, no en Mercado',
        subtitle: 'Nuestro sistema de precios no usa oro, dólares ni especulación. Usa la energía física real invertida en producir cada bien.',
        description:
          'El TQ no está anclado al oro ni a ninguna moneda. Está anclado al julio (J), la unidad universal de energía del Sistema Internacional. 1 TQ = 1 kWh = 3.6 megajulios (MJ). Esto hace que el valor sea objetivo, medible y auditable: cualquier persona puede verificar cuánta energía se invirtió en producir algo.',
        image_url:
          '/placeholder.svg',
        style: 'standard',
      },
      {
        type: 'features_grid',
        title: '¿Por qué Energía y no Dinero?',
        subtitle: 'El dinero se devalúa, la energía no. El dinero se especula, la energía se mide.',
        columns: 2,
        items: [
          {
            icon: 'zap',
            title: 'Universal e invariable',
            description:
              'El julio (J) es la unidad de energía del Sistema Internacional de Unidades (SI). Es la misma en cualquier lugar del mundo. No depende de ningún gobierno, banco central ni mercado. 1 kWh siempre será 3.6 MJ, sin importar la inflación, la política ni la especulación.',
            badge: 'Universal',
          },
          {
            icon: 'scale',
            title: 'Objetivo y auditable',
            description:
              'Cuando decimos que una olla de barro cuesta 8 TQ, cualquiera puede verificar el cálculo: 2 kg de arcilla × 2.5 MJ/kg + 18 MJ de cocción + 3 horas de trabajo × 3.6 MJ/hora = 33.8 MJ = 9.4 TQ. No hay precio "porque sí": hay una fórmula transparente.',
            badge: 'Transparente',
          },
          {
            icon: 'trending-down',
            title: 'Sin inflación ni devaluación',
            description:
              'El dinero fiduciario se devalúa con la inflación. El oro sube y baja con la especulación. La energía incorporada en un producto no cambia: si hoy cuesta 5 kWh producir un kilo de pan, mañana costará lo mismo (a menos que mejore la tecnología, en cuyo caso baja, lo cual es bueno para todos).',
            badge: 'Sin inflación',
          },
          {
            icon: 'leaf',
            title: 'Refleja el costo real del planeta',
            description:
              'El precio de mercado no incluye el daño ambiental: la contaminación, la deforestación, el agotamiento de suelos. La energía incorporada sí lo refleja: un producto transportado desde China tiene más energía incorporada (combustible del barco) que uno producido localmente. El sistema energetico premia lo local y lo sostenible.',
            badge: 'Ecológico',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'La Fórmula Fundamental',
        subtitle: 'Cómo se calcula el precio de cualquier producto',
        columns: 2,
        items: [
          {
            icon: 'calculator',
            title: 'Energía Total Incorporada',
            description:
              'EE_total = E_directa + E_insumos + E_trabajo + E_transporte\n\n• E_directa: energía consumida en el proceso (electricidad, gas, leña)\n• E_insumos: energía incorporada en las materias primas usadas\n• E_trabajo: energía humana invertida (horas × tarifa energética)\n• E_transporte: energía del traslado de materiales y producto final\n\nEl resultado en MJ se divide entre 3.6 para obtener TQ.\n\nEjemplo: Olla de barro de 2 kg\n• Material: 2 kg × 2.5 MJ/kg = 5 MJ\n• Cocción: 18 MJ\n• Trabajo: 3 horas × 3.6 MJ/h = 10.8 MJ\n• Total: 33.8 MJ ÷ 3.6 = 9.4 TQ → precio: 8 TQ',
            badge: 'Fórmula',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Energía Incorporada por Material (ICE Database)',
        subtitle: 'Usamos el estándar internacional ICE Database de la University of Bath (UK)',
        columns: 3,
        items: [
          {
            icon: 'layers',
            title: 'Arcilla / Cerámica',
            description: '2.5 MJ/kg = 0.7 TQ/kg. Fuente: ICE Database. Material fundamental para ollas, vasijas, construcción de bahareque.',
            badge: '0.7 TQ/kg',
          },
          {
            icon: 'package',
            title: 'Madera blanda',
            description: '0.3 MJ/kg = 0.08 TQ/kg. Madera secada al aire. Fuente: ICE Database. Usada en muebles, cercas, herramientas.',
            badge: '0.08 TQ/kg',
          },
          {
            icon: 'package',
            title: 'Madera dura',
            description: '2.0 MJ/kg = 0.56 TQ/kg. Madera secada en horno. Fuente: ICE Database. Usada en muebles finos, construcción.',
            badge: '0.56 TQ/kg',
          },
          {
            icon: 'shirt',
            title: 'Algodón / Tela',
            description: '143 MJ/kg = 39.7 TQ/kg. Fuente: ICE Database + Ecoinvent. La tela es uno de los materiales con mayor energía incorporada.',
            badge: '39.7 TQ/kg',
          },
          {
            icon: 'shirt',
            title: 'Lana',
            description: '67.5 MJ/kg = 18.75 TQ/kg. Fuente: ICE Database. Material natural para textiles, mantas, ropa de abrigo.',
            badge: '18.75 TQ/kg',
          },
          {
            icon: 'droplet',
            title: 'Vidrio',
            description: '12.7 MJ/kg = 3.5 TQ/kg. Fuente: ICE Database. Usado en envases retornables, ventanas, decoración.',
            badge: '3.5 TQ/kg',
          },
          {
            icon: 'file',
            title: 'Papel kraft',
            description: '25 MJ/kg = 6.9 TQ/kg. Fuente: ICE Database. Usado en bolsas, embalaje, etiquetas.',
            badge: '6.9 TQ/kg',
          },
          {
            icon: 'leaf',
            title: 'Fibra vegetal',
            description: '0.5 MJ/kg = 0.14 TQ/kg. Estimación comunitaria. Cestería, sogas, artesanías con materiales del conuco.',
            badge: '0.14 TQ/kg',
          },
          {
            icon: 'recycle',
            title: 'HDPE (plástico)',
            description: '52.5 MJ/kg = 14.6 TQ/kg. Fuente: ICE Database + Ecoinvent. Tanques de agua, tuberías, envases.',
            badge: '14.6 TQ/kg',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Trabajo Humano: Tarifa Energética',
        subtitle: 'El trabajo humano se valora según la energía vital que sostiene al trabajador',
        columns: 2,
        items: [
          {
            icon: 'users',
            title: 'Tarifa vital por hora',
            description:
              'El trabajo humano se calcula según la energía necesaria para sostener la vida del trabajador: alimentación, agua, vivienda y servicios básicos. La tarifa base es aproximadamente 1 TQ por hora de trabajo, ajustada por el tipo de esfuerzo.',
            badge: '1 TQ/hora base',
          },
          {
            icon: 'trending-up',
            title: 'Factores de esfuerzo',
            description:
              'No todo el trabajo exige la misma energía:\n• Trabajo administrativo: × 1.0\n• Trabajo técnico/especializado: × 1.15\n• Trabajo agrícola/físico: × 1.3\n\nUn agricultor que trabaja 6 horas recibe 6 × 1.3 = 7.8 TQ. Un administrador que trabaja 6 horas recibe 6 × 1.0 = 6 TQ.',
            badge: 'Por esfuerzo',
          },
          {
            icon: 'clock',
            title: 'Parámetros laborales',
            description:
              'Jornada estándar: 6 horas/día, 24 días/mes. Estos parámetros son configurables por cada nodo según las decisiones de su asamblea. Lo importante es que el trabajo se mide en horas reales, no en "productividad" subjetiva.',
            badge: '6 h/día',
          },
          {
            icon: 'heart',
            title: 'Trabajo no remunerado',
            description:
              'El sistema puede reconocer el trabajo doméstico, de cuidados y comunitario que la economía convencional no valora. Cuidar a un anciano, cocinar para la comunidad, organizar una asamblea: todo es trabajo que consume energía humana y merece ser registrado.',
            badge: 'Inclusivo',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Ejemplo Práctico: Pan Artesanal (1 kg)',
        subtitle: 'Cómo se calcula paso a paso el precio de un kilo de pan integral',
        columns: 2,
        items: [
          {
            icon: 'wheat',
            title: 'Desglose energético del pan',
            description:
              'Harina de trigo integral: 0.6 kg × 10 TQ/kg = 6.0 TQ\nLevadura natural: 0.02 kg × 5 TQ/kg = 0.1 TQ\nSal marina: 0.01 kg × 3 TQ/kg = 0.03 TQ\nAgua: 0.35 L × 0.5 TQ/L = 0.18 TQ\nElectricidad (horno): 0.5 kWh × 1 TQ/kWh = 0.5 TQ\nLeña (horno mixto): 0.3 kg × 4.5 TQ/kg = 1.35 TQ\nTrabajo del panadero: 3 horas × 1 TQ/h = 3.0 TQ\nTransporte local: 2 km × 0.5 TQ/km = 1.0 TQ\n─────────────────────────\nTOTAL: 12.16 TQ por kg de pan\n\nPrecio redondeado: 12 TQ/kg',
            badge: '12 TQ/kg',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Productos Compuestos: Cálculo por Rendimiento',
        subtitle: 'Cuando un productor transforma materias primas en productos terminados',
        columns: 2,
        items: [
          {
            icon: 'droplet',
            title: 'Ejemplo: Jugo de naranja 200ml',
            description:
              'Un productor compra 1 kg de naranjas (2 TQ/kg) y produce 50 envases de 200ml.\n\nCantidad por envase = 1 kg ÷ 50 = 0.02 kg\nCosto de naranja por envase = 2 TQ × 0.02 = 0.04 TQ\n\nSe suman todos los componentes:\n• Naranjas: 0.04 TQ/envase\n• Azúcar/panela: 0.06 TQ/envase\n• Envase de vidrio: 0.50 TQ/envase\n• Trabajo (exprimido + envasado): 0.04 TQ/envase\n• Transporte: 0.05 TQ/envase\n─────────────────────────\nTOTAL: 0.69 TQ por envase → precio: 1 TQ\n\nEl productor especifica cuánto compró y cuántos productos obtuvo. El sistema calcula automáticamente el costo por unidad.',
            badge: '1 TQ/envase',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Fuentes de Datos Energéticos',
        subtitle: 'Usamos estándares internacionales reconocidos, no inventamos los números',
        columns: 2,
        items: [
          {
            icon: 'book',
            title: 'ICE Database',
            description:
              'Inventory of Carbon & Energy, University of Bath (Reino Unido). Base de datos de energía incorporada por kg de material. Es el estándar más usado en el mundo para cálculos de huella energética de materiales de construcción y manufactura.',
            badge: 'University of Bath',
          },
          {
            icon: 'book',
            title: 'Ecoinvent',
            description:
              'Base de datos suiza de análisis de ciclo de vida (LCA). Contiene datos detallados de energía incorporada, emisiones y uso de recursos para miles de productos y procesos industriales.',
            badge: 'Suiza',
          },
          {
            icon: 'book',
            title: 'Agribalyse',
            description:
              'Base de datos francesa del INRAE especializada en agricultura y alimentación. Proporciona datos de energía incorporada y huella ambiental de productos agrícolas y alimentos.',
            badge: 'Francia',
          },
          {
            icon: 'book',
            title: 'FAO Statistics',
            description:
              'Organización de las Naciones Unidas para la Alimentación y Agricultura. Datos globales de producción agrícola, uso de energía en la agricultura y balances energéticos nacionales.',
            badge: 'ONU',
          },
          {
            icon: 'book',
            title: 'USDA',
            description:
              'Departamento de Agricultura de Estados Unidos. Datos nutricionales, de producción y energía en sistemas alimentarios. Referencia para cálculos de eficiencia energética agrícola.',
            badge: 'EE.UU.',
          },
          {
            icon: 'book',
            title: 'Pimentel (Cornell)',
            description:
              'David Pimentel, ecólogo de la Universidad de Cornell. Pionero en estudios de energía en agricultura. Sus datos sobre EROI (Energy Return on Investment) son referencia mundial.',
            badge: 'Cornell',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Equivalencias Energéticas',
        subtitle: 'Para entender qué significa 1 TQ en la vida real',
        columns: 3,
        items: [
          {
            icon: 'zap',
            title: '1 TQ = 1 kWh',
            description: 'Un kilovatio-hora de electricidad. Lo que consume un bombillo LED de 10W encendido durante 100 horas, o un refrigerador durante medio día.',
            badge: 'Electricidad',
          },
          {
            icon: 'flame',
            title: '1 TQ = 3.6 MJ',
            description: '3.6 megajulios. La unidad del Sistema Internacional. Es la energía de 100 gramos de gasolina o 0.1 litros.',
            badge: 'Julios',
          },
          {
            icon: 'flame',
            title: '1 TQ ≈ 0.08 L gasolina',
            description: 'Unos 80 mililitros de gasolina. La energía que contiene un vaso pequeño de combustible.',
            badge: 'Gasolina',
          },
          {
            icon: 'flame',
            title: '1 TQ ≈ 0.2 kg leña',
            description: '200 gramos de leña seca. La energía de un puñado de ramas secas para cocinar.',
            badge: 'Leña',
          },
          {
            icon: 'sun',
            title: '1 TQ ≈ 1 hora solar',
            description: 'Aproximadamente la energía que un panel solar de 1 kW produce en 1 hora de sol pleno.',
            badge: 'Solar',
          },
          {
            icon: 'user',
            title: '1 TQ ≈ 1 hora trabajo',
            description: 'Una hora de trabajo humano base. El esfuerzo de una persona trabajando normalmente durante 60 minutos.',
            badge: 'Trabajo',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Historia: Energía como Moneda',
        subtitle: 'La idea de usar energía como unidad de valor no es nueva',
        columns: 2,
        items: [
          {
            icon: 'history',
            title: 'Ford y Edison (1921)',
            description:
              'Henry Ford y Thomas Edison propusieron una "moneda energética" basada en kWh, alternativa al patrón oro. Ford decía: "La energía es la única verdadera moneda". La idea no prosperó porque los bancos prefirieron mantener el sistema fiduciario que les beneficiaba.',
            badge: '1921',
          },
          {
            icon: 'history',
            title: 'Howard Odum (1970s)',
            description:
              'Ecólogo estadounidense que desarrolló el concepto de "emergía" (energy memory): la energía total incorporada en un producto o servicio. Su libro "Energy Basis for Man and Nature" (1976) es fundacional para la economía ecológica.',
            badge: 'Emergía',
          },
          {
            icon: 'history',
            title: 'LETS (1983)',
            description:
              'Local Exchange Trading System, creado por Michael Linton en Canadá. Sistema de crédito mutuo comunitario sin dinero. Inspiró miles de redes de trueque en el mundo, incluyendo los clubes de trueque argentinos.',
            badge: 'Canadá',
          },
          {
            icon: 'history',
            title: 'Club del Trueque (1995)',
            description:
              'Argentina, años 90. Red de clubes de trueque que llegó a tener 500.000 participantes durante la crisis económica de 2001. Usaban "créditos" como unidad contable. Demostró que el crédito mutuo funciona a gran escala.',
            badge: 'Argentina',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Diferencia con el Dinero Convencional',
        subtitle: 'Por qué el TQ no es dinero y nunca lo será',
        columns: 2,
        items: [
          {
            icon: 'x',
            title: 'No es dinero',
            description:
              'El TQ no es una moneda legal, no se puede comprar ni vender en mercados financieros, no se puede depositar en un banco, no genera intereses, no se puede especular con él. Es una unidad contable interna de la red.',
            badge: 'No es dinero',
          },
          {
            icon: 'x',
            title: 'No es criptomoneda',
            description:
              'El TQ no se mina, no tiene blockchain pública, no cotiza en exchanges, no tiene valor de mercado fluctuante. Su valor es fijo: 1 TQ siempre será 1 kWh de energía objetiva.',
            badge: 'No es cripto',
          },
          {
            icon: 'x',
            title: 'No genera intereses',
            description:
              'Tener saldo positivo no genera más TQ. Tener saldo negativo no genera deuda creciente. El sistema está diseñado para que la riqueza circule, no para que se acumule ni se concentre.',
            badge: 'Sin interés',
          },
          {
            icon: 'check',
            title: 'Es un registro contable',
            description:
              'El TQ es un registro transparente de quién aportó qué y quién recibió qué. La suma de todos los saldos siempre da cero. No hay emisión de moneda, no hay inflación, no hay devaluación. Solo hay registro honesto de intercambios.',
            badge: 'Registro contable',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '💡 Transparencia',
        title: '¿Quieres ver cómo se calcula un producto específico?',
        subtitle: 'Usa nuestra calculadora energética para ver el desglose de energía y precio de cualquier producto del catálogo. Puedes ver la energía directa, humana, de insumos y de amortización que hay en cada cosa que producimos.',
        button_text: 'Ver Catálogo de Productos',
        button_link: '/p/productos',
        theme: 'forest',
      },
    ],
  },
  {
    slug: 'federacion',
    title: 'Federación',
    subtitle: 'Suma tu ecoaldea a la red',
    icon: 'globe',
    menu_order: 95,
    blocks: [
      {
        type: 'hero',
        badge: '🌐 Plataforma Libre para Ecoaldeas y Comunidades',
        title: 'Red de Intercambio Federada',
        subtitle:
          'Un sistema gratuito y configurable que permite a cada ecoaldea gestionar su economía, gobernanza e intercambios, y federarse con otras comunidades en una red de comercio justo, sin inflación y sin intermediarios.',
        description:
          'Cada comunidad mantiene su autonomía, sus normas y su gobernanza, pero puede intercambiar con otras comunidades federadas de manera justa.',
        image_url: '/placeholder.svg',
        primary_cta: {
          text: 'Conocer más',
          link: '/p/filosofia',
        },
        secondary_cta: {
          text: 'Solicitar Ingreso',
          link: '/p/unirse',
        },
        style: 'split',
        bg_gradient: true,
      },
      {
        type: 'features_grid',
        title: '¿Qué es la Federación de Ecoaldeas?',
        subtitle:
          'Imagina lo que Visa y Mastercard hacen por los comercios: agruparlos en una red que permite intercambiar sin fronteras. Ahora imagina eso, pero para ecoaldeas, comunidades autogestionadas y redes de trueque.',
        columns: 3,
        items: [
          {
            icon: 'scale',
            title: 'Gobernanza configurable',
            description:
              'Cada comunidad define sus propias normas, asambleas, quórum, niveles de miembro y procesos de admisión.',
          },
          {
            icon: 'leaf',
            title: 'Economía propia',
            description:
              'Moneda comunitaria (TQ) basada en energía (kWh/Joule), no en dinero bancario. Sin inflación, sin interés.',
          },
          {
            icon: 'network',
            title: 'Federación entre nodos',
            description:
              'Intercambia con otras ecoaldeas federadas. Cada nodo respeta las normas internas de los demás.',
          },
          {
            icon: 'users',
            title: 'Comunidad autogestionada',
            description:
              'Organizaciones, departamentos, asambleas, votaciones, admisión de miembros y recuperación de cuentas.',
          },
          {
            icon: 'globe',
            title: 'Sitio web público',
            description:
              'Cada nodo tiene su propio sitio web configurable para mostrar productos, filosofía y contacto.',
          },
          {
            icon: 'heart',
            title: 'Gratis y abierto',
            description:
              'La plataforma es gratuita. Asesoría incluida. Abierta a aportes y mejoras desde la experiencia real.',
          },
        ],
      },
      {
        type: 'richtext',
        title: 'Beneficios de Federarse',
        subtitle: 'Por qué vale la pena unirse a la red de comunidades federadas',
        content:
          '<p>Mientras más ecoaldeas se federen, más versátil e independiente es la red. Cada ecoaldea tiene su propio sistema de comercio, pero puede intercambiar con todas las demás.</p><ul><li><strong>Sin inflación:</strong> La moneda comunitaria TQ se basa en consumo energético real (kWh/Joule), no en emisión arbitraria.</li><li><strong>Autonomía total:</strong> Cada comunidad mantiene sus normas, su gobernanza y su autonomía. La federación no se entromete en las decisiones internas de cada nodo.</li><li><strong>Comercio justo:</strong> Intercambio sin intermediarios. Los precios se calculan en base a energía, no a especulación.</li><li><strong>Identidad federada:</strong> Cada miembro se identifica con sus documentos. Al federar dos nodos, se detectan duplicados y ambas asambleas deciden cómo resolver.</li><li><strong>Gratis y con asesoría:</strong> La plataforma es gratuita. Incluye asesoría para implementar el sistema en tu ecoaldea.</li></ul>',
      },
      {
        type: 'richtext',
        title: 'Tres Niveles de Gobernanza',
        subtitle: 'El sistema tiene tres niveles de gobernanza, cada uno independiente internamente pero sujeto al nivel superior',
        content:
          '<h3>1. Federación (mundial)</h3><p>Decisiones que afectan a <strong>TODOS los nodos del mundo</strong>. Se deciden por votación igualitaria de todos los nodos federados: canasta básica TQ, límite de crédito global, expulsión de nodos, protocolo de comunicación, métrica de la moneda trueque, protocolo criptográfico NFC.</p><h3>2. Aldea / Nodo (local)</h3><p>Decisiones que afectan a <strong>toda la comunidad local</strong>. Se deciden por asamblea del nodo. Cada nodo es soberano: horas de trabajo, catálogo de productos, reglas de gobernanza interna, admisión de miembros, horarios, tasas, sitio web público, adaptaciones culturales.</p><h3>3. Organizaciones (dentro de la aldea)</h3><p>Decisiones que afectan <strong>solo dentro de la organización</strong>. Se deciden por la asamblea de la organización. Un nodo puede tener varias organizaciones: reglas internas, departamentos, asambleas de organización, roles y permisos internos.</p><p><strong>Consenso federado:</strong> Un nodo propone un cambio. Todos los nodos federados lo revisan y aprueban o rechazan. Por defecto se necesita el 100% (todos). Así nadie impone reglas unilateralmente.</p>',
      },
      {
        type: 'richtext',
        title: 'Piscina Global vs Piscinas Bilaterales',
        subtitle: 'Dos formas de manejar el saldo entre nodos federados',
        content:
          '<h3>Piscina Global (Multilateral)</h3><p>Un saldo compartido entre <strong>todos los nodos federados</strong>. Si comercias con el nodo B y ganas un saldo, puedes gastarlo con el nodo C. No está atado a un solo nodo. El límite depende del nivel del nodo.</p><h3>Piscinas Bilaterales</h3><p>Acuerdos específicos entre <strong>dos nodos</strong>. El saldo bilateral solo aplica entre esos dos nodos. <strong>No afecta la piscina global</strong>. Útil cuando dos nodos quieren un límite mayor del normal para su comercio.</p><p><strong>Cómo se decide:</strong> Si hay un acuerdo bilateral activo entre los dos nodos, la transacción va a la piscina bilateral. Si no hay acuerdo bilateral, va a la piscina global. Las transacciones bilaterales nunca afectan la piscina global y viceversa.</p>',
      },
      {
        type: 'richtext',
        title: 'Niveles de Nodo Federado',
        subtitle: 'Los nodos de la federación tienen niveles que determinan sus permisos, límites y derechos',
        content:
          '<h3>Nivel 1: Nodo Nuevo (Límite: 1000 TQ)</h3><p>Nodo recién ingresado. Tiene voz pero <strong>no tiene voto</strong> en propuestas federadas y <strong>no puede patrocinar</strong> nuevos nodos. Debe permanecer al menos 90 días antes de poder solicitar subida de nivel.</p><h3>Nivel 2: Nodo Aceptado (Límite: 5000 TQ)</h3><p>Nodo aprobado por asamblea federada. <strong>Con derecho a voto</strong> en propuestas federadas y <strong>puede patrocinar</strong> nuevos nodos. Debe permanecer al menos 180 días antes de poder subir a nivel 3.</p><h3>Nivel 3: Nodo Pleno (Límite: 20000 TQ)</h3><p>Nodo de plena confianza. Subida <strong>automática</strong> desde nivel 2 si cumple: mínimo 180 días en nivel 2, reciprocidad (tanto aporta como recibe), y límite promedio superior a la mitad del limite actual.</p><p><strong>Subida de nivel:</strong> Nivel 1 a 2 requiere votación federada. Nivel 2 a 3 es automático si cumple reciprocidad + límite promedio.</p>',
      },
      {
        type: 'richtext',
        title: 'Sistema de Padrino (Patrocinador)',
        subtitle: 'Cuando un nodo nuevo quiere entrar a la federación, necesita un padrino: un nodo nivel 2+ que lo respalda',
        content:
          '<p>Un nodo nivel 2+ acepta ser el padrino del nodo nuevo. El nodo nuevo entra a nivel 1 con su límite (ej: 1000 TQ). El límite del padrino se <strong>reduce</strong> en el mismo monto. El padrino es <strong>responsable</strong> del nodo nuevo. Si el nodo nuevo entra en default, la <strong>deuda pasa al padrino</strong>. Cuando el nodo sube a nivel 2, el límite del padrino se <strong>libera</strong>.</p><p><strong>Ejemplo:</strong> El nodo A (nivel 2, límite 5000 TQ) patrocina al nodo B (nuevo, 1000 TQ). Límite efectivo de A: 4000 TQ. A puede patrocinar hasta 4 nodos. Si B sube a nivel 2, A recupera sus 1000 TQ. Si B entra en default, A asume la deuda de B.</p><p><strong>Por qué el sistema de padrino:</strong> Evita que cualquier nodo entre a la federación sin responsabilidad. El padrino arriesga su propio límite y responde por el nodo nuevo.</p>',
      },
      {
        type: 'richtext',
        title: 'Verificación de 4 Opciones',
        subtitle: 'Para unirse a la federación o emparejar un terminal POS, usamos un sistema que obliga a comunicarse fuera de banda',
        content:
          '<p>1. El nodo nuevo genera un código de 6 dígitos.<br>2. En la pantalla del padrino aparecen 4 códigos. Solo uno es el correcto.<br>3. El nodo nuevo le dice el código correcto al padrino por teléfono, mensaje o en persona.<br>4. Si el padrino elige bien, el nodo entra a la federación. Si elige mal, se rechaza. El código expira en 60 segundos.</p><p><strong>Por qué 4 opciones:</strong> Si ambos lados ven el mismo código en pantalla, un atacante en el medio podría interceptar la conexión. Con 4 opciones, el atacante tiene que adivinar (25% de probabilidad). Obligar a comunicar el código por otro canal hace que el atacante no pueda engañar a ningún lado.</p>',
      },
      {
        type: 'richtext',
        title: 'Integridad Distribuida',
        subtitle: 'Cómo garantizamos que las transacciones entre nodos sean válidas y que nadie haga trampa',
        content:
          '<h3>Firma Dual</h3><p>Cada transacción entre nodos debe ser firmada por <strong>AMBOS nodos</strong> con sus claves criptográficas. El nodo A crea y firma la transacción. El nodo B verifica la firma de A, firma también, y devuelve la transacción dual-firmada. Una transacción sin ambas firmas <strong>no es válida</strong>.</p><h3>Hash Encadenado</h3><p>Cada transacción incluye el hash de la transacción anterior (como una blockchain simplificada). Si alguien intenta insertar, modificar o eliminar una transacción, la cadena se rompe y se detecta inmediatamente.</p><p><strong>Reconciliación al reconectar:</strong> Cuando un nodo que estaba offline se reconecta, compara los hashes de su cadena con los del otro nodo. Si coinciden, están sincronizados. Si no, intercambian las transacciones divergentes, verifican las firmas y los hashes, e incorporan las válidas.</p>',
      },
      {
        type: 'features_grid',
        title: '¿Qué incluye el sistema actualmente?',
        subtitle: 'Funcionalidades completas disponibles en la plataforma',
        columns: 3,
        items: [
          { icon: 'check', title: 'Gestión de miembros', description: 'Niveles, admisión con documentos, recuperación de cuentas (multisig).' },
          { icon: 'check', title: 'Asambleas y votaciones', description: 'Propuestas, debates, quórum configurable, votaciones transparentes.' },
          { icon: 'check', title: 'Intercambios TQ', description: 'Crédito mutuo basado en energía. Sin inflación, sin interés.' },
          { icon: 'check', title: 'Catálogo de productos', description: 'Precios energéticos calculados por kWh/Joule.' },
          { icon: 'check', title: 'App Android POS', description: 'Cobro QR + NFC. POS web para iPhone/computadoras.' },
          { icon: 'check', title: 'Federación entre nodos', description: 'Piscina global multilateral + piscinas bilaterales.' },
          { icon: 'check', title: 'Niveles de nodo federado', description: 'Nuevo, Aceptado, Pleno. Sistema de padrino responsable.' },
          { icon: 'check', title: 'Seguridad distribuida', description: 'Firma dual + hash encadenado. Verificación anti-MITM de 4 opciones.' },
          { icon: 'check', title: 'Sitio web público', description: 'Configurable con editor visual en vivo. Gobernanza configurable por nodo.' },
          { icon: 'check', title: 'Comercio exterior', description: 'Conversión con 20 monedas locales. Factor de conversión configurable.' },
          { icon: 'check', title: 'Internet paralelo', description: 'Cifrado WireGuard. Intranet local off-grid con OpenWrt.' },
          { icon: 'check', title: 'Servicios federados', description: 'Matrix, Nextcloud, VoIP y más con un solo clic.' },
        ],
      },
      {
        type: 'faq',
        title: 'Preguntas Frecuentes sobre la Federación',
        subtitle: 'Resolvemos las dudas más comunes sobre cómo funciona la red de comunidades federadas',
        items: [
          {
            question: '¿Para qué sirve federarse? ¿No es mejor que cada comunidad funcione sola?',
            answer:
              'Cada comunidad es autónoma y toma sus propias decisiones internas. Pero federarse tiene ventajas: puedes intercambiar con miembros de otras comunidades, el espectro de lo que puedes aportar y recibir se amplía, y las comunidades se apoyan mutuamente. Una comunidad sola es frágil; una red de comunidades es robusta.',
          },
          {
            question: '¿Tengo que aportar algo para entrar a una comunidad federada?',
            answer:
              'Sí. Para entrar tienes que tener algo que aportar: productos, trabajo, talentos, servicios, o conocimientos. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar.',
          },
          {
            question: '¿Por qué el saldo perfecto es cero?',
            answer:
              'Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si está muy negativo, estás recibiendo mucho pero aportando poco. Si está muy positivo, estás aportando mucho pero no aprovechando lo que la comunidad ofrece.',
          },
          {
            question: '¿Puedo usar mi saldo TQ en otra comunidad de la federación?',
            answer:
              'Sí. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir.',
          },
          {
            question: '¿La moneda TQ tiene inflación?',
            answer:
              'No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años.',
          },
          {
            question: '¿Mi comunidad tiene que pagar para usar el software?',
            answer:
              'No. El software es 100% gratuito y de código abierto. Cualquier comunidad puede instalarlo, usarlo, y adaptarlo sin pagar licencias.',
          },
          {
            question: '¿La federación funciona sin internet?',
            answer:
              'La federación puede funcionar por Internet público o por intranet comunitaria usando túneles WireGuard. Incluso comunidades sin acceso a Internet pueden federarse si instalan OpenWrt y configuran los túneles.',
          },
          {
            question: '¿Quién gobierna la federación?',
            answer:
              'La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás.',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🌾 Únete a la Red',
        title: '¿Tienes una ecoaldea o quieres fundar una?',
        subtitle:
          'La plataforma está en pleno desarrollo y queremos que se adapte a las necesidades de cada comunidad. Escríbenos para conversar sobre tu experiencia y ver cómo podemos integrarnos.',
        button_text: 'Solicitar Ingreso',
        button_link: '/p/unirse',
        secondary_text: 'Ver Filosofía',
        secondary_link: '/p/filosofia',
        theme: 'forest',
      },
    ],
  },
]

export const FERIA_CONUQUERA_TEMPLATES_EN: PreconfiguredPageTemplate[] = [
  {
    slug: 'inicio',
    title: 'Home',
    subtitle: 'Open-Air Market and Food Sovereignty Network',
    icon: 'home',
    menu_order: 1,
    blocks: [
      {
        type: 'hero',
        badge: '🌱 Open-Air Market',
        title: 'Our Community',
        subtitle: 'Fresh harvest, healthy food and peasant knowledge for the entire community.',
        description:
          'We open our open-air market to the general public in local currency. A self-managed space where you buy directly from the producer without intermediaries or agrochemicals, and where network members also trade in barter and mutual credit.',
        image_url: '/placeholder.svg',
        primary_cta: {
          text: 'View Products Catalog',
          link: '/p/productos',
        },
        secondary_cta: {
          text: 'Hours and Location',
          link: '/p/contacto',
        },
        style: 'split',
      },
      {
        type: 'event_schedule',
        badge: '📍 Market Open to the General Public',
        title: 'Monthly Gathering',
        date_text: '',
        time_text: '',
        location_name: '',
        address: '',
        guidelines: [
          'Open sale to the general public in local currency (no membership required to purchase).',
          'No single-use plastic bags allowed: bring your backpack, cloth bag or basket.',
          'Open barter of native and heritage seeds among farmers and neighbors.',
          'Donate and adopt a book area for free reading exchange.',
          'Live learning workshops (vermicomposting, bio-inputs, botanical health).',
          'Folk music, cultural activities and games for children.',
          'Barter and mutual credit system available for registered members.',
        ],
        cta_text: 'Apply for Membership as Producer or Member',
        cta_link: '/p/unirse',
      },
      {
        type: 'stats',
        title: 'Building Popular Sovereignty',
        subtitle: 'Real figures of an autonomous community movement.',
        bg_theme: 'primary',
        items: [
          {
            value: '+10 Years',
            label: 'Continuous Gathering',
            description: 'Monthly open-air market since our beginnings',
          },
          {
            value: '+45 Collectives',
            label: 'Producer Families',
            description: 'Diverse producing communities',
          },
          {
            value: '0% Agrochemicals',
            label: '100% Clean Production',
            description: 'Living soils, organic fertilizers and ancestral seeds',
          },
          {
            value: 'Open Sales',
            label: 'Local Currency & Barter',
            description: 'Open to everyone with barter option for network members',
          },
        ],
      },
      {
        type: 'carousel',
        title: 'Living Gallery of Our Gatherings',
        subtitle: 'Moments from our market days, workshops, culture and solidarity barter in every edition.',
        autoplay: true,
        items: [
          {
            image_url: '/placeholder.svg',
            title: 'Fresh Vegetables and Ancestral Crops',
            caption: 'Harvested at dawn for direct sale in local currency.',
            tag: 'Daily Harvest',
          },
          {
            image_url: '/placeholder.svg',
            title: 'Community Apothecary and Traditional Medicine',
            caption: 'Propolis tinctures, botanical ointments, essential oils and medicinal herbs.',
            tag: 'Botanical Health',
          },
          {
            image_url: '/placeholder.svg',
            title: 'Artisanal and Ancestral Gastronomy',
            caption: 'Traditional Cafunga, gluten-free flours, pure cocoa and mountain coffee.',
            tag: 'Sovereign Flavors',
          },
          {
            image_url: '/placeholder.svg',
            title: 'Live Workshops & Seed Barter',
            caption: 'Solidarity exchange of knowledge, native seeds and books for the whole community.',
            tag: 'Popular Education',
          },
        ],
      },
      {
        type: 'features_grid',
        title: 'Network Dynamics and Organization',
        subtitle: 'How our community works both at the monthly market and in its internal democratic life.',
        columns: 3,
        items: [
          {
            icon: 'shopping-cart',
            title: 'Monthly Open-Air Market',
            description:
              'Direct sale to the general public in local currency at every monthly meeting. No middlemen or usury.',
            badge: 'Public Sales',
          },
          {
            icon: 'scale',
            title: 'Barter & Mutual Credit',
            description:
              'Network members can exchange products and labor through the zero-sum accounting system (1 TQ = 1 kWh).',
            badge: 'For Members',
          },
          {
            icon: 'users',
            title: 'Quarterly Assemblies',
            description:
              'Governance meetings every 3 months where members decide on admissions, taxes, fund distribution, and policies.',
            badge: 'Governance',
          },
          {
            icon: 'leaf',
            title: 'Workshops & Popular Education',
            description:
              'Open educational spaces during the fair and field visits to conucos on vermiculture, bio-inputs, and agroecology.',
            badge: 'Education',
          },
          {
            icon: 'heart',
            title: 'Culture, Music & Community',
            description:
              'Musical performances, folk poetry, children activities, and community meals at each edition.',
            badge: 'Living Culture',
          },
          {
            icon: 'home',
            title: 'Work Commissions & Field Cayapas',
            description:
              'Collective labor outside the park: thematic working groups, technical conuco visits, and ecovillage networking.',
            badge: 'Community',
          },
        ],
      },
      {
        type: 'cta_banner',
        badge: '🤝 Join the Network',
        title: 'Are you an agroecological producer or looking to join?',
        subtitle:
          'Anyone can buy at the fair. If you wish to join as a producer or take part in assemblies and barter, submit your application to the assembly.',
        button_text: 'Complete Admission Application',
        button_link: '/p/unirse',
        secondary_text: 'Frequently Asked Questions',
        secondary_link: '/p/faq',
        theme: 'forest',
      },
      {
        type: 'cta_banner',
        badge: '🖥️ Try the System',
        title: 'Want to see how a node works from the inside?',
        subtitle:
          'Start a demo node and explore the full platform: catalog, calculator, assemblies, governance, NFC cards and more. No registration, no commitment.',
        button_text: 'Go to Demo Node',
        button_link: '/p/federacion',
        secondary_text: 'View Federation Page',
        secondary_link: '/p/federacion',
        theme: 'primary',
      },
    ],
  },
]

export function getPreconfiguredTemplate(slug: string, lang = 'es'): PreconfiguredPageTemplate | undefined {
  if (lang && lang.toLowerCase().startsWith('en')) {
    const enTmpl = FERIA_CONUQUERA_TEMPLATES_EN.find((t) => t.slug === slug)
    if (enTmpl) return enTmpl
  }
  return FERIA_CONUQUERA_TEMPLATES.find((t) => t.slug === slug)
}
