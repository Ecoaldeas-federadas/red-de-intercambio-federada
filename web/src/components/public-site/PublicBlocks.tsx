import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Leaf,
  Heart,
  ShoppingCart,
  Users,
  Scale,
  Zap,
  HelpCircle,
  Mail,
  Home,
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Maximize2,
  X,
  Phone,
  Instagram,
  Facebook,
  ShieldCheck,
} from 'lucide-react'
import {
  SiteBlock,
  HeroBlockData,
  CarouselBlockData,
  FeaturesGridBlockData,
  SplitStoryBlockData,
  StatsBlockData,
  EventScheduleBlockData,
  ProductsShowcaseBlockData,
  TestimonialsBlockData,
  TruequeExplainerBlockData,
  FaqBlockData,
  CtaBannerBlockData,
  RichTextBlockData,
  ContactLocationBlockData,
} from '../../types/publicSite'

const ICON_MAP: Record<string, any> = {
  leaf: Leaf,
  heart: Heart,
  'shopping-cart': ShoppingCart,
  users: Users,
  scale: Scale,
  zap: Zap,
  'help-circle': HelpCircle,
  mail: Mail,
  home: Home,
  calendar: Calendar,
  clock: Clock,
  'map-pin': MapPin,
  sparkles: Sparkles,
  shield: ShieldCheck,
}

