# Departamentos, Roles y Permisos

## Resumen

El sistema de departamentos permite organizar a los miembros del nodo en estructuras jerarquicas con roles y permisos granulares. Cada departamento puede tener multiples roles, y cada rol puede tener multiples permisos. Los usuarios pueden pertenecer a multiples departamentos con diferentes roles.

## Estructura

```
Departamento
  ├── Rol 1
  │   ├── Permiso A
  │   ├── Permiso B
  │   └── Permiso C
  ├── Rol 2
  │   └── Permiso D
  └── Miembros
      ├── Usuario X (Rol 1)
      └── Usuario Y (Rol 2)
```

## Tipos de grupo

| Tipo | Descripcion |
|------|-------------|
| `department` | Departamento operativo |
| `council` | Consejo con poder de decision |
| `committee` | Comision temporal o permanente |

## Permisos disponibles

### Cuentas y admision
- `accounts.approve_admission` — Aprobar solicitudes de admision
- `accounts.reject_admission` — Rechazar solicitudes de admision

### Federacion
- `federation.change_config` — Cambiar configuracion de federacion
- `federation.set_limits` — Establecer limites bilaterales

### Organizaciones
- `org.approve` — Aprobar organizaciones
- `org.budget_increase` — Incrementar presupuesto de instituciones

### Comercio externo
- `external.store_fc` — Almacenar factor de conversion
- `external.approve_operation` — Aprobar operaciones externas
- `external.reject_operation` — Rechazar operaciones externas

### Tienda
- `store.update_stock` — Actualizar stock de productos
- `store.update_price` — Actualizar precios de productos
- `store.deactivate_item` — Desactivar items de tienda

### Recuperacion
- `recovery.update_config` — Actualizar configuracion de recuperacion
- `recovery.approve` — Aprobar solicitudes de recuperacion
- `recovery.reject` — Rechazar solicitudes de recuperacion
- `recovery.complete` — Completar recuperacion

### Departamentos
- `dept.manage` — Gestionar departamentos, roles y permisos
- `dept.assign_members` — Asignar miembros a departamentos

### NFC
- `nfc.register_terminal` — Registrar terminal ESP32
- `nfc.deactivate_terminal` — Desactivar terminal
- `nfc.issue_card` — Emitir tarjeta NFC con PIN
- `nfc.deactivate_card` — Desactivar tarjeta NFC
- `nfc.reset_pin` — Resetear PIN de tarjeta

## Multi-firma

Algunos permisos pueden requerir multi-firma (multisig). Esto significa que multiples aprobaciones son necesarias para ejecutar la accion.

| Permiso | Multisig | Aprobaciones |
|---------|----------|-------------|
| `org.budget_increase` | Opcional | Configurable |
| `recovery.complete` | Opcional | Configurable |
| `external.approve_operation` | Opcional | Configurable |

La configuracion de multisig se establece en la tabla `permissions` con `requires_multisig = true` y `required_approvals = N`.

## API

### Departamentos

| Metodo | Endpoint | Permiso | Descripcion |
|--------|----------|---------|-------------|
| GET | `/api/departments` | - | Listar departamentos |
| POST | `/api/departments` | `dept.manage` | Crear departamento |
| GET | `/api/departments/{id}` | - | Obtener departamento |
| PUT | `/api/departments/{id}` | `dept.manage` | Actualizar |
| DELETE | `/api/departments/{id}` | `dept.manage` | Eliminar |

### Roles

| Metodo | Endpoint | Permiso |
|--------|----------|---------|
| GET | `/api/departments/{id}/roles` | - |
| POST | `/api/departments/{id}/roles` | `dept.manage` |
| PUT | `/api/roles/{id}` | `dept.manage` |
| DELETE | `/api/roles/{id}` | `dept.manage` |
| GET | `/api/roles/{id}/permissions` | - |
| PUT | `/api/roles/{id}/permissions` | `dept.manage` |

### Miembros

| Metodo | Endpoint | Permiso |
|--------|----------|---------|
| GET | `/api/departments/{id}/members` | - |
| POST | `/api/departments/{id}/members` | `dept.assign_members` |
| DELETE | `/api/departments/{id}/members/{user_id}` | `dept.assign_members` |

### Permisos

| Metodo | Endpoint | Permiso |
|--------|----------|---------|
| GET | `/api/permissions` | - |
| GET | `/api/permissions/categories` | - |
| GET | `/api/users/me/permissions` | - |

## Frontend

- **Pagina**: `/departments` — Gestion de departamentos, roles, miembros y permisos
- **Hook**: `usePermissions()` — Hook de React para verificar permisos del usuario actual
- **Componentes**: `Departments.tsx` con UI completa para CRUD

## Base de datos

Tablas creadas en migracion `004_nfc_terminals.sql`:

- `departments` — Departamentos del nodo
- `roles` — Roles dentro de cada departamento
- `permissions` — Permisos disponibles (con categoria y multisig)
- `role_permissions` — Asociacion rol <-> permiso
- `user_permissions` — Permisos directos a usuario
- `department_members` — Miembros de cada departamento con su rol

## Seed data

La migracion incluye datos iniciales:
- Departamento "Administracion" con rol "Administrador"
- Todos los permisos creados con sus categorias
- El rol Administrador tiene asignados todos los permisos
