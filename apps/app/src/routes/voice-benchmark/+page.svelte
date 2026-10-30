<script lang="ts">
  import { onMount } from 'svelte';
  import { transcribeWorkoutAudio } from '#lib/voice-transcriber';
  import { transcribeWithVosk, VOSK_MODEL_DOWNLOAD_URL } from '#lib/voice-benchmark';

  type Engine = 'runonweb' | 'vosk';
  type EngineResult = {
    engine: Engine;
    text: string;
    elapsedMs?: number;
    modelLoadMs?: number;
    inferenceMs?: number;
    downloadedBytes?: number;
    archiveBytes?: number;
    correct: boolean | null;
    error?: string;
  };
  type Comparison = {
    id: string;
    phrase: string;
    expected: string;
    recordedAt: string;
    offline: boolean;
    results: EngineResult[];
  };

  const prompts = [
    'Hice 10 repeticiones con 80 kilos.',
    'Serie 1: hice 8 reps con 32,5 kilos.',
    'Ya terminé este ejercicio, vamos con el siguiente.',
    'Ya me tomé la creatina de hoy.',
    'Hice 12 repeticiones con 20 kilos en la serie 2.',
    'Terminé el press banca.',
  ];
  const MAX_RECORDING_MS = 20_000;
  const HISTORY_KEY = 'gymup.voice-benchmark.history.v1';

  let promptIndex = $state(0);
  let isRecording = $state(false);
  let isComparing = $state(false);
  let audioBlob = $state<Blob | null>(null);
  let recordedBytes = $state(0);
  let recordingError = $state('');
  let progress = $state('');
  let online = $state(true);
  let latest = $state<Comparison | null>(null);
  let history = $state<Comparison[]>([]);
  let reportText = $state('');
  let copyMessage = $state('');
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let recordingChunks: BlobPart[] = [];
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let compareController: AbortController | undefined;
  let mounted = false;

  const selectedPrompt = $derived(prompts[promptIndex] ?? prompts[0]!);
  const modelBytesFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

  function formatBytes(bytes: number | undefined): string {
    if (bytes === undefined) return 'No disponible';
    if (bytes === 0) return '0 bytes reportados';
    return `${modelBytesFormat.format(bytes / (1024 * 1024))} MB`;
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
    } catch {
      // Keep the current comparison visible even if the browser rejects local storage.
    }
  }

  onMount(() => {
    mounted = true;
    online = navigator.onLine;
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Comparison[];
      if (Array.isArray(parsed)) history = parsed.slice(0, 40);
    } catch {
      history = [];
    }
    const updateConnection = () => { online = navigator.onLine; };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      mounted = false;
      compareController?.abort();
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
      if (stopTimer) clearTimeout(stopTimer);
      if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
      mediaStream?.getTracks().forEach((track) => track.stop());
    };
  });

  function releaseMicrophone() {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
  }

  async function startRecording() {
    recordingError = '';
    audioBlob = null;
    recordedBytes = 0;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recordingError = 'Este WebView no ofrece grabación de audio compatible.';
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      const mime = typeof MediaRecorder.isTypeSupported === 'function'
        ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;
      const recorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      mediaRecorder = recorder;
      recordingChunks = [];
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) recordingChunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(recordingChunks, { type: recorder.mimeType || 'audio/mp4' });
        audioBlob = blob;
        recordedBytes = blob.size;
        recordingChunks = [];
        releaseMicrophone();
      }, { once: true });
      recorder.start();
      isRecording = true;
      stopTimer = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      releaseMicrophone();
      recordingError = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Permite el uso del micrófono para grabar la frase.'
        : 'No se pudo iniciar el micrófono en este dispositivo.';
    }
  }

  function stopRecording() {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    isRecording = false;
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function getRunOnWebTransferBytes(before: number): number | undefined {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const added = entries.slice(before).filter((entry) => entry.transferSize > 0);
    if (added.length === 0) return undefined;
    return added.reduce((sum, entry) => sum + entry.transferSize, 0);
  }

  async function compareEngines() {
    if (!audioBlob || isComparing) return;
    isComparing = true;
    const controller = new AbortController();
    compareController = controller;
    const { signal } = controller;
    progress = 'Transcribiendo el mismo audio con RunOnWeb…';
    const results: EngineResult[] = [];
    const startedAt = new Date().toISOString();

    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const beforeRunOnWeb = resourceEntries.length;
    const runOnWebStartedAt = performance.now();
    try {
      const text = await transcribeWorkoutAudio(audioBlob, (info) => {
        if (!mounted || signal.aborted) return;
        if (info.status === 'downloading' || info.status === 'loading') progress = 'RunOnWeb: cargando sus pesos locales…';
        else if (info.status === 'transcribing') progress = 'RunOnWeb: transcribiendo…';
      }, signal);
      if (signal.aborted || !mounted) return;
      results.push({
        engine: 'runonweb',
        text,
        elapsedMs: performance.now() - runOnWebStartedAt,
        downloadedBytes: getRunOnWebTransferBytes(beforeRunOnWeb),
        correct: null,
      });
    } catch (error) {
      if (signal.aborted || !mounted) return;
      results.push({ engine: 'runonweb', text: '', correct: null, error: errorMessage(error) });
    }

    progress = 'Vosk: preparando el modelo español y transcribiendo…';
    try {
      const result = await transcribeWithVosk(audioBlob, (info) => {
        if (!mounted || signal.aborted) return;
        if (info.status === 'downloading') progress = 'Vosk: descargando el modelo español (solo la primera vez)…';
        else if (info.status === 'converting') progress = 'Vosk: preparando el modelo para el motor…';
        else if (info.status === 'loading') progress = 'Vosk: cargando el motor local…';
        else progress = 'Vosk: transcribiendo…';
      }, signal);
      if (signal.aborted || !mounted) return;
      results.push({
        engine: 'vosk',
        text: result.text,
        elapsedMs: result.elapsedMs,
        modelLoadMs: result.modelLoadMs,
        inferenceMs: result.inferenceMs,
        downloadedBytes: result.downloadedBytes,
        archiveBytes: result.archiveBytes,
        correct: null,
      });
    } catch (error) {
      if (signal.aborted || !mounted) return;
      results.push({ engine: 'vosk', text: '', correct: null, error: errorMessage(error) });
    }

    const comparison: Comparison = {
      id: crypto.randomUUID(),
      phrase: selectedPrompt,
      expected: selectedPrompt,
      recordedAt: startedAt,
      offline: !online,
      results,
    };
    latest = comparison;
    history = [comparison, ...history].slice(0, 40);
    saveHistory();
    progress = '';
    isComparing = false;
    compareController = undefined;
  }

  function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Falló la transcripción en este dispositivo.';
  }

  function markCorrect(engine: Engine, correct: boolean) {
    if (!latest) return;
    latest = {
      ...latest,
      results: latest.results.map((result) => result.engine === engine ? { ...result, correct } : result),
    };
    history = history.map((entry) => entry.id === latest!.id ? latest! : entry);
    saveHistory();
  }

  function makeReport(): string {
    const lines = ['Gym Up · comparación de dictado', `Plataforma: ${/Android/i.test(navigator.userAgent) ? 'Android/Tauri' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone/iPad Safari' : 'Navegador de escritorio'}`, `Red actual del navegador: ${navigator.onLine ? 'en línea' : 'sin conexión'}`, ''];
    for (const entry of [...history].reverse()) {
      lines.push(`${entry.recordedAt} · ${entry.offline ? 'OFFLINE' : 'ONLINE'} · Frase: ${entry.expected}`);
      for (const result of entry.results) {
        lines.push(`  ${result.engine}: ${result.error ?? result.text}; total=${result.elapsedMs === undefined ? 'falló' : `${Math.round(result.elapsedMs)} ms`}; modelo descargado=${formatBytes(result.downloadedBytes)}; acierto=${result.correct === null ? 'sin marcar' : result.correct ? 'sí' : 'no'}`);
      }
    }
    return lines.join('\n');
  }

  async function copyResults() {
    reportText = makeReport();
    try {
      await navigator.clipboard.writeText(reportText);
      copyMessage = 'Resultados copiados.';
    } catch {
      copyMessage = 'Selecciona y copia el informe que aparece abajo.';
    }
  }

  function clearHistory() {
    history = [];
    latest = null;
    saveHistory();
  }
