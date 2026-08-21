package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ServiceCatalogItem define un servicio del catalogo.
type ServiceCatalogItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Icon        string `json:"icon"`
	WhatIs      string `json:"what_is"`
	Replaces    string `json:"replaces"`
	UsedFor     string `json:"used_for"`
	Protocol    string `json:"protocol"`
	Docker      bool   `json:"docker"`
	MinRAM      int    `json:"min_ram_mb"`
	MinDisk     int    `json:"min_disk_gb"`
	DefaultPort int    `json:"default_port"`
	Subdomain   string `json:"subdomain"`
}

// FederatedServicesHandler maneja el catalogo de servicios federados.
type FederatedServicesHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

// NewFederatedServicesHandler crea un nuevo handler de servicios.
func NewFederatedServicesHandler(pool *pgxpool.Pool, nodeDomain string) *FederatedServicesHandler {
	return &FederatedServicesHandler{Pool: pool, NodeDomain: nodeDomain}
}

// catalog define todos los servicios disponibles.
var catalog = []ServiceCatalogItem{
	// === Redes Sociales Federadas ===
	{
		ID: "peertube", Name: "PeerTube", Category: "social", Icon: "Video",
		WhatIs:   "Plataforma de videos donde cualquiera puede subir, ver y compartir videos. Los videos se almacenan en el servidor de tu aldea, no en servidores corporativos. Las aldeas pueden federarse y ver videos entre ellas.",
		Replaces: "YouTube",
		UsedFor:  "Subir videos de la aldea, tutoriales de agricultura, asambleas grabadas, documentales educativos, musica local. Sin anuncios, sin algoritmos que deciden que ver, sin recopilacion de datos.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 2048, MinDisk: 50, DefaultPort: 9000, Subdomain: "video",
	},
	{
		ID: "mastodon", Name: "Mastodon", Category: "social", Icon: "MessageCircle",
		WhatIs:   "Red social de mensajes cortos (hasta 500 caracteres). Cada aldea tiene su propio servidor. Los miembros publican mensajes, siguen a otros, responden. Las aldeas federadas pueden ver y responder mensajes entre ellas.",
		Replaces: "Twitter / X",
		UsedFor:  "Comunicacion rapida de la aldea, anuncios, debates, seguir noticias de otras aldeas. Sin anuncios, sin algoritmos, sin empresas vigilando.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 2048, MinDisk: 20, DefaultPort: 3000, Subdomain: "social",
	},
	{
		ID: "pixelfed", Name: "Pixelfed", Category: "social", Icon: "Image",
		WhatIs:   "Red social de fotografias. Subes fotos, las compartes, sigues a otras personas, das 'me gusta'. Parecido a Instagram pero sin anuncios ni vigilancia. Las aldeas federadas pueden ver fotos entre ellas.",
		Replaces: "Instagram",
		UsedFor:  "Compartir fotos de la aldea, cosechas, talleres, eventos, paisajes. Sin filtros que alteran tu imagen, sin anuncios, sin recopilacion de datos.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 20, DefaultPort: 8080, Subdomain: "fotos",
	},
	{
		ID: "friendica", Name: "Friendica", Category: "social", Icon: "Users",
		WhatIs:   "Red social completa con perfiles, grupos, eventos, mensajes privados, foros. Mas parecida a una red social tradicional. Puede conectarse con Mastodon, Diaspora y otras redes. Las aldeas federadas comparten contenido entre ellas.",
		Replaces: "Facebook",
		UsedFor:  "Crear grupos de la aldea (ej: 'Grupo de Agricultores', 'Grupo de Mujeres'), organizar eventos, debates mas largos que Mastodon, mensajes privados. Sin anuncios, sin vigilancia, sin vender tus datos.",
		Protocol: "ActivityPub/DFN", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 80, Subdomain: "red",
	},
	{
		ID: "lemmy", Name: "Lemmy", Category: "social", Icon: "MessageSquare",
		WhatIs:   "Plataforma de foros y discusiones donde la gente publica enlaces, hace preguntas, responde, y vota las mejores respuestas. Los temas se organizan en 'comunidades' (ej: 'agricultura', 'construccion', 'salud'). Las aldeas federadas comparten comunidades entre ellas.",
		Replaces: "Reddit",
		UsedFor:  "Foros de discusion por tema, preguntas y respuestas, compartir conocimientos tecnicos. La comunidad vota lo util que es cada respuesta. Sin anuncios, sin empresas manipulando que ves.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 1236, Subdomain: "foro",
	},
	{
		ID: "bookwyrm", Name: "BookWyrm", Category: "social", Icon: "BookOpen",
		WhatIs:   "Red social para amantes de los libros. Llevas un registro de los libros que lees, los calificas, escribes resenas, creas listas de lectura, y descubres libros que otros recomiendan. Las aldeas federadas comparten resenas entre ellas.",
		Replaces: "Goodreads (pagina web donde la gente lleva registro de libros leidos y califica libros)",
		UsedFor:  "La biblioteca de la aldea puede llevar registro de los libros disponibles. Los miembros pueden recomendar libros, crear clubes de lectura, descubrir que leer. Sin que Amazon (dueno de Goodreads) vigile tus lecturas.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 5, DefaultPort: 8000, Subdomain: "libros",
	},
	{
		ID: "writefreely", Name: "WriteFreely", Category: "social", Icon: "PenTool",
		WhatIs:   "Plataforma de blogs minimalista para escribir y publicar articulos, ensayos, historias, tutoriales. Sin distracciones, foco en la escritura. Los blogs se pueden federar con otras aldeas.",
		Replaces: "Medium, Blogger, WordPress.com",
		UsedFor:  "Escribir articulos largos, manuales, historias de la aldea, reflexiones, tutoriales. Publicar sin anuncios, sin ventanas emergentes, sin empresas monetizando tu contenido.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 8080, Subdomain: "blog",
	},
	{
		ID: "mobilizon", Name: "Mobilizon", Category: "social", Icon: "Calendar",
		WhatIs:   "Plataforma para crear y gestionar eventos. Creas un evento, pones fecha, lugar, descripcion, y la gente se inscribe. Parecido a la seccion de eventos de Facebook pero sin Facebook.",
		Replaces: "Facebook Events, Eventbrite",
		UsedFor:  "Organizar asambleas, talleres, fiestas, mingas, reuniones. La gente se inscribe sin necesidad de tener Facebook. Las aldeas federadas pueden ver eventos de otras aldeas.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 4000, Subdomain: "eventos",
	},

	// === Comunicacion ===
	{
		ID: "matrix", Name: "Matrix (Synapse)", Category: "comunicacion", Icon: "MessageSquare",
		WhatIs:   "Sistema de mensajeria descentralizado. Cada aldea tiene su propio servidor de mensajeria. Los miembros chatean en grupo o privado, envian archivos, hacen llamadas de voz y video. Las aldeas federadas pueden chatear entre ellas.",
		Replaces: "WhatsApp, Telegram, Signal",
		UsedFor:  "Mensajeria privada de la aldea, grupos de trabajo, coordinacion, envio de documentos. Sin que Meta (dueno de WhatsApp) lea tus mensajes ni venda tus datos. Tus mensajes se quedan en el servidor de tu aldea.",
		Protocol: "Matrix", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 8008, Subdomain: "chat",
	},
	{
		ID: "jitsi", Name: "Jitsi Meet", Category: "comunicacion", Icon: "Video",
		WhatIs:   "Plataforma de videoconferencias. Creas una sala, compartes el enlace, y la gente se conecta desde el navegador. Sin instalar nada. Soporta presentaciones de pantalla, grabacion, chat.",
		Replaces: "Zoom, Google Meet, Microsoft Teams",
		UsedFor:  "Reuniones virtuales de la asamblea, talleres en linea, educacion a distancia, reuniones con otras aldeas. Sin limite de tiempo, sin pagar suscripcion, sin que Zoom grabe tus reuniones.",
		Protocol: "XMPP", Docker: true, MinRAM: 2048, MinDisk: 10, DefaultPort: 443, Subdomain: "reuniones",
	},
	{
		ID: "voip", Name: "Asterisk + FreePBX (Telefonia VoIP)", Category: "comunicacion", Icon: "Phone",
		WhatIs:   "Sistema telefonico completo para la aldea. Cada miembro tiene un numero de extension telefonica (ej: 2001, 2002). Se pueden hacer llamadas internas gratis. Con un codigo de aldea unico, se pueden llamar a miembros de otras aldeas federadas marcando el codigo de la aldea + el numero.",
		Replaces: "Lineas telefonicas tradicionales (compania telefonica)",
		UsedFor:  "Telefonos internos de la aldea sin pagar mensualidad a una compania. Llamadas entre aldeas federadas gratis por la intranet. Cada aldea tiene su codigo unico (ej: aldea 101, aldea 102). Para llamar de la aldea 101 a la 102, marcas 102-2001. Funciona con telefonos IP, telefonos analogos con adaptador, o apps en el celular.",
		Protocol: "SIP/RTP", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 5060, Subdomain: "voip",
	},
	{
		ID: "mumble", Name: "Mumble", Category: "comunicacion", Icon: "Mic",
		WhatIs:   "Sistema de voz en grupo de baja latencia. Creas un canal, la gente se conecta, y hablan como en una llamada grupal pero con mejor calidad y menos consumo. Parecido a Discord pero sin anuncios ni vigilancia.",
		Replaces: "Discord (canal de voz), TeamSpeak",
		UsedFor:  "Comunicacion de voz en tiempo real para trabajo en campo, coordinacion de mingas, radio de la aldea. Funciona bien con internet lento. Sin anuncios, sin empresas escuchando.",
		Protocol: "Mumble", Docker: true, MinRAM: 256, MinDisk: 1, DefaultPort: 64738, Subdomain: "voz",
	},

	// === Productividad y Archivos ===
	{
		ID: "nextcloud", Name: "Nextcloud", Category: "productividad", Icon: "Cloud",
		WhatIs:   "Almacenamiento de archivos en la nube. Cada miembro tiene su carpeta privada donde puede guardar documentos, fotos, videos. Se pueden compartir carpetas con otros. Incluye calendario, contactos, tareas. Todo se almacena en el servidor de la aldea.",
		Replaces: "Google Drive, Dropbox, iCloud, OneDrive",
		UsedFor:  "Guardar documentos de la aldea, compartir archivos entre miembros, calendario comunitario, contactos. Sin pagar suscripcion mensual, sin que Google o Apple tengan acceso a tus archivos. Tus datos se quedan en la aldea.",
		Protocol: "WebDAV", Docker: true, MinRAM: 512, MinDisk: 50, DefaultPort: 80, Subdomain: "archivos",
	},
	{
		ID: "collabora", Name: "Collabora / Nextcloud Office", Category: "productividad", Icon: "FileText",
		WhatIs:   "Suite ofimatica en el navegador. Crear y editar documentos de texto, hojas de calculo, presentaciones. Trabajo colaborativo en tiempo real (varias personas editando el mismo documento a la vez). Se integra con Nextcloud.",
		Replaces: "Google Docs, Google Sheets, Google Slides, Microsoft Office Online",
		UsedFor:  "Escribir documentos de la asamblea, llevar planillas de contabilidad, crear presentaciones para talleres. Trabajo colaborativo sin Google ni Microsoft vigilando tu contenido.",
		Protocol: "WOPISrc", Docker: true, MinRAM: 1024, MinDisk: 5, DefaultPort: 9980, Subdomain: "docs",
	},
	{
		ID: "bookstack", Name: "BookStack", Category: "productividad", Icon: "BookMarked",
		WhatIs:   "Plataforma de documentacion y wiki organizada como libros, capitulos y paginas. Facil de usar, no requiere conocimientos tecnicos. Busqueda integrada, control de permisos.",
		Replaces: "Confluence, Notion (para documentacion)",
		UsedFor:  "Manual de la aldea, recetarios, guias de cultivo, procedimientos, reglamentos. Organizar el conocimiento de la aldea en un solo lugar. Facil de buscar y actualizar.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 80, Subdomain: "wiki",
	},
	{
		ID: "mediawiki", Name: "MediaWiki", Category: "productividad", Icon: "Globe",
		WhatIs:   "Software de wiki, el mismo que usa Wikipedia. Cualquiera puede crear y editar paginas. Historial de cambios, discusiones, categorias.",
		Replaces: "Wikipedia (para conocimiento interno de la aldea)",
		UsedFor:  "Enciclopedia interna de la aldea, documentacion colaborativa, base de conocimiento. Todos pueden contribuir. Igual que Wikipedia pero para tu aldea.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 80, Subdomain: "enciclopedia",
	},

	// === Multimedia ===
	{
		ID: "jellyfin", Name: "Jellyfin", Category: "multimedia", Icon: "Film",
		WhatIs:   "Servidor de medios. Guardas tus peliculas, series, musica, fotos en el servidor y las reproduces desde cualquier dispositivo (TV, celular, computadora). Sin anuncios, sin suscripcion.",
		Replaces: "Netflix, Spotify, Plex",
		UsedFor:  "Cine de la aldea, biblioteca de musica, peliculas educativas, documentales. Cada miembro puede ver lo que quiera cuando quiera. Sin pagar Netflix, sin anuncios, sin algoritmos.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 50, DefaultPort: 8096, Subdomain: "cine",
	},
	{
		ID: "funkwhale", Name: "Funkwhale", Category: "multimedia", Icon: "Music",
		WhatIs:   "Plataforma de musica federada. Subes musica, creas playlists, sigues artistas. Las aldeas federadas pueden compartir musica entre ellas. Parecido a Spotify pero sin anuncios ni empresas.",
		Replaces: "Spotify, SoundCloud",
		UsedFor:  "Compartir musica de la aldea, artistas locales, podcasts, grabaciones de asambleas. Descubrir musica de otras aldeas. Sin anuncios, sin algoritmos, sin empresas monetizando tu escucha.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 20, DefaultPort: 5000, Subdomain: "musica",
	},

	// === Desarrollo y Otros ===
	{
		ID: "gitea", Name: "Gitea / Forgejo", Category: "desarrollo", Icon: "GitBranch",
		WhatIs:   "Plataforma de gestion de codigo fuente. Hospeda repositorios git, control de versiones, issues, pull requests. Parecido a GitHub pero en tu propio servidor.",
		Replaces: "GitHub, GitLab",
		UsedFor:  "Si alguien de la aldea programa, puede hospedar su codigo aqui. Tambien para versionar documentos importantes, configuraciones, manuales tecnicos. Sin depender de GitHub (empresa de Microsoft).",
		Protocol: "Git", Docker: true, MinRAM: 256, MinDisk: 10, DefaultPort: 3000, Subdomain: "codigo",
	},
	{
		ID: "bigbluebutton", Name: "BigBlueButton", Category: "desarrollo", Icon: "GraduationCap",
		WhatIs:   "Plataforma de educacion virtual con pizarra, presentaciones, video, chat, grupos de trabajo. Disenada para ensenanza online.",
		Replaces: "Zoom (para educacion), Google Classroom",
		UsedFor:  "Clases virtuales de la escuela de la aldea, talleres en linea, capacitaciones. Pizarra compartida, presentaciones, grabacion de clases. Sin pagar Zoom, sin Google vigilando.",
		Protocol: "Web", Docker: true, MinRAM: 4096, MinDisk: 20, DefaultPort: 80, Subdomain: "clases",
	},
	{
		ID: "homeassistant", Name: "Home Assistant", Category: "desarrollo", Icon: "Home",
		WhatIs:   "Plataforma de automatizacion del hogar. Conecta dispositivos inteligentes (luces, sensores, cerraduras, energia solar, bombas de agua) y los controla desde un solo lugar. Funciona sin Internet.",
		Replaces: "Google Home, Amazon Alexa, SmartThings",
		UsedFor:  "Automatizar luces, monitorear energia solar, controlar bombas de agua, sensores de temperatura, seguridad. Sin que Google o Amazon tengan acceso a tu casa. Todo se procesa localmente.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 8123, Subdomain: "casa",
	},
	{
		ID: "vaultwarden", Name: "Vaultwarden (Bitwarden)", Category: "desarrollo", Icon: "Lock",
		WhatIs:   "Gestor de contrasenas. Guarda todas tus contrasenas de forma cifrada en el servidor de la aldea. Autocompleta contrasenas en el navegador. Genera contrasenas seguras.",
		Replaces: "LastPass, 1Password, Dashlane, gestor de contrasenas de Google/Apple",
		UsedFor:  "Que cada miembro tenga un lugar seguro para sus contrasenas. No mas contrasenas escritas en papel o repetidas. Sincroniza entre dispositivos. Sin que empresas de terceros tengan tus contrasenas.",
		Protocol: "Web", Docker: true, MinRAM: 128, MinDisk: 1, DefaultPort: 80, Subdomain: "claves",
	},
}

