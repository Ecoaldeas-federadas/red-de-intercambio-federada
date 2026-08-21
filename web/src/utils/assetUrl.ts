// Resuelve rutas de assets estaticos (imagenes, svg, etc) segun el basePath.
// En el nodo demo, el frontend se sirve desde /demo/, por lo que las rutas
// absolutas como /placeholder.svg deben resolverse a /demo/placeholder.svg.
// Las rutas externas (http://, https://) se devuelven sin modificar.

declare global {
  interface Window { __BASE_PATH__?: string }
}

const basePath = typeof window !== 'undefined' ? (window.__BASE_PATH__ || '') : ''

/**
 * Resuelve una URL de asset estatico.
 * - URLs externas (http://, https://, //) se devuelven sin modificar
 * - URLs absolutas (/foo.svg) se prefijan con el basePath (/demo/foo.svg)
 * - URLs relativas se devuelven sin modificar
 */
export function assetUrl(url: string): string {
  if (!url) return ''
  // URLs externas o data URIs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:')) {
    return url
  }
  // URLs absolutas (empiezan con /)
  if (url.startsWith('/')) {
    return basePath + url
  }
  // URLs relativas se devuelven tal cual
  return url
}
