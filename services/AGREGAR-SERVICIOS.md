# Como Agregar Nuevos Servicios Federados

Guia tecnica para agregar nuevos servicios al catalogo de "Servicios Federados" del nodo. Cualquier persona con conocimientos basicos de Docker puede seguir estos pasos.

---

## Estructura de archivos necesaria

Para agregar un nuevo servicio necesitas:

```
services/
  {nombre-del-servicio}/
    docker-compose.yml      # Configuracion Docker del servicio
```

Y modificar un archivo en el backend:

```
internal/api/
  services_catalog.go       # Agregar entrada al catalogo
```

---

## Paso 1: Crear el docker-compose.yml

Copia la plantilla base y adaptala:

```bash
cp services/_template/docker-compose.yml services/{nombre}/docker-compose.yml
```

Edita el archivo. Ejemplo para un servicio ficticio "MiApp":

```yaml
# docker-compose.yml para MiApp
# Servicio: MiApp - Plataforma de ejemplo
# Reemplaza: Servicio Comercial X

version: '3.8'

services:
  miapp:
    image: miapp/official:latest
    container_name: aldea-miapp
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data/miapp:/data
    environment:
      - DOMAIN=${DOMAIN:-miapp.aldea.com}
      - DATABASE_URL=postgres://miapp:miapp@miapp-db:5432/miapp
      - SECRET_KEY=${SECRET_KEY:-cambiar-en-produccion}
    depends_on:
      - miapp-db
    networks:
      - aldea-network

  miapp-db:
    image: postgres:16-alpine
    container_name: aldea-miapp-db
    restart: unless-stopped
    volumes:
      - ./data/miapp-db:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=miapp
      - POSTGRES_USER=miapp
      - POSTGRES_PASSWORD=${DB_PASSWORD:-miapp}
    networks:
      - aldea-network

networks:
  aldea-network:
    external: true
```

### Secciones del docker-compose.yml

| Seccion | Que hace |
|---------|----------|
| `services:` | Define los contenedores a ejecutar |
| `image:` | Imagen Docker a usar (buscar en Docker Hub) |
| `container_name:` | Nombre del contenedor (prefijo `aldea-`) |
| `restart: unless-stopped` | Reinicia automaticamente si falla |
| `ports:` | Puertos expuestos (host:contenedor) |
| `volumes:` | Directorios persistentes en `./data/` |
| `environment:` | Variables de configuracion |
| `depends_on:` | Servicios que deben iniciar primero |
| `networks:` | Red compartida `aldea-network` |

### Importante

- La red `aldea-network` debe existir: `docker network create aldea-network`
- Los volumenes van en `./data/` para persistencia
- Usar `${VARIABLE:-default}` para valores configurables
- Siempre `restart: unless-stopped`

---

## Paso 2: Agregar la entrada al catalogo Go

Edita `internal/api/services_catalog.go` y agrega una entrada al array `catalog`:

```go
{
    ID:          "miapp",
    Name:        "MiApp",
    Category:    "social",           // social, comunicacion, productividad, multimedia, desarrollo
    Icon:        "Server",           // icono de lucide-react (ver lista abajo)
    WhatIs:      "Plataforma de ejemplo que hace X. Cada aldea tiene su propio servidor. Las aldeas federadas pueden compartir contenido.",
    Replaces:    "Servicio Comercial X",
    UsedFor:     "Casos de uso practicos para una aldea: hacer X, organizar Y, compartir Z. Sin anuncios, sin vigilancia.",
    Protocol:    "ActivityPub",      // ActivityPub, Matrix, SIP, Web, Git, etc.
    Docker:      true,
    MinRAM:      1024,               // RAM minima en MB
    MinDisk:     10,                 // Disco minimo en GB
    DefaultPort: 8080,               // Puerto principal
    Subdomain:   "miapp",            // Subdominio sugerido (miapp.aldea1.com)
},
```

