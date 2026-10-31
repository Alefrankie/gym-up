<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    coachTextProblems,
    type CoachTone,
    type StudioCommentDto,
    type StudioCustomLineDto,
    type StudioHistoryEntryDto,
    type StudioMemberDto,
    type StudioOverrideDto,
    type StudioTakeDto,
    type StudioUserDto,
  } from '@gym-up/contracts';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Select from '#lib/components/Select.svelte';
  import { session } from '#lib/session';
  import { dateLocale, t, type MessageKey } from '#lib/i18n';
  import { COACH_EVENTS, type CoachEvent } from '#lib/coach/lines';
  import { coachVoice } from '#lib/coach/voice.svelte';
  import { recordingId, studioLines, studioRows, STUDIO_SLOT, type StudioLine, type StudioRow } from '#lib/coach/studio';
  import { studioApi } from '#lib/coach/studio-api';

  // Longest take; a line is a few seconds.
  const MAX_TAKE_MS = 15_000;
  const PAGE = 40;

  type Row = StudioRow;
  type Lang = 'es' | 'en';
  const LANG_KEY = 'gymup.studio.lang';
  const readLang = (): Lang => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es';
    } catch {
      return 'es';
    }
  };
  type Status = 'all' | 'none' | 'withTakes' | 'active' | 'noActive' | 'notMine';

  let allowed = $state<boolean | null>(null);
  let admin = $state(false);
  let me = $state('');
  let builtIn = $state<(StudioLine & { id: string })[]>([]);
  let custom = $state<StudioCustomLineDto[]>([]);
  let overrides = $state<StudioOverrideDto[]>([]);
  const rows = $derived(studioRows(builtIn, custom, overrides));
  // Spanish and English are separate workspaces (progress and filters count one language at a time).
  let lang = $state<Lang>(readLang());
  let gender = $state<'all' | 'm' | 'f' | 'same'>('all');
  let person = $state<string>('all');
  let editing = $state<string | null>(null);
  let editDraft = $state('');
  let histories = $state<Record<string, StudioHistoryEntryDto[]>>({});
  let addOpen = $state(false);
  let newLine = $state<{ tone: CoachTone; event: CoachEvent; textM: string; textF: string }>({ tone: 'gymrat', event: 'home', textM: '', textF: '' });
  let addMessage = $state<string | null>(null);
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
  const isStale = (tk: StudioTakeDto, row: Row) => tk.text.trim() !== row.text.trim();
  const langRows = $derived(rows.filter((r) => r.locale === lang));
  const total = $derived(langRows.length);
  const withActive = $derived(langRows.filter((r) => lineTakes(r.id).some((tk) => tk.active && !isStale(tk, r))).length);
  const withTakes = $derived(langRows.filter((r) => lineTakes(r.id).length > 0).length);
  // Everyone who has a take, for the person filter.
  const people = $derived.by(() => {
    const m = new Map<string, string>();
    for (const tk of takes) m.set(tk.authorId, tk.authorName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  });
  const personName = $derived(people.find(([id]) => id === person)?.[1] ?? '');
  const personDone = $derived(person === 'all' ? 0 : langRows.filter((r) => lineTakes(r.id).some((tk) => tk.authorId === person)).length);
  const perPerson = $derived.by(() => {
    const m = new Map<string, number>();
    for (const tk of takes) m.set(tk.authorName, (m.get(tk.authorName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return langRows.filter((r) => {
      const ts = lineTakes(r.id);
      const active = ts.some((tk) => tk.active && !isStale(tk, r));
      const ok =
        status === 'all' ||
        (status === 'none' && !ts.length) ||
        (status === 'withTakes' && ts.length > 0) ||
        (status === 'active' && active) ||
        (status === 'noActive' && !active) ||
        (status === 'notMine' && !ts.some((tk) => tk.authorId === me));
      const genderOk = gender === 'all' || (gender === 'same' ? r.form === null : r.form === gender);
      const personOk = person === 'all' || ts.some((tk) => tk.authorId === person);
      return (
        ok && genderOk && personOk && (tone === 'all' || r.tone === tone) && (event === 'all' || r.event === event) && (!q || r.text.toLowerCase().includes(q))
      );
    });
  });

  async function refresh() {
    const o = await studioApi.overview();
    takes = o.takes;
    comments = o.comments;
    custom = o.custom;
    overrides = o.overrides;
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
      builtIn = await Promise.all(lines.map(async (l) => ({ ...l, id: await recordingId(l.text, STUDIO_SLOT) })));
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
      await studioApi.saveTake(row.id, row, take.blob);
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

  function setLang(next: Lang) {
    lang = next;
    shown = PAGE;
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* private mode: back to Spanish next time */
    }
  }

  // ---- lines: add, edit, history (admin edits; members add, the admin approves) ----
  const problemText = (text: string, tone: CoachTone) => {
    const p = coachTextProblems(text, tone);
    if (!p.length) return null;
    const words = p.filter((x) => 'word' in x).map((x) => (x as { word: string }).word);
    return t('studio.lineRules', { details: words.length ? words.join(', ') : p.map((x) => x.kind).join(', ') });
  };

  const addLine = () =>
    act('add', async () => {
      addMessage = null;
      const textM = newLine.textM.trim();
      const textF = newLine.textF.trim();
      const problem = problemText(textM, newLine.tone) ?? (textF ? problemText(textF, newLine.tone) : null);
      if (problem) throw new Error(problem);
      if (newLine.tone === 'gymrat' && lang !== 'es') throw new Error(t('studio.gymratSpanish'));
      await studioApi.addLine({ tone: newLine.tone, locale: lang, event: newLine.event, textM, textF: textF || null });
      newLine = { ...newLine, textM: '', textF: '' };
      addMessage = admin ? t('studio.lineAdded') : t('studio.lineProposed');
    });

  function startEdit(row: Row) {
    editing = row.id;
    editDraft = row.text;
  }

  const saveEdit = (row: Row) =>
    act(`edit:${row.id}`, async () => {
      const problem = problemText(editDraft, row.tone);
      if (problem) throw new Error(problem);
      await studioApi.editText(row.id, row.custom ? { text: editDraft } : { text: editDraft, originalText: row.originalText, tone: row.tone, locale: row.locale, event: row.event, form: row.form });
      editing = null;
      histories = { ...histories, [row.id]: await studioApi.history(row.id) };
    });

  const revertText = (row: Row) =>
    act(`revert:${row.id}`, async () => {
      await studioApi.revertText(row.id);
      histories = { ...histories, [row.id]: await studioApi.history(row.id) };
    });

  const toggleHistory = (row: Row) =>
    act(
      `hist:${row.id}`,
      async () => {
        if (histories[row.id]) {
          const { [row.id]: _gone, ...rest } = histories;
          histories = rest;
        } else histories = { ...histories, [row.id]: await studioApi.history(row.id) };
      },
      false,
    );

  const approveLine = (row: Row) => row.custom && act(`approve:${row.id}`, () => studioApi.approveLine(row.custom!.groupId));
  const deleteLine = (row: Row) => {
    if (!row.custom || !confirm(t('studio.deleteLineConfirm'))) return;
    void act(`delline:${row.id}`, () => studioApi.deleteLine(row.custom!.groupId));
  };
  const confirmTake = (tk: StudioTakeDto) => act(`confirm:${tk.id}`, () => studioApi.confirmTake(tk.id));

  const day = (ms: number) => new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

  const toneOptions = (['all', 'gymrat', 'flower', 'normal'] as const).map((v) => ({ value: v, label: t(`studio.tone.${v}`) }));
  const eventOptions = [{ value: 'all' as const, label: t('studio.tone.all') }, ...COACH_EVENTS.map((e) => ({ value: e, label: t(`studio.event.${e}` as MessageKey) }))];
  const statusOptions = (['all', 'none', 'withTakes', 'active', 'noActive', 'notMine'] as const).map((v) => ({ value: v, label: t(`studio.status.${v}`) }));
  const genderOptions = (['all', 'm', 'f', 'same'] as const).map((v) => ({ value: v, label: t(`studio.gender.${v}`) }));
  const personOptions = $derived([{ value: 'all', label: t('studio.person.all') }, ...people.map(([id, name]) => ({ value: id, label: name }))]);
  const newToneOptions = (['gymrat', 'flower', 'normal'] as const).map((v) => ({ value: v, label: t(`studio.tone.${v}`) }));
  const newEventOptions = COACH_EVENTS.map((e) => ({ value: e, label: t(`studio.event.${e}` as MessageKey) }));
</script>

<main>
  <h1>{t('studio.title')}</h1>

  {#if allowed === false}
    <p class="muted">{t('studio.noAccess')}</p>
  {:else if allowed}
    <p class="muted lead">{t('studio.lead')}</p>

    <div class="lang" role="radiogroup" aria-label={t('studio.language')}>
      {#each [['es', t('language.es')], ['en', t('language.en')]] as [value, text] (value)}
        <button type="button" role="radio" aria-checked={lang === value} class:on={lang === value} onclick={() => setLang(value as Lang)}>{text}</button>
      {/each}
    </div>

    <section class="card progress-card">
      <strong>{t('studio.progressActive', { done: withActive, total })}</strong>
      <progress max={total || 1} value={withActive}></progress>
      <span class="muted small">{t('studio.progressTakes', { n: withTakes, takes: takes.filter((tk) => tk.locale === lang).length })}</span>
      {#if person !== 'all'}
        <span class="person-progress">{t('studio.personProgress', { name: personName, done: personDone, total, language: lang === 'es' ? t('language.es') : t('language.en') })}</span>
      {/if}
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

    <section class="card">
      <button type="button" class="ghost tips-toggle" aria-expanded={addOpen} onclick={() => (addOpen = !addOpen)}>
        <Icon name="plus" size={16} /> {t('studio.addLine')} <Icon name={addOpen ? 'up' : 'down'} size={16} />
      </button>
      {#if addOpen}
        <form class="add-line" onsubmit={(e) => { e.preventDefault(); void addLine(); }}>
          <p class="muted small">{admin ? t('studio.addLineHintAdmin') : t('studio.addLineHint')} {lang === 'es' ? t('language.es') : t('language.en')}.</p>
          <Select bind:value={newLine.tone} options={newToneOptions} />
          <Select bind:value={newLine.event} options={newEventOptions} />
          <label>{t('studio.textM')}<input maxlength="200" bind:value={newLine.textM} required /></label>
          <label>{t('studio.textF')}<input maxlength="200" bind:value={newLine.textF} placeholder={t('studio.textFHint')} /></label>
          {#if addMessage}<p class="ok" role="status">{addMessage}</p>{/if}
          <button type="submit" class="primary" disabled={busy !== null || !newLine.textM.trim()}>{t('studio.addLineSave')}</button>
        </form>
      {/if}
    </section>

    <section class="filters">
      <Select bind:value={tone} options={toneOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={event} options={eventOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={status} options={statusOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={gender} options={genderOptions} onchange={() => (shown = PAGE)} />
      <Select bind:value={person} options={personOptions} onchange={() => (shown = PAGE)} />
      <input type="search" placeholder={t('studio.search')} bind:value={query} oninput={() => (shown = PAGE)} />
    </section>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if !filtered.length && rows.length}<p class="muted">{t('studio.empty')}</p>{/if}

    <ul class="lines">
      {#each filtered.slice(0, shown) as row (row.id)}
        {@const ts = lineTakes(row.id)}
        {@const cs = commentsByLine.get(row.id) ?? []}
        {@const active = ts.find((tk) => tk.active && !isStale(tk, row))}
        {@const mineSaved = ts.find((tk) => tk.authorId === me)}
        {@const mine = take?.id === row.id ? take : null}
        <li class="line" class:has-active={!!active}>
          {#if editing === row.id}
            <form class="edit" onsubmit={(e) => { e.preventDefault(); void saveEdit(row); }}>
              <textarea rows="2" maxlength="200" bind:value={editDraft}></textarea>
              <div class="actions">
                <button type="submit" class="primary" disabled={busy !== null || !editDraft.trim()}>{t('studio.save')}</button>
                <button type="button" class="ghost" onclick={() => (editing = null)}>{t('studio.cancel')}</button>
              </div>
            </form>
          {:else}
            <p class="text">{row.text}</p>
          {/if}
          {#if row.edited}<p class="muted small">{t('studio.originalWas', { text: row.originalText })}</p>{/if}
          <p class="badges">
            {#if row.edited}<span class="badge soft">{t('studio.edited')}</span>{/if}
            {#if row.custom}<span class="badge soft">{t('studio.addedBy', { name: row.custom.authorName })}</span>{/if}
            {#if row.custom?.status === 'pending'}<span class="badge warn">{t('studio.pending')}</span>{/if}
          </p>
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
            {#if admin && editing !== row.id}
              <button type="button" class="ghost" disabled={busy !== null} onclick={() => startEdit(row)}>{t('studio.editText')}</button>
            {/if}
            {#if admin && (row.edited || row.custom)}
              <button type="button" class="ghost" disabled={busy !== null} onclick={() => revertText(row)}>{t('studio.revert')}</button>
            {/if}
            {#if admin && row.custom?.status === 'pending'}
              <button type="button" class="primary" disabled={busy !== null} onclick={() => approveLine(row)}>{t('studio.approve')}</button>
            {/if}
            {#if row.custom && (admin || (row.custom.authorId === me && row.custom.status === 'pending'))}
              <button type="button" class="danger" disabled={busy !== null} onclick={() => deleteLine(row)}>{t('studio.deleteLine')}</button>
            {/if}
            <button type="button" class="ghost" disabled={busy !== null} onclick={() => toggleHistory(row)}>{t('studio.history')}</button>
            {#if ts.length || cs.length}
              <button type="button" class="ghost" aria-expanded={!!open[row.id]} onclick={() => (open = { ...open, [row.id]: !open[row.id] })}>
                {t('studio.showTakes', { takes: ts.length, comments: cs.length })} <Icon name={open[row.id] ? 'up' : 'down'} size={14} />
              </button>
            {/if}
          </div>

          {#if histories[row.id]}
            <ul class="history">
              {#each histories[row.id] as h (h.id)}
                <li>
                  <span class="muted small">{day(h.createdAt)} · {h.authorName} · {t(`studio.historyKind.${h.kind}`)}</span>
                  {#if h.previousText}<del>{h.previousText}</del>{/if}
                  {#if h.newText}<span>{h.newText}</span>{/if}
                </li>
              {:else}
                <li class="muted small">{t('studio.historyEmpty')}</li>
              {/each}
            </ul>
          {/if}
          {#if open[row.id] || person !== 'all'}
            <ul class="takes">
              {#each ts as tk (tk.id)}
                {@const stale = isStale(tk, row)}
                <li class="take" class:active={tk.active && !stale} class:picked={person === tk.authorId}>
                  <span class="who"><strong>{tk.authorName}</strong> <span class="muted small">{day(tk.updatedAt)}</span></span>
                  {#if stale}<span class="badge warn">{t('studio.staleText')}</span><span class="muted small">«{tk.text}»</span>
                  {:else if tk.active}<span class="badge">{t('studio.active')}</span>{/if}
                  <div class="take-actions">
                    <button type="button" disabled={busy !== null} onclick={() => playTake(tk)}>▶ {t('studio.play')}</button>
                    <button type="button" class:on={tk.votedByMe} disabled={busy !== null} onclick={() => toggleVote(tk)} aria-pressed={tk.votedByMe}>♥ {tk.votes}</button>
                    {#if admin && stale}
                      <button type="button" disabled={busy !== null} onclick={() => confirmTake(tk)}>{t('studio.confirmTake')}</button>
                    {:else if admin && !tk.active}
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
  .lang {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.25rem;
    padding: 0.25rem;
    margin: 0 0 1rem;
    border-radius: var(--radius);
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .lang button {
    min-height: 40px;
    margin: 0;
    background: none;
    box-shadow: none;
    color: var(--muted);
  }
  .lang button.on {
    background: var(--raised);
    color: var(--text);
  }
  .person-progress {
    font-weight: 600;
    font-size: var(--t-sm);
  }
  .add-line,
  .edit {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .edit textarea {
    width: 100%;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0 0 0.3rem;
  }
  .badge.soft {
    background: var(--bg);
    color: var(--muted);
  }
  .badge.warn {
    background: var(--ember, #f5a524);
    color: #2a1700;
  }
  .take.picked {
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .history {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
    font-size: var(--t-sm);
  }
  .history li {
    display: grid;
    gap: 0.1rem;
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
