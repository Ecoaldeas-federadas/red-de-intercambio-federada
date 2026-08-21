# Gobernanza - Ley de la Aldea

## Resumen

El sistema incluye un modulo de gobernanza completo que define las reglas de convivencia de la ecoaldea: la "Ley de la Aldea". Estas reglas son editables por el administrador y se muestran a los visitantes en la pagina publica, a los aspirantes en el formulario de admision (con aceptacion obligatoria) y a los miembros en el panel de administracion.

## Componentes

### 1. Tabla `governance_rules`

Almacena las reglas de gobernanza con las siguientes categorias:

| Categoria | Descripcion |
|-----------|-------------|
| `estructura` | Como se gobierna la aldea (asamblea, circulos, junta) |
| `deberes` | Obligaciones de los miembros (cayapa, agroecologia, TQ) |
| `permitido` | Lo que se puede hacer |
| `prohibido` | Lo que no se puede hacer |
| `faltas_leves` | Infracciones leves y sanciones |
| `faltas_graves` | Infracciones graves y sanciones |
| `faltas_muy_graves` | Causales de expulsion |
| `admision` | Proceso para unirse (3 fases) |
| `salida` | Proceso de retiro y FRNE |
| `impuestos` | Como funcionan los impuestos |
| `tierra` | Tenencia de la tierra (fideicomiso) |

Cada regla tiene:
- `severity`: info, leve, grave, muy_grave
- `icon`: icono de la libreria lucide
- `sort_order`: orden dentro de la categoria
- `is_active`: se puede desactivar sin eliminar

### 2. Endpoints API

#### Publicos (sin auth)
- `GET /api/public/governance` - Lista todas las reglas activas

#### Privados (requieren auth)
- `GET /api/governance/rules` - Lista todas las reglas
- `POST /api/governance/rules` - Crear regla (requiere `governance.manage`)
- `PUT /api/governance/rules/{id}` - Actualizar regla (requiere `governance.manage`)
- `DELETE /api/governance/rules/{id}` - Eliminar regla (requiere `governance.manage`)

### 3. Pagina Publica

La pagina `/p/gobernanza` muestra todas las reglas agrupadas por categoria:
- Estructura de Gobernanza (asamblea, circulos, junta, doble enlace, organizaciones, departamentos)
- Deberes de los Miembros (agroecologia, cayapa, TQ, semillas, asambleas)
- Lo Que Esta Permitido (bioconstruccion, banos secos, microrred, comercio TQ, organizaciones, federacion)
- Lo Que Esta Prohibido (agroquimicos, venta de tierra, usura, acumulacion, quema, quimicos)
- Faltas y Sanciones (leves, graves, muy graves)
- Proceso de Admision (3 fases: aspirante, provisional, pleno)
- Proceso de Salida y Restitucion (FRNE, pago diferido, expulsion)
- Tenencia de la Tierra (fideicomiso, usufructo, no venta)
- Impuestos y Fondo Comunitario

### 4. Interfaz Admin

La pagina `/app/governance` permite:
- Ver todas las reglas agrupadas por categoria
- Filtrar por categoria
- Crear nuevas reglas
- Editar reglas existentes
- Eliminar reglas
- Requiere permiso `governance.manage` o `config.manage`

### 5. Integracion con Admision

El formulario de admision publica (`DynamicAdmissionForm`) carga las reglas de gobernanza desde `/api/public/governance` y muestra:
- Un resumen de cuantas reglas hay
- Un boton "Leer reglas" que despliega todas las reglas con su severidad
- Un checkbox de aceptacion obligatoria: "He leido y acepto la Ley de la Aldea"
- Si no se acepta, no se puede enviar la solicitud

## Estructura de Gobernanza

### Jerarquia

```
Nodo / Asamblea General (organo maximo)
  ├── Organizaciones de la Asamblea (is_assembly_owned=true)
  │     ├── Sus decisiones se votan en la Asamblea General
  │     ├── Tienen junta directiva propia (reuniones separadas)
  │     ├── Todos los miembros del nodo son automaticamente miembros
  │     └── Departamentos (pertenecen a la organizacion)
  ├── Organizaciones regulares
  │     ├── Tienen su propia asamblea interna (todos los miembros de la org)
  │     ├── Tienen junta directiva propia (reuniones separadas)
  │     ├── Pueden ofrecer servicios (mensualidades, cobros, pagos)
  │     └── Departamentos (pertenecen a la organizacion)
  └── Departamentos (pueden pertenecer al nodo directamente)
```

