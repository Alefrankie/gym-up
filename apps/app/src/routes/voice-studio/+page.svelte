<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { CoachTone, StudioCommentDto, StudioMemberDto, StudioTakeDto, StudioUserDto } from '@gym-up/contracts';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Select from '#lib/components/Select.svelte';
  import { session } from '#lib/session';
  import { dateLocale, t, type MessageKey } from '#lib/i18n';
  import { COACH_EVENTS, type CoachEvent } from '#lib/coach/lines';
  import { coachVoice } from '#lib/coach/voice.svelte';
  import { recordingId, studioLines, STUDIO_SLOT, type StudioLine } from '#lib/coach/studio';
  import { studioApi } from '#lib/coach/studio-api';

  // Longest take; a line is a few seconds.
  const MAX_TAKE_MS = 15_000;
  const PAGE = 40;

  type Row = StudioLine & { id: string };
  type Status = 'all' | 'none' | 'withTakes' | 'active' | 'noActive' | 'notMine';

  let allowed = $state<boolean | null>(null);
  let admin = $state(false);
  let me = $state('');
  let rows = $state<Row[]>([]);
  let takes = $state<StudioTakeDto[]>([]);
  let comments = $state<StudioCommentDto[]>([]);
  let tone = $state<CoachTone | 'all'>('gymrat');
  let event = $state<CoachEvent | 'all'>('all');
  let status = $state<Status>('all');
  let query = $state('');
  let shown = $state(PAGE);
  let open = $state<Record<string, boolean>>({});
  let drafts = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let tipsOpen = $state(true);

  // Collaborators (admin).
  let members = $state<StudioMemberDto[]>([]);
  let search = $state('');
  let found = $state<StudioUserDto[]>([]);

  // The take being recorded or reviewed (one at a time).
  let recordingRow = $state<string | null>(null);
  let take = $state<{ id: string; blob: Blob; url: string } | null>(null);
  let busy = $state<string | null>(null);
  let player: HTMLAudioElement | undefined;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  const takesByLine = $derived.by(() => {
    const m = new Map<string, StudioTakeDto[]>();
    for (const tk of takes) m.set(tk.lineId, [...(m.get(tk.lineId) ?? []), tk]);
    return m;
  });
  const commentsByLine = $derived.by(() => {
    const m = new Map<string, StudioCommentDto[]>();
    for (const c of comments) m.set(c.lineId, [...(m.get(c.lineId) ?? []), c]);
    return m;
  });
  const lineTakes = (id: string) => takesByLine.get(id) ?? [];
  const total = $derived(rows.length);
  const withActive = $derived(rows.filter((r) => lineTakes(r.id).some((tk) => tk.active)).length);
  const withTakes = $derived(rows.filter((r) => lineTakes(r.id).length > 0).length);
  const perPerson = $derived.by(() => {
    const m = new Map<string, number>();
    for (const tk of takes) m.set(tk.authorName, (m.get(tk.authorName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const ts = lineTakes(r.id);
      const ok =
        status === 'all' ||
        (status === 'none' && !ts.length) ||
        (status === 'withTakes' && ts.length > 0) ||
        (status === 'active' && ts.some((tk) => tk.active)) ||
        (status === 'noActive' && !ts.some((tk) => tk.active)) ||
        (status === 'notMine' && !ts.some((tk) => tk.authorId === me));
      return ok && (tone === 'all' || r.tone === tone) && (event === 'all' || r.event === event) && (!q || r.text.toLowerCase().includes(q));
    });
  });

  async function refresh() {
    const o = await studioApi.overview();
    takes = o.takes;
    comments = o.comments;
    me = o.me.userId;
    admin = o.me.admin;
  }

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const a = await studioApi.access();
      allowed = a.allowed;
      admin = a.admin;
      if (!a.allowed) return;
      const lines = studioLines();
      rows = await Promise.all(lines.map(async (l) => ({ ...l, id: await recordingId(l.text, STUDIO_SLOT) })));
      await refresh();
      if (admin) members = await studioApi.members();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      allowed ??= false;
    }
  });

  onDestroy(() => {
    stopRecording();
    releaseMic();
    if (take) URL.revokeObjectURL(take.url);
  });

  async function act(key: string, fn: () => Promise<unknown>, reload = true) {
    busy = key;
    error = null;
    try {
      await fn();
      if (reload) await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  // ---- collaborators (admin) ----
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      found = search.trim().length >= 2 ? await studioApi.searchUsers(search.trim()).catch(() => []) : [];
    }, 300);
  }
  const grant = (u: StudioUserDto) =>
    act(`grant:${u.userId}`, async () => {
      await studioApi.grant(u.userId);
      members = await studioApi.members();
      found = found.map((f) => (f.userId === u.userId ? { ...f, member: true } : f));
    }, false);
  const revoke = (m: StudioMemberDto) =>
    act(`revoke:${m.userId}`, async () => {
      await studioApi.revoke(m.userId);
      members = await studioApi.members();
      found = found.map((f) => (f.userId === m.userId ? { ...f, member: false } : f));
    }, false);

  // ---- recording ----
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

  function play(url: string, revoke = false) {
    player?.pause();
    player = new Audio(url);
    if (revoke) player.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    void player.play();
  }

  const playTake = (tk: StudioTakeDto) =>
    act(`play:${tk.id}`, async () => play(URL.createObjectURL(await studioApi.takeAudio(tk)), true), false);

  const save = (row: Row) =>
    act(`save:${row.id}`, async () => {
      if (!take || take.id !== row.id) return;
      await studioApi.saveTake(row, take.blob);
      URL.revokeObjectURL(take.url);
      take = null;
      open = { ...open, [row.id]: true };
    });

  const removeTake = (tk: StudioTakeDto) => {
    if (!confirm(t(tk.active ? 'studio.deleteActiveConfirm' : 'studio.deleteConfirm'))) return;
    void act(`del:${tk.id}`, () => studioApi.deleteTake(tk.id));
  };
  const choose = (row: Row, tk: StudioTakeDto) => act(`use:${tk.id}`, () => studioApi.choose(row.id, tk.id));
  const toggleVote = (tk: StudioTakeDto) => act(`vote:${tk.id}`, () => (tk.votedByMe ? studioApi.unvote(tk.id) : studioApi.vote(tk.id)));
  const sendComment = (row: Row) =>
    act(`comment:${row.id}`, async () => {
      const text = (drafts[row.id] ?? '').trim();
      if (!text) return;
      await studioApi.comment(row.id, text);
      drafts = { ...drafts, [row.id]: '' };
    });
  const removeComment = (c: StudioCommentDto) => act(`delc:${c.id}`, () => studioApi.deleteComment(c.id));

  const day = (ms: number) => new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

  const toneOptions = (['all', 'gymrat', 'flower', 'normal'] as const).map((v) => ({ value: v, label: t(`studio.tone.${v}`) }));
  const eventOptions = [{ value: 'all' as const, label: t('studio.tone.all') }, ...COACH_EVENTS.map((e) => ({ value: e, label: t(`studio.event.${e}` as MessageKey) }))];
  const statusOptions = (['all', 'none', 'withTakes', 'active', 'noActive', 'notMine'] as const).map((v) => ({ value: v, label: t(`studio.status.${v}`) }));
