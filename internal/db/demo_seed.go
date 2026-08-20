package db

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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

	// 4. Crear transacciones simuladas
	if err := demoSeedTransactions(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding transactions: %v", err)
	}

	// 5. Crear configuracion del nodo demo
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
	// Obtener niveles existentes
	var adminLevelID, activeLevelID, newLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'admin' ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&adminLevelID)
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'activo' ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&activeLevelID)
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'new' ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&newLevelID)
	if adminLevelID == "" {
		// Usar el nivel mas alto
		d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&adminLevelID)
	}
	if newLevelID == "" {
		newLevelID = adminLevelID
	}
	if activeLevelID == "" {
		activeLevelID = newLevelID
	}

	// Crear credenciales (password demo1234 para todos)
	pinHash, _ := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)

	users := []struct {
		username, displayName, levelID, accountType string
		credit, debit                               int
		isSuperAdmin                                bool
	}{
		// Super admin
		{"demo", "Super Admin Demo", adminLevelID, "individual", 500, 500, true},
		// Junta Directiva
		{"presidente", "Presidente de la Asamblea", adminLevelID, "individual", 1000, 1000, false},
		{"vicepresidente", "Vicepresidente", adminLevelID, "individual", 800, 800, false},
		{"tesorero", "Tesorero/a", adminLevelID, "individual", 800, 800, false},
		{"secretario", "Secretario/a", adminLevelID, "individual", 600, 600, false},
		{"vocal1", "Vocal Principal", activeLevelID, "individual", 500, 500, false},
		{"vocal2", "Vocal Suplente", activeLevelID, "individual", 500, 500, false},
		// Miembros activos
		{"maria", "Maria Gonzalez - Agricultora", activeLevelID, "individual", 500, 500, false},
		{"juan", "Juan Perez - Productor", activeLevelID, "individual", 500, 500, false},
		{"carlos", "Carlos Mendoza - Artesano", activeLevelID, "individual", 400, 400, false},
		{"ana", "Ana Ruiz - Panadera", activeLevelID, "individual", 400, 400, false},
		{"luis", "Luis Torres - Mecanico", activeLevelID, "individual", 300, 300, false},
		{"patricia", "Patricia Diaz - Maestra", activeLevelID, "individual", 300, 300, false},
		// Miembro nuevo
		{"nuevo1", "Pedro Nuevo - Recien ingresado", newLevelID, "individual", 100, 100, false},
	}

	for _, u := range users {
		// Verificar si ya existe
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE username = $1 AND node_domain = $2`, u.username, nodeDomain).Scan(&existing)
		if existing > 0 {
			continue
		}

		// Generar claves
		pubKey, privKey, _ := ed25519.GenerateKey(rand.Reader)
		pubKeyHex := hex.EncodeToString(pubKey)
		encryptedPrivKey := encryptPrivateKeyDemo(privKey, "demo1234")
		salt := make([]byte, 16)
		rand.Read(salt)

		var userID uuid.UUID
		err := d.Pool.QueryRow(ctx, `
			INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, membership_status, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
			VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10)
			RETURNING id`,
			nodeDomain, u.username, u.displayName, u.accountType, u.levelID, u.credit, u.debit, pubKeyHex, encryptedPrivKey, salt).Scan(&userID)
		if err != nil {
			log.Printf("Demo: error creating user %s: %v", u.username, err)
			continue
		}

		if u.isSuperAdmin {
			d.Pool.Exec(ctx, `UPDATE users SET is_super_admin = true, super_admin_enabled = true WHERE id = $1`, userID)
		}

		// Crear credencial
		d.Pool.Exec(ctx, `
			INSERT INTO user_credentials (user_id, password_hash, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT DO NOTHING`,
			userID, pinHash)
	}

	// Habilitar el usuario demo en demo_user_config
	d.Pool.Exec(ctx, `UPDATE demo_user_config SET is_enabled = true`)

	// Crear organizaciones
	demoSeedOrganizations(ctx, d, nodeDomain)

	// Crear departamentos
	demoSeedDepartments(ctx, d, nodeDomain)

	return nil
}

func demoSeedOrganizations(ctx context.Context, d *DB, nodeDomain string) {
	// Obtener nivel para organizaciones
	var orgLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&orgLevelID)
	if orgLevelID == "" {
		orgLevelID = uuid.New().String()
	}

	orgs := []struct {
		username, displayName, orgType string
		credit, debit                  int
	}{
		{"coop_agricola", "Cooperativa Agricola La Semilla", "cooperative", 5000, 5000},
		{"panaderia", "Panaderia Comunitaria El Buen Pan", "commerce", 3000, 3000},
		{"taller_mecanico", "Taller Mecanico Comunitario", "services", 2000, 2000},
		{"tienda_arte", "Tienda de Artesania Manos Creativas", "commerce", 2000, 2000},
		{"centro_salud", "Centro de Salud Natural", "public_service", 3000, 3000},
	}

	for _, org := range orgs {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE username = $1 AND node_domain = $2`, org.username, nodeDomain).Scan(&existing)
		if existing > 0 {
			continue
		}

		pubKey, privKey, _ := ed25519.GenerateKey(rand.Reader)
		pubKeyHex := hex.EncodeToString(pubKey)
		encryptedPrivKey := encryptPrivateKeyDemo(privKey, "demo1234")
		salt := make([]byte, 16)
		rand.Read(salt)

		var orgID uuid.UUID
		err := d.Pool.QueryRow(ctx, `
			INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, membership_status, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
			VALUES ($1, $2, $3, 'organization', $4, 'active', $5, $6, $7, $8, $9)
			RETURNING id`,
			nodeDomain, org.username, org.displayName, orgLevelID, org.credit, org.debit, pubKeyHex, encryptedPrivKey, salt).Scan(&orgID)
		if err != nil {
			log.Printf("Demo: error creating org %s: %v", org.username, err)
			continue
		}

		// Crear entrada en organizations
		d.Pool.Exec(ctx, `
			INSERT INTO organizations (id, node_domain, name, org_type, account_id, is_active, created_at)
			VALUES ($1, $2, $3, $4, $5, true, NOW())
			ON CONFLICT DO NOTHING`,
			uuid.New(), nodeDomain, org.displayName, org.orgType, orgID)
	}
}

