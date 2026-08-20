package db

import (
	"context"
	"fmt"
	"log"
)

// DemoSeedData crea datos demo genericos para un nodo demo.
// NO incluye nada de Feria Conuquera - es un nodo limpio generico
// que habla de la Red de Intercambio Federada.
func DemoSeedData(ctx context.Context, d *DB, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "demo"
	}

	log.Println("Demo: seeding generic demo data for domain:", nodeDomain)

	// 1. Crear paginas publicas genericas (no Feria Conuquera)
	if err := demoSeedPages(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding pages: %v", err)
	}

	// 2. Crear productos demo genericos
	if err := demoSeedProducts(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding products: %v", err)
	}

	// 3. Crear usuarios demo
	if err := demoSeedUsers(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding users: %v", err)
	}

	// 4. Crear configuracion del nodo demo
	if err := demoSeedNodeConfig(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding node config: %v", err)
	}

	log.Println("Demo: seed completed")
	return nil
}

func demoSeedPages(ctx context.Context, d *DB, nodeDomain string) error {
	pages := []seedPage{
		{
			Slug:      "inicio",
			Title:     "Inicio",
			Subtitle:  "Red de Intercambio Federada - Nodo Demo",
			MenuOrder: 1,
			Content: `[
  {
    "type": "hero",
    "badge": "🌐 Nodo Demo - Red de Intercambio Federada",
    "title": "Bienvenido al Nodo Demo",
    "subtitle": "Explora libremente el sistema. Los cambios se reinician cada 24 horas.",
    "description": "Este es un nodo de demostracion de la plataforma Red de Intercambio Federada. Puedes navegar por todas las funciones, ver productos, asambleas, organizaciones y mas. Los datos se reinician automaticamente cada 24 horas para que siempre encuentres el sistema limpio.",
    "primary_cta": { "text": "Ver Catalogo", "link": "/p/productos" },
    "secondary_cta": { "text": "Como Funciona", "link": "/p/como-funciona" },
    "style": "centered"
  },
  {
    "type": "stats",
    "title": "El Sistema en Numeros",
    "subtitle": "Datos de demostracion del nodo demo",
    "bg_theme": "primary",
    "items": [
      { "value": "15+", "label": "Funciones", "description": "Gobernanza, economia, federacion, NFC y mas" },
      { "value": "100+", "label": "Productos", "description": "Catalogo con precios basados en energia" },
      { "value": "24h", "label": "Reset Automatico", "description": "Los datos se reinician cada dia" },
      { "value": "Gratis", "label": "Plataforma Libre", "description": "Sin costos, con asesoria incluida" }
    ]
  }
]`,
		},
		{
			Slug:      "como-funciona",
			Title:     "Como Funciona",
			Subtitle:  "Entendiendo la Red de Intercambio Federada",
			MenuOrder: 2,
			Content: `[
  {
    "type": "hero",
    "badge": "💡 Como Funciona",
    "title": "Una plataforma para ecoaldeas y comunidades",
    "subtitle": "Economia, gobernanza e intercambio en un solo sistema",
    "description": "Cada ecoaldea o comunidad que se instala funciona como un nodo independiente. El nodo tiene su propia gobernanza, su propia moneda comunitaria (TQ), y puede federarse con otros nodos para intercambiar.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Pilares del Sistema",
    "columns": [
      { "icon": "scale", "title": "Gobernanza", "description": "Asambleas, votaciones, niveles de miembro, admisiones. Todo configurable por cada comunidad." },
      { "icon": "leaf", "title": "Economia TQ", "description": "Moneda comunitaria basada en energia (kWh/Joule). Sin inflacion, sin interes, sin bancos." },
      { "icon": "network", "title": "Federacion", "description": "Cada nodo puede comerciar con otros nodos federados. Autonomia total, comercio justo." },
      { "icon": "users", "title": "Comunidad", "description": "Organizaciones, departamentos, NFC, notificaciones, recuperacion de cuentas." }
    ]
  }
]`,
		},
		{
			Slug:      "federacion",
			Title:     "Federacion",
			Subtitle:  "Suma tu ecoaldea a la red",
			MenuOrder: 3,
			Content: `[
  {
    "type": "hero",
    "badge": "🌐 Federacion de Ecoaldeas",
    "title": "La red crece con cada comunidad",
    "subtitle": "Mientras mas nodos, mas versatil e independiente",
    "description": "Cada ecoaldea que se suma a la federacion amplía la red de comercio justo. Como Visa agrupa comercios, nuestra federacion agrupa ecoaldeas. Pero cada comunidad mantiene su autonomia y sus normas.",
    "style": "centered"
  }
]`,
		},
		{
			Slug:      "productos",
			Title:     "Productos",
			Subtitle:  "Catalogo con precios energeticos",
			MenuOrder: 4,
			Content: `[
  {
    "type": "hero",
    "badge": "🛒 Catalogo Demo",
    "title": "Productos del Nodo Demo",
    "subtitle": "Precios calculados por energia (kWh/Joule)",
    "description": "Estos son productos de demostracion. Los precios estan calculados en base al consumo energetico real de producir cada item.",
    "style": "centered"
  }
]`,
		},
		{
			Slug:      "contacto",
			Title:     "Contacto",
			Subtitle:  "Quieres sumar tu ecoaldea?",
			MenuOrder: 5,
			Content: `[
  {
    "type": "contact",
    "title": "Contacto",
    "subtitle": "Escribenos para sumar tu comunidad",
    "description": "Si tienes una ecoaldea, comunidad o quieres crear una, escribenos. La plataforma es gratuita e incluye asesoria.",
    "email": "contacto@redfederada.org",
    "show_form": true
  }
]`,
		},
	}

	for _, p := range pages {
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
			ON CONFLICT (node_domain, slug) DO UPDATE SET
				title = EXCLUDED.title,
				subtitle = EXCLUDED.subtitle,
				content = EXCLUDED.content,
				menu_order = EXCLUDED.menu_order`,
			nodeDomain, p.Slug, p.Title, p.Subtitle, p.Content, p.Icon, p.MenuOrder)
		if err != nil {
			log.Printf("Demo: error seeding page %s: %v", p.Slug, err)
		}
	}
	return nil
}

func demoSeedProducts(ctx context.Context, d *DB, nodeDomain string) error {
	// Productos demo genericos (una muestra representativa)
	products := []struct {
		parentCat, cat, subcat, name, unit, desc, badge, image string
		price                                                  int
	}{
		// Agricultura
		{"Agricultura", "Cultivos", "Granos", "Frijol negro (1kg)", "kg", "Frijol negro organico secado al sol", "organico", "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400", 35},
		{"Agricultura", "Cultivos", "Granos", "Maiz criollo (1kg)", "kg", "Maiz criollo nativo para arepas", "nativo", "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400", 30},
		{"Agricultura", "Cultivos", "Hortalizas", "Tomate perita (1kg)", "kg", "Tomate perita de cultivo agroecologico", "fresco", "https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=400", 25},
		{"Agricultura", "Cultivos", "Hortalizas", "Lechuga batavia", "unidad", "Lechuga batavia fresca cosechada hoy", "fresco", "https://images.unsplash.com/photo-1622205313162-4c6d8a7d8a7d?w=400", 15},
		{"Agricultura", "Cultivos", "Raices", "Yuca (1kg)", "kg", "Yuca fresca de conuco", "nativo", "https://images.unsplash.com/photo-1607305387299-a3d96ab82b4b?w=400", 20},
		{"Agricultura", "Cultivos", "Frutas", "Platano (1kg)", "kg", "Platano de sombra organico", "organico", "https://images.unsplash.com/photo-1571771019784-3ff35f4f4277?w=400", 18},
		{"Agricultura", "Cultivos", "Frutas", "Mango (1kg)", "kg", "Mango de temporada", "temporal", "https://images.unsplash.com/photo-1553279768-465771b8d3db?w=400", 22},

		// Alimentacion
		{"Alimentacion", "Derivados", "Lacteos", "Queso fresco (500g)", "unidad", "Queso fresco artesanal", "artesanal", "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400", 60},
		{"Alimentacion", "Derivados", "Panaderia", "Pan integral (1kg)", "kg", "Pan integral de masa madre", "artesanal", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", 45},
		{"Alimentacion", "Derivados", "Conservas", "Mermelada de guayaba", "frasco", "Mermelada artesanal sin conservantes", "artesanal", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1a0?w=400", 40},

		// Artesania
		{"Artesania", "Textiles", "Tejidos", "Hamaca de algodon", "unidad", "Hamaca tejida a mano en algodon", "artesanal", "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400", 200},
		{"Artesania", "Ceramica", "Vajilla", "Set 4 platos de barro", "set", "Platos de barro cocido artesanales", "artesanal", "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400", 150},
		{"Artesania", "Madera", "Muebles", "Banco de madera", "unidad", "Banco rustico de madera local", "artesanal", "https://images.unsplash.com/photo-1503602642458-232111445657?w=400", 300},

		// Herramientas
		{"Herramientas", "Agricolas", "Manuales", "Machete con funda", "unidad", "Machete de acero con funda de cuero", "util", "https://images.unsplash.com/photo-1592924357178-9c5b8b3a3a3a?w=400", 120},
		{"Herramientas", "Agricolas", "Manuales", "Pala de mango largo", "unidad", "Pala agricola de mango de madera", "util", "", 80},

		// Salud
		{"Salud y Medicina", "Natural", "Hierbas", "Te de hierbas (100g)", "paquete", "Mezcla de hierbas medicinales secas", "natural", "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400", 25},
		{"Salud y Medicina", "Natural", "Aceites", "Aceite de coco (250ml)", "botella", "Aceite de coco prensado en frio", "natural", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", 50},

		// Servicios
		{"Servicios", "Comunitarios", "Educacion", "Taller de agroecologia (2h)", "taller", "Taller practico de agroecologia para principiantes", "educativo", "", 100},
		{"Servicios", "Comunitarios", "Transporte", "Transporte de cosecha", "viaje", "Transporte de cosecha dentro de la comunidad", "servicio", "", 80},
	}

	for _, p := range products {
		// Verificar si ya existe
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE node_domain = $1 AND name = $2`, nodeDomain, p.name).Scan(&existing)
		if existing > 0 {
			continue
		}

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO products (node_domain, parent_category, category, subcategory, name, unit, description, price, badge, image_url, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), true)`,
			nodeDomain, p.parentCat, p.cat, p.subcat, p.name, p.unit, p.desc, p.price, p.badge, p.image)
		if err != nil {
			log.Printf("Demo: error seeding product %s: %v", p.name, err)
		}
	}
	return nil
}

func demoSeedUsers(ctx context.Context, d *DB, nodeDomain string) error {
	// Crear usuario demo si no existe
	var existing int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE username = 'demo' AND node_domain = $1`, nodeDomain).Scan(&existing)
	if existing > 0 {
		return nil
	}

	// Obtener el nivel "new" o crear uno basico
	var levelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'new' LIMIT 1`, nodeDomain).Scan(&levelID)
	if levelID == "" {
		// Crear nivel basico si no existe
		var newLevelID string
		d.Pool.QueryRow(ctx, `
			INSERT INTO member_levels (node_domain, name, description, credit_limit, debit_limit, has_voice, has_vote, counts_in_quorum, is_active)
			VALUES ($1, 'new', 'Miembro nuevo', 500, -500, false, false, false, true)
			RETURNING id::text`, nodeDomain).Scan(&newLevelID)
		levelID = newLevelID
	}

	// Crear usuario demo
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, membership_status, credit_limit, debit_limit)
		VALUES ($1, 'demo', 'Usuario Demo', 'individual', $2, 'active', 500, -500)
		ON CONFLICT DO NOTHING`,
		nodeDomain, levelID)
	if err != nil {
		return fmt.Errorf("creating demo user: %w", err)
	}

	// Habilitar el usuario demo en demo_user_config
	_, err = d.Pool.Exec(ctx, `UPDATE demo_user_config SET is_enabled = true`)
	if err != nil {
		// Si no existe la tabla aun, ignorar
		log.Printf("Demo: could not enable demo user config: %v", err)
	}

	return nil
}

