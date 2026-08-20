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

	// 4. Productos de la ecoaldea
	if err := demoSeedProducts(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding products: %v", err)
	}

	// 5. Usuarios y organizaciones
	if err := demoSeedUsers(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding users: %v", err)
	}

	// 6. Departamentos y comisiones
	demoSeedDepartments(ctx, d, nodeDomain)

	// 7. Reglas de gobernanza
	demoSeedGovernance(ctx, d, nodeDomain)

	// 8. Transacciones simuladas
	if err := demoSeedTransactions(ctx, d, nodeDomain); err != nil {
		log.Printf("Demo: warning seeding transactions: %v", err)
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
	}{
		{"raiz", "Miembro Raiz - fundador/a de la ecoaldea, voz y voto en todas las decisiones", 100, true, true, true, 5000, 5000},
		{"tronco", "Miembro Tronco - con mas de 2 anios, voz y voto en asamblea", 50, true, true, true, 3000, 3000},
		{"rama", "Miembro Rama - con mas de 6 meses, voz en asamblea, voto en comisiones", 20, true, true, false, 1500, 1500},
		{"brote", "Miembro Brote - recien ingresado/a, voz en asamblea, sin voto", 10, true, false, false, 500, 500},
	}

	for _, l := range levels {
		var existing int
		d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM member_levels WHERE node_domain = $1 AND name = $2`, nodeDomain, l.name).Scan(&existing)
		if existing > 0 {
			continue
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO member_levels (id, node_domain, name, description, level, has_voice, has_vote, counts_in_quorum, is_active, credit_limit, debit_limit)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)`,
			uuid.New(), nodeDomain, l.name, l.desc, l.level, l.hasVoice, l.hasVote, l.quorum, l.credit, l.debit)
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
    "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
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
        "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80",
        "title": "Bosque Regenerado",
        "caption": "15 anos de reforestacion con especies nativas han devuelto el agua a los manantiales.",
        "tag": "Regeneracion"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1464226184884-fa280b87c3be?auto=format&fit=crop&w=1000&q=80",
        "title": "Huertos en Bancales",
        "caption": "Permacultura en bancales elevados siguiendo curvas de nivel para conservar suelo y agua.",
        "tag": "Permacultura"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80",
        "title": "Pan de Quinua",
        "caption": "Panaderia comunitaria con granos andinos cultivados en altura.",
        "tag": "Soberania"
      },
      {
        "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1000&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "Como vivimos",
    "title": "Bioconstruccion y espacios comunes",
    "subtitle": "Viviendas de adobe, bahareque y madera local",
    "content": "Las viviendas son de bioconstruccion: adobe, bahareque, paja y madera local. Cada familia tiene su casa y un huerto. Tenemos espacios comunes: el comedor comunitario donde almorzamos juntos tres veces por semana, la escuela primaria donde estudian los ninos de la comunidad, el centro de salud natural, la herreria, el taller textil y la panaderia. El 60% del territorio es bosque protegido donde solo se extrae madera muerta. El 30% son cultivos en bancales, agroforesteria y huertos. El 10% es vivienda e infraestructura.",
    "image_url": "https://images.unsplash.com/photo-1464226184884-fa280b87c3be?auto=format&fit=crop&w=900&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80",
    "style": "split"
  },
  {
    "type": "split_story",
    "badge": "Estructura y Organizacion",
    "title": "Vida Organizativa Mas Alla del Huerto",
    "subtitle": "Asambleas mensuales, comisiones y trabajo colectivo",
    "content": "Raices del Monte no es solo un conjunto de viviendas. Contamos con una estructura organizativa solida y horizontal:\n\nAsambleas Mensuales: Cada primer domingo de mes, todos los miembros plenos se reunen en asamblea formal para evaluar el funcionamiento, admitir nuevos miembros y debatir politicas colectivas.\nComisiones de Trabajo: Se conforman comisiones para economia, educacion, salud, ambiente, admision, construccion y consejo de vision. Cada comision es autonoma en su area.\nCayapas Comunitarias: Organizamos jornadas de trabajo voluntario para mantenimiento de senderos, reforestacion, construccion y limpieza de acequias.",
    "image_url": "https://images.unsplash.com/photo-1592417817098-8f3d69102a5e?auto=format&fit=crop&w=900&q=80",
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
    "type": "timeline_history",
    "badge": "Hitos",
    "title": "Nuestra Linea de Tiempo",
    "subtitle": "15 anos de regeneracion, comunidad y soberania.",
    "items": [
      { "year": "2010", "title": "Fundacion de la Ecoaldea", "description": "Cinco familias adquieren una finca ganadera degradada y comienzan la regeneracion.", "badge": "Fundacion" },
      { "year": "2012", "title": "Primeros Huertos", "description": "Bancales elevados, agroforesteria y conservacion de semillas criollas.", "badge": "Permacultura" },
      { "year": "2015", "title": "Sistema TQ", "description": "Implementacion del Trueque Comunitario basado en energia incorporada.", "badge": "Economia" },
      { "year": "2018", "title": "Autonomia Energetica", "description": "Paneles solares y cocinas solares. 100% energia renovable.", "badge": "Energia" },
      { "year": "2021", "title": "Federacion", "description": "Nos federamos con otras ecoaldeas usando el mismo sistema.", "badge": "Federacion" },
      { "year": "2025", "title": "15 Anos", "description": "Bosque duplicado, manantiales recuperados, 28 familias en comunidad.", "badge": "Presente" }
    ]
  },
  {
    "type": "testimonials",
    "title": "Familias Fundadoras",
    "subtitle": "Algunas de las experiencias que hacen vida activa en la ecoaldea.",
    "items": [
      {
        "name": "Familia Rojas",
        "role": "Fundadores - Nivel Raiz",
        "project": "Huerto de altura y panaderia de quinua",
        "quote": "Llegamos en 2010 con ganas de cambiar nuestra vida. Hoy producimos el 90% de lo que comemos y hemos visto volver los manantiales secos.",
        "location": "Zona alta de la ecoaldea"
      },
      {
        "name": "Familia Mendez",
        "role": "Miembros Tronco - 10 anos",
        "project": "Apicultura y miel de montana",
        "quote": "La ecoaldea nos enseno que la abundancia viene de la diversidad. Donde antes habia pasto, ahora hay bosque, abejas y agua.",
        "location": "Zona del bosque"
      }
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
    "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1746474072546-9fbda10daffe?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
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
    "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
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
		{"Agricultura", "Cultivos", "Granos", "Frijol negro de altura (1kg)", "kg", "Frijol negro cultivado a 1200m, secado al sol", "organico", "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400", 35},
		{"Agricultura", "Cultivos", "Granos", "Quinua andina (1kg)", "kg", "Quinua cultivada en bancales de montana", "nativo", "https://images.unsplash.com/photo-1564093497595-593b0d4be6a0?w=400", 45},
		{"Agricultura", "Cultivos", "Hortalizas", "Tomate de huerto (1kg)", "kg", "Tomate perita de cultivo agroecologico", "fresco", "https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=400", 25},
		{"Agricultura", "Cultivos", "Hortalizas", "Lechuga de bancale", "unidad", "Lechuga batavia de bancal elevado", "fresco", "https://images.unsplash.com/photo-1622205313162-4c6d8a7d8a7d?w=400", 15},
		{"Agricultura", "Cultivos", "Raices", "Ocumo de montana (1kg)", "kg", "Ocumo nativo de sombra", "nativo", "https://images.unsplash.com/photo-1607305387299-a3d96ab82b4b?w=400", 20},
		{"Agricultura", "Cultivos", "Frutas", "Guayaba de rio (1kg)", "kg", "Guayaba de arboles a orillas del arroyo", "temporal", "https://images.unsplash.com/photo-1553279768-465771b8d3db?w=400", 22},
		{"Agricultura", "Cultivos", "Frutas", "Mora de monte (500g)", "paquete", "Mora silvestre recolectada en el bosque", "silvestre", "https://images.unsplash.com/photo-1543528176-61b239494933?w=400", 30},

		// Derivados artesanales
		{"Alimentacion", "Derivados", "Lacteos", "Queso de cabra (500g)", "unidad", "Queso fresco de cabras lecheras", "artesanal", "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400", 60},
		{"Alimentacion", "Derivados", "Panaderia", "Pan de quinua (1kg)", "kg", "Pan integral hecho con harina de quinua del huerto", "artesanal", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", 50},
		{"Alimentacion", "Derivados", "Conservas", "Mermelada de mora", "frasco", "Mermelada artesanal de mora de monte", "artesanal", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1a0?w=400", 40},
		{"Alimentacion", "Derivados", "Miel", "Miel de montana (250ml)", "frasco", "Miel pura de abejas nativas sin agroticos", "natural", "https://images.unsplash.com/photo-1587062259928-8f3d8c5c7f3a?w=400", 70},

		// Artesania local
		{"Artesania", "Textiles", "Tejidos", "Ruana de lana (unidad)", "unidad", "Ruana tejida a mano con lana de ovejas de la comunidad", "artesanal", "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400", 250},
		{"Artesania", "Ceramica", "Vajilla", "Set 4 cuencos de barro", "set", "Cuencos de barro cocido hechos con arcilla local", "artesanal", "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400", 150},
		{"Artesania", "Madera", "Muebles", "Banco de madera de cedro", "unidad", "Banco rustico de cedro del bosque comunitario", "artesanal", "https://images.unsplash.com/photo-1503602642458-232111445657?w=400", 300},
		{"Artesania", "Cesteria", "Cestas", "Cesta de bambu (mediana)", "unidad", "Cesta tejida con bambu del bosque", "artesanal", "https://images.unsplash.com/photo-1595777226618-2e0a8c4c4c4c?w=400", 80},

		// Herramientas
		{"Herramientas", "Agricolas", "Manuales", "Azadon de montana", "unidad", "Azadon forjado en la herreria comunitaria", "util", "", 100},
		{"Herramientas", "Agricolas", "Manuales", "Tijeras de podar", "unidad", "Tijeras de podar afiladas en taller", "util", "", 60},

		// Salud natural
		{"Salud y Medicina", "Natural", "Hierbas", "Te de hierbas del monte (100g)", "paquete", "Mezcla de hierbas medicinales del bosque: toronjil, malojillo, llanten", "natural", "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400", 25},
		{"Salud y Medicina", "Natural", "Aceites", "Aceite de romero (100ml)", "botella", "Aceite esencial de romero del huerto", "natural", "", 45},

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
			INSERT INTO products (node_domain, parent_category, category, subcategory, name, unit, description, price_per_unit, badge, image_url, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), true)`,
			nodeDomain, p.parentCat, p.cat, p.subcat, p.name, p.unit, p.desc, p.price, p.badge, p.image)
		if err != nil {
			log.Printf("Demo: error seeding product %s: %v", p.name, err)
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
	var orgLevelID string
	d.Pool.QueryRow(ctx, `SELECT id::text FROM member_levels WHERE node_domain = $1 ORDER BY level DESC LIMIT 1`, nodeDomain).Scan(&orgLevelID)
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
			INSERT INTO users (node_domain, username, display_name, account_type, member_level_id, membership_status, credit_limit, debit_limit, public_key, encrypted_private_key, encryption_key_salt)
			VALUES ($1, $2, $3, 'organization', $4, 'active', $5, $6, $7, $8, $9)
			RETURNING id`,
			nodeDomain, org.username, org.displayName, orgLevelID, org.credit, org.debit, pubKeyHex, encryptedPrivKey, salt).Scan(&orgID)
		if err != nil {
			log.Printf("Demo: error creating org %s: %v", org.username, err)
			continue
		}

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

		roleID := uuid.New()
		d.Pool.Exec(ctx, `
			INSERT INTO roles (id, department_id, name, description, is_active, created_at)
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
	getUserID := func(username string) string {
		var id string
		d.Pool.QueryRow(ctx, `SELECT id::text FROM users WHERE username = $1 AND node_domain = $2`, username, nodeDomain).Scan(&id)
		return id
	}

	carmen := getUserID("carmen")
	jose := getUserID("jose")
	andrea := getUserID("andrea")
	diego := getUserID("diego")
	lucia := getUserID("lucia")
	isabel := getUserID("isabel")
	raul := getUserID("raul")
	tienda := getUserID("tienda_comunitaria")
	panaderia := getUserID("panaderia_monte")

	type txn struct {
		sender, receiver, desc string
		amount                 int64
	}

	txns := []txn{
		{carmen, tienda, "Compra de frijol y quinua", 80},
		{jose, tienda, "Compra de tijeras de podar", 60},
		{andrea, panaderia, "Pan de quinua (1kg)", 50},
		{diego, jose, "Transporte de cosecha en mula", 80},
		{lucia, isabel, "Te de hierbas del monte", 25},
		{isabel, carmen, "Queso de cabra (500g)", 60},
		{raul, tienda, "Compra de ocumo y guayaba", 42},
		{carmen, raul, "Ruana de lana (encargo)", 250},
		{andrea, isabel, "Aceite de romero", 45},
		{diego, panaderia, "Pan de quinua semanal", 50},
	}

	for i, t := range txns {
		if t.sender == "" || t.receiver == "" {
			continue
		}
		_, err := d.Pool.Exec(ctx, `
			INSERT INTO transactions (id, node_domain, sender_id, receiver_id, amount, description, status, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW() - interval '%d hours')`,
			uuid.New(), nodeDomain, t.sender, t.receiver, t.amount, t.desc, i*6)
		if err != nil {
			log.Printf("Demo: error creating transaction %d: %v", i, err)
		}
	}
	return nil
}

// DemoReset borra todos los datos del dominio demo y los re-seedea
func DemoReset(ctx context.Context, d *DB, nodeDomain string) error {
	if nodeDomain == "" {
		nodeDomain = "demo"
	}
	log.Println("DemoReset: borrando datos del dominio", nodeDomain)

	// Borrar tablas principales del dominio
	tables := []string{
		"transactions",
		"governance_rules",
		"role_permissions",
		"roles",
		"departments",
		"organizations",
		"user_credentials",
		"users",
		"products",
		"member_levels",
		"public_pages",
		"public_settings",
	}
	for _, t := range tables {
		_, err := d.Pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE node_domain = $1", t))
		if err != nil {
			log.Printf("DemoReset: error borrando %s: %v", t, err)
		}
	}

	// Re-seedear
	log.Println("DemoReset: re-seedeando datos")
	return DemoSeedData(ctx, d, nodeDomain)
}