// -------------------------------------------------------------
// 1. HERO BLOCK
// -------------------------------------------------------------
export function HeroBlock({ data }: { data: HeroBlockData }) {
  const isSplit = data.style === 'split' && data.image_url

  if (isSplit) {
    return (
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-trueque-900 via-trueque-800 to-emerald-950 text-white my-6 shadow-xl border border-trueque-700/50">
        <div className="grid lg:grid-cols-12 gap-8 items-center p-8 lg:p-12">
          <div className="lg:col-span-7 space-y-6">
            {data.badge && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-emerald-200 backdrop-blur-sm border border-white/10 shadow-sm">
                <Sparkles size={13} className="text-amber-400" />
                {data.badge}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
              {data.title}
            </h1>
            {data.subtitle && (
              <p className="text-lg sm:text-xl font-medium text-emerald-100/90 leading-snug">
                {data.subtitle}
              </p>
            )}
            {data.description && (
              <p className="text-sm sm:text-base text-gray-200 leading-relaxed max-w-2xl">
                {data.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {data.primary_cta && (
                <Link
                  to={data.primary_cta.link}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 transition-all shadow-lg hover:shadow-amber-600/30 text-sm sm:text-base"
                >
                  {data.primary_cta.text}
                  <ArrowRight size={16} />
                </Link>
              )}
              {data.secondary_cta && (
                <Link
                  to={data.secondary_cta.link}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-white/15 hover:bg-white/25 active:scale-95 transition-all backdrop-blur-sm border border-white/20 text-sm sm:text-base"
                >
                  {data.secondary_cta.text}
                </Link>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 aspect-[4/3] group">
              <img
                src={data.image_url}
                alt={data.title}
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-xs text-white/90 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                🌱 Parque Los Caobos, Caracas
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="relative rounded-3xl overflow-hidden text-white my-6 shadow-xl text-center py-16 px-6 sm:px-12"
      style={{
        backgroundImage: data.image_url
          ? `linear-gradient(to bottom, rgba(20, 45, 20, 0.85), rgba(15, 30, 15, 0.92)), url(${data.image_url})`
          : 'linear-gradient(135deg, #1b3815 0%, #2d5a27 50%, #153013 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {data.badge && (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/20 text-emerald-200 backdrop-blur-sm border border-white/20 shadow-sm">
            <Sparkles size={13} className="text-amber-400" />
            {data.badge}
          </span>
        )}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          {data.title}
        </h1>
        {data.subtitle && (
          <p className="text-lg sm:text-2xl font-medium text-emerald-100 max-w-2xl mx-auto">
            {data.subtitle}
          </p>
        )}
        {data.description && (
          <p className="text-sm sm:text-base text-gray-200 leading-relaxed max-w-2xl mx-auto">
            {data.description}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {data.primary_cta && (
            <Link
              to={data.primary_cta.link}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 transition shadow-lg text-sm sm:text-base"
            >
              {data.primary_cta.text}
              <ArrowRight size={16} />
            </Link>
          )}
          {data.secondary_cta && (
            <Link
              to={data.secondary_cta.link}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-white/20 hover:bg-white/30 active:scale-95 transition backdrop-blur-sm border border-white/20 text-sm sm:text-base"
            >
              {data.secondary_cta.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 2. CAROUSEL / PHOTO ALBUM BLOCK
// -------------------------------------------------------------
export function CarouselBlock({ data }: { data: CarouselBlockData }) {
  const [current, setCurrent] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const items = data.items || []

  useEffect(() => {
    if (!data.autoplay || items.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [data.autoplay, items.length])

  if (items.length === 0) return null

  const currentItem = items[current]

  return (
    <section className="my-10 space-y-4">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1 max-w-2xl mx-auto mb-6">
          {data.title && <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{data.title}</h2>}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      {/* Main Slide Card */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-gray-950 aspect-[16/9] sm:aspect-[21/9] group border border-gray-200">
        <img
          src={currentItem.image_url}
          alt={currentItem.title || 'Foto de la feria'}
          className="w-full h-full object-cover transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />

        {/* Caption Overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-8 text-white space-y-1">
          {currentItem.tag && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-amber-950 shadow">
              {currentItem.tag}
            </span>
          )}
          {currentItem.title && (
            <h3 className="text-lg sm:text-2xl font-bold text-white drop-shadow">
              {currentItem.title}
            </h3>
          )}
          {currentItem.caption && (
            <p className="text-xs sm:text-sm text-gray-200 max-w-2xl line-clamp-2 sm:line-clamp-none">
              {currentItem.caption}
            </p>
          )}
        </div>

        {/* Lightbox button */}
        <button
          onClick={() => setLightboxIndex(current)}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur transition"
          title="Ver en pantalla completa"
        >
          <Maximize2 size={18} />
        </button>

        {/* Arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((prev) => (prev - 1 + items.length) % items.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/80 backdrop-blur transition opacity-80 group-hover:opacity-100"
              aria-label="Anterior"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={() => setCurrent((prev) => (prev + 1) % items.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/80 backdrop-blur transition opacity-80 group-hover:opacity-100"
              aria-label="Siguiente"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin justify-center">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`relative rounded-xl overflow-hidden w-20 sm:w-28 h-12 sm:h-16 flex-shrink-0 border-2 transition-all ${
                current === idx
                  ? 'border-amber-500 scale-105 shadow-md'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-6 right-6 p-3 text-white/80 hover:text-white bg-white/10 rounded-full transition"
          >
            <X size={24} />
          </button>
          <div className="max-w-4xl max-h-[85vh] text-white text-center space-y-3">
            <img
              src={items[lightboxIndex].image_url}
              alt=""
              className="max-h-[70vh] mx-auto rounded-2xl object-contain shadow-2xl"
            />
            {items[lightboxIndex].title && (
              <h4 className="text-xl font-bold">{items[lightboxIndex].title}</h4>
            )}
            {items[lightboxIndex].caption && (
              <p className="text-sm text-gray-300 max-w-xl mx-auto">
                {items[lightboxIndex].caption}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// -------------------------------------------------------------
// 3. FEATURES GRID BLOCK (Cards / Pillars)
// -------------------------------------------------------------
export function FeaturesGridBlock({ data }: { data: FeaturesGridBlockData }) {
  const cols =
    data.columns === 2
      ? 'md:grid-cols-2'
      : data.columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-2 max-w-3xl mx-auto mb-8">
          {data.title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>
          )}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      <div className={`grid ${cols} gap-6`}>
        {data.items.map((item, idx) => {
          const IconComp = ICON_MAP[item.icon || 'leaf'] || Leaf
          return (
            <div
              key={idx}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-trueque-50 rounded-bl-full -z-0 transition group-hover:scale-125" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-trueque-700 to-emerald-500 text-white flex items-center justify-center shadow-md group-hover:rotate-6 transition">
                    <IconComp size={22} />
                  </div>
                  {item.badge && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-trueque-700 transition">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>

              {item.link && (
                <div className="pt-4 relative z-10">
                  <Link
                    to={item.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-trueque-700 hover:text-trueque-900 group-hover:translate-x-1 transition"
                  >
                    Saber más
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 4. SPLIT STORY / ABOUT SECTION BLOCK
// -------------------------------------------------------------
export function SplitStoryBlock({ data }: { data: SplitStoryBlockData }) {
  const isLeft = data.image_position === 'left'

  return (
    <section className="my-12 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 overflow-hidden">
      <div className="grid lg:grid-cols-12 gap-8 items-center">
        {/* Image Column */}
        <div className={`lg:col-span-5 ${isLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          {data.image_url ? (
            <div className="rounded-2xl overflow-hidden shadow-lg border-4 border-emerald-50 aspect-[4/3] relative group">
              <img
                src={data.image_url}
                alt={data.title}
                className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-trueque-800 to-emerald-900 p-8 text-white aspect-[4/3] flex items-center justify-center text-center">
              <Leaf size={64} className="text-emerald-300 animate-pulse" />
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className={`lg:col-span-7 space-y-4 ${isLeft ? 'lg:order-2' : 'lg:order-1'}`}>
          {data.badge && (
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              {data.badge}
            </span>
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {data.title}
          </h2>
          {data.subtitle && (
            <p className="text-base sm:text-lg font-medium text-trueque-700">{data.subtitle}</p>
          )}
          <div className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line space-y-2">
            {data.content}
          </div>

          {data.highlights && data.highlights.length > 0 && (
            <div className="pt-2 space-y-2">
              {data.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}

          {data.quote && (
            <blockquote className="mt-4 p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-amber-950 text-sm italic">
              "{data.quote.text}"
              {data.quote.author && (
                <span className="block mt-1 text-xs font-bold not-italic text-amber-800">
                  — {data.quote.author}
                </span>
              )}
            </blockquote>
          )}
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 5. STATS BLOCK
// -------------------------------------------------------------
export function StatsBlock({ data }: { data: StatsBlockData }) {
  const isPrimary = data.bg_theme !== 'light'

  return (
    <section
      className={`my-10 rounded-3xl p-8 sm:p-12 text-center shadow-lg ${
        isPrimary
          ? 'bg-gradient-to-r from-trueque-900 via-trueque-800 to-emerald-950 text-white'
          : 'bg-white text-gray-900 border border-gray-100'
      }`}
    >
      {(data.title || data.subtitle) && (
        <div className="max-w-2xl mx-auto space-y-2 mb-8">
          {data.title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{data.title}</h2>
          )}
          {data.subtitle && (
            <p className={`text-sm sm:text-base ${isPrimary ? 'text-emerald-100' : 'text-gray-600'}`}>
              {data.subtitle}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {data.items.map((stat, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl ${
              isPrimary ? 'bg-white/10 backdrop-blur-sm border border-white/10' : 'bg-gray-50 border border-gray-100'
            }`}
          >
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mb-1 tracking-tight">
              {stat.value}
            </div>
            <div className="font-bold text-sm sm:text-base mb-1">{stat.label}</div>
            {stat.description && (
              <p
                className={`text-xs ${
                  isPrimary ? 'text-gray-300' : 'text-gray-500'
                } leading-relaxed`}
              >
                {stat.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 6. EVENT SCHEDULE & LOCATION BLOCK
// -------------------------------------------------------------
export function EventScheduleBlock({ data }: { data: EventScheduleBlockData }) {
  return (
    <section className="my-10 bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 rounded-3xl p-6 sm:p-10 border border-amber-200/60 shadow-md">
      <div className="grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          {data.badge && (
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-amber-200 text-amber-900">
              {data.badge}
            </span>
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur p-3.5 rounded-xl border border-amber-100 shadow-sm">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Calendar size={20} />
              </div>
              <div>
                <span className="text-xs text-gray-500 block font-medium">Frecuencia</span>
                <b className="text-sm text-gray-900">{data.date_text}</b>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/80 backdrop-blur p-3.5 rounded-xl border border-amber-100 shadow-sm">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-xs text-gray-500 block font-medium">Horario</span>
                <b className="text-sm text-gray-900">{data.time_text}</b>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/80 backdrop-blur p-4 rounded-xl border border-amber-100 shadow-sm">
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-800 flex-shrink-0 mt-0.5">
              <MapPin size={20} />
            </div>
            <div className="space-y-0.5">
              <b className="text-sm text-gray-900 block">{data.location_name}</b>
              <p className="text-xs text-gray-600 leading-relaxed">{data.address}</p>
            </div>
          </div>

          {data.cta_text && data.cta_link && (
            <div className="pt-2">
              <Link
                to={data.cta_link}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition shadow text-sm"
              >
                {data.cta_text}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-6 shadow-sm border border-amber-100 space-y-3">
          <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700" />
            Normas & Recomendaciones
          </h3>
          <ul className="space-y-2.5 text-xs sm:text-sm text-gray-700">
            {(data.guidelines || []).map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 7. PRODUCTS SHOWCASE BLOCK
// -------------------------------------------------------------
export function ProductsShowcaseBlock({ data }: { data: ProductsShowcaseBlockData }) {
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const categories = data.categories || []
  const items = data.items || []

  const filtered =
    selectedCat === 'all'
      ? items
      : items.filter((it) => it.category?.toLowerCase() === selectedCat.toLowerCase())

  return (
    <section className="my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-2 max-w-3xl mx-auto mb-6">
          {data.title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>
          )}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center pb-2">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${
              selectedCat === 'all'
                ? 'bg-trueque-700 text-white shadow'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todos los Rubros ({items.length})
          </button>
          {categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${
                selectedCat === cat
                  ? 'bg-trueque-700 text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((prod, idx) => (
          <div
            key={idx}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col"
          >
            {prod.image_url ? (
              <div className="aspect-[4/3] overflow-hidden relative bg-gray-100">
                <img
                  src={prod.image_url}
                  alt={prod.name}
                  className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                />
                {prod.badge && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-amber-950 shadow">
                    {prod.badge}
                  </span>
                )}
              </div>
            ) : (
              <div className="aspect-[4/3] bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShoppingCart size={32} />
              </div>
            )}

            <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
              <div>
                {prod.category && (
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    {prod.category}
                  </span>
                )}
                <h4 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-trueque-700 transition">
                  {prod.name}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 mt-1">
                  {prod.description}
                </p>
              </div>

              {prod.price_energy && (
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Valor Energético</span>
                  <span className="font-bold text-amber-600">{prod.price_energy}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 8. TESTIMONIALS / PRODUCERS BLOCK
// -------------------------------------------------------------
export function TestimonialsBlock({ data }: { data: TestimonialsBlockData }) {
  return (
    <section className="my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-2 max-w-2xl mx-auto mb-8">
          {data.title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>
          )}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {data.items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between relative"
          >
            <div className="space-y-4">
              <span className="text-4xl text-emerald-300 font-serif leading-none block">“</span>
              <p className="text-sm sm:text-base text-gray-700 italic leading-relaxed">
                {item.quote}
              </p>
            </div>

            <div className="pt-6 mt-4 border-t border-gray-100 flex items-center gap-3.5">
              {item.avatar_url ? (
                <img
                  src={item.avatar_url}
                  alt={item.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-trueque-800 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {item.name.charAt(0)}
                </div>
              )}
              <div>
                <b className="text-sm sm:text-base text-gray-900 block">{item.name}</b>
                <span className="text-xs text-emerald-800 font-medium block">
                  {item.role || item.project}
                </span>
                {item.location && <span className="text-xs text-gray-400 block">{item.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 9. TRUEQUE / MUTUAL CREDIT EXPLAINER BLOCK
// -------------------------------------------------------------
export function TruequeExplainerBlock({ data }: { data: TruequeExplainerBlockData }) {
  return (
    <section className="my-12 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 space-y-8">
      <div className="text-center space-y-2 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>
        {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        {data.energy_rate_text && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-900 text-xs sm:text-sm font-semibold border border-amber-200">
            <Zap size={15} className="text-amber-600" />
            {data.energy_rate_text}
          </div>
        )}
      </div>

      {/* 4 Step Diagram */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {data.steps.map((s, idx) => {
          const IconComp = ICON_MAP[s.icon || 'scale'] || Scale
          return (
            <div
              key={idx}
              className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col justify-between relative group hover:bg-emerald-50/50 hover:border-emerald-200 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-full bg-trueque-800 text-white font-bold text-sm flex items-center justify-center shadow">
                    {s.step}
                  </span>
                  <div className="p-2 rounded-lg bg-white text-trueque-700 shadow-xs">
                    <IconComp size={18} />
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 text-base">{s.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{s.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Key takeaways */}
      {data.key_points && (
        <div className="grid md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
            <b className="text-emerald-900 text-sm flex items-center gap-1.5">
              <span className="text-emerald-600">➕</span> Saldo Positivo (+TQ)
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">
              {data.key_points.positive_balance}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
            <b className="text-amber-900 text-sm flex items-center gap-1.5">
              <span className="text-amber-600">➖</span> Saldo Deudor (-TQ)
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">
              {data.key_points.negative_balance}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
            <b className="text-blue-900 text-sm flex items-center gap-1.5">
              <span className="text-blue-600">⚖️</span> Suma Cero Ética
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">{data.key_points.zero_sum}</p>
          </div>
        </div>
      )}
    </section>
  )
}

// -------------------------------------------------------------
// 10. FAQ ACCORDION BLOCK
// -------------------------------------------------------------
export function FaqBlock({ data }: { data: FaqBlockData }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section className="my-10 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-2 max-w-2xl mx-auto mb-6">
          {data.title && (
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>
          )}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-3">
        {data.items.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs transition"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition"
              >
                <span className="font-bold text-gray-900 text-sm sm:text-base">
                  {faq.question}
                </span>
                <span className="p-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                  {faq.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 11. CTA BANNER BLOCK
// -------------------------------------------------------------
export function CtaBannerBlock({ data }: { data: CtaBannerBlockData }) {
  const themeStyles =
    data.theme === 'forest'
      ? 'bg-gradient-to-br from-trueque-950 via-trueque-900 to-emerald-950 text-white'
      : data.theme === 'secondary'
      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
      : 'bg-gradient-to-r from-trueque-800 to-emerald-800 text-white'

  return (
    <section className={`my-12 rounded-3xl p-8 sm:p-12 text-center shadow-xl ${themeStyles}`}>
      <div className="max-w-2xl mx-auto space-y-4">
        {data.badge && (
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur">
            {data.badge}
          </span>
        )}
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{data.title}</h2>
        {data.subtitle && (
          <p className="text-sm sm:text-lg text-emerald-100/90 leading-relaxed">{data.subtitle}</p>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link
            to={data.button_link}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-900 bg-white hover:bg-gray-100 active:scale-95 transition shadow text-sm sm:text-base"
          >
            {data.button_text}
            <ArrowRight size={16} />
          </Link>
          {data.secondary_text && data.secondary_link && (
            <Link
              to={data.secondary_link}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-white/20 hover:bg-white/30 active:scale-95 transition backdrop-blur border border-white/20 text-sm sm:text-base"
            >
              {data.secondary_text}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 12. RICH TEXT / MARKDOWN FALLBACK BLOCK
// -------------------------------------------------------------
export function RichTextBlock({ data }: { data: RichTextBlockData }) {
  return (
    <section className="my-8 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100">
      {data.title && (
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">{data.title}</h2>
      )}
      <div className="prose prose-emerald max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
        {data.content}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 13. CONTACT & LOCATION BLOCK
// -------------------------------------------------------------
export function ContactLocationBlock({ data }: { data: ContactLocationBlockData }) {
  return (
    <section className="my-10 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="space-y-1">
          {data.title && <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{data.title}</h2>}
          {data.subtitle && <p className="text-gray-600 text-sm sm:text-base">{data.subtitle}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {data.address && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <MapPin size={18} />
              Ubicación
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{data.address}</p>
          </div>
        )}

        {data.schedule && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <Calendar size={18} />
              Horario
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{data.schedule}</p>
          </div>
        )}

        {data.transport_info && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
              <ExternalLink size={18} />
              Transporte
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{data.transport_info}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        {data.instagram && (
          <a
            href={`https://instagram.com/${data.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-50 text-pink-700 border border-pink-200 text-xs font-bold hover:bg-pink-100 transition"
          >
            <Instagram size={16} />
            Instagram @{data.instagram}
          </a>
        )}
        {data.facebook && (
          <a
            href={`https://facebook.com/${data.facebook}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition"
          >
            <Facebook size={16} />
            Facebook @{data.facebook}
          </a>
        )}
        {data.email && (
          <a
            href={`mailto:${data.email}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition"
          >
            <Mail size={16} />
            {data.email}
          </a>
        )}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// MASTER BLOCK RENDERER
// -------------------------------------------------------------
export function BlockRenderer({ block }: { block: SiteBlock }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock data={block} />
    case 'carousel':
      return <CarouselBlock data={block} />
    case 'features_grid':
      return <FeaturesGridBlock data={block} />
    case 'split_story':
      return <SplitStoryBlock data={block} />
    case 'stats':
      return <StatsBlock data={block} />
    case 'event_schedule':
      return <EventScheduleBlock data={block} />
    case 'products_showcase':
      return <ProductsShowcaseBlock data={block} />
    case 'testimonials':
      return <TestimonialsBlock data={block} />
    case 'trueque_explainer':
      return <TruequeExplainerBlock data={block} />
    case 'faq':
      return <FaqBlock data={block} />
    case 'cta_banner':
      return <CtaBannerBlock data={block} />
    case 'richtext':
      return <RichTextBlock data={block} />
    case 'contact_location':
      return <ContactLocationBlock data={block} />
    default:
      return null
  }
}

// Render page content (either JSON array of blocks or raw text)
export function PageBlocksRenderer({ content }: { content: string }) {
  if (!content) return null

  // Try parsing JSON blocks
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      return (
        <div className="space-y-4">
          {parsed.map((block: SiteBlock, i: number) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )
    }
  } catch (err) {
    // Not JSON, fallback to formatted markdown
  }

  return (
    <article className="prose prose-emerald lg:prose-lg max-w-none bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-gray-100 my-6 whitespace-pre-wrap text-gray-700 leading-relaxed">
      {content}
    </article>
  )
}
