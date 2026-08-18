# Frontend PWA

## Stack
- **React 18** con hooks (useState, useEffect, useRef, useCallback)
- **TypeScript** para tipado estatico
- **TailwindCSS** para estilos
- **Vite 5** como build tool y dev server
- **lucide-react** para iconos
- **react-router-dom** para enrutamiento
- **IntersectionObserver** para infinite scroll

## Estructura

```
web/
├── package.json
├── vite.config.ts          # Proxy /api -> localhost:8080
├── tsconfig.json
├── tailwind.config.js      # Tema trueque (verde teal)
├── postcss.config.js
├── index.html
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   ├── sw.js                # Service worker (cache offline)
│   └── icon.svg             # Icono PWA
└── src/
    ├── main.tsx             # Entry point + registro service worker
    ├── App.tsx              # Rutas con auth guard
    ├── api.ts               # Cliente API con JWT
    ├── index.css            # Tailwind + estilos base
    ├── hooks/
    │   ├── useAuth.ts         # Hook de autenticacion
    │   ├── usePermissions.ts  # Hook de permisos del usuario
    │   └── useConfig.ts       # Hook de configuracion del nodo
    ├── components/
    │   ├── Layout.tsx         # Sidebar + header responsive
    │   └── public-site/
    │       └── PublicBlocks.tsx  # Bloques del sitio publico con infinite scroll
    └── pages/
        ├── Setup.tsx         # Wizard de configuracion inicial (4 pasos)
        ├── Login.tsx         # Login con contrasena o Passkey WebAuthn
        ├── Dashboard.tsx     # Panel principal (balance, advertencias, nodos)
        ├── Transfer.tsx      # Transferencia interna
        ├── History.tsx       # Historial de transacciones
        ├── Products.tsx      # Catalogo de productos + productos federados
        ├── Calculator.tsx    # Calculadora energetica
        ├── Store.tsx         # Tienda comunitaria con productos compuestos
        ├── FederationLimits.tsx  # Limites bilaterales
        ├── Parity.tsx        # Reportes de paridad
        ├── Assembly.tsx      # Propuestas de asamblea
        ├── Audit.tsx         # Log de auditoria
        ├── ExternalBridge.tsx  # Comercio externo (FC, operaciones)
        ├── Admission.tsx     # Admision de miembros
        ├── Organizations.tsx # Organizaciones
        ├── Payments.tsx      # Pagos QR/NFC/manual
        ├── Recovery.tsx      # Recuperacion de cuenta
        ├── Departments.tsx   # Departamentos, roles, permisos, miembros
        └── NFCTerminals.tsx  # Terminales NFC, tarjetas, transacciones
```

## PWA

### Manifest
- `name`: Red de Intercambio Federada
- `short_name`: Trueque
- `display`: standalone
- `theme_color`: #0f766e (teal-700)
- `background_color`: #0f766e
- `icons`: SVG escalable

### Service Worker
- Cache de assets estaticos (/)
- Strategy: stale-while-revalidate para GET
- Invalidacion de cache por version (CACHE_NAME)
- No cachea POST/PUT/DELETE

## Autenticacion

### Hook `useAuth`
- `isAuthenticated`: verifica token JWT en localStorage
- `username`: del token decodificado
- `login(token, username)`: almacena token
- `logout()`: elimina token

### Hook `usePermissions`
- `permissions`: lista de permisos del usuario actual
- `hasPermission(name)`: verifica si el usuario tiene un permiso
- `hasAnyPermission(names)`: verifica si tiene al menos uno
- `hasAllPermissions(names)`: verifica si tiene todos
- Carga automatica via `GET /api/users/me/permissions`

### Hook `useConfig`
- `currency`: nombre de la moneda del nodo (ej: TQ)
- Carga automatica via `GET /api/public/settings`

### Auth Guard
- `App.tsx`: verifica estado del nodo via `GET /api/setup/status`
- Si nodo no inicializado: redirige a `/setup`
- Si no autenticado: redirige a `/login`
- Si autenticado: muestra Layout con sidebar

### Setup Wizard (`/setup`)
- Pagina de configuracion inicial para nuevo nodo
- 4 pasos: nombre/dominio del nodo, usuario admin, contrasena, revision
- Al confirmar: `POST /api/setup/init` crea admin, genera claves, departamentos, permisos
- Login automatico al completar (JWT retornado)

### Login (`/login`)
- Dos modos: contrasena (bcrypt) y Passkey (WebAuthn)
- Tab para alternar entre modos
- Login por contrasena: `POST /api/auth/login/password`
- Login por Passkey: `POST /api/auth/login/begin` + `/api/auth/login/finish`

## API Client (`api.ts`)

- Base URL: `/api` (proxy a backend en dev)
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`
- Metodos: `get<T>`, `post<T>`, `put<T>`, `delete<T>`
- Errores: parsea JSON de error, lanza Error con mensaje

## Paginas Principales

### Products.tsx - Catalogo de productos
- Lista productos con infinite scroll (IntersectionObserver)
- Filtros por categoria padre, categoria y subcategoria
- Crear/editar productos (requiere permiso `products.manage`)
- Aprobar productos pendientes
- **Panel de productos federados** (boton con contador de pendientes)
  - Lista productos propuestos por otros nodos
  - Aprobar/rechazar productos federados
  - Muestra nodo origen, precio, categoria
- Mostrar/ocultar productos (is_hidden)

### Store.tsx - Tienda comunitaria
- Dos vistas: "Mi Tienda" (personal) y "Explorar" (todas las tiendas del nodo)
- **Dos modos de creacion de producto:**
  1. **Producto Compuesto** (nuevo):
     - Nombre, descripcion, categoria, stock
     - Selector de componentes con filtro por categoria
     - Filtros: Todos, Materias Primas, Productos Base, Trabajo, Embalaje, Envio
     - Agregar componente con cantidad
     - Lista de componentes con subtotal cada uno
     - Precio total automatico (no editable)
     - Publicar en tienda
  2. **Producto del Catalogo** (simple):
     - Seleccionar producto del catalogo
     - Stock, unidades por paquete
     - Costos adicionales (envio, envase)
     - Precio final = base + extras
- Visualizacion de productos compuestos con etiqueta "Compuesto"
- Comprar productos de otros usuarios
- Busqueda y filtro por categoria en vista explorar

### Calculator.tsx - Calculadora energetica
- Calcula precio energetico de productos
- Parametros: producto, cantidad, productor
- Muestra desglose de energia por componente

## Tema Tailwind

```js
colors: {
  trueque: {
    50:  '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  }
}
```

## Build

```bash
cd web
npm install
npx vite build    # genera dist/
npx vite dev      # dev server en :5173
```

### Salida
- `dist/index.html`: 0.7 KB
- `dist/assets/index.css`: 63 KB (gzip: 10 KB)
- `dist/assets/index.js`: ~1356 KB (gzip: 367 KB)

> Nota: El bundle de JS supera 500 KB. Para optimizar, considerar code-splitting
> con `React.lazy()` y `manualChunks` en la configuracion de Vite.
