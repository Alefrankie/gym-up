# ScrollFilm — Implementación React / Next.js

Dos componentes completos, listos para copiar y pegar, derivados de landings reales en producción.
Ambos renderizan el patrón completo (scrub + overlay de carga + secciones + dots + barra de
progreso). Elige el que corresponda a la técnica que decidiste en SKILL.md. Adapta colores, copy y
secciones a la marca del usuario; mantén el motor intacto.

Ambos son Client Components (`'use client'`). En el App Router de Next.js, ponlos bajo `app/` y
renderízalos desde un `page.tsx`. La versión de video no tiene dependencias externas; la de frames
opcionalmente usa GSAP, pero también se incluye una variante sin dependencias.

## Tabla de contenidos
- [Helpers compartidos](#helpers-compartidos)
- [Modelo de datos de sección](#modelo-de-datos-de-sección)
- [Técnica A — Scrubbing de video](#técnica-a--scrubbing-de-video)
- [Técnica B — Secuencia de frames (canvas)](#técnica-b--secuencia-de-frames-canvas)
- [Cómo conectarlo a una página](#cómo-conectarlo-a-una-página)

---

## Helpers compartidos

Ambas técnicas los usan. Ponlos al inicio del archivo del componente (o en un `lib/scrollfilm.ts`).

```ts
export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// Opacidad para una sección activa entre `start` y `end` (en espacio de progreso 0..1),
// con fade de entrada/salida a lo largo de `fade` de progreso en cada borde.
export function sectionOpacity(start: number, end: number, progress: number, fade = 0.04): number {
  if (progress <= start || progress >= end) return 0;
  const inPct = start + fade;
  const outPct = end - fade;
  if (progress < inPct) return (progress - start) / fade;
  if (progress > outPct) return (end - progress) / fade;
  return 1;
}

// Parallax sutil: cuánto (px) trasladar la sección a medida que el progreso recorre su rango.
export function sectionY(start: number, end: number, progress: number, range = 40): number {
  const mid = (start + end) / 2;
  return ((progress - mid) / (end - start)) * range;
}
```

## Modelo de datos de sección

Una sección es contenido que se muestra sobre el video durante una ventana del progreso del scroll.
`side` mantiene el texto fuera del sujeto del video.

```tsx
import type { ReactNode } from 'react';

export type Side = 'left' | 'right' | 'center' | 'full';

export interface Section {
  id: string;
  side: Side;
  start: number; // progreso 0..1 donde empieza a aparecer
  end: number;   // progreso 0..1 donde ya desapareció
  content: ReactNode;
}

// Ejemplo — ajusta los rangos para que las secciones no se solapen feo; deja pequeños huecos
// para transiciones limpias.
const SECTIONS: Section[] = [
  { id: 'hero',  side: 'left',  start: -0.04, end: 0.24, content: <h1 className="text-6xl font-bold text-white">Tu titular.</h1> },
  { id: 'two',   side: 'right', start: 0.30,  end: 0.54, content: <h2 className="text-5xl text-white">Segundo beat.</h2> },
  { id: 'cta',   side: 'left',  start: 0.78,  end: 1.0,  content: <h2 className="text-5xl text-white">¿Listo?</h2> },
];
```

---

## Técnica A — Scrubbing de video

Un `.mp4`, al que se le hace seek según el scroll. Ideal para escritorio primero / builds rápidos.
Sin dependencias.

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clamp, sectionOpacity, sectionY, type Section } from '@/lib/scrollfilm';

interface ScrollFilmVideoProps {
  src: string;            // p. ej. "/hero.mp4"
  poster?: string;        // se muestra antes de cargar la metadata — importante en iOS
  sections: Section[];
  bg?: string;            // color de fondo del contenedor + overlay, p. ej. "#0D3035"
  accent?: string;        // color de dots / progreso / barra de carga, p. ej. "#4AABCA"
  scrollVh?: number;      // alto del contenedor de scroll en vh; más alto = scrub más lento (def. 500)
}

export function ScrollFilmVideo({
  src, poster, sections, bg = '#0a0a0a', accent = '#4AABCA', scrollVh = 500,
}: ScrollFilmVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  const [progress, setProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // scroll → scrub. Agrupamos los eventos de scroll con rAF para no hacer seek más de una vez por frame.
  const updateProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = container.offsetHeight - window.innerHeight;
    const p = clamp(window.scrollY / maxScroll, 0, 1);
    setProgress(p);
    const video = videoRef.current;
    if (video && video.readyState >= 1 && video.duration) {
      video.currentTime = p * video.duration;
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  // listo — readyState>=1 significa que la duración ya se conoce. Escuchamos varios eventos Y
  // hacemos polling, porque en algunos navegadores un solo evento puede no dispararse nunca.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const markReady = () => { if (video.readyState >= 1) setVideoReady(true); };
    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('canplaythrough', markReady);
    const poll = setInterval(() => {
      if (video.readyState >= 1) { setVideoReady(true); clearInterval(poll); }
    }, 200);
    if (video.readyState >= 1) setVideoReady(true);
    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('canplaythrough', markReady);
      clearInterval(poll);
    };
  }, []);

  // barra de carga: avanza hasta 90% por temporizador (progreso percibido), luego salta a 100%
  // cuando está lista y se desvanece.
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const DURATION = 1200;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const pct = Math.min(((ts - start) / DURATION) * 90, 90);
      setLoadPct(Math.round(pct));
      if (pct < 90) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    setLoadPct(100);
    const t = setTimeout(() => setOverlayVisible(false), 500);
    return () => clearTimeout(t);
  }, [videoReady]);

  return (
    <div ref={containerRef} style={{ height: `${scrollVh}vh`, background: bg }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <video
          ref={videoRef} muted playsInline preload="auto" poster={poster}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>

        {/* Overlay de carga */}
        {overlayVisible && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 transition-opacity duration-500"
            style={{ background: bg, opacity: videoReady ? 0 : 1, pointerEvents: videoReady ? 'none' : 'auto' }}
          >
            <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${loadPct}%`, background: accent }} />
            </div>
            <p className="text-[11px] tracking-[2px] uppercase" style={{ color: `${accent}66` }}>Cargando</p>
          </div>
        )}

        {/* Secciones */}
        {sections.map((s) => {
          const opacity = sectionOpacity(s.start, s.end, progress);
          const y = sectionY(s.start, s.end, progress);
          return (
            <div
              key={s.id}
              className={`absolute inset-0 flex items-center pointer-events-none ${
                s.side === 'left' ? 'justify-start px-8 md:px-16'
                : s.side === 'right' ? 'justify-end px-8 md:px-16'
                : s.side === 'full' ? '' : 'justify-center px-6'
              }`}
              style={{ opacity, transform: `translateY(${y}px)`, transition: 'opacity 0.1s linear', pointerEvents: opacity > 0.5 ? 'auto' : 'none' }}
            >
              {s.content}
            </div>
          );
        })}

        {/* Barra de progreso */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full transition-all duration-75" style={{ width: `${progress * 100}%`, background: `${accent}80` }} />
        </div>

        {/* Dots de navegación */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          {sections.map((s, i) => {
            const mid = (s.start + s.end) / 2;
            const active = Math.abs(progress - mid) < (s.end - s.start) / 2;
            return (
              <button
                key={s.id}
                onClick={() => {
                  const container = containerRef.current;
                  if (!container) return;
                  const maxScroll = container.offsetHeight - window.innerHeight;
                  window.scrollTo({ top: mid * maxScroll, behavior: 'smooth' });
                }}
                className="transition-all duration-300 rounded-full cursor-pointer"
                style={{
                  width: active ? 8 : 4, height: active ? 8 : 4,
                  background: active ? accent : 'rgba(255,255,255,0.25)',
                  boxShadow: active ? `0 0 8px ${accent}` : 'none',
                }}
                aria-label={`Ir a la sección ${i + 1}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

## Técnica B — Secuencia de frames (canvas)

Dibuja un JPG pre-extraído por cada posición del scroll. Lo más suave en todos los dispositivos,
especialmente móvil. Extrae los frames primero con `scripts/extract-frames.sh`. Esta variante no usa
dependencias (scroll nativo + rAF) e incluye carga progresiva por lotes, un fallback al frame
cargado más cercano y soporte de `prefers-reduced-motion`.

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clamp, sectionOpacity, sectionY, type Section } from '@/lib/scrollfilm';

interface ScrollFilmFramesProps {
  frameCount: number;                 // total de frames (lo imprime extract-frames.sh)
  frameUrl: (i: number) => string;    // índice 0 → URL, p. ej. (i) => `/frames/${String(i+1).padStart(4,'0')}.jpg`
  sections: Section[];
  bg?: string;
  accent?: string;
  scrollVh?: number;
}

export function ScrollFilmFrames({
  frameCount, frameUrl, sections, bg = '#0a0a0a', accent = '#4AABCA', scrollVh = 500,
}: ScrollFilmFramesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastDrawnRef = useRef<number>(-1);
  const rafRef = useRef<number>(0);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // carga progresiva de frames: el primer lote de forma ansiosa (dimensiona el canvas + muestra el
  // frame 0), el resto en lotes con throttle para no saturar la red.
  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = new Array(frameCount);
    imagesRef.current = images;

    const onFirstReady = (img: HTMLImageElement) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && img.naturalWidth && img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        lastDrawnRef.current = 0;
      }
      setReady(true);
    };

    const loadOne = (i: number) => {
      const img = new window.Image();
      img.decoding = 'async';
      if (i === 0) img.onload = () => onFirstReady(img);
      img.src = frameUrl(i);
      images[i] = img;
    };

    const INITIAL = Math.min(24, frameCount);
    for (let i = 0; i < INITIAL; i++) loadOne(i);

    const BATCH = 24;
    let cursor = INITIAL;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadNext = () => {
      if (cancelled) return;
      const end = Math.min(frameCount, cursor + BATCH);
      for (let i = cursor; i < end; i++) loadOne(i);
      cursor = end;
      if (cursor < frameCount) timer = setTimeout(loadNext, 70);
    };
    timer = setTimeout(loadNext, 180);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [frameCount, frameUrl]);

  // dibuja un frame, cayendo al más cercano ya cargado para que el scrubbing nunca se trabe.
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isLoaded = (i: number) => {
      const img = imagesRef.current[i];
      return !!img && img.complete && img.naturalWidth > 0;
    };
    let useIdx = index;
    if (!isLoaded(useIdx)) {
      let found = -1;
      for (let d = 1; d < frameCount; d++) {
        if (useIdx - d >= 0 && isLoaded(useIdx - d)) { found = useIdx - d; break; }
        if (useIdx + d < frameCount && isLoaded(useIdx + d)) { found = useIdx + d; break; }
      }
      if (found === -1) return;
      useIdx = found;
    }
    if (lastDrawnRef.current === useIdx) return;
    const img = imagesRef.current[useIdx];
    const ctx = canvas.getContext('2d');
    if (!ctx || !img) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    lastDrawnRef.current = useIdx;
  }, [frameCount]);

  const updateProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = container.offsetHeight - window.innerHeight;
    const p = clamp(window.scrollY / maxScroll, 0, 1);
    setProgress(p);
    if (!reduced) drawFrame(Math.min(frameCount - 1, Math.floor(p * frameCount)));
  }, [drawFrame, frameCount, reduced]);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  // barra de carga
  useEffect(() => {
    let raf: number; let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const pct = Math.min(((ts - start) / 1200) * 90, 90);
      setLoadPct(Math.round(pct));
      if (pct < 90) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLoadPct(100);
    const t = setTimeout(() => setOverlayVisible(false), 500);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <div ref={containerRef} style={{ height: `${scrollVh}vh`, background: bg }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" aria-hidden />

        {/* scrim de legibilidad — mantiene el texto legible sobre footage brillante */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)',
        }} />

        {overlayVisible && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 transition-opacity duration-500"
            style={{ background: bg, opacity: ready ? 0 : 1, pointerEvents: ready ? 'none' : 'auto' }}>
            <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${loadPct}%`, background: accent }} />
            </div>
            <p className="text-[11px] tracking-[2px] uppercase" style={{ color: `${accent}66` }}>Cargando</p>
          </div>
        )}

        {sections.map((s) => {
          const opacity = sectionOpacity(s.start, s.end, progress);
          const y = sectionY(s.start, s.end, progress);
          return (
            <div key={s.id}
              className={`absolute inset-0 flex items-center pointer-events-none ${
                s.side === 'left' ? 'justify-start px-8 md:px-16'
                : s.side === 'right' ? 'justify-end px-8 md:px-16'
                : s.side === 'full' ? '' : 'justify-center px-6'
              }`}
              style={{ opacity, transform: `translateY(${y}px)`, transition: 'opacity 0.1s linear', pointerEvents: opacity > 0.5 ? 'auto' : 'none' }}>
              {s.content}
            </div>
          );
        })}

        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full transition-all duration-75" style={{ width: `${progress * 100}%`, background: `${accent}80` }} />
        </div>

        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          {sections.map((s, i) => {
            const mid = (s.start + s.end) / 2;
            const active = Math.abs(progress - mid) < (s.end - s.start) / 2;
            return (
              <button key={s.id}
                onClick={() => {
                  const container = containerRef.current;
                  if (!container) return;
                  const maxScroll = container.offsetHeight - window.innerHeight;
                  window.scrollTo({ top: mid * maxScroll, behavior: 'smooth' });
                }}
                className="transition-all duration-300 rounded-full cursor-pointer"
                style={{ width: active ? 8 : 4, height: active ? 8 : 4, background: active ? accent : 'rgba(255,255,255,0.25)', boxShadow: active ? `0 0 8px ${accent}` : 'none' }}
                aria-label={`Ir a la sección ${i + 1}`} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

> **Variante con GSAP:** el componente de frames original en producción usaba `ScrollTrigger` de
> GSAP con `scrub: 0.5` para suavizado inercial y `gsap.timeline()` para el fade/blur del texto. La
> versión de arriba es sin dependencias y funciona bien; recurre a GSAP solo si quieres la inercia/
> easing extra o ya lo usas. La matemática del scrub (`progreso → índice de frame`) es idéntica.

---

## Cómo conectarlo a una página

```tsx
// app/page.tsx
import { ScrollFilmVideo } from './ScrollFilmVideo'; // o ScrollFilmFrames
import type { Section } from '@/lib/scrollfilm';

const sections: Section[] = [/* ...como en el modelo de datos de sección de arriba... */];

export default function Page() {
  return (
    <ScrollFilmVideo
      src="/hero.mp4"
      poster="/poster.jpg"
      sections={sections}
      bg="#0D3035"
      accent="#4AABCA"
      scrollVh={500}
    />
  );
  // Frames: <ScrollFilmFrames frameCount={242} frameUrl={(i) => `/frames/${String(i+1).padStart(4,'0')}.jpg`} ... />
}
```

Agrega un navbar fijo arriba y un footer abajo como elementos normales — no son parte del motor. Dale
al navbar un `bg-gradient-to-b from-black/60 to-transparent` (o blur) para que se mantenga legible
sobre el video.
