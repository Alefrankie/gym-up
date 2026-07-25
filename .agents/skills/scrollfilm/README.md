# 🎬 ScrollFilm — Skill de Claude Code

> Crea landings con **video controlado por scroll** estilo Apple usando Claude, en un solo prompt.

ScrollFilm es el efecto donde **el scroll controla la línea de tiempo de un video**: al hacer scroll
hacia abajo, un video a pantalla completa avanza fotograma a fotograma; al subir, retrocede. Apple lo
popularizó en sus páginas de producto (iPhone, MacBook Pro). El término técnico es *scroll scrubbing*.

Esta es una skill de [Claude Code](https://claude.com/claude-code). Una vez instalada, solo pídele a
Claude:

> "Hazme un ScrollFilm con este video"

…y genera el **patrón completo y de calidad de producción** — no una demo de juguete.

## ✨ Qué genera

El patrón completo, con cada pieza que lo hace sentir premium:

- **Motor de scrubbing** — el progreso del scroll mapeado sobre la línea de tiempo del video
- **Overlay de carga** con barra de progreso animada (truco de rendimiento percibido)
- **Secciones de texto** que aparecen y desaparecen con fade y sutil parallax al scrollear
- **Alternancia izquierda/derecha** para que el texto nunca tape al sujeto del video
- **Dots de navegación** con click-to-scroll
- **Barra de progreso** + **navbar** fijo

## 🧰 Funciona con tu stack y tu medio

| | |
|---|---|
| **Stacks** | Vanilla HTML/CSS/JS **y** React/Next.js |
| **Técnicas** | Scrubbing de video (`video.currentTime`) **y** secuencia de frames (canvas + JPGs) — la skill elige la correcta, o eliges tú |
| **Incluye** | Un script de `ffmpeg` para extraer frames de cualquier `.mp4` |

La skill explica el trade-off (video = rápido y escritorio primero; frames = suavísimo, ideal en
móvil/iOS) y elige en consecuencia.

## 📦 Instalación

```bash
npx skills add valladxres/scrollfilm-skill
```

O descarga el último `.skill` desde [Releases](../../releases) e instálalo en Claude Code.

## 🚀 Uso

Después de instalarla, solo describe lo que quieres:

```
Hazme un ScrollFilm con hero.mp4 — fondo navy, acento dorado,
tres secciones de texto: un titular, una característica y un CTA.
```

Claude lee la skill, elige video vs. frames y escribe la página completa adaptada a tu marca.

## 📁 Qué incluye

```
scrollfilm-skill/
├── SKILL.md                  # la skill: decisión de técnica + anatomía del patrón + gotchas
├── references/
│   ├── vanilla.md            # HTML/CSS/JS completo (video + frames)
│   └── react-nextjs.md       # React/Next.js completo (video + frames)
└── scripts/
    └── extract-frames.sh     # ffmpeg → secuencia de frames
```

## 🧪 Probada en batalla

Las implementaciones de referencia derivan de dos landings reales en producción — una basada en
video y otra en frames — así que el código está probado, no es teoría. Incluso trae horneados los
gotchas ganados a pulso (iOS limita el seek de video → preferir frames en móvil; throttling con
`requestAnimationFrame`; detección de "listo" basada en `readyState`; `prefers-reduced-motion`;
exportación JPG con ffmpeg).

## 📜 Licencia

MIT © Aaron Valladares

---

Hecho por [@valladxres](https://github.com/valladxres) · Construido con [Claude Code](https://claude.com/claude-code)
