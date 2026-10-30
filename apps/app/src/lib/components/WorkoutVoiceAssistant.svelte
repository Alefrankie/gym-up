<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';
  import { localDay, loadSupplements, persistMark, withMark } from '#lib/supplements';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { normalizeSupplementName, parseWorkoutVoiceCommand, type WorkoutVoiceCommand } from '#lib/voice-assistant';
  import { transcribeWorkoutAudio } from '#lib/voice-transcriber';
  import { coachVoice } from '#lib/coach/voice.svelte';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  const view = useWorkoutView();
  const MAX_RECORDING_MS = 20_000;
  let status = $state<'idle' | 'recording' | 'transcribing' | 'ready' | 'error'>('idle');
  let transcript = $state('');
  let command = $state<WorkoutVoiceCommand | null>(null);
  let message = $state('');
  let progress = $state('');
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: BlobPart[] = [];
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  let pendingSupplement = $state<{ list: Awaited<ReturnType<typeof loadSupplements>>['data']; id: string } | null>(null);

  const currentExercise = $derived.by(() => {
    const exercises = view.snap?.exercises ?? [];
    const routeExercise = exercises.find((e) => e.exerciseId === page.params.exercise);
    return routeExercise ?? exercises.find((e) => view.activeSet(e) !== null) ?? null;
  });

  function releaseMic() {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
  }

  // The Coach never talks while the microphone is listening.
  $effect(() => {
    coachVoice.micBusy = status === 'recording';
    if (status === 'recording') coachVoice.stop();
  });

  onDestroy(() => {
    coachVoice.micBusy = false;
    destroyed = true;
    if (recorder?.state === 'recording') recorder.stop();
    releaseMic();
  });

  async function startRecording() {
    message = '';
    transcript = '';
    command = null;
    pendingSupplement = null;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      status = 'error';
      message = t('voice.unsupported');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      if (destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
        return;
      }
      const mime = typeof MediaRecorder.isTypeSupported === 'function'
        ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;
      const activeRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder = activeRecorder;
      chunks = [];
      activeRecorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
      activeRecorder.addEventListener('stop', () => {
        if (!destroyed) void transcribe(new Blob(chunks, { type: activeRecorder.mimeType || 'audio/mp4' }));
      });
      activeRecorder.start();
      status = 'recording';
      stopTimer = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      releaseMic();
      status = 'error';
      message = error instanceof DOMException && error.name === 'NotAllowedError' ? t('voice.permission') : t('voice.captureError');
    }
  }

  function stopRecording() {
    if (recorder?.state === 'recording') recorder.stop();
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    status = 'transcribing';
  }

  async function transcribe(blob: Blob) {
    try {
      progress = '';
      const text = await transcribeWorkoutAudio(blob, (info) => {
        if (info.status === 'downloading' || info.status === 'loading') progress = t('voice.modelLoading');
        else if (info.status === 'transcribing') progress = t('voice.transcribing');
      });
      transcript = text;
      command = parseWorkoutVoiceCommand(text);
      status = 'ready';
      message = text ? '' : t('voice.noTranscript');
    } catch {
      status = 'error';
      message = t('voice.transcriptionError');
    } finally {
      releaseMic();
      chunks = [];
      progress = '';
    }
  }

  function updateTranscript(value: string) {
    transcript = value;
    command = parseWorkoutVoiceCommand(value);
    pendingSupplement = null;
    message = '';
  }

  function preview(commandToShow: WorkoutVoiceCommand | null): string {
    if (!commandToShow) return t('voice.noCommand');
    if (commandToShow.type === 'log-set') {
      const ex = currentExercise;
      return t('voice.previewSet', {
        exercise: ex?.exerciseName ?? '',
        set: commandToShow.setNumber ?? (ex ? view.activeSet(ex) ?? '?' : '?'),
        reps: commandToShow.reps,
        weight: commandToShow.weight === undefined ? t('voice.keepWeight') : `${commandToShow.weight} ${commandToShow.weightUnit}`,
      });
    }
    if (commandToShow.type === 'next-exercise') return t('voice.previewNext');
    if (!commandToShow.query) return t('voice.supplementUnclear');
    return t('voice.previewSupplement', { name: commandToShow.query });
  }

  async function applyCommand() {
    if (!command) return;
    message = '';
    if (command.type === 'log-set') {
      if (command.reps < 1 || command.reps > 100 || (command.weight !== undefined && (command.weight < 0 || command.weight > 1000))) {
        message = t('voice.valuesInvalid');
        return;
      }
      const ex = currentExercise;
      const setNumber = command.setNumber ?? (ex ? view.activeSet(ex) : null);
      if (!ex || !setNumber || !view.row(ex.exerciseId, setNumber)) {
        message = t('voice.setUnavailable');
        return;
      }
      const row = view.row(ex.exerciseId, setNumber)!;
      row.reps = command.reps;
      if (command.weight !== undefined && command.weightUnit) {
        const kg = command.weightUnit === 'lbs' ? command.weight / 2.20462 : command.weight;
        row.weight = toDisplay(kg, view.unit);
      }
      await view.commit(ex.exerciseId, setNumber, true);
      message = t('voice.applied');
      command = null;
      return;
    }

    if (command.type === 'next-exercise') {
      const exercises = view.snap?.exercises ?? [];
      const index = exercises.findIndex((e) => e.exerciseId === page.params.exercise);
      const next = index >= 0 ? exercises[index + 1] ?? exercises.find((e) => view.activeSet(e) !== null) : exercises.find((e) => view.activeSet(e) !== null);
      if (next) void goto(`/workout/${page.params.id}/${next.exerciseId}`, { replaceState: true });
      else void goto(`/workout/${page.params.id}`, { replaceState: true });
      command = null;
      return;
    }

    if (!command.query) {
      message = t('voice.supplementUnclear');
      return;
    }
    try {
      const list = (await loadSupplements(localDay(), () => {})).data;
      const query = normalizeSupplementName(command.query);
      const matches = list.items.filter((item) => {
        const name = normalizeSupplementName(item.name);
        return name === query || name.includes(query) || query.includes(name);
      });
      if (matches.length !== 1) {
        message = matches.length ? t('voice.supplementAmbiguous') : t('voice.supplementMissing');
        return;
      }
      const match = matches[0]!;
      if (match.taken) {
        message = t('voice.supplementAlready');
        command = null;
        return;
      }
      pendingSupplement = { list, id: match.id };
    } catch {
      message = t('voice.supplementLoadError');
    }
  }

  async function confirmSupplement() {
    if (!pendingSupplement) return;
    const { list, id } = pendingSupplement;
    await persistMark(withMark(list, id, true), id, true);
    pendingSupplement = null;
    command = null;
    message = t('voice.applied');
  }
