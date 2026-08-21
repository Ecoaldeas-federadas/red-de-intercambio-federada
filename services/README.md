# Servicios Federados y Autohospedados para Aldeas

Este directorio contiene los archivos `docker-compose.yml` para cada servicio que se puede instalar desde la pagina "Servicios Federados" del nodo.

## Que es esto?

Cada servicio reemplaza una plataforma comercial (YouTube, WhatsApp, Google Drive, etc.) con una alternativa autohospedada que se ejecuta en el servidor de tu aldea. Tus datos se quedan en tu comunidad.

## Como instalar un servicio

### Opcion 1: Desde el nodo (recomendado)

1. Ve a la pagina "Servicios Federados" en el panel del nodo
2. Busca el servicio que quieres instalar
3. Haz clic en "Instalar"
4. El nodo ejecuta `docker compose up -d` automaticamente

### Opcion 2: Descargar e instalar en otro equipo

1. Ve a la pagina "Servicios Federados" en el panel del nodo
2. Haz clic en "Descargar" en el servicio que quieres
3. Copia el archivo al servidor destino
4. Ejecuta:

```bash
# Crear red compartida (solo la primera vez)
docker network create aldea-network

# Iniciar el servicio
docker compose up -d
```

### Opcion 3: Instalacion manual

1. Copia la carpeta del servicio al servidor destino
2. Crea la red: `docker network create aldea-network`
3. Ejecuta: `docker compose up -d`

## Requisitos

- Docker y Docker Compose instalados
- La red `aldea-network` creada: `docker network create aldea-network`
- RAM y disco suficientes (ver cada servicio)

## Lista de servicios

### Redes Sociales Federadas
| Servicio | Reemplaza | RAM min | Disco min |
|----------|-----------|---------|-----------|
| PeerTube | YouTube | 2 GB | 50 GB |
| Mastodon | Twitter/X | 2 GB | 20 GB |
| Pixelfed | Instagram | 1 GB | 20 GB |
| Friendica | Facebook | 1 GB | 10 GB |
| Lemmy | Reddit | 1 GB | 10 GB |
| BookWyrm | Goodreads | 1 GB | 5 GB |
| WriteFreely | Medium/Blogs | 512 MB | 5 GB |
| Mobilizon | Facebook Events | 1 GB | 10 GB |

### Comunicacion
| Servicio | Reemplaza | RAM min | Disco min |
|----------|-----------|---------|-----------|
| Matrix | WhatsApp/Telegram | 1 GB | 10 GB |
| Jitsi Meet | Zoom/Meet | 2 GB | 10 GB |
| Asterisk (VoIP) | Lineas telefonicas | 1 GB | 10 GB |
| Mumble | Discord (voz) | 256 MB | 1 GB |

### Productividad
| Servicio | Reemplaza | RAM min | Disco min |
|----------|-----------|---------|-----------|
| Nextcloud | Google Drive | 512 MB | 50 GB |
| Collabora | Google Docs | 1 GB | 5 GB |
| BookStack | Confluence/Notion | 512 MB | 5 GB |
| MediaWiki | Wikipedia interna | 512 MB | 5 GB |

### Multimedia
| Servicio | Reemplaza | RAM min | Disco min |
|----------|-----------|---------|-----------|
| Jellyfin | Netflix/Spotify | 512 MB | 50 GB |
| Funkwhale | Spotify | 1 GB | 20 GB |

### Desarrollo y Otros
| Servicio | Reemplaza | RAM min | Disco min |
|----------|-----------|---------|-----------|
| Gitea | GitHub | 256 MB | 10 GB |
| BigBlueButton | Zoom (educacion) | 4 GB | 20 GB |
| Home Assistant | Google Home | 512 MB | 5 GB |
| Vaultwarden | LastPass/1Password | 128 MB | 1 GB |

## Federacion entre aldeas

Los servicios que soportan federacion (ActivityPub, Matrix, etc.) pueden conectarse con los mismos servicios de otras aldeas:

- **PeerTube**: ver videos de otras aldeas
- **Mastodon**: seguir y responder a miembros de otras aldeas
- **Pixelfed**: ver fotos de otras aldeas
- **Matrix**: chatear con miembros de otras aldeas
- **VoIP**: llamar a extensiones de otras aldeas marcando codigo-aldea + extension

## Integracion con OpenWrt

Si tienes OpenWrt instalado, cada servicio obtiene un subdominio automatico:

- PeerTube -> `video.aldea1.com`
- Mastodon -> `social.aldea1.com`
- Nextcloud -> `archivos.aldea1.com`
- etc.

OpenWrt maneja el DNS y el certificado SSL wildcard.

## Agregar nuevos servicios

Copia la plantilla de `services/_template/docker-compose.yml` y adaptala para el nuevo servicio. Luego agrega la entrada en el catalogo del codigo Go (`internal/api/services_catalog.go`).
