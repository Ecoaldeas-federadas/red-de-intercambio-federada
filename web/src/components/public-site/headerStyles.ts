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
    name: 'Eco Moderno',
    description: 'Logo izquierda con iconos en cada boton, menu horizontal, fondo color primario.',
    tag: 'Recomendado',
  },
  {
    id: 'fao_institutional',
    name: 'Portal Blanco',
    description: 'Fondo blanco, logo+texto, menu formal con subrayado. Estilo portal institucional.',
    tag: 'Institucional',
  },
  {
    id: 'editorial_latam',
    name: 'Editorial Doble',
    description: 'Dos filas: marca arriba en blanco, barra oscura con menu en mayuscululas abajo.',
    tag: 'Editorial',
  },
  {
    id: 'agrodigital_mincyt',
    name: 'AgroDigital',
    description: 'Cabecera con badge de tasa energetica (1 TQ = 1 kWh) y botones tecnologicos.',
    tag: 'Tecnologico',
  },
  {
    id: 'dropdown_categories',
    name: 'Mega Menu',
    description: 'Menu agrupado por categorias con dropdowns: Sobre la Red, Economia, Comunidad.',
    tag: 'Multi-Nivel',
  },
  {
    id: 'compact',
    name: 'Logo Centrado',
    description: 'Logo grande centrado con titulo debajo, menu horizontal en barra de color abajo.',
    tag: 'Minimalista',
  },
  {
    id: 'banner',
    name: 'Banner Imagen',
    description: 'Imagen de fondo con overlay oscuro, logo superpuesto, menu translucido inferior.',
    tag: 'Hero',
  },
  {
    id: 'sidebar_left',
    name: 'Barra Lateral',
    description: 'Menu vertical fijo a la izquierda, contenido a la derecha. Estilo dashboard.',
    tag: 'Lateral',
  },
  {
    id: 'split_center',
    name: 'Logo Centro / Menu Lados',
    description: 'Logo centrado, menu dividido a izquierda y derecha del logo, CTA al final.',
    tag: 'Split',
  },
  {
    id: 'minimal_underline',
    name: 'Minimalista Subrayado',
    description: 'Sin fondo, solo texto con animacion de subrayado al hover. Maximo minimalismo.',
    tag: 'Minimal',
  },
  {
    id: 'hero_overlay',
    name: 'Hero Transparente',
    description: 'Menu transparente superpuesto sobre hero image, se vuelve solido al hacer scroll.',
    tag: 'Overlay',
  },
  {
    id: 'sticky_pill',
    name: 'Pildora Flotante',
    description: 'Menu flotante centrado en forma de pildora redondeada con sombra. Estilo moderno SaaS.',
    tag: 'Flotante',
  },
]