// RegisterRoutesWithAuth registra las rutas de servicios federados.
func (sh *FederatedServicesHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/services/catalog", sh.getCatalog)
	r.Get("/api/services/installed", sh.listInstalled)
	r.Get("/api/services/{serviceID}/status", sh.getServiceStatus)

	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/install", sh.installService)
		r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/uninstall", sh.uninstallService)
		r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/start", sh.startService)
		r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/stop", sh.stopService)
		r.With(am.RequirePermission("config.manage")).Get("/api/services/{serviceID}/download", sh.downloadService)
	} else {
		r.Post("/api/services/{serviceID}/install", sh.installService)
		r.Post("/api/services/{serviceID}/uninstall", sh.uninstallService)
		r.Post("/api/services/{serviceID}/start", sh.startService)
		r.Post("/api/services/{serviceID}/stop", sh.stopService)
		r.Get("/api/services/{serviceID}/download", sh.downloadService)
	}

	// VoIP
	r.Get("/api/voip/config", sh.getVoIPConfig)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/generate-code", sh.generateVillageCode)
		r.With(am.RequirePermission("config.manage")).Put("/api/voip/config", sh.updateVoIPConfig)
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/extensions", sh.createExtension)
		r.With(am.RequirePermission("config.manage")).Delete("/api/voip/extensions/{ext}", sh.deleteExtension)
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/routes", sh.createRoute)
		r.With(am.RequirePermission("config.manage")).Delete("/api/voip/routes/{code}", sh.deleteRoute)
	} else {
		r.Post("/api/voip/generate-code", sh.generateVillageCode)
		r.Put("/api/voip/config", sh.updateVoIPConfig)
		r.Post("/api/voip/extensions", sh.createExtension)
		r.Delete("/api/voip/extensions/{ext}", sh.deleteExtension)
		r.Post("/api/voip/routes", sh.createRoute)
		r.Delete("/api/voip/routes/{code}", sh.deleteRoute)
	}
	r.Get("/api/voip/extensions", sh.listExtensions)
	r.Get("/api/voip/routes", sh.listRoutes)

	// Numero de nodo
	r.Get("/api/node/number", sh.getNodeNumber)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/node/number/generate", sh.generateNodeNumber)
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/auto-configure-routes", sh.autoConfigureSIPRoutes)
	} else {
		r.Post("/api/node/number/generate", sh.generateNodeNumber)
		r.Post("/api/voip/auto-configure-routes", sh.autoConfigureSIPRoutes)
	}

	// Pasarelas PSTN
	r.Get("/api/voip/pstn-gateways", sh.listPSTNGateways)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/pstn-gateways", sh.createPSTNGateway)
		r.With(am.RequirePermission("config.manage")).Delete("/api/voip/pstn-gateways/{id}", sh.deletePSTNGateway)
	} else {
		r.Post("/api/voip/pstn-gateways", sh.createPSTNGateway)
		r.Delete("/api/voip/pstn-gateways/{id}", sh.deletePSTNGateway)
	}

	// Saldo prepago
	r.Get("/api/voip/balance", sh.getVoIPBalance)
	r.Post("/api/voip/recharge", sh.rechargeVoIP)
	r.Get("/api/voip/recharges", sh.listRecharges)
	if am != nil {
		r.With(am.RequirePermission("config.manage")).Post("/api/voip/recharges/{id}/confirm", sh.confirmRecharge)
	} else {
		r.Post("/api/voip/recharges/{id}/confirm", sh.confirmRecharge)
	}

	// CDR (registro de llamadas)
	r.Get("/api/voip/cdr", sh.listCDR)

	// Tarifas
	r.Get("/api/voip/rates", sh.listRates)
}