### Campos del struct ServiceCatalogItem

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `ID` | string | Identificador unico (sin espacios, minusculas) |
| `Name` | string | Nombre legible del servicio |
| `Category` | string | Categoria: social, comunicacion, productividad, multimedia, desarrollo |
| `Icon` | string | Nombre del icono de lucide-react |
| `WhatIs` | string | Que es el servicio (explicacion clara) |
| `Replaces` | string | Que servicio comercial reemplaza |
| `UsedFor` | string | Para que sirve (casos de uso practicos) |
| `Protocol` | string | Protocolo de federacion (ActivityPub, Matrix, SIP, Web, etc.) |
| `Docker` | bool | Si tiene imagen Docker (siempre true) |
| `MinRAM` | int | RAM minima en MB |
| `MinDisk` | int | Disco minimo en GB |
| `DefaultPort` | int | Puerto principal |
| `Subdomain` | string | Subdominio sugerido |

---

## Paso 3: Iconos disponibles (lucide-react)

Puedes usar cualquiera de estos iconos en el campo `Icon`:

### Redes sociales
- `Video` - para plataformas de video
- `MessageCircle` - para mensajeria corta
- `Image` - para fotografias
- `Users` - para redes sociales completas
- `MessageSquare` - foros y discusiones
- `BookOpen` - libros y lectura
- `PenTool` - blogs y escritura
- `Calendar` - eventos

### Comunicacion
- `Phone` - telefonia
- `Mic` - voz
- `Video` - videoconferencias

### Productividad
- `Cloud` - almacenamiento
- `FileText` - documentos
- `BookMarked` - wikis y documentacion
- `Globe` - enciclopedias

### Multimedia
- `Film` - peliculas y video
- `Music` - musica y audio

### Otros
- `GitBranch` - codigo y repositorios
- `GraduationCap` - educacion
- `Home` - automatizacion del hogar
- `Lock` - contrasenas y seguridad
- `Server` - generico

---

## Paso 4: Obtener la imagen Docker correcta

