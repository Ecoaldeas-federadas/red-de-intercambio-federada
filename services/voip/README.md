# Telefonía VoIP para Aldeas Federadas

## Que es

Asterisk es una central telefonica (PBX) en software que permite:
- Llamadas internas gratis entre miembros de la aldea
- Llamadas entre aldeas federadas gratis por la intranet
- Buzon de voz, conferencias, extensiones ilimitadas

## Codigo de aldea

Cada aldea tiene un codigo numerico unico (ej: 101, 102) generado automaticamente por el nodo.

Para llamar a otra aldea: marca `CODIGO_ALDEA + EXTENSION`
- Ejemplo: `1052001` llama a la extension 2001 de la aldea 105

## Instalacion

### Desde el nodo (recomendado)
1. Ve a "Servicios Federados" -> "Telefonía VoIP"
2. Genera el codigo de aldea
3. Crea las extensiones para cada miembro
4. Agrega rutas a otras aldeas federadas
5. Instala el servicio con un clic

### Manual
```bash
docker network create aldea-network
docker compose up -d
```

## Configuracion

Los archivos de configuracion se generan desde el nodo:
- `extensions.conf` - plan de marcacion (extensiones y rutas)
- `pjsip.conf` - endpoints SIP y trunks federados
- `rtp.conf` - puertos de audio

## Clientes SIP compatibles

Cualquier cliente SIP estandar funciona:
- **Linphone** (gratis, multiplataforma)
- **Zoiper** (gratis, iOS/Android/Desktop)
- **MicroSIP** (Windows, ligero)
- **Telephone** (macOS)
- **Telefonos IP** hardware (Grandstream, Yealink, etc.)
- **Adaptadores ATA** para telefonos analogos

## Puertos

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 5060 | UDP/TCP | Señalizacion SIP |
| 10000-20000 | UDP | Audio RTP |

## Federacion entre aldeas

Para federar con otra aldea:
1. Ambas aldeas deben tener VoIP instalado
2. Intercambiar codigos de aldea
3. Agregar la ruta en "Rutas a otras aldeas"
4. Marcar `CODIGO + EXTENSION` para llamar

El enrutamiento es directo (P2P) cuando las aldeas estan conectadas por la intranet federada (WireGuard/OpenWrt).
