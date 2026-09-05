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
	// === Federated Social Networks ===
	{
		ID: "peertube", Name: "PeerTube", Category: "social", Icon: "Video",
		WhatIs:   "Video platform where anyone can upload, watch and share videos. Videos are stored on your community's server, not on corporate servers. Communities can federate and share videos between them.",
		Replaces: "YouTube",
		UsedFor:  "Upload community videos, farming tutorials, recorded assemblies, educational documentaries, local music. No ads, no algorithms deciding what to watch, no data collection.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 2048, MinDisk: 50, DefaultPort: 9000, Subdomain: "video",
	},
	{
		ID: "mastodon", Name: "Mastodon", Category: "social", Icon: "MessageCircle",
		WhatIs:   "Short-message social network (up to 500 characters). Each community has its own server. Members post messages, follow others, reply. Federated communities can see and reply to each other's messages.",
		Replaces: "Twitter / X",
		UsedFor:  "Quick community communication, announcements, debates, following news from other communities. No ads, no algorithms, no corporate surveillance.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 2048, MinDisk: 20, DefaultPort: 3000, Subdomain: "social",
	},
	{
		ID: "pixelfed", Name: "Pixelfed", Category: "social", Icon: "Image",
		WhatIs:   "Photo-sharing social network. Upload photos, share them, follow others, 'like' posts. Similar to Instagram but without ads or surveillance. Federated communities can share photos between them.",
		Replaces: "Instagram",
		UsedFor:  "Share community photos, harvests, workshops, events, landscapes. No filters altering your images, no ads, no data collection.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 20, DefaultPort: 8080, Subdomain: "fotos",
	},
	{
		ID: "friendica", Name: "Friendica", Category: "social", Icon: "Users",
		WhatIs:   "Full-featured social network with profiles, groups, events, private messages, forums. More similar to a traditional social network. Can connect with Mastodon, Diaspora and other networks. Federated communities share content between them.",
		Replaces: "Facebook",
		UsedFor:  "Create community groups (e.g. 'Farmers Group', 'Women's Group'), organize events, longer discussions than Mastodon, private messages. No ads, no surveillance, no selling your data.",
		Protocol: "ActivityPub/DFN", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 80, Subdomain: "red",
	},
	{
		ID: "lemmy", Name: "Lemmy", Category: "social", Icon: "MessageSquare",
		WhatIs:   "Forum and discussion platform where people post links, ask questions, reply, and vote on the best answers. Topics are organized into 'communities' (e.g. 'agriculture', 'construction', 'health'). Federated communities share forums between them.",
		Replaces: "Reddit",
		UsedFor:  "Topic-based discussion forums, Q&A, sharing technical knowledge. The community votes on how useful each answer is. No ads, no companies manipulating what you see.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 1236, Subdomain: "foro",
	},
	{
		ID: "bookwyrm", Name: "BookWyrm", Category: "social", Icon: "BookOpen",
		WhatIs:   "Social network for book lovers. Track books you read, rate them, write reviews, create reading lists, and discover books others recommend. Federated communities share reviews between them.",
		Replaces: "Goodreads (website where people track books read and rate them)",
		UsedFor:  "The community library can track available books. Members can recommend books, create reading clubs, discover what to read. Without Amazon (owner of Goodreads) tracking your reading habits.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 5, DefaultPort: 8000, Subdomain: "libros",
	},
	{
		ID: "writefreely", Name: "WriteFreely", Category: "social", Icon: "PenTool",
		WhatIs:   "Minimalist blogging platform for writing and publishing articles, essays, stories, tutorials. No distractions, focused on writing. Blogs can be federated with other communities.",
		Replaces: "Medium, Blogger, WordPress.com",
		UsedFor:  "Write long-form articles, manuals, community stories, reflections, tutorials. Publish without ads, without pop-ups, without companies monetizing your content.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 8080, Subdomain: "blog",
	},
	{
		ID: "mobilizon", Name: "Mobilizon", Category: "social", Icon: "Calendar",
		WhatIs:   "Platform for creating and managing events. Create an event, set date, location, description, and people register. Similar to Facebook Events but without Facebook.",
		Replaces: "Facebook Events, Eventbrite",
		UsedFor:  "Organize assemblies, workshops, parties, work bees, meetings. People register without needing Facebook. Federated communities can see events from other communities.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 4000, Subdomain: "eventos",
	},

	// === Communication ===
	{
		ID: "matrix", Name: "Matrix (Synapse)", Category: "communication", Icon: "MessageSquare",
		WhatIs:   "Decentralized messaging system. Each community has its own messaging server. Members chat in groups or privately, send files, make voice and video calls. Federated communities can chat with each other.",
		Replaces: "WhatsApp, Telegram, Signal",
		UsedFor:  "Private community messaging, work groups, coordination, document sharing. Without Meta (owner of WhatsApp) reading your messages or selling your data. Your messages stay on your community's server.",
		Protocol: "Matrix", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 8008, Subdomain: "chat",
	},
	{
		ID: "jitsi", Name: "Jitsi Meet", Category: "communication", Icon: "Video",
		WhatIs:   "Videoconferencing platform. Create a room, share the link, and people join from their browser. No installation needed. Supports screen sharing, recording, chat.",
		Replaces: "Zoom, Google Meet, Microsoft Teams",
		UsedFor:  "Virtual assembly meetings, online workshops, distance education, meetings with other communities. No time limits, no subscription fees, no Zoom recording your meetings.",
		Protocol: "XMPP", Docker: true, MinRAM: 2048, MinDisk: 10, DefaultPort: 443, Subdomain: "reuniones",
	},
	{
		ID: "voip", Name: "Asterisk + FreePBX (VoIP Telephony)", Category: "communication", Icon: "Phone",
		WhatIs:   "Complete telephone system for the community. Each member has a phone extension number (e.g. 2001, 2002). Internal calls are free. With a unique community code, members can call other federated communities by dialing the community code + number.",
		Replaces: "Traditional phone lines (phone company)",
		UsedFor:  "Internal community phones without paying monthly fees to a phone company. Free calls between federated communities over the intranet. Each community has its unique code (e.g. community 101, community 102). To call from community 101 to 102, dial 102-2001. Works with IP phones, analog phones with adapter, or mobile apps.",
		Protocol: "SIP/RTP", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 5060, Subdomain: "voip",
	},
	{
		ID: "sylk", Name: "Sylk Suite (Blink + SylkServer)", Category: "communication", Icon: "MessageCircle",
		WhatIs:   "Complete real-time communication suite based on open SIP and MSRP standards. Includes individual and group chat messaging, file and image sharing, voice and video calls, multi-party videoconferencing, screen sharing and push notifications. The Sylk client is available for Android, iOS, Windows, macOS and Linux. Also works from the web browser. End-to-end encryption with zRTP for audio/video and OpenPGP for messages. Connects to the server by entering the node domain and the client auto-configures.",
		Replaces: "WhatsApp, Telegram, Signal, Zoom, Google Meet, Microsoft Teams (messaging + calls + video in one app)",
		UsedFor:  "Federated messaging, calls and videoconferencing between communities. Each member installs Sylk on their phone or computer, enters the node domain and connects automatically. Federated communities can call and message each other like email: sip:user@community-a.com calls sip:friend@community-b.com. Group rooms support chat, files, audio, video and screen sharing. Works with DNS SRV to automatically resolve the destination server address.",
		Protocol: "SIP/MSRP/WebRTC", Docker: true, MinRAM: 1024, MinDisk: 10, DefaultPort: 5060, Subdomain: "sylk",
	},
	{
		ID: "mumble", Name: "Mumble", Category: "communication", Icon: "Mic",
		WhatIs:   "Low-latency group voice chat. Create a channel, people join, and talk like in a group call but with better quality and lower resource usage. Similar to Discord but without ads or surveillance.",
		Replaces: "Discord (voice channel), TeamSpeak",
		UsedFor:  "Real-time voice communication for field work, coordinating work bees, community radio. Works well with slow internet. No ads, no companies listening.",
		Protocol: "Mumble", Docker: true, MinRAM: 256, MinDisk: 1, DefaultPort: 64738, Subdomain: "voz",
	},
	{
		ID: "mailu", Name: "Mailu (Lightweight Mail Server)", Category: "communication", Icon: "Mail",
		WhatIs:   "Complete 100% free mail server (MIT license, no restrictions). All-in-one: SMTP for sending, IMAP for receiving, web admin panel for creating mailboxes and domains, and integrated webmail for reading email from the browser. Includes antispam, antivirus, automatic SSL certificates with Let's Encrypt and federation between mail servers. Each member has their email with the node domain (e.g. maria@my-community.com). Only needs 1-2 GB RAM. Ideal for nodes with limited hardware.",
		Replaces: "Gmail, Outlook, Yahoo Mail, ProtonMail (complete mail server)",
		UsedFor:  "Community's own email. Each member has their @your-domain address. Send and receive emails from anywhere in the world. Automatic federation with other mail servers via SMTP. Webmail to read from browser without installing anything. Admin panel to create accounts, configure storage quotas per user, define domains and aliases. Client configuration: IMAP (port 993 SSL), SMTP (port 587 STARTTLS), server: mail.your-domain. Email clients like Thunderbird, K-9 Mail (Android), Mail (iOS) auto-configure via Autoconfig/Autodiscover.",
		Protocol: "SMTP/IMAP/POP3", Docker: true, MinRAM: 1024, MinDisk: 20, DefaultPort: 25, Subdomain: "correo",
	},
	{
		ID: "mailcow", Name: "Mailcow (Complete Mail Server)", Category: "communication", Icon: "Mail",
		WhatIs:   "Production-ready complete mail suite packaged in Docker Compose. Includes SOGo (modern webmail with shared calendar and CardDAV/CalDAV contacts), web admin panel for creating mailboxes, domains and automatic SSL certificates. More complete than Mailu but requires more resources (3-4 GB RAM). Ideal for installing on a dedicated server or another node with more hardware. Includes antispam (Rspamd), antivirus (ClamAV), calendar and contact sync between devices.",
		Replaces: "Gmail (calendar + contacts + email), Outlook 365, Zoho Mail (complete suite with groupware)",
		UsedFor:  "Complete email with groupware: email, shared calendar, contacts synced between devices, tasks. Each member has their @your-domain address. Admin panel to create accounts, configure storage quotas per user, define domains, aliases and filters. Client configuration: IMAP (port 993 SSL), SMTP (port 587 STARTTLS), CalDAV/CardDAV for calendar and contacts. Auto-configuration via Autodiscover. Recommended for installing on a server with more RAM (can be another node or dedicated server).",
		Protocol: "SMTP/IMAP/POP3/CalDAV/CardDAV", Docker: true, MinRAM: 3072, MinDisk: 30, DefaultPort: 25, Subdomain: "correo",
	},
	{
		ID: "deltachat", Name: "Delta Chat (Chat Client over Email)", Category: "communication", Icon: "MessageCircle",
		WhatIs:   "Instant messaging CLIENT (not a server) that works 100% over standard email servers. The app looks and works exactly like WhatsApp or Telegram, but sends and receives messages through email accounts. Auditable end-to-end encryption. Clients for Android, iOS, Windows, macOS and Linux. REQUIRES a mail server (like Mailu or Mailcow) to work: it has no server of its own. Installed on each member's phone or computer, not on the node server.",
		Replaces: "WhatsApp, Telegram, Signal (federated instant messaging via email)",
		UsedFor:  "Community chat that looks like WhatsApp but without corporations. Messages, photos, files, groups, P2P voice calls. Automatic federation: user@community-a.com chats with friend@community-b.com like regular email. Multi-device. Push notifications. Zero private data on server. To use: 1) Install Mailu or Mailcow on the node. 2) Create an email account for each member. 3) Each member installs Delta Chat on their phone. 4) In Delta Chat, enter their email@your-domain and password. 5) Delta Chat auto-connects to the node's IMAP/SMTP server. No manual server configuration needed.",
		Protocol: "IMAP/SMTP (chat client over email)", Docker: false, MinRAM: 0, MinDisk: 0, DefaultPort: 0, Subdomain: "chat",
	},
	{
		ID: "snappymail", Name: "SnappyMail (Webmail)", Category: "communication", Icon: "Mail",
		WhatIs:   "Fast and modern webmail client for reading email from the browser. Gmail-style interface, mobile-friendly. Connects to any IMAP/SMTP server (like Mailu or Mailcow). Supports multiple accounts, filters, search, contacts and calendar. Lightweight and fast. Not a server: it's the web interface members use to read email without installing an app.",
		Replaces: "Gmail (web interface), Outlook Web (web email interface)",
		UsedFor:  "Give members a web interface to read and write emails without installing any software. Open from browser on phone or computer at webmail.your-domain. Ideal for members who don't want to install an email app. Connects to the node's mail server (Mailu or Mailcow). Configuration: admin sets up IMAP/SMTP connection to the node's mail server. Users just log in with their email@your-domain and password.",
		Protocol: "IMAP/SMTP (web client)", Docker: true, MinRAM: 128, MinDisk: 1, DefaultPort: 8888, Subdomain: "webmail",
	},

	// === Productivity and Files ===
	{
		ID: "nextcloud", Name: "Nextcloud", Category: "productivity", Icon: "Cloud",
		WhatIs:   "Cloud file storage. Each member has a private folder for documents, photos, videos. Folders can be shared with others. Includes calendar, contacts, tasks. Everything stored on the community's server.",
		Replaces: "Google Drive, Dropbox, iCloud, OneDrive",
		UsedFor:  "Store community documents, share files between members, community calendar, contacts. No monthly subscription, no Google or Apple accessing your files. Your data stays in the community.",
		Protocol: "WebDAV", Docker: true, MinRAM: 512, MinDisk: 50, DefaultPort: 80, Subdomain: "archivos",
	},
	{
		ID: "collabora", Name: "Collabora / Nextcloud Office", Category: "productivity", Icon: "FileText",
		WhatIs:   "Office suite in the browser. Create and edit text documents, spreadsheets, presentations. Real-time collaborative editing (multiple people editing the same document at once). Integrates with Nextcloud.",
		Replaces: "Google Docs, Google Sheets, Google Slides, Microsoft Office Online",
		UsedFor:  "Write assembly documents, maintain accounting spreadsheets, create workshop presentations. Collaborative work without Google or Microsoft monitoring your content.",
		Protocol: "WOPISrc", Docker: true, MinRAM: 1024, MinDisk: 5, DefaultPort: 9980, Subdomain: "docs",
	},
	{
		ID: "bookstack", Name: "BookStack", Category: "productivity", Icon: "BookMarked",
		WhatIs:   "Documentation and wiki platform organized as books, chapters and pages. Easy to use, no technical knowledge required. Integrated search, permission control.",
		Replaces: "Confluence, Notion (for documentation)",
		UsedFor:  "Community manual, recipe collections, growing guides, procedures, regulations. Organize community knowledge in one place. Easy to search and update.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 80, Subdomain: "wiki",
	},
	{
		ID: "mediawiki", Name: "MediaWiki", Category: "productivity", Icon: "Globe",
		WhatIs:   "Wiki software, the same one used by Wikipedia. Anyone can create and edit pages. Change history, discussions, categories.",
		Replaces: "Wikipedia (for internal community knowledge)",
		UsedFor:  "Internal community encyclopedia, collaborative documentation, knowledge base. Everyone can contribute. Like Wikipedia but for your community.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 80, Subdomain: "enciclopedia",
	},

	// === Multimedia ===
	{
		ID: "jellyfin", Name: "Jellyfin", Category: "multimedia", Icon: "Film",
		WhatIs:   "Media server. Store movies, series, music, photos on the server and stream them to any device (TV, phone, computer). No ads, no subscription.",
		Replaces: "Netflix, Spotify, Plex",
		UsedFor:  "Community cinema, music library, educational films, documentaries. Each member can watch what they want when they want. No Netflix fees, no ads, no algorithms.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 50, DefaultPort: 8096, Subdomain: "cine",
	},
	{
		ID: "funkwhale", Name: "Funkwhale", Category: "multimedia", Icon: "Music",
		WhatIs:   "Federated music platform. Upload music, create playlists, follow artists. Federated communities can share music between them. Similar to Spotify but without ads or corporations.",
		Replaces: "Spotify, SoundCloud",
		UsedFor:  "Share community music, local artists, podcasts, assembly recordings. Discover music from other communities. No ads, no algorithms, no companies monetizing your listening.",
		Protocol: "ActivityPub", Docker: true, MinRAM: 1024, MinDisk: 20, DefaultPort: 5000, Subdomain: "musica",
	},

	// === Development and Other ===
	{
		ID: "gitea", Name: "Gitea / Forgejo", Category: "development", Icon: "GitBranch",
		WhatIs:   "Source code management platform. Host git repositories, version control, issues, pull requests. Similar to GitHub but on your own server.",
		Replaces: "GitHub, GitLab",
		UsedFor:  "If anyone in the community codes, they can host their code here. Also for versioning important documents, configurations, technical manuals. Without depending on GitHub (Microsoft-owned).",
		Protocol: "Git", Docker: true, MinRAM: 256, MinDisk: 10, DefaultPort: 3000, Subdomain: "codigo",
	},
	{
		ID: "bigbluebutton", Name: "BigBlueButton", Category: "development", Icon: "GraduationCap",
		WhatIs:   "Virtual education platform with whiteboard, presentations, video, chat, breakout groups. Designed for online teaching.",
		Replaces: "Zoom (for education), Google Classroom",
		UsedFor:  "Virtual classes for the community school, online workshops, training. Shared whiteboard, presentations, class recording. No Zoom fees, no Google surveillance.",
		Protocol: "Web", Docker: true, MinRAM: 4096, MinDisk: 20, DefaultPort: 80, Subdomain: "clases",
	},
	{
		ID: "homeassistant", Name: "Home Assistant", Category: "development", Icon: "Home",
		WhatIs:   "Home automation platform. Connects smart devices (lights, sensors, locks, solar energy, water pumps) and controls them from one place. Works without Internet.",
		Replaces: "Google Home, Amazon Alexa, SmartThings",
		UsedFor:  "Automate lights, monitor solar energy, control water pumps, temperature sensors, security. Without Google or Amazon accessing your home. Everything processed locally.",
		Protocol: "Web", Docker: true, MinRAM: 512, MinDisk: 5, DefaultPort: 8123, Subdomain: "casa",
	},
	{
		ID: "vaultwarden", Name: "Vaultwarden (Bitwarden)", Category: "development", Icon: "Lock",
		WhatIs:   "Password manager. Stores all your passwords encrypted on the community's server. Auto-fills passwords in the browser. Generates strong passwords.",
		Replaces: "LastPass, 1Password, Dashlane, Google/Apple password manager",
		UsedFor:  "Give each member a secure place for their passwords. No more passwords on paper or reused. Syncs between devices. Without third-party companies having your passwords.",
		Protocol: "Web", Docker: true, MinRAM: 128, MinDisk: 1, DefaultPort: 80, Subdomain: "claves",
	},
	// === Point of Sale (POS) - NODE TOOL ===
	{
		ID: "pos-web", Name: "Web Point of Sale", Category: "productivity", Icon: "ShoppingBag",
		WhatIs:   "Point of sale terminal for charging with TQ (the federated exchange network currency). Downloads and installs from this node and auto-configures with this node's address. Can charge members from ANY federated node: if someone from another federated community visits your location, they can pay with their NFC card or by scanning the QR. This is not a generic POS: it doesn't work for charging with traditional money, bank cards, cryptocurrencies or any other external system. It only processes TQ between federated nodes. Installs as a web app (PWA) on any device: phone, tablet or PC. Registers as an NFC terminal of the node, with Ed25519 cryptographic keys and device fingerprint.",
		Replaces: "Commercial POS terminals (TQ only, not for traditional money)",
		UsedFor:  "Charge sales with TQ. The merchant enters the amount in TQ, the customer pays by scanning a QR with their phone or tapping their NFC card. The customer can be from this node or any federated node. Organizations can assign terminals to members, view shifts (who used the terminal and when), sales by user and all transactions. IMPORTANT: This POS only processes TQ. It does not process real money, bank cards or cryptocurrencies. Downloads from each node and configures with that node's address, but accepts payments from any federated node.",
		Protocol: "Web/PWA", Docker: true, MinRAM: 128, MinDisk: 1, DefaultPort: 3001, Subdomain: "pos",
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
		r.With(am.RequirePermission("config.manage")).Post("/api/services/{serviceID}/restart", sh.restartService)
		r.With(am.RequirePermission("config.manage")).Get("/api/services/{serviceID}/logs", sh.getServiceLogs)
		r.With(am.RequirePermission("config.manage")).Get("/api/services/{serviceID}/download", sh.downloadService)
	} else {
		r.Post("/api/services/{serviceID}/install", sh.installService)
		r.Post("/api/services/{serviceID}/uninstall", sh.uninstallService)
		r.Post("/api/services/{serviceID}/start", sh.startService)
		r.Post("/api/services/{serviceID}/stop", sh.stopService)
		r.Post("/api/services/{serviceID}/restart", sh.restartService)
		r.Get("/api/services/{serviceID}/logs", sh.getServiceLogs)
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

	// Obtener estados instalados + puerto real
	type installedInfo struct {
		status string
		port   *int
	}
	installed := map[string]installedInfo{}
	rows, err := sh.Pool.Query(ctx, `SELECT service_id, status, port FROM installed_services`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var svcID, status string
			var port *int
			_ = rows.Scan(&svcID, &status, &port)
			installed[svcID] = installedInfo{status: status, port: port}
		}
	}

	// Combinar catalogo con estado
	result := make([]map[string]interface{}, len(catalog))
	for i, svc := range catalog {
		info := installed[svc.ID]
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
			"status":       info.status,
		}
		if item["status"] == nil || item["status"] == "" {
			item["status"] = "not_installed"
		}
		if info.port != nil {
			item["port"] = *info.port
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
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se pueden instalar servicios en el nodo demo. Los servicios se instalan desde el nodo padre.")
		return
	}
	serviceID := chi.URLParam(r, "serviceID")
	svc := findService(serviceID)
	if svc == nil {
		writeError(w, 404, "servicio no encontrado")
		return
	}

	ctx := r.Context()
	containerName := fmt.Sprintf("aldea-%s", serviceID)

	// Verificar si docker-compose.yml existe
	// Dentro del contenedor el repo esta en /project, en desarrollo esta en el directorio actual
	composePath := findComposeFile(serviceID)
	if composePath == "" {
		writeJSON(w, 200, map[string]interface{}{
			"success":    false,
			"message":    fmt.Sprintf("No se encontro docker-compose.yml para %s. Usa 'Descargar' para obtener el paquete e instalarlo manualmente.", svc.Name),
			"service_id": serviceID,
			"note":       fmt.Sprintf("El archivo services/%s/docker-compose.yml no existe en el servidor. Descarga el paquete e instalo manualmente.", serviceID),
		})
		return
	}

	// Ejecutar docker compose up -d --build
	// Para pos-web (que se construye desde codigo fuente), usar --no-cache
	// para asegurar que cambios en vite.config.ts se apliquen
	var output []byte
	var err error
	if serviceID == "pos-web" {
		// Primero construir sin cache
		buildCmd := exec.Command("docker", "compose", "-f", composePath, "build", "--no-cache")
		buildOutput, buildErr := buildCmd.CombinedOutput()
		output = buildOutput
		if buildErr != nil {
			writeJSON(w, 200, map[string]interface{}{
				"success":    false,
				"service_id": serviceID,
				"message":    fmt.Sprintf("Error al construir: %v", buildErr),
				"logs":       string(buildOutput),
			})
			return
		}
		// Luego hacer up -d
		upCmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d")
		upOutput, upErr := upCmd.CombinedOutput()
		output = append(output, upOutput...)
		err = upErr
	} else {
		cmd := exec.Command("docker", "compose", "-f", composePath, "up", "-d", "--build")
		output, err = cmd.CombinedOutput()
	}

	if err != nil {
		// Si falla, NO marcar como instalado
		writeJSON(w, 200, map[string]interface{}{
			"success":    false,
			"service_id": serviceID,
			"message":    fmt.Sprintf("Error al instalar: %v", err),
			"logs":       string(output),
		})
		return
	}

	// Solo guardar en BD si la instalacion fue exitosa
	_, _ = sh.Pool.Exec(ctx, `
		INSERT INTO installed_services (service_id, service_name, category, subdomain, container_name, docker_compose_path, status, port, installed_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'running', $7, NOW(), NOW())
		ON CONFLICT (service_id) DO UPDATE SET status = 'running', updated_at = NOW()`,
		serviceID, svc.Name, svc.Category, svc.Subdomain, containerName, composePath, svc.DefaultPort)

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
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se pueden desinstalar servicios en el nodo demo.")
		return
	}
	serviceID := chi.URLParam(r, "serviceID")
	ctx := r.Context()

	// Detener y eliminar contenedor
	composePath := findComposeFile(serviceID)
	if composePath != "" {
		cmd := exec.Command("docker", "compose", "-f", composePath, "down", "--rmi", "all")
		cmd.Run()
	}

	// Actualizar BD
	_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'not_installed', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio desinstalado"})
}

