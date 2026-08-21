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
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// DemoSeedData crea datos demo para una ecoaldea ficticia:
// "Ecoaldea Raices del Monte" - una comunidad montanosa de permacultura.
// NO incluye nada de Feria Conuquera ni del nodo principal.
func DemoSeedData(ctx context.Context, d *DB, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "demo"
	}

	log.Println("Demo: seeding Ecoaldea Raices del Monte for domain:", nodeDomain)

	// 1. Configuracion del nodo
	if err := demoSeedNodeConfig(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding node config: %v", err)
	}

	// 2. Paginas publicas de la ecoaldea
	if err := demoSeedPages(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding pages: %v", err)
	}

	// 2b. Configuracion del sitio publico (header, footer, colores)
	if err := demoSeedPublicSettings(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding public settings: %v", err)
	}

	// 3. Niveles de miembro
	if err := demoSeedMemberLevels(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding member levels: %v", err)
	}

	// 3b. Niveles de organizacion
	if err := demoSeedOrgLevels(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding org levels: %v", err)
	}

	// 4. Productos de la ecoaldea
	if err := demoSeedProducts(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding products: %v", err)
	}

	// 5. Usuarios y organizaciones
	if err := demoSeedUsers(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding users: %v", err)
	}

	// 5b. Organizaciones de la Asamblea con servicios obligatorios
	demoSeedAssemblyOrganizations(ctx, d, nodeDomain)

	// 6. Departamentos y comisiones
	demoSeedDepartments(ctx, d, nodeDomain)

	// 7. Reglas de gobernanza
	demoSeedGovernance(ctx, d, nodeDomain)

	// 8. Transacciones simuladas
	if err := demoSeedTransactions(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding transactions: %v", err)
	}

	// 9. Items de tienda (para que haya productos en la tienda)
	if err := demoSeedStoreItems(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding store items: %v", err)
	}

	// 10. Propuestas de asamblea simuladas
	if err := demoSeedAssemblyProposals(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding assembly proposals: %v", err)
	}

	// 10b. Junta directiva
	demoSeedBoardMembers(ctx, d, nodeDomain)

	// 10c. Solicitudes de admision
	demoSeedAdmissionRequests(ctx, d, nodeDomain)

	// 10d. Comercio externo (DEX)
	demoSeedExternalOps(ctx, d, nodeDomain)

	// 10e. Propuestas de distribucion del fondo
	demoSeedFundProposals(ctx, d, nodeDomain)

	// 10f. Reportes de paridad federada
	demoSeedParityReports(ctx, d, nodeDomain)

	// 11. Nodos federados simulados
	if err := demoSeedFederationPeers(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding federation peers: %v", err)
	}

	log.Println("Demo: seed completed for Ecoaldea Raices del Monte")
	return nil
}

func demoSeedNodeConfig(ctx context.Context, d *DB, nodeDomain string) error {
	// Actualizar el node_config con la identidad de la ecoaldea
	_, err := d.Pool.Exec(ctx, `
		UPDATE node_config SET
			node_name = 'Ecoaldea Raices del Monte',
			currency_name = 'TQ',
			currency_full_name = 'Trueque Comunitario',
			app_name = 'Raices del Monte'
		WHERE node_domain = $1`, nodeDomain)
	if err != nil {
		return fmt.Errorf("update node_config: %w", err)
	}
	return nil
}

func demoSeedMemberLevels(ctx context.Context, d *DB, nodeDomain string) error {
	// Crear niveles de miembro especificos de la ecoaldea
	levels := []struct {
		name, desc                string
		level                     int
		hasVoice, hasVote, quorum bool
		credit, debit             int
		taxRate                   float64
	}{
		{"raiz", "Miembro Raiz - fundador/a de la ecoaldea, voz y voto en todas las decisiones", 100, true, true, true, 5000, 5000, 0.005},
		{"tronco", "Miembro Tronco - con mas de 2 anios, voz y voto en asamblea", 50, true, true, true, 3000, 3000, 0.01},
		{"rama", "Miembro Rama - con mas de 6 meses, voz en asamblea, voto en comisiones", 20, true, true, false, 1500, 1500, 0.015},
		{"brote", "Miembro Brote - recien ingresado/a, voz en asamblea, sin voto", 10, true, false, false, 500, 500, 0.02},
	}

	for _, l := range levels {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM member_levels WHERE node_domain = $1 AND name = $2`, nodeDomain, l.name).Scan(&existing)
		if existing > 0 {
			// Actualizar tax_rate si no estaba configurado
			d.Pool.Exec(ctx, `UPDATE member_levels SET tax_rate = $3 WHERE node_domain = $1 AND name = $2 AND (tax_rate IS NULL OR tax_rate = 0)`,
				nodeDomain, l.name, l.taxRate)
			continue
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, is_active, credit_limit, debit_limit, tax_rate)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)`,
			uuid.New(), nodeDomain, l.name, l.desc, l.level, l.hasVoice, l.hasVote, l.quorum, l.credit, l.debit, l.taxRate)
		if err != nil {
			log.Printf("Demo: error creating level %s: %v", l.name, err)
		}
	}
	return nil
}