// getCatalog devuelve el catalogo completo de servicios.
func (sh *FederatedServicesHandler) getCatalog(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Obtener estados instalados
	installed := map[string]string{}
	rows, err := sh.Pool.Query(ctx, `SELECT service_id, status FROM installed_services`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var svcID, status string
			_ = rows.Scan(&svcID, &status)
			installed[svcID] = status
		}
	}

	// Combinar catalogo con estado
	result := make([]map[string]interface{}, len(catalog))
	for i, svc := range catalog {
		item := map[string]interface{}{
			"id":           svc.ID,
			"name":         svc.Name,
			"category":     svc.Category,
			"icon":         svc.Icon,
			"what_is":      svc.WhatIs,
			"replaces":     svc.Replaces,
			"used_for":     svc.UsedFor,
			"protocol":     svc.Protocol,
			"docker":       svc.Docker,
			"min_ram_mb":   svc.MinRAM,
			"min_disk_gb":  svc.MinDisk,
			"default_port": svc.DefaultPort,
			"subdomain":    svc.Subdomain,
			"status":       installed[svc.ID],
		}
		if item["status"] == nil || item["status"] == "" {
			item["status"] = "not_installed"
		}
		result[i] = item
	}

	writeJSON(w, 200, map[string]interface{}{"services": result})
}

