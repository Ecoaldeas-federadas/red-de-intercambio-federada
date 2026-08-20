# Plan: Backups + Nodos YugabyteDB

## 1. Sistema de Backups

### 1.1 Configuracion (almacenada en BD)
- `backup_interval_hours`: cada cuanto hacer backup (default: 24)
- `backup_retention_days`: cuantos dias mantener backups (default: 7)
- `backup_enabled`: activar/desactivar backups automaticos (default: true)
- `backup_tables`: que tablas exportar (lista configurable)

### 1.2 Backend API
- `GET /api/admin/backups` - lista todos los backups (nombre, fecha, tamaño, locked)
- `GET /api/admin/backups/{filename}/download` - descarga un backup
- `DELETE /api/admin/backups/{filename}` - borra un backup (no locked)
- `PUT /api/admin/backups/{filename}/lock` - bloquea/desbloquea un backup
- `POST /api/admin/backups/now` - crear backup manual inmediato
- `GET /api/admin/backup-config` - obtener configuracion
- `PUT /api/admin/backup-config` - actualizar configuracion

### 1.3 Base de datos
- Tabla `backup_config` (una fila):
  - `id`, `interval_hours`, `retention_days`, `enabled`, `created_at`, `updated_at`
- Tabla `backup_files`:
  - `id`, `filename`, `size_bytes`, `is_locked`, `created_at`

### 1.4 Servicio db-backup (docker-compose)
- Lee configuracion de un archivo JSON en el volumen `/backups/config.json`
- El backend escribe ese archivo cuando cambia la configuracion
- El servicio lee el archivo cada vez que va a hacer un backup
- Los backups locked se marcan con un archivo `.lock` junto al `.sql`
- El servicio nunca borra archivos `.lock`
- Mantiene los backups segun `retention_days` pero nunca borra los locked

### 1.5 Frontend (NodeSettings.tsx - nuevo tab "Backups")
- Tabla con lista de backups:
  - Columnas: fecha, tamaño, estado (locked/unlocked), acciones
  - Acciones: descargar, borrar, bloquear/desbloquear
- Boton "Crear backup ahora"
- Seccion "Configuracion de backups":
  - Frecuencia (horas) - input numerico
  - Retencion (dias) - input numerico
  - Activar/desactivar - toggle
  - Guardar - boton
- Tooltips de ayuda en cada campo

---

## 2. Nodos YugabyteDB

### 2.1 Concepto
YugabyteDB soporta clusters multi-nodo con el flag `--join`.
Para agregar un nodo en otro servidor:
1. El servidor principal genera la configuracion
2. Se descarga un script que se ejecuta en el otro servidor
3. El script instala YugabyteDB y se une al cluster
4. Los datos se replican automaticamente

### 2.2 Backend API
- `GET /api/admin/yb-nodes` - lista nodos YugabyteDB configurados
- `POST /api/admin/yb-nodes` - crear nuevo nodo (genera config)
- `DELETE /api/admin/yb-nodes/{id}` - eliminar nodo de la lista
- `GET /api/admin/yb-nodes/{id}/script` - descargar script de instalacion

### 2.3 Base de datos
- Tabla `yugabyte_nodes`:
  - `id`, `node_name`, `host_ip`, `port`, `region`, `status`, `created_at`

### 2.4 Script descargable
El script generado:
- Instala Docker en el servidor remoto si no lo tiene
- Descarga la imagen de YugabyteDB
- Arranca YugabyteDB con `--join=<ip_principal>:7100`
- Configura el firewall si es necesario
- Incluye instrucciones claras

### 2.5 Frontend (NodeSettings.tsx - nuevo tab "Base de Datos")
- Lista de nodos YugabyteDB existentes
- Formulario para agregar nodo:
  - Nombre del nodo
  - IP del servidor remoto
  - Region (opcional)
  - Puerto (default 7100)
- Boton "Generar script de instalacion" - descarga .sh
- Boton "Descargar script" por cada nodo
- Instrucciones de uso explicadas en la UI
- Tooltips de ayuda

---

## 3. Implementacion

### Orden:
1. Migracion BD (tablas backup_config, backup_files, yugabyte_nodes)
2. Backend: handlers de backups
3. Backend: handlers de nodos YugabyteDB
4. Backend: generar script descargable
5. Frontend: tab Backups en NodeSettings
6. Frontend: tab Base de Datos en NodeSettings
7. Modificar db-backup service en docker-compose
8. Compilar, commit, push
9. Arrancar limpio

### Archivos a crear/modificar:
- `internal/db/migrations/066_backup_system.sql` (nueva migracion)
- `internal/api/backups.go` (nuevo handler)
- `internal/api/yugabyte_nodes.go` (nuevo handler)
- `internal/api/routes.go` (registrar rutas)
- `web/src/pages/NodeSettings.tsx` (nuevos tabs)
- `docker-compose.yml` (modificar db-backup service)
