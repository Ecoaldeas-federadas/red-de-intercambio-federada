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

### Limites de Saldo (Pilar del Sistema de Moneda Cero)

El sistema de moneda saldo cero (LETS / Credito Mutuo) usa dos limites fundamentales:

- **Limite inferior (piso negativo):** Maximo saldo negativo permitido. Funciona como linea de credito comunitaria. Al tocar este limite, la cuenta se bloquea para nuevas compras hasta que el miembro aporte valor (bienes o trabajo) para reducir su saldo negativo.
- **Limite superior (techo positivo):** Maximo saldo positivo permitido. Evita acumulacion indefinida. Al tocar este limite, la cuenta no puede recibir mas abonos hasta que el miembro gaste o reinvierta sus creditos.

### Limites Simetricos (positivo = negativo)

Los limites **siempre son simetricos**: el limite negativo y el limite positivo tienen el mismo valor absoluto. Esto garantiza equidad: lo que puedes recibir de la comunidad equivale a lo que puedes aportar. Si los limites fueran dispares (ej: -50 negativo, +500 positivo), el sistema favoreceria recibir mas de lo que se da, rompiendo el principio de suma cero del credito mutuo.

| Tipo de Miembro | Saldo Negativo (Piso) | Saldo Positivo (Techo) | Equivalente |
|-----------------|----------------------|----------------------|-------------|
| Persona natural nueva | -500 TQ | +500 TQ | 1 canasta basica mensual |
| Persona natural activa | -1,000 TQ | +1,000 TQ | 2 canastas basicas |
| Organizacion de produccion | -5,000 TQ | +5,000 TQ | 10 canastas |
| Organizacion de consumo | -3,000 TQ | +3,000 TQ | 6 canastas |
| Institucion publica | -10,000 TQ | +10,000 TQ | 20 canastas |

### Calculo de la Canasta Basica Mensual (500 TQ)

El limite minimo de 500 TQ se calculo del costo energetico real de alimentar a una familia de 4 personas durante un mes, usando los precios del catalogo:

| Producto | Cantidad/mes | Precio TQ | Subtotal |
|----------|-------------|-----------|----------|
| Granos (caraota, frijol, maiz) | 8 kg | 10 TQ/kg | 80 |
| Arroz | 4 kg | 11 TQ/kg | 44 |
| Harina de maiz | 4 kg | 10 TQ/kg | 40 |
| Tuberculos (yuca, name, platano) | 10 kg | 2 TQ/kg | 20 |
| Verduras y hortalizas | 8 kg | 2 TQ/kg | 16 |
| Frutas | 6 kg | 2 TQ/kg | 12 |
| Hojas verdes | 2 kg | 2 TQ/kg | 4 |
| Leche | 8 L | 2 TQ/L | 16 |
| Huevos | 3 kg | 10 TQ/kg | 30 |
| Pollo | 4 kg | 8 TQ/kg | 32 |
| Pan | 4 kg | 5 TQ/kg | 20 |
| Aceite | 1 L | 10 TQ/L | 10 |
| Papelon/azucar | 2 kg | 15 TQ/kg | 30 |
| Agua (30 dias x 1 TQ) | - | - | 30 |
| Servicios basicos (30 dias x 2 TQ) | - | - | 60 |
| **TOTAL** | | | **~444 TQ** |

Redondeado a **500 TQ** = 1 canasta basica familiar mensual. Esto garantiza que cualquier miembro nuevo pueda recibir lo necesario para alimentar a su familia durante un mes sin haber aportado nada todavia.

Estos limites estan definidos por el nivel de miembro y pueden aumentarse por la asamblea segun la trayectoria y confiabilidad del miembro, siempre manteniendo simetria.

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

### Organizaciones de la Asamblea
- Las organizaciones con `is_assembly_owned = true` pertenecen a la Asamblea
- Todos los miembros del nodo son automaticamente miembros
- Los miembros nuevos se auto-suscriben al ser admitidos
- Sus decisiones se votan en la Asamblea General del nodo
- Tienen junta directiva propia para decisiones operativas
- Para crear una organizacion de la Asamblea se requiere propuesta y votacion en la Asamblea General
- Ejemplos: servicio electrico comunitario, transporte comunitario, sistema de agua

### Instituciones Publicas
- Subtipo especial de organizacion
- Presupuesto anual configurable
- Aumento de presupuesto requiere aprobacion de asamblea
- No pagan impuestos (tax_rate = 0)

### Servicios de Organizaciones

Las organizaciones pueden ofrecer servicios (ver `governance.md` para detalles completos):

- **Mensualidades** (subscription): la organizacion cobra al miembro
- **Beneficios** (benefit): la organizacion paga al miembro
- **Cobro unico** (one_time): pago una sola vez
- **Gratuitos** (amount=0): sin cobro, solo membresia
- **Obligatorios** (is_mandatory=true): todos los miembros deben cumplir
- **Voluntarios** (is_mandatory=false): suscripcion libre

El scheduler cobra/paga automaticamente segun la frecuencia configurada (mensual, trimestral, anual).

### Niveles de Organizacion

Los niveles de organizacion (`organization_levels`) definen limites y tasas de impuesto:

| Nivel | Limite | Tasa |
|-------|--------|------|
| org_produccion | -100000 / +100000 | 2% |
| org_consumo | -50000 / +50000 | 1% |
| org_publica | -1000000 / +1000000 | 0% (exenta) |
| org_cooperativa | -200000 / +200000 | 1% |

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