1. Busca el servicio en [Docker Hub](https://hub.docker.com)
2. Verifica que sea la imagen oficial o mantenida por la comunidad
3. Revisa la documentacion del servicio para:
   - Variables de entorno necesarias
   - Puertos que usa
   - Base de datos requerida (PostgreSQL, MySQL, Redis, etc.)
   - Volumenes para persistencia

### Ejemplo de busqueda

Para agregar "BookStack":
1. Buscar "bookstack docker" en Docker Hub
2. Encontrar `lscr.io/linuxserver/bookstack:latest`
3. Leer la documentacion: necesita MariaDB, puerto 80
4. Crear el docker-compose.yml con esos requisitos

---

## Paso 5: Probar el servicio

Antes de hacer commit, prueba que funciona:

```bash
# Crear la red si no existe
docker network create aldea-network

# Iniciar el servicio
cd services/{nombre}
docker compose up -d

# Verificar que responde
curl http://localhost:{puerto}

# Ver logs
docker compose logs -f

# Verificar persistencia (reiniciar y comprobar que los datos siguen)
docker compose down
docker compose up -d
```

---

## Paso 6: Hacer que el servicio sea federable

Algunos servicios soportan federacion (comunicacion entre instancias):

| Protocolo | Servicios que lo usan |
|-----------|----------------------|
| ActivityPub | PeerTube, Mastodon, Pixelfed, Friendica, Lemmy, BookWyrm, WriteFreely, Mobilizon, Funkwhale |
| Matrix | Matrix (Synapse) |
| SIP/RTP | Asterisk (VoIP) |
| XMPP | Jitsi Meet |
| Mumble | Mumble |
| Git | Gitea, Forgejo |

Para configurar la federacion, consulta la documentacion de cada servicio. Generalmente consiste en:
1. Configurar el dominio correcto en el servicio
2. Permitir conexiones entrantes de otras instancias
3. Seguir/conectar con instancias remotas desde la interfaz del servicio

---

## Guia para crear servicios con IA

Puedes usar un asistente de IA (como Devin, ChatGPT, Claude, o GitHub Copilot) para crear un nuevo servicio. Aqui esta como:

### Que informacion proporcionar a la IA

Dile a la IA:

1. **Nombre del servicio** que quieres agregar
2. **Que reemplaza** (servicio comercial)
3. **URL de la documentacion oficial** o de Docker Hub
4. **Que debe hacer** (descripcion para los campos WhatIs y UsedFor)

### Prompt de ejemplo

```
Quiero agregar el servicio "Castopod" a mi catalogo de servicios federados.

Castopod es una plataforma de podcasts que reemplaza a Spotify para podcasts.
Documentacion: https://docs.castopod.org/
Imagen Docker: castopod/castopod:latest

Necesito:
1. Un archivo docker-compose.yml en services/castopod/docker-compose.yml
2. Una entrada para el catalogo Go en internal/api/services_catalog.go

El docker-compose debe:
- Usar la imagen oficial
- Tener volumenes persistentes en ./data/
- Usar la red aldea-network (external: true)
- Incluir PostgreSQL y Redis si los necesita
- Tener restart: unless-stopped

La entrada del catalogo debe seguir el formato del struct ServiceCatalogItem
con los campos: ID, Name, Category, Icon, WhatIs, Replaces, UsedFor, Protocol,
Docker, MinRAM, MinDisk, DefaultPort, Subdomain.

Explicar que es Castopod, que reemplaza (Spotify para podcasts, Anchor),
y para que sirve en una aldea (publicar podcasts locales, educacion por audio).
```

### Que archivos pedirle a la IA

1. `services/{nombre}/docker-compose.yml`
2. El bloque de codigo Go para agregar al catalogo

### Como verificar que el resultado es correcto

1. **docker-compose.yml**:
   - Usa `version: '3.8'`
   - Tiene `restart: unless-stopped`
   - Volumenes en `./data/`
   - Red `aldea-network` con `external: true`
   - Variables de entorno con defaults

2. **Entrada del catalogo**:
   - `ID` es unico y en minusculas
   - `Category` es una de: social, comunicacion, productividad, multimedia, desarrollo
   - `Icon` es uno de los iconos disponibles
   - `WhatIs`, `Replaces`, `UsedFor` estan en español y son claros
   - `MinRAM` y `MinDisk` son realistas

3. **Probar**:
   ```bash
   docker network create aldea-network  # si no existe
   cd services/{nombre}
   docker compose up -d
   curl http://localhost:{puerto}
   ```

---

## Checklist final

Antes de hacer commit:

- [ ] `services/{nombre}/docker-compose.yml` existe y es valido
- [ ] Entrada agregada en `internal/api/services_catalog.go`
- [ ] `ID` es unico en el catalogo
- [ ] `Category` es valida (social, comunicacion, productividad, multimedia, desarrollo)
- [ ] `Icon` es un icono valido de lucide-react
- [ ] `WhatIs`, `Replaces`, `UsedFor` estan en español y son claros
- [ ] `docker compose up -d` funciona
- [ ] El servicio responde en el puerto configurado
- [ ] Los datos persisten despues de reiniciar
- [ ] `go build ./...` compila sin errores
- [ ] `npm run build` compila sin errores
- [ ] El servicio aparece en la pagina "Servicios Federados"

---

## Lista de servicios que se podrian agregar en el futuro

- **Castopod** - podcasts (reemplaza Spotify podcasts)
- **HumHub** - red social empresarial (reemplaza Workplace)
- **Mattermost** - chat empresarial (reemplaza Slack)
- **OpenProject** - gestion de proyectos (reemplaza Asana/Trello)
- **CodiMD/HedgeDoc** - notas colaborativas (reemplaza Notion)
- **Inventaire** - biblioteca de libros (reemplaza Goodreads)
- **Plume** - blogs federados (alternativa a WriteFreely)
- **Peertube-plugins** - plugins para PeerTube
- **OpenStreetMap** - mapas (reemplaza Google Maps)
- **Koel** - musica personal (alternativa a Jellyfin para musica)
- **Paperless-ngx** - gestion documental (escaneo y OCR)
- **Firefly III** - finanzas personales (reemplaza Mint)
- **Calibre-Web** - biblioteca de ebooks
- **Wallabag** - guardar articulos para leer despues (reemplaza Pocket)
- **Tiny Tiny RSS** - lector de RSS (reemplaza Feedly)
- **Nitter** - ver Twitter sin Twitter
- **Piped** - ver YouTube sin YouTube
- **LibreTranslate** - traduccion (reemplaza Google Translate)
- **Searx** - buscador meta (reemplaza Google Search)
- **Nextcloud Talk** - videoconferencia integrada en Nextcloud
