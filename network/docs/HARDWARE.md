# Hardware Recomendado

## Servidor de Aldea (OpenWrt)

El servidor de aldea es el gateway/router de frontera. Maneja la red de toda la aldea.

### Requisitos minimos

- **CPU**: x86_64, 2 cores (Intel Celeron J4125, AMD Ryzen Embedded)
- **RAM**: 2 GB
- **Almacenamiento**: 16 GB SSD/eMMC (OpenWrt es muy ligero)
- **Tarjetas de red**: 2 puertos Ethernet (WAN + LAN)
- **Consumo**: bajo (idealmente <15W, fanless)

### Hardware recomendado por tamano de aldea

#### Aldea pequena (10-30 dispositivos)

- **Protectli Vault 2-port** (VP2410): ~$200
  - Intel Celeron J4125
  - 4 GB RAM
  - 2 puertos Ethernet
  - Fanless, bajo consumo

- **Alternativa**: Mini-PC generico con 2 tarjetas de red (ej: Lenovo ThinkCentre)

#### Aldea mediana (30-100 dispositivos)

- **Protectli Vault 4-port** (VP4650): ~$400
  - Intel Celeron J4125
  - 8 GB RAM
  - 4 puertos Ethernet (WAN + 3 LAN o VLANs)
  - Fanless, bajo consumo

- **Alternativa**: Mini-PC con tarjeta de red adicional PCIe

#### Aldea grande (100+ dispositivos)

- **Servidor rack 1U** con 4+ puertos Ethernet
  - Intel Xeon E3 o equivalente
  - 16 GB RAM
  - Soporte para VLANs y multi-WAN

### Accesorios

- **Switch Ethernet**: 8-24 puertos segun necesidad (ej: TP-Link TL-SG108)
- **Access Point WiFi**: UniFi U6-Lite o TP-Link EAP245 (cobertura amplia)
- **UPS**: bateria para mantener la red durante cortes de electricidad
- **Antena direccional** (opcional): para radioenlace entre aldeas cercanas

## Servidor del Nodo de Aplicacion

El servidor del nodo de la aplicacion corre Docker con Go + React + YugabyteDB.

### Requisitos minimos

- **CPU**: x86_64, 4 cores
- **RAM**: 8 GB (YugabyteDB requiere minimo 4 GB)
- **Almacenamiento**: 100 GB SSD
- **Tarjeta de red**: 1 puerto Ethernet (se conecta a la LAN de la aldea)

### Hardware recomendado

- **Mini-PC Intel NUC 11/12** (i5, 16 GB RAM, 500 GB SSD): ~$500
- **Alternativa**: Mini-PC Beelink o equivalente

## VPS para Lighthouse/STUN (opcional)

Solo necesario si las aldeas estan detras de CGNAT y no tienen IP publica.

### Requisitos minimos

- **CPU**: 1 vCPU
- **RAM**: 512 MB
- **Almacenamiento**: 10 GB
- **IP publica**: fija

### Proveedores economicos

- **Hetzner Cloud CX11**: ~$3/mes
- **DigitalOcean Droplet**: ~$4/mes
- **Vultr**: ~$3.5/mes

## Consideraciones

### Consumo electrico

En aldeas con energia solar o limitada:
- Servidor OpenWrt: 5-15W
- Switch: 5-10W
- Access Point WiFi: 5-10W
- Total: ~20-35W (factible con panel solar pequeno)

### Resiliencia

- Usar UPS para mantener la red durante cortes
- Considerar panel solar + bateria para autonomia total
- OpenWrt puede funcionar en hardware antiguo (PCs reciclados)

### Compatibilidad

- OpenWrt x86_64 funciona en casi cualquier PC con BIOS/UEFI
- No requiere hardware especial (a diferencia de routers ARM)
- Se puede instalar en disco duro, SSD, USB, o tarjeta SD
