# Cuentas y Miembros

## Archivos
- `internal/accounts/user.go` - Usuarios, admision, niveles de miembro
- `internal/accounts/organization.go` - Organizaciones, instituciones publicas, multi-firma

## Tipos de Cuenta

| Tipo | Descripcion |
|------|-------------|
| `individual` | Persona fisica, miembro de la comunidad |
| `organization` | Organizacion colectiva (cooperativa, empresa comunitaria) |
| `public_institution` | Institucion publica (gobierno local, servicio publico) |
| `fund` | Fondo comunitario (recaudacion de impuestos) |

## Niveles de Miembro

Cada nivel define: limites de credito/debito, limites por transaccion/diario/mensual, tasa de impuesto, permisos (crear organizacion, comercio inter-nodos, tarjeta NFC, auditoria, puente externo), maximo de organizaciones, auto-upgrade.

### Niveles del Sistema (seed)
- **`new`**: Nuevo miembro. Limites reducidos. Sin permisos avanzados.
- **`full`**: Miembro pleno. Limites completos. Voz, voto, comercio externo.
- Niveles personalizables por nodo via asamblea.

## Admision de Nuevos Miembros

### Flujo
1. Solicitud de admision: `POST /api/accounts/admission` (o via codigo de invitacion)
2. Revisión por asamblea o regla configurada
3. Aprobacion: crea usuario con nivel propuesto, registra en `membership_history`
4. Rechazo: con razon documentada

### Estados de Admision
- `pending`: Esperando revision
- `under_review`: En revision
- `approved`: Aprobada, usuario creado
- `rejected`: Rechazada con razon

## Organizaciones

### Creacion
- Requiere permiso `can_create_organization` en el nivel del creador
- Subtipos: cooperativa, empresa, asociacion, sindicato, etc.
- Configurable: credit/debit_limit, annual_budget_limit, tax_rate, required_signatures, authorized_signers

### Aprobacion
- Organizaciones requieren aprobacion (como admision)
- `approved_by` acumula aprobadores

### Instituciones Publicas
- Subtipo especial de organizacion
- Presupuesto anual configurable
- Aumento de presupuesto requiere aprobacion de asamblea
- No pagan impuestos (tax_rate = 0)

## Multi-firma de Organizaciones

- `required_signatures`: Numero de firmas necesarias para ejecutar
- `authorized_signers`: Lista de UUIDs autorizados a firmar
- Propuestas se acumulan en `multi_sig_approvals`
- Se ejecutan cuando se alcanza el numero requerido

## Membresia

### Estados
- `pending`: Pendiente de admision
- `active`: Miembro activo
- `suspended`: Suspendido (por asamblea)
- `expelled`: Expulsado (por asamblea)

### Historial
- `membership_history` registra todos los cambios de nivel/estado
- Incluye razon y aprobadores
