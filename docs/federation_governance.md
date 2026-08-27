# Gobernanza Federada

La red de intercambio federada tiene **tres niveles de gobernanza**. Este documento
describe el nivel mas alto: la gobernanza federada (mundial).

## Los tres niveles

| Nivel | Que decide | Quien decide |
|-------|-----------|-------------|
| **Federacion** (mundial) | Cosas que afectan a todos los nodos del mundo | Todos los nodos por votacion |
| **Aldea/Nodo** (local) | Cosas que afectan a toda la comunidad local | Asamblea del nodo |
| **Organizacion** (dentro de la aldea) | Cosas que afectan solo a la organizacion | Asamblea de la organizacion |

Cada nivel es independiente internamente pero sujeto al nivel superior. Las reglas
mas grandes (las de la aldea) engloban las cosas mas comunes entre todos. Las reglas
de cada organizacion solo afectan dentro de su terreno. Las reglas universales
afectan al mundo entero.

---

## Que valores son federados

Estos valores no los puede cambiar un nodo por su cuenta. Para cambiarlos, se necesita
el **consenso de los nodos federados**.

| Constante | Valor por defecto | Descripcion |
|-----------|-------------------|-------------|
| `basket_cost_internal_tq` | 500 | Costo de la canasta basica interna en TQ. Es el mismo en todos los nodos. |
| `fc_approval_threshold` | 100 | Porcentaje de nodos que deben aprobar un cambio. Por defecto 100% (todos). |
| `proposal_expiry_days` | 30 | Dias para que una propuesta expire si no alcanza consenso. |

### Por que la canasta basica es federada

La canasta basica interna determina cuanto vale 1 TQ en terminos de poder adquisitivo.
La moneda trueque no tiene inflacion, asi que la canasta basica tiene que ser
**exactamente la misma en todas partes**. Si un pais tiene una canasta mas alta y otro
mas baja, se crea riqueza en un lado y pobreza en el otro, rompiendo el principio de
igualdad.

Por eso la canasta interna es la misma en todos los nodos. Solo se puede cambiar mediante
una propuesta federada aprobada por consenso.

### La canasta federada NO es lo mismo que el comercio exterior

Esto es importante aclararlo:

- **Canasta basica federada:** Es el valor interno de la moneda trueque. Es la misma
  en todos los nodos. No tiene inflacion. Se decide por votacion de todos los nodos.

- **Comercio exterior:** Cada nodo hace su propio comercio exterior directamente en su
  moneda local (UYU, VES, ARS, COP, MXN, etc.). El Factor de Conversion (FC) calcula
  el equivalente entre TQ y la moneda local para el comercio externo. Esto es interno
  de cada nodo y **no afecta la canasta basica federada**.

- **Horas de trabajo y sueldos:** Cada nodo decide cuanto necesita una persona para
  comer en un dia, cuantas horas trabaja, y cuanto gana. Esto se maneja directamente
  en el nodo y **no afecta la canasta basica federada**.

### Que mas se decide a nivel federado

Ademas de la canasta basica, estas cosas requieren aprobacion de todos los nodos:

- **Limite de credito global** para todos los nodos.
- **Expulsion de un nodo** que perjudica la red.
- **Protocolo de comunicacion** entre nodos (API federada, mTLS).
- **Metrica de valor de la moneda trueque** (1 TQ = 1 kWh).
- **Protocolo criptografico de tarjetas NFC.**
- **Estructura del ledger contable.**
- **Umbral de aprobacion** (por defecto 100%).

---

## Como funciona el consenso

### Umbral por defecto: 100% (todos los nodos)

Por defecto, **todos los nodos federados deben aprobar** un cambio para que se aplique. Esto significa:

- Si hay 1 nodo: sus propuestas se auto-aprueban (es el 100%)
- Si hay 2 nodos: ambos deben aprobar
- Si hay 5 nodos: los 5 deben aprobar
- Si un nodo rechaza, el cambio no se aplica

### Cambiar el umbral

El umbral de aprobacion es una constante federada. Se puede cambiar, pero para cambiarlo se necesita la aprobacion bajo el **umbral actual**:

1. El umbral actual es 100% (todos)
2. Un nodo propone cambiarlo a 50%+1
3. Esa propuesta necesita el 100% de aprobacion (umbral actual)
4. Si todos aprueban, el umbral cambia a 50%+1
5. A partir de ahi, las futuras propuestas solo necesitan 50%+1

### Nodos nuevos

Cuando un nodo nuevo se une a la federacion, **acepta las politicas existentes**. No puede tener un umbral diferente al resto. Si el umbral es 100% y hay 3 nodos, ahora se necesitan los 3 (sigue siendo 100%).

---

## Proceso de una propuesta

