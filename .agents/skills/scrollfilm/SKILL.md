---
name: scrollfilm
description: >-
  Construye una landing con video controlado por scroll — el efecto "ScrollFilm", donde un video
  (o secuencia de imágenes) avanza fotograma a fotograma mientras el usuario hace scroll, estilo
  página de producto de Apple. Genera el patrón completo: motor de scrubbing, overlay de carga,
  secciones de texto con fade + parallax, dots de navegación lateral, barra de progreso y navbar
  fijo. Usa esta skill siempre que el usuario mencione "ScrollFilm", "video con scroll", "scroll
  scrubbing", "scrubbing", "video que avanza al hacer scroll", "video scroll-driven", una animación
  de scroll estilo Apple, un hero cinematográfico con scroll, o quiera una landing donde el scroll
  controle la línea de tiempo de un video — aunque no diga la palabra exacta "ScrollFilm". Funciona
  tanto para proyectos vanilla HTML/CSS/JS como React/Next.js.
---

# ScrollFilm — Landings con video controlado por scroll

ScrollFilm es el efecto donde **el scroll controla la línea de tiempo de un video**: al hacer scroll
hacia abajo, un video a pantalla completa avanza fotograma a fotograma; al subir, retrocede. Apple lo
popularizó en sus páginas de producto (iPhone, MacBook Pro). El término técnico es *scroll scrubbing*
o *scroll-driven video*.

Tu trabajo con esta skill es generar un ScrollFilm **completo y de calidad de producción** — no una
demo de juguete. El patrón completo tiene ocho piezas, todas trabajando juntas. Constrúyelas todas
salvo que el usuario pida explícitamente solo el efecto base.

## Anatomía de un ScrollFilm completo

Estas ocho piezas son las que hacen que se sienta premium en lugar de tosco. Cada una existe por una
razón:

1. **Contenedor de scroll** — un elemento alto (p. ej. `height: 500vh`) que le da a la página
   espacio para hacer scroll. Cuanto más alto, más lento y suave es el scrub. Esta es la perilla más
   importante para el "feel": demasiado corto y el video pasa volando, demasiado alto y se arrastra.
2. **Escenario sticky** — un wrapper `position: sticky; top: 0; height: 100vh` que fija el video al
   viewport mientras el contenedor alto pasa por detrás. Es lo que mantiene el video en pantalla.
3. **Motor de scrubbing** — mapea el progreso del scroll (0→1) sobre el video. O bien
   `video.currentTime = progress * duration` (técnica de video) o dibujando el fotograma
   correspondiente en un `<canvas>` (técnica de secuencia de frames). Ver "Elegir la técnica" abajo.
4. **Overlay de carga** — una cubierta con barra de progreso animada que se muestra hasta que el
   medio está listo. Sin ella, el usuario ve un video en blanco o a medio cargar y hace scroll sobre
   la nada. La barra avanza suave hasta ~90% por temporizador, salta al 100% en cuanto el medio
   reporta que está listo, y luego se desvanece. Este truco de *rendimiento percibido* importa tanto
   como el tiempo de carga real.
5. **Secciones de texto** — overlays que aparecen y desaparecen con fade (y un sutil parallax
   `translateY`) en rangos específicos del progreso del scroll, renderizados **encima** del video.
   Cada sección declara un `start`/`end` en el espacio de progreso 0–1.
6. **Alternancia izquierda/derecha** — las secciones alternan de lado (y el sujeto del video suele
   estar en el lado opuesto) para que el texto nunca tape el punto focal. Un degradado/scrim de
   legibilidad detrás del texto lo mantiene legible sobre footage brillante.
7. **Dots de navegación** — una fila vertical de puntos; el activo se resalta según el progreso, y al
   hacer clic se hace scroll suave hasta el punto medio de esa sección.
8. **Barra de progreso + navbar** — una barra de progreso delgada (abajo) que refleja el scroll, y un
   navbar fijo con blur/degradado para que se mantenga legible sobre el video.

## Flujo de trabajo

1. **Detecta el stack.** Busca un `package.json` con `react`/`next` → React/Next.js. Si no, asume
   vanilla HTML/CSS/JS. Si hay duda, haz una pregunta corta al usuario.
