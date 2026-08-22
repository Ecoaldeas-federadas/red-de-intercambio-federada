-- Migracion 078: Configuracion del cluster YugabyteDB
--
-- Permite configurar el cluster desde la pagina de configuracion:
-- - Modo: 1 nodo con limite aumentado, o multiples nodos
-- - Limite de tabletas segun la RAM del servidor
-- - Lista de nodos del cluster
-- - Recomendaciones de hardware

CREATE TABLE IF NOT EXISTS cluster_config (
  id INT PRIMARY KEY DEFAULT 1,
  mode VARCHAR(20) NOT NULL DEFAULT 'single',  -- 'single' (1 nodo, limite alto) o 'multi' (varios nodos)
  tablet_limit INT NOT NULL DEFAULT 1000,      -- limite de tabletas configurado
  min_nodes INT NOT NULL DEFAULT 1,            -- minimo de nodos requeridos
  alert_threshold INT NOT NULL DEFAULT 80,     -- % de uso para alertar
  -- RAM del servidor en GB (para recomendaciones)
  server_ram_gb INT NOT NULL DEFAULT 16,
  -- Porcentaje de RAM para DocDB (global_memstore_size_percentage)
  -- 16GB: 10% (1.6GB), 32GB: 30% (9.6GB), 8GB: 5% (0.4GB)
  memstore_percentage INT NOT NULL DEFAULT 10,
  -- Lista de nodos como JSON array: [{"host":"yugabytedb","port":5433,"is_local":true}]
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
) SPLIT INTO 1 TABLETS;

-- Insertar configuracion por defecto (optimizada para 16GB RAM)
INSERT INTO cluster_config (id, mode, tablet_limit, min_nodes, alert_threshold, server_ram_gb, memstore_percentage, nodes)
VALUES (1, 'single', 1000, 1, 80, 16, 10,
  '[{"host":"yugabytedb","port":5433,"is_local":true}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
