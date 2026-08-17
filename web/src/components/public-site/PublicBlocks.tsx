import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  EdText,
  EdArrayText,
  EdImage,
  EdArrayImage,
  InlineEditProvider,
  useInlineEdit,
} from './InlineEditable'
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
  FileText,
  Download,
  Building2,
  Newspaper,
  History as HistoryIcon,
  Calculator as CalcIcon,
  BookOpen,
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
  NewsFeedBlockData,
  TimelineHistoryBlockData,
  InstitutionsPartnersBlockData,
  ResourceDownloadsBlockData,
  CalculatorPreviewBlockData,
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
  newspaper: Newspaper,
  book: BookOpen,
}

// -------------------------------------------------------------
// 1. HERO BLOCK
// -------------------------------------------------------------
export function HeroBlock({ data }: { data: HeroBlockData }) {
  const isSplit = (data.style === 'split' || data.style === 'magazine') && data.image_url
  const isInstitutional = data.style === 'institutional'

  if (isInstitutional) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-white text-gray-900 my-4 shadow-sm border border-gray-200">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 sm:p-10">
          <div className="max-w-4xl space-y-3">
            {data.badge && (
              <span className="inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-400 text-gray-950">
                <EdText field="badge" value={data.badge} as="span" />
              </span>
            )}
            <EdText field="title" value={data.title} as="h1" className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight" />
            {data.subtitle && (
              <EdText field="subtitle" value={data.subtitle} as="p" className="text-sm sm:text-lg text-emerald-100 font-medium" />
            )}
          </div>
        </div>
        {data.description && (
          <div className="p-6 sm:p-8 bg-gray-50 text-xs sm:text-sm text-gray-700 leading-relaxed border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <EdText field="description" value={data.description} as="p" className="max-w-3xl" />
            {data.primary_cta && (
              <Link
                to={data.primary_cta.link}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition text-xs flex-shrink-0 shadow-sm"
              >
                {data.primary_cta.text}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
      </section>
    )
  }

  if (isSplit) {
    return (
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-trueque-900 via-trueque-800 to-emerald-950 text-white my-4 sm:my-6 shadow-xl border border-trueque-700/50">
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-center p-6 sm:p-10 lg:p-12">
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            {data.badge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-emerald-200 backdrop-blur-sm border border-white/10 shadow-sm">
                <Sparkles size={13} className="text-amber-400" />
                <EdText field="badge" value={data.badge} as="span" />
              </span>
            )}
            <EdText field="title" value={data.title} as="h1" className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm" />
            {data.subtitle && (
              <EdText field="subtitle" value={data.subtitle} as="p" className="text-base sm:text-xl font-medium text-emerald-100/90 leading-snug" />
            )}
            {data.description && (
              <EdText field="description" value={data.description} as="p" className="text-xs sm:text-sm md:text-base text-gray-200 leading-relaxed max-w-2xl" multiline />
            )}
            <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-2">
              {data.primary_cta && (
                <Link
                  to={data.primary_cta.link}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 transition-all shadow-lg text-xs sm:text-sm"
                >
                  {data.primary_cta.text}
                  <ArrowRight size={15} />
                </Link>
              )}
              {data.secondary_cta && (
                <Link
                  to={data.secondary_cta.link}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-white bg-white/15 hover:bg-white/25 active:scale-95 transition-all backdrop-blur-sm border border-white/20 text-xs sm:text-sm"
                >
                  {data.secondary_cta.text}
                </Link>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white/10 aspect-[4/3] group">
              <EdImage field="image_url" src={data.image_url} alt={data.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-[11px] sm:text-xs text-white/90 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
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
      className="relative rounded-3xl overflow-hidden text-white my-4 sm:my-6 shadow-xl text-center py-12 sm:py-20 px-4 sm:px-12"
      style={{
        backgroundImage: data.image_url
          ? `linear-gradient(to bottom, rgba(16, 35, 16, 0.86), rgba(12, 24, 12, 0.93)), url(${data.image_url})`
          : 'linear-gradient(135deg, #142a14 0%, #254a20 50%, #102210 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {data.badge && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-emerald-200 backdrop-blur-sm border border-white/20 shadow-sm">
            <Sparkles size={13} className="text-amber-400" />
            <EdText field="badge" value={data.badge} as="span" />
          </span>
        )}
        <EdText field="title" value={data.title} as="h1" className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight" />
        {data.subtitle && (
          <EdText field="subtitle" value={data.subtitle} as="p" className="text-sm sm:text-xl font-medium text-emerald-100 max-w-2xl mx-auto leading-snug" />
        )}
        {data.description && (
          <EdText field="description" value={data.description} as="p" className="text-xs sm:text-sm md:text-base text-gray-200 leading-relaxed max-w-2xl mx-auto" multiline />
        )}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 pt-2">
          {data.primary_cta && (
            <Link
              to={data.primary_cta.link}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 transition shadow-lg text-xs sm:text-sm"
            >
              {data.primary_cta.text}
              <ArrowRight size={15} />
            </Link>
          )}
          {data.secondary_cta && (
            <Link
              to={data.secondary_cta.link}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-white bg-white/20 hover:bg-white/30 active:scale-95 transition backdrop-blur-sm border border-white/20 text-xs sm:text-sm"
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
    <section className="my-8 sm:my-10 space-y-4">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1 max-w-2xl mx-auto mb-4 sm:mb-6">
          {data.title && <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-bold text-gray-900" />}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      {/* Main Slide Card */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-gray-950 aspect-[16/9] sm:aspect-[21/9] group border border-gray-200">
        <EdArrayImage arrayField="items" index={current} itemField="image_url" src={currentItem.image_url} alt={currentItem.title || 'Foto de la feria'} className="w-full h-full object-cover transition-all duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Caption Overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-8 text-white space-y-1">
          {currentItem.tag && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-amber-950 shadow">
              <EdArrayText arrayField="items" index={current} itemField="tag" value={currentItem.tag} as="span" />
            </span>
          )}
          {currentItem.title && (
            <EdArrayText arrayField="items" index={current} itemField="title" value={currentItem.title} as="h3" className="text-base sm:text-2xl font-bold text-white drop-shadow" />
          )}
          {currentItem.caption && (
            <EdArrayText arrayField="items" index={current} itemField="caption" value={currentItem.caption} as="p" className="text-xs sm:text-sm text-gray-200 max-w-2xl line-clamp-2 sm:line-clamp-none" multiline />
          )}
        </div>

        {/* Lightbox button */}
        <button
          onClick={() => setLightboxIndex(current)}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur transition"
          title="Ver en pantalla completa"
        >
          <Maximize2 size={16} />
        </button>

        {/* Arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((prev) => (prev - 1 + items.length) % items.length)}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/80 backdrop-blur transition"
              aria-label="Anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrent((prev) => (prev + 1) % items.length)}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/80 backdrop-blur transition"
              aria-label="Siguiente"
            >
              <ChevronRight size={20} />
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
              className={`relative rounded-xl overflow-hidden w-16 sm:w-24 h-10 sm:h-14 flex-shrink-0 border-2 transition-all ${
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
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/80 hover:text-white bg-white/10 rounded-full transition"
          >
            <X size={22} />
          </button>
          <div className="max-w-4xl max-h-[85vh] text-white text-center space-y-3">
            <img
              src={items[lightboxIndex].image_url}
              alt=""
              className="max-h-[70vh] mx-auto rounded-2xl object-contain shadow-2xl"
            />
            {items[lightboxIndex].title && (
              <h4 className="text-lg sm:text-xl font-bold">{items[lightboxIndex].title}</h4>
            )}
            {items[lightboxIndex].caption && (
              <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto">
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
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="my-8 sm:my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1.5 max-w-3xl mx-auto mb-6">
          {data.title && (
            <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
          )}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      <div className={`grid ${cols} gap-4 sm:gap-6`}>
        {data.items.map((item, idx) => {
          const IconComp = ICON_MAP[item.icon || 'leaf'] || Leaf
          return (
            <div
              key={idx}
              className="group bg-white rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-0 transition group-hover:scale-125" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-800 to-emerald-500 text-white flex items-center justify-center shadow-md group-hover:rotate-6 transition">
                    <IconComp size={20} />
                  </div>
                  {item.badge && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <EdArrayText arrayField="items" index={idx} itemField="badge" value={item.badge} as="span" />
                    </span>
                  )}
                </div>
                <EdArrayText arrayField="items" index={idx} itemField="title" value={item.title} as="h3" className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-emerald-800 transition" />
                <EdArrayText arrayField="items" index={idx} itemField="description" value={item.description} as="p" className="text-xs sm:text-sm text-gray-600 leading-relaxed" multiline />
              </div>

              {item.link && (
                <div className="pt-3 relative z-10">
                  <Link
                    to={item.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 group-hover:translate-x-1 transition"
                  >
                    Saber más
                    <ArrowRight size={13} />
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
    <section className="my-8 sm:my-12 bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-gray-100 overflow-hidden">
      <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        {/* Image Column */}
        <div className={`lg:col-span-5 ${isLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          {data.image_url ? (
            <div className="rounded-2xl overflow-hidden shadow-lg border-2 sm:border-4 border-emerald-50 aspect-[4/3] relative group">
              <EdImage field="image_url" src={data.image_url} alt={data.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-teal-950 p-8 text-white aspect-[4/3] flex items-center justify-center text-center">
              <Leaf size={56} className="text-emerald-300 animate-pulse" />
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className={`lg:col-span-7 space-y-3 sm:space-y-4 ${isLeft ? 'lg:order-2' : 'lg:order-1'}`}>
          {data.badge && (
            <span className="inline-block text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              <EdText field="badge" value={data.badge} as="span" />
            </span>
          )}
          <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight" />
          {data.subtitle && (
            <EdText field="subtitle" value={data.subtitle} as="p" className="text-sm sm:text-base font-semibold text-emerald-800" />
          )}
          <EdText field="content" value={data.content} as="div" className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line space-y-2" multiline />

          {data.highlights && data.highlights.length > 0 && (
            <div className="pt-2 space-y-2">
              {data.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-800">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <EdArrayText arrayField="highlights" index={i} itemField="value" value={h} as="span" multiline />
                </div>
              ))}
            </div>
          )}

          {data.quote && (
            <blockquote className="mt-3 p-3.5 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-amber-950 text-xs sm:text-sm italic">
              "<EdText field="quote.text" value={data.quote.text} as="span" multiline />"
              {data.quote.author && (
                <span className="block mt-1 text-[11px] font-bold not-italic text-amber-800">
                  — <EdText field="quote.author" value={data.quote.author} as="span" />
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
      className={`my-8 sm:my-10 rounded-3xl p-6 sm:p-12 text-center shadow-lg ${
        isPrimary
          ? 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white'
          : 'bg-white text-gray-900 border border-gray-100'
      }`}
    >
      {(data.title || data.subtitle) && (
        <div className="max-w-2xl mx-auto space-y-1.5 mb-6 sm:mb-8">
          {data.title && (
            <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold tracking-tight" />
          )}
          {data.subtitle && (
            <EdText field="subtitle" value={data.subtitle} as="p" className={`text-xs sm:text-sm ${isPrimary ? 'text-emerald-100' : 'text-gray-600'}`} />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {data.items.map((stat, idx) => (
          <div
            key={idx}
            className={`p-4 sm:p-5 rounded-2xl ${
              isPrimary ? 'bg-white/10 backdrop-blur-sm border border-white/10' : 'bg-gray-50 border border-gray-100'
            }`}
          >
            <EdArrayText arrayField="items" index={idx} itemField="value" value={stat.value} as="div" className="text-2xl sm:text-4xl font-extrabold text-amber-400 mb-1 tracking-tight" />
            <EdArrayText arrayField="items" index={idx} itemField="label" value={stat.label} as="div" className="font-bold text-xs sm:text-sm mb-0.5" />
            {stat.description && (
              <EdArrayText arrayField="items" index={idx} itemField="description" value={stat.description} as="p" className={`text-[11px] ${isPrimary ? 'text-gray-300' : 'text-gray-500'} leading-relaxed hidden sm:block`} />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 6. EVENT SCHEDULE BLOCK
// -------------------------------------------------------------
export function EventScheduleBlock({ data }: { data: EventScheduleBlockData }) {
  return (
    <section className="my-8 sm:my-10 bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 rounded-3xl p-5 sm:p-10 border border-amber-200/60 shadow-md">
      <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          {data.badge && (
            <span className="inline-block text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full bg-amber-200 text-amber-900">
              <EdText field="badge" value={data.badge} as="span" />
            </span>
          )}
          <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />

          <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <div className="flex items-center gap-3 bg-white/85 backdrop-blur p-3 rounded-xl border border-amber-100 shadow-xs">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 flex-shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-gray-500 block font-medium">Frecuencia</span>
                <EdText field="date_text" value={data.date_text} as="b" className="text-xs sm:text-sm text-gray-900 truncate block" />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/85 backdrop-blur p-3 rounded-xl border border-amber-100 shadow-xs">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 flex-shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-gray-500 block font-medium">Horario</span>
                <EdText field="time_text" value={data.time_text} as="b" className="text-xs sm:text-sm text-gray-900 truncate block" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/85 backdrop-blur p-3.5 sm:p-4 rounded-xl border border-amber-100 shadow-xs">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-800 flex-shrink-0 mt-0.5">
              <MapPin size={18} />
            </div>
            <div className="space-y-0.5">
              <EdText field="location_name" value={data.location_name} as="b" className="text-xs sm:text-sm text-gray-900 block" />
              <EdText field="address" value={data.address} as="p" className="text-[11px] sm:text-xs text-gray-600 leading-relaxed" multiline />
            </div>
          </div>

          {data.cta_text && data.cta_link && (
            <div className="pt-2">
              <Link
                to={data.cta_link}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-700 active:scale-95 transition shadow text-xs sm:text-sm"
              >
                {data.cta_text}
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-amber-100 space-y-3">
          <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700" />
            Normas & Recomendaciones
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-gray-700">
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
    <section className="my-8 sm:my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1.5 max-w-3xl mx-auto mb-6">
          {data.title && (
            <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
          )}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center pb-2">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              selectedCat === 'all'
                ? 'bg-emerald-800 text-white shadow'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Todos los Rubros ({items.length})
          </button>
          {categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => setSelectedCat(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                selectedCat === cat
                  ? 'bg-emerald-800 text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {filtered.map((prod, idx) => {
          const realIdx = items.indexOf(prod)
          return (
          <div
            key={idx}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col"
          >
            {prod.image_url ? (
              <div className="aspect-[4/3] overflow-hidden relative bg-gray-100">
                <EdArrayImage arrayField="items" index={realIdx} itemField="image_url" src={prod.image_url} alt={prod.name} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                {prod.badge && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-amber-950 shadow">
                    <EdArrayText arrayField="items" index={realIdx} itemField="badge" value={prod.badge} as="span" />
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
                  <EdArrayText arrayField="items" index={realIdx} itemField="category" value={prod.category} as="span" className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block" />
                )}
                <EdArrayText arrayField="items" index={realIdx} itemField="name" value={prod.name} as="h4" className="font-bold text-gray-900 text-sm group-hover:text-emerald-800 transition" />
                <EdArrayText arrayField="items" index={realIdx} itemField="description" value={prod.description} as="p" className="text-xs text-gray-600 leading-relaxed line-clamp-3 mt-1" multiline />
              </div>

              {prod.price_energy && (
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Valor Energético</span>
                  <EdArrayText arrayField="items" index={realIdx} itemField="price_energy" value={prod.price_energy} as="span" className="font-bold text-amber-600" />
                </div>
              )}
            </div>
          </div>
          )
        })}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 8. TESTIMONIALS BLOCK
// -------------------------------------------------------------
export function TestimonialsBlock({ data }: { data: TestimonialsBlockData }) {
  return (
    <section className="my-8 sm:my-12 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1.5 max-w-2xl mx-auto mb-6">
          {data.title && (
            <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
          )}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        {data.items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between relative"
          >
            <div className="space-y-2">
              <span className="text-3xl text-emerald-300 font-serif leading-none block">“</span>
              <EdArrayText arrayField="items" index={idx} itemField="quote" value={item.quote} as="p" className="text-xs sm:text-sm text-gray-700 italic leading-relaxed" multiline />
            </div>

            <div className="pt-4 mt-3 border-t border-gray-100 flex items-center gap-3">
              {item.avatar_url ? (
                <EdArrayImage arrayField="items" index={idx} itemField="avatar_url" src={item.avatar_url} alt={item.name} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {item.name.charAt(0)}
                </div>
              )}
              <div>
                <EdArrayText arrayField="items" index={idx} itemField="name" value={item.name} as="b" className="text-xs sm:text-sm text-gray-900 block" />
                <EdArrayText arrayField="items" index={idx} itemField="role" value={item.role || item.project} as="span" className="text-[11px] text-emerald-800 font-medium block" />
                {item.location && <EdArrayText arrayField="items" index={idx} itemField="location" value={item.location} as="span" className="text-[10px] text-gray-400 block" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 9. TRUEQUE EXPLAINER BLOCK
// -------------------------------------------------------------
export function TruequeExplainerBlock({ data }: { data: TruequeExplainerBlockData }) {
  return (
    <section className="my-8 sm:my-12 bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-gray-100 space-y-6">
      <div className="text-center space-y-2 max-w-3xl mx-auto">
        <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
        {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        {data.energy_rate_text && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-semibold border border-amber-200">
            <Zap size={14} className="text-amber-600" />
            <EdText field="energy_rate_text" value={data.energy_rate_text} as="span" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.steps.map((s, idx) => {
          const IconComp = ICON_MAP[s.icon || 'scale'] || Scale
          return (
            <div
              key={idx}
              className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between group hover:bg-emerald-50/50 hover:border-emerald-200 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shadow">
                    {s.step}
                  </span>
                  <div className="p-1.5 rounded-lg bg-white text-emerald-700 shadow-xs">
                    <IconComp size={16} />
                  </div>
                </div>
                <EdArrayText arrayField="steps" index={idx} itemField="title" value={s.title} as="h3" className="font-bold text-gray-900 text-sm" />
                <EdArrayText arrayField="steps" index={idx} itemField="description" value={s.description} as="p" className="text-xs text-gray-600 leading-relaxed" multiline />
              </div>
            </div>
          )
        })}
      </div>

      {data.key_points && (
        <div className="grid md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
            <b className="text-emerald-900 text-xs flex items-center gap-1.5">
              <span>➕</span> Saldo Positivo (+TQ)
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">
              {data.key_points.positive_balance}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
            <b className="text-amber-900 text-xs flex items-center gap-1.5">
              <span>➖</span> Saldo Deudor (-TQ)
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">
              {data.key_points.negative_balance}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
            <b className="text-blue-900 text-xs flex items-center gap-1.5">
              <span>⚖️</span> Suma Cero Ética
            </b>
            <p className="text-xs text-gray-700 leading-relaxed">{data.key_points.zero_sum}</p>
          </div>
        </div>
      )}
    </section>
  )
}

// -------------------------------------------------------------
// 10. NEWS / ARTICLES FEED BLOCK (Inspired by FAO / Mincyt / BiodiversidadLA)
// -------------------------------------------------------------
export function NewsFeedBlock({ data }: { data: NewsFeedBlockData }) {
  return (
    <section className="my-8 sm:my-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-gray-200 pb-3">
        <div>
          {data.badge && (
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              <EdText field="badge" value={data.badge} as="span" />
            </span>
          )}
          <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-xs sm:text-sm text-gray-500" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {data.items.map((art, idx) => (
          <article
            key={idx}
            className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition flex flex-col justify-between group"
          >
            <div>
              {art.image_url ? (
                <div className="aspect-[16/9] overflow-hidden relative">
                  <EdArrayImage arrayField="items" index={idx} itemField="image_url" src={art.image_url} alt={art.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                  {art.category && (
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-800 text-white shadow">
                      <EdArrayText arrayField="items" index={idx} itemField="category" value={art.category} as="span" />
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-2 bg-emerald-600" />
              )}

              <div className="p-4 space-y-2">
                {art.date && (
                  <EdArrayText arrayField="items" index={idx} itemField="date" value={art.date} as="span" className="text-[11px] text-gray-400 font-medium block" />
                )}
                <EdArrayText arrayField="items" index={idx} itemField="title" value={art.title} as="h3" className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-emerald-800 transition line-clamp-2" />
                <EdArrayText arrayField="items" index={idx} itemField="excerpt" value={art.excerpt} as="p" className="text-xs text-gray-600 leading-relaxed line-clamp-3" multiline />
              </div>
            </div>

            {art.link && (
              <div className="p-4 pt-0">
                <Link
                  to={art.link}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950"
                >
                  Leer comunicado
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 11. TIMELINE HISTORY BLOCK
// -------------------------------------------------------------
export function TimelineHistoryBlock({ data }: { data: TimelineHistoryBlockData }) {
  return (
    <section className="my-8 sm:my-12 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 space-y-6">
      <div className="text-center space-y-1.5 max-w-2xl mx-auto mb-6">
        {data.badge && (
          <span className="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            <EdText field="badge" value={data.badge} as="span" />
          </span>
        )}
        <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
        {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
      </div>

      <div className="relative border-l-2 border-emerald-500 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8">
        {data.items.map((item, idx) => (
          <div key={idx} className="relative group">
            <span className="absolute -left-[33px] sm:-left-[41px] top-1 w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center ring-4 ring-white shadow">
              ✓
            </span>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/30 transition space-y-1">
              <div className="flex items-center justify-between gap-2">
                <EdArrayText arrayField="items" index={idx} itemField="year" value={item.year} as="span" className="font-extrabold text-emerald-800 text-sm sm:text-base" />
                {item.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <EdArrayText arrayField="items" index={idx} itemField="badge" value={item.badge} as="span" />
                  </span>
                )}
              </div>
              <EdArrayText arrayField="items" index={idx} itemField="title" value={item.title} as="h4" className="font-bold text-gray-900 text-sm" />
              <EdArrayText arrayField="items" index={idx} itemField="description" value={item.description} as="p" className="text-xs text-gray-600 leading-relaxed" multiline />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 12. INSTITUTIONS & ALLIES BLOCK
// -------------------------------------------------------------
export function InstitutionsPartnersBlock({ data }: { data: InstitutionsPartnersBlockData }) {
  return (
    <section className="my-8 sm:my-10 bg-gray-50 rounded-3xl p-6 sm:p-10 border border-gray-200 text-center space-y-6">
      <div className="space-y-1 max-w-2xl mx-auto">
        <h3 className="font-bold text-base sm:text-xl text-gray-900">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-gray-500">{data.subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        {data.items.map((p, idx) => (
          <div
            key={idx}
            className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3 hover:shadow-md transition"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <div className="text-left">
              <b className="text-xs sm:text-sm text-gray-900 block">{p.name}</b>
              {p.role && <span className="text-[11px] text-gray-500 block">{p.role}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 13. RESOURCE DOWNLOADS / GUIDES BLOCK
// -------------------------------------------------------------
export function ResourceDownloadsBlock({ data }: { data: ResourceDownloadsBlockData }) {
  return (
    <section className="my-8 sm:my-12 bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">{data.title}</h3>
        {data.subtitle && <p className="text-xs sm:text-sm text-gray-500">{data.subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((res, idx) => (
          <div
            key={idx}
            className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col justify-between hover:bg-emerald-50/40 hover:border-emerald-300 transition space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {res.file_format || 'PDF'}
                </span>
                {res.file_size && <span className="text-gray-400">{res.file_size}</span>}
              </div>
              <h4 className="font-bold text-sm text-gray-900">{res.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{res.description}</p>
            </div>

            <a
              href={res.download_url || '#'}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
            >
              <Download size={14} />
              Descargar Guía
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 14. INTERACTIVE CALCULATOR PREVIEW BLOCK
// -------------------------------------------------------------
export function CalculatorPreviewBlock({ data }: { data: CalculatorPreviewBlockData }) {
  const [hours, setHours] = useState(4)
  const [effort, setEffort] = useState(1.0)
  const [kwhRate, setKwhRate] = useState(0.19)
  const [categoryType, setCategoryType] = useState('conuco')

  const totalKwh = (hours * kwhRate * effort).toFixed(2)

  return (
    <section className="my-8 sm:my-12 bg-gradient-to-br from-emerald-950 via-trueque-900 to-teal-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-emerald-800/40">
      <div className="grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-gray-950">
            <CalcIcon size={14} />
            Simulador de Valor Energético
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold">{data.title}</h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            {data.subtitle ||
              'Calcula el valor objetivo de cualquier labor agrícola o artesanal en unidades de energía (1 TQ = 1 kWh de energía física invertida). El trueque no es dinero: es un registro contable de aportes para intercambiar en el futuro.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <Link
              to="/p/como-funciona"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs shadow-sm transition"
            >
              ¿Cómo Funciona el Trueque?
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/p/unirse"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-amber-500 text-gray-950 hover:bg-amber-400 text-xs shadow-md transition"
            >
              Solicitar Ingreso a la Red
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-200">
                Horas de Labor Aportada:
              </label>
              <span className="text-sm font-extrabold text-amber-300">{hours} horas</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 1)}
              className="w-full accent-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">Tipo de Labor</label>
              <select
                className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-xs text-white"
                value={kwhRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0.19
                  setKwhRate(val)
                }}
              >
                <option value="0.05" className="text-gray-900">Gestión / Coordinación (0.05 kWh/h)</option>
                <option value="0.19" className="text-gray-900">Siembra & Conuco (0.19 kWh/h)</option>
                <option value="0.30" className="text-gray-900">Carga Pesada & Mecánica (0.30 kWh/h)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">Dificultad / Esfuerzo</label>
              <select
                className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-xs text-white"
                value={effort}
                onChange={(e) => setEffort(parseFloat(e.target.value) || 1.0)}
              >
                <option value="1.0" className="text-gray-900">Esfuerzo Base (x1.0)</option>
                <option value="1.15" className="text-gray-900">Especializado (x1.15)</option>
                <option value="1.3" className="text-gray-900">Intenso / Sol Fuerte (x1.3)</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-between font-extrabold shadow-md">
            <div>
              <span className="text-[11px] uppercase tracking-wider block opacity-80">Aporte Energético Objetivo</span>
              <span className="text-2xl">{totalKwh} TQ</span>
            </div>
            <span className="text-xs bg-black/15 px-3 py-1.5 rounded-lg">
              = {totalKwh} kWh de energía
            </span>
          </div>
          <p className="text-[10px] text-gray-300 italic text-center">
            Este valor se registra en tu cuenta de aportes para que en el futuro recibas el equivalente en productos o labores de otros miembros.
          </p>
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------
// 15. FAQ ACCORDION BLOCK
// -------------------------------------------------------------
export function FaqBlock({ data }: { data: FaqBlockData }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section className="my-8 sm:my-10 space-y-4">
      {(data.title || data.subtitle) && (
        <div className="text-center space-y-1.5 max-w-2xl mx-auto mb-6">
          {data.title && (
            <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold text-gray-900" />
          )}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-2.5">
        {data.items.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs transition"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition"
              >
                <EdArrayText arrayField="items" index={idx} itemField="question" value={faq.question} as="span" className="font-bold text-gray-900 text-xs sm:text-sm" />
                <span className="p-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {isOpen && (
                <div className="px-4 sm:px-5 pb-4 pt-1 text-xs text-gray-600 leading-relaxed border-t border-gray-100">
                  <EdArrayText arrayField="items" index={idx} itemField="answer" value={faq.answer} as="div" multiline />
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
// 16. CTA BANNER BLOCK
// -------------------------------------------------------------
export function CtaBannerBlock({ data }: { data: CtaBannerBlockData }) {
  const themeStyles =
    data.theme === 'forest'
      ? 'bg-gradient-to-br from-trueque-950 via-trueque-900 to-emerald-950 text-white'
      : data.theme === 'secondary'
      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
      : 'bg-gradient-to-r from-emerald-900 to-teal-900 text-white'

  return (
    <section className={`my-8 sm:my-12 rounded-3xl p-6 sm:p-12 text-center shadow-xl ${themeStyles}`}>
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
        {data.badge && (
          <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur">
            <EdText field="badge" value={data.badge} as="span" />
          </span>
        )}
        <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-3xl font-extrabold tracking-tight" />
        {data.subtitle && (
          <EdText field="subtitle" value={data.subtitle} as="p" className="text-xs sm:text-base text-emerald-100/90 leading-relaxed" multiline />
        )}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 pt-3">
          <Link
            to={data.button_link}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-gray-900 bg-white hover:bg-gray-100 active:scale-95 transition shadow text-xs sm:text-sm"
          >
            {data.button_text}
            <ArrowRight size={15} />
          </Link>
          {data.secondary_text && data.secondary_link && (
            <Link
              to={data.secondary_link}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-white bg-white/20 hover:bg-white/30 active:scale-95 transition backdrop-blur border border-white/20 text-xs sm:text-sm"
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
// 17. RICH TEXT / MARKDOWN FALLBACK BLOCK
// -------------------------------------------------------------
export function RichTextBlock({ data }: { data: RichTextBlockData }) {
  return (
    <section className="my-6 bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-gray-100">
      {data.title && (
        <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-3" />
      )}
      <EdText field="content" value={data.content} as="div" className="prose prose-emerald max-w-none text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" multiline />
    </section>
  )
}

// -------------------------------------------------------------
// 18. CONTACT & LOCATION BLOCK
// -------------------------------------------------------------
export function ContactLocationBlock({ data }: { data: ContactLocationBlockData }) {
  return (
    <section className="my-8 bg-white rounded-3xl p-5 sm:p-10 shadow-sm border border-gray-100 space-y-6">
      {(data.title || data.subtitle) && (
        <div className="space-y-1">
          {data.title && <EdText field="title" value={data.title} as="h2" className="text-xl sm:text-2xl font-extrabold text-gray-900" />}
          {data.subtitle && <EdText field="subtitle" value={data.subtitle} as="p" className="text-gray-600 text-xs sm:text-sm" />}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {data.address && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs sm:text-sm">
              <MapPin size={16} />
              Ubicación
            </div>
            <EdText field="address" value={data.address} as="p" className="text-xs text-gray-700 leading-relaxed" multiline />
          </div>
        )}

        {data.schedule && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-xs sm:text-sm">
              <Calendar size={16} />
              Horario
            </div>
            <EdText field="schedule" value={data.schedule} as="p" className="text-xs text-gray-700 leading-relaxed" multiline />
          </div>
        )}

        {data.transport_info && (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-xs sm:text-sm">
              <ExternalLink size={16} />
              Transporte
            </div>
            <EdText field="transport_info" value={data.transport_info} as="p" className="text-xs text-gray-700 leading-relaxed" multiline />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 pt-1">
        {data.instagram && (
          <a
            href={`https://instagram.com/${data.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-pink-50 text-pink-700 border border-pink-200 text-xs font-bold hover:bg-pink-100 transition"
          >
            <Instagram size={15} />
            Instagram @{data.instagram}
          </a>
        )}
        {data.facebook && (
          <a
            href={`https://facebook.com/${data.facebook}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition"
          >
            <Facebook size={15} />
            Facebook @{data.facebook}
          </a>
        )}
        {data.email && (
          <a
            href={`mailto:${data.email}`}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition"
          >
            <Mail size={15} />
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
export function BlockRenderer({
  block,
  editMode = false,
  onFieldChange,
}: {
  block: SiteBlock
  editMode?: boolean
  onFieldChange?: (path: string, value: any) => void
}) {
  // Helper to apply field changes to the block data
  const handleFieldChange = (path: string, value: any) => {
    if (!onFieldChange) return
    onFieldChange(path, value)
  }

  const inner = (() => {
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
      case 'news_feed':
        return <NewsFeedBlock data={block} />
      case 'timeline_history':
        return <TimelineHistoryBlock data={block} />
      case 'institutions_partners':
        return <InstitutionsPartnersBlock data={block} />
      case 'resource_downloads':
        return <ResourceDownloadsBlock data={block} />
      case 'calculator_preview':
        return <CalculatorPreviewBlock data={block} />
      case 'richtext':
        return <RichTextBlock data={block} />
      case 'contact_location':
        return <ContactLocationBlock data={block} />
      default:
        return null
    }
  })()

  if (editMode) {
    return (
      <InlineEditProvider editMode={editMode} onFieldChange={handleFieldChange}>
        {inner}
      </InlineEditProvider>
    )
  }
  return inner
}

// Render page content (either JSON array of blocks or raw text)
export function PageBlocksRenderer({ content }: { content: string }) {
  if (!content) return null

  // Try parsing JSON blocks
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      return (
        <div className="space-y-6">
          {parsed.map((block: SiteBlock, i: number) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )
    }
  } catch (err) {
    // Not JSON
  }

  return (
    <article className="prose prose-emerald lg:prose-lg max-w-none bg-white p-6 sm:p-12 rounded-3xl shadow-sm border border-gray-100 my-6 whitespace-pre-wrap text-gray-700 leading-relaxed text-xs sm:text-base">
      {content}
    </article>
  )
}
