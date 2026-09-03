import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sprout, Sun, Heart, BookOpen, Clock, Users, Globe, Zap, Leaf, Shield,
  ArrowRight, ChevronDown, ChevronUp, Search, Home, Wheat, Star,
  Moon, TreePine, HandHeart, Scale, Flower, Mountain, Sparkles,
  CheckCircle, AlertCircle, Circle, ScrollText, type LucideIcon,
} from 'lucide-react'
import { api } from '../api'

type FeatureStatus = 'exists' | 'partial' | 'missing'

interface Adaptation {
  icon: LucideIcon
  title: string
  description: string
  feature: string
  status: FeatureStatus
  sourceRef?: string
  biblicalRef?: string
}

interface CommunityGroup {
  id: string
  name: string
  icon: LucideIcon
  color: string
  bgColor: string
  category: string
  description: string
  adaptations: Adaptation[]
}

const statusConfig: Record<FeatureStatus, { label: string; icon: LucideIcon; color: string }> = {
  exists: { label: 'Disponible', icon: CheckCircle, color: 'text-emerald-600' },
  partial: { label: 'Parcial', icon: AlertCircle, color: 'text-amber-600' },
  missing: { label: 'En desarrollo', icon: Circle, color: 'text-gray-400' },
}

const groups: CommunityGroup[] = [
  // ==================== CRISTIANAS ====================
  {
    id: 'adventistas',
    name: 'Adventistas del Séptimo Día',
    icon: BookOpen,
    color: 'text-blue-800',
    bgColor: 'bg-blue-50',
    category: 'Cristianas',
    description: 'Comunidades adventistas que siguen los consejos de Elena G. de White sobre la vida en el campo, el sostén propio y los puestos de avanzada. Fundación Las Delicias (Nirgua, Barquisimeto, Colombia).',
    adaptations: [
      {
        icon: Clock,
        title: 'Bloqueo Automático del Sábado (Sabbath Lock)',
        description: 'El sistema bloquea automáticamente todas las transacciones desde la puesta del sol del viernes hasta la puesta del sol del sábado. Cada nodo configura sus horarios. Respeto del cuarto mandamiento sin intervención manual.',
        feature: 'Horarios de Comercio Configurables',
        status: 'exists',
        biblicalRef: 'Éxodo 20:8-11 — "Acuérdate del día de reposo para santificarlo"',
        sourceRef: 'Nehemías 13:15-22 — Nehemías cerró las puertas el sábado para impedir el comercio',
      },
      {
        icon: Shield,
        title: 'Soberanía Económica Off-Grid',
        description: 'El sistema funciona sin internet mediante intranet local en el campo. Las familias que salieron de las ciudades pueden intercambiar alimentos, herramientas y servicios sin depender del sistema financiero tradicional.',
        feature: 'Intranet Local + Tarjetas NFC',
        status: 'exists',
        biblicalRef: 'Apocalipsis 13:17 — "que nadie pueda comprar ni vender"',
        sourceRef: 'Elena G. de White, Mensajes Selectos, Tomo 2, pág. 161 — "el problema de comprar y vender será muy serio"',
      },
      {
        icon: Sprout,
        title: 'Puestos de Avanzada Autónomos',
        description: 'Cada nodo funciona como un puesto de avanzada independiente. La Fundación Las Delicias puede tener nodos en Nirgua, Barquisimeto y Colombia, federados pero autónomos.',
        feature: 'Federación de Nodos Autónomos',
        status: 'exists',
        sourceRef: 'Elena G. de White, De la Ciudad al Campo — "trabajar en favor de las ciudades desde puestos de avanzada"',
      },
      {
        icon: Heart,
        title: 'Mayordomía sin Usura ni Inflación',
        description: 'El Trueque TQ está anclado al trabajo real (1 TQ = 1 kWh). No genera intereses ni sufre inflación. Contabilidad de saldo cero: dar tanto como se recibe.',
        feature: 'Crédito Mutuo de Saldo Cero',
        status: 'exists',
        biblicalRef: 'Génesis 3:19 — "Con el sudor de tu frente comerás el pan"',
      },
      {
        icon: Users,
        title: 'Gobernanza por Asamblea',
        description: 'Módulo de asambleas con votaciones digitales. Cada nodo configura sus niveles de aprobación. Decisiones por consentimiento, no por mayoría tiránica.',
        feature: 'Asambleas Digitales con Votaciones',
        status: 'exists',
      },
      {
        icon: Leaf,
        title: 'Agroecología y Salud Natural',
        description: 'Catálogo de productos agroecológicos, banco de semillas y registro de prácticas. Compatible con la filosofía adventista de salud natural y alimentación vegetariana.',
        feature: 'Catálogo de Productos + Banco de Semillas',
        status: 'exists',
        sourceRef: 'Fundación Las Delicias — "Solo en 2024, se atendieron 250 pacientes" (fundacionlasdelicias.org)',
      },
      {
        icon: Globe,
        title: 'Federación Internacional',
        description: 'La Fundación Las Delicias tiene presencia en Venezuela, Bolivia, RD y Colombia. El sistema federa todos estos nodos en una red única.',
        feature: 'Federación Multi-Nodo Internacional',
        status: 'exists',
        sourceRef: 'fundacionlasdelicias.org/areas-fld — FLD Venezuela, Bolivia, RD, Vida Plena (Guambia), Fundación el Encanto',
      },
      {
        icon: Zap,
        title: 'Preconfiguración Adventista',
        description: 'Al instalar un nodo nuevo, se puede elegir la preconfiguración adventista que carga automáticamente horarios de Sabbath, textos, gobernanza y catálogo acordes.',
        feature: 'Sistema de Preconfiguraciones',
        status: 'missing',
      },
    ],
  },
  {
    id: 'amish',
    name: 'Amish / Menonitas Conservadores',
    icon: Home,
    color: 'text-amber-800',
    bgColor: 'bg-amber-50',
    category: 'Cristianas',
    description: 'Plain Sects que viven apartados del mundo moderno. Tracción animal, sin celulares, cooperativas agropecuarias masivas. Ordnung (reglas locales por consenso de ancianos).',
    adaptations: [
      {
        icon: Zap,
        title: 'Tótem NFC Fijo sin Teléfono',
        description: 'Como su fe prohíbe celulares personales, el sistema requiere un terminal físico fijo en el galpón de trueque. El agricultor acerca su llavero NFC al entregar productos, sin necesidad de teléfono.',
        feature: 'Terminal NFC Comunitario Fijo',
        status: 'partial',
        sourceRef: 'Green Field Farms — cooperativa Amish de subastas de vegetales',
      },
      {
        icon: Leaf,
        title: 'Calculadora de Tracción Animal',
        description: 'Adaptar la calculadora de energía para computar el esfuerzo de bueyes y caballos en lugar de tractores, convirtiendo la termodinámica del forraje animal en saldo TQ.',
        feature: 'Calculadora con Tracción Animal',
        status: 'missing',
      },
      {
        icon: Scale,
        title: 'Ordnung Digital (Reglas por Consenso)',
        description: 'El sistema de gobernanza puede reflejar el Ordnung: reglas locales aprobadas por consenso de ancianos, configurables por nodo y modificables solo por asamblea.',
        feature: 'Gobernanza Configurable por Nodo',
        status: 'exists',
      },
      {
        icon: Sprout,
        title: 'Cooperativa de Subastas',
        description: 'El sistema puede gestionar subastas colectivas de productos agropecuarios entre múltiples granjas, como lo hacen los Amish con Green Field Farms.',
        feature: 'Catálogo + Ventas Colectivas',
        status: 'partial',
      },
    ],
  },
  {
    id: 'hutteritas',
    name: 'Hutteritas',
    icon: Wheat,
    color: 'text-stone-700',
    bgColor: 'bg-stone-50',
    category: 'Cristianas',
    description: 'Colonias comunales de ~100 personas. Bienes en común, agricultura mecanizada. Montana, Dakota del Sur, Alberta, Saskatchewan. La comunidad religiosa comunal más longeva de Norteamérica.',
    adaptations: [
      {
        icon: Users,
        title: 'Contabilidad Departamental sin Cuentas Personales',
        description: 'Como internamente no usan dinero personal, el sistema registra el aporte y gasto energético de cada departamento (granja, taller, cocina) sin cuentas individuales.',
        feature: 'Contabilidad Departamental de Energía',
        status: 'missing',
        sourceRef: 'hutterites.org — "All members living in one colony own the assets collectively"',
      },
      {
        icon: Scale,
        title: 'Gobernanza Democrática por Consenso',
        description: 'Las decisiones mayores se toman por voto de todos los miembros afectados. El sistema digitaliza este proceso respetando la estructura democrática hutterita.',
        feature: 'Asambleas con Votación Digital',
        status: 'exists',
        sourceRef: 'Essential Understandings Regarding Hutterites — "all major decisions are made by the people"',
      },
      {
        icon: Sprout,
        title: 'Gestión de Colonia Agrícola',
        description: 'El sistema gestiona la producción agrícola de la colonia: granos, ganado, aves, lácteos. Registro de producción y distribución interna.',
        feature: 'Catálogo de Productos + Inventario',
        status: 'exists',
      },
    ],
  },
  {
    id: 'bruderhof',
    name: 'Bruderhof (Camino del Hermano)',
    icon: HandHeart,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    category: 'Cristianas',
    description: 'Movimiento cristiano de bienes comunes basado en Hechos 2:44. Sin propiedad privada. Agricultura regenerativa + manufactura (Community Playthings, Rifton Equipment).',
    adaptations: [
      {
        icon: Users,
        title: 'Contabilidad Departamental de Energía',
        description: 'No necesitan cuentas personales. El sistema audita el gasto energético de cada departamento: cuánto gastó el taller de madera vs. cuánta energía aportó la granja.',
        feature: 'Contabilidad Departamental',
        status: 'missing',
        sourceRef: 'plough.com — Bellvale Bruderhof, comunidad de ~200 personas con granja regenerativa',
      },
      {
        icon: Sprout,
        title: 'Agricultura Regenerativa Comunitaria',
        description: 'El sistema gestiona la planificación de cultivos para 200+ personas: qué sembrar, cuándo cosechar, coordinación de jornadas comunitarias de siembra y recolección.',
        feature: 'Planificación Agrícola + Jornadas Comunitarias',
        status: 'partial',
      },
      {
        icon: Scale,
        title: 'Consenso Fraternal',
        description: 'Las decisiones se toman por consenso fraternal y espiritual. El sistema de asambleas soporta este modelo con votaciones de consentimiento.',
        feature: 'Asambleas por Consentimiento',
        status: 'exists',
        sourceRef: 'Hechos 2:44 — "Todos los que creían estaban juntos y tenían todas las cosas en común"',
      },
    ],
  },
  {
    id: 'camphill',
    name: 'Camphill (Antroposófica)',
    icon: Flower,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    category: 'Cristianas',
    description: 'Comunidades de inspiración antroposófica (Rudolf Steiner) donde personas con discapacidades intelectuales y terapeutas viven y trabajan juntos. Agricultura biodinámica, panadería de masa madre, velas de cera de abeja. El trabajo es terapia dignificante, no mercancía.',
    adaptations: [
      {
        icon: Users,
        title: 'Contabilidad de Economía Asociativa',
        description: 'El trabajo de cuidado y terapia se mide equiparablemente con la producción de pan o vegetales. El sistema registra el valor de las sesiones terapéuticas y de cuidado como energía vital intercambiable.',
        feature: 'Contabilidad Departamental + Valoración de Cuidado',
        status: 'partial',
        sourceRef: 'camphill.org — "Camphill communities where people with and without disabilities live, work, and celebrate life together"',
      },
      {
        icon: Sprout,
        title: 'Agricultura Biodinámica',
        description: 'Calendario biodinámico con dias de raiz, flor, hoja y fruto segun constelaciones. Configurable por nodo, visible en pagina publica si se activa.',
        feature: 'Planificación Biodinámica',
        status: 'exists',
        sourceRef: 'camphill.org/biodynamic-farming — "Camphill communities have been practicing biodynamic agriculture for decades"',
      },
      {
        icon: Scale,
        title: 'Decisiones por Consenso Armonioso',
        description: 'Estructura horizontal basada en consensos de armonía social. El sistema de asambleas soporta este modelo con votaciones de consentimiento.',
        feature: 'Asambleas por Consentimiento',
        status: 'exists',
      },
    ],
  },
  {
    id: 'cuáqueros',
    name: 'Cuáqueros (Quakers)',
    icon: Heart,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    category: 'Cristianas',
    description: 'Comunidades intencionales cuáqueras (QIVC Nueva York, Quaker Settlement Nueva Zelanda). Simplicidad, testimonio de paz, escucha profunda, la tierra como guardia no como propiedad.',
    adaptations: [
      {
        icon: Users,
        title: 'Consenso Espiritual (Quaker Process)',
        description: 'El sistema de asambleas soporta el proceso cuáquero: discernimiento espiritual, escucha profunda, búsqueda de la unidad guiada por el Espíritu.',
        feature: 'Asambleas con Consenso Espiritual',
        status: 'exists',
        sourceRef: 'qivc.org — "We use Quaker processes in our self-government, including a form of consensus that seeks a spiritually led way forward"',
      },
      {
        icon: Leaf,
        title: 'Agricultura Orgánica y CSA',
        description: 'El sistema gestiona suscripciones CSA (Community Supported Agriculture) y producción orgánica, como hacen en QIVC con 135 acres de bosque y pasto.',
        feature: 'Catálogo + Modelo CSA',
        status: 'partial',
        sourceRef: 'QIVC — "Many of us grow food on our land organically, raise chickens, and produce piles of pesto"',
      },
      {
        icon: Shield,
        title: 'Guardia de la Tierra (no propiedad)',
        description: 'El sistema puede reflejar la filosofía cuáquera de "guardia"而非 "propiedad" de la tierra, con categorías de uso y stewardship comunitario.',
        feature: 'Categorías de Uso de Tierra',
        status: 'missing',
      },
    ],
  },
  {
    id: 'catholic-land',
    name: 'Catholic Land Movement',
    icon: Home,
    color: 'text-purple-800',
    bgColor: 'bg-purple-50',
    category: 'Cristianas',
    description: 'Resurgimiento del movimiento católico de retorno al campo. 80+ capítulos en EE.UU. y Canadá. Homesteading familiar basado en Rerum Novarum y Mater et Magistra.',
    adaptations: [
      {
        icon: Sprout,
        title: 'Homesteading Familiar',
        description: 'El sistema gestiona la producción familiar: huerto, gallinas, conservas, panadería. Cada familia es una unidad productora que intercambia con otras.',
        feature: 'Cuentas Familiares + Catálogo',
        status: 'exists',
        sourceRef: 'ncregister.com — "Catholic Land Movement, a project that began in the early-20th century and received an apostolic blessing from Pope Pius XI in 1933"',
      },
      {
        icon: Users,
        title: 'Asociaciones de Tierra Católica',
        description: 'El sistema federa grupos de familias católicas en una misma zona, permitiendo intercambios entre homesteads y compras colectivas de insumos.',
        feature: 'Federación de Nodos Familiares',
        status: 'exists',
        sourceRef: 'Papa Juan XXIII, Mater et Magistra (1961) — "Those who live on the land can hardly fail to appreciate the nobility of the work"',
      },
      {
        icon: Heart,
        title: 'Economía de Donación y Caridad',
        description: 'El sistema soporta donaciones de excedentes a familias necesitadas, reflejando el principio católico de opción preferencial por los pobres.',
        feature: 'Donaciones + Fondo Comunitario',
        status: 'exists',
      },
    ],
  },
  {
    id: 'monasterios',
    name: 'Monasterios (Trapenses / Ortodoxos / Monte Athos)',
    icon: Mountain,
    color: 'text-indigo-800',
    bgColor: 'bg-indigo-50',
    category: 'Cristianas',
    description: 'Monasterios autosuficientes con agricultura orgánica: New Clairvaux (viña), Boulaur (granja Cisterciense), Plankstetten (350 ha), Monte Athos/Vatopedi (110 ha orgánicas). "El trabajo es oración".',
    adaptations: [
      {
        icon: Sprout,
        title: 'Agricultura Litúrgica',
        description: 'El sistema sigue el calendario litúrgico para planificar siembra y cosecha. Las tareas agrícolas se registran como extensión de la oración.',
        feature: 'Calendario Litúrgico + Planificación',
        status: 'missing',
        sourceRef: 'winesofmountathos.eu — "Agricultural tasks follow the liturgical calendar, reinforcing the link between natural cycles and religious observance"',
      },
      {
        icon: Leaf,
        title: 'Certificación Orgánica Interna',
        description: 'El sistema registra prácticas orgánicas/biodinámicas para certificación: compost, rotación, sin químicos. Compatible con Bioland, Demeter, Naturland.',
        feature: 'Registro de Prácticas Orgánicas',
        status: 'partial',
        sourceRef: 'Vatopedi Monastery — "110 hectares cultivated, all certified organic" (olixoil.com)',
      },
      {
        icon: Clock,
        title: 'Horarios de Ayuno y Abstinencia',
        description: 'El sistema puede bloquear ciertos productos (carne, lácteos) durante períodos de ayuno litúrgico (Cuaresma, Adviento, días de abstinencia).',
        feature: 'Filtros Dietéticos por Calendario',
        status: 'missing',
      },
    ],
  },
  {
    id: 'twelve-tribes',
    name: 'Twelve Tribes (Rastafari Mesiánico)',
    icon: Star,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    category: 'Cristianas',
    description: 'Comunidades Rastafari mesiánicas con bienes comunes (Hechos 2:44). Common Sense Farm, Basin Farm. Dieta Ital, agricultura orgánica, lectura diaria de la Biblia.',
    adaptations: [
      {
        icon: Leaf,
        title: 'Dieta Ital (Filtros Dietéticos)',
        description: 'El sistema puede prohibir productos no-Ital: carne, alcohol, alimentos procesados. Solo permite productos naturales y orgánicos.',
        feature: 'Filtros Dietéticos del Catálogo',
        status: 'missing',
        sourceRef: 'twelvetribes.org/farms — "We grow good healthy food for our people and for our neighbors"',
      },
      {
        icon: Users,
        title: 'Bienes en Común (Common Purse)',
        description: 'Todo el ingreso va a una bolsa común. El sistema gestiona la distribución comunitaria sin cuentas personales individuales.',
        feature: 'Contabilidad Departamental + Fondo Común',
        status: 'missing',
        sourceRef: 'twelvetribes.org — "All of the income from our various endeavors goes into a common purse"',
      },
      {
        icon: Sprout,
        title: 'Granja Orgánica Comunitaria',
        description: 'El sistema gestiona la producción agrícola comunitaria y la venta en farmstands y mercados de agricultores.',
        feature: 'Catálogo + Punto de Venta',
        status: 'exists',
      },
    ],
  },

  // ==================== ISLÁMICAS ====================
  {
    id: 'muridiyya',
    name: 'Muridiyya / Baye Fall (Senegal)',
    icon: Moon,
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    category: 'Islámicas',
    description: 'Rama de la hermandad Murid del Senegal. "El trabajo es oración". Oasis en el Sahel: Ndem, Mbakke Kajoor. Agricultura orgánica, solar, permacultura. 4.600 miembros en Ndem.',
    adaptations: [
      {
        icon: Zap,
        title: 'Trabajo como Oración',
        description: 'El sistema registra el trabajo agrícola como acto espiritual. Cada jornada se documenta con su propósito espiritual y su aporte energético.',
        feature: 'Registro de Jornadas con Propósito',
        status: 'partial',
        sourceRef: 'Reuters — "members of Baye Fall, a branch of Senegal\'s Muslim Mouride brotherhood who believe that labour is a form of prayer"',
      },
      {
        icon: Sun,
        title: 'Energía Solar Off-Grid',
        description: 'El sistema funciona con energía solar, como Ndem que usa sistemas de irrigación con energía solar en el Sahel.',
        feature: 'Intranet Local + NFC + Solar',
        status: 'exists',
        sourceRef: 'Reuters — "they have created an oasis in a region long plagued by drought" with "irrigation systems and solar power"',
      },
      {
        icon: Leaf,
        title: 'Permacultura en Zona Árida',
        description: 'El sistema gestiona cultivos adaptados al Sahel: baobab, millet, hortalizas con goteo. Registro de prácticas de permacultura desertíca.',
        feature: 'Catálogo + Registro de Prácticas',
        status: 'exists',
        sourceRef: 'Cambridge — "Sufi communities in Senegal that integrate environmental work and spirituality"',
      },
    ],
  },
  {
    id: 'oasis-sufi',
    name: 'Oasis Sufí Maaden (Mauritania)',
    icon: Moon,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    category: 'Islámicas',
    description: 'Oasis en el desierto de Mauritania fundado en 1975 por Mohammed Lemine Sidina. Igualdad sin castas, agricultura con goteo, compost, solar. Influenciado por Pierre Rabhi.',
    adaptations: [
      {
        icon: Users,
        title: 'Igualdad sin Castas ni Razas',
        description: 'El sistema no tiene jerarquías hereditarias. Todos los miembros son iguales. La gobernanza es horizontal y comunitaria.',
        feature: 'Gobernanza Horizontal Igualitaria',
        status: 'exists',
        sourceRef: 'France24 — "Here, there is equality. No caste, no race" — Djibril Niang, residente de Maaden',
      },
      {
        icon: Sprout,
        title: 'Agricultura con Goteo y Compost',
        description: 'El sistema registra prácticas de agricultura desertíca: goteo, compost (sin químicos), rotación. Compatible con los métodos de Pierre Rabhi.',
        feature: 'Registro de Prácticas Agroecológicas',
        status: 'partial',
        sourceRef: 'France24 — "Compost replaced chemical fertilisers and solar panels took over from fuel-powered motor pumps"',
      },
      {
        icon: Users,
        title: 'Asamblea Vespertina de Planificación',
        description: 'Cada noche la comunidad se reúne para planificar el día siguiente. El sistema digitaliza esta asamblea diaria de planificación comunitaria.',
        feature: 'Asambleas Diarias de Planificación',
        status: 'exists',
        sourceRef: 'France24 — "Every evening, the community would get together to plan the next day\'s programme"',
      },
    ],
  },
  {
    id: 'granjas-halal',
    name: 'Granjas Halal (Willowbrook / Harmony)',
    icon: Leaf,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    category: 'Islámicas',
    description: 'Granjas halal y tayyib en UK y otros países. Khilafah (custodia de la tierra), sin pesticidas, bienestar animal. Willowbrook Farm (Oxfordshire), Harmony Farm (Gales).',
    adaptations: [
      {
        icon: Leaf,
        title: 'Certificación Halal y Tayyib',
        description: 'El sistema etiqueta productos como halal y tayyib (puro, orgánico). Registro de prácticas de bienestar animal sin sacrificio industrial.',
        feature: 'Etiquetas de Certificación + Catálogo',
        status: 'partial',
        sourceRef: 'Willowbrook Farm — "Halal and Tayib farm. Farming in harmony with nature, guided by the Islamic concept of stewardship (khilafah)"',
      },
      {
        icon: Leaf,
        title: 'Agricultura sin Pesticidas',
        description: 'El sistema registra y certifica que no se usan pesticidas, reflejando el principio islámico de custodia de cada criatura.',
        feature: 'Registro de Prácticas Orgánicas',
        status: 'partial',
        sourceRef: 'Harmony Farm — "There is the Islamic principle that we are custodians of the earth, and that we are responsible for every bug, every rock and tree"',
      },
      {
        icon: Sprout,
        title: 'Permacultura Islámica',
        description: 'El sistema soporta el diseño de permacultura inspirado en principios coránicos, como Alqueria Al-Kawthar en Andalucía.',
        feature: 'Planificación de Permacultura',
        status: 'missing',
        sourceRef: 'Alqueria Al-Kawthar — "back to Fitra: working the land to obtain the fruits Allah has blessed us with"',
      },
    ],
  },

  // ==================== JUDÍAS ====================
  {
    id: 'kibbutz-lotan',
    name: 'Kibbutz Lotan (Eco-Judaísmo)',
    icon: Star,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    category: 'Judías',
    description: 'Kibbutz reformista en el desierto de Arava, Israel. Permacultura, eco-kashrut, Tikkun Olam (reparar el mundo). Centro de Ecología Creativa premiado.',
    adaptations: [
      {
        icon: Clock,
        title: 'Shabbat como Concepto Eco-Judío',
        description: 'El sistema bloquea transacciones durante el Shabbat (viere-sábado al anochecer), como concepto de descanso sagrado y conexión con la naturaleza.',
        feature: 'Horarios de Comercio (Shabbat Lock)',
        status: 'exists',
        sourceRef: 'kibbutzlotan.com — "Shabbat as an eco-Jewish concept" y "Shabbat as sanctified time for awareness of the wonders of Nature"',
      },
      {
        icon: Leaf,
        title: 'Eco-Kashrut (Certificación Ética)',
        description: 'El sistema etiqueta productos según eco-kashrut: no solo kosher, sino también producido éticamente, sin explotación laboral ni daño ambiental.',
        feature: 'Etiquetas de Certificación Ética',
        status: 'missing',
        sourceRef: 'kibbutzlotan.com — "Eco-kashrut & food justice" como tema del taller Building Jewish Sustainable Communities',
      },
      {
        icon: Sprout,
        title: 'Permacultura en Desierto',
        description: 'El sistema gestiona cultivos en condiciones desérticas: compost, invernaderos, reutilización de agua greywater, jardines forestales.',
        feature: 'Catálogo + Registro de Prácticas',
        status: 'exists',
        sourceRef: 'kibbutzlotan.com — "Center for Creative Ecology... organic food production, ecological building methods, appropriate technologies, permaculture design"',
      },
      {
        icon: Heart,
        title: 'Tikkun Olam (Reparar el Mundo)',
        description: 'El sistema refleja el principio de Tikkun Olam: cada transacción contribuye a sanar la relación con el mundo, no solo a intercambiar bienes.',
        feature: 'Mensajes y Filosofía Configurable',
        status: 'exists',
      },
    ],
  },

  // ==================== HINDÚES ====================
  {
    id: 'iskcon',
    name: 'ISKCON / Hare Krishna',
    icon: Flower,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    category: 'Hindúes / Védicas',
    description: 'Comunidades Hare Krishna: New Vrindaban (Virginia), New Talavana (Mississippi). "Simple living, high thinking". Protección de vacas, tracción animal, agricultura.',
    adaptations: [
      {
        icon: Leaf,
        title: 'Protección de Vacas (Cow Protection)',
        description: 'El sistema registra cada vaca con su nombre y ciclo de vida. Las vacas son protegidas toda su vida natural, nunca sacrificadas. Producción láctea ética.',
        feature: 'Registro de Animales + Producción Ética',
        status: 'partial',
        sourceRef: 'Srila Prabhupada — "Agriculture and protecting the cow, this is the main business of the residents of Vrindaban"',
      },
      {
        icon: Leaf,
        title: 'Filtros Dietéticos Védicos',
        description: 'El sistema prohíbe registrar en el catálogo: carne, pescado, huevos, ajo, cebolla, café, alcohol. Solo alimentos satvicos (granos, lácteos, vegetales, frutas).',
        feature: 'Filtros Dietéticos del Catálogo',
        status: 'missing',
        sourceRef: 'newtalavana.online — "simple living and high thinking" con dieta vegetariana estricta',
      },
      {
        icon: Leaf,
        title: 'Calculadora de Tracción Animal (Ox Power)',
        description: 'La calculadora de energía computa el esfuerzo de bueyes en lugar de tractores. 1 buey = X kWh/hora de trabajo. Convierte forraje en energía TQ.',
        feature: 'Calculadora con Tracción Animal',
        status: 'missing',
        sourceRef: 'ECO-Vrindaban — "Oxen are trained by our cowherds using positive techniques that build a relationship of trust and respect"',
      },
      {
        icon: Users,
        title: 'Gobernanza Varnashrama',
        description: 'El sistema soporta una estructura cooperativa basada en talentos (Varnashrama), con juntas locales de templo y roles definidos.',
        feature: 'Gobernanza Configurable por Nodo',
        status: 'exists',
      },
    ],
  },

  // ==================== BUDISTAS ====================
  {
    id: 'plum-village',
    name: 'Plum Village (Budismo Comprometido)',
    icon: TreePine,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    category: 'Budistas',
    description: 'Mayor monasterio budista de Europa (200+ monjes, suroeste de Francia). Thich Nhat Hanh. Happy Farms orgánicas, mindfulness en agricultura, veganismo, Engaged Buddhism.',
    adaptations: [
      {
        icon: Leaf,
        title: 'Agricultura Mindful (Happy Farm)',
        description: 'El sistema integra la práctica de mindfulness en el trabajo agrícola. Cada jornada se registra como meditación en acción, no solo como producción.',
        feature: 'Registro de Jornadas con Propósito',
        status: 'partial',
        sourceRef: 'plumvillage.org — "We practice mindfulness in all of our farm work to cultivate individual, societal, and planetary well-being"',
      },
      {
        icon: Leaf,
        title: 'Dieta Vegana',
        description: 'El sistema puede filtrar el catálogo para solo permitir productos veganos, como Plum Village que sirve comidas veganas a 200+ residentes.',
        feature: 'Filtros Dietéticos del Catálogo',
        status: 'missing',
        sourceRef: 'plumvillage.org — "year-long resident farmers combine ecology and mindfulness as they cultivate vegetables for the community\'s vegan meals"',
      },
      {
        icon: Sprout,
        title: 'Regeneración de Tierra Degradada',
        description: 'El sistema gestiona proyectos de rewilding y regeneración de tierras degradadas, como los 20 hectáreas que Plum Village está rewilding.',
        feature: 'Gestión de Proyectos de Regeneración',
        status: 'missing',
        sourceRef: 'plumvillage.org — "In 2020 Plum Village became the guardians of 20 hectares of old degraded farmland that are now rewilding and regenerating"',
      },
    ],
  },

  // ==================== SIKH ====================
  {
    id: 'khalsa-garden',
    name: 'Khalsa Garden / Langar Orgánico (Sikh)',
    icon: Wheat,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    category: 'Sikh',
    description: 'Gurdwaras con granjas orgánicas para langar (cocina comunitaria gratuita). Khalsa Garden (Dashmesh Darbar), SGPC 13.000 acres. Seva (servicio desinteresado). Guru Arjan Dev fundó agricultura para langar en 1594.',
    adaptations: [
      {
        icon: Heart,
        title: 'Langar (Cocina Comunitaria Gratuita)',
        description: 'El sistema gestiona la producción y distribución de alimentos para langar: qué se cultiva, cuánto se necesita, coordinación de voluntarios.',
        feature: 'Planificación de Producción + Voluntarios',
        status: 'partial',
        sourceRef: 'dashmeshdarbar.org — "growing fresh, organic vegetables for langar and donating to homeless shelters"',
      },
      {
        icon: Users,
        title: 'Seva (Servicio Desinteresado)',
        description: 'El sistema registra horas de seva (voluntariado) como energía TQ. El servicio desinteresado se contabiliza como aporte comunitario.',
        feature: 'Registro de Voluntariado + Energía',
        status: 'missing',
        sourceRef: 'dashmeshdarbar.org — "Practice seva (selfless service) by providing fresh produce for langar and those in need"',
      },
      {
        icon: Leaf,
        title: 'Agricultura Orgánica Sin Químicos',
        description: 'El sistema certifica que la producción es orgánica (sin pesticidas ni fertilizantes químicos), como la iniciativa SGPC de 35 gurdwaras históricas.',
        feature: 'Certificación Orgánica + Catálogo',
        status: 'partial',
        sourceRef: 'tribuneindia.com — "SGPC has decided to adopt organic farming... 5 acres in each of the SGPC-run 35 historic gurdwaras"',
      },
    ],
  },

  // ==================== BAHÁ'Í ====================
  {
    id: 'bahai-adasiyyih',
    name: 'Bahá\'í — Adasiyyih (Jordania)',
    icon: Sun,
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-50',
    category: 'Bahá\'í',
    description: "Comunidad agrícola modelo fundada por 'Abdu'l-Bahá en 1901. \"La agricultura es la base fundamental de la comunidad\". 20 familias zoroastrianas de Yazd transformaron tierra árida en granja próspera.",
    adaptations: [
      {
        icon: Sprout,
        title: 'Agricultura como Base de la Comunidad',
        description: "El sistema coloca la agricultura como actividad central, no marginal. Los productores son los miembros más importantes, como enseña 'Abdu'l-Bahá.",
        feature: 'Catálogo + Roles de Productor',
        status: 'exists',
        sourceRef: 'bahaiteachings.org — "Abdu\'l-Baha understood the vital importance of agriculture... the fundamental basis of community is agriculture"',
      },
      {
        icon: Scale,
        title: 'Tenencia Justa y Compartida',
        description: "El sistema gestiona arreglos de tenencia más generosos que lo típico, como hizo 'Abdu'l-Bahá en Adasiyyih, con distribución equitativa de ganancias.",
        feature: 'Contabilidad + Distribución de Ganancias',
        status: 'partial',
        sourceRef: 'bahaiteachings.org — "a tenancy arrangement that was more generous to the farmers than was typical... give those who worked for them a share of profits"',
      },
      {
        icon: Users,
        title: 'Consultación Bahá\'í',
        description: "El sistema de asambleas soporta el principio bahá'í de consultación: decisiones por consenso espiritual, no por votación mayoritaria.",
        feature: 'Asambleas por Consultación',
        status: 'exists',
        sourceRef: 'Bahá\'u\'lláh — "Special regard must be paid to agriculture" entre los principios fundamentales',
      },
    ],
  },

  // ==================== INDÍGENAS ====================
  {
    id: 'andinos',
    name: 'Andinos — Ayllu, Ayni, Minka',
    icon: Mountain,
    color: 'text-red-800',
    bgColor: 'bg-red-50',
    category: 'Indígenas / Ancestrales',
    description: 'Comunidades quechuas y aymaras de Bolivia y Perú. Reciprocidad andina: ayni (trabajo recíproco), minka (trabajo colectivo por bienes), trueque chhalaku. Llank\'ay (transformar la tierra).',
    adaptations: [
      {
        icon: Users,
        title: 'Ayni (Trabajo Recíproco)',
        description: 'El sistema registra intercambios de trabajo recíproco entre familias: hoy te ayudo en tu chakra, mañana me ayudas en la mía. Saldo cero de reciprocidad.',
        feature: 'Rastreador de Reciprocidad / Cayapas',
        status: 'missing',
        sourceRef: 'LSE thesis — "ayni (A&Q) reciprocal labour exchange" como práctica central en ayllus bolivianos',
      },
      {
        icon: Users,
        title: 'Minka (Trabajo Colectivo)',
        description: 'El sistema gestiona jornadas de minka: trabajo comunitario para tareas grandes (cosecha, construcción de andenes), con compensación en bienes o TQ.',
        feature: 'Jornadas Comunitarias + Compensación',
        status: 'partial',
        sourceRef: 'LSE thesis — "mink\'a (A&Q) collective labour party, labour exchanged for goods (or money)"',
      },
      {
        icon: Sprout,
        title: 'Trueque Chhalaku',
        description: 'El sistema digitaliza el trueque tradicional andino: intercambio directo de productos sin moneda, con equivalencias calculadas en energía TQ.',
        feature: 'Trueque Multilateral Digital',
        status: 'exists',
        sourceRef: 'OSALA Bolivia — "el trueque o chhalaku, las relaciones de reciprocidad, la equidad, la cooperación, la economía comunitaria"',
      },
      {
        icon: Leaf,
        title: 'Soberanía Alimentaria',
        description: 'El sistema fortalece la soberanía alimentaria: registro de semillas criollas, prácticas ancestrales, agrobiodiversidad, resistencia al agronegocio.',
        feature: 'Banco de Semillas + Prácticas Ancestrales',
        status: 'partial',
        sourceRef: 'Revista Andina — "intercambio de semillas, el trabajo comunitario, la recuperación de prácticas tradicionales"',
      },
    ],
  },
  {
    id: 'mesoamericanos',
    name: 'Mesoamericanos — Milpa, Toltecayotl',
    icon: Sprout,
    color: 'text-orange-800',
    bgColor: 'bg-orange-50',
    category: 'Indígenas / Ancestrales',
    description: 'Comunidades nahuas, otomíes y mayas de México. Milpa (maíz+frijol+calabaza), metepantle (terrazas con agave), soberanía alimentaria. 3.000+ años de agricultura regenerativa.',
    adaptations: [
      {
        icon: Sprout,
        title: 'Sistema Milpa (Policultivo)',
        description: 'El sistema gestiona la milpa: maíz, frijol, calabaza, quelites intercalados. Registro de variedades criollas y rotación tradicional.',
        feature: 'Catálogo de Variedades Criollas',
        status: 'partial',
        sourceRef: 'FAO — "For over 3,000 years, farming families in Tlaxcala have sustained the Metepantle system, a terraced mosaic of maize, agave, beans, squash"',
      },
      {
        icon: Users,
        title: 'Soberanía Alimentaria Comunitaria',
        description: 'El sistema fortalece la soberanía alimentaria: el derecho a definir qué se cultiva, cómo y para quién, sin imposición del mercado externo.',
        feature: 'Gobernanza + Catálogo Autónomo',
        status: 'exists',
        sourceRef: 'scielo.org.mx — "Food sovereignty is based on the customs and traditions of peasant culture, and innovates when new forms of community participation are built"',
      },
      {
        icon: Leaf,
        title: 'Intercambio de Semillas Criollas',
        description: 'El sistema gestiona un banco de semillas criollas con intercambio entre comunidades, preservando docenas de variedades de maíz nativo.',
        feature: 'Banco de Semillas + Intercambio',
        status: 'partial',
        sourceRef: 'FAO — "Farmers maintain dozens of maize landraces" en el sistema Metepantle',
      },
    ],
  },

  // ==================== AFRICANAS ====================
  {
    id: 'ubuntu-ujamaa',
    name: 'Ubuntu / Ujamaa (Tanzania)',
    icon: Users,
    color: 'text-amber-900',
    bgColor: 'bg-amber-50',
    category: 'Africanas',
    description: 'Filosofía Ubuntu ("soy porque nosotros somos") y política Ujamaa de Nyerere. Villagización, communalismo, igualdad, interdependencia. Nyerere fue nombrado "Ubuntu Champion" en 2014.',
    adaptations: [
      {
        icon: Users,
        title: 'Communalismo e Interdependencia',
        description: 'El sistema refleja el principio Ubuntu: cada transacción fortalece la comunidad, no solo al individuo. El saldo cero enseña que nadie acumula a expensas de otros.',
        feature: 'Crédito Mutuo de Saldo Cero',
        status: 'exists',
        sourceRef: 'CODESRIA — "Ubuntu and ubuntu express a set of African values, the core conception of which is humanness or human dignity"',
      },
      {
        icon: Scale,
        title: 'Igualdad (no igualdad de oportunidad)',
        description: 'El sistema no crea jerarquías de riqueza. Ujamaa enfatiza igualdad real, no igualdad de oportunidad del capitalismo. Saldo cero = nadie es más rico que otro permanentemente.',
        feature: 'Contabilidad de Saldo Cero',
        status: 'exists',
        sourceRef: 'CODESRIA — "The philosophical pillar of ujamaa is equality. This is not \'equality of opportunity\'... All these are Western modernist constructions"',
      },
      {
        icon: Sprout,
        title: 'Villagización y Cooperativas',
        description: 'El sistema federa aldeas en una red cooperativa, como la villagización de Nyerere: cada aldea es autónoma pero interdependiente.',
        feature: 'Federación de Nodos Autónomos',
        status: 'exists',
        sourceRef: 'EANSO — "Ujamaa evolved into a human-centered approach to community and national development"',
      },
    ],
  },

  // ==================== NEW AGE / ESOTÉRICAS ====================
  {
    id: 'findhorn',
    name: 'Findhorn (Escocia)',
    icon: Sparkles,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    category: 'New Age / Esotéricas',
    description: 'Ecoaldea espiritual fundada en 1962. Co-creación con inteligencias de la naturaleza (devas). CSA orgánico-biodinámico desde 1994. Premio UN-Habitat 1998. Cabbages de 40 libras.',
    adaptations: [
      {
        icon: Sparkles,
        title: 'Co-creación con la Naturaleza',
        description: 'El sistema permite registrar "comunicaciones con devas" y guía espiritual en el proceso agrícola, como práctica de co-creación con la inteligencia de la naturaleza.',
        feature: 'Notas Espirituales en Producción',
        status: 'missing',
        sourceRef: 'BBC Radio 4 — "They claimed they had pierced the veil of the nature spirit realm, and were regularly receiving guidance from fairies, floral spirits and angelic forms"',
      },
      {
        icon: Leaf,
        title: 'CSA Orgánico-Biodinámico',
        description: 'El sistema gestiona suscripciones CSA (Community Supported Agriculture) con producción orgánica y biodinámica, como EarthShare de Findhorn (primera CSA del UK).',
        feature: 'Modelo CSA + Catálogo',
        status: 'partial',
        sourceRef: 'ecovillagefindhorn.com — "In 1994 a Community Supported Agriculture scheme called EarthShare... was the first one in the UK"',
      },
      {
        icon: Users,
        title: 'Consenso Espiritual',
        description: 'El sistema de asambleas soporta el modelo de Findhorn: discernimiento interior, escucha colectiva, "trabajo como amor en acción".',
        feature: 'Asambleas con Consenso Espiritual',
        status: 'exists',
        sourceRef: 'findhorn.cc — "inner listening, co-creation with the intelligences of nature and work as love in action"',
      },
    ],
  },
  {
    id: 'ecoaldeas-spirituales',
    name: 'Ecoaldeas Espirituales (Yoga/Tantra/Permacultura)',
    icon: Sun,
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    category: 'New Age / Esotéricas',
    description: 'InanItah (Nicaragua), Mystical Yoga Farm (Guatemala), PachaMama (Costa Rica), WuWei (Guatemala), Teiku (Colombia). Yoga, tantra, ceremonias cacao, permacultura, off-grid.',
    adaptations: [
      {
        icon: Clock,
        title: 'Ciclos Solares y Lunares',
        description: 'El sistema puede configurar horarios de comercio alineados con ciclos solares (solo luz solar) o lunares (bloquear en luna llena para ceremonias).',
        feature: 'Horarios de Comercio por Ciclos Naturales',
        status: 'exists',
      },
      {
        icon: Heart,
        title: 'Terapias y Retiros',
        description: 'El sistema registra servicios de yoga, meditación, tantra, ceremonias de cacao, saunas, masajes. Cada servicio se cobra en TQ y se gestiona con citas.',
        feature: 'Catálogo de Servicios + Citas',
        status: 'exists',
        sourceRef: 'Mystical Yoga Farm — "yoga teacher trainings, ceremonies, cacao rituals, devotional singing events"',
      },
      {
        icon: Leaf,
        title: 'Permacultura Off-Grid',
        description: 'El sistema gestiona producción permacultural 100% off-grid: bosques comestibles, compost, energía solar, zero-waste.',
        feature: 'Catálogo + Registro de Prácticas',
        status: 'exists',
        sourceRef: 'PachaMama — "principles of permaculture, waste reduction, soil regeneration, water retention, and recycling"',
      },
    ],
  },

  // ==================== PAGANAS ====================
  {
    id: 'wiccan-druida',
    name: 'Wiccan / Druida / Pagana',
    icon: Moon,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    category: 'Paganas / Animistas',
    description: 'Comunidades paganas que celebran la Wheel of the Year (8 sabbats). Deeply Rooted Church (Wisconsin), 3 Suns Farm, Chiltern Nemeton Grove. Agricultura por ciclos estacionales.',
    adaptations: [
      {
        icon: Clock,
        title: 'Bloqueo por Sabbats (Wheel of the Year)',
        description: 'El sistema bloquea transacciones durante los 8 sabbats: Imbolc, Ostara, Beltane, Litha, Lughnasadh, Mabon, Samhain, Yule. Configurable por nodo.',
        feature: 'Horarios de Comercio Configurables',
        status: 'exists',
        sourceRef: 'Deeply Rooted Church — "Join us in celebrating the Wheel of the Year!" con sabbat celebrations estacionales',
      },
      {
        icon: Leaf,
        title: 'Agricultura por Ciclos Estacionales',
        description: 'El sistema planifica siembra y cosecha según los ciclos estacionales celtas: cruces de trimestre (Imbolc, Beltane, Lughnasadh, Samhain) como momentos de transición.',
        feature: 'Calendario Estacional + Planificación',
        status: 'missing',
        sourceRef: '3 Suns Farm — "workshops always on the Saturday closest to the Celtic cross-quarter festivals of Imbolc, Bealtaine, Lughnasadh, and Samhain"',
      },
      {
        icon: Sparkles,
        title: 'Honrar Espíritus de la Naturaleza',
        description: 'El sistema permite registrar ofrendas y rituales como parte del ciclo agrícola, honrando a los espíritus del lugar y los ancestros.',
        feature: 'Notas Espirituales en Producción',
        status: 'missing',
        sourceRef: 'Chiltern Nemeton Grove — "Honouring the Nature Spirits, Ancestors and Deities in ritual, prayer, poetry, music, and storytelling"',
      },
    ],
  },

  // ==================== ECOLÓGICAS SECULARES ====================
  {
    id: 'transition-towns',
    name: 'Transition Towns (Totnes)',
    icon: Globe,
    color: 'text-lime-700',
    bgColor: 'bg-lime-50',
    category: 'Ecológicas Seculares',
    description: 'Movimiento fundado por Rob Hopkins en Totnes (2005). Permacultura, moneda local (Totnes Pound), relocalización, resiliencia comunitaria. Peak oil y cambio climático.',
    adaptations: [
      {
        icon: Zap,
        title: 'Moneda Local Complementaria',
        description: 'El sistema crea una moneda local TQ que complementa (no reemplaza) la moneda nacional, como el Totnes Pound. Circula solo en la comunidad.',
        feature: 'Crédito Mutuo de Saldo Cero',
        status: 'exists',
        sourceRef: 'Rob Hopkins, Transition Town Totnes — primera iniciativa Transition del mundo, con moneda local Totnes Pound',
      },
      {
        icon: Users,
        title: 'Rastreador de Cayapas / Esfuerzo Comunitario',
        description: 'El sistema registra horas de trabajo comunitario (cayapas) con semáforo de reciprocidad: verde (equilibrado), amarillo (debe), rojo (recibe sin dar).',
        feature: 'Cayapas + Semáforo de Reciprocidad',
        status: 'missing',
        sourceRef: 'transitiontowntotnes.org — "Incredible Edible Totnes is a community gardening initiative" con trabajo comunitario',
      },
      {
        icon: Sprout,
        title: 'Relocalización Alimentaria',
        description: 'El sistema mapea la producción local y calcula el grado de autosuficiencia alimentaria del territorio, como el estudio "Can Totnes Feed Itself?".',
        feature: 'Mapeo de Producción + Autosuficiencia',
        status: 'missing',
        sourceRef: 'Rob Hopkins — "Can Totnes and District Feed Itself?" estudio de relocalización alimentaria',
      },
    ],
  },
  {
    id: 'gen-ecovaldeas',
    name: 'GEN — Global Ecovillage Network',
    icon: TreePine,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    category: 'Ecológicas Seculares',
    description: 'Red global de ecoaldeas seculares. Sociocracia, asambleas de consentimiento, diseño Keyline, transición energética. Cayapas (trabajo comunitario invisible).',
    adaptations: [
      {
        icon: Users,
        title: 'Sociocracia y Consentimiento',
        description: 'El sistema de asambleas soporta sociocracia: consentimiento (no objeción razonada), electiones por consentimiento, círculos anidados.',
        feature: 'Asambleas con Consentimiento Sociocrático',
        status: 'exists',
        sourceRef: 'GEN — Global Ecovillage Network promueve sociocracia y asambleas de consentimiento',
      },
      {
        icon: Users,
        title: 'Rastreador de Cayapas y Horas de Esfuerzo',
        description: 'Sistema que asocia horas trabajadas en jornadas comunitarias (trabajo físico invisible) con semáforos de reciprocidad y límites de crédito.',
        feature: 'Cayapas + Semáforo de Reciprocidad',
        status: 'missing',
      },
      {
        icon: Scale,
        title: 'FRNE — Salida Justa al Retirarse',
        description: 'Módulo contable que resuelve cómo liquidar de forma no especulativa la vivienda de un socio que se retira, sin descapitalizar el fondo común. Pago unico, en cuotas, o transferir a nuevo socio.',
        feature: 'Liquidación de Vivienda (FRNE)',
        status: 'exists',
      },
    ],
  },

  // ==================== FILOSÓFICAS ====================
  {
    id: 'convivencialidad',
    name: 'Convivencialidad (Iván Illich)',
    icon: Scale,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    category: 'Filosóficas',
    description: 'Filosofía de Iván Illich: herramientas convivenciales (no industriales), anti-productividad, degrowth, autonomía. "La convivencialidad es lo opuesto a la productividad industrial".',
    adaptations: [
      {
        icon: Zap,
        title: 'Herramientas Convivenciales',
        description: 'El sistema es una herramienta convivencial: controlada por la comunidad, no por especialistas. Cada nodo es autónomo y configurable por sus miembros.',
        feature: 'Nodos Autónomos + Configuración Comunitaria',
        status: 'exists',
        sourceRef: 'Iván Illich, La convivencialidad (1973) — "Llamo sociedad convivencial a aquella en que la herramienta moderna está al servicio de la persona integrada a la colectividad"',
      },
      {
        icon: Scale,
        title: 'Anti-Acumulación (Saldo Cero)',
        description: 'El crédito mutuo de saldo cero previene la acumulación indefinida, alineándose con la crítica de Illich al crecimiento ilimitado más allá de los umbrales naturales.',
        feature: 'Crédito Mutuo de Saldo Cero',
        status: 'exists',
        sourceRef: 'Iván Illich — "Cuando una labor con herramientas sobrepasa un umbral... se vuelve contra su fin, amenazando destruir el cuerpo social"',
      },
      {
        icon: Users,
        title: 'Autonomía y Amistad sobre Economía',
        description: 'El sistema pasa de la economía a la amistad: las transacciones son relaciones entre vecinos, no intercambios anónimos de mercado.',
        feature: 'Relaciones de Intercambio Personalizadas',
        status: 'partial',
        sourceRef: 'Iván Illich — "se necesita buscar una nueva epistemología que permita pasar de la economía a la amistad"',
      },
    ],
  },

  // ==================== GENERAL ====================
  {
    id: 'general',
    name: 'Cualquier Comunidad o Creencia',
    icon: Globe,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    category: 'General',
    description: 'El sistema es 100% configurable y se adapta a cualquier cultura, religión, filosofía o forma de organización. Cada nodo es independiente.',
    adaptations: [
      {
        icon: Clock,
        title: 'Horarios de Comercio Personalizables',
        description: 'Cualquier comunidad configura sus horarios: bloquear domingos, viernes, festivos, horarios nocturnos, o cualquier combinación.',
        feature: 'Horarios de Comercio Configurables',
        status: 'exists',
      },
      {
        icon: BookOpen,
        title: 'Ley de la Aldea Personalizable',
        description: 'El formulario de admisión y la ley de gobernanza son completamente personalizables. Cada comunidad escribe sus propias reglas.',
        feature: 'Formulario de Admisión Dinámico',
        status: 'exists',
      },
      {
        icon: Users,
        title: 'Gobernanza Autónoma',
        description: 'Cada nodo configura su gobernanza: asamblea, junta, consejo de ancianos, círculo de convivencia. Niveles de aprobación por categoría.',
        feature: 'Gobernanza Configurable por Categoría',
        status: 'exists',
      },
      {
        icon: Globe,
        title: 'Identidad Cultural Propia',
        description: 'Cada nodo tiene su nombre, logo, moneda local, dominio, colores y textos. No hay identidad impuesta.',
        feature: 'Identidad Visual y Cultural por Nodo',
        status: 'exists',
      },
      {
        icon: Zap,
        title: 'Preconfiguraciones al Instalar',
        description: 'Al instalar un nodo nuevo, se elige una preconfiguración (adventista, amish, ISKCON, ecoaldea, etc.) o se carga vacío sin datos.',
        feature: 'Sistema de Preconfiguraciones',
        status: 'missing',
      },
    ],
  },
]