```
1. Un nodo crea una propuesta
   ├── Selecciona la constante a cambiar
   ├── Ingresa el nuevo valor
   ├── Escribe una descripcion del por que
   └── El nodo proponente auto-aprueba

2. La propuesta se comparte con todos los nodos federados

3. Cada nodo revisa la propuesta
   ├── Puede aprobar
   └── Puede rechazar

4. El sistema verifica el consenso
   ├── Si aprobaciones >= umbral -> cambio aplicado en todos
   ├── Si rechazos > (100 - umbral) -> propuesta rechazada
   └── Si no se alcanza ninguno -> sigue pendiente

5. Si se aprueba:
   ├── La constante se actualiza
   ├── El cambio es efectivo en todos los nodos
   └── La propuesta queda marcada como "approved"

6. Si se rechaza o expira:
   ├── Se sigue usando el valor actual
   └── La propuesta queda marcada como "rejected" o "expired"
```

---

## Ejemplo practico

### Cambiar la canasta de 500 a 600

1. El nodo A crea una propuesta:
   - Constante: `basket_cost_internal_tq`
   - Valor actual: 500
   - Valor propuesto: 600
   - Descripcion: "Aumentar la canasta debido al aumento del costo de los alimentos"

2. El nodo A auto-aprueba (1/3 = 33%)

3. El nodo B revisa y aprueba (2/3 = 66%)

4. El nodo C revisa y aprueba (3/3 = 100%)

5. Como el umbral es 100% y se alcanzo, el cambio se aplica

6. Ahora todos los nodos tienen `basket_cost_internal_tq = 600`

### Cambiar el umbral de 100% a 50%+1

1. El nodo A crea una propuesta:
   - Constante: `fc_approval_threshold`
   - Valor actual: 100
   - Valor propuesto: 51
   - Descripcion: "Cambiar a mayoria simple para agilizar decisiones"

2. Como el umbral actual es 100%, **todos los nodos deben aprobar**

3. Si todos aprueban, el umbral cambia a 51%

4. A partir de ahora, las propuestas solo necesitan 51% para aprobarse

---

## API

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/federation-gov/constants` | GET | Listar constantes federadas |
| `/api/federation-gov/constants/{key}` | GET | Obtener una constante |
| `/api/federation-gov/proposals` | GET | Listar propuestas |
| `/api/federation-gov/proposals/{id}` | GET | Detalle de una propuesta con votos |
| `/api/federation-gov/proposals` | POST | Crear propuesta (requiere permiso) |
| `/api/federation-gov/proposals/{id}/vote` | POST | Votar (approve/reject) |
| `/api/federation-gov/proposals/{id}/remote-vote` | POST | Recibir voto de otro nodo |
| `/api/federation-gov/proposals/remote` | POST | Recibir propuesta de otro nodo |

---

## Tablas de la base de datos

### `federation_constants`

Valores compartidos por toda la federacion.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| key | VARCHAR(128) PK | Identificador de la constante |
| value | JSONB | Valor actual |
| description | TEXT | Descripcion para humanos |
| approved_proposal_id | UUID | Que propuesta aprobo este valor |
| updated_at | TIMESTAMPTZ | Ultima actualizacion |

### `federation_proposals`

Propuestas de cambios federados.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID PK | Identificador unico |
| proposal_type | VARCHAR(64) | Tipo de propuesta |
| key | VARCHAR(128) | Constante a cambiar |
| proposed_value | JSONB | Valor propuesto |
| current_value | JSONB | Valor actual al proponer |
| description | TEXT | Explicacion del cambio |
| proposed_by_node | VARCHAR(128) | Nodo que propone |
| status | VARCHAR(20) | pending, approved, rejected, expired |
| approval_threshold | INT | Umbral requerido (%) |
| total_nodes | INT | Total de nodos al crear |
| approvals | INT | Contador de aprobaciones |
| rejections | INT | Contador de rechazos |
| created_at | TIMESTAMPTZ | Fecha de creacion |
| expires_at | TIMESTAMPTZ | Fecha limite |
| applied_at | TIMESTAMPTZ | Cuando se aplico |

### `federation_votes`

Votos de cada nodo.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| proposal_id | UUID FK | Propuesta votada |
| voter_node | VARCHAR(128) | Nodo que vota |
| vote | VARCHAR(10) | approve o reject |
| voted_at | TIMESTAMPTZ | Fecha del voto |
| notes | TEXT | Notas opcionales |

---

## Seguridad

- Solo usuarios con permiso `federation.change_config` pueden crear propuestas y votar
- Un nodo solo puede votar una vez por propuesta (UNIQUE constraint)
- El nodo proponente auto-aprueba su propuesta
- Las propuestas expiran si no alcanzan consenso en el tiempo definido
- Los cambios se aplican automaticamente al alcanzar el umbral
- No se puede cambiar una constante sin propuesta aprobada

---

## Expulsion de nodos

La federacion puede expulsar un nodo con mal comportamiento (por ejemplo,
un nodo que se niega a votar y bloquea todos los cambios).

### Proceso de expulsion

1. Un nodo crea una propuesta tipo `expel_node` indicando:
   - Dominio del nodo a expulsar
   - Razon de la expulsion
2. Todos los nodos votan bajo el umbral actual (por defecto 100%)
3. Si se aprueba:
   - El nodo se marca como `expelled` en `federation_expelled_nodes`
   - No puede participar en la federacion
   - No puede comerciar con nodos federados
4. El nodo expulsado puede solicitar reingreso despues

### Reingreso despues de expulsion

Cuando un nodo expulsado solicita reingreso:
- Debe ser aceptado por la federacion (proceso normal de admision)
- **Hereda automaticamente todas las reglas existentes**
- No vota sobre reglas previas (las acepta al unirse)
- Las reglas incluyen: canasta basica, umbral de aprobacion, etc.

### Por que se puede expulsar un nodo

- Se niega sistematicamente a votar propuestas, bloqueando cambios
- Tiene mal comportamiento comprobado
- Viola las reglas de la federacion
- Compromete la seguridad del sistema

### Tablas

#### `federation_expelled_nodes`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| node_domain | VARCHAR(128) PK | Dominio del nodo expulsado |
| expelled_by_proposal | UUID | Propuesta que aprobo la expulsion |
| reason | TEXT | Razon de la expulsion |
| expelled_at | TIMESTAMPTZ | Fecha de expulsion |
| reentry_allowed_at | TIMESTAMPTZ | Cuando puede solicitar reingreso |

#### `federation_known_nodes`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| node_domain | VARCHAR(128) PK | Dominio del nodo |
| node_name | VARCHAR(128) | Nombre descriptivo |
| discovered_via | VARCHAR(128) | A traves de que nodo se descubrio |
| is_direct_peer | BOOLEAN | True si es peer directo |
| is_expelled | BOOLEAN | True si fue expulsado |
| node_number | INT | Numero de nodo SIP |
| last_seen | TIMESTAMPTZ | Ultima vez visto |
| discovered_at | TIMESTAMPTZ | Cuando se descubrio |

---

## Estructura de la red: cadena de nodos

La federacion no requiere que todos los nodos esten conectados directamente
con todos. Es una **red en cadena**:

```
    A --- B --- C --- D
          |
          E --- F
