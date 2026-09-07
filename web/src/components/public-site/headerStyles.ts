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
    name: 'header_style_modern_eco_name',
    description: 'header_style_modern_eco_desc',
    tag: 'header_style_modern_eco_tag',
  },
  {
    id: 'fao_institutional',
    name: 'header_style_fao_institutional_name',
    description: 'header_style_fao_institutional_desc',
    tag: 'header_style_fao_institutional_tag',
  },
  {
    id: 'editorial_latam',
    name: 'header_style_editorial_latam_name',
    description: 'header_style_editorial_latam_desc',
    tag: 'header_style_editorial_latam_tag',
  },
  {
    id: 'agrodigital_mincyt',
    name: 'header_style_agrodigital_mincyt_name',
    description: 'header_style_agrodigital_mincyt_desc',
    tag: 'header_style_agrodigital_mincyt_tag',
  },
  {
    id: 'dropdown_categories',
    name: 'header_style_dropdown_categories_name',
    description: 'header_style_dropdown_categories_desc',
    tag: 'header_style_dropdown_categories_tag',
  },
  {
    id: 'compact',
    name: 'header_style_compact_name',
    description: 'header_style_compact_desc',
    tag: 'header_style_compact_tag',
  },
  {
    id: 'banner',
    name: 'header_style_banner_name',
    description: 'header_style_banner_desc',
    tag: 'header_style_banner_tag',
  },
  {
    id: 'sidebar_left',
    name: 'header_style_sidebar_left_name',
    description: 'header_style_sidebar_left_desc',
    tag: 'header_style_sidebar_left_tag',
  },
  {
    id: 'split_center',
    name: 'header_style_split_center_name',
    description: 'header_style_split_center_desc',
    tag: 'header_style_split_center_tag',
  },
  {
    id: 'minimal_underline',
    name: 'header_style_minimal_underline_name',
    description: 'header_style_minimal_underline_desc',
    tag: 'header_style_minimal_underline_tag',
  },
  {
    id: 'hero_overlay',
    name: 'header_style_hero_overlay_name',
    description: 'header_style_hero_overlay_desc',
    tag: 'header_style_hero_overlay_tag',
  },
  {
    id: 'sticky_pill',
    name: 'header_style_sticky_pill_name',
    description: 'header_style_sticky_pill_desc',
    tag: 'header_style_sticky_pill_tag',
  },
]