// listInstalled lista los servicios instalados.
func (sh *FederatedServicesHandler) listInstalled(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT service_id, service_name, category, subdomain, container_name, status, port, installed_at
		FROM installed_services ORDER BY service_name`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"services": []interface{}{}})
		return
	}
	defer rows.Close()

	var services []map[string]interface{}
	for rows.Next() {
		var svcID, name, category, status string
		var subdomain, containerName *string
		var port *int
		var installedAt *time.Time
		_ = rows.Scan(&svcID, &name, &category, &subdomain, &containerName, &status, &port, &installedAt)
		svc := map[string]interface{}{
			"service_id": svcID,
			"name":       name,
			"category":   category,
			"status":     status,
		}
		if subdomain != nil {
			svc["subdomain"] = *subdomain
		}
		if containerName != nil {
			svc["container_name"] = *containerName
		}
		if port != nil {
			svc["port"] = *port
		}
		if installedAt != nil {
			svc["installed_at"] = *installedAt
		}
		services = append(services, svc)
	}
	if services == nil {
		services = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"services": services})
}

// findService busca un servicio en el catalogo por ID.
func findService(id string) *ServiceCatalogItem {
	for i := range catalog {
		if catalog[i].ID == id {
			return &catalog[i]
		}
	}
	return nil
}

// installService instala un servicio via Docker.
func (sh *FederatedServicesHandler) installService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	ctx := r.Context()
	containerName := fmt.Sprintf("aldea-%s", serviceID)

	// Verificar si docker-compose.yml existe
	composePath := filepath.Join("services", serviceID, "docker-compose.yml")
	if _, err := os.Stat(composePath); err != nil {
		// Si no existe, crear uno basico
		writeJSON(w, 200, map[string]interface{}{
			"success":    false,
			"message":    fmt.Sprintf("No se encontro docker-compose.yml para %s. Usa 'Descargar' para obtener el paquete e instalarlo manualmente.", svc.Name),
			"service_id": serviceID,
			"note":       fmt.Sprintf("El archivo services/%s/docker-compose.yml no existe en el servidor. Descarga el paquete e instalo manualmente.", serviceID),
		})
		return
	}

	// Ejecutar docker compose up -d
	cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d")
	output, err := cmd.CombinedOutput()

	status := "running"
	if err != nil {
		status = "error"
	}

	// Guardar en BD
	_, _ = sh.Pool.Exec(ctx, `
		INSERT INTO installed_services (service_id, service_name, category, subdomain, container_name, docker_compose_path, status, port, installed_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		ON CONFLICT (service_id) DO UPDATE SET status = $7, updated_at = NOW()`,
		serviceID, svc.Name, svc.Category, svc.Subdomain, containerName, composePath, status, svc.DefaultPort)

	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"success":    false,
			"service_id": serviceID,
			"message":    fmt.Sprintf("Error al instalar: %v", err),
			"logs":       string(output),
		})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":    true,
		"service_id": serviceID,
		"message":    fmt.Sprintf("%s instalado correctamente", svc.Name),
		"subdomain":  fmt.Sprintf("%s.%s", svc.Subdomain, sh.NodeDomain),
		"port":       svc.DefaultPort,
		"logs":       string(output),
	})
}

// uninstallService desinstala un servicio.
func (sh *FederatedServicesHandler) uninstallService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	ctx := r.Context()

	// Detener y eliminar contenedor
	cmd := exec.Command("docker", "compose", "-f", filepath.Join("services", serviceID, "docker-compose.yml"), "down")
	cmd.Run()

	// Actualizar BD
	_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'not_installed', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio desinstalado"})
}

// startService inicia un servicio detenido.
func (sh *FederatedServicesHandler) startService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	cmd := exec.Command("docker", "compose", "-f", filepath.Join("services", serviceID, "docker-compose.yml"), "start")
	output, err := cmd.CombinedOutput()

	ctx := r.Context()
	if err == nil {
		_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'running', updated_at = NOW() WHERE service_id = $1`, serviceID)
		writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio iniciado", "logs": string(output)})
	} else {
		_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
		writeError(w, 500, fmt.Sprintf("error al iniciar: %v", err))
	}
}

// stopService detiene un servicio.
func (sh *FederatedServicesHandler) stopService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	cmd := exec.Command("docker", "compose", "-f", filepath.Join("services", serviceID, "docker-compose.yml"), "stop")
	cmd.Run()

	ctx := r.Context()
	_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'stopped', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio detenido"})
}

// getServiceStatus devuelve el estado de un servicio.
func (sh *FederatedServicesHandler) getServiceStatus(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	containerName := fmt.Sprintf("aldea-%s", serviceID)

	// Verificar si el contenedor esta corriendo
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", containerName)
	output, err := cmd.Output()
	running := false
	if err == nil {
		running = strings.TrimSpace(string(output)) == "true"
	}

	writeJSON(w, 200, map[string]interface{}{
		"service_id":     serviceID,
		"container_name": containerName,
		"running":        running,
		"status":         map[bool]string{true: "running", false: "stopped"}[running],
	})
}

