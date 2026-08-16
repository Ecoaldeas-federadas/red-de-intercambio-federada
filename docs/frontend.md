# Frontend PWA

## Stack
- **React 18** con hooks (useState, useEffect)
- **TypeScript** para tipado estatico
- **TailwindCSS** para estilos
- **Vite 5** como build tool y dev server
- **lucide-react** para iconos
- **react-router-dom** para enrutamiento

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
    │   └── usePermissions.ts  # Hook de permisos del usuario
    ├── components/
    │   └── Layout.tsx       # Sidebar + header responsive
    └── pages/
        ├── Setup.tsx         # Wizard de configuracion inicial (4 pasos)
        ├── Login.tsx         # Login con contrasena o Passkey WebAuthn
        ├── Dashboard.tsx     # Panel principal (balance, advertencias, nodos)
        ├── Transfer.tsx      # Transferencia interna
        ├── History.tsx       # Historial de transacciones
        ├── Products.tsx      # Catalogo de productos
        ├── Calculator.tsx    # Calculadora energetica
        ├── Store.tsx         # Tienda comunitaria
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
- `dist/assets/index.css`: 16 KB (gzip: 3.5 KB)
- `dist/assets/index.js`: 216 KB (gzip: 64 KB)