func demoSeedPublicSettings(ctx context.Context, d *DB, nodeDomain string) error {
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO public_settings (node_domain, site_title, site_subtitle, primary_color, secondary_color,
			contact_email, contact_address, social_instagram, social_facebook, show_join_form,
			header_style, announcement_text, show_announcement, footer_style,
			footer_about, footer_schedule, footer_col2_title, footer_col3_title, footer_col4_title,
			footer_slogan, footer_admission_text, admission_form_title, admission_form_subtitle)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true,
			'modern_eco', '🌱 Ecoaldea Raices del Monte - Asamblea mensual primer domingo de cada mes', true, 'columns',
			'Comunidad montana de 28 familias dedicadas a la permacultura, agroecologia e intercambio comunitario. 15 anios construyendo un modelo de vida sostenible.',
			'Asamblea mensual: primer domingo de cada mes. Puertas abiertas a visitantes.',
			'Paginas del Nodo', 'Nuestra Ubicacion', 'Comunidad & Redes',
			'Permacultura, Energia Solar, Trueque Comunitario',
			'Solicitar Ingreso a la Ecoaldea',
			'Solicitud de Ingreso a Raices del Monte',
			'Completa tus datos para postularte como miembro de la ecoaldea.')
		ON CONFLICT (node_domain) DO UPDATE SET
			site_title = EXCLUDED.site_title,
			site_subtitle = EXCLUDED.site_subtitle,
			announcement_text = EXCLUDED.announcement_text,
			show_announcement = EXCLUDED.show_announcement,
			footer_about = EXCLUDED.footer_about,
			footer_schedule = EXCLUDED.footer_schedule,
			footer_slogan = EXCLUDED.footer_slogan,
			admission_form_title = EXCLUDED.admission_form_title,
			admission_form_subtitle = EXCLUDED.admission_form_subtitle`,
		nodeDomain,
		"Ecoaldea Raices del Monte",
		"Comunidad montana de permacultura e intercambio",
		"#2d5016",
		"#8B4513",
		"contacto@raicesdelmonte.org",
		"Montanas, zona rural",
		"raicesdelmonte",
		"raicesdelmonte",
	)
	if err != nil {
		return fmt.Errorf("insert public_settings: %w", err)
	}
	return nil
}

func demoSeedPages(ctx context.Context, d *DB, nodeDomain string) error {
	// Paginas del sistema (como-funciona, metodologia-energetica, productos, ecoaldeas-mundo)
	// se reutilizan del seed principal con reemplazos de terminos Feria Conuquera.
	// Paginas comunitarias (inicio, quienes-somos, filosofia, comunidad, etc.)
	// tienen contenido personalizado de Ecoaldea Raices del Monte.

	// Mapeo de slugs -> pagina personalizada de Raices del Monte
	customPages := getRaicesDelMontePages()

	// Mapeo de slugs -> pagina del sistema (reutilizada del seed principal con reemplazos)
	systemPageSlugs := map[string]bool{
		"como-funciona":          true,
		"metodologia-energetica": true,
		"productos":              true,
		"ecoaldeas-mundo":        true,
	}

	// Construir lista final de paginas
	var pages []seedPage

	// 1. Paginas personalizadas de Raices del Monte
	for _, p := range customPages {
		pages = append(pages, p)
	}

	// 2. Paginas del sistema reutilizadas del seed principal
	for _, p := range getSeedPages() {
		if systemPageSlugs[p.Slug] {
			content := replaceFeriaTerms(p.Content)
			title := replaceFeriaTerms(p.Title)
			subtitle := replaceFeriaTerms(p.Subtitle)
			pages = append(pages, seedPage{
				Slug:      p.Slug,
				Title:     title,
				Subtitle:  subtitle,
				Content:   content,
				Icon:      p.Icon,
				MenuOrder: p.MenuOrder,
			})
		}
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

// replaceFeriaTerms reemplaza terminos especificos de Feria Conuquera por
// terminos genericos aplicables a cualquier ecoaldea. Esto permite reutilizar
// las paginas del sistema (que explican el TQ, la calculadora, etc.) sin
// que contengan referencias a la Feria Conuquera.
func replaceFeriaTerms(s string) string {
	replacements := []struct{ from, to string }{
		{"Feria Conuquera Agroecol\u00f3gica", "Ecoaldea Raices del Monte"},
		{"Feria Conuquera Agroecológica", "Ecoaldea Raices del Monte"},
		{"Feria Conuquera", "Ecoaldea Raices del Monte"},
		{"feria conuquera", "ecoaldea"},
		{"feriaconuquera", "raicesdelmonte"},
		{"Parque Los Caobos", "la ecoaldea"},
		{"Los Caobos", "la ecoaldea"},
		{"Caracas", "las montanas"},
		{"primer s\u00e1bado de cada mes", "primer domingo de cada mes"},
		{"primer sábado de cada mes", "primer domingo de cada mes"},
		{"Distrito Capital", "zona montana"},
		{"Dto. Capital", "zona montana"},
		{"Miranda", "montanas"},
		{"El Junquito", "la ecoaldea"},
		{"La Pastora", "la ecoaldea"},
		{"Baruta", "la ecoaldea"},
		{"Valles del Tuy", "la ecoaldea"},
		{"El Hatillo", "la ecoaldea"},
		{"El \u00c1vila", "el monte"},
		{"El Ávila", "el monte"},
		{"29 de Octubre de 2014", "2010"},
		{"Octubre 2014", "2010"},
		{"octubre 2014", "2010"},
		{"10 A\u00f1os", "15 A\u00f1os"},
		{"10 años", "15 años"},
		{"10 a\u00f1os", "15 a\u00f1os"},
		{"10 años de Encuentro", "15 años de comunidad"},
		{"conuquero", "comunitario"},
		{"conuquera", "comunitaria"},
		{"conuco", "huerto comunitario"},
		{"Conuco", "Huerto comunitario"},
		{"Botica Conuquera", "Botica Natural"},
		{"Aula Conuquera", "Aula Comunitaria"},
		{"Cayapa Conuquera", "Cayapa Comunitaria"},
		{"Filosof\u00eda Conuquera", "Filosofia Comunitaria"},
		{"Filosofía Conuquera", "Filosofia Comunitaria"},
		{"Cosmovisi\u00f3n Conuquera", "Cosmovision Comunitaria"},
		{"Cosmovisión Conuquera", "Cosmovision Comunitaria"},
		{"Vocer\u00eda Colectiva de la Feria Conuquera", "Asamblea de Raices del Monte"},
		{"Vocería Colectiva de la Feria Conuquera", "Asamblea de Raices del Monte"},
		{"feriaconuquera.org", "raicesdelmonte.org"},
		{"@feriaconuquera", "@raicesdelmonte"},
		{"Cafunga de Barlovento", "pan de quinua artesanal"},
		{"Barlovento", "la ecoaldea"},
		{"Chuao", "la ecoaldea"},
		{"Carayaca", "la ecoaldea"},
		{"Camino de los Españoles", "sendero del monte"},
		{"Km 38", "zona alta"},
		{"Puerta Caracas", "la ecoaldea"},
		{"AVIVIR La Limonera", "huerto comunitario"},
		{"Centro Agro Catia", "huerto comunitario"},
		{"Catia", "la ecoaldea"},
		{"Ley de Semillas de Venezuela", "soberania de semillas"},
		{"Movimiento Semillas del Pueblo", "movimiento de semillas libres"},
		{"Cruz de Mayo", "celebracion de la tierra"},
		{"Pachamama", "la Madre Tierra"},
		{"Argentina", "comunidades del sur"},
		{"Wilson Dam", "proyectos hidroelectricos"},
		{"Muscle Shoals", "comunidades energeticas"},
		{"Alabama", "comunidades rurales"},
	}
	for _, r := range replacements {
		s = strings.ReplaceAll(s, r.from, r.to)
	}
	return s
}

// getRaicesDelMontePages devuelve las paginas comunitarias personalizadas
// de Ecoaldea Raices del Monte. Las paginas del sistema (como-funciona,
// metodologia-energetica, productos, ecoaldeas-mundo) se reutilizan del
// seed principal con reemplazos de terminos.
func getRaicesDelMontePages() []seedPage {
	return []seedPage{
		{
			Slug:      "inicio",
			Title:     "Ecoaldea Raices del Monte",
			Subtitle:  "Comunidad montana de permacultura e intercambio",
			Icon:      "home",
			MenuOrder: 1,
			Content: `[
  {
    "type": "hero",
    "badge": "Ecoaldea Federada - 15 anos regenerando el monte",
    "title": "Ecoaldea Raices del Monte",
    "subtitle": "Una comunidad montana que vive en armonia con la tierra",
    "description": "Somos una ecoaldea de 28 familias en las montanas, dedicadas a la permacultura, la agroecologia y el intercambio comunitario. Desde 2010 hemos regenerado suelo, plantado bosques nativos y construido un sistema de economia interna basado en el Trueque Comunitario (TQ), donde cada producto vale lo que realmente cuesta producir en energia.",
    "image_url": "/images/demo/ecoaldea-aerial.jpg",
    "primary_cta": { "text": "Ver Catalogo", "link": "/p/productos" },
    "secondary_cta": { "text": "Conocenos", "link": "/p/quienes-somos" },
    "style": "split"
  },
  {
    "type": "stats",
    "title": "Nuestra Comunidad en Numeros",
    "subtitle": "15 anos construyendo un modelo de vida sostenible",
    "bg_theme": "primary",
    "items": [
      { "value": "28", "label": "Familias", "description": "Viviendo en la ecoaldea, unas 95 personas" },
      { "value": "120", "label": "Hectareas", "description": "60% bosque protegido, 30% cultivo, 10% vivienda" },
      { "value": "15", "label": "Anos", "description": "Como comunidad organizada desde 2010" },
      { "value": "100%", "label": "Energia Solar", "description": "Paneles solares y cocinas solares, cero fossil" },
      { "value": "2000", "label": "Arboles/ano", "description": "Reforestacion con especies nativas" },
      { "value": "7", "label": "Comisiones", "description": "Economia, Educacion, Salud, Ambiente y mas" }
    ]
  },
  {
    "type": "carousel",
    "title": "Galeria de la Ecoaldea",
    "subtitle": "Postales de nuestra vida comunitaria en las montanas.",
    "autoplay": true,
    "items": [
      {
        "image_url": "/images/demo/bosque-regenerado.jpg",
        "title": "Bosque Regenerado",
        "caption": "15 anos de reforestacion con especies nativas han devuelto el agua a los manantiales.",
        "tag": "Regeneracion"
      },
      {
        "image_url": "/images/demo/huertos-bancales.jpg",
        "title": "Huertos en Bancales",
        "caption": "Permacultura en bancales elevados siguiendo curvas de nivel para conservar suelo y agua.",
        "tag": "Permacultura"
      },
      {
        "image_url": "/images/demo/pan-quinua.jpg",
        "title": "Pan de Quinua",
        "caption": "Panaderia comunitaria con granos andinos cultivados en altura.",
        "tag": "Soberania"
      },
      {
        "image_url": "/images/demo/energia-solar.jpg",
        "title": "Energia Solar",
        "caption": "Paneles fotovoltaicos y secadores solares. Cero dependencia de combustibles fosiles.",
        "tag": "Autonomia"
      }
    ]
  },
  {
    "type": "features_grid",
    "title": "Que hacemos",
    "subtitle": "Cuatro areas de trabajo comunitario",
    "columns": 3,
    "items": [
      { "icon": "leaf", "title": "Permacultura", "description": "Disenamos sistemas alimentarios que imitan los patrones de la naturaleza. Huertos en espiral, bancales elevados, agroforesteria con especies nativas, conservacion de semillas criollas.", "badge": "Cultivo" },
      { "icon": "droplet", "title": "Agua y Bosque", "description": "Captacion de agua de lluvia, tratamiento con plantas acuaticas, reforestacion con 2000 arboles nativos por ano. Manantiales protegidos y acequias de infiltracion.", "badge": "Regeneracion" },
      { "icon": "sun", "title": "Energia Renovable", "description": "Paneles solares fotovoltaicos, cocinas solares parabolicas, secadores solares para frutas y hierbas. Cero dependencia de combustibles fosiles.", "badge": "Autonomia" },
      { "icon": "users", "title": "Gobernanza", "description": "Asambleas mensuales por consentimiento sociocratico. 7 comisiones autonomas. Toma de decisiones horizontal donde todas las voces son escuchadas.", "badge": "Sociocracia" },
      { "icon": "heart", "title": "Salud Natural", "description": "Centro de salud con medicina herbalista, tes del monte, aceites esenciales. Prevencion y cuidado mutuo. Nadie enfrenta solo una enfermedad.", "badge": "Cuidado" },
      { "icon": "book", "title": "Educacion", "description": "Escuela primaria comunitaria donde estudian los ninos. Talleres permanentes de permacultura, bioconstruccion y artesania para adultos.", "badge": "Aprendizaje" }
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Participa",
    "title": "Quieres visitarnos o sumarte?",
    "subtitle": "Recibimos visitantes, voluntarios y nuevos miembros. Organizamos jornadas de puertas abiertas cada primer domingo de mes.",
    "button_text": "Contactanos",
    "button_link": "/p/contacto",
    "secondary_text": "Preguntas Frecuentes",
    "secondary_link": "/p/faq",
    "theme": "forest"
  }
]`,
		},
		{
			Slug:      "quienes-somos",
			Title:     "Quienes Somos",
			Subtitle:  "Nuestra historia, valores y forma de vida",
			Icon:      "heart",
			MenuOrder: 2,
			Content: `[
  {
    "type": "hero",
    "badge": "Nuestra Historia",
    "title": "De finca ganadera degradada a ecoaldea regenerativa",
    "subtitle": "15 anos transformando la tierra y la comunidad",
    "description": "Raices del Monte nacio en 2010 cuando cinco familias adquirieron una finca ganadera que habia perdido su capa vegetal y buena parte de su biodiversidad. El suelo estaba compactado, los manantiales secos, el bosque reducido a parches. Poco a poco fuimos regenerando: plantamos arboles nativos, construimos bancales, instalamos sistemas de captacion de agua, sembramos huertos y creamos un sistema de intercambio interno basado en el contenido energetico real de cada producto.",
    "image_url": "/images/demo/restauracion-tierra.jpg",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "Como vivimos",
    "title": "Bioconstruccion y espacios comunes",
    "subtitle": "Viviendas de adobe, bahareque y madera local",
    "content": "Las viviendas son de bioconstruccion: adobe, bahareque, paja y madera local. Cada familia tiene su casa y un huerto. Tenemos espacios comunes: el comedor comunitario donde almorzamos juntos tres veces por semana, la escuela primaria donde estudian los ninos de la comunidad, el centro de salud natural, la herreria, el taller textil y la panaderia. El 60% del territorio es bosque protegido donde solo se extrae madera muerta. El 30% son cultivos en bancales, agroforesteria y huertos. El 10% es vivienda e infraestructura.",
    "image_url": "/images/demo/bioconstruccion-adobe.jpg",
    "image_position": "left",
    "highlights": [
      "Viviendas de adobe, bahareque y madera local construidas comunitariamente.",
      "Comedor comunitario: almorzamos juntos tres veces por semana.",
      "Escuela primaria comunitaria para los ninos de la ecoaldea.",
      "Centro de salud natural con medicina herbalista.",
      "60% del territorio es bosque protegido."
    ],
    "quote": {
      "text": "No heredamos la tierra de nuestros padres, la tomamos prestada de nuestros hijos. Por eso la regeneramos, no solo la sostenemos.",
      "author": "Asamblea de Raices del Monte"
    }
  },
  {
    "type": "features_grid",
    "title": "Nuestros Valores",
    "subtitle": "Los principios que guian nuestra vida comunitaria",
    "columns": 3,
    "items": [
      { "icon": "heart", "title": "Cuidado Mutuo", "description": "Nos cuidamos entre todos. La salud, la educacion y la alimentacion son responsabilidades compartidas, no individuales. Nadie enfrenta solo una enfermedad, una perdida o un problema.", "badge": "Comunidad" },
      { "icon": "leaf", "title": "Regeneracion", "description": "No solo sostenemos, regeneramos. Cada ano el bosque crece, el suelo mejora, el agua es mas abundante. Dejamos el lugar mejor de lo que lo encontramos.", "badge": "Tierra" },
      { "icon": "scale", "title": "Justicia Economica", "description": "El TQ (Trueque Comunitario) se basa en la energia real de cada producto. Nadie se enriquece a expensas de otros. El trabajo de todos vale lo mismo por hora.", "badge": "Equidad" },
      { "icon": "users", "title": "Autonomia", "description": "Tomamos nuestras propias decisiones en asamblea. No dependemos de bancos, ni de gobiernos, ni de corporaciones. Somos autosuficientes en lo basico.", "badge": "Libertad" },
      { "icon": "globe", "title": "Federacion", "description": "No estamos solos. Comerciamos e intercambiamos con otras ecoaldeas federadas. La solidaridad entre comunidades es nuestra red de seguridad.", "badge": "Red" },
      { "icon": "book", "title": "Aprendizaje Permanente", "description": "Aprendemos de la naturaleza y de las tradiciones campesinas. Compartimos lo que sabemos. Recibimos voluntarios y visitantes.", "badge": "Saberes" }
    ]
  },
  {
    "type": "timeline_history",
    "badge": "Hitos",
    "title": "Nuestra Linea de Tiempo",
    "subtitle": "15 anos de regeneracion, comunidad y soberania.",
    "items": [
      { "year": "2010", "title": "Nacimiento de Raices del Monte", "description": "Cinco familias adquieren una finca ganadera degradada en las montanas y comienzan la regeneracion del suelo y el bosque.", "badge": "Fundacion" },
      { "year": "2012", "title": "Primeros Huertos y Bancales", "description": "Construimos los primeros bancales elevados siguiendo curvas de nivel. Empezamos a producir el 30% de nuestra alimentacion.", "badge": "Permacultura" },
      { "year": "2015", "title": "Sistema TQ Implementado", "description": "Creamos el Trueque Comunitario basado en energia. Cada producto vale lo que cuesta producir en kWh. Sin dinero, sin inflacion, sin interes.", "badge": "Economia" },
      { "year": "2018", "title": "Autonomia Energetica", "description": "Instalamos paneles solares fotovoltaicos y cocinas solares. Alcanzamos 100% de energia renovable, cero fossil.", "badge": "Energia" },
      { "year": "2021", "title": "Federacion con Otras Ecoaldeas", "description": "Nos federamos con otras comunidades usando el mismo sistema. Comercio multilateral con autonomia total.", "badge": "Federacion" },
      { "year": "2025", "title": "15 Anos de Regeneracion", "description": "Celebramos una decada y media. El bosque se ha duplicado, los manantiales fluyen, 28 familias viven en comunidad.", "badge": "Presente" }
    ]
  },
  {
    "type": "testimonials",
    "title": "Familias Fundadoras",
    "subtitle": "Algunas de las experiencias que hacen vida en la ecoaldea.",
    "items": [
      {
        "name": "Familia Rojas",
        "role": "Fundadores - Nivel Raiz",
        "project": "Huerto de altura y panaderia de quinua",
        "quote": "Llegamos en 2010 con nada mas que ganas de cambiar nuestra vida. Hoy producimos el 90% de lo que comemos y hemos visto volver los manantiales que estaban secos.",
        "location": "Zona alta de la ecoaldea"
      },
      {
        "name": "Familia Mendez",
        "role": "Miembros Tronco - 10 anos",
        "project": "Apicultura y miel de montana",
        "quote": "La ecoaldea nos enseno que la abundancia no viene del dinero, viene de la diversidad. Donde antes habia pasto para ganado, ahora hay bosque, abejas y agua.",
        "location": "Zona del bosque"
      }
    ]
  }
]`,
		},
		{
			Slug:      "filosofia",
			Title:     "Historia y Organizacion",
			Subtitle:  "Nuestra Trayectoria, Asambleas y Vida Comunitaria",
			Icon:      "heart",
			MenuOrder: 3,
			Content: `[
  {
    "type": "hero",
    "badge": "Nacidos en 2010",
    "title": "Un Movimiento al Calor de la Tierra",
    "subtitle": "La permacultura como horizonte ecologico, social y espiritual de soberania integral.",
    "description": "Nacimos en un momento crucial de la historia ambiental, al calor de los movimientos de soberania alimentaria y regeneracion ecologica. La ecoaldea es tanto un hogar como una organizacion viva con asambleas y comisiones activas.",
    "image_url": "/images/demo/permacultura-manos.jpg",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "Estructura y Organizacion",
    "title": "Vida Organizativa Mas Alla del Huerto",
    "subtitle": "Asambleas mensuales, comisiones y trabajo colectivo",
    "content": "Raices del Monte no es solo un conjunto de viviendas. Contamos con una estructura organizativa solida y horizontal:\n\nAsambleas Mensuales: Cada primer domingo de mes, todos los miembros plenos se reunen en asamblea formal para evaluar el funcionamiento, admitir nuevos miembros y debatir politicas colectivas.\nComisiones de Trabajo: Se conforman comisiones para economia, educacion, salud, ambiente, admision, construccion y consejo de vision. Cada comision es autonoma en su area.\nCayapas Comunitarias: Organizamos jornadas de trabajo voluntario para mantenimiento de senderos, reforestacion, construccion y limpieza de acequias.",
    "image_url": "/images/demo/asamblea-comunitaria.jpg",
    "image_position": "left",
    "highlights": [
      "Asamblea general mensual para toma de decisiones por consentimiento.",
      "7 comisiones autonomas con doble enlace sociocratico.",
      "Cayapas comunitarias: trabajo voluntario para proyectos colectivos.",
      "Consejo de Vision: custodia los valores fundacionales."
    ],
    "quote": {
      "text": "La tierra nos ensena que la abundancia nace de la diversidad y la organizacion comunitaria.",
      "author": "Asamblea de Raices del Monte"
    }
  },
  {
    "type": "features_grid",
    "title": "Estructura Organizativa",
    "subtitle": "Como se organiza la ecoaldea mas alla del huerto",
    "columns": 2,
    "items": [
      { "icon": "users", "title": "Asamblea General", "description": "Mensual, primer domingo de cada mes. Todos los miembros con voz. Decisiones estrategicas: presupuesto, admisiones, grandes cambios.", "badge": "Mensual" },
      { "icon": "network", "title": "7 Comisiones", "description": "Economia, Educacion, Salud, Ambiente, Admision, Construccion y Consejo de Vision. Cada una es autonoma en su area con doble enlace sociocratico.", "badge": "Autonomas" },
      { "icon": "scale", "title": "Consejo de Vision", "description": "Tres miembros Raiz que custodian la vision y valores fundacionales. No gobiernan, sino que recuerdan por que estamos aqui.", "badge": "Vision" },
      { "icon": "clipboard", "title": "Protocolos Documentados", "description": "Cada decision se documenta en actas. Los acuerdos son revisables y mejorables. Nada es permanente: todo puede ser evaluado.", "badge": "Actas" }
    ]
  },
  {
    "type": "features_grid",
    "title": "Trabajo Comunitario",
    "subtitle": "Como contribuimos al funcionamiento de la ecoaldea",
    "columns": 1,
    "items": [
      { "icon": "tool", "title": "Cayapa Semanal (8 horas)", "description": "Cada miembro adulto aporta 8 horas semanales de trabajo comunitario: mantenimiento de senderos, reforestacion, construccion, limpieza de acequias, o tareas asignadas por comisiones. Este trabajo se registra en TQ al valor estandar de 10 TQ por hora. Es la base de nuestra economia: el trabajo comunitario genera TQ que despues se intercambian por productos.", "badge": "8h/semana" }
    ]
  }
]`,
		},
		{
			Slug:      "comunidad",
			Title:     "Comunidad y Saberes",
			Subtitle:  "Talleres, Cultura, Semillas y Asambleas",
			Icon:      "users",
			MenuOrder: 4,
			Content: `[
  {
    "type": "hero",
    "badge": "Aula Abierta, Cultura y Vida Comunitaria",
    "title": "Mas que una Ecoaldea: Espacio de Formacion Permanente",
    "subtitle": "Talleres gratuitos, musica, trueque de semillas y saberes para toda la comunidad.",
    "description": "Inspirados en la metodologia de campesino a campesino, cada mes realizamos actividades pedagogicas gratuitas para compartir conocimientos de permacultura, bioconstruccion, salud natural y artesania. La educacion es continua: no solo aprendes a producir, aprendes a vivir en comunidad.",
    "image_url": "/images/demo/taller-permacultura.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Actividades Permanentes en la Ecoaldea",
    "subtitle": "Dinamicas formativas y culturales en cada encuentro.",
    "columns": 3,
    "items": [
      { "icon": "leaf", "title": "Trueque de Semillas Criollas", "description": "Mesa comunitaria de intercambio de semillas nativas y locales. Trae las tuyas y llevate variedades adaptadas a la altura sin costo alguno.", "badge": "Intercambio" },
      { "icon": "heart", "title": "Biblioteca Comunitaria", "description": "Punto de intercambio de libros sobre permacultura, agroecologia, novelas y poesia. Llevate un libro con el compromiso de seguir compartiendo el saber.", "badge": "Lectura" },
      { "icon": "users", "title": "Talleres de Permacultura", "description": "Talleres practicos en vivo: diseno de bancales, compostaje, biofertilizantes, captacion de agua, bioconstruccion con adobe y bahareque.", "badge": "Talleres" },
      { "icon": "music", "title": "Musica y Expresiones Culturales", "description": "Musica comunitaria, cantos, poesia y storytelling alrededor del fuego. La ecoaldea es celebracion: no solo se trabaja, se canta y se comparte.", "badge": "Cultura" },
      { "icon": "scale", "title": "Dinamicas Infantiles", "description": "Juegos educativos, exploracion de la naturaleza y actividades recreativas al aire libre para los ninos de la comunidad y visitantes.", "badge": "Familia" },
      { "icon": "home", "title": "Asambleas y Cayapas", "description": "Asambleas mensuales para la toma de decisiones por consentimiento. Cayapas: jornadas de trabajo colectivo para reforestacion, construccion y mantenimiento.", "badge": "Organizacion" }
    ]
  },
  {
    "type": "features_grid",
    "title": "Educacion Comunitaria",
    "subtitle": "Como aprendemos y ensenamos en la ecoaldea",
    "columns": 2,
    "items": [
      { "icon": "book", "title": "Escuela Primaria", "description": "Los ninos de la ecoaldea estudian en nuestra escuela primaria comunitaria. Aprenden lectoescritura, matematicas y ciencias, pero tambien permacultura, observacion de la naturaleza y valores comunitarios. La pedagogia es activa: aprenden haciendo.", "badge": "Ninos" },
      { "icon": "users", "title": "Talleres para Adultos", "description": "Talleres permanentes de permacultura, bioconstruccion, apicultura, panaderia, medicina natural y artesania. Todos pueden ensenar y todos pueden aprender. El saber circula.", "badge": "Adultos" },
      { "icon": "globe", "title": "Voluntarios y Visitantes", "description": "Recibimos voluntarios que quieran aprender permacultura, bioconstruccion o agroecologia. Intercambiamos saber por trabajo. Los visitantes pueden venir a las jornadas de puertas abiertas.", "badge": "Abierto" },
      { "icon": "leaf", "title": "Dialogo de Saberes", "description": "Combinamos el conocimiento cientifico con la sabiduria tradicional. Los abuelos ensenan a seleccionar semillas y predecir el clima; los jovenes aportan tecnologia, documentacion y experimentacion.", "badge": "Dialogo" }
    ]
  }
]`,
		},
		{
			Slug:      "economia",
			Title:     "Economia Comunitaria",
			Subtitle:  "Como funciona el Trueque Comunitario (TQ)",
			Icon:      "scale",
			MenuOrder: 5,
			Content: `[
  {
    "type": "hero",
    "badge": "Trueque Comunitario",
    "title": "El TQ: moneda energetica, no dinero",
    "subtitle": "No es dinero. No es cripto. No genera interes. Es energia.",
    "description": "El TQ (Trueque Comunitario) es nuestra unidad de intercambio interno. Se calcula en base al contenido energetico real de cada producto o servicio, medido en kWh o joules. Un kilo de frijol vale 35 TQ porque eso es lo que cuesta producirlo en energia humana, solar y de insumos. Sin inflacion, sin interes, sin bancos, sin devaluacion. Un TQ hoy vale lo mismo que en 10 anos.",
    "image_url": "/images/demo/mercado-comunitario.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Principios del TQ",
    "subtitle": "Lo que hace diferente a nuestra moneda",
    "columns": 2,
    "items": [
      { "icon": "zap", "title": "Basado en Energia Real", "description": "Cada producto vale lo que cuesta producirlo en energia: humana (trabajo), solar (paneles, secadores), de insumos (semillas, agua, compost). El precio lo calcula la Calculadora Energetica.", "badge": "Energia" },
      { "icon": "ban", "title": "Sin Inflacion", "description": "La energia no se devalua. Un TQ hoy vale lo mismo que en 10 anos. No hay emision de dinero nuevo sin respaldo energetico.", "badge": "Estable" },
      { "icon": "ban", "title": "Sin Interes", "description": "No hay prestamos con interes. Si necesitas credito, la asamblea lo aprueba sin costo financiero. El fondo comunitario respalda los creditos.", "badge": "Sin usura" },
      { "icon": "globe", "title": "Federable", "description": "Podemos intercambiar con otras ecoaldeas federadas usando los mismos principios energeticos. El comercio entre nodos respeta la autonomia de cada comunidad.", "badge": "Red" },
      { "icon": "scale", "title": "Justo", "description": "El trabajo de todos vale lo mismo por hora: 10 TQ. Nadie cobra mas por hacer trabajo intelectual vs manual. La diferencia esta en las horas, no en la tarifa.", "badge": "Equidad" },
      { "icon": "shield", "title": "Transparente", "description": "Todas las transacciones son publicas dentro de la comunidad. Cualquier miembro puede auditar el libro de transacciones.", "badge": "Auditable" }
    ]
  },
  {
    "type": "trueque_explainer",
    "title": "Los 4 Pasos del Credito Mutuo",
    "subtitle": "Comprende la logica solidaria y transparente del sistema de trueque.",
    "energy_rate_text": "Valor de referencia objetivo: 1 TQ = 1 kWh de energia",
    "steps": [
      {"step":1,"title":"Empiezas en Cero (0 TQ)","description":"Al ingresar formalmente a la ecoaldea, tu cuenta inicia en balance 0. No necesitas comprar monedas, pagar inscripcion ni aportar capital. Tampoco necesitas tener nada ahorrado para empezar a recibir beneficios.","icon":"users"},
      {"step":2,"title":"Al Recibir Bienes en Trueque","description":"Tu cuenta registra saldo negativo (-TQ). No es una deuda financiera: es un compromiso etico de entregar productos o trabajo futuro a la comunidad. Puedes recibir alimentos, medicinas naturales, servicios o artesania sin tener saldo positivo previo.","icon":"shopping-cart"},
      {"step":3,"title":"Al Aportar Cosecha o Trabajo","description":"Tu cuenta registra saldo positivo (+TQ). Significa que has entregado valor a la comunidad y puedes adquirir bienes de otros miembros. Cada vez que aportas, tu saldo sube; cada vez que recibes, baja.","icon":"leaf"},
      {"step":4,"title":"La Suma Total Siempre es Cero","description":"El total de todas las cuentas de la ecoaldea da exactamente 0 TQ. No existe inflacion, devaluacion ni intermediarios bancarios. Nadie emite moneda: cada intercambio crea un saldo positivo y uno negativo equivalente.","icon":"scale"}
    ],
    "key_points": {
      "positive_balance": "Indica que has aportado mas de lo que has recibido. Tienes derecho a recibir bienes o labores equivalentes de otros miembros en el futuro.",
      "negative_balance": "Es un compromiso adquirido: has recibido sustento de la comunidad y lo retribuiras con tu propia cosecha, productos o trabajo. No hay verguenza en tener saldo negativo: es la prueba de que el sistema funciona.",
      "zero_sum": "No es dinero bancario ni financiero: es un registro contable de compromisos adquiridos y aportes reciprocos. Permite el trueque diferido y multilateral."
    }
  },
  {
    "type": "features_grid",
    "title": "Limites y Creditos",
    "subtitle": "El sistema crece contigo: entre mas participas, mas confianza acumulas",
    "columns": 3,
    "items": [
      { "icon": "users", "title": "Miembros Nuevos (Brote)", "description": "Limite simetrico de -500/+500 TQ. Cubre una canasta basica familiar mensual. Es la confianza inicial que la comunidad te otorga.", "badge": "500 TQ" },
      { "icon": "leaf", "title": "Miembros Activos (Rama/Tronco)", "description": "Limite de -1500/+1500 a -3000/+3000 TQ segun el nivel. Mas participacion, mas confianza, mas capacidad de intercambio.", "badge": "1500-3000 TQ" },
      { "icon": "shield", "title": "Fundadores (Raiz)", "description": "Limite de -5000/+5000 TQ. Los fundadores tienen mayor capacidad porque han demostrado compromiso durante mas de una decada.", "badge": "5000 TQ" }
    ]
  },
  {
    "type": "calculator_preview",
    "title": "Simula el Valor Energetico de tu Produccion",
    "subtitle": "Prueba como se calcula el valor objetivo segun horas de trabajo y factores de esfuerzo."
  }
]`,
		},
		{
			Slug:      "gobernanza",
			Title:     "Gobernanza de la Ecoaldea",
			Subtitle:  "Como se Gobierna, Quien Decide, Que se Puede y Que No",
			Icon:      "scale",
			MenuOrder: 6,
			Content: `[
  {
    "type": "hero",
    "badge": "Ley de la Ecoaldea",
    "title": "Gobernanza Sociocratica de Raices del Monte",
    "description": "La ecoaldea se gobierna por consentimiento, no por mayoria. Las decisiones se toman en circulos operativos semi-autonomos y en la Asamblea General mensual. Aqui encontraras la estructura de gobierno, tus deberes, lo que esta permitido, lo que esta prohibido y como se resuelven los conflictos.",
    "theme": "forest"
  },
  {
    "type": "features_grid",
    "title": "Estructura de Gobernanza",
    "subtitle": "Como se organiza la toma de decisiones en la ecoaldea",
    "columns": 3,
    "items": [
      {"icon":"users","title":"Asamblea General","description":"Organo maximo de decision. Se reune mensualmente, primer domingo de cada mes. Todos los miembros plenos tienen voz y voto. Las decisiones se toman por consentimiento sociocratico: una propuesta se aprueba cuando nadie presenta una objecion razonada. Lema: Suficientemente bueno por ahora, seguro para intentar.","badge":"Mensual"},
      {"icon":"circle","title":"7 Comisiones","description":"Gobernanza dividida en comisiones semi-autonomas: Economia, Educacion, Salud, Ambiente, Admision, Construccion y Consejo de Vision. Cada comision gestiona su area sin esperar aprobacion de la asamblea para decisiones operativas.","badge":"Semi-autonomas"},
      {"icon":"briefcase","title":"Junta Directiva del Nodo","description":"Organo ejecutivo. Compuesto por miembros elegidos por consentimiento: Coordinador General, Tesorero, Secretario y Coordinadores de cada comision. Los cargos duran 1 ano y son revocables por la asamblea.","badge":"Ejecutivo"},
      {"icon":"link","title":"Doble Enlace Sociocratico","description":"Cada comision elige dos personas que la conectan con la Asamblea: un Coordinador (informacion de arriba hacia abajo) y un Delegado (inquietudes de la comision hacia la asamblea). Garantiza flujo bidireccional de informacion.","badge":"Flujo"},
      {"icon":"building","title":"Organizaciones","description":"Colectivos de produccion, consumo o servicios registrados en el sistema: Grupo de Produccion, Grupo de Consumo, Comision, Proyecto, Cooperativa. Tienen su propia junta directiva y limites simetricos mas amplios.","badge":"Colectivos"},
      {"icon":"folder","title":"Departamentos","description":"Unidades administrativas con roles y permisos especificos. Cada departamento tiene un jefe, miembros asignados y roles con permisos granulares. Los departamentos se mapean a las comisiones operativas.","badge":"Administrativo"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Deberes de los Miembros",
    "subtitle": "Obligaciones que asume cada miembro al unirse a la ecoaldea",
    "columns": 2,
    "items": [
      {"icon":"leaf","title":"Produccion Agroecologica","description":"Toda siembra en huertos familiares y comunes debe ser 100% agroecologica: libre de agroquimicos y semillas transgenicas. Solo se permite compost, bioinsumos, microorganismos eficientes y abonos verdes.","badge":"Obligatorio"},
      {"icon":"tool","title":"Cayapa Semanal","description":"Cada miembro adulto debe aportar un minimo de 8 horas semanales de trabajo en proyectos comunes: mantenimiento de senderos, siembra comunitaria, cuidado de animales, reparacion de la microrred o cocina comun. Estas horas se registran en la cuenta TQ.","badge":"8h/semana"},
      {"icon":"coins","title":"Uso Exclusivo de TQ","description":"Todo intercambio comercial dentro de la ecoaldea debe realizarse exclusivamente mediante la plataforma contable TQ. No se permite usar dinero fiat para transacciones internas.","badge":"Solo TQ"},
      {"icon":"sprout","title":"Banco de Semillas","description":"Cada miembro debe participar en el Banco de Semillas devolviendo un porcentaje superior de semillas nativas tras cada cosecha para que la reserva crezca.","badge":"Semillas"},
      {"icon":"calendar","title":"Asistencia a Asambleas","description":"La asistencia a las asambleas mensuales es obligatoria. Tres faltas injustificadas consecutivas son una falta leve.","badge":"Mensual"},
      {"icon":"droplet","title":"Cuidado del Agua","description":"Cada miembro debe mantener limpias las acequias y reservorios de su zona, usar sanitarios secos y no contaminar los manantiales. El agua es sagrada.","badge":"Agua"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Lo Que Esta Prohibido",
    "subtitle": "Reglas claras para proteger la comunidad y la tierra",
    "columns": 2,
    "items": [
      {"icon":"ban","title":"Agroquimicos y transgenicos","description":"Esta terminantemente prohibido el uso de fertilizantes sinteticos, plaguicidas, herbicidas y semillas transgenicas. La tierra es un ser vivo: no la envenenamos.","badge":"Prohibido"},
      {"icon":"ban","title":"Dinero fiat en transacciones internas","description":"No se permite usar bolivares, dolares ni ninguna moneda oficial para transacciones dentro de la ecoaldea. Todo intercambio interno es en TQ.","badge":"Prohibido"},
      {"icon":"ban","title":"Plastico desechable","description":"No se permite el uso de bolsas, envases ni utensilios plasticos desechables. Trae tus propios recipientes, morrales y canastas.","badge":"Prohibido"},
      {"icon":"ban","title":"Tala de bosque nativo","description":"El 60% del territorio es bosque protegido. Solo se extrae madera muerta. Talar arboles vivos del bosque es una falta grave.","badge":"Prohibido"},
      {"icon":"ban","title":"Acumulacion de TQ","description":"Existe un techo positivo: si alcanzas el limite, debes gastar o reinvertir antes de recibir mas. Nadie puede acumular riqueza indefinidamente.","badge":"Prohibido"},
      {"icon":"ban","title":"Violencia y discriminacion","description":"No se permite ninguna forma de violencia fisica, verbal o psicologica. No se discrimina por genero, edad, orientacion, etnia ni creencias. La expulsion es inmediata.","badge":"Prohibido"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Niveles de Membresia",
    "subtitle": "Como creces dentro de la comunidad",
    "columns": 2,
    "items": [
      {"icon":"sparkles","title":"Brote (0-6 meses)","description":"Recien ingresado. Voz en asamblea pero sin voto. Limite -500/+500 TQ. Periodo de prueba: la comunidad y la persona evaluan si son compatibles.","badge":"Brote"},
      {"icon":"leaf","title":"Rama (6 meses - 2 anos)","description":"Voz y voto en asamblea y en su comision. Limite -1500/+1500 TQ. Puede liderar proyectos pequenos.","badge":"Rama"},
      {"icon":"tree","title":"Tronco (2+ anos)","description":"Voz y voto en todas las decisiones. Limite -3000/+3000 TQ. Puede liderar comisiones y ser doble enlace.","badge":"Tronco"},
      {"icon":"shield","title":"Raiz (Fundadores)","description":"Custodios de la vision y memoria. Voz y voto en todo. Limite -5000/+5000 TQ. Forman parte del Consejo de Vision.","badge":"Raiz"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Resolucion de Conflictos",
    "subtitle": "Como manejamos los desacuerdos sin violencia",
    "columns": 1,
    "items": [
      {"icon":"heart","title":"Comunicacion No Violenta (CNV)","description":"Usamos el modelo de Marshall Rosenberg: observacion sin juicio, expresion de sentimientos y necesidades, peticion concreta. Cuando hay conflicto, primero escuchamos, luego hablamos. La CNV es obligatoria en todas las mediaciones.","badge":"CNV"},
      {"icon":"users","title":"Mediacion Comunitaria","description":"Si dos miembros tienen un conflicto, un mediador neutral (miembro Tronco o Raiz) les ayuda a dialogar. Si no se resuelve, el caso va a la Comision de Convivencia. La mediacion es confidencial y voluntaria.","badge":"Mediacion"},
      {"icon":"scale","title":"Asamblea y Consentimiento","description":"Si el conflicto afecta a la comunidad, se lleva a asamblea. La decision se toma por consentimiento: nadie debe quedar excluido. Si alguien objeta, se trabaja la objecion hasta llegar a una version que todos puedan consentir.","badge":"Asamblea"},
      {"icon":"alert-triangle","title":"Faltas y Sanciones","description":"Falta leve: amonestacion verbal. Falta moderada: servicio comunitario extra. Falta grave: suspension temporal. Falta muy grave (violencia, robo, dano ambiental intencional): expulsion inmediata por decision de la asamblea.","badge":"Sanciones"}
    ]
  }
]`,
		},
		{
			Slug:      "campo-soberano",
			Title:     "Campo Soberano",
			Subtitle:  "Proyecto de Comunidad Agroecologica Autonoma y Regenerativa",
			Icon:      "leaf",
			MenuOrder: 7,
			Content: `[
  {
    "type": "hero",
    "badge": "Proyecto de Ecoaldea de Ciclo Cerrado",
    "title": "Proyecto Campo Soberano",
    "subtitle": "Habitat colectivo rural con soberania alimentaria, energetica, digital y financiera.",
    "description": "Estructuracion de una comunidad intencional agroecologica disenada bajo principios de permacultura, propiedad colectiva indivisible, energia solar/eolica off-grid y economia de credito mutuo libre de acumulacion. Campo Soberano es la vision de Raices del Monte llevada a su maxima expresion: autonomia total.",
    "image_url": "/images/demo/restauracion-tierra.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Infraestructura de Ciclos Cerrados",
    "subtitle": "Cada desecho se transforma en un insumo biologico o energetico.",
    "columns": 3,
    "items": [
      { "icon": "leaf", "title": "Biodigestores Continuos", "description": "Estiercol animal y restos organicos transformados en biogas metano para cocinas y biol fertilizante liquido.", "badge": "Biogas & Biol" },
      { "icon": "zap", "title": "Microrred Hibrida Aislada", "description": "Generacion solar fotovoltaica con respaldo eolico e hidraulico para autonomia energetica 100% desconectada.", "badge": "Energia Limpia" },
      { "icon": "heart", "title": "Diseno Keyline y Aguas", "description": "Zanjas de infiltracion en curvas de nivel, reservorios de tierra y sanitarios secos con compostaje termofilo.", "badge": "Cosecha de Agua" },
      { "icon": "users", "title": "Soberania Digital Mesh", "description": "Red inalambrica comunitaria con servidores locales para mensajeria, enciclopedias offline y educacion.", "badge": "Red Mesh" },
      { "icon": "scale", "title": "Gobernanza Sociocratica", "description": "Toma de decisiones por circulos tematicos y consentimiento fundamentado, con fideicomiso de tierra comunitaria.", "badge": "Sociocracia 3.0" },
      { "icon": "shopping-cart", "title": "Zonificacion Permacultural", "description": "Organizacion de zonas 0 a 5: nucleo habitacional bioclimatico, huerto intensivo, animales menores, granos y reserva silvestre.", "badge": "Permacultura" }
    ]
  },
  {
    "type": "features_grid",
    "title": "Soberania Alimentaria",
    "subtitle": "Producimos el 80% de nuestra alimentacion",
    "columns": 2,
    "items": [
      { "icon": "wheat", "title": "Granos Andinos", "description": "Quinua, frijol negro de altura, maiz criollo. Cultivados en bancales a 1200m. Base calorica de la comunidad.", "badge": "Granos" },
      { "icon": "carrot", "title": "Hortalizas de Montaña", "description": "Tomate, lechuga, acelga, cilantro, espinaca. Huertos en espiral y bancales elevados. Cosecha todo el ano.", "badge": "Hortalizas" },
      { "icon": "apple", "title": "Frutas y Frutos", "description": "Guayaba, mora, platano, aguacate. Agroforesteria con especies nativas y frutales adaptados a la altura.", "badge": "Frutas" },
      { "icon": "milk", "title": "Lacteos y Proteina", "description": "Queso de cabra, huevos de gallina libre, miel de abejas nativas. Produccion a escala humana, sin factory farming.", "badge": "Proteina" }
    ]
  }
]`,
		},
		{
			Slug:      "faq",
			Title:     "Preguntas Frecuentes",
			Subtitle:  "Dudas sobre el TQ, la Ecoaldea, la Federacion y Como Unirse",
			Icon:      "help-circle",
			MenuOrder: 9,
			Content: `[
  {
    "type": "hero",
    "badge": "Centro de Respuestas",
    "title": "Preguntas Frecuentes",
    "subtitle": "Informacion clara sobre como funciona la ecoaldea, el trueque, la federacion y como sumarte.",
    "image_url": "/images/demo/preguntas-frecuentes.jpg",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Sobre el TQ y la Economia Comunitaria",
    "items": [
      {
        "question": "Que es el TQ (Trueque Comunitario)?",
        "answer": "El TQ es nuestra unidad de intercambio interno. No es dinero, no es criptomoneda, no genera intereses. Es una unidad contable basada en la energia real (kWh) que cuesta producir cada bien o servicio. 1 TQ = 1 kWh = 3.6 MJ. Sin inflacion, sin devaluacion, sin bancos."
      },
      {
        "question": "Necesito dinero para empezar a participar?",
        "answer": "No. Tu cuenta inicia en cero (0 TQ). No necesitas comprar monedas, pagar inscripcion ni aportar capital. Puedes recibir bienes y servicios inmediatamente (tu saldo pasa a negativo) y luego retribuir con tu trabajo, cosecha o productos."
      },
      {
        "question": "Como se calcula el precio de un producto en TQ?",
        "answer": "La Calculadora Energetica suma toda la energia invertida: energia humana (horas de trabajo x tarifa metabolica), energia de insumos (semillas, agua, compost), energia solar (secado, bombeo) y factor de esfuerzo. El total en MJ se divide entre 3.6 para obtener TQ. Es objetivo, transparente y auditable."
      },
      {
        "question": "Que pasa si mi saldo es negativo?",
        "answer": "No es una deuda financiera: es un compromiso etico con la comunidad. Has recibido bienes y los retribuiras con tu trabajo o produccion. No hay cobradores ni intereses. Si alcanzas tu limite negativo, tu cuenta se bloquea temporalmente para nuevas compras hasta que aportes valor de vuelta."
      },
      {
        "question": "Puedo acumular TQ?",
        "answer": "Existe un techo positivo: si alcanzas tu limite, debes gastar o reinvertir antes de recibir mas. El sistema esta disenado para que la riqueza circule, no para que se acumule. Nadie puede acumular indefinidamente."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Ecoaldea",
    "items": [
      {
        "question": "Que es una ecoaldea?",
        "answer": "Una ecoaldea es un asentamiento humano a escala humana, disenado conscientemente para asegurar la sostenibilidad a largo plazo. Integra cuatro dimensiones: ecologica, economica, social y cultural. Raices del Monte es una ecoaldea de 28 familias que practica permacultura, energia renovable, gobernanza sociocratica y economia solidaria."
      },
      {
        "question": "Como se toman las decisiones?",
        "answer": "Por consentimiento sociocratico, no por mayoria. Una propuesta se aprueba cuando nadie presenta una objecion razonada. Esto asegura que todas las voces sean escuchadas. Las decisiones operativas las toman las 7 comisiones autonomas; las estrategicas, la asamblea mensual."
      },
      {
        "question": "Como se unen nuevos miembros?",
        "answer": "El proceso tiene varias etapas: 1) Visita inicial de un fin de semana. 2) Periodo de voluntariado de 1-3 meses. 3) Solicitud formal con patrocinio de un miembro Tronco o Raiz. 4) Periodo de prueba de 6 meses como Brote. 5) Evaluacion de la Comision de Admision. 6) Decision de la asamblea por consentimiento."
      },
      {
        "question": "Que obligaciones tiene un miembro?",
        "answer": "8 horas semanales de trabajo comunitario (cayapa), asistencia a asambleas mensuales, produccion agroecologica (sin agroquimicos), uso exclusivo de TQ para transacciones internas, participacion en el banco de semillas y cuidado del agua."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Federacion",
    "items": [
      {
        "question": "Que es la Red de Intercambio Federada?",
        "answer": "Es una red de ecoaldeas, comunidades y cooperativas que usan el mismo sistema de intercambio basado en energia. Cada nodo es completamente autonomo: tiene sus propias normas, moneda comunitaria y gobernanza. Pero todos podemos intercambiar productos, servicios y conocimiento."
      },
      {
        "question": "Puede un nodo imponer sus reglas a otro?",
        "answer": "No. La federacion es voluntaria y revocable. Cada nodo mantiene sus normas, su cultura, sus decisiones y sus datos. Nadie impone nada a nadie. El comercio entre nodos respeta la autonomia total de cada comunidad."
      },
      {
        "question": "Como se federan dos nodos?",
        "answer": "Cada nodo tiene su propia identidad criptografica (claves Ed25519). Cuando dos nodos quieren federarse, intercambian certificados y establecen un canal seguro con mTLS. A partir de ahi pueden consultar balances, intercambiar productos y sincronizar estados."
      }
    ]
  }
]`,
		},
		{
			Slug:      "contacto",
			Title:     "Contacto y Ubicacion",
			Subtitle:  "Como Visitarnos y Como Llegar",
			Icon:      "mail",
			MenuOrder: 10,
			Content: `[
  {
    "type": "contact_location",
    "title": "Visita Raices del Monte",
    "subtitle": "Recibimos visitantes, voluntarios y nuevos miembros.",
    "address": "Ecoaldea Raices del Monte, zona montana rural, a 1200m de altitud, 45 minutos en vehiculo del pueblo mas cercano.",
    "schedule": "Jornadas de puertas abiertas: primer domingo de cada mes, despues de la asamblea. Visita previa coordinacion por email.",
    "instagram": "raicesdelmonte",
    "facebook": "raicesdelmonte",
    "email": "contacto@raicesdelmonte.org",
    "phone": "Radio comunitaria (no hay senal movil dentro de la ecoaldea)",
    "transport_info": "Coordinamos el encuentro en el pueblo mas cercano para guiarte. El ultimo tramo se hace a pie o en mula por un sendero de 3km. No hay senal de telefono movil dentro de la ecoaldea, pero tenemos radio y internet por satelite."
  },
  {
    "type": "features_grid",
    "title": "Para Nuevos Miembros",
    "subtitle": "El proceso de admision",
    "columns": 1,
    "items": [
      {"icon":"eye","title":"1. Visita Inicial (1 fin de semana)","description":"Vienes a conocer la ecoaldea, participas en la vida comunitaria, te explicamos como funcionamos. Es un encuentro mutuo: tu nos conoces, te conocemos.","badge":"Paso 1"},
      {"icon":"hand","title":"2. Voluntariado (1-3 meses)","description":"Si ambos queremos seguir, haces un voluntariado. Aprendes permacultura, bioconstruccion y agroecologia mientras aportas trabajo. Convives con la comunidad.","badge":"Paso 2"},
      {"icon":"file","title":"3. Solicitud Formal","description":"Tras el voluntariado, si quieres unirte, presentas solicitud formal con patrocinio de un miembro Tronco o Raiz que avale tu integracion.","badge":"Paso 3"},
      {"icon":"sprout","title":"4. Periodo de Prueba (6 meses como Brote)","description":"Si la solicitud es aceptada, entras como Brote. Tienes voz en asamblea pero sin voto. Limite -500/+500 TQ. Es el periodo donde confirmas que la ecoaldea es para ti.","badge":"Paso 4"},
      {"icon":"scale","title":"5. Evaluacion y Decision","description":"La Comision de Admision evalua tu integracion. La asamblea decide por consentimiento si te acepta como Rama (miembro pleno con voto).","badge":"Paso 5"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Postulacion",
    "title": "Quieres postularte como miembro?",
    "subtitle": "Escribenos para coordinar una visita inicial. El proceso no es rapido, pero asegura que la comunidad y la persona sean compatibles.",
    "button_text": "Escribirnos",
    "button_link": "mailto:contacto@raicesdelmonte.org",
    "theme": "forest"
  }
]`,
		},
		{
			Slug:      "semillas",
			Title:     "Semillas y Banco de Semillas",
			Subtitle:  "Patrimonio Colectivo, Soberania Alimentaria y Biodiversidad",
			Icon:      "sprout",
			MenuOrder: 11,
			Content: `[
  {
    "type": "hero",
    "badge": "Las Semillas Son Vida",
    "title": "Banco Comunitario de Semillas Criollas",
    "subtitle": "Conservar nuestras semillas es conservar nuestra libertad.",
    "description": "Las semillas son el primer eslabon de la cadena alimentaria. Quien controla las semillas controla la alimentacion. Por eso defendemos las semillas criollas y nativas: porque son patrimonio colectivo de los pueblos, se reproducen libremente, estan adaptadas a nuestro clima y han sido seleccionadas por generaciones de campesinos y campesinas.",
    "image_url": "/images/demo/banco-semillas.jpg",
    "style": "split"
  },
  {
    "type": "features_grid",
    "title": "Que es un Banco Comunitario de Semillas?",
    "subtitle": "Una alternativa de conservacion colectiva de la agrobiodiversidad",
    "columns": 2,
    "items": [
      {"icon":"users","title":"Administracion colectiva","description":"Un banco comunitario de semillas es un modelo de administracion colectiva de la reserva de semillas necesaria para la siembra entre los productores de una comunidad. Su funcionamiento se basa en el sistema de prestamo y devolucion: los productores asociados toman prestada una cantidad de semilla y, tras la cosecha, la devuelven con un porcentaje adicional.","badge":"Colectivo"},
      {"icon":"leaf","title":"Conservacion de agrobiodiversidad","description":"Los bancos comunitarios conservan importantes genes que aportan sabor, color, olor, resistencia a plagas y adaptacion al clima. La FAO reconoce que estos bancos son vitales para perpetuar el acervo genetico de las especies vegetales y asegurar la seguridad alimentaria frente al cambio climatico.","badge":"Biodiversidad"},
      {"icon":"shield","title":"Confianza en la propia semilla","description":"Los agricultores confian en sus semillas porque han sido seleccionadas por ellos mismos, conocen el desempeno de las plantas de las que provienen y saben como se comportaran bajo las condiciones agroecologicas locales. Esta confianza es la base de la autonomia campesina.","badge":"Autonomia"},
      {"icon":"rotate-cw","title":"Sistema de prestamo y devolucion","description":"El banco define colectivamente cuanta semilla deposita cada agricultor y que porcentaje debe agregar al devolverla. Este sistema permite que el banco crezca con cada ciclo, que la semilla se adapte a las condiciones locales y que nuevos productores puedan acceder a semilla de calidad sin comprarla.","badge":"Circulo virtuoso"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Semillas Criollas vs. Transgenicas",
    "subtitle": "La diferencia entre libertad y dependencia",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"Semillas criollas y nativas","description":"Las semillas criollas son aquellas que han sido seleccionadas y adaptadas por los campesinos durante generaciones. Son libres: puedes guardarlas, intercambiarlas, venderlas y sembrarlas sin restricciones. Se adaptan a las condiciones locales, resisten plagas nativas, requieren menos insumos externos y conservan la diversidad genetica.","badge":"Libres"},
      {"icon":"alert-triangle","title":"Semillas transgenicas","description":"Las semillas transgenicas son modificadas geneticamente en laboratorios y patentadas por corporaciones. Su uso obliga a comprar semillas nuevas cada temporada, crea dependencia economica, contamina las variedades nativas por polinizacion cruzada, reduce la biodiversidad y concentra el control de la alimentacion en unas pocas empresas transnacionales.","badge":"Dependencia"},
      {"icon":"shield","title":"Territorios libres de transgenicos","description":"En America Latina, comunidades indigenas y campesinas han declarado Territorios Libres de Transgenicos como acto de autodeterminacion. Nosotros tambien: la ecoaldea es territorio libre de transgenicos. Nuestras semillas criollas son libres, reproducibles y adaptadas a la altura.","badge":"Resistencia"},
      {"icon":"globe","title":"Patrimonio de los pueblos","description":"Las semillas constituyen un patrimonio colectivo de los pueblos. Han circulado libremente entre la poblacion rural garantizando soberania y autonomia alimentaria frente a las crisis. Los derechos colectivos de uso, manejo, intercambio y control local de las semillas tienen caracter inalienable e imprescriptible.","badge":"Patrimonio"}
    ]
  },
  {
    "type": "features_grid",
    "title": "El Banco de Semillas en Raices del Monte",
    "subtitle": "Como funciona nuestro banco comunitario",
    "columns": 3,
    "items": [
      {"icon":"rotate-cw","title":"Como funciona","description":"Cada miembro deposita semillas tras la cosecha. Cuando llega la epoca de siembra, toma prestada semilla del banco. Tras la siguiente cosecha, devuelve la semilla prestada mas un 10% adicional. Asi el banco crece con cada ciclo.","badge":"Sistema"},
      {"icon":"leaf","title":"Variedades que conservamos","description":"Maiz criollo de altura, frijol negro de montana, quinua andina, aji dulce, lechuga de hoja suelta, tomate de monte, hierbas medicinales. Cada variedad esta adaptada a nuestras condiciones de altitud y clima.","badge":"Variedades"},
      {"icon":"users","title":"Guardianes de semillas","description":"Cada familia es guardiana de algunas variedades. Saben cuándo sembrar, como seleccionar las mejores plantas para semilla y como almacenarlas. El conocimiento se transmite de abuelos a nietos.","badge":"Guardianes"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Bancos de Semillas en el Mundo",
    "subtitle": "Una red global de resistencia y conservacion",
    "columns": 2,
    "items": [
      {"icon":"globe","title":"Banco Global de Semillas de Svalbard","description":"En Noruega, el Banco Global de Semillas de Svalbard almacena mas de 1 millon de variedades en condiciones de congelacion permanente. Es el respaldo ultimod e la diversidad agricola mundial: si una variedad se pierde en algun lugar, puede recuperarse desde Svalbard.","badge":"Svalbard"},
      {"icon":"users","title":"Redes de Guardianes","description":"Las Redes de Guardianes de Semillas articulan a custodios en toda America Latina. La Red de Semillas Libres de Colombia, la Red Guardianes de Semillas de Vida: movimientos que defienden el derecho de los pueblos a guardar, intercambiar y mejorar sus semillas.","badge":"Redes"},
      {"icon":"book-open","title":"Dialogo de saberes","description":"El banco de semillas no es solo un deposito: es un espacio de dialogo entre el conocimiento campesino ancestral y la ciencia agroecologica. Los abuelos saben cuando sembrar segun las lluvias; los jovenes aportan tecnicas de documentacion y experimentacion.","badge":"Dialogo"},
      {"icon":"globe","title":"Soberania alimentaria","description":"La soberania alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios. No es solo tener que comer: es autonomia. Que la comunidad controle su alimentacion, no las corporaciones transnacionales que monopolizan las semillas y los agroquimicos.","badge":"Soberania"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Participa",
    "title": "Trae tus semillas al banco comunitario",
    "subtitle": "Cada primer domingo de mes, despues de la asamblea, abrimos el banco de semillas para intercambio libre. Trae tus semillas criollas, plántulas medicinales y esquejes. No necesitas ser miembro para participar.",
    "button_text": "Ver Como Llegar",
    "button_link": "/p/contacto",
    "theme": "forest"
  }
]`,
		},
		{
			Slug:      "saberes-ancestrales",
			Title:     "Saberes Ancestrales",
			Subtitle:  "Conocimientos Tradicionales que Sostienen la Vida Comunitaria",
			Icon:      "book-open",
			MenuOrder: 12,
			Content: `[
  {
    "type": "hero",
    "badge": "Saberes que Vienen del Monte",
    "title": "Saberes Ancestrales y Conocimiento Tradicional",
    "subtitle": "La sabiduria de los abuelos no es pasado: es futuro.",
    "description": "Los saberes ancestrales son conocimientos transmitidos de generacion en generacion, nacidos de la observacion paciente de la naturaleza y de la relacion respetuosa entre las personas y la tierra. No son recetas del pasado: son tecnologias vivas, adaptadas y vigentes, que ofrecen respuestas a los problemas contemporaneos de alimentacion, salud, vivienda y comunidad.",
    "image_url": "/images/demo/saberes-ancestrales.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Casas de Bahareque: Construccion Natural Ancestral",
    "subtitle": "Cuatro siglos de arquitectura sostenible",
    "columns": 2,
    "items": [
      {"icon":"home","title":"Que es el bahareque?","description":"El bahareque es una tecnica constructiva prehispanica que ha sobrevivido hasta nuestros dias. Esta compuesto por columnas de madera (horconadura), varas horizontales amarradas a ambos lados (enlatado), un relleno de barro con piedras y paja (embutido), y un acabado de barro con o sin cal (empanetado). Es arquitectura de tierra: vernacula, sostenible y patrimonial.","badge":"Tecnica ancestral"},
      {"icon":"leaf","title":"Construccion sostenible","description":"El bahareque usa materiales locales y reciclables: madera, barro, cana, bejucos, paja. Requiere poca energia y agua para construirse. No contamina. Se integra al paisaje. Regula la temperatura naturalmente. Es posible construir y reparar bahareque con materiales disponibles hoy, aplicando principios de construccion sostenible.","badge":"Sostenible"},
      {"icon":"users","title":"Construccion comunitaria (cayapas)","description":"Las casas de bahareque se construyen mediante cayapas: jornadas colectivas donde toda la comunidad ayuda voluntariamente. Cada quien contribuye con lo que tiene: horcones, latas, bejucos, varas. El barro se trae en canastas al hombro o sobre mulas. Era una fiesta comunitaria, llena de camaraderia.","badge":"Cayapa"},
      {"icon":"shield","title":"Patrimonio que se pierde","description":"A mediados del siglo XX, el bahareque fue desplazado por el ladrillo y el cemento. Pero el conocimiento se esta perdiendo: los jovenes ya no saben construir con barro. Recuperar esta tecnica es recuperar autonomia habitacional, patrimonio cultural y una forma de construccion que no destruye el planeta.","badge":"Patrimonio"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Ollas de Barro: Cocina Ancestral",
    "subtitle": "4.000 anos de tradicion ceramica que transforma el sabor y nutre el cuerpo",
    "columns": 2,
    "items": [
      {"icon":"utensils","title":"Coccion lenta y uniforme","description":"La olla de barro permite una coccion lenta y uniforme que resalta los sabores naturales de los ingredientes. La porosidad del barro hace que los alimentos se cocinen de manera suave, manteniendo la humedad y potenciando los aromas.","badge":"Sabor"},
      {"icon":"heart","title":"Beneficios para la salud","description":"El barro contiene minerales que se transfieren a los alimentos durante la coccion, enriqueciendolos naturalmente. Las ollas de barro retienen el calor de manera uniforme, preservando las vitaminas y minerales. A diferencia del aluminio o el teflon, el barro no libera sustancias toxicas.","badge":"Salud"},
      {"icon":"history","title":"4.000 anos de tradicion","description":"El uso de ollas de barro se remonta a las culturas originarias de America. En Ecuador, la cultura Valdivia ya elaboraba vasijas hace 4.000 anos. En Venezuela, comunidades de Barinas, Merida y los Andes mantienen viva la tradicion alfarera. Cada olla es unica: hecha a mano, cocida en horno, con la arcilla del lugar.","badge":"Tradicion"},
      {"icon":"leaf","title":"Cocina sin dependencia industrial","description":"Usar ollas de barro es un acto de soberania: no dependes de utensilios industriales importados, apoyas a los alfareros locales, reduces el consumo de metal y plastico, y recuperas una forma de cocinar que es mas sabrosa, mas saludable y mas justa.","badge":"Soberania"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Medicina Natural y Botica Comunitaria",
    "subtitle": "El conocimiento etnobotanico de las comunidades",
    "columns": 2,
    "items": [
      {"icon":"heart","title":"Plantas medicinales: patrimonio vivo","description":"Estudios etnobotanicos en comunidades campesinas documentan cientos de especies de plantas medicinales. En la ecoaldea, todas las familias usan plantas medicinales, desde ninos hasta ancianos. Es patrimonio cultural y ancestral que se transmite oralmente, de abuelos a nietos.","badge":"Etnobotanica"},
      {"icon":"leaf","title":"Tinturas madres y preparados","description":"En nuestra botica comunitaria conseguimos tinturas madres de propoleo, moringa, curcuma, jengibre y arnica; unguentos naturales; jarabes para la tos; aceites esenciales. Cada preparado se hace con plantas cultivadas agroecologicamente o recolectadas respetando los ciclos naturales.","badge":"Botica"},
      {"icon":"shield","title":"Primer recurso de salud","description":"En comunidades rurales con deficiencias en servicios de salud, las plantas medicinales son el primer recurso para atender afecciones respiratorias, digestivas, cutaneas y renales. Las hojas, frutos y cortezas se preparan en decoccion o maceracion. Este conocimiento es una alternativa real de atencion primaria.","badge":"Salud comunitaria"},
      {"icon":"alert-triangle","title":"Conocimiento en riesgo","description":"Los estudios advierten que el conocimiento tradicional se esta erosionando por la modernizacion, la migracion y la perdida de transmision intergeneracional. Por eso es vital documentar, visibilizar y transmitir estos saberes. La ecoaldea es un espacio de dialogo de saberes: los abuelos comparten, los jovenes registran.","badge":"Urgente"}
    ]
  },
  {
    "type": "features_grid",
    "title": "La Cosmovision de la Ecoaldea",
    "subtitle": "La tierra como forma de vida, no solo de produccion",
    "columns": 2,
    "items": [
      {"icon":"sprout","title":"La Madre Tierra","description":"La tierra no es un recurso que se explota, sino un ser vivo del que somos parte y al que se debe respeto. La cosmovision de la ecoaldea entiende que la Madre Tierra nos provee sustento y vida, y merece gratitud. Por eso prohibimos el plastico desechable, usamos agroecologia sin agroquimicos y reciclamos nutrientes.","badge":"Madre Tierra"},
      {"icon":"users","title":"El convite y la cayapa","description":"El convite es la jornada colectiva de siembra, cosecha o construccion donde toda la comunidad participa voluntariamente. La cayapa es lo mismo: ayuda mutua sin pago monetario. Estas practicas ancestrales son la base de la economia solidaria: no necesitas dinero para construir una casa o sembrar un huerto. Necesitas comunidad.","badge":"Convite"},
      {"icon":"book-open","title":"Dialogo intergeneracional","description":"La ecoaldea es un puente entre generaciones: los abuelos ensenan a seleccionar semillas, preparar remedios y cocinar recetas ancestrales; los jovenes aportan tecnicas de documentacion, redes y experimentacion agroecologica. El conocimiento no se pierde cuando circula.","badge":"Dialogo"},
      {"icon":"leaf","title":"Permacultura como etica","description":"La permacultura no es solo una tecnica de cultivo: es una etica. Tres principios: cuidado de la tierra, cuidado de las personas, reparto justo. Todo lo que hacemos en la ecoaldea se mide contra estos tres principios. Si algo dana la tierra, a las personas o crea injusticia, no lo hacemos.","badge":"Etica"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Recupera tus Saberes",
    "title": "Los saberes ancestrales son tecnologia vigente",
    "subtitle": "Bahareque, ollas de barro, medicina natural, convite: no son pasado, son futuro. Conocelos, practikalos, transmitelos. Visita la ecoaldea y participa en los talleres formativos.",
    "button_text": "Ver Como Llegar",
    "button_link": "/p/contacto",
    "theme": "forest"
  }
]`,
		},
		{
			Slug:      "filosofia-conuquera",
			Title:     "Filosofia Comunitaria",
			Subtitle:  "Permacultura, Soberania y Vida en Comunidad",
			Icon:      "heart",
			MenuOrder: 13,
			Content: `[
  {
    "type": "hero",
    "badge": "Mas que una Ecoaldea, una Forma de Vida",
    "title": "Filosofia Comunitaria",
    "subtitle": "Raices del Monte no es solo un lugar donde vivimos: es una organizacion que aglutina a familias que buscan transformar como producimos, distribuimos y consumimos alimentos.",
    "description": "Nacimos en 2010 como respuesta a la crisis ambiental y alimentaria. Frente a la degradacion del suelo, la perdida de biodiversidad y la comida procesada, retomamos los principios de la permacultura: producir sin agroquimicos, distribuir sin intermediarios, consumir alimentos soberanos y tejer comunidad alrededor de la tierra.",
    "image_url": "/images/demo/permacultura-manos.jpg",
    "style": "standard"
  },
  {
    "type": "features_grid",
    "title": "Nuestra Filosofia",
    "subtitle": "Los principios que guian todo lo que hacemos",
    "columns": 2,
    "items": [
      {"icon":"leaf","title":"Permacultura como modelo de vida","description":"La permacultura no es solo una tecnica de cultivo: es una ciencia, una practica y una etica. Ciencia que aplica principios ecologicos al diseno de sistemas humanos. Practica que respeta los ciclos naturales, recicla nutrientes y controla plagas con biodiversidad. Etica: cuidado de la tierra, cuidado de las personas, reparto justo.","badge":"Permacultura"},
      {"icon":"shield","title":"Soberania alimentaria","description":"La soberania alimentaria es el derecho de los pueblos a definir sus propios sistemas alimentarios: que sembrar, como sembrar, para quien producir y como distribuir. No es solo tener que comer: es autonomia. Que la comunidad controle su alimentacion, no las corporaciones transnacionales que monopolizan semillas y agroquimicos.","badge":"Soberania"},
      {"icon":"users","title":"Economia solidaria","description":"Frente al capitalismo que explota personas y tierra, proponemos la economia solidaria: trueque, credito mutuo, convite, cayapa, distribucion sin intermediarios, precios justos. El dinero no es el centro: el centro son las personas. Producimos para el bien comun, no para la acumulacion.","badge":"Solidaridad"},
      {"icon":"heart","title":"Respeto a la Madre Tierra","description":"La tierra no es un recurso: es un ser vivo del que somos parte. La cosmovision de la ecoaldea entiende que la Madre Tierra nos provee sustento y vida, y merece gratitud y respeto. Por eso prohibimos el plastico desechable, usamos agroecologia sin agroquimicos, reciclamos nutrientes y promovemos construcciones naturales.","badge":"Madre Tierra"},
      {"icon":"book-open","title":"Saberes ancestrales","description":"Los conocimientos de los abuelos no son pasado: son tecnologia vigente. El huerto comunitario, las semillas criollas, las ollas de barro, la medicina natural, el bahareque, el convite: todo eso son saberes que ofrecen respuestas contemporaneas a los problemas de alimentacion, salud, vivienda y comunidad.","badge":"Saberes"},
      {"icon":"globe","title":"Red global de resistencia","description":"No estamos solos. Raices del Monte es parte de un movimiento planetario: la Red Global de Ecoaldeas, la Via Campesina, Slow Food, las Redes de Semillas Libres, los sistemas LETS. En todos los continentes hay comunidades que estan construyendo alternativas al modelo agroindustrial. Somos parte de esa red global.","badge":"Global"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Nuestra Historia",
    "subtitle": "De la degradacion a la regeneracion, de la organizacion a la soberania",
    "columns": 2,
    "items": [
      {"icon":"calendar","title":"2010: Nacimiento en la crisis ambiental","description":"Raices del Monte nace en 2010 como respuesta a la degradacion ambiental. Cinco familias adquieren una finca ganadera que habia perdido su capa vegetal y biodiversidad. Frente a ese panorama, deciden regenerar: plantar arboles, construir bancales, recuperar manantiales.","badge":"2010"},
      {"icon":"leaf","title":"2012: Primeros huertos y bancales","description":"Construimos los primeros bancales elevados siguiendo curvas de nivel para conservar suelo y agua. Empezamos a producir el 30% de nuestra alimentacion. Aprendemos permacultura de campesino a campesino.","badge":"2012"},
      {"icon":"users","title":"2015: Sistema TQ implementado","description":"Creamos el Trueque Comunitario basado en energia incorporada. Cada producto vale lo que cuesta producir en kWh. Sin dinero, sin inflacion, sin interes. La economia interna florece.","badge":"2015"},
      {"icon":"sparkles","title":"2025: 15 anos de regeneracion","description":"Celebramos una decada y media. El bosque se ha duplicado, los manantiales fluyen, 28 familias viven en comunidad. Demostramos que es posible producir alimentos sanos sin agroquimicos, distribuir sin intermediarios, intercambiar sin dinero y tejer comunidad alrededor de la tierra.","badge":"15 anos"}
    ]
  },
  {
    "type": "features_grid",
    "title": "Que Consigues en la Ecoaldea",
    "subtitle": "Productos reales de productores reales, sin intermediarios",
    "columns": 3,
    "items": [
      {"icon":"leaf","title":"Cosecha fresca","description":"Hortalizas y hojas verdes de altura: col rizada, acelgas, lechugas, cebollin, cilantro, perejil, espinaca. Tuberculos: ocumo, yuca dulce, auyama. Todo cosechado en la manana, sin agroquimicos.","badge":"Fresco"},
      {"icon":"heart","title":"Medicina botanica","description":"Tinturas madres de propoleo, moringa, curcuma, jengibre y arnica. Unguentos naturales. Jarabes para la tos. Cosmetica sin quimicos: desodorantes de aceite de coco, balsamos labiales de cera de abejas, jabones artesanales.","badge":"Botica"},
      {"icon":"utensils","title":"Gastronomia artesanal","description":"Pan de quinua, quesos de cabra: anejados, frescos, yogur, mantequilla. Miel pura de abejas nativas. Mermeladas de frutas del monte. Cafe de altura tostado en lena.","badge":"Gastronomia"},
      {"icon":"sprout","title":"Semillas y plantulas","description":"Semillas criollas libres de transgenicos: maiz de altura, frijol negro, quinua andina, aji dulce. Plantulas medicinales: poleo, stevia, hierbaluisa, romero, ruda, oregano. Esquejes de frutales.","badge":"Semillas"},
      {"icon":"home","title":"Artesania y ollas de barro","description":"Ollas, budares y tiestos de barro hechos por artesanos de la comunidad. Cesteria tradicional. Vasijas de arcilla. Productos de fibras naturales. Cada pieza es unica, hecha a mano.","badge":"Artesania"},
      {"icon":"zap","title":"Miel y derivados","description":"Miel pura de abejas nativas. Polen. Propoleo. Cera de abejas. Productos de la colmena producidos por apicultores que respetan los ciclos naturales y no alimentan a las abejas con azucar.","badge":"Miel"}
    ]
  },
  {
    "type": "cta_banner",
    "badge": "Unete a la Ecoaldea",
    "title": "Raices del Monte es una forma de vida",
    "subtitle": "No solo vienes a comprar: vienes a aprender, a intercambiar, a compartir, a construir comunidad. Si deseas ingresar como miembro o participar en las asambleas y trueques, postulate ante la asamblea.",
    "button_text": "Contactanos",
    "button_link": "/p/contacto",
    "theme": "forest"
  }
]`,
		},
		{
			Slug:      "federacion",
			Title:     "Federacion",
			Subtitle:  "La Red de Ecoaldeas Federadas",
			Icon:      "globe",
			MenuOrder: 8,
			Content: `[
  {
    "type": "hero",
    "badge": "Red Federada",
    "title": "No estamos solos",
    "subtitle": "La red crece con cada comunidad que se suma",
    "description": "Raices del Monte es parte de la Red de Intercambio Federada. Esto significa que podemos comerciar con otras ecoaldeas, comunidades y cooperativas que usan el mismo sistema. Cada nodo es completamente autonomo: tiene sus propias normas, su propia moneda comunitaria, su propia gobernanza. Pero todos podemos intercambiar productos, servicios y conocimiento usando los mismos principios energeticos.",
    "image_url": "/images/demo/restauracion-tierra.jpg",
    "style": "centered"
  },
  {
    "type": "features_grid",
    "title": "Como Funciona la Federacion",
    "subtitle": "Comercio entre nodos con autonomia total",
    "columns": 2,
    "items": [
      { "icon": "globe", "title": "Comercio Entre Nodos", "description": "Vender tus productos a otras ecoaldeas y comprar lo que tu no produces. El sistema calcula el equivalente energetico entre monedas comunitarias.", "badge": "Comercio" },
      { "icon": "users", "title": "Intercambio de Conocimiento", "description": "Talleres, capacitaciones y experiencias compartidas entre comunidades. Si tu ecoaldea sabe de bioconstruccion y la nuestra de permacultura, intercambiamos.", "badge": "Saberes" },
      { "icon": "shield", "title": "Resiliencia Colectiva", "description": "Si un nodo tiene problemas (sequia, incendio, enfermedad), otros pueden ayudar. La solidaridad practica es nuestra red de seguridad.", "badge": "Solidaridad" },
      { "icon": "leaf", "title": "Autonomia Total", "description": "Cada nodo mantiene sus normas, su cultura, sus decisiones y sus datos. Nadie impone nada a nadie. La federacion es voluntaria y revocable.", "badge": "Autonomia" }
    ]
  },
  {
    "type": "features_grid",
    "title": "Como se Federan los Nodos",
    "subtitle": "Identidad criptografica y canales seguros",
    "columns": 1,
    "items": [
      { "icon": "shield", "title": "Identidad Criptografica", "description": "Cada nodo tiene su propia identidad criptografica (claves Ed25519). Cuando dos nodos quieren federarse, intercambian certificados y establecen un canal seguro con mTLS. A partir de ahi pueden consultar balances, intercambiar productos y sincronizar estados.", "badge": "Criptografia" },
      { "icon": "scale", "title": "Limites de Comercio Federado", "description": "Cada nodo define sus propios limites de comercio multilateral: cuanto puede deber un nodo a otro, cuanto puede recibir. Estos limites los aprueba la asamblea de cada nodo. El sistema bloquea automaticamente transacciones que excedan los limites.", "badge": "Limites" },
      { "icon": "alert-triangle", "title": "Resolucion de Conflictos", "description": "El sistema detecta automaticamente conflictos de fusion (cuando dos nodos registran transacciones contradictorias) y los reporta para que las asambleas de cada nodo los resuelvan por consentimiento.", "badge": "Conflictos" }
    ]
  }
]`,
		},
	}
}

func demoSeedProducts(ctx context.Context, d *DB, nodeDomain string) error {
	// Productos especificos de Ecoaldea Raices del Monte
	products := []struct {
		parentCat, cat, subcat, name, unit, desc, badge, image string
		price                                                  int
	}{
		// Agricultura de montana
		{"Agricultura", "Cultivos", "Granos", "Frijol negro de altura (1kg)", "kg", "Frijol negro cultivado a 1200m, secado al sol", "organico", "/images/demo/frijol-negro.jpg", 35},
		{"Agricultura", "Cultivos", "Granos", "Quinua andina (1kg)", "kg", "Quinua cultivada en bancales de montana", "nativo", "/images/demo/quinua.jpg", 45},
		{"Agricultura", "Cultivos", "Hortalizas", "Tomate de huerto (1kg)", "kg", "Tomate perita de cultivo agroecologico", "fresco", "/images/demo/tomate.jpg", 25},
		{"Agricultura", "Cultivos", "Hortalizas", "Lechuga de bancale", "unidad", "Lechuga batavia de bancal elevado", "fresco", "/images/demo/lechuga.jpg", 15},
		{"Agricultura", "Cultivos", "Raices", "Ocumo de montana (1kg)", "kg", "Ocumo nativo de sombra", "nativo", "/images/demo/ocumo.jpg", 20},
		{"Agricultura", "Cultivos", "Frutas", "Guayaba de rio (1kg)", "kg", "Guayaba de arboles a orillas del arroyo", "temporal", "/images/demo/guayaba.jpg", 22},
		{"Agricultura", "Cultivos", "Frutas", "Mora de monte (500g)", "paquete", "Mora silvestre recolectada en el bosque", "silvestre", "/images/demo/mora.jpg", 30},

		// Derivados artesanales
		{"Alimentacion", "Derivados", "Lacteos", "Queso de cabra (500g)", "unidad", "Queso fresco de cabras lecheras", "artesanal", "/images/demo/queso-de-cabra.jpg", 60},
		{"Alimentacion", "Derivados", "Panaderia", "Pan de quinua (1kg)", "kg", "Pan integral hecho con harina de quinua del huerto", "artesanal", "/images/demo/pan-quinua.jpg", 50},
		{"Alimentacion", "Derivados", "Conservas", "Mermelada de mora", "frasco", "Mermelada artesanal de mora de monte", "artesanal", "/images/demo/mermelada.jpg", 40},
		{"Alimentacion", "Derivados", "Miel", "Miel de montana (250ml)", "frasco", "Miel pura de abejas nativas sin agroticos", "natural", "/images/demo/miel.jpg", 70},

		// Artesania local
		{"Artesania", "Textiles", "Tejidos", "Ruana de lana (unidad)", "unidad", "Ruana tejida a mano con lana de ovejas de la comunidad", "artesanal", "/images/demo/ruana-de-lana.jpg", 250},
		{"Artesania", "Ceramica", "Vajilla", "Set 4 cuencos de barro", "set", "Cuencos de barro cocido hechos con arcilla local", "artesanal", "/images/demo/ceramica-barro.jpg", 150},
		{"Artesania", "Madera", "Muebles", "Banco de madera de cedro", "unidad", "Banco rustico de cedro del bosque comunitario", "artesanal", "/images/demo/banco-madera.jpg", 300},
		{"Artesania", "Cesteria", "Cestas", "Cesta de bambu (mediana)", "unidad", "Cesta tejida con bambu del bosque", "artesanal", "/images/demo/cesta-bambu.jpg", 80},

		// Herramientas
		{"Herramientas", "Agricolas", "Manuales", "Azadon de montana", "unidad", "Azadon forjado en la herreria comunitaria", "util", "/images/demo/azadon-de-montana.jpg", 100},
		{"Herramientas", "Agricolas", "Manuales", "Tijeras de podar", "unidad", "Tijeras de podar afiladas en taller", "util", "/images/demo/tijeras-de-podar.jpg", 60},

		// Salud natural
		{"Salud y Medicina", "Natural", "Hierbas", "Te de hierbas del monte (100g)", "paquete", "Mezcla de hierbas medicinales del bosque: toronjil, malojillo, llanten", "natural", "/images/demo/hierbas-medicinales.jpg", 25},
		{"Salud y Medicina", "Natural", "Aceites", "Aceite de romero (100ml)", "botella", "Aceite esencial de romero del huerto", "natural", "/images/demo/aceite-de-romero.jpg", 45},

		// Servicios comunitarios
		{"Servicios", "Comunitarios", "Educacion", "Taller de permacultura (4h)", "taller", "Taller practico de permacultura para visitantes", "educativo", "", 120},
		{"Servicios", "Comunitarios", "Educacion", "Curso de agroecologia (8 sesiones)", "curso", "Curso completo de agroecologia de montana", "educativo", "", 500},
		{"Servicios", "Comunitarios", "Transporte", "Transporte en mula", "viaje", "Transporte de carga en mula por senderos", "servicio", "", 80},
		{"Servicios", "Comunitarios", "Construccion", "Mano de obra en construccion natural", "jornada", "Jornada de trabajo en construccion con barro y paja", "servicio", "", 100},
	}

	for _, p := range products {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE node_domain = $1 AND name = $2`, nodeDomain, p.name).Scan(&existing)
		if existing > 0 {
			continue
		}

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO products (node_domain, parent_category, category, subcategory, name, unit, description, price_per_unit, badge, image_url, is_active, is_approved)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), true, true)`,
			nodeDomain, p.parentCat, p.cat, p.subcat, p.name, p.unit, p.desc, p.price, p.badge, p.image)
		if err != nil {
			log.Printf("Demo: error seeding product %s: %v", p.name, err)
		}
	}

	// Productos compuestos aprobados por asamblea (is_composite = true)
	// Simulan productos creados por miembros y aprobados para el catalogo
	compositeProducts := []struct {
		parentCat, cat, subcat, name, unit, desc, badge, image string
		price                                                  int
	}{
		{"Alimentacion", "Compuestos", "Cocina", "Kit de Mermelada Artesanal (3 frascos)", "kit", "Set de 3 mermeladas artesanales: mora, guayaba y tomate. Incluye envases de vidrio retornables.", "Compuesto", "/images/demo/mermelada.jpg", 150},
		{"Alimentacion", "Compuestos", "Cocina", "Cesta de Desayuno de Montaña", "cesta", "Cesta con pan de quinua, miel, queso de cabra y te de hierbas. Para 4 personas.", "Compuesto", "/images/demo/pan-quinua.jpg", 220},
		{"Agricultura", "Compuestos", "Semillas", "Banco de Semillas Criollas (10 variedades)", "set", "Coleccion de 10 semillas criollas: frijol, quinua, tomate, lechuga, ocumo, guayaba, mora, ají, cilantro, calabaza.", "Compuesto", "/images/demo/banco-semillas.jpg", 180},
		{"Artesania", "Compuestos", "Vajilla", "Vajilla de Barro (4 personas)", "set", "Set completo: 4 platos, 4 cuencos, 4 tazas de barro cocido artesanal.", "Compuesto", "/images/demo/ceramica-barro.jpg", 400},
		{"Salud y Medicina", "Compuestos", "Botiquin", "Botiquin Natural de Montaña", "botiquin", "Set de remedios naturales: te de hierbas, aceite de romero, miel medicinal, cataplasma de llanten.", "Compuesto", "/images/demo/hierbas-medicinales.jpg", 130},
		{"Herramientas", "Compuestos", "Kits", "Kit de Huerto Familiar", "kit", "Kit completo: azadon, tijeras de podar, semillas, abono organico y manual de agroecologia.", "Compuesto", "/images/demo/permacultura-manos.jpg", 280},
		{"Servicios", "Compuestos", "Talleres", "Programa de Formacion Comunitaria", "programa", "Paquete educativo: curso de agroecologia (8 sesiones) + taller de permacultura + taller de medicina natural.", "Compuesto", "/images/demo/taller-permacultura.jpg", 800},
		{"Construccion", "Compuestos", "Natural", "Kit de Construccion con Barro y Paja", "kit", "Materiales y herramientas para construccion natural: barro, paja, madera, mano de obra (2 jornadas).", "Compuesto", "/images/demo/bioconstruccion-adobe.jpg", 450},
	}

	for _, p := range compositeProducts {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE node_domain = $1 AND name = $2`, nodeDomain, p.name).Scan(&existing)
		if existing > 0 {
			continue
		}

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO products (node_domain, parent_category, category, subcategory, name, unit, description, price_per_unit, badge, image_url, is_active, is_approved, is_composite)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), true, true, true)`,
			nodeDomain, p.parentCat, p.cat, p.subcat, p.name, p.unit, p.desc, p.price, p.badge, p.image)
		if err != nil {
			log.Printf("Demo: error seeding composite product %s: %v", p.name, err)
		}
	}

	// Productos pendientes de aprobacion (no aprobados)
	pendingProducts := []struct {
		parentCat, cat, subcat, name, unit, desc, badge string
		price                                           int
	}{
		{"Agricultura", "Cultivos", "Granos", "Cafe de altura (1kg)", "kg", "Cafe arabica cultivado a 1400m, tostado artesanal", "organico", 90},
		{"Agricultura", "Cultivos", "Hortalizas", "Cilantro fresco (atado)", "atado", "Cilantro del huerto comunitario", "fresco", 10},
		{"Agricultura", "Cultivos", "Frutas", "Mango de rio (1kg)", "kg", "Mango de arboles a orillas del arroyo", "temporal", 25},
		{"Alimentacion", "Derivados", "Conservas", "Salsa de ají criollo", "frasco", "Salsa picante de aji nativo", "artesanal", 35},
		{"Alimentacion", "Derivados", "Lacteos", "Yogur de cabra (500ml)", "botella", "Yogur natural de leche de cabra", "artesanal", 30},
		{"Artesania", "Textiles", "Tejidos", "Bufanda de lana (unidad)", "unidad", "Bufanda tejida a mano con lana de oveja", "artesanal", 80},
		{"Artesania", "Ceramica", "Vajilla", "Jarra de barro (1L)", "unidad", "Jarra de barro cocido artesanal", "artesanal", 65},
		{"Artesania", "Madera", "Muebles", "Mesa rustica de cedro", "unidad", "Mesa de cedro del bosque comunitario", "artesanal", 450},
		{"Salud y Medicina", "Natural", "Hierbas", "Unguento de calendula (50g)", "tarro", "Unguento cicatrizante de caléndula", "natural", 28},
		{"Salud y Medicina", "Natural", "Aceites", "Aceite de lavanda (50ml)", "botella", "Aceite esencial de lavanda relajante", "natural", 55},
		{"Servicios", "Comunitarios", "Educacion", "Taller de ceramica (3h)", "taller", "Taller practico de ceramica para principiantes", "educativo", 90},
		{"Servicios", "Comunitarios", "Transporte", "Transporte en canoa", "viaje", "Transporte por rio en canoa comunitaria", "servicio", 50},
		{"Herramientas", "Agricolas", "Manuales", "Machete de monte", "unidad", "Machete forjado en la herreria comunitaria", "util", 70},
		{"Herramientas", "Agricolas", "Manuales", "Pala de punta", "unidad", "Pala de punta para excavacion", "util", 85},
		{"Agricultura", "Cultivos", "Granos", "Frijol rojo (1kg)", "kg", "Frijol rojo criollo de altura", "nativo", 38},
		{"Agricultura", "Cultivos", "Raices", "Name de monte (1kg)", "kg", "Name cultivado en bancales de sombra", "nativo", 18},
		{"Alimentacion", "Derivados", "Panaderia", "Galletas de avena (500g)", "paquete", "Galletas artesanales de avena y miel", "artesanal", 25},
		{"Alimentacion", "Derivados", "Miel", "Polen de abejas (100g)", "frasco", "Polen fresco de abejas nativas", "natural", 40},
		{"Artesania", "Cesteria", "Cestas", "Canasta grande de bambu", "unidad", "Canasta grande tejida con bambu del bosque", "artesanal", 110},
		{"Servicios", "Comunitarios", "Construccion", "Taller de construccion natural (2 dias)", "taller", "Taller intensivo de construccion con barro y paja", "educativo", 200},
		{"Agricultura", "Cultivos", "Hortalizas", "Aji criollo (500g)", "paquete", "Aji nativo picante del huerto", "nativo", 20},
		{"Alimentacion", "Derivados", "Conservas", "Vinagre de mora (250ml)", "botella", "Vinagre artesanal de mora de monte", "artesanal", 32},
		{"Salud y Medicina", "Natural", "Hierbas", "Te de valeriana (100g)", "paquete", "Te relajante de valeriana del huerto", "natural", 22},
	}

	for _, p := range pendingProducts {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE node_domain = $1 AND name = $2`, nodeDomain, p.name).Scan(&existing)
		if existing > 0 {
			continue
		}

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO products (node_domain, parent_category, category, subcategory, name, unit, description, price_per_unit, badge, image_url, is_active, is_approved)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', true, false)`,
			nodeDomain, p.parentCat, p.cat, p.subcat, p.name, p.unit, p.desc, p.price, p.badge)
		if err != nil {
			log.Printf("Demo: error seeding pending product %s: %v", p.name, err)
		}
	}

	return nil
}

func demoSeedOrgLevels(ctx context.Context, d *DB, nodeDomain string) error {
	orgLevels := []struct {
		name, desc string
		level      int
		credit     int
		debit      int
		taxRate    float64
	}{
		{"org_produccion", "Organizacion de produccion. Fabrica o produce bienes.", 1, -100000, 100000, 0.02},
		{"org_consumo", "Organizacion de consumo. Compra bienes para distribuir.", 1, -50000, 50000, 0.01},
		{"org_publica", "Institucion publica. Sin fines de lucro, exenta de impuestos.", 1, -1000000, 1000000, 0.00},
		{"org_cooperativa", "Cooperativa. Propiedad compartida de miembros.", 1, -200000, 200000, 0.01},
	}

	for _, ol := range orgLevels {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organization_levels WHERE node_domain = $1 AND name = $2`, nodeDomain, ol.name).Scan(&existing)
		if existing > 0 {
			continue
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO organization_levels (node_domain, name, description, level, credit_limit, debit_limit, tax_rate, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
			nodeDomain, ol.name, ol.desc, ol.level, ol.credit, ol.debit, ol.taxRate)
		if err != nil {
			log.Printf("Demo: error seeding org level %s: %v", ol.name, err)
		}
	}
	return nil
}

func demoSeedUsers(ctx context.Context, d *DB, nodeDomain string) error {
	// Obtener niveles
	var raizLevelID, troncoLevelID, ramaLevelID, broteLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'raiz' LIMIT 1`, nodeDomain).Scan(&raizLevelID)
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'tronco' LIMIT 1`, nodeDomain).Scan(&troncoLevelID)
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'rama' LIMIT 1`, nodeDomain).Scan(&ramaLevelID)
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 AND name = 'brote' LIMIT 1`, nodeDomain).Scan(&broteLevelID)
	if raizLevelID == "" {
		d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&raizLevelID)
	}
	if troncoLevelID == "" {
		troncoLevelID = raizLevelID
	}
	if ramaLevelID == "" {
		ramaLevelID = troncoLevelID
	}
	if broteLevelID == "" {
		broteLevelID = ramaLevelID
	}

	pinHash, _ := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)

	// Usuarios individuales de la ecoaldea
	users := []struct {
		username, displayName, levelID, accountType string
		credit, debit                               int
		isSuperAdmin                                bool
	}{
		// Super admin (demo)
		{"demo", "Admin Demo - Raices del Monte", raizLevelID, "individual", 5000, 5000, true},
		// Miembros Raiz (fundadores)
		{"elena", "Elena Bravo - Fundadora, permacultora", raizLevelID, "individual", 3000, 3000, false},
		{"marcos", "Marcos Soto - Fundador, herrero", raizLevelID, "individual", 3000, 3000, false},
		{"sofia", "Sofia Lara - Fundadora, partera", raizLevelID, "individual", 3000, 3000, false},
		// Miembros Tronco
		{"andrea", "Andrea Paz - Coordinadora de Economia", troncoLevelID, "individual", 2000, 2000, false},
		{"diego", "Diego Campos - Encargado del bosque", troncoLevelID, "individual", 2000, 2000, false},
		{"lucia", "Lucia Mendoza - Maestra de la escuela", troncoLevelID, "individual", 2000, 2000, false},
		{"pablo", "Pablo Rios - Constructor natural", troncoLevelID, "individual", 2000, 2000, false},
		// Miembros Rama
		{"carmen", "Carmen Vega - Panadera", ramaLevelID, "individual", 1500, 1500, false},
		{"jose", "Jose Torres - Cabrero", ramaLevelID, "individual", 1500, 1500, false},
		{"raul", "Raul Nunez - Artesano textil", ramaLevelID, "individual", 1500, 1500, false},
		{"isabel", "Isabel Cruz - Herbalista", ramaLevelID, "individual", 1500, 1500, false},
		// Miembro Brote (nuevo)
		{"tomas", "Tomas Gil - Recien ingresado, voluntario", broteLevelID, "individual", 500, 500, false},
	}

	for _, u := range users {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE username = $1 AND node_domain = $2`, u.username, nodeDomain).Scan(&existing)
		if existing > 0 {
			// Actualizar usuario existente: asegurar nombre, nivel y limites correctos
			d.Pool.Exec(ctx, `
				UPDATE users SET display_name = $3, member_level_id = $4, credit_limit = $5, debit_limit = $6, membership_status = 'active'
				WHERE username = $1 AND node_domain = $2`,
				u.username, nodeDomain, u.displayName, u.levelID, u.credit, u.debit)
			if u.isSuperAdmin {
				d.Pool.Exec(ctx, `UPDATE users SET is_super_admin = true, super_admin_enabled = true WHERE username = $1 AND node_domain = $2`, u.username, nodeDomain)
			}
			continue
		}

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

		d.Pool.Exec(ctx, `
			INSERT INTO user_credentials (user_id, password_hash, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT DO NOTHING`,
			userID, pinHash)
	}

	// Habilitar usuario demo
	d.Pool.Exec(ctx, `UPDATE demo_user_config SET is_enabled = true`)

	// Crear organizaciones (tiendas y servicios)
	demoSeedOrganizations(ctx, d, nodeDomain)

	return nil
}

func demoSeedOrganizations(ctx context.Context, d *DB, nodeDomain string) {
	// Obtener nivel de organizacion
	var orgLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM organization_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&orgLevelID)
	if orgLevelID == "" {
		// Fallback: usar member_levels si no hay org levels
		d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&orgLevelID)
	}
	if orgLevelID == "" {
		orgLevelID = uuid.New().String()
	}

	orgs := []struct {
		username, displayName, orgType string
		credit, debit                  int
	}{
		// Tiendas y servicios de la ecoaldea
		{"tienda_comunitaria", "Tienda Comunitaria La Semilla", "commerce", 5000, 5000},
		{"panaderia_monte", "Panaderia del Monte", "commerce", 3000, 3000},
		{"herreria", "Herreria de Marcos", "services", 2000, 2000},
		{"taller_textil", "Taller Textil Raices", "commerce", 2000, 2000},
		{"centro_salud", "Centro de Salud Natural", "public_service", 3000, 3000},
		{"escuela", "Escuela Primaria Raices", "public_service", 2000, 2000},
		{"coop_agricola", "Cooperativa Agricola El Bancale", "cooperative", 5000, 5000},
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
			INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, organization_level_id, organization_subtype, membership_status, is_approved, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
			VALUES ($1, $2, $3, 'organization', $4, $4, $5, 'active', true, $6, $7, $8, $9, $10)
			RETURNING id`,
			nodeDomain, org.username, org.displayName, orgLevelID, org.orgType, org.credit, org.debit, pubKeyHex, encryptedPrivKey, salt).Scan(&orgID)
		if err != nil {
			// Ya existe, obtener ID
			d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, org.username, nodeDomain).Scan(&orgID)
		}
		if orgID == uuid.Nil {
			continue
		}

		// Asignar junta directiva
		boardAssignments, ok := orgBoards[org.username]
		if !ok {
			continue
		}
		for _, ba := range boardAssignments {
			var memberUserID uuid.UUID
			d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, ba.username, nodeDomain).Scan(&memberUserID)
			if memberUserID == uuid.Nil {
				continue
			}
			d.Pool.Exec(ctx, `
				INSERT INTO organization_board_members (organization_id, user_id, position, term_start)
				VALUES ($1, $2, $3, NOW())
				ON CONFLICT (organization_id, user_id, position) DO NOTHING`,
				orgID, memberUserID, ba.position)
		}
	}
}

// demoSeedAssemblyOrganizations crea organizaciones de la Asamblea con servicios
// obligatorios (electricidad, transporte, etc.) y auto-suscribe a todos los miembros.
func demoSeedAssemblyOrganizations(ctx context.Context, d *DB, nodeDomain string) {
	// Obtener nivel de organizacion publica
	var orgLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM organization_levels WHERE node_domain = $1 AND name = 'org_publica' LIMIT 1`, nodeDomain).Scan(&orgLevelID)
	if orgLevelID == "" {
		d.Pool.QueryRow(ctx, `SELECT id::text FROM organization_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&orgLevelID)
	}

	// Organizaciones de la Asamblea (servicios publicos obligatorios)
	assemblyOrgs := []struct {
		username, displayName, orgType string
		credit, debit                  int
	}{
		{"electricidad", "Servicio Electrico Comunitario", "public_service", 10000, 10000},
		{"transporte", "Transporte Comunitario", "public_service", 5000, 5000},
		{"agua", "Sistema de Agua Comunitario", "public_service", 8000, 8000},
	}

	for _, org := range assemblyOrgs {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE username = $1 AND node_domain = $2`, org.username, nodeDomain).Scan(&existing)
		if existing > 0 {
			// Asegurar que esta marcada como assembly_owned
			d.Pool.Exec(ctx, `UPDATE users SET is_assembly_owned = true WHERE username = $1 AND node_domain = $2`, org.username, nodeDomain)
			continue
		}

		pubKey, privKey, _ := ed25519.GenerateKey(rand.Reader)
		pubKeyHex := hex.EncodeToString(pubKey)
		encryptedPrivKey := encryptPrivateKeyDemo(privKey, "demo1234")
		salt := make([]byte, 16)
		rand.Read(salt)

		var orgID uuid.UUID
		_ = d.Pool.QueryRow(ctx, `
			INSERT INTO users (node_domain, username, display_name, account_type, organization_subtype, membership_status, is_approved, is_assembly_owned, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
			VALUES ($1, $2, $3, 'organization', $4, 'active', true, true, $5, $6, $7, $8, $9)
			RETURNING id`,
			nodeDomain, org.username, org.displayName, org.orgType, org.credit, org.debit, pubKeyHex, encryptedPrivKey, salt).Scan(&orgID)
		if orgID == uuid.Nil {
			continue
		}
	}

	// Crear servicios para las organizaciones de la Asamblea
	type serviceDef struct {
		orgUsername, name, description, serviceType, frequency string
		amount                                                 int64
		obligations, rights, duties                            string
	}

	services := []serviceDef{
		{
			"electricidad", "Mensualidad Electrica", "Tarifa mensual fija por servicio electrico comunitario",
			"subscription", "monthly", 50,
			"Pagar la mensualidad mensualmente. Reportar fallas electricas.",
			"Acceso a la red electrica comunitaria. Mantenimiento de instalaciones.",
			"Ahorrar energia. Usar paneles solares cuando sea posible.",
		},
		{
			"transporte", "Mensualidad Transporte", "Tarifa mensual fija por servicio de transporte comunitario",
			"subscription", "monthly", 30,
			"Pagar la mensualidad mensualmente. Respetar horarios de salida.",
			"Acceso al transporte comunitario a la ciudad y entre comunidades.",
			"Cuidar el vehiculo comunitario. Compartir asientos.",
		},
		{
			"agua", "Mensualidad Agua", "Tarifa mensual fija por sistema de agua comunitario",
			"subscription", "monthly", 25,
			"Pagar la mensualidad mensualmente. Reportar fugas de agua.",
			"Acceso al sistema de agua potable comunitario.",
			"Usar agua de lluvia para riego. Cuidar las fuentes.",
		},
	}

	for _, svc := range services {
		var orgID uuid.UUID
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, svc.orgUsername, nodeDomain).Scan(&orgID)
		if orgID == uuid.Nil {
			continue
		}

		// Verificar si ya existe el servicio
		var svcCount int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organization_services WHERE organization_id = $1 AND name = $2`, orgID, svc.name).Scan(&svcCount)
		if svcCount > 0 {
			continue
		}

		var serviceID uuid.UUID
		_ = d.Pool.QueryRow(ctx, `
			INSERT INTO organization_services (node_domain, organization_id, name, description, service_type, amount, frequency, is_mandatory, obligations, rights, duties, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, true)
			RETURNING id`,
			nodeDomain, orgID, svc.name, svc.description, svc.serviceType, svc.amount, svc.frequency,
			svc.obligations, svc.rights, svc.duties).Scan(&serviceID)
		if serviceID == uuid.Nil {
			continue
		}

		// Auto-suscribir a todos los miembros activos
		_, _ = d.Pool.Exec(ctx, `
			INSERT INTO organization_subscriptions (service_id, user_id, status, next_charge_at)
			SELECT $1, u.id, 'auto', NOW() + interval '1 month'
			FROM users u
			WHERE u.node_domain = $2 AND u.account_type = 'individual' AND u.membership_status = 'active'
			ON CONFLICT (service_id, user_id) DO UPDATE SET status = 'auto', left_at = NULL, next_charge_at = NOW() + interval '1 month'`,
			serviceID, nodeDomain)
	}

	// Tambien crear una organizacion voluntaria con servicio opcional
	var voluntariaID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = 'centro_salud' AND node_domain = $1`, nodeDomain).Scan(&voluntariaID)
	if voluntariaID != uuid.Nil {
		var svcCount int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organization_services WHERE organization_id = $1 AND name = 'Membresia Centro de Salud'`, voluntariaID).Scan(&svcCount)
		if svcCount == 0 {
			var serviceID uuid.UUID
			_ = d.Pool.QueryRow(ctx, `
				INSERT INTO organization_services (node_domain, organization_id, name, description, service_type, amount, frequency, is_mandatory, obligations, rights, duties, is_active)
				VALUES ($1, $2, 'Membresia Centro de Salud', 'Membresia voluntaria para acceso a medicinas naturales y consultas', 'subscription', $3, 'monthly', false, 'Pagar mensualidad si estas suscrito', 'Acceso a consultas y medicinas naturales', 'Cuidar las plantas medicinales', true)
				RETURNING id`,
				nodeDomain, voluntariaID, int64(15)).Scan(&serviceID)

			// Suscribir a algunos miembros voluntariamente
			for _, username := range []string{"elena", "isabel", "sofia", "diego"} {
				var uid uuid.UUID
				d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, username, nodeDomain).Scan(&uid)
				if uid != uuid.Nil {
					d.Pool.Exec(ctx, `
						INSERT INTO organization_subscriptions (service_id, user_id, status, next_charge_at)
						VALUES ($1, $2, 'active', NOW() + interval '1 month')
						ON CONFLICT DO NOTHING`,
						serviceID, uid)
				}
			}
		}
	}

	log.Println("Demo: assembly organizations + services seeded")
}

// orgBoards define la junta directiva de cada organizacion del demo
// username -> [{username, position}]
var orgBoards = map[string][]struct {
	username, position string
}{
	"asamblea": {
		{"elena", "coordinadora"},
		{"marcos", "secretario"},
		{"sofia", "tesorera"},
		{"demo", "vocal"},
	},
	"tienda_comunitaria": {
		{"andrea", "coordinadora"},
		{"carmen", "tesorera"},
		{"jose", "vocal"},
	},
	"panaderia_monte": {
		{"carmen", "coordinadora"},
		{"isabel", "miembro"},
	},
	"herreria": {
		{"marcos", "coordinador"},
		{"pablo", "ayudante"},
	},
	"taller_textil": {
		{"raul", "coordinador"},
		{"isabel", "artesana"},
	},
	"centro_salud": {
		{"sofia", "coordinadora"},
		{"isabel", "herbalista"},
	},
	"escuela": {
		{"lucia", "directora"},
		{"andrea", "maestra"},
	},
	"coop_agricola": {
		{"diego", "coordinador"},
		{"tomas", "campesino"},
		{"elena", "vocal"},
	},
}

func demoSeedDepartments(ctx context.Context, d *DB, nodeDomain string) {
	// Mapeo de departamento -> miembros ( usernames )
	deptMembers := map[string][]struct {
		username, role string
	}{
		"Consejo de Vision": {
			{"elena", "Coordinadora"},
			{"marcos", "Visionario"},
			{"lucia", "Visionaria"},
		},
		"Comision de Economia": {
			{"jose", "Coordinador"},
			{"carmen", "Tesorera"},
			{"demo", "Miembro"},
		},
		"Comision de Educacion": {
			{"andrea", "Coordinadora"},
			{"isabel", "Educadora"},
		},
		"Comision de Salud": {
			{"sofia", "Coordinadora"},
			{"pablo", "Saludista"},
		},
		"Comision de Ambiente": {
			{"raul", "Coordinador"},
			{"tomas", "Guardabosque"},
		},
		"Comision de Admision": {
			{"diego", "Coordinador"},
			{"elena", "Miembro"},
		},
		"Comision de Construccion": {
			{"marcos", "Coordinador"},
			{"raul", "Constructor"},
		},
	}

	depts := []struct {
		name, desc string
	}{
		{"Consejo de Vision", "Custodia la vision y valores de la ecoaldea. 3 miembros Raiz."},
		{"Comision de Economia", "Gestiona el TQ, intercambios, tienda comunitaria y comercio federado."},
		{"Comision de Educacion", "Escuela, talleres, capacitacion, intercambio de conocimiento."},
		{"Comision de Salud", "Centro de salud natural, primeros auxilios, prevencion."},
		{"Comision de Ambiente", "Bosque, agua, biodiversidad, regeneracion de suelos."},
		{"Comision de Admision", "Revision de solicitudes de nuevos miembros, periodo de prueba."},
		{"Comision de Construccion", "Construcciones naturales, mantenimiento, infraestructura."},
	}

	for _, dept := range depts {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM departments WHERE name = $1 AND node_domain = $2`, dept.name, nodeDomain).Scan(&existing)

		// Obtener el ID de la organizacion asamblea para vincular el dept
		var asambleaOrgID uuid.UUID
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = 'asamblea' AND node_domain = $1 AND account_type = 'organization'`, nodeDomain).Scan(&asambleaOrgID)

		var deptID uuid.UUID
		if existing > 0 {
			d.Pool.QueryRow(ctx, `SELECT id FROM departments WHERE name = $1 AND node_domain = $2`, dept.name, nodeDomain).Scan(&deptID)
			// Vincular al asamblea si no lo esta
			if asambleaOrgID != uuid.Nil {
				d.Pool.Exec(ctx, `UPDATE departments SET parent_organization_id = $1 WHERE id = $2 AND parent_organization_id IS NULL`, asambleaOrgID, deptID)
			}
		} else {
			deptID = uuid.New()
			d.Pool.Exec(ctx, `
				INSERT INTO departments (id, node_domain, name, description, group_type, is_active, created_at, parent_organization_id)
				VALUES ($1, $2, $3, $4, 'department', true, NOW(), $5)
				ON CONFLICT DO NOTHING`,
				deptID, nodeDomain, dept.name, dept.desc, asambleaOrgID)
		}

		// Crear rol de Miembro si no existe
		var roleID uuid.UUID
		d.Pool.QueryRow(ctx, `SELECT id FROM department_roles WHERE department_id = $1 AND name = 'Miembro' LIMIT 1`, deptID).Scan(&roleID)
		if roleID == uuid.Nil {
			roleID = uuid.New()
			d.Pool.Exec(ctx, `
				INSERT INTO department_roles (id, department_id, name, description, is_active, created_at)
				VALUES ($1, $2, 'Miembro', $3, true, NOW())
				ON CONFLICT DO NOTHING`,
				roleID, deptID, dept.desc)

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

		// Asignar miembros al departamento
		members := deptMembers[dept.name]
		for _, m := range members {
			var userID uuid.UUID
			d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, m.username, nodeDomain).Scan(&userID)
			if userID == uuid.Nil {
				continue
			}

			// Crear rol especifico si no es "Miembro"
			memberRoleID := roleID
			if m.role != "Miembro" {
				d.Pool.QueryRow(ctx, `SELECT id FROM department_roles WHERE department_id = $1 AND name = $2 LIMIT 1`, deptID, m.role).Scan(&memberRoleID)
				if memberRoleID == uuid.Nil {
					memberRoleID = uuid.New()
					d.Pool.Exec(ctx, `
						INSERT INTO department_roles (id, department_id, name, description, is_active, created_at)
						VALUES ($1, $2, $3, $4, true, NOW())
						ON CONFLICT DO NOTHING`,
						memberRoleID, deptID, m.role, m.role)
				}
			}

			// Verificar si ya es miembro
			var memCount int
			d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM department_members WHERE department_id = $1 AND user_id = $2`, deptID, userID).Scan(&memCount)
			if memCount == 0 {
				d.Pool.Exec(ctx, `
					INSERT INTO department_members (id, department_id, user_id, role_id, assigned_at)
					VALUES ($1, $2, $3, $4, NOW())
					ON CONFLICT DO NOTHING`,
					uuid.New(), deptID, userID, memberRoleID)
			}
		}

		// Crear cuenta bancaria del departamento (user con account_type='department')
		var deptAccountID uuid.UUID
		deptAccountUsername := "dept_" + strings.ReplaceAll(strings.ToLower(dept.name), " ", "_")
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, deptAccountUsername, nodeDomain).Scan(&deptAccountID)
		if deptAccountID == uuid.Nil {
			deptAccountID = uuid.New()
			pubKey, privKey, _ := ed25519.GenerateKey(rand.Reader)
			pubKeyHex := hex.EncodeToString(pubKey)
			encryptedPrivKey := encryptPrivateKeyDemo(privKey, "demo1234")
			salt := make([]byte, 16)
			rand.Read(salt)

			d.Pool.Exec(ctx, `
				INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, is_approved, balance, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
				VALUES ($1, $2, $3, $4, 'department', 'active', true, 0, 5000, 5000, $5, $6, $7)
				ON CONFLICT DO NOTHING`,
				deptAccountID, nodeDomain, deptAccountUsername, "Cuenta: "+dept.name,
				pubKeyHex, encryptedPrivKey, salt)
		}
	}
}

func demoSeedGovernance(ctx context.Context, d *DB, nodeDomain string) {
	rules := []struct {
		title, category, desc, body string
	}{
		{"Principio de Consentimiento", "Toma de decisiones", "Las decisiones se toman por consentimiento", "Las decisiones se toman por consentimiento: una propuesta se aprueba cuando nadie tiene una objection fundamentada. No votamos a favor o en contra, preguntamos si alguien tiene una razon para que no se haga."},
		{"Admision de Miembros", "Membresia", "Proceso de admision de nuevos miembros", "Los nuevos miembros pasan por un periodo de prueba de 6 meses como Brote. Despues, la Comision de Admision evalua y la Asamblea decide por consentimiento. Se requiere patrocinio de un miembro Tronco o Raiz."},
		{"Trabajo Comunitario", "Obligaciones", "Aportes de trabajo comunitario", "Cada miembro contribuye con 8 horas mensuales de trabajo comunitario: mantenimiento, bosque, construccion, o tareas asignadas por comisiones. Se registra en TQ."},
		{"Uso del TQ", "Economia", "Normas del Trueque Comunitario", "El TQ es la unica moneda para intercambios internos. No se acepta dinero externo dentro de la ecoaldea. Los intercambios con el exterior se gestionan a traves de la Comision de Economia."},
		{"Credito Comunitario", "Economia", "Creditos en TQ", "Los creditos en TQ los aprueba la Asamblea. No hay interes. El plazo y condiciones los decide la asamblea caso por caso. El fondo comunitario respalda los creditos."},
		{"Cuidado del Bosque", "Ambiente", "Normas de manejo del bosque", "El 60% del territorio es bosque protegido. Solo se extrae madera muerta o con permiso de la Comision de Ambiente. Cada miembro planta 10 arboles al ano."},
		{"Asamblea Mensual", "Gobernanza", "Frecuencia y obligatoriedad", "La asamblea se realiza el primer domingo de cada mes. Es obligatoria para miembros Raiz y Tronco. Miembros Rama y Brote tienen voz pero su asistencia es voluntaria."},
		{"Organizaciones de la Asamblea", "estructura", "La Asamblea puede crear organizaciones que le pertenecen", "La Asamblea puede crear organizaciones que le pertenecen. Todos los miembros del nodo son automaticamente miembros de estas organizaciones. Sus decisiones se votan en la Asamblea General. Ejemplos: servicio electrico, transporte, agua."},
		{"Junta Directiva de Organizaciones", "estructura", "Cada organizacion tiene su propia junta directiva", "Cada organizacion tiene su propia junta directiva con reuniones, votaciones y actas separadas. La junta toma decisiones operativas que no requieren aprobacion de la asamblea."},
		{"Dos Espacios de Decision", "estructura", "Asamblea y Junta Directiva", "Cada organizacion tiene dos espacios de decision: la Asamblea (todos los miembros) y la Junta Directiva (solo directivos). Ambos tienen sesiones, propuestas, votaciones, actas y asistencia."},
		{"Servicios de Organizaciones", "unidades_productivas", "Mensualidades, cobros y pagos", "Las organizaciones pueden ofrecer servicios: mensualidades, cobros, pagos a miembros, o servicios gratuitos. Cada servicio define obligaciones, derechos y deberes."},
		{"Servicios Obligatorios", "unidades_productivas", "Aplican a todos los miembros", "Los servicios obligatorios aplican a todos los miembros. En organizaciones de la Asamblea, todos los miembros del nodo deben pagar. En organizaciones regulares, requieren votacion de los miembros."},
		{"Servicios Voluntarios", "unidades_productivas", "Suscripcion libre", "Los servicios voluntarios permiten a cada miembro suscribirse o cancelar libremente. Ningun miembro esta obligado a usar un servicio voluntario."},
		{"Servicios que Pagan al Miembro", "unidades_productivas", "Organizaciones que pagan", "Algunas organizaciones pagan a sus miembros mensualmente por trabajo o servicios prestados. El monto se transfiere automaticamente cada mes."},
		{"Servicios Gratuitos", "unidades_productivas", "Monto cero", "Los servicios pueden ser gratuitos (monto cero). En ese caso, solo se registra la membresia sin cobro."},
		{"Cobro Automatico Mensual", "unidades_productivas", "Scheduler de cobros", "El sistema cobra o paga automaticamente los servicios activos segun la frecuencia configurada. Los miembros reciben notificaciones de cada cobro."},
		{"Impuestos por Nivel de Miembro", "impuestos", "Cada nivel tiene su tasa", "Cada nivel de miembro tiene su propia tasa de impuesto. Los miembros nuevos (brote) pagan 2%, los fundadores (raiz) pagan 0.5%, como incentivo para ascender."},
		{"Impuestos por Nivel de Organizacion", "impuestos", "Tasa segun tipo de organizacion", "Las organizaciones pagan impuestos segun su nivel. Las instituciones publicas estan exentas (0%). Las de produccion pagan 2%, las de consumo 1%."},
		{"Destino de los Impuestos", "impuestos", "Cuenta de la Asamblea", "Todos los impuestos llegan automaticamente a la cuenta de la Asamblea. La Asamblea decide a donde distribuir ese dinero mediante propuestas de distribucion de fondos."},
	}

	for _, rule := range rules {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM governance_rules WHERE node_domain = $1 AND title = $2`, nodeDomain, rule.title).Scan(&existing)
		if existing > 0 {
			continue
		}
		d.Pool.Exec(ctx, `
			INSERT INTO governance_rules (id, node_domain, title, description, category, body, is_active, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
			ON CONFLICT DO NOTHING`,
			uuid.New(), nodeDomain, rule.title, rule.desc, rule.category, rule.body)
	}
}

func encryptPrivateKeyDemo(privKey ed25519.PrivateKey, passphrase string) []byte {
	key := sha256.Sum256([]byte(passphrase))
	block, _ := aes.NewCipher(key[:])
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	rand.Read(nonce)
	return gcm.Seal(nonce, nonce, privKey, nil)
}

func demoSeedTransactions(ctx context.Context, d *DB, nodeDomain string) error {
	getUserID := func(username string) uuid.UUID {
		var id uuid.UUID
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE username = $1 AND node_domain = $2`, username, nodeDomain).Scan(&id)
		return id
	}

	carmen := getUserID("carmen")
	jose := getUserID("jose")
	andrea := getUserID("andrea")
	diego := getUserID("diego")
	lucia := getUserID("lucia")
	isabel := getUserID("isabel")
	raul := getUserID("raul")
	elena := getUserID("elena")
	marcos := getUserID("marcos")
	sofia := getUserID("sofia")
	pablo := getUserID("pablo")
	tomas := getUserID("tomas")
	demoUser := getUserID("demo")
	tienda := getUserID("tienda_comunitaria")
	panaderia := getUserID("panaderia_monte")
	herreria := getUserID("herreria")
	taller := getUserID("taller_textil")
	coop := getUserID("coop_agricola")
	impuestos := getUserID("impuestos")
	fondo := getUserID("fondo_comunitario")
	escuela := getUserID("escuela")
	centroSalud := getUserID("centro_salud")

	// Verificar si ya hay transacciones
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM transactions WHERE sender_node = $1 OR receiver_node = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return nil
	}

	type txn struct {
		sender, receiver uuid.UUID
		amount           int64
		desc             string
		hoursAgo         int
	}

	txns := []txn{
		// Transacciones del usuario demo (para que tenga saldo e historial)
		{demoUser, tienda, 120, "Compra de granos y abarrotes", 24 * 60},
		{panaderia, demoUser, 50, "Pago por pan de quinua semanal", 24 * 58},
		{demoUser, herreria, 80, "Reparacion de herramientas", 24 * 45},
		{taller, demoUser, 100, "Pago por costura de cortina", 24 * 30},
		{demoUser, coop, 200, "Compra de semillas para huerto", 24 * 20},
		{isabel, demoUser, 60, "Pago por queso de cabra", 24 * 10},
		{demoUser, panaderia, 45, "Pan y galletas", 24 * 5},
		{coop, demoUser, 150, "Venta de verduras del huerto", 24 * 2},
		// Compras en tiendas (varios meses)
		{carmen, tienda, 80, "Compra de frijol y quinua", 24 * 90},
		{jose, tienda, 60, "Compra de tijeras de podar", 24 * 88},
		{andrea, panaderia, 50, "Pan de quinua (1kg)", 24 * 85},
		{diego, jose, 80, "Transporte de cosecha en mula", 24 * 82},
		{lucia, isabel, 25, "Te de hierbas del monte", 24 * 80},
		{isabel, carmen, 60, "Queso de cabra (500g)", 24 * 78},
		{raul, tienda, 42, "Compra de ocumo y guayaba", 24 * 75},
		{carmen, raul, 250, "Ruana de lana (encargo)", 24 * 72},
		{andrea, isabel, 45, "Aceite de romero", 24 * 70},
		{diego, panaderia, 50, "Pan de quinua semanal", 24 * 68},
		{sofia, taller, 120, "Tela de algodon (3m)", 24 * 65},
		{pablo, herreria, 90, "Reparacion de azadon", 24 * 60},
		{elena, coop, 200, "Semillas criollas (lote)", 24 * 58},
		{marcos, panaderia, 35, "Pan integral semanal", 24 * 55},
		{tomas, tienda, 70, "Compra de miel y cafe", 24 * 52},
		{lucia, taller, 85, "Manta de lana", 24 * 50},
		{carmen, panaderia, 40, "Pan y dulces", 24 * 48},
		{jose, herreria, 110, "Cuchillo de cocina", 24 * 45},
		{andrea, coop, 150, "Abono organico (sacos)", 24 * 42},
		{diego, taller, 95, "Costura de ropa de trabajo", 24 * 40},
		// Mes anterior
		{sofia, tienda, 55, "Compra mensual de granos", 24 * 35},
		{pablo, isabel, 30, "Jabon natural (6 unidades)", 24 * 32},
		{elena, panaderia, 45, "Pan artesanal", 24 * 30},
		{raul, herreria, 75, "Herramienta de jardin", 24 * 28},
		{tomas, coop, 130, "Semillas para huerto", 24 * 25},
		{carmen, taller, 180, "Cortina de lana", 24 * 22},
		{marcos, coop, 95, "Fertilizante organico", 24 * 20},
		{andrea, tienda, 65, "Aceite, sal, especias", 24 * 18},
		{diego, isabel, 40, "Unguento medicinal", 24 * 15},
		{lucia, panaderia, 38, "Pan semanal", 24 * 12},
		// Recientes
		{jose, taller, 70, "Bolsa de lona", 24 * 10},
		{sofia, coop, 110, "Banca de semillas", 24 * 8},
		{pablo, tienda, 52, "Compra quinua y frijol", 24 * 6},
		{elena, isabel, 28, "Te de manzanilla", 24 * 5},
		{tomas, panaderia, 33, "Pan y galletas", 24 * 3},
		{carmen, coop, 140, "Canasta de verduras", 24 * 2},
		{marcos, taller, 65, "Gorro de lana", 24 * 1},
		// Transacciones con impuesto (org -> individual)
		{tienda, impuestos, 8, "Impuesto 1% sobre venta 80", 24 * 90},
		{panaderia, impuestos, 5, "Impuesto 1% sobre venta 50", 24 * 85},
		{taller, impuestos, 12, "Impuesto 1% sobre venta 120", 24 * 65},
		{herreria, impuestos, 9, "Impuesto 1% sobre venta 90", 24 * 60},
		{coop, impuestos, 20, "Impuesto 1% sobre venta 200", 24 * 58},
		// Distribución del fondo a proyectos
		{impuestos, fondo, 54, "Transferencia a fondo comunitario", 24 * 30},
		// Transacciones federadas (entre nodos)
		{carmen, jose, 100, "Compra de quinua andina (federada)", 24 * 20},
		{tienda, coop, 300, "Compra mayorista de semillas", 24 * 15},
		// Transacciones con organizaciones (para que tengan saldo)
		{tienda, fondo, 100, "Donacion al fondo comunitario", 24 * 25},
		{coop, fondo, 80, "Aporte al fondo comunitario", 24 * 22},
		{fondo, escuela, 150, "Materiales educativos para escuela", 24 * 18},
		{fondo, coop, 100, "Compra de semillas para banco comunitario", 24 * 12},
		{escuela, tienda, 60, "Compra de utiles y materiales", 24 * 10},
		{centroSalud, tienda, 45, "Compra de medicamentos naturales", 24 * 8},
		{tienda, panaderia, 90, "Pago por panaderia semanal", 24 * 6},
		{coop, herreria, 120, "Compra de herramientas agricolas", 24 * 4},
		// Transacciones con cuentas de departamentos
		{fondo, getUserID("dept_comision_de_economia"), 200, "Presupuesto trimestral Comision de Economia", 24 * 15},
		{fondo, getUserID("dept_comision_de_ambiente"), 100, "Presupuesto para reforestacion", 24 * 14},
		{fondo, getUserID("dept_comision_de_construccion"), 150, "Materiales para reparaciones", 24 * 10},
		{getUserID("dept_comision_de_economia"), tienda, 80, "Compra de suministros para evento", 24 * 8},
		{getUserID("dept_comision_de_ambiente"), coop, 50, "Compra de arbolitos", 24 * 5},
		{getUserID("dept_comision_de_construccion"), herreria, 70, "Herramientas de construccion", 24 * 3},
	}

	taxRate := int64(1) // 1%
	for i, t := range txns {
		if t.sender == uuid.Nil || t.receiver == uuid.Nil {
			continue
		}

		// Calcular impuesto (1% si el emisor es organización)
		var taxAmount int64 = 0
		var taxTarget *uuid.UUID
		var senderType string
		d.Pool.QueryRow(ctx, `SELECT account_type FROM users WHERE id = $1`, t.sender).Scan(&senderType)
		if senderType == "organization" && impuestos != uuid.Nil {
			taxAmount = t.amount * taxRate / 100
			taxTarget = &impuestos
		}

		txID := uuid.New()
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO transactions (id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, tax_amount, tax_target_account, status, metadata, created_at, confirmed_at)
			VALUES ($1, 'transfer', $2, $3, $4, $4, $5, $6, $7, 'completed', $8, NOW() - make_interval(hours => $9), NOW() - make_interval(hours => $9))`,
			txID, t.sender, t.receiver, nodeDomain, t.amount, taxAmount, taxTarget,
			fmt.Sprintf(`{"description": "%s"}`, t.desc), t.hoursAgo)
		if err != nil {
			log.Printf("Demo: error creating transaction %d: %v", i, err)
			continue
		}

		// Crear ledger entries (débito/crédito) - usar 'user_balance' para que GetBalance los cuente
		d.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
			VALUES ($1, $2, 'debit', $3, 'user_balance', $4, NOW() - make_interval(hours => $5))`,
			txID, t.sender, t.amount, nodeDomain, t.hoursAgo)
		d.Pool.Exec(ctx, `
			INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
			VALUES ($1, $2, 'credit', $3, 'user_balance', $4, NOW() - make_interval(hours => $5))`,
			txID, t.receiver, t.amount, nodeDomain, t.hoursAgo)

		// Si hay impuesto, crear ledger entry para la cuenta de impuestos
		if taxAmount > 0 && impuestos != uuid.Nil {
			d.Pool.Exec(ctx, `
				INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
				VALUES ($1, $2, 'credit', $3, 'fund', $4, NOW() - make_interval(hours => $5))`,
				txID, impuestos, taxAmount, nodeDomain, t.hoursAgo)
		}

		// Crear audit log
		d.Pool.Exec(ctx, `
			INSERT INTO audit_log (actor_id, action, target_id, details, created_at)
			VALUES ($1, 'transfer', $2, $3, NOW() - make_interval(hours => $4))`,
			t.sender, t.receiver,
			fmt.Sprintf(`{"amount": %d, "description": "%s", "tx_id": "%s"}`, t.amount, t.desc, txID.String()),
			t.hoursAgo)
	}

	// Actualizar saldos de usuarios basado en ledger entries (solo user_balance)
	d.Pool.Exec(ctx, `
		UPDATE users u SET balance = COALESCE((
			SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END)
			FROM ledger_entries le WHERE le.account_id = u.id AND le.account_category = 'user_balance'
		), 0)
		WHERE u.node_domain = $1`, nodeDomain)

	// Crear solicitudes de admisión
	demoSeedAdmissionRequests(ctx, d, nodeDomain)

	// Crear operaciones de comercio externo
	demoSeedExternalOps(ctx, d, nodeDomain)

	// Crear propuestas de distribución del fondo
	demoSeedFundProposals(ctx, d, nodeDomain)

	// Crear reportes de paridad federada
	demoSeedParityReports(ctx, d, nodeDomain)

	log.Println("Demo: transactions + ledger + audit seeded")
	return nil
}

func demoSeedAssemblyVotes(ctx context.Context, d *DB, nodeDomain string, adminID uuid.UUID) {
	// Obtener miembros con derecho a voto
	rows, err := d.Pool.Query(ctx, `SELECT id FROM users WHERE node_domain = $1 AND account_type = 'individual' AND membership_status = 'active' LIMIT 20`, nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()
	var voters []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		voters = append(voters, id)
	}

	// Obtener decisiones aprobadas
	decRows, err := d.Pool.Query(ctx, `SELECT id FROM assembly_decisions WHERE status = 'approved'`)
	if err != nil {
		return
	}
	defer decRows.Close()
	var decisions []uuid.UUID
	for decRows.Next() {
		var id uuid.UUID
		decRows.Scan(&id)
		decisions = append(decisions, id)
	}

	// Crear votos (70% a favor, 20% en contra, 10% abstencion)
	for _, decID := range decisions {
		for i, voterID := range voters {
			var vote string
			pct := i % 10
			if pct < 7 {
				vote = "for"
			} else if pct < 9 {
				vote = "against"
			} else {
				vote = "abstain"
			}
			d.Pool.Exec(ctx, `
				INSERT INTO assembly_votes (id, decision_id, voter_id, vote, created_at)
				VALUES (gen_random_uuid(), $1, $2, $3, NOW() - make_interval(days => $4))
				ON CONFLICT DO NOTHING`,
				decID, voterID, vote, 25-i)
		}
	}
}

func demoSeedAdmissionRequests(ctx context.Context, d *DB, nodeDomain string) {
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM admission_requests WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return
	}

	requests := []struct {
		username, displayName, level, status string
	}{
		{"tomas_gil", "Tomas Gil", "brote", "approved"},
		{"maria_fernandez", "Maria Fernandez", "brote", "pending"},
		{"carlos_rojas", "Carlos Rojas", "semilla", "pending"},
		{"ana_morales", "Ana Morales", "brote", "rejected"},
		{"luis_perez", "Luis Perez", "raiz", "approved"},
	}

	for _, r := range requests {
		var reviewerID uuid.UUID
		if r.status == "approved" || r.status == "rejected" {
			d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'demo' LIMIT 1`, nodeDomain).Scan(&reviewerID)
		}

		d.Pool.Exec(ctx, `
			INSERT INTO admission_requests (id, node_domain, proposed_username, display_name, proposed_level, status, submitted_at, reviewed_at, approved_at, rejected_at, reviewed_by, metadata, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() - interval '30 days', $6, $7, $8, $9, '{}', NOW() - interval '30 days')
			ON CONFLICT DO NOTHING`,
			nodeDomain, r.username, r.displayName, r.level, r.status,
			func() interface{} {
				if r.status == "approved" || r.status == "rejected" {
					return time.Now().Add(-25 * 24 * time.Hour)
				}
				return nil
			}(),
			func() interface{} {
				if r.status == "approved" {
					return time.Now().Add(-25 * 24 * time.Hour)
				}
				return nil
			}(),
			func() interface{} {
				if r.status == "rejected" {
					return time.Now().Add(-25 * 24 * time.Hour)
				}
				return nil
			}(),
			func() interface{} {
				if r.status == "approved" || r.status == "rejected" {
					return reviewerID
				}
				return nil
			}())
	}

	// Crear audit log para admisiones
	for _, r := range requests {
		if r.status == "approved" {
			d.Pool.Exec(ctx, `
				INSERT INTO audit_log (action, details, created_at)
				VALUES ('admission_approved', $1, NOW() - interval '25 days')`,
				fmt.Sprintf(`{"username": "%s", "level": "%s"}`, r.username, r.level))
		}
	}

	log.Println("Demo: admission requests seeded")
}

func demoSeedExternalOps(ctx context.Context, d *DB, nodeDomain string) {
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM external_bridge_operations WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return
	}

	ops := []struct {
		opType, productName, status, buyerSeller string
		quantity                                 int64
		internalValue                            int64
		externalUSD                              float64
		fcApplied                                float64
	}{
		{"import", "Sal de cocina (50kg)", "completed", "Distribuidora Externa", 50, 250, 50, 5.0},
		{"import", "Herramientas de jardin (lote)", "completed", "Ferreteria El Tornillo", 1, 180, 36, 5.0},
		{"export", "Cafe de altura (20kg)", "completed", "Cooperativa de Cafe del Valle", 20, 400, 80, 5.0},
		{"import", "Medicamentos basicos", "approved", "Farmacia Central", 1, 350, 70, 5.0},
		{"export", "Miel organica (10kg)", "approved", "Mercado Natural", 10, 200, 40, 5.0},
		{"import", "Tela de algon (100m)", "pending", "Textiles del Sur", 100, 500, 100, 5.0},
		{"export", "Artesania textil (lote)", "pending", "Tienda Solidaria", 1, 300, 60, 5.0},
	}

	for i, op := range ops {
		var completedAt interface{}
		if op.status == "completed" {
			completedAt = time.Now().Add(-time.Duration(24*(20-i)) * time.Hour)
		} else {
			completedAt = nil
		}

		d.Pool.Exec(ctx, `
			INSERT INTO external_bridge_operations (id, node_domain, operation_type, product_name, quantity, internal_value, external_value_usd, fc_applied, status, buyer_seller, notes, created_at, completed_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, '', NOW() - make_interval(days => $11), $10)
			ON CONFLICT DO NOTHING`,
			nodeDomain, op.opType, op.productName, op.quantity, op.internalValue, op.externalUSD, op.fcApplied, op.status, op.buyerSeller, completedAt, 25-i)
	}

	log.Println("Demo: external operations seeded")
}

func demoSeedFundProposals(ctx context.Context, d *DB, nodeDomain string) {
	// Crear propuestas de distribución del fondo en tax_distributions
	var fondoID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'fondo_comunitario' LIMIT 1`, nodeDomain).Scan(&fondoID)
	if fondoID == uuid.Nil {
		return
	}

	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM tax_distributions WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return
	}

	// Obtener IDs de organizaciones para distribuciones
	var escuelaID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'escuela' LIMIT 1`, nodeDomain).Scan(&escuelaID)

	var coopID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'coop_agricola' LIMIT 1`, nodeDomain).Scan(&coopID)

	// Crear algunas distribuciones ejecutadas
	distributions := []struct {
		toAccount uuid.UUID
		amount    int64
		reason    string
		status    string
	}{
		{escuelaID, 150, "Materiales educativos para escuela", "executed"},
		{coopID, 100, "Compra de semillas para banco comunitario", "executed"},
	}

	for _, dist := range distributions {
		if dist.toAccount == uuid.Nil {
			continue
		}
		d.Pool.Exec(ctx, `
			INSERT INTO tax_distributions (id, node_domain, from_account, to_account, amount, reason, status, executed_at, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW() - interval '20 days', NOW() - interval '25 days')
			ON CONFLICT DO NOTHING`,
			nodeDomain, fondoID, dist.toAccount, dist.amount, dist.reason, dist.status)
	}

	log.Println("Demo: fund distribution proposals seeded")
}

func demoSeedParityReports(ctx context.Context, d *DB, nodeDomain string) {
	// Crear node_balance entries para peers federados
	peers := []struct {
		peerDomain string
		balance    int64
	}{
		{"ecoaldea-cerro-verde", 1500},
		{"comunidad-rio-claro", -800},
		{"aldea-semilla-viva", 320},
	}

	var adminID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'demo' LIMIT 1`, nodeDomain).Scan(&adminID)

	for _, p := range peers {
		// Verificar si ya existe
		var count int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM node_balance WHERE remote_node = $1`, p.peerDomain).Scan(&count)
		if count > 0 {
			continue
		}

		d.Pool.Exec(ctx, `
			INSERT INTO node_balance (remote_node, balance, last_sync)
			VALUES ($1, $2, NOW())
			ON CONFLICT DO NOTHING`,
			p.peerDomain, p.balance)

		// Crear transacciones federadas para generar reportes de paridad
		// Estas son transacciones entre nodos, NO personales.
		// sender_id y receiver_id son NULL para que no aparezcan en la billetera personal.
		if adminID != uuid.Nil {
			// Transaccion principal (balance inicial)
			txID := uuid.New()
			d.Pool.Exec(ctx, `
				INSERT INTO transactions (id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, status, metadata, created_at, confirmed_at)
				VALUES ($1, 'federation_transfer', NULL, NULL, $2, $3, $4, 'completed', '{"type": "federation", "description": "Intercambio federado inicial"}', NOW() - interval '15 days', NOW() - interval '15 days')`,
				txID, nodeDomain, p.peerDomain, p.balance)

			// Crear ledger entry de node_bridge para que el balance del nodo funcione
			if p.balance > 0 {
				d.Pool.Exec(ctx, `
					INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
					VALUES ($1, $2, 'credit', $3, 'node_bridge', $4, NOW() - interval '15 days')`,
					txID, adminID, p.balance, p.peerDomain)
			} else if p.balance < 0 {
				d.Pool.Exec(ctx, `
					INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, account_category, counterpart_node, created_at)
					VALUES ($1, $2, 'debit', $3, 'node_bridge', $4, NOW() - interval '15 days')`,
					txID, adminID, -p.balance, p.peerDomain)
			}

			// Transacciones adicionales con diferentes fechas y descripciones
			fedTxns := []struct {
				amount    int64
				desc      string
				daysAgo   int
				direction string // "out" = envias, "in" = recibes
			}{
				{120, "Exportacion: Miel organica (10kg)", 12, "out"},
				{80, "Importacion: Herramientas de jardin", 10, "in"},
				{150, "Exportacion: Cafe de altura (5kg)", 8, "out"},
				{60, "Importacion: Medicamentos basicos", 6, "in"},
				{200, "Exportacion: Artesania textil (lote)", 4, "out"},
				{90, "Importacion: Sal de cocina (50kg)", 2, "in"},
			}
			for _, ft := range fedTxns {
				ftxID := uuid.New()
				senderNode := nodeDomain
				receiverNode := p.peerDomain
				if ft.direction == "in" {
					senderNode = p.peerDomain
					receiverNode = nodeDomain
				}
				d.Pool.Exec(ctx, `
					INSERT INTO transactions (id, tx_type, sender_id, receiver_id, sender_node, receiver_node, amount, status, metadata, created_at, confirmed_at)
					VALUES ($1, 'federation_transfer', NULL, NULL, $2, $3, $4, 'completed', $5, NOW() - interval '1 day' * $6, NOW() - interval '1 day' * $6)`,
					ftxID, senderNode, receiverNode, ft.amount,
					fmt.Sprintf(`{"type": "federation", "description": "%s"}`, ft.desc), ft.daysAgo)

				// Audit log
				d.Pool.Exec(ctx, `
					INSERT INTO audit_log (actor_id, action, details, created_at)
					VALUES ($1, 'federation', $2, NOW() - interval '1 day' * $3)`,
					adminID, fmt.Sprintf(`{"peer": "%s", "amount": %d, "description": "%s"}`, p.peerDomain, ft.amount, ft.desc), ft.daysAgo)
			}
		}
	}

	log.Println("Demo: parity reports + federation balances seeded")
}

// DemoReset borra todos los datos del dominio demo y los re-seedea
func DemoReset(ctx context.Context, d *DB, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "demo"
	}
	log.Println("DemoReset: borrando datos del dominio", nodeDomain)

	// 1. Borrar tablas que referencian users via FK (antes de borrar users)
	// Estas tablas no tienen node_domain, asi que filtramos por user_id IN (SELECT ...)
	type tableCol struct {
		table, col string
	}
	userDepTables := []tableCol{
		{"notification_preferences", "user_id"},
		{"user_documents", "user_id"},
		{"user_permissions", "user_id"},
		{"user_passkeys", "user_id"},
		{"membership_history", "user_id"},
		{"device_registrations", "user_id"},
		{"nfc_cards", "user_id"},
		{"nfc_transactions", "user_id"},
		{"nfc_transactions", "seller_user_id"},
		{"nfc_transactions", "buyer_user_id"},
		{"nfc_terminal_sessions", "merchant_user_id"},
		{"multi_sig_approvals", "from_account"},
		{"multi_sig_approvals", "to_account"},
		{"approval_signatures", "signer_id"},
		{"recovery_approvals", "approver_id"},
		{"recovery_requests", "target_user_id"},
		{"recovery_requests", "requester_id"},
		{"invitation_codes", "created_by"},
		{"invitation_codes", "used_by"},
		{"organization_board_members", "user_id"},
		{"organization_board_members", "appointed_by"},
		{"member_group_members", "user_id"},
		{"member_groups", "institution_id"},
		{"node_merge_conflicts", "user_a_id"},
		{"node_merge_conflicts", "user_b_id"},
		{"uploaded_images", "uploaded_by"},
	}
	for _, tc := range userDepTables {
		_, err := d.Pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE %s IN (SELECT id FROM users WHERE node_domain = $1)", tc.table, tc.col), nodeDomain)
		if err != nil {
			// Ignorar errores (tabla o columna puede no existir en esta version)
			log.Printf("DemoReset: warning borrando %s.%s: %v", tc.table, tc.col, err)
		}
	}

	// 2. Borrar node_federation_keys (referencia users via added_by)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM node_federation_keys WHERE added_by IN (SELECT id FROM users WHERE node_domain = $1)", nodeDomain)

	// 3. Borrar assembly_votes y assembly_attendance (referencian assembly_sessions/decisions)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM assembly_votes WHERE decision_id IN (SELECT id FROM assembly_decisions WHERE assembly_id IN (SELECT id FROM assembly_sessions WHERE node_domain = $1))", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM assembly_attendance WHERE session_id IN (SELECT id FROM assembly_sessions WHERE node_domain = $1)", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM assembly_votes_scoped WHERE decision_id IN (SELECT id FROM assembly_decisions_scoped WHERE session_id IN (SELECT id FROM assembly_sessions_scoped WHERE node_domain = $1))", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM assembly_attendance_scoped WHERE session_id IN (SELECT id FROM assembly_sessions_scoped WHERE node_domain = $1)", nodeDomain)

	// 4. Borrar tablas con node_domain (orden por FK)
	ndTables := []string{
		"assembly_decisions",
		"assembly_decisions_scoped",
		"assembly_sessions",
		"assembly_sessions_scoped",
		"assembly_quorum_config",
		"assembly_quorum_config_scoped",
		"assembly_frequency_config",
		"assembly_config",
		"assembly_notifications",
		"board_members",
		"tax_config",
		"tax_distributions",
		"external_bridge_operations",
		"admission_requests",
		"store_items",
		"governance_rules",
		"department_members",
		"department_roles",
		"departments",
		"organization_levels",
		"member_levels",
		"product_compositions",
		"products",
		"notifications",
		"user_credentials",
		"public_pages",
		"public_settings",
		"node_config",
		"subscription_charge_failures",
		"organization_subscriptions",
		"organization_services",
		"conversion_factor",
	}
	for _, t := range ndTables {
		_, err := d.Pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE node_domain = $1", t), nodeDomain)
		if err != nil {
			log.Printf("DemoReset: warning borrando %s: %v", t, err)
		}
	}

	// 5. Borrar tablas sin node_domain que dependen de users
	_, _ = d.Pool.Exec(ctx, "DELETE FROM ledger_entries WHERE account_id IN (SELECT id FROM users WHERE node_domain = $1)", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM transactions WHERE sender_node = $1 OR receiver_node = $1", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM audit_log WHERE actor_id IN (SELECT id FROM users WHERE node_domain = $1)", nodeDomain)

	// 6. Borrar users (ahora si, sin FKs que lo bloqueen)
	_, err := d.Pool.Exec(ctx, "DELETE FROM users WHERE node_domain = $1", nodeDomain)
	if err != nil {
		log.Printf("DemoReset: warning borrando users: %v", err)
	}

	// 7. Borrar tablas globales de federacion
	_, _ = d.Pool.Exec(ctx, "DELETE FROM node_balance WHERE remote_node IN ('aldea-semilla-viva', 'comunidad-rio-claro', 'ecoaldea-cerro-verde', 'cooperativa-pueblo-nuevo')")
	_, _ = d.Pool.Exec(ctx, "DELETE FROM bilateral_limits WHERE local_node = $1", nodeDomain)
	_, _ = d.Pool.Exec(ctx, "DELETE FROM role_permissions")

	// Re-seedear
	log.Println("DemoReset: datos borrados, listo para re-seedear")
	return nil
}