</script>

{#if view.snap && !view.isCompleted}
  <section class="assistant" aria-label={t('voice.title')}>
    <div class="topline">
      <strong>{t('voice.title')}</strong>
      <span class="hint">{t('voice.localPrivacy')}</span>
    </div>
    <button class="mic" type="button" class:recording={status === 'recording'} disabled={status === 'transcribing'} onclick={status === 'recording' ? stopRecording : startRecording}>
      <Icon name={status === 'recording' ? 'stop' : 'mic'} size={18} />
      {status === 'recording' ? t('voice.stop') : status === 'transcribing' ? t('voice.transcribing') : t('voice.dictate')}
    </button>
    {#if status === 'recording'}<span class="hint" aria-live="polite">{t('voice.recording')}</span>{/if}
    {#if status === 'transcribing'}<span class="hint" aria-live="polite">{progress || t('voice.transcribing')}</span>{/if}
    {#if status === 'ready' || transcript}
      <label class="transcript">
        <span>{t('voice.transcript')}</span>
        <textarea rows="2" value={transcript} oninput={(event) => updateTranscript(event.currentTarget.value)}></textarea>
      </label>
      <p class="preview" aria-live="polite">{preview(command)}</p>
      {#if pendingSupplement}
        <button type="button" class="apply" onclick={confirmSupplement}>{t('voice.confirmSupplement')}</button>
      {:else if command}
        <button type="button" class="apply" onclick={applyCommand}>{t('voice.apply')}</button>
      {/if}
    {/if}
    {#if message}<p class="message" role="status">{message}</p>{/if}
  </section>
{/if}

<style>
  .assistant { display: grid; gap: 0.55rem; margin: 0.75rem 0 1rem; padding: 0.8rem; border-radius: 18px; background: var(--surface); box-shadow: 0 0 0 1px var(--line) inset; }
  .topline { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .hint { color: var(--muted); font-size: var(--t-xs); }
  .mic, .apply { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; min-height: 46px; padding: 0 1rem; }
  .mic { justify-self: start; background: var(--surface-hi); color: var(--text); }
  .mic.recording { background: var(--accent); color: var(--accent-ink); }
  .transcript { display: grid; gap: 0.3rem; font-size: var(--t-sm); }
  textarea { width: 100%; padding: 0.65rem; resize: vertical; }
  .preview, .message { margin: 0; font-size: var(--t-sm); }
  .message { color: var(--muted); }
</style>