func demoSeedNodeConfig(ctx context.Context, d *DB, nodeDomain string) error {
	// La configuracion del nodo (node_config) la maneja el setup wizard.
	// Aqui solo actualizamos settings si ya existe el registro.
	_, err := d.Pool.Exec(ctx, `
		UPDATE node_config SET
			settings = COALESCE(settings, '{}'::jsonb) || '{"is_demo": true, "demo_mode": true}'::jsonb
		WHERE node_domain = $1`,
		nodeDomain)
	if err != nil {
		log.Printf("Demo: could not update node config (ok if not setup yet): %v", err)
	}
	return nil
}

// DemoReset borra todos los datos del nodo demo y re-seedea
func DemoReset(ctx context.Context, d *DB, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "demo"
	}

	log.Println("Demo: resetting demo node data...")

	// Borrar datos del dominio demo
	tables := []string{
		"exchange_transactions",
		"user_documents",
		"admission_documents",
		"admission_requests",
		"assembly_votes",
		"assembly_decisions",
		"products",
		"public_pages",
		"users",
		"node_config",
	}

	for _, table := range tables {
		_, err := d.Pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE node_domain = $1", table), nodeDomain)
		if err != nil {
			log.Printf("Demo: warning cleaning %s: %v", table, err)
		}
	}

	// Re-seedear
	return DemoSeedData(ctx, d, nodeDomain)
}