func demoSeedStoreItems(ctx context.Context, d *DB, nodeDomain string) error {
	// Obtener IDs de usuarios individuales y organizaciones
	type userRef struct {
		username string
		id       uuid.UUID
	}
	rows, err := d.Pool.Query(ctx, `SELECT username, id FROM users WHERE node_domain = $1 AND account_type IN ('individual', 'organization') AND membership_status = 'active'`, nodeDomain)
	if err != nil {
		return err
	}
	defer rows.Close()
	userMap := map[string]uuid.UUID{}
	for rows.Next() {
		var u userRef
		rows.Scan(&u.username, &u.id)
		userMap[u.username] = u.id
	}

	// Obtener productos aprobados del dominio
	type prodRef struct {
		name string
		id   uuid.UUID
	}
	prodRows, err := d.Pool.Query(ctx, `SELECT name, id FROM products WHERE node_domain = $1 AND is_approved = true ORDER BY name`, nodeDomain)
	if err != nil {
		return err
	}
	defer prodRows.Close()
	prodMap := map[string]uuid.UUID{}
	for prodRows.Next() {
		var p prodRef
		prodRows.Scan(&p.name, &p.id)
		prodMap[p.name] = p.id
	}

	// Asignar productos a tiendas de usuarios
	storeItems := []struct {
		ownerUsername, productName string
		stock                      int
	}{
		// Tienda comunitaria
		{"tienda_comunitaria", "Frijol negro de altura (1kg)", 50},
		{"tienda_comunitaria", "Quinua andina (1kg)", 30},
		{"tienda_comunitaria", "Tomate de huerto (1kg)", 40},
		{"tienda_comunitaria", "Miel de montana (250ml)", 20},
		{"tienda_comunitaria", "Mermelada de mora", 15},
		// Panaderia
		{"panaderia_monte", "Pan de quinua (1kg)", 25},
		// Cooperativa agricola
		{"coop_agricola", "Lechuga de bancale", 30},
		{"coop_agricola", "Ocumo de montana (1kg)", 35},
		{"coop_agricola", "Guayaba de rio (1kg)", 20},
		{"coop_agricola", "Mora de monte (500g)", 15},
		// Taller textil
		{"taller_textil", "Ruana de lana (unidad)", 5},
		// Herreria
		{"herreria", "Azadon de montana", 8},
		{"herreria", "Tijeras de podar", 12},
		// Elena (permacultora)
		{"elena", "Queso de cabra (500g)", 10},
		{"elena", "Te de hierbas del monte (100g)", 20},
		{"elena", "Aceite de romero (100ml)", 8},
		// Carmen (panadera)
		{"carmen", "Pan de quinua (1kg)", 15},
		// Raul (artesano)
		{"raul", "Set 4 cuencos de barro", 6},
		{"raul", "Cesta de bambu (mediana)", 10},
		// Isabel (herbalista)
		{"isabel", "Te de hierbas del monte (100g)", 25},
		// Marcos (herrero)
		{"marcos", "Banco de madera de cedro", 3},
		// Demo (admin) - tienda personal
		{"demo", "Frijol negro de altura (1kg)", 10},
		{"demo", "Miel de montana (250ml)", 5},
		{"demo", "Pan de quinua (1kg)", 8},
	}

	for _, si := range storeItems {
		ownerID, ok1 := userMap[si.ownerUsername]
		prodID, ok2 := prodMap[si.productName]
		if !ok1 || !ok2 {
			continue
		}
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM store_items WHERE owner_id = $1 AND product_id = $2`, ownerID, prodID).Scan(&existing)
		if existing > 0 {
			continue
		}
		// Obtener precio, unidad y categoria del producto
		var price float64
		var unit, category, parentCat string
		d.Pool.QueryRow(ctx, `SELECT price_per_unit, unit, category, parent_category FROM products WHERE id = $1`, prodID).Scan(&price, &unit, &category, &parentCat)
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO store_items (node_domain, owner_id, product_id, product_name, stock, is_active, price_trueque, unit, category, parent_category)
			VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
			ON CONFLICT DO NOTHING`,
			nodeDomain, ownerID, prodID, si.productName, si.stock, price, unit, category, parentCat)
		if err != nil {
			log.Printf("Demo: error seeding store item %s for %s: %v", si.productName, si.ownerUsername, err)
		}
	}
	log.Println("Demo: store items seeded")
	return nil
}