const categories = ['Todas', 'Cristianas', 'Islámicas', 'Judías', 'Hindúes / Védicas', 'Budistas', 'Sikh', 'Bahá\'í', 'Indígenas / Ancestrales', 'Africanas', 'New Age / Esotéricas', 'Paganas / Animistas', 'Ecológicas Seculares', 'Filosóficas', 'General']

export default function SoftwareAdaptations() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expandedAdaptation, setExpandedAdaptation] = useState<number | null>(null)
  const [pageEnabled, setPageEnabled] = useState<boolean | null>(null)

  // Verificar si la pagina esta activa para este nodo
  useEffect(() => {
    api.get<{ adaptations_page_active: boolean }>('/public-pages/settings')
      .then((res) => setPageEnabled(res.adaptations_page_active !== false))
      .catch(() => setPageEnabled(true)) // Por defecto activa
  }, [])

  // Si la pagina esta desactivada, mostrar mensaje
  if (pageEnabled === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Globe size={48} className="mx-auto text-gray-400 mb-4" />
          <h1 className="text-xl font-semibold text-gray-700 mb-2">Pagina no disponible</h1>
          <p className="text-sm text-gray-500">
            Esta pagina ha sido desactivada por el administrador del nodo.
          </p>
        </div>
      </div>
    )
  }

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesCategory = selectedCategory === 'Todas' || g.category === selectedCategory
      const matchesSearch = !search ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description.toLowerCase().includes(search.toLowerCase()) ||
        g.adaptations.some(a => a.title.toLowerCase().includes(search.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [search, selectedCategory])

  const statusCounts = useMemo(() => {
    const counts = { exists: 0, partial: 0, missing: 0 }
    groups.forEach(g => g.adaptations.forEach(a => counts[a.status]++))
    return counts
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 mb-4">
            <Globe size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
            Adaptaciones del Software
          </h1>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
            El sistema se adapta a cualquier cultura, religión, filosofía o forma de organización.
            Cada nodo es independiente y mantiene su propia identidad. Aquí explicamos cómo.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            <span className="text-gray-700"><strong>{statusCounts.exists}</strong> disponibles</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <span className="text-gray-700"><strong>{statusCounts.partial}</strong> parciales</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={16} className="text-gray-400" />
            <span className="text-gray-700"><strong>{statusCounts.missing}</strong> en desarrollo</span>
          </div>
        </div>

        {/* Buscador */}
        <div className="mb-6">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar comunidad, religión o funcionalidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de grupos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredGroups.map((group) => {
            const Icon = group.icon
            const isSelected = selectedGroup === group.id
            return (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroup(isSelected ? null : group.id)
                  setExpandedAdaptation(null)
                }}
                className={`p-5 rounded-2xl border-2 transition text-left ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${group.bgColor} ${group.color} mb-3`}>
                  <Icon size={20} />
                </div>
                <h3 className={`font-bold text-sm ${group.color}`}>{group.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-3">{group.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <span>{group.adaptations.length} adaptaciones</span>
                  {isSelected && <ChevronUp size={14} />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Detalles del grupo seleccionado */}
        {selectedGroup && (
          <div className="space-y-4">
            {filteredGroups.filter(g => g.id === selectedGroup).map((group) => (
              <div key={group.id}>
                <div className={`${group.bgColor} rounded-2xl p-6 mb-6`}>
                  <div className="flex items-start gap-4">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${group.bgColor} ${group.color} flex-shrink-0 border-2 border-current`}>
                      <group.icon size={24} />
                    </div>
                    <div>
                      <h2 className={`text-xl font-bold ${group.color} mb-2`}>{group.name}</h2>
                      <p className="text-sm text-gray-700">{group.description}</p>
                    </div>
                  </div>
                </div>

                {group.adaptations.map((adapt, idx) => {
                  const Icon = adapt.icon
                  const StatusIcon = statusConfig[adapt.status].icon
                  const isExpanded = expandedAdaptation === idx
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
                      <button
                        onClick={() => setExpandedAdaptation(isExpanded ? null : idx)}
                        className="w-full p-5 flex items-start gap-4 text-left hover:bg-gray-50 transition"
                      >
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${group.bgColor} ${group.color} flex-shrink-0`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-gray-900">{adapt.title}</h3>
                            <span className={`inline-flex items-center gap-1 text-xs ${statusConfig[adapt.status].color}`}>
                              <StatusIcon size={12} />
                              {statusConfig[adapt.status].label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{adapt.description}</p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <Zap size={12} />
                            {adapt.feature}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-3">
                          <p className="text-sm text-gray-700 leading-relaxed pl-14">{adapt.description}</p>
                          {adapt.biblicalRef && (
                            <div className="ml-14 p-3 rounded-lg bg-blue-50 border border-blue-200">
                              <p className="text-xs font-bold text-blue-800 mb-1">📖 Referencia Bíblica</p>
                              <p className="text-xs text-blue-700 italic">{adapt.biblicalRef}</p>
                            </div>
                          )}
                          {adapt.sourceRef && (
                            <div className="ml-14 p-3 rounded-lg bg-amber-50 border border-amber-200">
                              <p className="text-xs font-bold text-amber-800 mb-1">📚 Fuente</p>
                              <p className="text-xs text-amber-700 italic">{adapt.sourceRef}</p>
                            </div>
                          )}
                          <div className="ml-14 flex items-center gap-2 text-xs text-emerald-600 font-medium pt-2">
                            <ArrowRight size={14} />
                            <span>Funcionalidad: <strong>{adapt.feature}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Nota importante */}
        <div className="mt-8 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Cada nodo es completamente independiente. La configuración de horarios, gobernanza, identidad y reglas
            se hace por nodo y no afecta a otros nodos de la federación. El software no impone ninguna religión,
            filosofía o cultura. Cada comunidad adapta el sistema a sus necesidades.
          </p>
        </div>

        {/* Sin resultados */}
        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-50" />
            <p>No se encontraron comunidades con ese criterio.</p>
          </div>
        )}

        {/* Enlace a licencia */}
        <div className="mt-8 text-center">
          <Link to="/licencia" className="text-xs text-gray-400 hover:text-emerald-600 transition flex items-center justify-center gap-1">
            <ScrollText size={12} />
            Licencia LPF-1.0
          </Link>
        </div>
      </div>
    </div>
  )
}