</script>

<svelte:head>
  <title>Comparación de dictado · Gym Up</title>
  <meta name="description" content="Compara RunOnWeb y Vosk localmente con las mismas frases de entrenamiento." />
</svelte:head>

<main class="page">
  <a class="back" href="/more">← Más</a>
  <header>
    <p class="eyebrow">PRUEBA DE VOZ</p>
    <h1>Compara el dictado</h1>
    <p class="intro">Graba una frase una vez. La app envía esa misma grabación a RunOnWeb y a Vosk, y compara sus transcripciones en este dispositivo.</p>
  </header>

  <section class="notice" aria-live="polite">
    <strong>Audio local · sin acciones en tu entrenamiento</strong>
    <span>El audio permanece en memoria y se borra al salir de esta pantalla. Solo se guarda el texto de los resultados en este dispositivo.</span>
    <span>Conexión del navegador: <b>{online ? 'en línea' : 'sin conexión'}</b>. Para la prueba offline descarga ambos modelos primero y luego activa el modo avión.</span>
  </section>

  <section class="card">
    <label for="phrase">Frase para dictar</label>
    <select id="phrase" bind:value={promptIndex} disabled={isRecording || isComparing}>
      {#each prompts as prompt, index}
        <option value={index}>{String(index + 1).padStart(2, '0')} · {prompt}</option>
      {/each}
    </select>
    <p class="expected">Lee la frase tal como está escrita; luego marca si cada transcripción conserva el significado y los números.</p>

    <div class="controls">
      <button class="primary" type="button" disabled={isComparing} onclick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Detener grabación' : 'Grabar frase'}
      </button>
      <button class="secondary" type="button" disabled={!audioBlob || isComparing || isRecording} onclick={compareEngines}>
        Comparar RunOnWeb y Vosk
      </button>
    </div>
    {#if isRecording}<p class="status" aria-live="polite">Grabando… el límite es 20 segundos.</p>{/if}
    {#if audioBlob}<p class="status">Audio listo: {formatBytes(recordedBytes)}. Se usará la misma grabación con los dos motores.</p>{/if}
    {#if progress}<p class="status" aria-live="polite">{progress}</p>{/if}
    {#if recordingError}<p class="error" role="alert">{recordingError}</p>{/if}
  </section>

  {#if latest}
    <section class="card results" aria-labelledby="results-title">
      <div class="result-heading">
        <div><p class="eyebrow">{latest.offline ? 'PRUEBA SIN CONEXIÓN' : 'PRUEBA CON CONEXIÓN'}</p><h2 id="results-title">Resultados de la frase</h2></div>
        <span class="network">{latest.offline ? 'Offline' : 'Online'}</span>
      </div>
      <p class="expected"><b>Pronunciada:</b> {latest.expected}</p>
      <div class="engine-grid">
        {#each latest.results as result}
          <article class="engine-result">
            <h3>{result.engine === 'runonweb' ? 'RunOnWeb · Whisper base' : 'Vosk · español pequeño'}</h3>
            {#if result.error}
              <p class="error">{result.error}</p>
            {:else}
              <p class="transcript">{result.text || 'No se detectó texto.'}</p>
              <dl>
                <div><dt>Tiempo total</dt><dd>{Math.round(result.elapsedMs ?? 0)} ms</dd></div>
                {#if result.engine === 'vosk'}
                  <div><dt>Carga del motor</dt><dd>{Math.round(result.modelLoadMs ?? 0)} ms</dd></div>
                  <div><dt>Inferencia</dt><dd>{Math.round(result.inferenceMs ?? 0)} ms</dd></div>
                {/if}
                <div><dt>Transferencia informada</dt><dd>{result.engine === 'vosk' && result.downloadedBytes === 0 ? 'Modelo reutilizado desde caché' : formatBytes(result.downloadedBytes)}</dd></div>
                {#if result.engine === 'vosk' && result.archiveBytes !== undefined}<div><dt>Archivo local preparado</dt><dd>{formatBytes(result.archiveBytes)}</dd></div>{/if}
              </dl>
              <div class="accuracy">
                <span>¿Acierto?</span>
                <button type="button" class:chosen={result.correct === true} disabled={isComparing} onclick={() => markCorrect(result.engine, true)}>Sí</button>
                <button type="button" class:chosen={result.correct === false} disabled={isComparing} onclick={() => markCorrect(result.engine, false)}>No</button>
              </div>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}

  <section class="card instructions">
    <h2>Cómo probar sin conexión</h2>
    <ol>
      <li>Con internet, ejecuta una comparación para descargar y preparar los modelos.</li>
      <li>Vuelve a grabar la misma frase y compara de nuevo para medir la carga desde caché.</li>
      <li>Activa el modo avión, vuelve a abrir esta pantalla y repite la prueba. Anota si ambos motores terminan correctamente.</li>
      <li>Repite las frases en silencio y en el gimnasio. Marca «Sí» solo si conserva la acción y todos los números/unidades.</li>
    </ol>
    <p class="small">Vosk descargará su modelo desde <a href={VOSK_MODEL_DOWNLOAD_URL} target="_blank" rel="noreferrer">Hugging Face (copia del modelo oficial de Vosk)</a> la primera vez. El tamaño registrado es el de la descarga real. No se incluye dentro del APK.</p>
  </section>

  <section class="card history">
    <div class="result-heading"><div><h2>Historial en este dispositivo</h2><p class="small">{history.length} comparaciones guardadas; no se sincronizan con la cuenta.</p></div></div>
    <div class="controls">
      <button class="secondary" type="button" disabled={!history.length} onclick={copyResults}>Copiar resultados</button>
      <button class="quiet" type="button" disabled={!history.length} onclick={clearHistory}>Borrar historial</button>
    </div>
    {#if copyMessage}<p class="status" role="status">{copyMessage}</p>{/if}
    {#if reportText}<textarea class="report" readonly rows="8" bind:value={reportText} aria-label="Informe copiable de la comparación"></textarea>{/if}
  </section>
</main>

<style>
  .page { width: min(100% - 2rem, 760px); margin: 0 auto; padding: 1rem 0 7rem; display: grid; gap: 1rem; }
  header { display: grid; gap: .45rem; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: clamp(2rem, 9vw, 3rem); line-height: 1; }
  h2 { font-size: 1.2rem; }
  h3 { font-size: 1rem; }
  .eyebrow { color: var(--accent-hi); font-size: .72rem; letter-spacing: .12em; font-weight: 800; }
  .intro, .expected, .small, .notice span { color: var(--text-muted, #aaa); line-height: 1.45; }
  .intro { max-width: 60ch; }
  .back { color: var(--accent-hi); text-decoration: none; font-weight: 700; }
  .card, .notice { display: grid; gap: .8rem; padding: 1rem; border-radius: 18px; background: var(--surface, #171719); box-shadow: 0 0 0 1px var(--line, #303034) inset; }
  .notice { border-color: var(--accent-hi, #d1ff4d); }
  label { font-weight: 750; }
  select { width: 100%; padding: .8rem; border: 1px solid var(--line, #404046); border-radius: 12px; color: inherit; background: var(--surface, #171719); font: inherit; }
  .controls { display: flex; flex-wrap: wrap; gap: .6rem; }
  button { min-height: 44px; border: 0; border-radius: 12px; padding: .65rem .9rem; font: inherit; font-weight: 750; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .45; }
  .primary { background: var(--accent-hi, #d1ff4d); color: #121212; }
  .secondary { background: var(--accent-soft, #30351f); color: var(--accent-hi, #d1ff4d); }
  .quiet { background: transparent; color: var(--text-muted, #aaa); box-shadow: 0 0 0 1px var(--line, #404046) inset; }
  .status { color: var(--accent-hi, #d1ff4d); font-size: .9rem; }
  .error { color: #ff8d85; overflow-wrap: anywhere; }
  .result-heading { display: flex; justify-content: space-between; align-items: center; gap: .6rem; }
  .result-heading > div { display: grid; gap: .3rem; }
  .network { padding: .3rem .6rem; border-radius: 999px; background: var(--accent-soft, #30351f); color: var(--accent-hi, #d1ff4d); font-size: .8rem; font-weight: 800; }
  .engine-grid { display: grid; gap: .7rem; }
  .engine-result { display: grid; gap: .65rem; min-width: 0; padding: .85rem; border-radius: 14px; background: var(--bg, #101012); }
  .transcript { overflow-wrap: anywhere; line-height: 1.5; }
  dl { display: grid; gap: .4rem; margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: .8rem; font-size: .85rem; }
  dt { color: var(--text-muted, #aaa); }
  dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .accuracy { display: flex; align-items: center; gap: .5rem; }
  .accuracy span { margin-right: auto; font-weight: 700; }
  .accuracy button { min-height: 36px; padding: .35rem .75rem; }
  .accuracy button.chosen { background: var(--accent-hi, #d1ff4d); color: #121212; }
  ol { margin: 0; padding-left: 1.3rem; display: grid; gap: .5rem; color: var(--text-muted, #aaa); line-height: 1.45; }
  .small { font-size: .82rem; }
  .small a { color: var(--accent-hi, #d1ff4d); }
  .report { width: 100%; box-sizing: border-box; padding: .7rem; border: 1px solid var(--line, #404046); border-radius: 10px; background: var(--bg, #101012); color: inherit; font: .78rem/1.4 ui-monospace, monospace; }
  @media (min-width: 620px) { .engine-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
