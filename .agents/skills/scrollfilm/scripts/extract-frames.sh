#!/usr/bin/env bash
#
# extract-frames.sh — Extrae una secuencia de frames de ScrollFilm desde un video usando ffmpeg.
#
# La técnica de secuencia de frames dibuja una imagen pre-extraída por cada posición del scroll en un
# <canvas>. Es más suave que hacer seek a un <video> (especialmente en iOS/Safari, que limita
# currentTime).
#
# Uso:
#   ./extract-frames.sh <video-de-entrada> [carpeta-salida] [fps]
#
# Ejemplos:
#   ./extract-frames.sh hero.mp4
#   ./extract-frames.sh hero.mp4 public/frames 30
#
# Por defecto: carpeta-salida = ./frames , fps = fps de origen (todos los frames)
#
# Salida: JPGs con relleno de ceros (0001.jpg, 0002.jpg, ...) a calidad -q:v 3.
# Se usa JPG (no webp) a propósito: muchas builds de ffmpeg no traen libwebp, y JPG se decodifica
# rápido en el navegador en todas partes. El relleno a 4 dígitos mantiene los frames en orden lexical
# = numérico, que es lo que espera el helper frameUrl(i) del código de referencia.
#
# Tras la extracción, el script imprime el número exacto de frames — ponlo en `frameCount` (React) o
# en la constante FRAME_COUNT (vanilla) de la implementación de referencia.

set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg no está instalado. Instálalo primero (p. ej. 'brew install ffmpeg')." >&2
  exit 1
fi

INPUT="${1:-}"
OUTDIR="${2:-frames}"
FPS="${3:-}"

if [[ -z "$INPUT" ]]; then
  echo "Uso: $0 <video-de-entrada> [carpeta-salida] [fps]" >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: video de entrada no encontrado: $INPUT" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

echo "Extrayendo frames de '$INPUT' → '$OUTDIR/' ..."

# Construye el filtro -vf solo cuando se pide un fps explícito. Sin fps, se exporta cada frame de
# origen, lo que da el scrub más suave posible (a costa de más archivos).
if [[ -n "$FPS" ]]; then
  ffmpeg -hide_banner -loglevel warning -i "$INPUT" -vf "fps=${FPS}" -q:v 3 "$OUTDIR/%04d.jpg"
else
  ffmpeg -hide_banner -loglevel warning -i "$INPUT" -q:v 3 "$OUTDIR/%04d.jpg"
fi

COUNT=$(find "$OUTDIR" -maxdepth 1 -name '*.jpg' | wc -l | tr -d ' ')

echo ""
echo "Listo. Se extrajeron ${COUNT} frames a '${OUTDIR}/'."
echo ""
echo "Siguientes pasos:"
echo "  1. Hospeda los frames donde la página pueda cargarlos (p. ej. public/frames/ en Next.js)."
echo "  2. Pon el número de frames en tu código:"
echo "       React:   frameCount={${COUNT}}"
echo "       Vanilla: const FRAME_COUNT = ${COUNT};"
echo "  3. Apunta frameUrl(i) a los frames, p. ej.:"
echo "       (i) => \`/frames/\${String(i + 1).padStart(4, '0')}.jpg\`"
echo ""
echo "  Nota: los frames están 1-indexados en disco (0001.jpg) pero el código suele estar 0-indexado"
echo "  (i = 0..N-1), así que el helper suma 1 y rellena a 4 dígitos. Mantén ese desfase consistente."