// downloadService genera un paquete descargable con docker-compose + configs.
func (sh *FederatedServicesHandler) downloadService(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	// Generar docker-compose.yml personalizado
	composeContent := fmt.Sprintf(`# docker-compose.yml para %s
# Generado por el nodo de la aplicacion
# Servicio: %s
# Reemplaza: %s
#
# Para instalar:
#   1. Copiar este archivo al servidor destino
#   2. Ejecutar: docker compose up -d
#   3. Acceder en: http://%s.%s:%d

version: '3.8'

services:
  %s:
    image: %s
    container_name: aldea-%s
    restart: unless-stopped
    ports:
      - "%d:%d"
    volumes:
      - ./data/%s:/data
    environment:
      - DOMAIN=%s.%s
      - NODE_DOMAIN=%s
`,
		svc.Name, svc.Name, svc.Replaces,
		svc.Subdomain, sh.NodeDomain, svc.DefaultPort,
		serviceID, getServiceImage(serviceID), serviceID,
		svc.DefaultPort, svc.DefaultPort,
		serviceID,
		svc.Subdomain, sh.NodeDomain, sh.NodeDomain,
	)

	// Generar README
	readmeContent := fmt.Sprintf(`# %s

## Que es
%s

## Que reemplaza
%s

## Para que sirve
%s

## Requisitos
- RAM minima: %d MB
- Disco minimo: %d GB
- Docker y Docker Compose instalados

## Instalacion

1. Copiar la carpeta a el servidor destino
2. Ejecutar:
   docker compose up -d
3. Acceder en:
   http://%s.%s:%d

## Configuracion con OpenWrt (opcional)

Si tienes OpenWrt instalado, registra el subdominio:
   %s.%s -> IPv6 del servidor

## Notas
- Los datos se guardan en ./data/ (no se pierden al reiniciar)
- Para detener: docker compose down
- Para ver logs: docker compose logs -f
`,
		svc.Name, svc.WhatIs, svc.Replaces, svc.UsedFor,
		svc.MinRAM, svc.MinDisk,
		svc.Subdomain, sh.NodeDomain, svc.DefaultPort,
		svc.Subdomain, sh.NodeDomain,
	)

	// Devolver como JSON (el frontend puede descargarlo)
	writeJSON(w, 200, map[string]interface{}{
		"success":        true,
		"service_id":     serviceID,
		"service_name":   svc.Name,
		"docker_compose": composeContent,
		"readme":         readmeContent,
		"subdomain":      fmt.Sprintf("%s.%s", svc.Subdomain, sh.NodeDomain),
		"instructions":   fmt.Sprintf("1. Guardar docker-compose.yml\n2. Ejecutar: docker compose up -d\n3. Acceder: http://%s.%s:%d", svc.Subdomain, sh.NodeDomain, svc.DefaultPort),
	})
}

// getServiceImage devuelve la imagen Docker para un servicio.
func getServiceImage(id string) string {
	images := map[string]string{
		"peertube":      "chocobozzz/peertube:production",
		"mastodon":      "tootsuite/mastodon:latest",
		"pixelfed":      "zknt/pixelfed:latest",
		"friendica":     "friendica/server:latest",
		"lemmy":         "lemmy/lemmy:latest",
		"bookwyrm":      "bookwyrm/bookwyrm:latest",
		"writefreely":   "writefreely/writefreely:latest",
		"mobilizon":     "framasoft/mobilizon:latest",
		"matrix":        "matrixdotorg/synapse:latest",
		"jitsi":         "jitsi/web:latest",
		"voip":          "tiredofit/asterisk:latest",
		"mumble":        "mumblevoip/mumble-server:latest",
		"nextcloud":     "nextcloud:latest",
		"collabora":     "collabora/code:latest",
		"bookstack":     "lscr.io/linuxserver/bookstack:latest",
		"mediawiki":     "mediawiki:latest",
		"jellyfin":      "jellyfin/jellyfin:latest",
		"funkwhale":     "funkwhale/all-in-one:latest",
		"gitea":         "gitea/gitea:latest",
		"bigbluebutton": "bigbluebutton/bigbluebutton:latest",
		"homeassistant": "homeassistant/home-assistant:latest",
		"vaultwarden":   "vaultwarden/server:latest",
	}
	if img, ok := images[id]; ok {
		return img
	}
	return "alpine:latest"
}

// === VoIP ===

// getVoIPConfig devuelve la configuracion VoIP.
func (sh *FederatedServicesHandler) getVoIPConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var villageCode int
	var villageName *string
	var enabled bool
	var serverPort, rtpStart, rtpEnd int
	err := sh.Pool.QueryRow(ctx, `
		SELECT village_code, village_name, enabled, server_port, rtp_start, rtp_end
		FROM voip_config ORDER BY id DESC LIMIT 1`,
	).Scan(&villageCode, &villageName, &enabled, &serverPort, &rtpStart, &rtpEnd)
	if err != nil {
		villageCode = 0
		enabled = false
		serverPort = 5060
		rtpStart = 10000
		rtpEnd = 20000
	}

	cfg := map[string]interface{}{
		"village_code": villageCode,
		"enabled":      enabled,
		"server_port":  serverPort,
		"rtp_start":    rtpStart,
		"rtp_end":      rtpEnd,
		"node_domain":  sh.NodeDomain,
	}
	if villageName != nil {
		cfg["village_name"] = *villageName
	}
	writeJSON(w, 200, cfg)
}

// generateVillageCode genera un codigo de aldea unico.
func (sh *FederatedServicesHandler) generateVillageCode(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Generar codigo entre 100 y 999 basado en hash del dominio
	// Esto garantiza que la misma aldea siempre tenga el mismo codigo
	hash := 0
	for _, c := range sh.NodeDomain {
		hash = hash*31 + int(c)
	}
	code := 100 + (hash%900+900)%900 // 100-999

	// Guardar
	_, err := sh.Pool.Exec(ctx, `
		UPDATE voip_config SET village_code = $1, enabled = true, updated_at = NOW()`, code)
	if err != nil {
		writeError(w, 500, "error al guardar codigo de aldea")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":      true,
		"village_code": code,
		"message":      fmt.Sprintf("Codigo de aldea generado: %d", code),
	})
}