func demoSeedAssemblyProposals(ctx context.Context, d *DB, nodeDomain string) error {
	// Obtener el admin user
	var adminID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'demo' LIMIT 1`, nodeDomain).Scan(&adminID)
	if adminID == uuid.Nil {
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND account_type = 'individual' AND membership_status = 'active' LIMIT 1`, nodeDomain).Scan(&adminID)
	}

	// Primero crear sesiones
	demoSeedAssemblySessions(ctx, d, nodeDomain)

	// Obtener IDs de sesiones pasadas para asociar decisiones
	sessionRows, err := d.Pool.Query(ctx, `SELECT id, title FROM assembly_sessions WHERE node_domain = $1 AND status = 'completed' ORDER BY start_time`, nodeDomain)
	if err != nil {
		log.Printf("Demo: error getting sessions: %v", err)
		return nil
	}
	defer sessionRows.Close()
	sessions := []struct {
		id    uuid.UUID
		title string
	}{}
	for sessionRows.Next() {
		var s struct {
			id    uuid.UUID
			title string
		}
		sessionRows.Scan(&s.id, &s.title)
		sessions = append(sessions, s)
	}

	// Verificar si ya existen decisiones
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM assembly_decisions`).Scan(&count)
	if count > 0 {
		return nil
	}

	// Propuestas asociadas a sesiones pasadas
	type proposal struct {
		title, description, decisionType, status string
		sessionIdx                               int // -1 = sin sesión (pendiente/voting)
	}
	proposals := []proposal{
		{"Aprobar nuevo miembro: Tomas Gil", "Tomas ha completado su periodo de prueba de 3 meses. Participa en cayapas, asiste a asambleas. Propuesta: aceptar como miembro Brote.", "admission", "approved", 0},
		{"Comprar molino de maiz comunitario", "El molino actual esta dañado. Propuesta: usar 500 TQ del Fondo Comunitario para comprar un molino manual de hierro. Beneficio: 40 familias.", "budget", "approved", 0},
		{"Construir secador solar", "Propuesta: construir un secador solar comunitario para secar granos y frutas. Costo: 200 TQ en materiales + 3 jornadas de trabajo.", "budget", "approved", 1},
		{"Cambiar tasa de impuesto organizacion", "Propuesta: reducir impuesto de org_produccion de 2% a 1.5% para estimular produccion local.", "policy", "approved", 1},
		{"Aprobar producto compuesto: Kit de Huerto Familiar", "Propuesta: aprobar el Kit de Huerto Familiar como producto compuesto del catalogo. Incluye azadon, tijeras, semillas, abono y manual.", "product_approval", "approved", 2},
		{"Construir letrina seca comunitaria", "Propuesta: construir letrina seca abonera comunitaria. Costo: 150 TQ. Beneficio: saneamiento + compost para huertos.", "budget", "approved", 2},
		{"Renovar Consejo de Vision", "El Consejo de Vision actual cumple 2 años. Propuesta: elegir nuevos 3 miembros Raiz para el Consejo.", "election", "approved", 3},
		{"Fondo de emergencia por tormenta", "Aprobacion de 300 TQ del fondo comunitario para reparaciones post-tormenta. 12 familias afectadas.", "budget", "approved", 3},
		// Pendientes/voting sin sesión
		{"Admitir Cooperativa de Cafe del Valle", "Solicitud de federacion de la Cooperativa de Cafe del Valle. Tienen 15 miembros, 200 hectareas. Propuesta: aceptar como nodo federado.", "federation", "pending", -1},
		{"Distribuir fondo comunitario: materiales para escuela", "Propuesta: transferir 200 TQ del fondo a la Escuela Primaria Raices para comprar materiales educativos.", "fund_distribution", "voting", -1},
		{"Cambiar horario de asamblea", "Propuesta: cambiar horario de asambleas de 15:00 a 10:00 para mejor asistencia.", "policy", "voting", -1},
	}

	for _, p := range proposals {
		var assemblyID interface{}
		if p.sessionIdx >= 0 && p.sessionIdx < len(sessions) {
			assemblyID = sessions[p.sessionIdx].id
		} else {
			// Para propuestas pendientes, usar la última sesión (futura)
			// o crear una sesión virtual
			if len(sessions) > 0 {
				assemblyID = sessions[0].id
			} else {
				continue
			}
		}

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO assembly_decisions (id, assembly_id, decision_type, description, required_signatures, status, created_at, voting_deadline, voting_duration_minutes, approved_for_voting_by, approved_for_voting_at)
			VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, NOW() - interval '30 days', NOW() + interval '7 days', 10080, $5, NOW() - interval '30 days')
			ON CONFLICT DO NOTHING`,
			assemblyID, p.decisionType, p.title+": "+p.description, p.status, adminID)
		if err != nil {
			log.Printf("Demo: error seeding proposal %s: %v", p.title, err)
		}
	}

	// Crear votos para las propuestas aprobadas
	demoSeedAssemblyVotes(ctx, d, nodeDomain, adminID)

	log.Println("Demo: assembly proposals seeded")
	return nil
}

