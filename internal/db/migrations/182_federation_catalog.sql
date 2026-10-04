-- Migracion 182: Catalogo federado de materia prima + productos compuestos
--
-- Nuevo modelo de catalogo:
--   * node_domain = '__FEDERATION__'  -> catalogo global de la federacion.
--     Identico en todos los nodos. Solo puede cambiar por votacion de la
--     federacion (federation_proposals, tipos catalog_item_upsert/remove).
--     Contiene: raw_material, base_product, service, packaging, shipping.
--   * node_domain = '__LOCAL__'       -> productos del nodo. Todos compuestos
--     (item_type = 'composite'), armados desde el catalogo federado.
--
-- products.catalog_key: identificador estable e igual en todos los nodos
--   (ej: 'fed-tomate-fresco'), independiente del UUID local.
-- products.item_type:   raw_material | base_product | service | packaging |
--   shipping | composite | product (residual: se elimina en la limpieza).
--
-- La promocion a __FEDERATION__ se hace con UPDATE sobre la fila existente
-- (NO con INSERT nuevo) para preservar el UUID y con ello las claves de
-- traduccion 'product:<uuid>:<field>' y el historial asociado.
--
-- IMPORTANTE: los productos eliminados ya fueron exportados a exports/
-- (catalogo-productos.json/.sql/.md) antes de esta migracion.
-- Idempotente.

-- ============ 1. Columnas e indices ============

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_key TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product';
ALTER TABLE product_compositions ADD COLUMN IF NOT EXISTS component_catalog_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_catalog_key
  ON products (catalog_key) WHERE catalog_key IS NOT NULL AND catalog_key <> '';
CREATE INDEX IF NOT EXISTS idx_products_item_type ON products (item_type);
CREATE INDEX IF NOT EXISTS idx_products_domain_item_type ON products (node_domain, item_type);

-- ============ 2. Funcion slug para catalog_key ============

CREATE OR REPLACE FUNCTION federation_catalog_slug(p_name TEXT)
RETURNS TEXT AS $$
  SELECT trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_name,''),
      'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '[^a-z0-9]+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- ============ 3. Clasificacion item_type ============

-- 3a. Compuestos (productos armados por el nodo)
UPDATE products SET item_type = 'composite'
WHERE COALESCE(is_composite, false) AND item_type = 'product';

-- 3b. Embalaje
UPDATE products SET item_type = 'packaging'
WHERE item_type = 'product'
  AND (parent_category = 'Embalaje'
       OR category IN ('Envases','Contenedores','Envolturas','Bolsas','Empaque','Embalaje'));

-- 3c. Envio / entrega
UPDATE products SET item_type = 'shipping'
WHERE item_type = 'product'
  AND (parent_category = 'Envio'
       OR category IN ('Entrega','Envio','Envios','Flete','Logistica'));

-- 3d. Servicios: unidades de trabajo/tiempo, padres o categorias de servicio
UPDATE products SET item_type = 'service'
WHERE item_type = 'product' AND (
  lower(COALESCE(unit,'')) IN (
    'hora','jornada','sesion','clase','dia','visita','viaje','consulta',
    'servicio','evento','taller','curso','turno','mes','semana','anio',
    'tratamiento','ajuste','diagnostico','diseno','alojamiento','corte',
    'poda','asesoria','traduccion','copia','lavado','entrega','dia-persona',
    'instalacion','mantenimiento','reparacion','paseo','excursion',
    'inscripcion','alquiler','arriendo','capacitacion','charla',
    'presentacion','funcion','avaluo','inspeccion','evaluacion',
    'licencia','suscripcion','noche','pasaje','km')
  OR parent_category IN ('Servicios','Educacion')
  OR category IN (
    'Trabajo Agricola','Trabajo Tecnico','Trabajo General','Reparaciones',
    'Oficina','Limpieza','Talleres','Alfabetizacion','Terapias','servicios',
    'Salud','Entrega','Eventos','Educacion','Transporte','Construccion',
    'Mecanica','Electricidad','Plomeria','Albanileria','Carpinteria',
    'Estetica','Jardineria','Herreria','Veterinaria','Consultoria',
    'Soporte Tecnico','Diseno','Instalacion','Mantenimiento','Reparacion',
    'Costura','Sastreria','Turismo','Hospedaje','Comunicacion','Belleza',
    'Barberia','Peluqueria','Cuidado','Guarderia','Entrenamiento','Idiomas')
);

-- 3e. Materia prima: cosechas, alimentos sin procesar, materiales, insumos
UPDATE products SET item_type = 'raw_material'
WHERE item_type = 'product'
  AND category IN (
    'Cosecha Fresca','Granos y Cereales','Carnes y Pescados','Fibras',
    'Materiales','Metales','Metal','Agregados','Minerales','Tierra y Compost',
    'Agua','Combustibles','energeticos','Lena','Cuero','Caucho','Vidrio',
    'Papel','Carton','Animales','Vivero','Semillas','Semillas y Plantulas',
    'Semillas & Plantulas','Plantulas','Esquejes','Frutos Secos',
    'Insumos Agricolas','Insumos Agroecologicos','Miel y Apicultura','Huevos',
    'alimentos','Aromaticas','Especias','Cafe','Cacao','Hongos','Hierbas',
    'Plantas','Pesca','Legumbres','Tuberculos','Frutas','Hortalizas',
    'Cereales','Oleaginosas','Raices','Abonos','Forraje','Carbon','Gas',
    'Biomasa','Componentes','Resinas','Recursos Basicos','Miel','Sal',
    'Insumos','Mineria','Petroleo','Madera','Construccion','Acabados')
  -- Muebles/acabados finales dentro de esas categorias NO son materia prima
  AND name NOT ILIKE ANY (ARRAY[
    '%mesa%','%silla%','%mueble%','%banco %','%cama%','%estante%',
    '%puerta%','%ventana%','%ropero%','%gabinete%','%mortero%','%tabla de picar%']);