func demoSeedDepartments(ctx context.Context, d *DB, nodeDomain string) {
	depts := []struct {
		name, desc string
	}{
		{"Junta Directiva", "Organos de direccion de la comunidad"},
		{"Comision de Economia", "Gestion de intercambios y comercio"},
		{"Comision de Educacion", "Talleres, capacitacion y formacion"},
		{"Comision de Salud", "Salud comunitaria y medicina natural"},
		{"Comision de Ambiente", "Gestion ambiental y agroecologia"},
		{"Comision de Admision", "Revision de solicitudes de nuevos miembros"},
	}

	for _, dept := range depts {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM departments WHERE name = $1`, dept.name).Scan(&existing)
		if existing > 0 {
			continue
		}
		deptID := uuid.New()
		d.Pool.Exec(ctx, `
			INSERT INTO departments (id, name, description, group_type, is_active, created_at)
			VALUES ($1, $2, $3, 'department', true, NOW())
			ON CONFLICT DO NOTHING`,
			deptID, dept.name, dept.desc)

		// Crear rol para el departamento
		roleID := uuid.New()
		d.Pool.Exec(ctx, `
			INSERT INTO roles (id, department_id, name, description, is_active, created_at)
			VALUES ($1, $2, 'Miembro', $3, true, NOW())
			ON CONFLICT DO NOTHING`,
			roleID, deptID, dept.desc)

		// Asignar todos los permisos
		rows, err := d.Pool.Query(ctx, `SELECT id FROM permissions`)
		if err == nil {
			for rows.Next() {
				var pid uuid.UUID
				rows.Scan(&pid)
				d.Pool.Exec(ctx, `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, roleID, pid)
			}
			rows.Close()
		}
	}
}

// encryptPrivateKeyDemo encripta una clave privada con bcrypt (simplificado para demo)
func encryptPrivateKeyDemo(privKey ed25519.PrivateKey, passphrase string) []byte {
	key := sha256.Sum256([]byte(passphrase))
	block, _ := aes.NewCipher(key[:])
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	rand.Read(nonce)
	return gcm.Seal(nonce, nonce, privKey, nil)
}

