-- Migracion 034: Actualizar pagina publica 'productos' para usar backend
--
-- La pagina productos en la BD tiene productos hardcoded viejos.
-- Esta migracion reemplaza el contenido para usar source: 'backend'
-- y asi consumir los productos reales de /api/public/products.

UPDATE public_pages SET content = '[
  {
    "type": "hero",
    "badge": "🥦 Venta Directa en Moneda Local",
    "title": "Cosecha Sana, Sabores y Medicina",
    "subtitle": "Compra directamente a los productores en moneda local cada primer sábado de mes.",
    "description": "No necesitas ser miembro de la feria para comprar. Ven a Parque Los Caobos y encuentra hortalizas recién cosechadas, tubérculos ancestrales, quesos artesanales, botica conuquera, cosmética natural y delicias tradicionales a precios solidarios.",
    "image_url": "/placeholder.svg",
    "style": "standard"
  },
  {
    "type": "products_showcase",
    "source": "backend",
    "title": "Catálogo de Rubros en la Feria",
    "subtitle": "Variedad de alimentos y productos artesanales disponibles en cada jornada.",
    "categories": [],
    "items": []
  }
]', updated_at = NOW()
WHERE node_domain = 'localhost' AND slug = 'productos';
