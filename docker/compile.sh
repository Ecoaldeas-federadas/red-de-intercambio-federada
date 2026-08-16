#!/bin/bash
# compile.sh — Script de compilacion de firmware ESP32
#
# Argumentos:
#   $1 = tipo de terminal (keypad, touch, web, community, ble-reader)
#   $2 = ruta al config.h personalizado (montado en el contenedor)
#   $3 = ruta de salida para el .bin compilado
#
# El script:
#   1. Copia el firmware del terminal a /build
#   2. Copia el config.h generado por el servidor
#   3. Copia las librerias shared/
#   4. Compila con arduino-cli
#   5. Copia el .bin resultante a la ruta de salida

set -e

TERMINAL_TYPE="$1"
CONFIG_H_PATH="$2"
OUTPUT_BIN="$3"
ARDUINO_DATA="/arduino-data"
FIRMWARE_SRC="/firmware"

if [ -z "$TERMINAL_TYPE" ] || [ -z "$CONFIG_H_PATH" ] || [ -z "$OUTPUT_BIN" ]; then
    echo "ERROR: Faltan argumentos"
    echo "Uso: compile.sh <tipo_terminal> <config.h> <output.bin>"
    exit 1
fi

# Mapear tipo de terminal a carpeta y placa
case "$TERMINAL_TYPE" in
    keypad|web|community|ble-reader)
        TERMINAL_DIR="terminal-${TERMINAL_TYPE}"
        BOARD="esp32:esp32:esp32"
        ;;
    touch)
        TERMINAL_DIR="terminal-touch"
        BOARD="esp32:esp32:ttgo-lora32"
        ;;
    *)
        echo "ERROR: Tipo de terminal desconocido: $TERMINAL_TYPE"
        exit 1
        ;;
esac

echo "=== Compilando firmware para terminal: $TERMINAL_TYPE ==="
echo "Directorio: $TERMINAL_DIR"
echo "Placa: $BOARD"
echo "Config: $CONFIG_H_PATH"
echo "Output: $OUTPUT_BIN"

# Limpiar directorio de build
rm -rf /build/*
mkdir -p /build/src

# Copiar el codigo del terminal
cp -r ${FIRMWARE_SRC}/${TERMINAL_DIR}/* /build/src/

# Copiar las librerias shared/
mkdir -p /build/src/shared
cp -r ${FIRMWARE_SRC}/shared/* /build/src/shared/

# Sobrescribir config.h con el generado por el servidor
cp "$CONFIG_H_PATH" /build/src/config.h

# Para terminales con TFT_eSPI (touch), copiar la configuracion del display
if [ "$TERMINAL_TYPE" = "touch" ]; then
    mkdir -p /build/User_Setup
    cat > /build/User_Setup.h << 'TFTSETUP'
#define ILI9341_2BIT
#define TFT_MISO 19
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  4
#define TOUCH_CS 33
TFTSETUP
fi

# Buscar el archivo .ino principal
INO_FILE=$(find /build/src -name "*.ino" | head -1)
if [ -z "$INO_FILE" ]; then
    echo "ERROR: No se encontro archivo .ino"
    exit 1
fi

SKETCH_DIR=$(dirname "$INO_FILE")
SKETCH_NAME=$(basename "$INO_FILE" .ino)

echo "Sketch: $SKETCH_NAME"
echo "Directorio: $SKETCH_DIR"

# Compilar
echo "=== Iniciando compilacion ==="
arduino-cli compile \
    --config-file ${ARDUINO_DATA}/arduino-cli.yaml \
    --fqbn "$BOARD" \
    --build-path /build/output \
    --library /build/src/shared \
    "$SKETCH_DIR"

# Buscar el .bin compilado
BIN_FILE=$(find /build/output -name "*.bin" | head -1)
if [ -z "$BIN_FILE" ]; then
    echo "ERROR: No se genero archivo .bin"
    exit 1
fi

# Copiar el .bin a la ruta de salida
cp "$BIN_FILE" "$OUTPUT_BIN"
echo "=== Compilacion exitosa ==="
echo "Binario: $OUTPUT_BIN ($(stat -c%s "$OUTPUT_BIN") bytes)"
