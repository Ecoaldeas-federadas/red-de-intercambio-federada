import { HeaderStyleType } from '../../types/publicSite'

export interface HeaderStyleDef {
  id: HeaderStyleType
  name: string
  description: string
  tag: string
}

/**
 * Lista unica de estilos de cabecera.
 * Usada por:
 *  - WebsiteAdmin.tsx (ajustes internos)
 *  - ThemeCustomizer.tsx (editor en vivo)
 *  - PublicSite.tsx (renderizado)
 *
 * Cualquier cambio aqui se refleja en ambos lugares.
 */
export const HEADER_STYLES: HeaderStyleDef[] = [
  {
    id: 'modern_eco',
    name: 'Modern Eco',
    description: 'Logo on left with icons on each button, horizontal menu, primary color background.',
    tag: 'Recommended',
  },
  {
    id: 'fao_institutional',
    name: 'Icon Cards',
    description: 'Two rows: logo on top, card-style menu with icons and border below. Each item is a visual card.',
    tag: 'Cards',
  },
  {
    id: 'editorial_latam',
    name: 'Editorial Dual',
    description: 'Two rows: brand on top in white, dark bar with uppercase menu below.',
    tag: 'Editorial',
  },
  {
    id: 'agrodigital_mincyt',
    name: 'AgroDigital',
    description: 'Header with energy rate badge (1 TQ = 1 kWh) and tech-style buttons.',
    tag: 'Tech',
  },
  {
    id: 'dropdown_categories',
    name: 'Mega Menu',
    description: 'Menu grouped by categories with dropdowns: About the Network, Economy, Community.',
    tag: 'Multi-Level',
  },
  {
    id: 'compact',
    name: 'Centered Logo',
    description: 'Large centered logo with title below, horizontal menu in colored bar underneath.',
    tag: 'Minimalist',
  },
  {
    id: 'banner',
    name: 'Banner Image',
    description: 'Background image with dark overlay, superimposed logo, translucent menu at bottom.',
    tag: 'Hero',
  },
  {
    id: 'sidebar_left',
    name: 'Side Bar',
    description: 'Fixed vertical menu on left, content on right. Dashboard style.',
    tag: 'Sidebar',
  },
  {
    id: 'split_center',
    name: 'Center Logo / Split Menu',
    description: 'Centered logo, menu split to left and right of logo, CTA at the end.',
    tag: 'Split',
  },
  {
    id: 'minimal_underline',
    name: 'Minimal Underline',
    description: 'No background, text only with underline animation on hover. Maximum minimalism.',
    tag: 'Minimal',
  },
  {
    id: 'hero_overlay',
    name: 'Transparent Hero',
    description: 'Transparent menu overlaid on hero image, becomes solid on scroll.',
    tag: 'Overlay',
  },
  {
    id: 'sticky_pill',
    name: 'Floating Pill',
    description: 'Floating centered menu in rounded pill shape with shadow. Modern SaaS style.',
    tag: 'Floating',
  },
]
