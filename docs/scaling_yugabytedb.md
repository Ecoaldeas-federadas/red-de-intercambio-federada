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

### Opcion 1: Agregar mas nodos (recomendado)

Cada tserver adicional agrega ~534 tabletas al limite:

| Nodos | Limite aproximado |
|-------|-------------------|
| 1     | 534               |
| 2     | 1.068             |
| 3     | 1.602             |
| 5     | 2.670             |

#### Desarrollo (mismo computador)

El `docker-compose.yml` ya incluye 2 nodos:

```yaml
yugabytedb:    # Nodo 1 (master + tserver)
  ports: 5433, 7000, 9000

yugabytedb2:   # Nodo 2 (tserver, se une al nodo 1)
  ports: 5434, 7001, 9001
  command: --join=yugabytedb
```

Para agregar un tercer nodo en desarrollo:

```yaml
yugabytedb3:
  image: yugabytedb/yugabyte:latest
  hostname: yugabytedb3
  command: ["bin/yugabyted", "start", "--base_dir=/mnt/master", "--daemon=false", "--join=yugabytedb", "--listen_ip=0.0.0.0"]
  ports:
    - "5435:5433"
    - "7002:7000"
    - "9002:9000"
  volumes:
    - yb_data3:/mnt/master
    - yb_tserver3:/mnt/tserver
  depends_on:
    - yugabytedb
  restart: unless-stopped
```

Y agregar el volumen:
```yaml
volumes:
  yb_data3:
  yb_tserver3:
```

#### Produccion (servidores separados)

Para produccion, cada nodo debe estar en un servidor separado con su propia
RAM y CPU. Minimo recomendado: 3 nodos para alta disponibilidad (RF=3).

En cada servidor:

```bash
# Servidor 1 (primer nodo)
bin/yugabyted start --base_dir=/mnt/master --listen_ip=SERVER1_IP

# Servidor 2
bin/yugabyted start --base_dir=/mnt/master --join=SERVER1_IP --listen_ip=SERVER2_IP

# Servidor 3
bin/yugabyted start --base_dir=/mnt/master --join=SERVER1_IP --listen_ip=SERVER3_IP
```

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
1. **2 nodos YugabyteDB** en docker-compose (desarrollo)
2. **Colocation** en tablas pequenas (migracion 076+)
3. **Base de datos con COLOCATION = true** (connection.go)
4. **Sin indices secundarios innecesarios** en tablas pequenas

Para produccion, usar minimo 3 nodos en servidores separados.