// updateVoIPConfig actualiza la configuracion VoIP.
func (sh *FederatedServicesHandler) updateVoIPConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		VillageCode int    `json:"village_code"`
		VillageName string `json:"village_name"`
		Enabled     bool   `json:"enabled"`
		ServerPort  int    `json:"server_port"`
		RTPStart    int    `json:"rtp_start"`
		RTPEnd      int    `json:"rtp_end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.ServerPort == 0 {
		req.ServerPort = 5060
	}
	if req.RTPStart == 0 {
		req.RTPStart = 10000
	}
	if req.RTPEnd == 0 {
		req.RTPEnd = 20000
	}

	_, err := sh.Pool.Exec(ctx, `
		UPDATE voip_config SET village_code = $1, village_name = $2, enabled = $3,
		server_port = $4, rtp_start = $5, rtp_end = $6, updated_at = NOW()`,
		req.VillageCode, req.VillageName, req.Enabled, req.ServerPort, req.RTPStart, req.RTPEnd)
	if err != nil {
		writeError(w, 500, "error al actualizar configuracion VoIP")
		return
	}

	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// listExtensions lista las extensiones telefonicas.
func (sh *FederatedServicesHandler) listExtensions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT extension, display_name, user_id, is_active, created_at
		FROM voip_extensions ORDER BY extension`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"extensions": []interface{}{}})
		return
	}
	defer rows.Close()

	var exts []map[string]interface{}
	for rows.Next() {
		var ext, displayName *string
		var userID *string
		var isActive bool
		var createdAt time.Time
		_ = rows.Scan(&ext, &displayName, &userID, &isActive, &createdAt)
		item := map[string]interface{}{
			"is_active":  isActive,
			"created_at": createdAt,
		}
		if ext != nil {
			item["extension"] = *ext
		}
		if displayName != nil {
			item["display_name"] = *displayName
		}
		if userID != nil {
			item["user_id"] = *userID
		}
		exts = append(exts, item)
	}
	if exts == nil {
		exts = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"extensions": exts})
}

// createExtension crea una extension telefonica.
func (sh *FederatedServicesHandler) createExtension(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Extension   string `json:"extension"`
		DisplayName string `json:"display_name"`
		UserID      string `json:"user_id"`
		Password    string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.Extension == "" {
		writeError(w, 400, "extension es obligatoria")
		return
	}
	if req.Password == "" {
		req.Password = generateSecureToken(8)
	}

	_, err := sh.Pool.Exec(ctx, `
		INSERT INTO voip_extensions (extension, display_name, user_id, password, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, true, NOW(), NOW())
		ON CONFLICT (extension) DO UPDATE SET display_name = $2, user_id = $3, password = $4, updated_at = NOW()`,
		req.Extension, req.DisplayName, req.UserID, req.Password)
	if err != nil {
		writeError(w, 500, "error al crear extension")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":   true,
		"extension": req.Extension,
		"password":  req.Password,
		"message":   fmt.Sprintf("Extension %s creada. Password SIP: %s", req.Extension, req.Password),
	})
}

// deleteExtension elimina una extension.
func (sh *FederatedServicesHandler) deleteExtension(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ext := chi.URLParam(r, "ext")
	_, err := sh.Pool.Exec(ctx, `DELETE FROM voip_extensions WHERE extension = $1`, ext)
	if err != nil {
		writeError(w, 500, "error al eliminar extension")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// listRoutes lista las rutas VoIP federadas.
func (sh *FederatedServicesHandler) listRoutes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT remote_village_code, remote_village_name, remote_endpoint, remote_domain, is_active, created_at
		FROM voip_routes ORDER BY remote_village_code`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"routes": []interface{}{}})
		return
	}
	defer rows.Close()

	var routes []map[string]interface{}
	for rows.Next() {
		var code int
		var name, endpoint, domain *string
		var isActive bool
		var createdAt time.Time
		_ = rows.Scan(&code, &name, &endpoint, &domain, &isActive, &createdAt)
		route := map[string]interface{}{
			"remote_village_code": code,
			"is_active":           isActive,
			"created_at":          createdAt,
		}
		if name != nil {
			route["remote_village_name"] = *name
		}
		if endpoint != nil {
			route["remote_endpoint"] = *endpoint
		}
		if domain != nil {
			route["remote_domain"] = *domain
		}
		routes = append(routes, route)
	}
	if routes == nil {
		routes = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"routes": routes})
}

// createRoute crea una ruta VoIP a otra aldea.
func (sh *FederatedServicesHandler) createRoute(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		RemoteVillageCode int    `json:"remote_village_code"`
		RemoteVillageName string `json:"remote_village_name"`
		RemoteEndpoint    string `json:"remote_endpoint"`
		RemoteDomain      string `json:"remote_domain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.RemoteVillageCode == 0 {
		writeError(w, 400, "remote_village_code es obligatorio")
		return
	}

	_, err := sh.Pool.Exec(ctx, `
		INSERT INTO voip_routes (remote_village_code, remote_village_name, remote_endpoint, remote_domain, is_active, created_at)
		VALUES ($1, $2, $3, $4, true, NOW())
		ON CONFLICT (remote_village_code) DO UPDATE SET remote_village_name = $2, remote_endpoint = $3, remote_domain = $4`,
		req.RemoteVillageCode, req.RemoteVillageName, req.RemoteEndpoint, req.RemoteDomain)
	if err != nil {
		writeError(w, 500, "error al crear ruta")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":             true,
		"remote_village_code": req.RemoteVillageCode,
		"message":             fmt.Sprintf("Ruta a aldea %d creada. Para llamar: marca %d + extension", req.RemoteVillageCode, req.RemoteVillageCode),
	})
}