```

- A esta federado directamente con B
- B esta federado con A, C y E
- C esta federado con B y D
- A no esta directamente federado con C, D, E ni F

### Que significa esto

1. **Comercio bilateral**: A solo comercia directamente con B.
   Para comerciar con C, necesita federarse directamente con C.

2. **Decisiones globales**: Las votaciones de la federacion aplican a
   TODOS los nodos de la red, aunque no esten directamente federados.
   Si A propone cambiar la canasta basica, todos votan (A, B, C, D, E, F).

3. **Propagacion de reglas**: Cuando un nodo nuevo se une (por ejemplo, G
   se feder con D), hereda automaticamente todas las reglas existentes.
   No vota sobre reglas previas.

4. **Expulsion**: Si un nodo es expulsado, todos los nodos de la red
   dejan de comerciar con el, aunque no esten directamente federados.

### Por que las decisiones aplican a todos

Aunque A no este directamente federado con C, las decisiones globales
afectan a A porque:
- B esta federado con C
- B esta sujeto a las decisiones globales
- B cambiara sus parametros segun las decisiones
- A esta federado con B
- A necesita tener los mismos parametros que B para que el comercio funcione
- Por lo tanto, A tambien necesita cambiar

Es una **cadena de dependencia**: las decisiones se propagan a traves
de los nodos interconectados.

### Nodos conocidos

El endpoint `/api/federation-gov/known-nodes` muestra todos los nodos
de la red, no solo los peers directos. Los nodos se descubren via:
- Peers directos (registrados en `node_federation_keys`)
- Propagacion (un peer directo informa sobre sus propios peers)
- Propuestas y votaciones (se ven los dominios de quienes votan)

### Sincronizacion de constantes

El endpoint `/api/federation-gov/sync-constants` devuelve todas las
constantes federadas y los nodos expulsados. Un nodo nuevo lo usa al
unirse para heredar automaticamente todas las reglas existentes.

---

## API de expulsion y nodos

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/federation-gov/expelled` | GET | Listar nodos expulsados |
| `/api/federation-gov/known-nodes` | GET | Listar todos los nodos de la red |
| `/api/federation-gov/sync-constants` | GET | Constantes + expulsados (para nodos nuevos) |
| `/api/federation-gov/proposals` | POST | Crear propuesta (tipo `expel_node` para expulsion) |
