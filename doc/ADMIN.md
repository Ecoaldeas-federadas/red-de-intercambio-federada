### Node administration (`__DOMAIN__`)

- **Web interface**: `https://__DOMAIN__/main/`
- **Public website**: `https://__DOMAIN__/`
- **Install directory**: `__INSTALL_DIR__`
- **Persistent data directory**: `__DATA_DIR__`
  - Uploaded images & documents: `__DATA_DIR__/uploads`
  - Database backups: `__DATA_DIR__/backups`
  - Node Ed25519 federation keys: `__DATA_DIR__/secrets/node_keys.txt`
- **Internal HTTP port**: `__PORT__` (reverse-proxied by NGINX on standard HTTPS; federation uses E2E Ed25519 + X25519 + AES-256-GCM encryption over the same web endpoint without requiring any extra open port or public IP)

### Federation Public Key

To federate this node with other nodes in the network, share the public key stored in `__DATA_DIR__/secrets/node_keys.txt` or retrieve it from the node administration panel under **Federation**.
