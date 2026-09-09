export type BlockType =
  | 'hero'
  | 'carousel'
  | 'features_grid'
  | 'split_story'
  | 'stats'
  | 'event_schedule'
  | 'products_showcase'
  | 'testimonials'
  | 'trueque_explainer'
  | 'faq'
  | 'cta_banner'
  | 'richtext'
  | 'contact_location'
  | 'news_feed'
  | 'timeline_history'
  | 'institutions_partners'
  | 'resource_downloads'
  | 'calculator_preview'
  | 'services_dynamic'

export interface CtaButton {
  text: string
  link: string
  variant?: 'primary' | 'secondary' | 'outline' | 'white'
}

export interface HeroBlockData {
  type: 'hero'
  badge?: string
  title: string
  subtitle?: string
  description?: string
  image_url?: string
  bg_gradient?: boolean
  primary_cta?: CtaButton
  secondary_cta?: CtaButton
  alignment?: 'center' | 'left'
  style?: 'standard' | 'split' | 'card_overlay' | 'institutional' | 'magazine'
}

export interface CarouselItem {
  image_url: string
  title?: string
  caption?: string
  tag?: string
}

export interface CarouselBlockData {
  type: 'carousel'
  title?: string
  subtitle?: string
  items: CarouselItem[]
  autoplay?: boolean
  aspect_ratio?: 'wide' | 'video' | 'square'
}

export interface FeatureCardItem {
  icon?: string
  title: string
  description: string
  badge?: string
  link?: string
  image_url?: string
}

export interface FeaturesGridBlockData {
  type: 'features_grid'
  title?: string
  subtitle?: string
  columns?: 2 | 3 | 4
  items: FeatureCardItem[]
}

export interface SplitStoryBlockData {
  type: 'split_story'
  badge?: string
  title: string
  subtitle?: string
  content: string
  image_url?: string
  image_position?: 'left' | 'right'
  highlights?: string[]
  quote?: {
    text: string
    author?: string
  }
}

export interface StatItem {
  value: string
  label: string
  description?: string
}

export interface StatsBlockData {
  type: 'stats'
  title?: string
  subtitle?: string
  items: StatItem[]
  bg_theme?: 'primary' | 'dark' | 'light' | 'amber' | 'institutional'
}

export interface EventScheduleBlockData {
  type: 'event_schedule'
  badge?: string
  title: string
  date_text: string
  time_text: string
  location_name: string
  address: string
  guidelines?: string[]
  cta_text?: string
  cta_link?: string
  map_url?: string
}

export interface ProductItem {
  name: string
  category?: string
  parent_category?: string
  subcategory?: string
  description: string
  image_url?: string
  badge?: string
  unit?: string
  price_energy?: string
  price_trueque?: number
}

export interface ProductsShowcaseBlockData {
  type: 'products_showcase'
  title?: string
  subtitle?: string
  categories?: string[]
  items: ProductItem[]
  source?: 'manual' | 'backend'
}

export interface TestimonialItem {
  name: string
  role?: string
  project?: string
  quote: string
  avatar_url?: string
  location?: string
}

export interface TestimonialsBlockData {
  type: 'testimonials'
  title?: string
  subtitle?: string
  items: TestimonialItem[]
}

export interface TruequeStep {
  step: number
  title: string
  description: string
  icon?: string
}

export interface TruequeExplainerBlockData {
  type: 'trueque_explainer'
  title: string
  subtitle?: string
  energy_rate_text?: string
  steps: TruequeStep[]
  key_points?: {
    positive_balance: string
    negative_balance: string
    zero_sum: string
  }
}

export interface FaqItem {
  question: string
  answer: string
  category?: string
}

export interface FaqBlockData {
  type: 'faq'
  title?: string
  subtitle?: string
  items: FaqItem[]
}

