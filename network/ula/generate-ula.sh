#!/bin/sh
# generate-ula.sh - Genera un prefijo IPv6 ULA (Unique Local Address) unico
#
# Uso:
#   ./generate-ula.sh                          # Genera prefijo aleatorio
#   ./generate-ula.sh "aldea1.com"             # Genera prefijo determinista desde dominio
#   ./generate-ula.sh "aldea1.com" "nodo123"   # Genera prefijo desde dominio + sal
#
# Salida:
#   fdXX:XXXX:XXXX::/48
#
# Segun RFC 4193, los prefijos ULA usan fd00::/8.
# Los 40 bits siguientes se generan de forma pseudoaleatoria.
# Probabilidad de colision entre dos aldeas: 1 en billones.

set -e

# Si se pasa un dominio, generar prefijo determinista con SHA-256
if [ -n "$1" ]; then
    DOMAIN="$1"
    SALT="${2:-$(head -c 16 /dev/urandom | xxd -p)}"
    # Hash SHA-256 del dominio + sal, tomar 40 bits (5 bytes)
    HASH=$(echo -n "${DOMAIN}${SALT}" | sha256sum | cut -c1-10)
    # Convertir a formato ULA: fdXX:XXXX:XXXX::/48
    # fd + primer byte, luego 2 bytes, luego 2 bytes
    BYTE1=$(echo "$HASH" | cut -c1-2)
    BYTE2=$(echo "$HASH" | cut -c3-6)
    BYTE3=$(echo "$HASH" | cut -c7-10)
    # Asegurar que empieza con fd
    PREFIX="fd${BYTE1}:${BYTE2}:${BYTE3}::/48"
else
    # Generar prefijo completamente aleatorio
    # 5 bytes aleatorios -> 40 bits
    RAND=$(head -c 5 /dev/urandom | xxd -p)
    BYTE1=$(echo "$RAND" | cut -c1-2)
    BYTE2=$(echo "$RAND" | cut -c3-6)
    BYTE3=$(echo "$RAND" | cut -c7-10)
    # Forzar que el primer nibble sea 'f' y el segundo 'd' (ULA prefix fd00::/8)
    BYTE1="fd$(echo "$BYTE1" | cut -c3-4)"
    PREFIX="fd${BYTE1:2:2}:${BYTE2}:${BYTE3}::/48"
    # Corregir: asegurar formato fdXX:XXXX:XXXX
    BYTE1HEX=$(echo "$RAND" | cut -c3-4)
    PREFIX="fd${BYTE1HEX}:${BYTE2}:${BYTE3}::/48"
fi

echo "$PREFIX"

# Si se pasa un segundo argumento como archivo, guardar ahi
if [ -n "$3" ]; then
    echo "$PREFIX" > "$3"
fi
