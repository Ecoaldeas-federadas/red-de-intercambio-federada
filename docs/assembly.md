# Asambleas

## Resumen

El sistema de asambleas permite la toma de decisiones democratica en tres niveles:
1. **Asamblea del nodo** (general) - decisiones del nodo completo
2. **Asamblea de organizacion** - decisiones internas de una organizacion
3. **Asamblea de departamento** - decisiones internas de un departamento

Ademas, cada organizacion tiene **dos espacios de decision**:
- **Asamblea** (`meeting_type = 'assembly'`): todos los miembros participan
- **Junta Directiva** (`meeting_type = 'board'`): solo la junta directiva participa

Cada nivel tiene su propio catalogo de propuestas. Las decisiones de un nivel no se mezclan con las de otro.

## Organizaciones de la Asamblea

Las organizaciones con `is_assembly_owned = true` pertenecen a la Asamblea:
- **No tienen asamblea separada**: sus decisiones se votan en la Asamblea General del nodo
- **Todos los miembros del nodo** son automaticamente miembros
- **Tienen junta directiva propia** para decisiones operativas
- **Sus servicios obligatorios** aplican a todos los miembros del nodo

## Juntas Directivas

Cada organizacion tiene su propia junta directiva con reuniones separadas:
- `meeting_type = 'board'`: solo miembros de la junta directiva votan
- `meeting_type = 'assembly'`: todos los miembros de la organizacion votan

Ambos tipos de reunion tienen: sesiones, propuestas, votaciones, actas, asistencia, quorum y reportes.

## Tablas

### Asamblea del nodo
- `assembly_sessions` - Sesiones de asamblea
- `assembly_decisions` - Decisiones propuestas
- `assembly_votes` - Votos de miembros
- `assembly_config` - Configuracion de quorum y aprobacion por tipo
- `assembly_attendance` - Asistencia a sesiones presenciales
- `assembly_quorum_config` - Quorum configurable por tipo de asamblea
- `assembly_frequency_config` - Frecuencia y convocatoria automatica
- `assembly_notifications` - Notificaciones a miembros

### Asambleas de org/depto
- `assembly_sessions_scoped` - Sesiones de asamblea de org/depto
- `assembly_decisions_scoped` - Decisiones propuestas
- `assembly_votes_scoped` - Votos
- `assembly_proposal_types` - Tipos de propuestas permitidos por scope

## Sesiones de Asamblea

### Campos
- `session_type`: ordinaria, extraordinaria, urgente
- `title`, `description`: descripcion de la sesion
- `start_time`, `end_time`: fecha y duracion (la fecha es obligatoria)
- `status`: scheduled, waiting_quorum, active, completed, cancelled, expired
- `is_presential`: si es presencial, solo votan los presentes en la lista
- `minutes`: minuta editable con eventos automaticos
- `recall_number`: numero de convocatoria (1ra, 2da, etc.)
- `is_auto_scheduled`: si fue creada automaticamente por la frecuencia configurada

### Tiempos minimos de anticipacion

No se puede crear una asamblea para "ahora mismo". El sistema exige:

| Tipo | Tiempo minimo |
|------|--------------|
| Ordinaria | 7 dias (168 horas) |
| Extraordinaria | 24 horas |
| Urgente | 1 hora |

Estos valores son configurables en `assembly_frequency_config`.

### Ordinaria vs Extraordinaria

- **Ordinaria**: asamblea planificada segun la frecuencia configurada (ej: cada 3 meses). Se crea automaticamente al cerrar la asamblea ordinaria anterior.
- **Extraordinaria**: asamblea adicional fuera del plan. Se crea manualmente.
- **Urgente**: decision rapida, minimo 1 hora de anticipacion.

Si se modifica la fecha de una asamblea ordinaria, sigue siendo ordinaria.
Si se crea una asamblea nueva mientras la ordinaria existe, es extraordinaria.

### Convocatoria automatica

- Se configura la frecuencia: mensual, trimestral (default), semestral o anual.
- Dia del mes preferido y hora.
- Al cerrar una asamblea ordinaria, se agenda automaticamente la siguiente.
- Los miembros reciben notificacion con N dias de anticipacion (configurable: 1, 3, 7, 14 o 30 dias).

### Filtros de sesiones

- `GET /api/assembly/sessions?filter=upcoming` - Proximas (scheduled, waiting_quorum, active)
- `GET /api/assembly/sessions?filter=past` - Pasadas (completed, cancelled, expired)

## Propuestas (Decisiones)

### Ciclo de vida

```
propuesta creada
      |
      v
  [proposed] -- pendiente de revision por la asamblea
      |
      v
  la asamblea revisa y abre la votacion
      |
      v
   [pending] -- votacion abierta con deadline
      |
      v
  los miembros votan (for/against/abstain)
      |
      v
  se ejecuta el resultado:
    - approved + ejecutada -> [executed]
    - rechazada -> [rejected]
    - expirada -> [expired]
```

