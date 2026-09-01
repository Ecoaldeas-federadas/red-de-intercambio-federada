#!/bin/bash
# Iniciar Nodo Satelite para feria
# Uso: ./start-satellite.sh

set -e

echo "=== Iniciando Nodo Satelite ==="

if [ ! -f .env ]; then
    echo "Copiando .env.satellite.example a .env..."
    cp .env.satellite.example .env
    echo ""
    echo "EDITA .env con tus valores (JWT_SECRET, NODE_PRIVATE_KEY, PARENT_NODE)"
    echo "Luego ejecuta este script nuevamente."
    exit 1
fi

echo "Construyendo imagen..."
docker compose -f docker-compose.satellite.yml build

echo ""
echo "Iniciando contenedores..."
docker compose -f docker-compose.satellite.yml up -d

echo ""
echo "=== Nodo Satelite iniciado ==="
echo "Web:        http://localhost:8080"
echo "Federation: https://localhost:8443"
echo ""
echo "Proximos pasos:"
echo "  1. Abre http://localhost:8080 en el navegador"
echo "  2. Inicia sesion con la cuenta admin del satelite"
echo "  3. Ve a Federacion > Satelite > Descargar Snapshot"
echo "  4. Ingresa la URL del nodo origen (ej: https://nodo1.com:8443)"
echo "  5. Desconecta y lleva el equipo a la feria"