// deleteRoute elimina una ruta VoIP.
func (sh *FederatedServicesHandler) deleteRoute(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	code := chi.URLParam(r, "code")
	_, err := sh.Pool.Exec(ctx, `DELETE FROM voip_routes WHERE remote_village_code = $1`, code)
	if err != nil {
		writeError(w, 500, "error al eliminar ruta")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// === Pasarelas PSTN (llamadas a telefonos normales) ===

// listPSTNGateways lista las pasarelas PSTN configuradas.
func (sh *FederatedServicesHandler) listPSTNGateways(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT id, name, provider, sip_server, sip_username, inbound_number,
		       is_active, max_concurrent_calls, cost_per_minute, billing_increment, created_at
		FROM voip_pstn_gateways ORDER BY created_at DESC`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"gateways": []interface{}{}})
		return
	}
	defer rows.Close()

	var gateways []map[string]interface{}
	for rows.Next() {
		var id int
		var name, sipServer, sipUsername string
		var provider, inboundNumber *string
		var isActive bool
		var maxConcurrent int
		var costPerMinute float64
		var billingIncrement int
		var createdAt time.Time
		_ = rows.Scan(&id, &name, &provider, &sipServer, &sipUsername, &inboundNumber,
			&isActive, &maxConcurrent, &costPerMinute, &billingIncrement, &createdAt)
		gw := map[string]interface{}{
			"id":                   id,
			"name":                 name,
			"sip_server":           sipServer,
			"sip_username":         sipUsername,
			"is_active":            isActive,
			"max_concurrent_calls": maxConcurrent,
			"cost_per_minute":      costPerMinute,
			"billing_increment":    billingIncrement,
			"created_at":           createdAt,
		}
		if provider != nil {
			gw["provider"] = *provider
		}
		if inboundNumber != nil {
			gw["inbound_number"] = *inboundNumber
		}
		gateways = append(gateways, gw)
	}
	if gateways == nil {
		gateways = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"gateways": gateways})
}

// createPSTNGateway crea una pasarela PSTN.
func (sh *FederatedServicesHandler) createPSTNGateway(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Name               string  `json:"name"`
		Provider           string  `json:"provider"`
		SipServer          string  `json:"sip_server"`
		SipUsername        string  `json:"sip_username"`
		SipPassword        string  `json:"sip_password"`
		InboundNumber      string  `json:"inbound_number"`
		MaxConcurrentCalls int     `json:"max_concurrent_calls"`
		CostPerMinute      float64 `json:"cost_per_minute"`
		BillingIncrement   int     `json:"billing_increment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.Name == "" || req.SipServer == "" || req.SipUsername == "" || req.SipPassword == "" {
		writeError(w, 400, "name, sip_server, sip_username y sip_password son obligatorios")
		return
	}
	if req.MaxConcurrentCalls == 0 {
		req.MaxConcurrentCalls = 2
	}
	if req.BillingIncrement == 0 {
		req.BillingIncrement = 60
	}

	var id int
	err := sh.Pool.QueryRow(ctx, `
		INSERT INTO voip_pstn_gateways (name, provider, sip_server, sip_username, sip_password,
			inbound_number, is_active, max_concurrent_calls, cost_per_minute, billing_increment, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, NOW(), NOW())
		RETURNING id`,
		req.Name, req.Provider, req.SipServer, req.SipUsername, req.SipPassword,
		req.InboundNumber, req.MaxConcurrentCalls, req.CostPerMinute, req.BillingIncrement).Scan(&id)
	if err != nil {
		writeError(w, 500, "error al crear pasarela PSTN")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"id":      id,
		"message": "Pasarela PSTN creada. Las llamadas externas usaran esta pasarela.",
	})
}

// deletePSTNGateway elimina una pasarela PSTN.
func (sh *FederatedServicesHandler) deletePSTNGateway(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	_, err := sh.Pool.Exec(ctx, `DELETE FROM voip_pstn_gateways WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, "error al eliminar pasarela")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

// === Saldo prepago VoIP ===

// getVoIPBalance obtiene el saldo VoIP del usuario actual.
func (sh *FederatedServicesHandler) getVoIPBalance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var balance, totalRecharged, totalSpent int64
	err = sh.Pool.QueryRow(ctx, `
		SELECT balance, total_recharged, total_spent FROM voip_balance WHERE user_id = $1`,
		userID).Scan(&balance, &totalRecharged, &totalSpent)
	if err != nil {
		balance = 0
		totalRecharged = 0
		totalSpent = 0
	}

	writeJSON(w, 200, map[string]interface{}{
		"balance":         balance,
		"total_recharged": totalRecharged,
		"total_spent":     totalSpent,
		"balance_display": fmt.Sprintf("%d.%02d TQ", balance/100, balance%100),
	})
}

// rechargeVoIP recarga saldo VoIP (solicita recarga, admin confirma).
func (sh *FederatedServicesHandler) rechargeVoIP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		Amount        int64  `json:"amount"` // en centavos de TQ
		PaymentMethod string `json:"payment_method"`
		Reference     string `json:"reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request")
		return
	}
	if req.Amount <= 0 {
		writeError(w, 400, "amount debe ser positivo")
		return
	}

	var id int
	err = sh.Pool.QueryRow(ctx, `
		INSERT INTO voip_recharges (user_id, amount, payment_method, reference, status, created_at)
		VALUES ($1, $2, $3, $4, 'pending', NOW())
		RETURNING id`,
		userID, req.Amount, req.PaymentMethod, req.Reference).Scan(&id)
	if err != nil {
		writeError(w, 500, "error al crear recarga")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"id":      id,
		"message": "Recarga solicitada. Un administrador debe confirmarla.",
		"status":  "pending",
	})
}

// confirmRecharge confirma una recarga (solo admin).
func (sh *FederatedServicesHandler) confirmRecharge(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	adminID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	rechargeID := chi.URLParam(r, "id")

	// Obtener monto y user_id de la recarga
	var userID uuid.UUID
	var amount int64
	err = sh.Pool.QueryRow(ctx, `SELECT user_id, amount FROM voip_recharges WHERE id = $1 AND status = 'pending'`, rechargeID).Scan(&userID, &amount)
	if err != nil {
		writeError(w, 404, "recarga no encontrada o ya procesada")
		return
	}

	// Actualizar recarga
	_, err = sh.Pool.Exec(ctx, `UPDATE voip_recharges SET status = 'confirmed', processed_by = $1, confirmed_at = NOW() WHERE id = $2`, adminID, rechargeID)
	if err != nil {
		writeError(w, 500, "error al confirmar recarga")
		return
	}

	// Actualizar saldo
	_, err = sh.Pool.Exec(ctx, `
		INSERT INTO voip_balance (user_id, balance, total_recharged, total_spent, updated_at)
		VALUES ($1, $2, $2, 0, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			balance = voip_balance.balance + $2,
			total_recharged = voip_balance.total_recharged + $2,
			updated_at = NOW()`,
		userID, amount)
	if err != nil {
		writeError(w, 500, "error al actualizar saldo")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Recarga confirmada. Saldo actualizado en +%d.%02d TQ", amount/100, amount%100),
	})
}

