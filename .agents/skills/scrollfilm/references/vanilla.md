# ScrollFilm — Implementación Vanilla HTML/CSS/JS

Autocontenido, sin paso de build, sin dependencias. Dos archivos completos — uno por técnica. Cópialo
a cualquier proyecto, ábrelo en un navegador, listo. Ambos renderizan el patrón completo (scrub +
overlay de carga + secciones + dots + barra de progreso). Reemplaza colores, copy y la ruta del medio
con la marca del usuario.

## Tabla de contenidos
- [Técnica A — Scrubbing de video](#técnica-a--scrubbing-de-video)
- [Técnica B — Secuencia de frames (canvas)](#técnica-b--secuencia-de-frames-canvas)
- [Definir secciones](#definir-secciones)

Las dos comparten la misma estructura y CSS; solo cambian el motor (`<script>`) y el elemento del medio.

---

## Técnica A — Scrubbing de video

Un `.mp4`, al que se le hace seek según el scroll. Guárdalo como `index.html`, pon tu video en
`./hero.mp4`.

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ScrollFilm</title>
<style>
  :root { --bg:#0D3035; --accent:#4AABCA; }
  * { margin:0; box-sizing:border-box; }
  body { background:var(--bg); font-family:system-ui,sans-serif; }

  /* Contenedor de scroll alto — más alto = scrub más lento y suave */
  #sf-container { height:500vh; background:var(--bg); }
  /* El escenario sticky fija el medio mientras el contenedor pasa por detrás */
  #sf-stage { position:sticky; top:0; height:100vh; overflow:hidden; }

  #sf-media { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  /* scrim de legibilidad para que el texto se mantenga legible sobre el video */
  #sf-scrim { position:absolute; inset:0; pointer-events:none;
    background:linear-gradient(to right, rgba(0,0,0,.6) 0%, rgba(0,0,0,.2) 35%, transparent 60%); }

  /* secciones */
  .sf-section { position:absolute; inset:0; display:flex; align-items:center;
    opacity:0; transition:opacity .1s linear; pointer-events:none; }
  .sf-section[data-side="left"]  { justify-content:flex-start; padding:0 2rem; }
  .sf-section[data-side="right"] { justify-content:flex-end;   padding:0 2rem; }
  .sf-section[data-side="center"]{ justify-content:center;     padding:0 1.5rem; }
  @media (min-width:768px){ .sf-section[data-side="left"],.sf-section[data-side="right"]{ padding:0 4rem; } }
  .sf-section h1,.sf-section h2 { color:#fff; font-weight:800; line-height:.9; max-width:36rem; }
  .sf-section h1 { font-size:clamp(2.5rem,8vw,6rem); }
  .sf-section h2 { font-size:clamp(2rem,6vw,4.5rem); }

  /* overlay de carga */
  #sf-overlay { position:absolute; inset:0; z-index:10; background:var(--bg);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem;
    transition:opacity .5s; }
  #sf-bar-track { width:12rem; height:2px; background:rgba(255,255,255,.1); border-radius:99px; overflow:hidden; }
  #sf-bar { height:100%; width:0%; background:var(--accent); border-radius:99px; transition:width .2s; }
  #sf-loading-label { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,.4); }

  /* barra de progreso */
  #sf-progress { position:absolute; bottom:0; left:0; right:0; height:1px; background:rgba(255,255,255,.05); }
  #sf-progress > div { height:100%; width:0%; background:color-mix(in srgb, var(--accent) 50%, transparent); }

  /* dots */
  #sf-dots { position:absolute; right:1.5rem; top:50%; transform:translateY(-50%);
    display:flex; flex-direction:column; gap:.5rem; z-index:20; }
  #sf-dots button { width:4px; height:4px; border-radius:99px; border:0; padding:0; cursor:pointer;
    background:rgba(255,255,255,.25); transition:all .3s; }
  #sf-dots button.active { width:8px; height:8px; background:var(--accent); box-shadow:0 0 8px var(--accent); }
</style>
</head>
<body>
  <div id="sf-container">
    <div id="sf-stage">
      <video id="sf-media" muted playsinline preload="auto" poster="./poster.jpg">
        <source src="./hero.mp4" type="video/mp4" />
      </video>
      <div id="sf-scrim"></div>

      <!-- Secciones: data-start / data-end son progreso 0..1 -->
      <div class="sf-section" data-side="left"  data-start="-0.04" data-end="0.24"><h1>Tu titular.</h1></div>
      <div class="sf-section" data-side="right" data-start="0.30"  data-end="0.54"><h2>Segundo beat.</h2></div>
      <div class="sf-section" data-side="left"  data-start="0.78"  data-end="1.0"><h2>¿Listo?</h2></div>

      <div id="sf-progress"><div></div></div>
      <div id="sf-dots"></div>

      <div id="sf-overlay">
        <div id="sf-bar-track"><div id="sf-bar"></div></div>
        <p id="sf-loading-label">Cargando</p>
      </div>
    </div>
  </div>

<script>
(function () {
  const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
  const container = document.getElementById('sf-container');
  const video     = document.getElementById('sf-media');
  const overlay   = document.getElementById('sf-overlay');
  const bar       = document.getElementById('sf-bar');
  const progEl    = document.querySelector('#sf-progress > div');
  const sections  = [...document.querySelectorAll('.sf-section')].map(el => ({
    el, start:+el.dataset.start, end:+el.dataset.end,
  }));

  // opacidad / parallax — fade + traslado sutil a lo largo del rango de cada sección
  function opacityFor(s, p, fade=0.04){
    if (p<=s.start || p>=s.end) return 0;
    if (p < s.start+fade) return (p-s.start)/fade;
    if (p > s.end-fade)   return (s.end-p)/fade;
    return 1;
  }
  function yFor(s, p, range=40){ const mid=(s.start+s.end)/2; return (p-mid)/(s.end-s.start)*range; }

  let raf = 0;
  function update(){
    const maxScroll = container.offsetHeight - window.innerHeight;
    const p = clamp(window.scrollY / maxScroll, 0, 1);
    if (video.readyState >= 1 && video.duration) video.currentTime = p * video.duration;
    progEl.style.width = (p*100) + '%';
    for (const s of sections){
      const o = opacityFor(s,p);
      s.el.style.opacity = o;
      s.el.style.transform = `translateY(${yFor(s,p)}px)`;
      s.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
    dots.forEach((d,i)=>{
      const s = sections[i], mid=(s.start+s.end)/2;
      d.classList.toggle('active', Math.abs(p-mid) < (s.end-s.start)/2);
    });
  }
  // agrupa el scroll → como máximo un seek por frame de animación
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive:true });

  // dots
  const dotsWrap = document.getElementById('sf-dots');
  const dots = sections.map((s,i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Ir a la sección ' + (i+1));
    b.onclick = () => {
      const mid=(s.start+s.end)/2, maxScroll=container.offsetHeight-window.innerHeight;
      scrollTo({ top: mid*maxScroll, behavior:'smooth' });
    };
    dotsWrap.appendChild(b); return b;
  });

  // listo + barra de carga
  let ready = false;
  function markReady(){ if (video.readyState >= 1 && !ready){ ready = true; bar.style.width='100%';
    setTimeout(()=>{ overlay.style.opacity='0'; overlay.style.pointerEvents='none'; }, 500); } }
  ['loadedmetadata','canplay','canplaythrough'].forEach(e => video.addEventListener(e, markReady));
  const poll = setInterval(()=>{ if (video.readyState>=1){ markReady(); clearInterval(poll); } }, 200);

  // progreso percibido: avanza hasta 90% y luego markReady salta a 100%
  const t0 = performance.now();
  (function tick(){ const pct = Math.min((performance.now()-t0)/1200*90, 90);
    if (!ready) bar.style.width = pct + '%'; if (pct < 90 && !ready) requestAnimationFrame(tick); })();

  update();
})();
</script>
</body>
</html>
```

---

## Técnica B — Secuencia de frames (canvas)

Lo más suave, especialmente en móvil. Extrae los frames primero con `scripts/extract-frames.sh`,
hospédalos (p. ej. `./frames/0001.jpg`). Reutiliza el **mismo CSS** de la Técnica A — solo cambia el
elemento del medio y el `<script>`.

Reemplaza el `<video>` por un canvas:

```html
<canvas id="sf-media" aria-hidden></canvas>
```

Y usa este motor (pon `FRAME_COUNT` con el número que imprimió el script de extracción):

```html
<script>
(function () {
  const FRAME_COUNT = 242; // ← desde extract-frames.sh
  const frameUrl = (i) => `./frames/${String(i+1).padStart(4,'0')}.jpg`; // índice 0 → archivo 1-indexado

  const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
  const container = document.getElementById('sf-container');
  const canvas    = document.getElementById('sf-media');
  const ctx       = canvas.getContext('2d');
  const overlay   = document.getElementById('sf-overlay');
  const bar       = document.getElementById('sf-bar');
  const progEl    = document.querySelector('#sf-progress > div');
  const sections  = [...document.querySelectorAll('.sf-section')].map(el => ({
    el, start:+el.dataset.start, end:+el.dataset.end }));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const images = new Array(FRAME_COUNT);
  let lastDrawn = -1, ready = false;

  const isLoaded = (i) => { const im = images[i]; return im && im.complete && im.naturalWidth > 0; };

  function draw(index){
    let idx = index;
    if (!isLoaded(idx)){ // cae al frame cargado más cercano para que el scrubbing nunca se trabe
      let found = -1;
      for (let d=1; d<FRAME_COUNT; d++){
        if (idx-d>=0 && isLoaded(idx-d)){ found=idx-d; break; }
        if (idx+d<FRAME_COUNT && isLoaded(idx+d)){ found=idx+d; break; }
      }
      if (found === -1) return; idx = found;
    }
    if (lastDrawn === idx) return;
    ctx.drawImage(images[idx], 0, 0, canvas.width, canvas.height);
    lastDrawn = idx;
  }

  // carga progresiva por lotes; la primera imagen dimensiona el canvas + revela el overlay
  function loadOne(i){
    const img = new Image(); img.decoding = 'async';
    if (i === 0) img.onload = () => {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      ctx.drawImage(img,0,0); lastDrawn = 0; ready = true; bar.style.width='100%';
      setTimeout(()=>{ overlay.style.opacity='0'; overlay.style.pointerEvents='none'; }, 500);
    };
    img.src = frameUrl(i); images[i] = img;
  }
  const INITIAL = Math.min(24, FRAME_COUNT);
  for (let i=0;i<INITIAL;i++) loadOne(i);
  let cursor = INITIAL;
  (function next(){ const end = Math.min(FRAME_COUNT, cursor+24);
    for (let i=cursor;i<end;i++) loadOne(i); cursor=end;
    if (cursor<FRAME_COUNT) setTimeout(next, 70); })();

  function opacityFor(s,p,fade=0.04){ if(p<=s.start||p>=s.end)return 0;
    if(p<s.start+fade)return (p-s.start)/fade; if(p>s.end-fade)return (s.end-p)/fade; return 1; }
  function yFor(s,p,range=40){ const mid=(s.start+s.end)/2; return (p-mid)/(s.end-s.start)*range; }

  let raf=0;
  function update(){
    const maxScroll = container.offsetHeight - window.innerHeight;
    const p = clamp(window.scrollY / maxScroll, 0, 1);
    if (!reduced) draw(Math.min(FRAME_COUNT-1, Math.floor(p*FRAME_COUNT)));
    progEl.style.width = (p*100)+'%';
    for (const s of sections){ const o=opacityFor(s,p);
      s.el.style.opacity=o; s.el.style.transform=`translateY(${yFor(s,p)}px)`;
      s.el.style.pointerEvents = o>0.5?'auto':'none'; }
    dots.forEach((d,i)=>{ const s=sections[i], mid=(s.start+s.end)/2;
      d.classList.toggle('active', Math.abs(p-mid)<(s.end-s.start)/2); });
  }
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive:true });

  const dotsWrap = document.getElementById('sf-dots');
  const dots = sections.map((s,i)=>{ const b=document.createElement('button');
    b.setAttribute('aria-label','Ir a la sección '+(i+1));
    b.onclick=()=>{ const mid=(s.start+s.end)/2, m=container.offsetHeight-window.innerHeight;
      scrollTo({top:mid*m,behavior:'smooth'}); };
    dotsWrap.appendChild(b); return b; });

  update();
})();
</script>
```

---

## Definir secciones

Cada `.sf-section` declara `data-start` / `data-end` (progreso 0→1) y `data-side`
(`left` / `right` / `center`). Ajusta los rangos para que las secciones no se solapen, alterna los
lados para que el texto nunca tape al sujeto del video, y pon el hero ligeramente negativo (`-0.04`)
para que se vea completo justo arriba del todo. Más secciones o un clip más largo → aumenta el alto
de `#sf-container` por encima de `500vh`.