### Campos
- `decision_type`: tipo de decision (ver catalogos por scope)
- `target_account`: cuenta afectada (si aplica)
- `old_value`, `new_value`: valores antes/despues (JSONB)
- `status`: proposed, pending, approved, executed, rejected, expired
- `voting_deadline`: plazo para votar
- `assembly_id`: sesion donde se discute

### Votacion

- **Voto secreto**: for, against, abstain. Las identidades de los votantes no se exponen en los informes publicos.
- **Informes publicos**: solo muestran cantidades agregadas (X a favor, Y en contra, Z abstenciones).
- **Aprobacion multisig**: las firmas si son visibles publicamente.
- **Quorum**: configurable por tipo de propuesta y tipo de asamblea.
- **Asistencia presencial**: doble validacion (auto-check-in + validacion por admin).

### Minutas automaticas

Los siguientes eventos se agregan automaticamente a la minuta:
- Creacion de propuesta
- Apertura de votacion
- Resultado (aprobada/rechazada)
- Reprogramacion de sesion
- Eventos de convocatoria

La minuta tambien es editable para que los miembros agreguen notas manuales.

## Tipos de Propuesta por Scope

### Asamblea del nodo (15 tipos)

| Tipo | Descripcion |
|------|-------------|
| `limit_change` | Cambio de limites de credito/debito |
| `admission` | Admision de miembro al nodo |
| `expulsion` | Expulsion de miembro del nodo |
| `budget_increase` | Aumento de presupuesto |
| `federation_config` | Configuracion de federacion |
| `recovery_config` | Configuracion de recuperacion |
| `tax_change` | Cambio de tasa de impuesto |
| `member_level` | Crear/modificar nivel de miembro |
| `policy` | Politica general del nodo |
| `create_account` | Crear cuenta contable |
| `fund_distribution` | Distribuir fondos de la asamblea |
| `energy_rate_change` | Cambio de tarifa energetica |
| `product_modification` | Modificacion de producto |
| `governance_rule` | Crear/modificar/eliminar regla de gobernanza |
| `free_proposal` | Propuesta libre |

### Organizacion (9 tipos)

| Tipo | Descripcion |
|------|-------------|
| `budget_increase` | Aumento de presupuesto de la org |
| `fund_distribution` | Distribuir fondos de la org |
| `policy` | Politica interna de la org |
| `create_account` | Crear cuenta contable de la org |
| `product_modification` | Modificar producto de la org |
| `limit_change` | Cambiar limites de la org |
| `admission` | Admision a la organizacion (NO al nodo) |
| `expulsion` | Expulsion de la organizacion (NO del nodo) |
| `free_proposal` | Propuesta libre |

### Departamento (4 tipos)

| Tipo | Descripcion |
|------|-------------|
| `fund_distribution` | Distribuir fondos del depto |
| `policy` | Politica del depto |
| `admission` | Admision al depto (NO al nodo) |
| `free_proposal` | Propuesta libre |

### Junta Directiva (3 tipos, solo meeting_type=board)

| Tipo | Descripcion |
|------|-------------|
| `board_operational` | Decision operativa: coordinacion, tareas, gastos menores |
| `board_financial` | Decision financiera: transferencias y pagos dentro de limites |
| `board_appointment` | Nombramiento interno: cambios de roles en la junta |

## Reglas de Transferencia

| Scope | Puede transferir a | No puede transferir a |
|-------|-------------------|---------------------|
| Asamblea del nodo | Organizaciones, Departamentos | **Personas** (nunca directamente) |
| Organizacion | Organizaciones, Departamentos, Personas | — |
| Departamento | Organizaciones, Departamentos, Personas | — |

### Ejemplo del flujo

1. La asamblea del nodo transfiere 1000 TQ al "Departamento de Pagos"
2. El Departamento de Pagos decide pagar a los trabajadores
3. El depto crea una propuesta de distribucion a una persona
4. Se vota en la asamblea del depto (o lo decide el responsable si no tiene asamblea)
5. Se ejecuta la transferencia a la persona

## Configuracion de Asambleas

### Frecuencia
- `ordinary_frequency_months`: 0 (no auto-convocar), 1, 3, 6, 12
- `preferred_day_of_month`: 1-28
- `preferred_hour`: 0-23
- `notification_days_before`: 1, 3, 7, 14, 30

### Quorum
- Configurable por tipo de propuesta
- Configurable por tipo de asamblea (ordinaria, extraordinaria, urgente)
- Gracia para segunda convocatoria
- Doble validacion de asistencia presencial

### Enable/disable
- Las organizaciones pueden activar/desactivar asambleas
- Los departamentos pueden activar/desactivar asambleas
- Si no tienen asambleas, las decisiones las toma el responsable o junta directiva

## API

