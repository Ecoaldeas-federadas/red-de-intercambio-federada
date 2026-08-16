# Asambleas

## Tablas
- `assembly_sessions`: Sesiones de asamblea
- `assembly_decisions`: Decisiones con multi-firma

## Sesiones de Asamblea

### Campos
- `session_type`: ordinaria, extraordinaria, urgente
- `title`, `description`: descripcion de la sesion
- `start_time`, `end_time`: duracion
- `status`: scheduled, active, closed
- `participants`: lista de UUIDs de participantes

## Decisiones

### Campos
- `decision_type`: tipo de decision (cambio de limite, admision, expulsion, presupuesto, etc.)
- `target_account`: cuenta afectada (si aplica)
- `old_value`, `new_value`: valores antes/despues (JSONB)
- `required_signatures`: firmas necesarias
- `collected_signatures`: firmas acumuladas (JSONB)
- `status`: pending, approved, executed, rejected

### Multi-firma
- Cada decision requiere N firmas (configurable)
- Las firmas se acumulan hasta alcanzar `required_signatures`
- Al alcanzar el umbral, la decision se ejecuta automaticamente

## Tipos de Decision

| Tipo | Descripcion |
|------|-------------|
| `limit_change` | Cambio de limites de credito/debito |
| `admission` | Aprobacion de admision de miembro |
| `expulsion` | Expulsion de miembro |
| `budget_increase` | Aumento de presupuesto de institucion publica |
| `federation_config` | Cambio de configuracion de federacion |
| `recovery_config` | Cambio de configuracion de recuperacion |
| `tax_change` | Cambio de tasa de impuesto |
| `level_create` | Creacion de nuevo nivel de miembro |
| `level_modify` | Modificacion de nivel existente |

## Quorum

- `counts_in_quorum`: define si un miembro cuenta para el quorum
- El quorum se calcula sobre miembros activos con `has_voice = true`
- Configurable por nodo