2. **Consigue el medio.** El usuario da un `.mp4`. Si solo lo describe, pide el archivo o la ruta.
3. **Elige la técnica** (video vs. secuencia de frames) — ver abajo.
4. **Si es secuencia de frames:** ejecuta `scripts/extract-frames.sh` para extraer los JPG con ffmpeg.
5. **Lee el archivo de referencia correspondiente** para la implementación completa lista para copiar:
   - Vanilla → `references/vanilla.md`
   - React/Next.js → `references/react-nextjs.md`
   Cada referencia contiene AMBAS técnicas (video y frames). Lee solo la sección que necesites.
6. **Adapta el contenido** — reemplaza colores, fuentes, copy de las secciones, número de secciones y
   el navbar para que coincidan con la marca del usuario. Mantén el motor intacto.
7. **Verifica** — levanta el servidor de desarrollo y confirma: el medio carga detrás del overlay, el
   scrubbing sigue al scroll en ambas direcciones, las secciones hacen fade en los puntos correctos,
   los dots navegan, y nada tapa al sujeto en móvil.

## Elegir la técnica

Ambas están en los archivos de referencia. Elige con intención — esta es la decisión arquitectónica
principal.

| | **Scrubbing de video** (`video.currentTime`) | **Secuencia de frames** (canvas + JPGs) |
|---|---|---|
| **Cómo** | Un `.mp4`, se hace seek en su timeline al scrollear | Extraer N frames, dibujar el correspondiente en un `<canvas>` |
| **Setup** | Pones el video y listo | Ejecutar ffmpeg para extraer frames, hospedarlos |
| **Suavidad** | Buena en escritorio; **Safari/iOS en móvil limita el seek de `currentTime`** y puede entrecortarse | Suave en todos los dispositivos — dibujar una imagen es barato y determinista |
| **Peso de la página** | Un solo archivo, pero se descarga el video entero | Muchos JPG pequeños, cargados progresivamente por lotes |
| **Ideal para** | Builds rápidos, escritorio primero, clips cortos (≤8s) | Máxima fluidez, móvil crítico, el verdadero "feel Apple" |

**Recomendación por defecto:** si al usuario le importa el móvil o quiere que se sienta impecable, usa
la **secuencia de frames**. Si quiere el camino más rápido y es escritorio primero, usa **scrubbing
de video**. Ante la duda, di cuál eliges y por qué en una frase, y procede.

## Cosas que te van a morder (gotchas ganados a pulso)

- **El seek de video en iOS/Safari está limitado.** Esta es la razón #1 por la que los ScrollFilm se
  sienten rotos en teléfonos. Si el objetivo es móvil, prefiere la secuencia de frames. Para video,
  pon `muted`, `playsInline`, `preload="auto"` y un `poster` para que se vea algo antes de que cargue
  la metadata.
- **Limita el scroll con `requestAnimationFrame`.** Nunca hagas seek del video en cada evento `scroll`
  crudo — agrúpalos con rAF, o el hilo principal se ahoga. Las referencias ya lo hacen.
- **No condiciones todo a la carga completa.** Detecta que está listo con `readyState >= 1`
  (metadata/duración conocidas) más un fallback con polling, no con `canplaythrough`, que puede no
  dispararse nunca.
- **`prefers-reduced-motion`.** Respétalo: renderiza un primer frame estático (o el poster) y omite el
  scrub para usuarios que lo desactivan. La referencia de frames en React lo muestra.
- **ffmpeg sin libwebp** → exporta JPG (`-q:v 3`), no webp. El script lo maneja.
- **Buildear sobre un servidor de desarrollo corriendo puede corromper la caché de build** (p. ej. el
  `.next` de Next), sirviendo páginas sin estilos. Detén el servidor de desarrollo antes de un build
  de producción.
- **Ajusta el `500vh` al clip.** Clips más largos o más secciones quieren un contenedor más alto. Es
  lo primero que se ajusta si el scrub se siente demasiado rápido o demasiado lento.

## Distribución

Esta skill está pensada para compartirse con una comunidad. Mantén el motor genérico y agnóstico de
marca para que cualquiera pueda poner su propio video, colores y copy. Las implementaciones de
referencia derivan de dos landings reales en producción (una basada en video, otra en frames), así
que están probadas en batalla, no son teoría.