-- 3g. Productos base: insumos procesados aprobados (azucar, harina, aceite,
--     chocolate, queso, papel procesado, herramientas, material de sistemas)
UPDATE products SET item_type = 'base_product'
WHERE item_type = 'product'
  AND category IN (
    'Dulces','Bebidas','Salsas','Conservas','Fermentados','Lacteos',
    'Extractos','Aceites','Endulzantes','Condimentos','Harinas','Embutidos',
    'Deshidratados','Medicina Botanica','Primeros Auxilios','Herramientas',
    'Manuales','Hilos y Materiales','Textiles','textiles','Tintes','Pinturas',
    'Barnices','Adhesivos','Repuestos','Utensilios','Riego','Solar','Eolica',
    'Hidraulica','Electricas','Higiene','Chocolate','Componentes Electronicos');

-- 3h. El resto queda como 'product' = bienes finales (platos, muebles,
--     artesania, ropa, cosmeticos, electrodomesticos, vehiculos, etc.)
--     que seran eliminados del catalogo en el paso de limpieza.

-- ============ 4. Promocion al dominio __FEDERATION__ ============
-- Una sola fila ganadora por catalog_key (dedup por nombre-slug entre
-- dominios replicados). Se prefiere la fila que ya tiene fuentes de
-- traduccion registradas, luego is_system, luego la mas completa.

WITH winners AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY federation_catalog_slug(name)
      ORDER BY
        EXISTS (SELECT 1 FROM content_translation_sources s
                WHERE s.entity_type = 'product' AND s.entity_id = products.id::text) DESC,
        is_system DESC,
        (COALESCE(price_per_kg,0) > 0) DESC,
        (COALESCE(description,'') <> '') DESC,
        created_at ASC,
        id
    ) AS rn
  FROM products
  WHERE item_type IN ('raw_material','base_product','service','packaging','shipping')
    AND name <> ''
)
UPDATE products p
SET node_domain = '__FEDERATION__',
    catalog_key = 'fed-' || federation_catalog_slug(p.name),
    is_approved = true,
    is_system   = true,
    is_active   = true,
    is_hidden   = false,
    group_id    = NULL,
    updated_at  = NOW()
FROM winners w
WHERE p.id = w.id AND w.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM products f
    WHERE f.catalog_key = 'fed-' || federation_catalog_slug(p.name)
      AND f.node_domain = '__FEDERATION__'
  );

-- Las fuentes de traduccion de los items promovidos pasan a dominio
-- __FEDERATION__ para que el modulo de traducciones los agrupe bien.
UPDATE content_translation_sources s
SET node_domain = '__FEDERATION__'
WHERE s.entity_type = 'product'
  AND s.entity_id IN (SELECT id::text FROM products WHERE node_domain = '__FEDERATION__')
  AND s.node_domain <> '__FEDERATION__';

-- ============ 5. Remapear referencias a las filas federadas ============

-- Composiciones: componente apuntaba a una copia local -> apuntar a la fila
-- federada del mismo nombre, y guardar catalog_key portable.
UPDATE product_compositions pc
SET component_product_id  = f.id,
    component_catalog_key = f.catalog_key
FROM products f
WHERE f.node_domain = '__FEDERATION__'
  AND f.catalog_key <> ''
  AND federation_catalog_slug(f.name) = federation_catalog_slug(pc.component_name);

-- Items de tienda: enlazar por nombre al item federado correspondiente.
UPDATE store_items si
SET product_id = f.id
FROM products f
WHERE f.node_domain = '__FEDERATION__'
  AND f.catalog_key <> ''
  AND si.product_id IS NOT NULL
  AND lower(trim(si.product_name)) = lower(trim(f.name))
  AND si.product_id <> f.id;

-- ============ 6. Liberar referencias a productos que seran borrados ============
-- Tablas con REFERENCES products(id) SIN ON DELETE CASCADE.

UPDATE store_items SET product_id = NULL
WHERE product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

UPDATE product_compositions SET component_product_id = NULL
WHERE component_product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

UPDATE external_purchases SET product_id = NULL
WHERE product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

UPDATE external_sales SET product_id = NULL
WHERE product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

UPDATE external_bridge_operations SET product_id = NULL
WHERE product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

UPDATE conversion_factor SET reference_product_id = NULL
WHERE reference_product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

-- Columna informativa (no FK): origen de productos importados.
UPDATE products SET source_product_id = NULL
WHERE source_product_id IN (
  SELECT id FROM products
  WHERE node_domain <> '__FEDERATION__' AND item_type <> 'composite');

-- ============ 7. Limpieza: borrar productos que no son materia prima ============
-- Quedan: items __FEDERATION__ + compuestos locales (futuros productos de nodo).
-- product_price_history / product_producers / allowlist caen por CASCADE.

DELETE FROM products
WHERE node_domain <> '__FEDERATION__'
  AND item_type <> 'composite';

-- Limpiar fuentes de traduccion huerfanas de productos borrados.
DELETE FROM content_translation_sources s
WHERE s.entity_type = 'product'
  AND s.entity_id NOT IN (SELECT id::text FROM products);
