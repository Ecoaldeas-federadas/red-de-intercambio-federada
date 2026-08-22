# Escalar YugabyteDB (limite de tabletas)

## El problema

YugabyteDB tiene un limite automatico de tabletas basado en la cantidad de
tservers (tablet servers) y la memoria de cada uno:

```
limite_total = num_tservers * max_tablets_per_tserver
```

Con 1 solo tserver y la configuracion por defecto, el limite es ~534 tabletas.
Cada tabla y cada indice crea tabletas. Con muchas migraciones, se puede
alcanzar este limite.

## Solucion: escalar el cluster

### Opcion 1: Subir el limite de tabletas (recomendado para un solo servidor)

YugabyteDB pone un limite conservador de ~534 tabletas por nodo para
servidores pequenos (2-4 vCPUs). Si tu servidor tiene suficiente RAM y CPU,
puedes subir el limite a 1000 o mas en un solo nodo.

Esto es **mas eficiente** que correr 2 nodos en el mismo servidor, porque:
- Un solo proceso gestiona la memoria de manera unificada
- No hay overhead de sincronizacion Raft entre nodos
- No hay competencia por CPU y tarjeta de red
- No hay falsa alta disponibilidad (si el servidor falla, ambos nodos caen)

#### Como subir el limite

En docker-compose.yml:

```yaml
yugabytedb:
  image: yugabytedb/yugabyte:latest
  command: ["bin/yugabyted", "start",
    "--base_dir=/mnt/master",
    "--background=false",
    "--advertise_address=yugabytedb",
    "--tserver_flags=max_num_tablets=1000"]
```

El flag `--tserver_flags=max_num_tablets=1000` sube el limite a 1000.

#### Requisitos de hardware

| Limite | RAM minima | vCPUs minimos |
|--------|-----------|---------------|
| 534    | 4 GB      | 2             |
| 1000   | 8 GB      | 4             |
| 2000   | 16 GB     | 8             |

### Opcion 2: Agregar mas nodos (para alta disponibilidad)

Para **alta disponibilidad real** (tolerancia a fallos de servidor), usa
nodos en **servidores separados**. NO corras multiples nodos en el mismo
servidor (desperdicia recursos y no da tolerancia a fallos).

Minimo recomendado: 3 nodos en servidores separados (RF=3).

```bash
# Servidor 1 (primer nodo)
bin/yugabyted start --base_dir=/mnt/master --advertise_address=SERVER1_IP

# Servidor 2
bin/yugabyted start --base_dir=/mnt/master --advertise_address=SERVER2_IP --join=SERVER1_IP

# Servidor 3
bin/yugabyted start --base_dir=/mnt/master --advertise_address=SERVER3_IP --join=SERVER1_IP
```

### Opcion 3: Usar colocation (para nuevas instalaciones)

Las tablas pequenas (configuracion, constantes, propuestas) pueden usar
`COLOCATION = true` para compartir una misma tableta. Esto requiere que
la base de datos se cree con colocation:

```sql
CREATE DATABASE mi_base_datos WITH colocated = true;
```

**Importante:** Solo funciona para bases de datos NUEVAS. Si la BD ya
existe sin colocation, no se puede forzar colocation por tabla (error:
"cannot set colocation true on a non-colocated database").

El proyecto ya crea bases de datos nuevas con colocation (connection.go),
pero las bases de datos existentes no se pueden migrar.

### Opcion 2: Usar colocation (ya implementado)

Las tablas pequenas (configuracion, constantes, propuestas) usan
`COLOCATION = true` para compartir una misma tableta. Esto reduce
drasticamente el numero de tabletas sin agregar nodos.

Solo las tablas grandes (transacciones, productos, usuarios) deben tener
sus propias tabletas.

### Opcion 3: Aumentar memoria del tserver

Si tus servidores tienen mas RAM, puedes aumentar el limite por tserver:

```bash
bin/yugabyted start --tserver_flags=max_tablets_per_tserver=1000
```

Esto requiere suficiente RAM (cada tableta consume ~1-2 GB con el tamano
por defecto).

## NO recomendado: desactivar el limite

```
--master_flags=enforce_tablet_replica_limits=false
```

Esto desactiva el limite de seguridad y puede causar:
- Fallos del cluster por falta de memoria
- Degradacion del rendimiento
- Inestabilidad

Solo usar en desarrollo/debug temporalmente.

## Como verificar el estado del cluster

```bash
# Conectarse a la consola de YugabyteDB
docker exec -it red-de-intercambio-federada-yugabytedb-1 bin/ysqlsh -h yugabytedb -U fmc

# Ver numero de tabletas
SELECT count(*) FROM yb_tablet_meta;

# Ver nodos del cluster
SELECT * FROM yb_cluster_info;
```

UI web: http://localhost:7000 (nodo 1) o http://localhost:7001 (nodo 2)

## Configuracion actual

El proyecto usa:
1. **1 nodo YugabyteDB** con `max_num_tablets=1000` (limite aumentado)
2. **Colocation** en bases de datos nuevas (connection.go)
3. **Sin indices secundarios innecesarios** en tablas pequenas
4. **Monitoreo automatico** del cluster (cluster_handler.go)

Para produccion con alta disponibilidad: 3 nodos en servidores separados.

## Monitoreo automatico del cluster

El sistema monitorea automaticamente el estado del cluster YugabyteDB:

### Que monitorea

- **Nodos activos**: cuantos nodos YugabyteDB estan corriendo
- **Tabletas usadas**: cuantas tabletas se estan usando
- **Limite total**: nodos_activos * 534
- **Porcentaje de uso**: tabletas_usadas / limite_total * 100
- **Nodos necesarios**: cuantos nodos mas se necesitan

### Niveles de alerta

| Nivel | Condicion | Accion |
|-------|-----------|--------|
| ok | Uso < 80% | Ninguna |
| warning | Uso >= 80% | Considerar agregar nodo |
| critical | Uso >= 90% o nodos < minimo | Agregar nodo urgentemente |

### Como ver el estado

1. **Frontend**: Configuracion > Base de Datos
   - Muestra metricas en tiempo real
   - Barra de progreso de capacidad
   - Boton "Verificar" para forzar verificacion
   - Instrucciones para agregar nodos

2. **API**: `GET /api/cluster/status`
   - Devuelve estado completo del cluster

3. **Notificaciones**: Cuando se necesita un nodo, el sistema envia
   notificacion a los administradores via `POST /api/cluster/check`

### Configuracion (config.yaml)

```yaml
cluster:
  min_nodes: 2                    # minimo de nodos requeridos
  tablet_limit_per_node: 534      # limite de tabletas por nodo
  alert_threshold: 80             # alertar al 80% de uso
  nodes:                          # lista de nodos del cluster
    - "yugabytedb"                # desarrollo: mismo servidor
    - "yugabytedb2"
    # produccion:
    # - "db1.aldea.com"
    # - "db2.aldea.com"
    # - "db3.aldea.com"
```

### Cuando el sistema avisa que necesita mas nodos

El sistema avisa cuando:
1. **Nodos activos < min_nodes**: faltan nodos para el minimo configurado
2. **Uso de tabletas >= 80%**: se esta llenando la base de datos
3. **Uso de tabletas >= 90%**: necesita nodos urgentemente

El aviso incluye:
- Cuantos nodos se necesitan
- Porcentaje de uso actual
- Instrucciones para agregar nodos (mismo servidor o separado)