// demoSeedTransactions crea transacciones simuladas entre usuarios demo
func demoSeedTransactions(ctx context.Context, d *DB, nodeDomain string) error {
	// Obtener IDs de usuarios
	type userPair struct {
		sender, receiver, senderName, receiverName string
		amount                                     int64
		desc                                       string
	}

	// Buscar IDs por username
	getUserID := func(username string) string {
		var id string
		d.Pool.QueryRow(ctx, `SELECT id::text FROM users WHERE username = $1 AND node_domain = $2`, username, nodeDomain).Scan(&id)
		return id
	}

	maria := getUserID("maria")
	juan := getUserID("juan")
	carlos := getUserID("carlos")
	ana := getUserID("ana")
	luis := getUserID("luis")
	patricia := getUserID("patricia")
	coop := getUserID("coop_agricola")
	panaderia := getUserID("panaderia")
	taller := getUserID("taller_mecanico")
	tienda := getUserID("tienda_arte")
	salud := getUserID("centro_salud")
	presidente := getUserID("presidente")

	if maria == "" || juan == "" {
		log.Println("Demo: skipping transactions, users not found")
		return nil
	}

	// Transacciones simuladas (varios dias atras)
	transactions := []userPair{
		{maria, juan, "Maria", "Juan", 35, "Frijol negro 1kg"},
		{juan, ana, "Juan", "Ana", 30, "Maiz criollo 1kg"},
		{ana, carlos, "Ana", "Carlos", 45, "Pan integral 1kg"},
		{carlos, maria, "Carlos", "Maria", 150, "Set 4 platos de barro"},
		{luis, taller, "Luis", "Taller", 80, "Transporte de cosecha"},
		{patricia, salud, "Patricia", "Centro Salud", 25, "Te de hierbas 100g"},
		{maria, coop, "Maria", "Coop Agricola", 20, "Yuca 1kg"},
		{ana, panaderia, "Ana", "Panaderia", 45, "Pan integral 1kg"},
		{juan, tienda, "Juan", "Tienda Arte", 200, "Hamaca de algodon"},
		{patricia, maria, "Patricia", "Maria", 22, "Mango 1kg"},
		{coop, maria, "Coop Agricola", "Maria", 18, "Platano 1kg"},
		{taller, luis, "Taller", "Luis", 120, "Machete con funda"},
		{salud, patricia, "Centro Salud", "Patricia", 50, "Aceite de coco 250ml"},
		{presidente, coop, "Presidente", "Coop Agricola", 100, "Taller de agroecologia 2h"},
		{maria, ana, "Maria", "Ana", 15, "Lechuga batavia"},
	}

	for i, t := range transactions {
		if t.sender == "" || t.receiver == "" {
			continue
		}

		senderID, _ := uuid.Parse(t.sender)
		receiverID, _ := uuid.Parse(t.receiver)

		// Crear transaccion
		txID := uuid.New()
		// Fecha: hace N dias (repartido en los ultimos 30 dias)
		daysAgo := (i % 30) + 1
		interval := fmt.Sprintf("%d days", daysAgo)

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO transactions (id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, tax_amount, status, metadata, created_at, confirmed_at)
			VALUES ($1, 'transfer', $2, $3, $4, $4, $5, 0, 'confirmed', $6, NOW() - $7::interval, NOW() - $7::interval)`,
			txID, senderID, receiverID, nodeDomain, t.amount, fmt.Sprintf(`{"description": "%s"}`, t.desc), interval)
		if err != nil {
			log.Printf("Demo: error creating transaction %d: %v", i, err)
			continue
		}

		// Crear ledger entries (double entry)
		d.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
			VALUES ($1, $2, 'debit', $3, 'individual', $4, NOW() - $5::interval)`,
			txID, senderID, t.amount, nodeDomain, interval)

		d.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
			VALUES ($1, $2, 'credit', $3, 'individual', $4, NOW() - $5::interval)`,
			txID, receiverID, t.amount, nodeDomain, interval)
	}

	log.Printf("Demo: seeded %d transactions", len(transactions))
	return nil
}

func demoSeedNodeConfig(ctx context.Context, d *DB, nodeDomain string) error {
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