// listRecharges lista las recargas (admin ve todas, usuario ve las suyas).
func (sh *FederatedServicesHandler) listRecharges(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT r.id, r.user_id, r.amount, r.payment_method, r.reference, r.status, r.created_at, r.confirmed_at,
		       COALESCE(u.display_name, u.username, '') as user_name
		FROM voip_recharges r
		JOIN users u ON u.id = r.user_id
		ORDER BY r.created_at DESC LIMIT 100`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"recharges": []interface{}{}})
		return
	}
	defer rows.Close()

	var recharges []map[string]interface{}
	for rows.Next() {
		var id int
		var amount int64
		var userID uuid.UUID
		var userName, status string
		var paymentMethod, reference *string
		var createdAt time.Time
		var confirmedAt *time.Time
		_ = rows.Scan(&id, &userID, &amount, &paymentMethod, &reference, &status, &createdAt, &confirmedAt, &userName)
		rc := map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"user_name":  userName,
			"amount":     amount,
			"status":     status,
			"created_at": createdAt,
		}
		if paymentMethod != nil {
			rc["payment_method"] = *paymentMethod
		}
		if reference != nil {
			rc["reference"] = *reference
		}
		if confirmedAt != nil {
			rc["confirmed_at"] = *confirmedAt
		}
		recharges = append(recharges, rc)
	}
	if recharges == nil {
		recharges = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"recharges": recharges})
}

// === Registro de llamadas (CDR) ===

// listCDR lista el registro de llamadas.
func (sh *FederatedServicesHandler) listCDR(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT c.id, c.call_id, c.source_extension, c.destination, c.destination_type,
		       c.remote_node_number, c.start_time, c.end_time, c.duration, c.billed_duration,
		       c.cost, c.status, c.direction,
		       COALESCE(u.display_name, u.username, '') as user_name
		FROM voip_cdr c
		LEFT JOIN users u ON u.id = c.user_id
		ORDER BY c.start_time DESC LIMIT 200`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"calls": []interface{}{}})
		return
	}
	defer rows.Close()

	var calls []map[string]interface{}
	for rows.Next() {
		var id int
		var destination, destType, status, direction string
		var sourceExt *string
		var remoteNode *int
		var duration, billedDuration int
		var cost int64
		var startTime time.Time
		var endTime *time.Time
		var callID *string
		var userName string
		_ = rows.Scan(&id, &callID, &sourceExt, &destination, &destType, &remoteNode,
			&startTime, &endTime, &duration, &billedDuration, &cost, &status, &direction, &userName)
		call := map[string]interface{}{
			"id":               id,
			"destination":      destination,
			"destination_type": destType,
			"duration":         duration,
			"billed_duration":  billedDuration,
			"cost":             cost,
			"cost_display":     fmt.Sprintf("%d.%02d TQ", cost/100, cost%100),
			"status":           status,
			"direction":        direction,
			"start_time":       startTime,
			"user_name":        userName,
		}
		if sourceExt != nil {
			call["source_extension"] = *sourceExt
		}
		if remoteNode != nil {
			call["remote_node_number"] = *remoteNode
		}
		if endTime != nil {
			call["end_time"] = *endTime
		}
		if callID != nil {
			call["call_id"] = *callID
		}
		calls = append(calls, call)
	}
	if calls == nil {
		calls = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"calls": calls})
}

// === Tarifas VoIP ===

// listRates lista las tarifas por destino.
func (sh *FederatedServicesHandler) listRates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := sh.Pool.Query(ctx, `
		SELECT id, prefix, description, rate_per_minute, billing_increment, is_active
		FROM voip_rates ORDER BY prefix`)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"rates": []interface{}{}})
		return
	}
	defer rows.Close()

	var rates []map[string]interface{}
	for rows.Next() {
		var id int
		var prefix, description string
		var ratePerMinute int64
		var billingIncrement int
		var isActive bool
		_ = rows.Scan(&id, &prefix, &description, &ratePerMinute, &billingIncrement, &isActive)
		rates = append(rates, map[string]interface{}{
			"id":                id,
			"prefix":            prefix,
			"description":       description,
			"rate_per_minute":   ratePerMinute,
			"rate_display":      fmt.Sprintf("%d.%02d TQ/min", ratePerMinute/100, ratePerMinute%100),
			"billing_increment": billingIncrement,
			"is_active":         isActive,
		})
	}
	if rates == nil {
		rates = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"rates": rates})
}

// === Numero de nodo ===

// getNodeNumber obtiene el numero del nodo.
func (sh *FederatedServicesHandler) getNodeNumber(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var nodeNumber *int
	_ = sh.Pool.QueryRow(ctx, `SELECT node_number FROM node_config LIMIT 1`).Scan(&nodeNumber)

	result := map[string]interface{}{
		"node_domain": sh.NodeDomain,
	}
	if nodeNumber != nil {
		result["node_number"] = *nodeNumber
	} else {
		result["node_number"] = 0
	}
	writeJSON(w, 200, result)
}

// generateNodeNumber genera un numero unico para el nodo.
func (sh *FederatedServicesHandler) generateNodeNumber(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Generar numero entre 100 y 999 basado en hash del dominio
	// Esto garantiza que el mismo nodo siempre tenga el mismo numero
	hash := 0
	for _, c := range sh.NodeDomain {
		hash = hash*31 + int(c)
	}
	number := 100 + (hash%900+900)%900 // 100-999

	// Guardar en node_config
	_, err := sh.Pool.Exec(ctx, `UPDATE node_config SET node_number = $1, updated_at = NOW()`, number)
	if err != nil {
		writeError(w, 500, "error al guardar numero de nodo")
		return
	}

	// Tambien guardar en voip_config para compatibilidad
	_, _ = sh.Pool.Exec(ctx, `UPDATE voip_config SET village_code = $1, enabled = true, updated_at = NOW()`, number)

	writeJSON(w, 200, map[string]interface{}{
		"success":     true,
		"node_number": number,
		"message":     fmt.Sprintf("Numero de nodo generado: %d. Este numero se comparte con otros nodos para SIP/VoIP.", number),
	})
}

// autoConfigureSIPRoutes configura automaticamente las rutas SIP a todos los nodos federados.
func (sh *FederatedServicesHandler) autoConfigureSIPRoutes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Obtener todos los peers federados con su numero de nodo
	rows, err := sh.Pool.Query(ctx, `
		SELECT peer_domain, peer_name, peer_node_number, peer_endpoint
		FROM node_federation_keys
		WHERE status = 'active' AND peer_node_number IS NOT NULL`)
	if err != nil {
		writeError(w, 500, "error al obtener peers federados")
		return
	}
	defer rows.Close()

	configured := 0
	for rows.Next() {
		var peerDomain string
		var peerName *string
		var peerNodeNumber int
		var peerEndpoint *string
		_ = rows.Scan(&peerDomain, &peerName, &peerNodeNumber, &peerEndpoint)

		// Construir endpoint SIP
		sipEndpoint := peerDomain
		if peerEndpoint != nil && *peerEndpoint != "" {
			sipEndpoint = *peerEndpoint
		}

		// Insertar o actualizar ruta VoIP
		name := peerDomain
		if peerName != nil {
			name = *peerName
		}
		_, err := sh.Pool.Exec(ctx, `
			INSERT INTO voip_routes (remote_village_code, remote_village_name, remote_endpoint, remote_domain, is_active, created_at)
			VALUES ($1, $2, $3, $4, true, NOW())
			ON CONFLICT (remote_village_code) DO UPDATE SET
				remote_village_name = $2, remote_endpoint = $3, remote_domain = $4`,
			peerNodeNumber, name, sipEndpoint, peerDomain)
		if err == nil {
			configured++
		}
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":    true,
		"configured": configured,
		"message":    fmt.Sprintf("Configuradas %d rutas SIP automaticamente desde nodos federados", configured),
	})
}