</script>

<main>
  <h1>{t('studio.title')}</h1>

  {#if allowed === false}
    <p class="muted">{t('studio.noAccess')}</p>
  {:else if allowed}
    <p class="muted lead">{t('studio.lead')}</p>

    <section class="card progress-card">
      <strong>{t('studio.progressActive', { done: withActive, total })}</strong>
      <progress max={total || 1} value={withActive}></progress>
      <span class="muted small">{t('studio.progressTakes', { n: withTakes, takes: takes.length })}</span>
      {#if perPerson.length}
        <ul class="people">
          {#each perPerson as [name, n] (name)}<li><span>{name}</span><strong>{n}</strong></li>{/each}
        </ul>
      {/if}
    </section>

    {#if admin}
      <section class="card">
        <h2 class="first">{t('studio.members')}</h2>
        <p class="muted small">{t('studio.membersHint')}</p>
        <input type="search" placeholder={t('studio.membersSearch')} bind:value={search} oninput={onSearch} />
        {#if found.length}
          <ul class="people-list">
            {#each found as u (u.userId)}
              <li>
                <span><strong>{u.displayName}</strong> <span class="muted small">{u.email}</span></span>
                {#if u.member}<span class="muted small">{t('studio.memberYes')}</span>
                {:else}<button type="button" disabled={busy !== null} onclick={() => grant(u)}>{t('studio.grant')}</button>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if members.length}
          <h3>{t('studio.membersCurrent')}</h3>
          <ul class="people-list">
            {#each members as m (m.userId)}
              <li>
                <span><strong>{m.displayName}</strong> <span class="muted small">{m.email}</span></span>
                <button type="button" class="danger" disabled={busy !== null} onclick={() => revoke(m)}>{t('studio.revoke')}</button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted small">{t('studio.membersNone')}</p>
        {/if}
      </section>
    {/if}

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
    {#if !filtered.length && rows.length}<p class="muted">{t('studio.empty')}</p>{/if}

    <ul class="lines">
      {#each filtered.slice(0, shown) as row (row.id)}
        {@const ts = lineTakes(row.id)}
        {@const cs = commentsByLine.get(row.id) ?? []}
        {@const active = ts.find((tk) => tk.active)}
        {@const mineSaved = ts.find((tk) => tk.authorId === me)}
        {@const mine = take?.id === row.id ? take : null}
        <li class="line" class:has-active={!!active}>
          <p class="text">{row.text}</p>
          <p class="meta">
            <span aria-hidden="true">{active ? '✅' : ts.length ? '🎙️' : '⏺'}</span>
            {t(`studio.tone.${row.tone}`)} · {t(`studio.event.${row.event}` as MessageKey)}{row.form ? ` · ${t(`studio.form.${row.form}`)}` : ''}{row.locale === 'en' ? ' · EN' : ''}
            · {t('studio.counts', { takes: ts.length, votes: ts.reduce((n, tk) => n + tk.votes, 0) })}
          </p>
          <div class="actions">
            {#if recordingRow === row.id}
              <button type="button" class="primary rec" onclick={stopRecording}><Icon name="stop" size={16} /> {t('studio.stop')}</button>
            {:else}
              <button type="button" disabled={recordingRow !== null || busy !== null} onclick={() => startRecording(row)}>
                <Icon name="mic" size={16} /> {mineSaved || mine ? t('studio.rerecord') : t('studio.record')}
              </button>
            {/if}
            {#if mine}
              <button type="button" onclick={() => play(mine.url)}>{t('studio.playTake')}</button>
              <button type="button" class="primary" disabled={busy !== null} onclick={() => save(row)}>
                {busy === `save:${row.id}` ? t('studio.saving') : t('studio.save')}
              </button>
            {/if}
            {#if ts.length || cs.length}
              <button type="button" class="ghost" aria-expanded={!!open[row.id]} onclick={() => (open = { ...open, [row.id]: !open[row.id] })}>
                {t('studio.showTakes', { takes: ts.length, comments: cs.length })} <Icon name={open[row.id] ? 'up' : 'down'} size={14} />
              </button>
            {/if}
          </div>

          {#if open[row.id]}
            <ul class="takes">
              {#each ts as tk (tk.id)}
                <li class="take" class:active={tk.active}>
                  <span class="who"><strong>{tk.authorName}</strong> <span class="muted small">{day(tk.updatedAt)}</span></span>
                  {#if tk.active}<span class="badge">{t('studio.active')}</span>{/if}
                  <div class="take-actions">
                    <button type="button" disabled={busy !== null} onclick={() => playTake(tk)}>▶ {t('studio.play')}</button>
                    <button type="button" class:on={tk.votedByMe} disabled={busy !== null} onclick={() => toggleVote(tk)} aria-pressed={tk.votedByMe}>♥ {tk.votes}</button>
                    {#if admin && !tk.active}
                      <button type="button" class="primary" disabled={busy !== null} onclick={() => choose(row, tk)}>{t('studio.use')}</button>
                    {/if}
                    {#if admin || tk.authorId === me}
                      <button type="button" class="danger" disabled={busy !== null} onclick={() => removeTake(tk)}>{t('studio.delete')}</button>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
            <div class="comments">
              {#each cs as c (c.id)}
                <p class="comment">
                  <strong>{c.authorName}:</strong> {c.text}
                  {#if admin || c.authorId === me}
                    <button type="button" class="link danger" onclick={() => removeComment(c)} aria-label={t('studio.delete')}>✕</button>
                  {/if}
                </p>
              {/each}
              <form class="comment-form" onsubmit={(e) => { e.preventDefault(); void sendComment(row); }}>
                <input maxlength="280" placeholder={t('studio.commentPlaceholder')} bind:value={drafts[row.id]} />
                <button type="submit" disabled={busy !== null || !(drafts[row.id] ?? '').trim()}>{t('studio.send')}</button>
              </form>
            </div>
          {/if}
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
  .first {
    margin: 0 0 0.5rem;
  }
  h3 {
    margin: 1rem 0 0.4rem;
    font-size: var(--t-sm);
  }
  .small {
    font-size: var(--t-xs);
  }
  .progress-card {
    display: grid;
    gap: 0.5rem;
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
  .people {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .people li {
    display: inline-flex;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--bg);
    font-size: var(--t-xs);
  }
  .people-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .people-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .people-list button,
  .take-actions button,
  .actions button,
  .comment-form button {
    width: auto;
    min-height: 36px;
    margin: 0;
    padding: 0 0.8rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--t-sm);
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
  .lines,
  .takes {
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
  .line.has-active {
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
  .actions,
  .take-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .takes {
    margin-top: 0.7rem;
    gap: 0.5rem;
  }
  .take {
    display: grid;
    gap: 0.35rem;
    padding: 0.5rem 0.6rem;
    border-radius: 12px;
    background: var(--bg);
  }
  .take.active {
    box-shadow: 0 0 0 1px var(--ok) inset;
  }
  .badge {
    justify-self: start;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--ok);
    color: #fff;
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .take-actions .on {
    color: var(--accent);
  }
  .comments {
    margin-top: 0.6rem;
    display: grid;
    gap: 0.35rem;
  }
  .comment {
    margin: 0;
    font-size: var(--t-sm);
  }
  .comment .link {
    width: auto;
    min-height: 0;
    padding: 0 0.3rem;
    background: none;
    box-shadow: none;
  }
  .comment-form {
    display: flex;
    gap: 0.4rem;
  }
  .comment-form input {
    flex: 1;
    min-width: 0;
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