func demoSeedAssemblySessions(ctx context.Context, d *DB, nodeDomain string) {
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM assembly_sessions WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return
	}

	sessions := []struct {
		sessionType, title, description, status, minutes string
		startOffset                                      int // horas desde ahora (negativo = pasado)
		duration                                         int // horas
	}{
		{"ordinary", "Asamblea Ordinaria Ene 2026", "Primera asamblea del año. Aprobacion de presupuesto, plan anual, admision de nuevos miembros.", "completed", "ACTA DE ASAMBLEA ORDINARIA - ENERO 2026\n\nFecha: 15 de enero de 2026\nLugar: Casa Comunal de la Ecoaldea\nHora: 15:00 - 18:00\nAsistentes: 28 miembros (quorum cumplido: 70%)\n\n1. APROBACION DE NUEVO MIEMBRO\n   - Propuesta: Admitir a Tomas Gil como miembro Brote\n   - Votacion: 25 a favor, 2 en contra, 1 abstencion\n   - Resultado: APROBADO\n   - Tomas Gil admitido como miembro Brote con periodo de prueba de 6 meses\n\n2. COMPRA DE MOLINO DE MAIZ\n   - Propuesta: Usar 500 TQ del Fondo Comunitario para molino manual\n   - Votacion: 27 a favor, 1 en contra, 0 abstenciones\n   - Resultado: APROBADO\n   - Se autoriza compra del molino, beneficiara a 40 familias\n\n3. PLAN ANUAL 2026\n   - Se presento el plan anual de actividades\n   - Prioridades: infraestructura, educacion, soberania alimentaria\n   - Aprobado por unanimidad\n\n4. PRESUPUESTO\n   - Ingresos estimados: 3000 TQ (intercambios + impuestos)\n   - Egresos: 2500 TQ (proyectos + fondo operativo)\n   - Superavit: 500 TQ para fondo comunitario\n\nLa asamblea concluye a las 18:00. Proxima asamblea: 15 de abril de 2026.", -24 * 30 * 7, 3},
		{"ordinary", "Asamblea Ordinaria Abr 2026", "Asamblea trimestral. Revision de balances, aprobacion de proyectos de infraestructura.", "completed", "ACTA DE ASAMBLEA ORDINARIA - ABRIL 2026\n\nFecha: 15 de abril de 2026\nLugar: Casa Comunal de la Ecoaldea\nHora: 15:00 - 18:30\nAsistentes: 25 miembros (quorum cumplido: 62%)\n\n1. CONSTRUCCION DE SECADOR SOLAR\n   - Propuesta: Construir secador solar comunitario\n   - Costo: 200 TQ en materiales + 3 jornadas de trabajo\n   - Votacion: 23 a favor, 1 en contra, 1 abstencion\n   - Resultado: APROBADO\n   - Beneficio: secar granos y frutas para conservacion\n\n2. REDUCCION DE IMPUESTO A ORGANIZACIONES\n   - Propuesta: Reducir impuesto de org_produccion de 2% a 1.5%\n   - Votacion: 20 a favor, 4 en contra, 1 abstencion\n   - Resultado: APROBADO\n   - Objetivo: estimular produccion local\n\n3. REPORTE DE BALANCES Q1\n   - Intercambios: 1850 TQ\n   - Impuestos recaudados: 28 TQ\n   - Fondo comunitario: 528 TQ\n   - Balance general: positivo\n\nLa asamblea concluye a las 18:30. Proxima asamblea: 15 de julio de 2026.", -24 * 30 * 4, 3},
		{"ordinary", "Asamblea Ordinaria Jul 2026", "Asamblea trimestral. Eleccion de junta directiva, revision de comisiones.", "completed", "ACTA DE ASAMBLEA ORDINARIA - JULIO 2026\n\nFecha: 15 de julio de 2026\nLugar: Casa Comunal de la Ecoaldea\nHora: 15:00 - 19:00\nAsistentes: 30 miembros (quorum cumplido: 75%)\n\n1. APROBACION DE PRODUCTO COMPUESTO\n   - Propuesta: Aprobar Kit de Huerto Familiar como producto compuesto\n   - Incluye: azadon, tijeras, semillas, abono y manual\n   - Votacion: 28 a favor, 1 en contra, 1 abstencion\n   - Resultado: APROBADO\n\n2. CONSTRUCCION DE LETRINA SECA\n   - Propuesta: Construir letrina seca abonera comunitaria\n   - Costo: 150 TQ\n   - Votacion: 29 a favor, 1 en contra, 0 abstenciones\n   - Resultado: APROBADO\n   - Beneficio: saneamiento + compost para huertos\n\n3. RENOVACION DEL CONSEJO DE VISION\n   - Consejo actual cumple 2 años\n   - Propuesta: Elegir 3 nuevos miembros Raiz\n   - Votacion: 30 a favor, 0 en contra, 0 abstenciones\n   - Resultado: APROBADO\n   - Nuevos miembros: Elena Vega, Marcos Diaz, Lucia Soto\n\n4. REPORTE DE COMISIONES\n   - Comision de Tierra: 3 huertos nuevos\n   - Comision de Educacion: 2 talleres realizados\n   - Comision de Salud: botiquin comunitario abastecido\n\nLa asamblea concluye a las 19:00. Proxima asamblea: 15 de octubre de 2026.", -24 * 30 * 1, 3},
		{"extraordinary", "Asamblea Extraordinaria - Emergencia Climatica", "Asamblea urgente por tormenta. Aprobacion de fondos de emergencia para reparaciones.", "completed", "ACTA DE ASAMBLEA EXTRAORDINARIA - EMERGENCIA CLIMATICA\n\nFecha: 7 de agosto de 2026\nLugar: Casa Comunal de la Ecoaldea\nHora: 10:00 - 12:00\nAsistentes: 22 miembros (quorum cumplido: 55%)\n\n1. FONDO DE EMERGENCIA POR TORMENTA\n   - 12 familias afectadas por tormenta\n   - Propuesta: Aprobar 300 TQ del fondo comunitario para reparaciones\n   - Votacion: 22 a favor, 0 en contra, 0 abstenciones\n   - Resultado: APROBADO POR UNANIMIDAD\n   - Distribucion: 25 TQ por familia para materiales de reparacion\n\n2. EVALUACION DE DAÑOS\n   - 3 viviendas con daños en techo\n   - 1 deposito de granos afectado\n   - Huertos comunitarios: perdidas parciales\n\n3. PLAN DE RESPUESTA\n   - Cayapa comunitaria: fin de semana\n   - Solicitud de apoyo a nodos federados\n   - Reactivacion de huertos en 2 semanas\n\nLa asamblea concluye a las 12:00. Se convoca asamblea ordinaria para octubre.", -24 * 14, 2},
		{"ordinary", "Asamblea Ordinaria Oct 2026", "Asamblea trimestral. Planificacion de cosecha, presupuesto de invierno.", "scheduled", "", 24 * 30, 3},
	}

	for _, s := range sessions {
		startTime := time.Now().Add(time.Duration(s.startOffset) * time.Hour)
		endTime := startTime.Add(time.Duration(s.duration) * time.Hour)
		var minutesVal interface{}
		if s.minutes != "" {
			minutesVal = s.minutes
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO assembly_sessions (id, node_domain, session_type, title, description, start_time, end_time, status, is_presential, created_at, minutes)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), $8)
			ON CONFLICT DO NOTHING`,
			nodeDomain, s.sessionType, s.title, s.description, startTime, endTime, s.status, minutesVal)
		if err != nil {
			log.Printf("Demo: error seeding session %s: %v", s.title, err)
		}
	}

	// Crear junta directiva
	demoSeedBoardMembers(ctx, d, nodeDomain)
}

func demoSeedBoardMembers(ctx context.Context, d *DB, nodeDomain string) {
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM board_members WHERE node_domain = $1`, nodeDomain).Scan(&count)
	if count > 0 {
		return
	}

	// Obtener IDs de usuarios
	type userRef struct {
		username string
		id       uuid.UUID
	}
	userMap := map[string]uuid.UUID{}
	rows, err := d.Pool.Query(ctx, `SELECT username, id FROM users WHERE node_domain = $1 AND account_type = 'individual' AND membership_status = 'active'`, nodeDomain)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var u userRef
		rows.Scan(&u.username, &u.id)
		userMap[u.username] = u.id
	}

	board := []struct {
		username, position string
	}{
		{"elena", "presidente"},
		{"marcos", "vicepresidente"},
		{"andrea", "tesorero"},
		{"lucia", "secretario"},
		{"sofia", "vocal1"},
		{"diego", "vocal2"},
		{"pablo", "vocal3"},
	}

	for _, b := range board {
		uid, ok := userMap[b.username]
		if !ok {
			continue
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO board_members (id, node_domain, user_id, position, term_start, term_end, is_active, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, NOW() - interval '6 months', NOW() + interval '18 months', true, NOW())
			ON CONFLICT DO NOTHING`,
			nodeDomain, uid, b.position)
		if err != nil {
			log.Printf("Demo: error seeding board member %s: %v", b.username, err)
		}
	}

	// Configurar quorum
	d.Pool.Exec(ctx, `
		INSERT INTO assembly_quorum_config (id, node_domain, session_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, 'ordinary', 50.0, 30.0, 2, true, 2, true, NOW(), NOW())
		ON CONFLICT DO NOTHING`,
		nodeDomain)
	d.Pool.Exec(ctx, `
		INSERT INTO assembly_quorum_config (id, node_domain, session_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, 'extraordinary', 66.67, 50.0, 1, true, 1, true, NOW(), NOW())
		ON CONFLICT DO NOTHING`,
		nodeDomain)

	// Configurar assembly_config (metodo de aprobacion por tipo de propuesta)
	assemblyConfigs := []struct {
		proposalType       string
		approvalMethod     string
		requiredPercentage float64
		requiredQuorum     int
		requiredSignatures int
		description        string
	}{
		{"limit_change", "assembly", 50.0, 10, 0, "Cambios de limites de credito/debito - mayoria simple"},
		{"admission", "assembly", 66.67, 15, 0, "Admision de nuevos miembros - 2/3 de la asamblea"},
		{"expulsion", "assembly", 80.0, 20, 0, "Expulsion de miembro - supermayoria 80%"},
		{"budget_increase", "assembly", 66.67, 15, 0, "Aumento de presupuesto - 2/3 de la asamblea"},
		{"federation_config", "board", 50.0, 0, 3, "Configuracion de federacion - junta directiva (3 firmas)"},
		{"recovery_config", "assembly", 66.67, 15, 0, "Configuracion de recuperacion - 2/3 de la asamblea"},
		{"tax_change", "assembly", 66.67, 20, 0, "Cambios de impuestos - 2/3 con quorum alto"},
		{"member_level", "assembly", 50.0, 10, 0, "Cambios de nivel de miembro - mayoria simple"},
		{"policy", "assembly", 50.0, 10, 0, "Politicas generales - mayoria simple"},
		{"create_account", "board", 50.0, 0, 2, "Creacion de cuentas - junta directiva (2 firmas)"},
		{"fund_distribution", "assembly", 66.67, 15, 0, "Distribucion del fondo comunitario - 2/3 de la asamblea"},
		{"energy_rate_change", "assembly", 66.67, 15, 0, "Cambio de tarifa energetica - 2/3 de la asamblea"},
		{"product_modification", "assembly", 50.0, 10, 0, "Modificacion de productos del catalogo - mayoria simple"},
		{"free_proposal", "assembly", 50.0, 10, 0, "Propuesta libre - mayoria simple"},
	}
	for _, ac := range assemblyConfigs {
		d.Pool.Exec(ctx, `
			INSERT INTO assembly_config (id, node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
			ON CONFLICT DO NOTHING`,
			nodeDomain, ac.proposalType, ac.approvalMethod, ac.requiredPercentage,
			ac.requiredQuorum, ac.requiredSignatures, ac.description)
	}

	// Configurar tax_config con tasas de impuesto por tipo de cuenta
	var taxAccountID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'impuestos' LIMIT 1`, nodeDomain).Scan(&taxAccountID)
	if taxAccountID != uuid.Nil {
		// Tasas diferentes por tipo de cuenta
		taxConfigs := []struct {
			rate      float64
			appliesTo string
			minAmount int64
		}{
			{0.005, "individual", 0},     // 0.5% para personas
			{0.01, "organization", 0},    // 1% para organizaciones comerciales
			{0.005, "department", 0},     // 0.5% para departamentos
			{0.0, "fund", 0},             // 0% para cuentas del fondo (exentas)
			{0.015, "commerce", 0},       // 1.5% para tiendas comerciales
			{0.008, "public_service", 0}, // 0.8% para servicios publicos
			{0.012, "cooperative", 0},    // 1.2% para cooperativas
			{0.0, "all", 0},              // 0% general (no se usa, las especificas prevalecen)
		}
		for _, tc := range taxConfigs {
			d.Pool.Exec(ctx, `
				INSERT INTO tax_config (id, node_domain, tax_rate, tax_account_id, applies_to, min_amount, is_active, created_at, updated_at)
				VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
				ON CONFLICT DO NOTHING`,
				nodeDomain, tc.rate, taxAccountID, tc.appliesTo, tc.minAmount)
		}
	}
}

func demoSeedFederationPeers(ctx context.Context, d *DB, nodeDomain string) error {
	// node_federation_keys no tiene node_domain, usamos added_by para marcar
	// Verificar si ya existen peers
	var count int
	d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM node_federation_keys WHERE peer_domain LIKE '%demo%' OR peer_domain LIKE '%ecoaldea%' OR peer_domain LIKE '%aldea%'`).Scan(&count)
	if count > 0 {
		return nil
	}

	// Obtener el admin user para added_by
	var adminID uuid.UUID
	d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = 'demo' LIMIT 1`, nodeDomain).Scan(&adminID)
	if adminID == uuid.Nil {
		d.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 LIMIT 1`, nodeDomain).Scan(&adminID)
	}

	// Generar claves públicas ficticias para los peers
	peers := []struct {
		domain, name, status string
	}{
		{"ecoaldea-cerro-verde", "Ecoaldea Cerro Verde", "active"},
		{"comunidad-rio-claro", "Comunidad Rio Claro", "active"},
		{"aldea-semilla-viva", "Aldea Semilla Viva", "active"},
		{"cooperativa-pueblo-nuevo", "Cooperativa Pueblo Nuevo", "pending"},
	}

	for _, p := range peers {
		// Generar clave pública ficticia
		pubKey, _, _ := ed25519.GenerateKey(rand.Reader)
		pubKeyHex := hex.EncodeToString(pubKey)

		_, err := d.Pool.Exec(ctx, `
			INSERT INTO node_federation_keys (peer_domain, peer_name, peer_public_key, peer_endpoint, status, mutual_verified, added_by, created_at, updated_at)
			VALUES ($1, $2, $3, '', $4, $5, $6, NOW(), NOW())
			ON CONFLICT DO NOTHING`,
			p.domain, p.name, pubKeyHex, p.status, p.status == "active", adminID)
		if err != nil {
			log.Printf("Demo: error seeding peer %s: %v", p.domain, err)
		}
	}

	// Crear límites bilaterales para los peers activos
	activePeers := []struct {
		remoteNode  string
		creditLimit int64
		debitLimit  int64
	}{
		{"ecoaldea-cerro-verde", 50000, 50000},
		{"comunidad-rio-claro", 30000, 30000},
		{"aldea-semilla-viva", 20000, 20000},
	}

	for _, bl := range activePeers {
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO bilateral_limits (local_node, remote_node, credit_limit, debit_limit, is_customized, local_approved, remote_confirmed, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, true, true, true, true, NOW(), NOW())
			ON CONFLICT DO NOTHING`,
			nodeDomain, bl.remoteNode, bl.creditLimit, bl.debitLimit)
		if err != nil {
			log.Printf("Demo: error seeding bilateral limit %s: %v", bl.remoteNode, err)
		}
	}

	log.Println("Demo: federation peers seeded")
	return nil
}
