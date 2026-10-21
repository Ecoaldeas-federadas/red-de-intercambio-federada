### Administración del nodo (`__DOMAIN__`)

- **Aplicación web del nodo**: `https://__DOMAIN__/main/`
- **Sitio público informativo**: `https://__DOMAIN__/`
- **Directorio de instalación**: `__INSTALL_DIR__`
- **Directorio de datos persistentes**: `__DATA_DIR__`
  - Imágenes y documentos subidos: `__DATA_DIR__/uploads`
  - Respaldos de base de datos: `__DATA_DIR__/backups`
  - Claves Ed25519 de federación: `__DATA_DIR__/secrets/node_keys.txt`
- **Puerto HTTP interno**: `__PORT__` (servido por NGINX en HTTPS estándar; la federación viaja cifrada extremo a extremo con Ed25519 + X25519 + AES-256-GCM sobre el mismo puerto web, sin requerir abrir puertos adicionales ni tener IP pública)

### Clave pública de federación

Para federar este nodo con otros nodos de la red, comparte la clave pública guardada en `__DATA_DIR__/secrets/node_keys.txt` o consúltala directamente desde el panel de administración del nodo en la sección **Federación**.