- **El nodo** es la unidad federada independiente.
- **La Asamblea General** es el organo maximo de decision del nodo.
- **Las organizaciones de la Asamblea** pertenecen a la Asamblea. Todos los miembros del nodo son automaticamente miembros. Sus decisiones se votan en la Asamblea General.
- **Las organizaciones regulares** pertenecen a personas, y las personas pertenecen a la asamblea. Tienen su propia asamblea interna.
- **Los departamentos** deben pertenecer a una organizacion o al nodo/asamblea. No pueden existir aislados ni pertenecer a una persona.

### Asamblea General

Organo maximo de decision del nodo. Sus decisiones afectan a todo el nodo:
- Admision y expulsion de miembros del nodo
- Cambios de impuestos y tarifas energeticas
- Configuracion de la federacion
- Distribucion de fondos de la cuenta de la asamblea
- Reglas de gobernanza
- Niveles de miembros
- Creacion de organizaciones de la Asamblea
- Politicas generales del nodo

**La asamblea del nodo NO puede transferir dinero directamente a personas.** Solo puede transferir a organizaciones y departamentos. Estos, a su vez, deciden como distribuir el dinero (incluyendo pagos a personas).

### Organizaciones de la Asamblea

Las organizaciones de la Asamblea (`is_assembly_owned = true`) son un tipo especial:
- **Pertenecen a la Asamblea**, no a una persona.
- **Todos los miembros del nodo** son automaticamente miembros.
- **Los miembros nuevos** se auto-suscriben al ser admitidos al nodo.
- **Sus decisiones se votan en la Asamblea General** del nodo, no en una asamblea separada.
- **Tienen junta directiva propia** que puede tomar decisiones operativas.
- **Sus servicios obligatorios** aplican a todos los miembros del nodo.
- **Para crear una organizacion de la Asamblea** se requiere propuesta y votacion en la Asamblea General.

Ejemplos: servicio electrico comunitario, transporte comunitario, sistema de agua.

### Asambleas de Organizaciones Regulares

Las organizaciones regulares tienen su propia asamblea interna con todos sus miembros (junta directiva + miembros suscritos a servicios). **No es obligatorio**: una organizacion con un solo miembro o que no necesite asambleas puede desactivarlas.

Las decisiones de la asamblea de organizacion **son diferentes** a las de la asamblea del nodo:
- **NO pueden decidir** sobre admision/expulsion del nodo, impuestos del nodo, federacion, etc.
- **SI pueden decidir** sobre: presupuesto de la org, distribucion de fondos de la org, politicas internas, creacion de cuentas, admision a la org, expulsion de la org, servicios obligatorios.

**Las organizaciones pueden transferir dinero a organizaciones, departamentos y personas.**

### Asambleas de Departamentos

Los departamentos pueden tener su propia asamblea interna. **No es obligatorio**: un departamento con un solo miembro puede desactivar las asambleas y operar solo con el responsable.

Las decisiones de la asamblea de departamento **son diferentes** a las de la asamblea del nodo:
- **NO pueden decidir** sobre asuntos del nodo.
- **SI pueden decidir** sobre: distribucion de fondos del depto, politicas del depto, admision al depto.

**Los departamentos pueden transferir dinero a organizaciones, departamentos y personas.**

### Juntas Directivas

Cada organizacion tiene su propia junta directiva. Los cargos son configurables (presidente, vicepresidente, secretario, tesorero, coordinador, miembro).

La junta directiva tiene su propio espacio de reunion (separado de la asamblea):
- **Reuniones de junta directiva** (`meeting_type = 'board'`): solo miembros de la junta participan.
- **Reuniones de asamblea** (`meeting_type = 'assembly'`): todos los miembros participan.

Ambos tipos de reunion tienen: sesiones, propuestas, votaciones, actas, asistencia, config de quorum, reportes.

Las juntas directivas pueden tomar **decisiones operativas** que no requieren aprobacion de la asamblea: coordinacion de actividades, gastos menores, asignacion de tareas, nombramientos internos.

**Para organizaciones de la Asamblea**: la junta directiva es la de ESA organizacion, no la junta directiva de la Asamblea. Las decisiones de la asamblea se votan en la Asamblea General, pero la junta directiva de la organizacion tiene sus propias reuniones operativas.

### Servicios de Organizaciones

Las organizaciones pueden ofrecer servicios con las siguientes configuracion:

| Campo | Valores | Descripcion |
|-------|---------|-------------|
| `service_type` | `subscription`, `benefit`, `one_time` | Cobro al miembro, pago al miembro, o cobro unico |
| `amount` | 0 o positivo | 0 = gratuito, positivo = monto en TQ |
| `frequency` | `monthly`, `quarterly`, `annual` | Cada cuanto se cobra/paga |
| `is_mandatory` | true/false | Si es obligatorio para todos los miembros |
| `obligations` | texto | Obligaciones del miembro |
| `rights` | texto | Derechos del miembro |
| `duties` | texto | Deberes del miembro |

