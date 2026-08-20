-- Migracion 066: Sistema de backups y nodos YugabyteDB

-- Configuracion de backups automaticos
CREATE TABLE IF NOT EXISTS backup_config (
  id SERIAL PRIMARY KEY,
  interval_hours INT NOT NULL DEFAULT 24,
  retention_days INT NOT NULL DEFAULT 7,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar configuracion por defecto si no existe
INSERT INTO backup_config (interval_hours, retention_days, enabled)
SELECT 24, 7, true
WHERE NOT EXISTS (SELECT 1 FROM backup_config);

-- Registro de archivos de backup
CREATE TABLE IF NOT EXISTS backup_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nodos YugabyteDB del cluster
CREATE TABLE IF NOT EXISTS yugabyte_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT NOT NULL,
  host_ip TEXT NOT NULL,
  port INT NOT NULL DEFAULT 7100,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