// startService inicia un servicio detenido.
func (sh *FederatedServicesHandler) startService(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se pueden iniciar servicios en el nodo demo.")
		return
	}
	serviceID := chi.URLParam(r, "serviceID")
	cmd := exec.Command("docker", "compose", "-f", findComposeFile(serviceID), "start")
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
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se pueden detener servicios en el nodo demo.")
		return
	}
	serviceID := chi.URLParam(r, "serviceID")
	cmd := exec.Command("docker", "compose", "-f", findComposeFile(serviceID), "stop")
	cmd.Run()

	ctx := r.Context()
	_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'stopped', updated_at = NOW() WHERE service_id = $1`, serviceID)

	writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio detenido"})
}

// restartService reinicia un servicio.
func (sh *FederatedServicesHandler) restartService(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se pueden reiniciar servicios en el nodo demo.")
		return
	}
	serviceID := chi.URLParam(r, "serviceID")
	composePath := findComposeFile(serviceID)
	if composePath == "" {
		writeError(w, 404, "docker-compose.yml no encontrado para el servicio")
		return
	}
	cmd := exec.Command("docker", "compose", "-f", composePath, "restart")
	output, err := cmd.CombinedOutput()
	ctx := r.Context()
	if err == nil {
		_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'running', updated_at = NOW() WHERE service_id = $1`, serviceID)
		writeJSON(w, 200, map[string]interface{}{"success": true, "message": "Servicio reiniciado", "logs": string(output)})
	} else {
		_, _ = sh.Pool.Exec(ctx, `UPDATE installed_services SET status = 'error', updated_at = NOW() WHERE service_id = $1`, serviceID)
		writeJSON(w, 200, map[string]interface{}{"success": false, "message": fmt.Sprintf("error al reiniciar: %v", err), "logs": string(output)})
	}
}

