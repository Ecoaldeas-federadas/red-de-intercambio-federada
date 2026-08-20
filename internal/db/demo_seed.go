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
	pages := []seedPage{
		{
			Slug:      "inicio",
			Title:     "Ecoaldea Raices del Monte",
			Subtitle:  "Comunidad montana de permacultura e intercambio",
			MenuOrder: 1,
			Content: `[
  {
    "type": "hero",
    "badge": "Raices del Monte - Ecoaldea Federada",
    "title": "Ecoaldea Raices del Monte",
    "subtitle": "Una comunidad montana que vive en armonia con la tierra",
    "description": "Somos una ecoaldea de 28 familias en las montanas, dedicadas a la permacultura, la agroecologia y el intercambio comunitario. Desde 2010 hemos regenerado suelo, plantado bosques nativos y construido un sistema de economia interna basado en el Trueque Comunitario (TQ), donde cada producto vale lo que realmente cuesta producir en energia.",
    "primary_cta": { "text": "Ver Catalogo", "link": "/p/productos" },
    "secondary_cta": { "text": "Conocenos", "link": "/p/quienes-somos" },
    "style": "centered"
  },
  {
    "type": "stats",
    "title": "Nuestra Comunidad en Numeros",
    "subtitle": "15 anios construyendo un modelo de vida sostenible",
    "bg_theme": "primary",
    "items": [
      { "value": "28", "label": "Familias", "description": "Viviendo en la ecoaldea, unas 95 personas" },
      { "value": "120", "label": "Hectareas", "description": "60% bosque protegido, 30% cultivo, 10% vivienda" },
      { "value": "15", "label": "Anios", "description": "Como comunidad organizada desde 2010" },
      { "value": "100%", "label": "Energia Solar", "description": "Paneles solares y cocinas solares, cero fossil" },
      { "value": "4", "label": "Zonas Permacultura", "description": "Huerto cercano, bancales, agroforesteria, bosque" },
      { "value": "7", "label": "Comisiones", "description": "Economia, Educacion, Salud, Ambiente y mas" }
    ]
  },
  {
    "type": "features",
    "title": "Que hacemos",
    "subtitle": "Cuatro areas de trabajo comunitario",
    "columns": [
      { "icon": "leaf", "title": "Permacultura", "description": "Disenamos sistemas alimentarios que imitan los patrones de la naturaleza. Huertos en espiral, bancales elevados, agroforesteria con especies nativas, conservacion de semillas criollas." },
      { "icon": "droplet", "title": "Agua y Bosque", "description": "Captacion de agua de lluvia, tratamiento con plantas acuaticas, reforestacion con 2000 arboles nativos por ano. Manantiales protegidos y acequias de infiltracion." },
      { "icon": "sun", "title": "Energia Renovable", "description": "Paneles solares fotovoltaicos, cocinas solares parabolicas, secadores solares para frutas y hierbas. Cero dependencia de combustibles fosiles." },
      { "icon": "users", "title": "Gobernanza", "description": "Asambleas mensuales por consentimiento sociocratico. 7 comisiones autonomas. Toma de decisiones horizontal donde todas las voces son escuchadas." }
    ]
  },
  {
    "type": "text",
    "title": "Nuestra Mision",
    "body": "Demostrar que es posible vivir en comunidades rurales autosuficientes, regenerando el entorno natural, practicando la economia solidaria y construyendo cultura comunitaria. No somos una utopia cerrada: compartimos lo que aprendemos con quienes quieran crear su propia ecoaldea o comunidad."
  }
]`,
		},
		{
			Slug:      "quienes-somos",
			Title:     "Quienes Somos",
			Subtitle:  "Nuestra historia, valores y forma de vida",
			MenuOrder: 2,
			Content: `[
  {
    "type": "hero",
    "badge": "Nuestra Historia",
    "title": "De finca ganadera degradada a ecoaldea regenerativa",
    "subtitle": "15 anios transformando la tierra y la comunidad",
    "description": "Raices del Monte nacio en 2010 cuando cinco familias adquirieron una finca ganadera que habia perdido su capa vegetal y buena parte de su biodiversidad. El suelo estaba compactado, los manantiales secos, el bosque reducido a parches. Poco a poco fuimos regenerando: plantamos arboles nativos, construimos bancales, instalamos sistemas de captacion de agua, sembramos huertos y creamos un sistema de intercambio interno basado en el contenido energetico real de cada producto.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Nuestros Valores",
    "subtitle": "Los principios que guian nuestra vida comunitaria",
    "columns": [
      { "icon": "heart", "title": "Cuidado Mutuo", "description": "Nos cuidamos entre todos. La salud, la educacion y la alimentacion son responsabilidades compartidas, no individuales. Nadie enfrenta solo una enfermedad, una perdida o un problema." },
      { "icon": "leaf", "title": "Regeneracion", "description": "No solo sostenemos, regeneramos. Cada ano el bosque crece, el suelo mejora, el agua es mas abundante. Dejamos el lugar mejor de lo que lo encontramos." },
      { "icon": "scale", "title": "Justicia Economica", "description": "El TQ (Trueque Comunitario) se basa en la energia real de cada producto. Nadie se enriquece a expensas de otros. El trabajo de todos vale lo mismo por hora." },
      { "icon": "users", "title": "Autonomia", "description": "Tomamos nuestras propias decisiones en asamblea. No dependemos de bancos, ni de gobiernos, ni de corporaciones. Somos autosuficientes en lo basico." },
      { "icon": "globe", "title": "Federacion", "description": "No estamos solos. Comerciamos e intercambiamos con otras ecoaldeas federadas. La solidaridad entre comunidades es nuestra red de seguridad." },
      { "icon": "book", "title": "Aprendizaje Permanente", "description": "Aprendemos de la naturaleza y de las tradiciones campesinas. Compartimos lo que sabemos. Recibimos voluntarios y visitantes." }
    ]
  },
  {
    "type": "text",
    "title": "Como vivimos",
    "body": "Las viviendas son de bioconstruccion: adobe, bahareque, paja y madera local. Cada familia tiene su casa y un huerto. Tenemos espacios comunes: el comedor comunitario donde almorzamos juntos tres veces por semana, la escuela primaria donde estudian los ninos de la comunidad, el centro de salud natural, la herreria, el taller textil y la panaderia. El 60% del territorio es bosque protegido donde solo se extrae madera muera. El 30% son cultivos en bancales, agroforesteria y huertos. El 10% es vivienda e infraestructura."
  },
  {
    "type": "text",
    "title": "Que comemos",
    "body": "Producimos el 80% de nuestra alimentacion: granos (frijol, quinua, maiz), hortalizas (tomate, lechuga, acelga, cilantro), frutas (guayaba, mora, platano), tuberculos (ocumo, yuca), lacteos (queso de cabra), miel, huevos, pan de quinua. El 20% restante lo intercambiamos con otras ecoaldeas federadas o compramos en el pueblo mas cercano: sal, aceite, cafe, algunos granos que no se dan en altura."
  }
]`,
		},
		{
			Slug:      "gobernanza",
			Title:     "Gobernanza",
			Subtitle:  "Como tomamos decisiones y nos organizamos",
			MenuOrder: 3,
			Content: `[
  {
    "type": "hero",
    "badge": "Sociocracia Adaptada",
    "title": "Decisiones por consentimiento, no por mayoria",
    "subtitle": "Todas las voces importan, ninguna decision se impone",
    "description": "En Raices del Monte no usamos votacion mayoritaria. Usamos el consentimiento: una decision se toma cuando nadie tiene una objection fundamentada. Esto asegura que todas las voces sean escuchadas y que las decisiones sean suficientemente buenas para avanzar, sin que nadie quede excluido. La sociocracia nos permite ser eficientes sin sacrificar la horizontalidad.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Estructura de Gobernanza",
    "subtitle": "Circulos interconectados con doble enlace",
    "columns": [
      { "icon": "users", "title": "Asamblea General", "description": "Mensual, primer domingo de cada mes. Todos los miembros con voz. Decisiones estrategicas: presupuesto, admisiones, grandes cambios, conflictos entre comisiones." },
      { "icon": "network", "title": "7 Comisiones", "description": "Economia, Educacion, Salud, Ambiente, Admision, Construccion y Consejo de Vision. Cada una es autonoma en su area y tiene doble enlace con la asamblea." },
      { "icon": "scale", "title": "Consejo de Vision", "description": "Tres miembros Raiz que custodian la vision y valores fundacionales. No gobiernan, sino que recuerdan por que estamos aqui y por que tomamos ciertas decisiones." },
      { "icon": "clipboard", "title": "Protocolos Documentados", "description": "Cada decision se documenta en actas. Los acuerdos son revisables y mejorables. Nada es permanente: todo puede ser evaluado y cambiado por consentimiento." }
    ]
  },
  {
    "type": "text",
    "title": "Niveles de Membresia",
    "body": "Raiz: Fundadores con voz y voto en todas las decisiones. Custodian la vision y memoria de la comunidad. Tronco: Miembros con mas de 2 anios, voz y voto en asamblea. Pueden liderar comisiones. Rama: Miembros con mas de 6 meses, voz en asamblea y voto en su comision. Brote: Recien ingresados, voz en asamblea pero sin voto hasta completar 6 meses y pasar por la evaluacion de la Comision de Admision."
  },
  {
    "type": "text",
    "title": "Como se Toma una Decision",
    "body": "1) Alguien presenta una propuesta en asamblea o en su comision. 2) Se hace una ronda de preguntas para entender la propuesta. 3) Se hace una ronda de reacciones: cada persona dice que le parece. 4) Se modifica la propuesta si es necesario. 5) Se pregunta: ¿alguien tiene una objection fundamentada que impida que avancemos con esto? 6) Si nadie objeta, la decision se toma. 7) Si hay objeci\u00f3n, se trabaja la objeci\u00f3n hasta llegar a una version que todos puedan consentir."
  },
  {
    "type": "text",
    "title": "Trabajo Comunitario",
    "body": "Cada miembro contribuye con 8 horas mensuales de trabajo comunitario: mantenimiento de senderos, reforestacion, construccion, limpieza de acequias, o tareas asignadas por comisiones. Este trabajo se registra en TQ al valor estandar de 10 TQ por hora. Es la base de nuestra economia: el trabajo comunitario genera TQ que despues se intercambian por productos."
  }
]`,
		},
		{
			Slug:      "economia",
			Title:     "Economia Comunitaria",
			Subtitle:  "Como funciona el Trueque Comunitario (TQ)",
			MenuOrder: 4,
			Content: `[
  {
    "type": "hero",
    "badge": "Trueque Comunitario",
    "title": "El TQ: moneda energetica, no dinero",
    "subtitle": "No es dinero. No es cripto. No genera interes. Es energia.",
    "description": "El TQ (Trueque Comunitario) es nuestra unidad de intercambio interno. Se calcula en base al contenido energetico real de cada producto o servicio, medido en kWh o joules. Un kilo de frijol vale 35 TQ porque eso es lo que cuesta producirlo en energia humana, solar y de insumos. Sin inflacion, sin interes, sin bancos, sin devaluacion. Un TQ hoy vale lo mismo que en 10 anios.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Principios del TQ",
    "subtitle": "Lo que hace diferente a nuestra moneda",
    "columns": [
      { "icon": "zap", "title": "Basado en Energia Real", "description": "Cada producto vale lo que cuesta producirlo en energia: humana (trabajo), solar (paneles, secadores), de insumos (semillas, agua). El precio lo calcula la Calculadora Energetica." },
      { "icon": "ban", "title": "Sin Inflacion", "description": "La energia no se devalua. Un TQ hoy vale lo mismo que en 10 anios. No hay emision de dinero nuevo sin respaldo energetico." },
      { "icon": "ban", "title": "Sin Interes", "description": "No hay prestamos con interes. Si necesitas credito, la asamblea lo aprueba sin costo financiero. El fondo comunitario respalda los creditos." },
      { "icon": "globe", "title": "Federable", "description": "Podemos intercambiar con otras ecoaldeas federadas usando los mismos principios energeticos. El comercio entre nodos respeta la autonomia de cada comunidad." },
      { "icon": "scale", "title": "Justo", "description": "El trabajo de todos vale lo mismo por hora: 10 TQ. Nadie cobra mas por hacer trabajo intelectual vs manual. La diferencia esta en las horas, no en la tarifa." },
      { "icon": "shield", "title": "Transparente", "description": "Todas las transacciones son publicas dentro de la comunidad. Cualquier miembro puede auditar el libro de transacciones." }
    ]
  },
  {
    "type": "text",
    "title": "Como se Calcula el Precio",
    "body": "La Calculadora Energetica del sistema toma en cuenta: 1) Energia humana: horas de trabajo x 10 TQ/hora. 2) Energia de insumos: semillas, agua, compost, herramientas (depreciadas). 3) Energia solar: secado, bombeo de agua. 4) Factor de esfuerzo: trabajos fisicamente exigentes tienen un pequeno factor extra. 5) Categoria: alimentos vitales (granos, hortalizas) tienen tarifa energetica preferente. Servicios y artesania tienen tarifa estandar."
  },
  {
    "type": "text",
    "title": "Limites y Creditos",
    "body": "Cada miembro tiene un limite de credito (positivo) y debito (negativo) en TQ. Los limites dependen del nivel de membresia: Raiz +/-5000, Tronco +/-3000, Rama +/-1500, Brote +/-500. Si necesitas mas, puedes solicitar un credito extraordinario a la asamblea. Los creditos se aprueban por consentimiento, sin interes, con plazo definido. El fondo comunitario respalda los creditos."
  }
]`,
		},
		{
			Slug:      "productos",
			Title:     "Catalogo",
			Subtitle:  "Productos y servicios de Raices del Monte",
			MenuOrder: 5,
			Content: `[
  {
    "type": "hero",
    "badge": "Catalogo Comunitario",
    "title": "Lo que producimos",
    "subtitle": "Agricultura, artesania, servicios y mas - todo en TQ",
    "description": "Todo lo que se produce en la ecoaldea esta en el catalogo. Los precios estan en TQ y reflejan el contenido energetico real de cada producto. Puedes ver productos agricolas, derivados artesanales, artesania local, herramientas, salud natural y servicios comunitarios.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Categorias del Catalogo",
    "columns": [
      { "icon": "leaf", "title": "Agricultura", "description": "Granos, hortalizas, frutas, raices. Cultivados en bancales y agroforesteria, sin agroticos." },
      { "icon": "wheat", "title": "Derivados", "description": "Queso de cabra, pan de quinua, mermeladas, miel de montana. Procesados artesanalmente." },
      { "icon": "palette", "title": "Artesania", "description": "Ruanas de lana, ceramica de barro local, muebles de madera, cestas de bambu." },
      { "icon": "wrench", "title": "Herramientas", "description": "Forjadas en la herreria comunitaria con hierro reciclado." },
      { "icon": "heart", "title": "Salud Natural", "description": "Tes de hierbas del monte, aceites esenciales, preparados herbalistas." },
      { "icon": "book", "title": "Servicios", "description": "Talleres de permacultura, transporte en mula, construccion natural." }
    ]
  }
]`,
		},
		{
			Slug:      "federacion",
			Title:     "Federacion",
			Subtitle:  "La Red de Ecoaldeas Federadas",
			MenuOrder: 6,
			Content: `[
  {
    "type": "hero",
    "badge": "Red Federada",
    "title": "No estamos solos",
    "subtitle": "La red crece con cada comunidad que se suma",
    "description": "Raices del Monte es parte de la Red de Intercambio Federada. Esto significa que podemos comerciar con otras ecoaldeas, comunidades y cooperativas que usan el mismo sistema. Cada nodo es completamente autonomo: tiene sus propias normas, su propia moneda comunitaria, su propia gobernanza. Pero todos podemos intercambiar productos, servicios y conocimiento usando los mismos principios energeticos.",
    "style": "centered"
  },
  {
    "type": "features",
    "title": "Como Funciona la Federacion",
    "subtitle": "Comercio entre nodos con autonomia total",
    "columns": [
      { "icon": "globe", "title": "Comercio Entre Nodos", "description": "Vender tus productos a otras ecoaldeas y comprar lo que tu no produces. El sistema calcula el equivalente energetico entre monedas comunitarias." },
      { "icon": "users", "title": "Intercambio de Conocimiento", "description": "Talleres, capacitaciones y experiencias compartidas entre comunidades. Si tu ecoaldea sabe de bioconstruccion y la nuestra de permacultura, intercambiamos." },
      { "icon": "shield", "title": "Resiliencia Colectiva", "description": "Si un nodo tiene problemas (sequia, incendio, enfermedad), otros pueden ayudar. La solidaridad practica es nuestra red de seguridad." },
      { "icon": "leaf", "title": "Autonomia Total", "description": "Cada nodo mantiene sus normas, su cultura, sus decisiones y sus datos. Nadie impone nada a nadie. La federacion es voluntaria y revocable." }
    ]
  },
  {
    "type": "text",
    "title": "Como se Federan los Nodos",
    "body": "Cada nodo tiene su propia identidad criptografica (claves Ed25519). Cuando dos nodos quieren federarse, intercambian certificados y establecen un canal seguro con mTLS. A partir de ahi pueden consultar balances, intercambiar productos y sincronizar estados. El sistema detecta automaticamente conflictos de fusion (cuando dos nodos registran transacciones contradictorias) y los reporta para que las asambleas de cada nodo los resuelvan."
  },
  {
    "type": "text",
    "title": "Limites de Comercio Federado",
    "body": "Cada nodo define sus propios limites de comercio multilateral: cuanto puede deber un nodo a otro, cuanto puede recibir. Estos limites los aprueba la asamblea de cada nodo. El sistema bloquea automaticamente transacciones que excedan los limites, protegiendo a las comunidades de deudas insostenibles."
  }
]`,
		},
		{
			Slug:      "contacto",
			Title:     "Contacto",
			Subtitle:  "Quieres visitarnos o unirte?",
			MenuOrder: 7,
			Content: `[
  {
    "type": "contact",
    "title": "Visita Raices del Monte",
    "subtitle": "Recibimos visitantes, voluntarios y nuevos miembros",
    "description": "Si tienes una ecoaldea, comunidad o quieres crear una, puedes contactarnos. Tambien recibimos voluntarios que quieran aprender permacultura, bioconstruccion o agroecologia. Organizamos jornadas de puertas abiertas cada primer domingo de mes, despues de la asamblea. Escribenos con tiempo para coordinar tu visita.",
    "email": "contacto@raicesdelmonte.org",
    "show_form": true
  },
  {
    "type": "text",
    "title": "Como Llegar",
    "body": "Estamos en una zona montanosa a 1200m de altitud, a 45 minutos en vehiculo del pueblo mas cercano. El ultimo tramo se hace a pie o en mula por un sendero de 3km. Coordinamos el encuentro en el pueblo para guiarte. No hay senal de telefono movil dentro de la ecoaldea, pero tenemos radio y internet por satelite."
  },
  {
    "type": "text",
    "title": "Para Nuevos Miembros",
    "body": "El proceso de admision tiene varias etapas: 1) Visita inicial de un fin de semana. 2) Periodo de voluntariado de 1-3 meses. 3) Solicitud formal con patrocinio de un miembro Tronco o Raiz. 4) Periodo de prueba de 6 meses como Brote. 5) Evaluacion de la Comision de Admision. 6) Decision de la asamblea por consentimiento. No es un proceso rapido, pero asegura que la comunidad y la persona sean compatibles."
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