### Asamblea del nodo

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/assembly/sessions` | Listar sesiones (filter=upcoming/past) |
| POST | `/api/assembly/sessions` | Crear sesion (fecha obligatoria) |
| GET | `/api/assembly/sessions/{id}` | Obtener sesion |
| POST | `/api/assembly/sessions/{id}/close` | Cerrar asamblea + auto-convocar siguiente |
| POST | `/api/assembly/sessions/{id}/reschedule` | Reprogramar (notifica a miembros) |
| GET | `/api/assembly/proposals` | Listar propuestas |
| POST | `/api/assembly/proposals` | Crear propuesta (estado: proposed) |
| POST | `/api/assembly/proposals/{id}/open-voting` | Abrir votacion (estado: pending) |
| POST | `/api/assembly/proposals/{id}/vote` | Votar (for/against/abstain) |
| POST | `/api/assembly/proposals/{id}/execute` | Ejecutar propuesta aprobada |
| GET | `/api/assembly/proposals/{id}/report` | Informe de votacion |
| GET | `/api/assembly/config` | Configuracion de quorum |
| PUT | `/api/assembly/config/{proposalType}` | Actualizar config |
| GET | `/api/assembly/frequency-config` | Config de frecuencia |
| PUT | `/api/assembly/frequency-config` | Actualizar frecuencia |
| GET | `/api/assembly/notifications` | Notificaciones del usuario |
| PUT | `/api/assembly/notifications/{id}/read` | Marcar como leida |
| GET | `/api/assembly/proposal-types` | Tipos permitidos por scope |
| GET | `/api/assembly/board` | Junta directiva del nodo |
| GET | `/api/assembly/voting-members` | Miembros con derecho a voto |

### Asambleas de org/depto

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/{scope}/{id}/assembly/sessions` | Listar sesiones |
| POST | `/api/{scope}/{id}/assembly/sessions` | Crear sesion |
| POST | `/api/{scope}/{id}/assembly/sessions/{id}/close` | Cerrar + auto-convocar |
| GET | `/api/{scope}/{id}/assembly/proposals` | Listar propuestas |
| POST | `/api/{scope}/{id}/assembly/proposals` | Crear propuesta |
| POST | `/api/{scope}/{id}/assembly/proposals/{id}/open-voting` | Abrir votacion |
| POST | `/api/{scope}/{id}/assembly/proposals/{id}/vote` | Votar |
| POST | `/api/{scope}/{id}/assembly/proposals/{id}/execute` | Ejecutar |
| GET | `/api/{scope}/{id}/assembly/config` | Config de asamblea |
| PUT | `/api/{scope}/{id}/assembly/config` | Actualizar config |
| GET | `/api/{scope}/{id}/assembly/proposal-types` | Tipos por scope |

Donde `scope` es `organization` o `department`.

### Juntas Directivas de Organizacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/organization/{id}/board/sessions` | Listar sesiones de junta |
| POST | `/api/organization/{id}/board/sessions` | Crear sesion de junta |
| GET | `/api/organization/{id}/board/proposals` | Listar propuestas de junta |
| POST | `/api/organization/{id}/board/proposals` | Crear propuesta de junta |
| POST | `/api/organization/{id}/board/proposals/{id}/open-voting` | Abrir votacion |
| POST | `/api/organization/{id}/board/proposals/{id}/vote` | Votar (solo junta directiva) |
| POST | `/api/organization/{id}/board/proposals/{id}/execute` | Ejecutar |
| GET | `/api/organization/{id}/board/config` | Config de quorum de junta |
| PUT | `/api/organization/{id}/board/config` | Actualizar config |
| GET | `/api/organization/{id}/board/proposal-types` | Tipos: board_operational, board_financial, board_appointment |
| GET | `/api/organization/{id}/board/reports` | Reportes de junta |
| POST | `/api/organization/{id}/board/sessions/{id}/close` | Cerrar sesion |

**Votantes en junta directiva**: solo miembros activos de `organization_board_members`.
**Votantes en asamblea de org regular**: junta directiva + miembros suscritos a servicios.
**Votantes en asamblea de org de la Asamblea**: todos los miembros activos del nodo.

## Migraciones

- `049_governance_assembly.sql` - Estructuras base
- `050_voting_deadline.sql` - Plazos de votacion
- `051_assembly_attendance.sql` - Asistencia y doble validacion
- `052_quorum_config.sql` - Quorum configurable
- `053_proposal_review_flow.sql` - Flujo proposed -> pending
- `054_scoped_assemblies.sql` - Asambleas de org/depto
- `055_assembly_convocation.sql` - Convocatoria automatica, tipos por scope
- `056_assembly_advance_tax.sql` - Tiempos minimos, cuenta de impuestos
- `058_attendance_window.sql` - Ventana de anticipacion para asistencia
- `070_board_meetings.sql` - Reuniones de junta directiva (meeting_type: assembly/board)

## Archivos Relevantes

- `internal/api/assembly.go` - Handlers de la asamblea del nodo
- `internal/api/scoped_assembly.go` - Handlers de asambleas y juntas de org/depto
- `web/src/pages/Assembly.tsx` - UI de la asamblea del nodo
- `web/src/components/ScopedAssembly.tsx` - UI de asambleas y juntas de org/depto
- `web/src/pages/OrganizationDetail.tsx` - UI de organizacion con tabs de asamblea y junta