export interface CtaBannerBlockData {
  type: 'cta_banner'
  badge?: string
  title: string
  subtitle?: string
  button_text: string
  button_link: string
  secondary_text?: string
  secondary_link?: string
  theme?: 'primary' | 'secondary' | 'dark' | 'forest' | 'institutional'
}

export interface RichTextBlockData {
  type: 'richtext'
  title?: string
  subtitle?: string
  content: string
}

export interface ContactLocationBlockData {
  type: 'contact_location'
  title?: string
  subtitle?: string
  address?: string
  schedule?: string
  email?: string
  phone?: string
  instagram?: string
  facebook?: string
  transport_info?: string
}

export interface ArticleItem {
  title: string
  date?: string
  author?: string
  category?: string
  excerpt: string
  image_url?: string
  link?: string
}

export interface NewsFeedBlockData {
  type: 'news_feed'
  badge?: string
  title: string
  subtitle?: string
  items: ArticleItem[]
}

export interface TimelineItem {
  year: string
  title: string
  description: string
  badge?: string
}

export interface TimelineHistoryBlockData {
  type: 'timeline_history'
  badge?: string
  title: string
  subtitle?: string
  items: TimelineItem[]
}

export interface PartnerItem {
  name: string
  role?: string
  logo_url?: string
  link?: string
}

export interface InstitutionsPartnersBlockData {
  type: 'institutions_partners'
  title?: string
  subtitle?: string
  items: PartnerItem[]
}

export interface DownloadResourceItem {
  title: string
  category?: string
  description: string
  file_format?: string
  file_size?: string
  download_url?: string
}

export interface ResourceDownloadsBlockData {
  type: 'resource_downloads'
  title: string
  subtitle?: string
  items: DownloadResourceItem[]
}

export interface CalculatorPreviewBlockData {
  type: 'calculator_preview'
  title: string
  subtitle?: string
  sample_items?: {
    work_title: string
    hours: number
    kwh_rate: number
    effort_factor: number
  }[]
}

export interface ServicesDynamicBlockData {
  type: 'services_dynamic'
  title?: string
  subtitle?: string
  // Lista de IDs de servicios ocultos (no se muestran al público pero no se eliminan)
  hidden_service_ids?: string[]
  // Categorías a mostrar (vacío = todas)
  categories?: string[]
}

export type SiteBlock =
  | HeroBlockData
  | CarouselBlockData
  | FeaturesGridBlockData
  | SplitStoryBlockData
  | StatsBlockData
  | EventScheduleBlockData
  | ProductsShowcaseBlockData
  | TestimonialsBlockData
  | TruequeExplainerBlockData
  | FaqBlockData
  | CtaBannerBlockData
  | RichTextBlockData
  | ContactLocationBlockData
  | NewsFeedBlockData
  | TimelineHistoryBlockData
  | InstitutionsPartnersBlockData
  | ResourceDownloadsBlockData
  | CalculatorPreviewBlockData
  | ServicesDynamicBlockData

export type HeaderStyleType =
  | 'modern_eco'
  | 'fao_institutional'
  | 'editorial_latam'
  | 'agrodigital_mincyt'
  | 'dropdown_categories'
  | 'compact'
  | 'banner'
  | 'sidebar_left'
  | 'split_center'
  | 'minimal_underline'
  | 'hero_overlay'
  | 'sticky_pill'

export interface PublicPageData {
  id?: string
  slug: string
  title: string
  subtitle?: string
  icon?: string
  menu_order: number
  is_published: boolean
  show_in_menu: boolean
  content: string
}

// -------------------------------------------------------------
// DYNAMIC ADMISSION FORM SCHEMA & FIELD DEFINITIONS
// -------------------------------------------------------------
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'email'
  | 'tel'
  | 'number'
  | 'password'

export interface FormFieldSchema {
  id: string
  label: string
  type: FormFieldType
  placeholder?: string
  help_text?: string
  required?: boolean
  options?: string[] // For select, radio, checkbox
}

export interface AdmissionFormConfig {
  title: string
  subtitle: string
  schema: FormFieldSchema[]
}