// getServiceLogs devuelve los logs recientes de un servicio.
func (sh *FederatedServicesHandler) getServiceLogs(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "serviceID")
	containerName := fmt.Sprintf("aldea-%s", serviceID)
	// Ultimas 200 lineas de logs del contenedor
	cmd := exec.Command("docker", "logs", "--tail", "200", containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"service_id": serviceID,
			"logs":       fmt.Sprintf("No se pudieron obtener logs (el contenedor podria estar detenido): %v", err),
		})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"service_id": serviceID,
		"logs":       string(output),
	})
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

	// Caso especial: POS Web se construye desde el repositorio, no usa imagen pre-construida
	if serviceID == "pos-web" {
		composeContent := fmt.Sprintf(`# docker-compose.yml para Punto de Venta Web (POS)
# Generado por el nodo: %s
#
# El POS es una aplicacion 100%% frontend (PWA instalable).
# Se comunica con el nodo via API - no necesita backend propio.
#
# Para instalar en este servidor:
#   docker compose -f services/pos-web/docker-compose.yml up -d --build
#
# Para instalar en OTRO servidor:
#   1. Copia toda la carpeta del nodo a ese servidor
#   2. Ejecuta: docker compose -f services/pos-web/docker-compose.yml up -d --build
#   3. Abre http://SERVIDOR:3001 en el navegador
#   4. Al abrir el POS, ingresa la URL del nodo (ej: https://mi-nodo.com)
#
# URL del nodo para configurar en el POS: %s

version: '3.8'

services:
  pos-web:
    build:
      context: ../..
      dockerfile: docker/Dockerfile.pos
    container_name: aldea-pos-web
    restart: unless-stopped
    ports:
      - "%d:80"
`,
			sh.NodeDomain,
			sh.NodeDomain,
			svc.DefaultPort,
		)

		readmeContent := fmt.Sprintf(`# Punto de Venta Web (POS)

## Que es
%s

## Que reemplaza
%s

## Para que sirve
%s

## Como funciona

1. El POS es una aplicacion web 100%% frontend (PWA instalable)
2. No tiene backend propio - se comunica con el nodo via API
3. Al abrirlo por primera vez, ingresas la URL del nodo
4. El POS genera sus claves criptograficas (Ed25519) y huella de dispositivo
5. Un administrador registra el terminal en la plataforma
6. El administrador asigna el terminal a una organizacion
7. La organizacion asigna el terminal a un miembro o departamento
8. El miembro abre el POS, inicia sesion y empieza a cobrar

## Formas de pago

- **QR**: El POS muestra un QR, el cliente lo escanea, ve el monto,
  inicia sesion y confirma el pago
- **NFC**: El cliente acerca su tarjeta, ingresa su PIN y se debita

## Instalacion

### Opcion 1: Instalar con un clic desde el nodo
Ve a: Servicios Federados > Punto de Venta Web > Instalar

### Opcion 2: Instalar manualmente
1. Copia la carpeta del nodo al servidor destino
2. Ejecuta: docker compose -f services/pos-web/docker-compose.yml up -d --build
3. Abre http://SERVIDOR:%d en el navegador
4. Instala como PWA (Menu del navegador > Instalar app)

### Opcion 3: Abrir directamente sin Docker
1. Construye el frontend: cd pos && npm install && npm run build
2. Sirve la carpeta pos/dist/ con cualquier servidor web (nginx, python -m http.server, etc)
3. Abre la URL en el navegador

## Requisitos
- RAM minima: %d MB (solo sirve static files)
- Disco minimo: %d GB
- Docker y Docker Compose (para opcion Docker)
- El nodo debe estar accesible desde el dispositivo del POS

## URL del nodo
Configura el POS con la URL de tu nodo: %s

## Puerto
Puerto por defecto: %d (configurable con POS_PORT)

## Notas
- El POS funciona offline despues de instalar como PWA
- Las transacciones se guardan en el servidor del nodo
- Las organizaciones pueden ver turnos, ventas por usuario y transacciones
- El POS se registra como un terminal NFC mas del nodo
`,
			svc.WhatIs, svc.Replaces, svc.UsedFor,
			svc.DefaultPort,
			svc.MinRAM, svc.MinDisk,
			sh.NodeDomain,
			svc.DefaultPort,
		)

		writeJSON(w, 200, map[string]interface{}{
			"docker_compose": composeContent,
			"readme":         readmeContent,
			"service_id":     serviceID,
			"service_name":   svc.Name,
		})
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

// findComposeFile busca docker-compose.yml en multiples ubicaciones.
// Dentro del contenedor: /project/services/{id}/docker-compose.yml
// En desarrollo: services/{id}/docker-compose.yml
func findComposeFile(serviceID string) string {
	candidates := []string{
		filepath.Join("/project", "services", serviceID, "docker-compose.yml"),
		filepath.Join("services", serviceID, "docker-compose.yml"),
		filepath.Join("..", "services", serviceID, "docker-compose.yml"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
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
	if os.Getenv("DEMO_MODE") == "true" {
		writeError(w, 403, "No se puede configurar VoIP en el nodo demo.")
		return
	}
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
