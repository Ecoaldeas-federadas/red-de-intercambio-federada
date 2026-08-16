# Auditoria

## Tabla
- `audit_log`: Registro inmutable de acciones

## Campos
- `actor_id`: Usuario que realizo la accion
- `action`: Tipo de accion
- `target_id`: Objeto afectado (opcional)
- `details`: Detalles en JSONB
- `ip_address`: IP desde donde se realizo
- `user_agent`: User agent del cliente
- `created_at`: Timestamp

## Acciones Auditadas

| Accion | Descripcion |
|--------|-------------|
| `login` | Inicio de sesion |
| `login_failed` | Intento de login fallido |
| `transfer` | Transferencia interna |
| `federation_transfer` | Transferencia federada |
| `admission_approve` | Aprobacion de admision |
| `admission_reject` | Rechazo de admision |
| `org_create` | Creacion de organizacion |
| `org_approve` | Aprobacion de organizacion |
| `limit_change` | Cambio de limites |
| `recovery_request` | Solicitud de recuperacion |
| `recovery_approve` | Aprobacion de recuperacion |
| `recovery_complete` | Completado de recuperacion |
| `assembly_decision` | Decision de asamblea |
| `external_operation` | Operacion de comercio externo |
| `config_change` | Cambio de configuracion |

## Verificacion Hash Chain

### Proceso
1. Recorrer todas las transacciones en orden cronologico
2. Recalcular `current_hash = SHA256(prev_hash + tx_data)`
3. Comparar con hash almacenado
4. Cualquier discrepancia indica manipulacion

### Transparencia
- Cualquier miembro con permiso `can_view_audit` puede ver el log
- El hash chain es publico y verificable
- Las entradas no se modifican ni eliminan

## Filtros de Consulta

- `GET /api/audit?action=transfer`: filtrar por accion
- `GET /api/audit?actor_id={uuid}`: filtrar por actor
- `GET /api/audit?from={date}&to={date}`: filtrar por rango de fechas
