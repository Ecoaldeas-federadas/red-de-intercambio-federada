# Gobernanza - Ley de la Aldea

## Resumen

El sistema incluye un modulo de gobernanza completo que define las reglas de convivencia de la ecoaldea: la "Ley de la Aldea". Estas reglas son editables por el administrador y se muestran a los visitantes en la pagina publica, a los aspirantes en el formulario de admision (con aceptacion obligatoria) y a los miembros en el panel de administracion.

## Los Tres Niveles de Gobernanza

El sistema tiene **tres niveles de gobernanza**, cada uno independiente internamente
pero sujeto al nivel superior:

| Nivel | Que decide | Quien decide | Ejemplos |
|-------|-----------|-------------|----------|
| **Federacion** (mundial) | Cosas que afectan a todos los nodos del mundo | Todos los nodos por votacion | Canasta TQ, expulsion, protocolo |
| **Aldea/Nodo** (local) | Cosas que afectan a toda la comunidad local | Asamblea del nodo | Sueldos, horarios, catalogo, tasas |
| **Organizacion** (dentro de la aldea) | Cosas que afectan solo a la organizacion | Asamblea de la organizacion | Reglas internas, departamentos |

### Nivel 1: Federacion (mundial)

Pocas cosas afectan a toda la red. Se deciden por votacion igualitaria de todos los
nodos federados. Ver [federation_governance.md](federation_governance.md) para detalles.

- **Canasta basica TQ:** La misma en todos los nodos. La moneda trueque no tiene
  inflacion, asi que la canasta tiene que ser exactamente la misma en todas partes.
  Si un pais tiene una canasta mas alta y otro mas baja, se crea riqueza en un lado
  y pobreza en el otro.
- **Limite de credito global** para todos los nodos.
- **Expulsion de un nodo** que perjudica la red.
- **Protocolo de comunicacion, criptografia NFC, estructura del ledger.**

**Importante:** La canasta federada no tiene nada que ver con el comercio exterior.
Cada nodo hace su comercio exterior directamente en su moneda local (UYU, VES, ARS).
El Factor de Conversion (FC) calcula el equivalente con TQ, pero eso es interno de
cada nodo.

### Niveles de Nodo Federado

Dentro del nivel de Federacion, cada nodo federado tiene un **nivel de nodo** que
determina sus capacidades dentro de la red. Esto es distinto de los niveles de
miembro dentro de un nodo (aspirante, provisional, pleno): los niveles de nodo
son un concepto de la federacion, no de la comunidad local.

| Nivel | Nombre | Limite TQ | Antiguedad minima | Voto federado | Puede apadrinar |
|-------|--------|----------|-------------------|---------------|-----------------|
| 1 | Nodo Nuevo | 1.000 TQ | 90 dias | No | No |
| 2 | Nodo Aceptado | 5.000 TQ | 180 dias | Si | Si |
| 3 | Nodo Pleno | 20.000 TQ | - | Si | Si |

- **Nodo Nuevo (Nivel 1):** Nodo recien federado. Tiene un limite bajo de
  intercambio inter-nodos (1.000 TQ). No participa en votaciones federadas ni
  puede apadrinar a otros nodos. Debe permanecer al menos 90 dias en este nivel
  antes de poder solicitar ascenso.
- **Nodo Aceptado (Nivel 2):** Nodo que ha demostrado reciprocidad y confianza.
  Limite de 5.000 TQ. Puede votar en propuestas federadas y apadrinar nodos
  nuevos. Requiere minimo 180 dias y aprobacion por votacion federada.
- **Nodo Pleno (Nivel 3):** Nodo con plena confianza en la red. Limite de
  20.000 TQ. El ascenso es automatico cuando se cumple reciprocidad con los
  demas nodos y el limite promedio lo permite.

**Sistema de padrino:** Cuando un nodo nivel 2+ apadrina a un nodo nuevo, su
propio limite se reduce temporalmente por el monto del limite del nodo
apadrinado. Si el nodo apadrinado entra en default, la deuda se transfiere al
padrino. Cuando el nodo apadrinado alcanza el nivel 2, el limite del padrino se
libera.

Estos niveles se gestionan mediante las tablas `federation_node_levels`,
`federation_node_membership` y `federation_sponsorships` (migraciones 129-130).

### Nivel 2: Aldea / Nodo (local)

Cada nodo es soberano. La asamblea del nodo decide todo lo que afecta a su comunidad.
**Este documento describe las reglas de este nivel** (la "Ley de la Aldea"):

- Reglas de convivencia (estructura, deberes, permitido, prohibido, faltas).
- Horas de trabajo y sueldos.
- Catalogo de productos y precios locales.
- Admision y expulsion de miembros del nodo.
- Tasas, comisiones, horarios de comercio.
- Sitio web publico, adaptaciones culturales.
- Comercio exterior con su moneda local.

### Nivel 3: Organizaciones (dentro de la aldea)

Un nodo puede tener varias organizaciones (cooperativas, parcelas, comisiones). Cada
organizacion es independiente dentro de su propio terreno, pero sujeta a las reglas
generales de la aldea. Dentro de cada organizacion puede haber departamentos.

- Asambleas de organizacion (sesiones, propuestas, votaciones con scope limitado).
- Reglas internas de cada organizacion.
- Departamentos con roles y permisos especificos.

Las reglas mas grandes (las de la aldea) engloban las cosas mas comunes entre todos.
Las reglas de cada organizacion solo afectan dentro de su terreno. Las reglas
universales afectan al mundo entero.

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

### Junta Directiva del Nodo

La Asamblea General tiene su propia Junta Directiva que toma **decisiones
operativas** del nodo. Esto separa las decisiones grandes (que requieren
asamblea) de las decisiones del dia a dia (que la junta puede tomar mas
frecuentemente).

**Decisiones de la Junta Directiva del nodo**:
- Creacion de cuentas contables
- Cambios de limites de credito/debito
- Modificacion de productos del catalogo
- Distribucion de fondos (operativa)
- Aumento de presupuesto

**Decisiones de la Asamblea General** (no delegables a la junta):
- Admision y expulsion de miembros
- Cambios de impuestos y tarifas energeticas
- Configuracion de federacion
- Reglas de gobernanza
- Niveles de miembros
- Politicas generales

**La Asamblea decide** que decisiones delega a la junta. Puede cambiar el
`approval_method` de cualquier tipo de propuesta (de `assembly` a `board`
o viceversa) mediante una propuesta de configuracion.

**Quorum de la junta**: se calcula sobre los miembros activos de la junta
(no sobre todos los miembros del nodo). Si la junta tiene 5 miembros y el
quorum es 50%, se necesitan 3 presentes.

**Cambiar el quorum de la junta** es decision de la Asamblea, no de la junta.

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
- `070_board_meetings.sql` - Reuniones de junta directiva (meeting_type) en orgs
- `080_node_board_meetings.sql` - Junta Directiva del nodo (meeting_type en assembly_sessions)
- `082_board_decision_routing.sql` - Reclasificar decisiones operativas a Junta Directiva
- `129_federation_node_levels.sql` - Niveles de nodo federado, membresia y padrinos

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
