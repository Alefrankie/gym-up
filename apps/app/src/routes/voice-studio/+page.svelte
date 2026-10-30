<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { CoachTone } from '@gym-up/contracts';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Select from '#lib/components/Select.svelte';
  import { session } from '#lib/session';
  import { t, type MessageKey } from '#lib/i18n';
  import { COACH_EVENTS, type CoachEvent } from '#lib/coach/lines';
  import { coachRecordings } from '#lib/coach/recordings.svelte';
  import { coachVoice } from '#lib/coach/voice.svelte';
  import { recordingId, studioLines, STUDIO_SLOT, type StudioLine } from '#lib/coach/studio';

  // Longest take; a line is a few seconds.
  const MAX_TAKE_MS = 15_000;
  const PAGE = 60;

  type Row = StudioLine & { id: string };
  let rows = $state<Row[]>([]);
  let tone = $state<CoachTone | 'all'>('gymrat');
  let event = $state<CoachEvent | 'all'>('all');
  let status = $state<'all' | 'pending' | 'recorded'>('pending');
  let query = $state('');
  let shown = $state(PAGE);
  let error = $state<string | null>(null);
  let tipsOpen = $state(true);

  // The take being recorded or reviewed (one at a time).
  let recordingRow = $state<string | null>(null);
  let take = $state<{ id: string; blob: Blob; url: string } | null>(null);
  let savingRow = $state<string | null>(null);
  let player: HTMLAudioElement | undefined;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  const recordedIds = $derived(new Set(coachRecordings.items.map((i) => i.id)));
  const total = $derived(rows.length);
  const done = $derived(rows.filter((r) => recordedIds.has(r.id)).length);
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (tone === 'all' || r.tone === tone) &&
        (event === 'all' || r.event === event) &&
        (status === 'all' || (status === 'recorded') === recordedIds.has(r.id)) &&
        (!q || r.text.toLowerCase().includes(q)),
    );
  });

  onMount(async () => {
    const user = await session.require();
    if (!user?.isAdmin) return;
    void coachRecordings.load(true);
    const lines = studioLines();
    rows = await Promise.all(lines.map(async (l) => ({ ...l, id: await recordingId(l.text, STUDIO_SLOT) })));
  });

  onDestroy(() => {
    stopRecording();
    releaseMic();
    if (take) URL.revokeObjectURL(take.url);
  });

  function releaseMic() {
    clearTimeout(stopTimer);
    stream?.getTracks().forEach((tr) => tr.stop());
    stream = null;
    recorder = null;
    coachVoice.micBusy = false;
  }

  function pickMime(): string | undefined {
    if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
    return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  }

  async function startRecording(row: Row) {
    error = null;
    if (take) {
      URL.revokeObjectURL(take.url);
      take = null;
    }
    try {
      coachVoice.stop();
      coachVoice.micBusy = true;
      // Shouted gymrat lines must stay loud: no automatic gain levelling them down.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
      const mime = pickMime();
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24_000 });
      recorder = rec;
      rec.addEventListener('dataavailable', (e) => {
        if (e.data.size) chunks.push(e.data);
      });
      rec.addEventListener('stop', () => {
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        take = { id: row.id, blob, url: URL.createObjectURL(blob) };
        recordingRow = null;
        releaseMic();
      });
      rec.start();
      recordingRow = row.id;
      stopTimer = setTimeout(stopRecording, MAX_TAKE_MS);
    } catch (e) {
      releaseMic();
      recordingRow = null;
      error = e instanceof DOMException && e.name === 'NotAllowedError' ? t('voice.permission') : t('studio.micError');
    }
  }

  function stopRecording() {
    clearTimeout(stopTimer);
    if (recorder?.state === 'recording') recorder.stop();
  }

  function play(url: string) {
    player?.pause();
    player = new Audio(url);
    void player.play();
  }

  async function playSaved(row: Row) {
    const r = coachRecordings.byId(row.id);
    if (!r) return;
    try {
      const blob = await coachRecordings.audio(r);
      const url = URL.createObjectURL(blob);
      play(url);
      player?.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function save(row: Row) {
    if (!take || take.id !== row.id) return;
    savingRow = row.id;
    error = null;
    try {
      await coachRecordings.save(row, take.blob);
      URL.revokeObjectURL(take.url);
      take = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      savingRow = null;
    }
  }

  async function remove(row: Row) {
    if (!confirm(t('studio.deleteConfirm'))) return;
    error = null;
    try {
      await coachRecordings.remove(row.id);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const toneOptions = (['all', 'gymrat', 'flower', 'normal', 'hard'] as const).map((v) => ({ value: v, label: t(`studio.tone.${v}`) }));
  const eventOptions = [{ value: 'all' as const, label: t('studio.tone.all') }, ...COACH_EVENTS.map((e) => ({ value: e, label: t(`studio.event.${e}` as MessageKey) }))];
  const statusOptions = (['pending', 'recorded', 'all'] as const).map((v) => ({ value: v, label: t(`studio.status.${v}`) }));
</script>

<main>
  <h1>{t('studio.title')}</h1>

  {#if session.user && !session.user.isAdmin}
    <p class="muted">{t('studio.adminOnly')}</p>
  {:else}
    <p class="muted lead">{t('studio.lead')}</p>

    <section class="card progress-card">
      <strong>{t('studio.progress', { done, total })}</strong>
      <progress max={total || 1} value={done}></progress>
    </section>

    <section class="card">
      <button type="button" class="ghost tips-toggle" aria-expanded={tipsOpen} onclick={() => (tipsOpen = !tipsOpen)}>
        <Icon name="mic" size={16} /> {t('studio.tipsTitle')} <Icon name={tipsOpen ? 'up' : 'down'} size={16} />
      </button>
      {#if tipsOpen}
        <ul class="tips">
          <li>{t('studio.tip1')}</li>
          <li>{t('studio.tip2')}</li>
          <li>{t('studio.tip3')}</li>
          <li>{t('studio.tip4')}</li>
        </ul>
      {/if}
    </section>

    <section class="filters">
      <Select bind:value={tone} options={toneOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={event} options={eventOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={status} options={statusOptions} onchange={() => (shown = PAGE)} />
      <input type="search" placeholder={t('studio.search')} bind:value={query} oninput={() => (shown = PAGE)} />
    </section>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    {#if !filtered.length && rows.length}
      <p class="muted">{t('studio.empty')}</p>
    {/if}

    <ul class="lines">
      {#each filtered.slice(0, shown) as row (row.id)}
        {@const saved = recordedIds.has(row.id)}
        {@const mine = take?.id === row.id ? take : null}
        <li class="line" class:saved>
          <p class="text">{row.text}</p>
          <p class="meta">
            <span aria-hidden="true">{saved ? '✅' : '⏺'}</span>
            {t(`studio.tone.${row.tone}`)} · {t(`studio.event.${row.event}` as MessageKey)}{row.form ? ` · ${t(`studio.form.${row.form}`)}` : ''}{row.locale === 'en' ? ' · EN' : ''}
          </p>
          <div class="actions">
            {#if recordingRow === row.id}
              <button type="button" class="primary rec" onclick={stopRecording}><Icon name="stop" size={16} /> {t('studio.stop')}</button>
            {:else}
              <button type="button" disabled={recordingRow !== null || savingRow !== null} onclick={() => startRecording(row)}>
                <Icon name="mic" size={16} /> {saved || mine ? t('studio.rerecord') : t('studio.record')}
              </button>
            {/if}
            {#if mine}
              <button type="button" onclick={() => play(mine.url)}>{t('studio.playTake')}</button>
              <button type="button" class="primary" disabled={savingRow === row.id} onclick={() => save(row)}>
                {savingRow === row.id ? t('studio.saving') : t('studio.save')}
              </button>
            {:else if saved}
              <button type="button" onclick={() => playSaved(row)}>{t('studio.play')}</button>
              <button type="button" class="danger" onclick={() => remove(row)}>{t('studio.delete')}</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if filtered.length > shown}
      <button type="button" class="more" onclick={() => (shown += PAGE)}>{t('studio.more', { n: filtered.length - shown })}</button>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .lead {
    margin: 0 0 1rem;
  }
  .progress-card {
    display: grid;
    gap: 0.5rem;
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
  .tips-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
    font-weight: 600;
  }
  .tips {
    margin: 0.6rem 0 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.35rem;
    font-size: var(--t-sm);
  }
  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  .line {
    padding: 0.8rem 0.9rem;
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .line.saved {
    box-shadow: 0 0 0 1px var(--ok) inset, var(--shadow-card);
  }
  .text {
    margin: 0 0 0.3rem;
    font-weight: 600;
    line-height: 1.35;
  }
  .meta {
    margin: 0 0 0.6rem;
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .actions button {
    width: auto;
    min-height: 38px;
    margin: 0;
    padding: 0 0.85rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--t-sm);
  }
  .rec {
    animation: pulse 1s ease-in-out infinite;
  }
  .danger {
    color: var(--danger, #e5484d);
  }
  .more {
    margin-top: 1rem;
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
</style>
