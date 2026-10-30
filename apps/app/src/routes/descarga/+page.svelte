<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  let qrDataUrl = $state('');
  let apkHref = $state('/downloads/gym-up.apk');
  let apkName = $state('gym-up-android.apk');
  let downloadStarted = $state(false);

  function onDownloadClick(event: MouseEvent) {
    // One download per tap; a second tap right after would save a duplicate APK.
    if (downloadStarted) {
      event.preventDefault();
      return;
    }
    downloadStarted = true;
    setTimeout(() => (downloadStarted = false), 5000);
  }

  onMount(async () => {
    // Versioned file name so repeated downloads don't become gym-up(1).apk.
    fetch('/update.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (typeof manifest?.version !== 'string' || typeof manifest?.apkUrl !== 'string') return;
        apkHref = manifest.apkUrl;
        apkName = `gym-up-${manifest.version}.apk`;
      })
      .catch(() => {});

    try {
      qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/descarga`, {
        errorCorrectionLevel: 'H',
        margin: 0,
        width: 288,
        color: { dark: '#101012', light: '#ffffff' }
      });
    } catch {
      qrDataUrl = '';
    }
  });
</script>

<svelte:head>
  <title>Descarga Gym Up para Android</title>
  <meta
    name="description"
    content="Prueba Gym Up en Android: registra tus entrenamientos, sigue tus rutinas y consulta tu progreso."
  />
  <meta name="theme-color" content="#0e0e10" />
</svelte:head>

<main class="install-page">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Gym Up, inicio">
      <img src="/favicon.svg" alt="" width="40" height="40" />
      <span>GYM <b>UP</b></span>
    </a>
    <span class="release-label"><span class="status-dot"></span> EN DESARROLLO</span>
  </header>

  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">TU COMPAÑERA DE ENTRENAMIENTO</p>
      <h1 id="hero-title">Tu progreso,<br /><em>serie a serie.</em></h1>
      <p class="intro">
        Guarda tus entrenamientos, sigue tu rutina y mira qué peso moviste la última vez.
        Gym Up también funciona cuando no tienes cobertura en el gimnasio.
      </p>

      <a class="download-button" href={apkHref} download={apkName} aria-disabled={downloadStarted} onclick={onDownloadClick}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M12 3.75v11.5m0 0 4.25-4.25M12 15.25 7.75 11M4.75 16.5v2.25c0 .83.67 1.5 1.5 1.5h11.5c.83 0 1.5-.67 1.5-1.5V16.5" />
        </svg>
        <span>Descargar para Android</span>
        <svg class="button-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </a>
      <p class="file-note">APK release firmado · Android 7 o posterior, 64 bits</p>

      {#if qrDataUrl}
        <div class="qr-prompt">
          <img
            class="qr-image"
            src={qrDataUrl}
            alt="Código QR para abrir la página de descarga de Gym Up"
            width="96"
            height="96"
          />
          <div>
            <strong>¿La abres desde otro dispositivo?</strong>
            <p>Escanea el código con la cámara de tu teléfono para descargar Gym Up.</p>
          </div>
        </div>
      {/if}
      <p class="ios-install-note">
        <strong>¿Tienes iPhone?</strong>
        <a href="/">Abre Gym Up y usa “Añadir a pantalla de inicio” en el menú Compartir de Safari, Chrome o Edge.</a>
      </p>
    </div>

    <div class="app-preview" aria-label="Resumen de Gym Up">
      <div class="preview-top">
        <div>
          <span class="preview-date">VISTA DE EJEMPLO · RUTINA DE TREN</span>
          <h2>Hoy toca<br />empujar.</h2>
        </div>
        <div class="preview-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M32 7v50M12 32h40M18 18l28 28m0-28L18 46" />
            <circle cx="32" cy="32" r="24" />
          </svg>
        </div>
      </div>
      <div class="exercise-line">
        <span class="exercise-number">01</span>
        <div class="exercise-details"><strong>Press banca</strong><span>4 series · 8 reps</span></div>
        <div class="last-weight"><span>ÚLTIMA VEZ</span><strong>60 <small>kg</small></strong></div>
      </div>
      <div class="preview-rule"></div>
      <div class="preview-bottom">
        <span><i></i> RUTINA GUARDADA</span>
        <b>LISTO PARA ENTRENAR</b>
      </div>
      <span class="preview-index">GYM UP / 01</span>
    </div>
  </section>

  <section class="install-guide" aria-labelledby="guide-title">
    <div class="guide-heading">
      <h2 id="guide-title">En tres pasos estás dentro.</h2>
      <p>La primera instalación solo lleva un momento.</p>
    </div>
    <ol>
      <li>
        <span class="step-number">01</span>
        <div><strong>Descarga el archivo</strong><p>Toca el botón y espera a que termine.</p></div>
      </li>
      <li>
        <span class="step-number">02</span>
        <div><strong>Permite la instalación</strong><p>Si Android lo pide, autoriza las descargas desde tu navegador.</p></div>
      </li>
      <li>
        <span class="step-number">03</span>
        <div><strong>Instala Gym Up</strong><p>Abre el APK descargado y confirma la instalación.</p></div>
      </li>
    </ol>
    <p class="beta-note">
      Esta es una versión de prueba que todavía está en desarrollo. Android mostrará una
      confirmación porque la app se instala desde fuera de Play Store.
    </p>
  </section>

  <footer>
    <span>GYM UP <span class="footer-separator">/</span> ENTRENA A TU RITMO</span>
    <span>HECHA PARA EL GIMNASIO. LISTA PARA CUALQUIER SEÑAL.</span>
  </footer>
</main>

<style>
  .install-page {
    --page-width: 1120px;
    width: min(100%, var(--page-width));
    max-width: none;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 26px) clamp(22px, 6vw, 76px)
      calc(34px + env(safe-area-inset-bottom));
    animation: none;
  }

  .topbar,
  .brand,
  .release-label,
  .download-button,
  .preview-bottom,
  footer {
    display: flex;
    align-items: center;
  }

  .topbar {
    justify-content: space-between;
    min-height: 48px;
  }

  .brand {
    gap: 10px;
    color: var(--text);
    font-size: 16px;
    font-weight: 760;
    letter-spacing: 0.045em;
    text-decoration: none;
  }

  .brand img { border-radius: 12px; }
  .brand b { color: var(--accent-hi); }

  .release-label {
    gap: 9px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .status-dot,
  .preview-bottom i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.84fr);
    align-items: center;
    gap: clamp(48px, 8vw, 110px);
    padding: clamp(68px, 12vh, 112px) 0 92px;
  }

  .hero-copy { max-width: 540px; }

  .eyebrow {
    margin: 0 0 22px;
    color: var(--accent-hi);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  h1 {
    margin: 0;
    font-size: clamp(52px, 7.3vw, 82px);
    font-weight: 760;
    letter-spacing: -0.052em;
    line-height: 0.99;
  }

  h1 em {
    color: var(--accent-hi);
    font-style: normal;
  }

  .intro {
    max-width: 440px;
    margin: 24px 0 29px;
    color: #b7b7bf;
    font-size: 16px;
    line-height: 1.7;
  }

  .download-button {
    width: fit-content;
    min-height: 58px;
    justify-content: center;
    gap: 13px;
    padding: 0 20px;
    border-radius: 10px;
    background: var(--accent);
    box-shadow: 0 8px 22px rgb(255 106 43 / 0.18);
    color: var(--accent-ink);
    font-size: 15px;
    font-weight: 750;
    text-decoration: none;
    transition: transform 180ms var(--ease), background-color 180ms var(--ease),
      box-shadow 180ms var(--ease);
  }

  .download-button:hover {
    transform: translateY(-2px);
    background: var(--accent-hi);
    box-shadow: 0 12px 28px rgb(255 106 43 / 0.22);
  }

  .download-button:active { transform: translateY(0); }
  .download-button[aria-disabled='true'] { opacity: 0.6; cursor: default; pointer-events: none; }
  .download-button svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .download-button .button-arrow { width: 18px; height: 18px; margin-left: 7px; }

  .file-note {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 12px;
  }

  .qr-prompt {
    display: grid;
    width: min(100%, 390px);
    grid-template-columns: 96px 1fr;
    align-items: center;
    gap: 16px;
    margin-top: 26px;
    padding: 13px;
    border: 1px solid var(--line-strong);
    border-radius: 13px;
    background: linear-gradient(145deg, #1b1b1e, #151517);
  }

  .qr-image {
    display: block;
    width: 96px;
    height: 96px;
    padding: 6px;
    border-radius: 8px;
    background: #fff;
  }

  .qr-prompt strong { font-size: 12px; font-weight: 700; }
  .qr-prompt p { margin: 6px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }

  .ios-install-note { max-width: 390px; margin: 18px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .ios-install-note strong { display: block; margin-bottom: 3px; color: var(--text); font-size: 12px; }
  .ios-install-note a { color: var(--accent-hi); text-underline-offset: 3px; }

  .app-preview {
    position: relative;
    min-height: 340px;
    padding: 30px 27px 24px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: 17px;
    background:
      radial-gradient(ellipse at 87% 11%, rgb(255 106 43 / 0.12), transparent 34%),
      linear-gradient(145deg, #202024 0%, #141416 76%);
    box-shadow: 0 28px 72px -40px rgb(0 0 0 / 0.9), 0 10px 24px -18px rgb(255 106 43 / 0.16);
    transform: rotate(1.3deg);
  }

  .preview-top { display: flex; align-items: start; justify-content: space-between; }
  .preview-date { color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: 0.15em; }

  .preview-top h2 {
    margin: 15px 0 37px;
    font-size: 35px;
    font-weight: 760;
    letter-spacing: -0.045em;
    line-height: 0.99;
  }

  .preview-mark {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border-radius: 13px;
    background: var(--accent-soft);
    color: var(--accent-hi);
  }

  .preview-mark svg { width: 27px; height: 27px; stroke: currentColor; stroke-width: 1.25; }
  .exercise-line { display: flex; align-items: center; gap: 13px; }
  .exercise-number { align-self: start; padding-top: 2px; color: var(--accent-hi); font-family: var(--font-display); font-size: 21px; font-weight: 700; }
  .exercise-details { display: grid; flex: 1; gap: 4px; }
  .exercise-details strong { font-size: 14px; font-weight: 650; }
  .exercise-details span { color: var(--muted); font-size: 11px; }
  .last-weight { display: grid; gap: 2px; text-align: right; }
  .last-weight > span { color: var(--muted); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; }
  .last-weight strong { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
  .last-weight small { color: var(--muted); font-family: var(--font-body); font-size: 12px; font-weight: 500; }

  .preview-rule { height: 1px; margin: 23px 0 17px; background: var(--line-strong); }
  .preview-bottom { justify-content: space-between; gap: 12px; color: var(--muted); font-size: 8px; font-weight: 700; letter-spacing: 0.09em; }
  .preview-bottom > span { display: flex; align-items: center; gap: 9px; }
  .preview-bottom i { width: 5px; height: 5px; box-shadow: none; }
  .preview-index { position: absolute; right: 27px; bottom: 9px; color: var(--faint); font-size: 7px; letter-spacing: 0.14em; }

  .install-guide {
    display: grid;
    grid-template-columns: 0.85fr 1.15fr;
    column-gap: clamp(40px, 8vw, 104px);
    padding: 32px 0 38px;
    border-top: 1px solid var(--line-strong);
  }

  .guide-heading h2 { margin: 0 0 10px; font-size: 21px; letter-spacing: -0.025em; }
  .guide-heading p { color: var(--muted); font-size: 13px; }
  ol { display: grid; gap: 20px; margin: 0; padding: 0; list-style: none; }
  li { display: grid; grid-template-columns: 33px 1fr; gap: 11px; align-items: start; }
  .step-number { color: var(--accent-hi); font-family: var(--font-display); font-size: 20px; font-weight: 700; }
  li strong { font-size: 13px; font-weight: 650; }
  li p { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
  .beta-note { grid-column: 2; margin: 24px 0 0 44px; color: var(--muted); font-size: 11px; line-height: 1.6; }

  footer {
    justify-content: space-between;
    gap: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
    color: var(--faint);
    font-size: 8px;
    font-weight: 650;
    letter-spacing: 0.11em;
  }

  .footer-separator { padding: 0 5px; color: var(--accent); }

  @media (max-width: 760px) {
    .install-page { padding-inline: 23px; }
    .hero { grid-template-columns: 1fr; gap: 42px; padding: 74px 0 61px; }
    .hero-copy { max-width: 540px; }
    h1 { font-size: clamp(53px, 12vw, 76px); }
    .app-preview { width: min(100%, 420px); min-height: 320px; justify-self: center; transform: rotate(0.7deg); }
    .install-guide { grid-template-columns: 1fr; row-gap: 26px; padding-top: 29px; }
    .beta-note { grid-column: 1; margin: 21px 0 0 44px; }
    footer { align-items: start; flex-direction: column; }
  }

  @media (max-width: 400px) {
    .install-page { padding-inline: 18px; }
    .release-label { font-size: 9px; }
    .hero { padding-top: 62px; }
    .app-preview { min-height: 300px; padding: 25px 20px 22px; }
    .preview-index { right: 20px; }
    .preview-bottom { font-size: 7px; }
    .download-button { width: 100%; gap: 10px; padding-inline: 13px; }
    .download-button .button-arrow { margin-left: auto; }
  }

  @media (prefers-reduced-motion: reduce) {
    .download-button { transition: none; }
    .download-button:hover { transform: none; }
  }
</style>