- **Servicios obligatorios** en organizaciones de la Asamblea: aplican a todos los miembros del nodo, auto-suscritos.
- **Servicios obligatorios** en organizaciones regulares: aplican a todos los miembros de la organizacion, requieren votacion.
- **Servicios voluntarios**: los miembros se suscriben y cancelan libremente.
- **Servicios gratuitos** (monto=0): sin cobro, solo registro de membresia.
- **Servicios que pagan al miembro** (`benefit`): la organizacion transfiere dinero al miembro mensualmente.
- El scheduler cobra/paga automaticamente segun la frecuencia configurada.

## Proceso de Admision (3 Fases)

1. **Aspirante (1-3 meses)**: Vive en area de visitantes, participa en cayapas, acceso limitado a TQ
2. **Residente Provisional (6-12 meses)**: Asignacion de espacio temporal, voz pero no voto
3. **Miembro Pleno**: Consentimiento del Circulo de Convivencia, firma del Acuerdo de Vida Conuquera, parcela y conuco, limites completos (-500/+500 TQ)

## Formula de Restitucion No Especulativa (FRNE)

```
R_neto = I_ini - D_desgaste - C_restauracion +/- B_TQ - T_salida
```

- `I_ini`: Inversion en materiales (adobes, madera, paneles solares)
- `D_desgaste`: Amortizacion anual (3-4% sobre valor de construccion)
- `C_restauracion`: Costo de reparar danos al territorio
- `B_TQ`: Balance contable TQ (negativo se resta, positivo se suma)
- `T_salida`: 15% de retencion solidaria para el Fondo Comunitario

Pago diferido en cuotas mensuales (12-24 meses) para no desestabilizar la economia del nodo.

## Tenencia de la Tierra

- **Fideicomiso Comunitario**: La tierra es colectiva, indivisible e inalienable
- **Derecho de Usufructo**: Se otorga mientras la membresia este activa
- **Prohibicion de Venta**: No se puede vender a terceros en el mercado abierto

## Migraciones

- `048_governance_rules.sql` - Crea la tabla y inserta el seed inicial con ~40 reglas
- `049_governance_assembly.sql` - Estructuras de asamblea, decisiones y votos
- `050_voting_deadline.sql` - Plazos de votacion
- `051_assembly_attendance.sql` - Asistencia y doble validacion
- `052_quorum_config.sql` - Quorum configurable, gracia, reprogramacion
- `053_proposal_review_flow.sql` - Flujo de revision antes de votacion
- `054_scoped_assemblies.sql` - Asambleas de organizacion y departamento
- `055_assembly_convocation.sql` - Convocatoria automatica, frecuencia, notificaciones, tipos por scope
- `056_assembly_advance_tax.sql` - Tiempos minimos de anticipacion, cuenta predefinida de impuestos
- `057_department_parent.sql` - Departamentos con organizacion padre
- `064_new_governance_rules_community.sql` - 24 reglas de comunidad intencional
- `069_organization_services.sql` - Servicios, suscripciones, is_assembly_owned
- `070_board_meetings.sql` - Reuniones de junta directiva (meeting_type)

Permiso `governance.manage` para gestionar las reglas.

## Archivos Relevantes

- `internal/db/migrations/048_governance_rules.sql` - Migracion y seed
- `internal/api/system.go` - Endpoints API CRUD
- `internal/api/assembly.go` - Asamblea del nodo
- `internal/api/scoped_assembly.go` - Asambleas de org/depto + juntas directivas
- `internal/api/services_handler.go` - API de servicios y suscripciones
- `internal/api/subscription_scheduler.go` - Scheduler de cobros mensuales
- `internal/accounts/services.go` - Modelo de servicios y suscripciones
- `internal/db/demo_seed.go` - Seed con organizaciones de la Asamblea
- `web/src/pages/Governance.tsx` - Interfaz admin
- `web/src/pages/Assembly.tsx` - UI de asamblea del nodo
- `web/src/pages/OrganizationDetail.tsx` - UI de organizacion con tabs de servicios y reuniones
- `web/src/pages/MyServices.tsx` - UI de mis servicios y suscripciones
- `web/src/components/ScopedAssembly.tsx` - UI de asambleas y juntas de org/depto
- `web/src/components/public-site/DynamicAdmissionForm.tsx` - Aceptacion en admision
- `web/src/components/public-site/PublicGovernancePage.tsx` - Pagina publica de gobernanza
- `web/src/App.tsx` - Rutas `/app/governance`, `/app/my-services`
- `web/src/components/Layout.tsx` - Enlaces en sidebar
