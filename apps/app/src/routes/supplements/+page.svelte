<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { onMount } from 'svelte';
  import type { SupplementListResponse } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { longDate, relativeDay } from '#lib/dates';
  import { CREATINE_REMINDER_KEY, creatineReminderError, loadSupplements, localDay, persistMark, withMark } from '#lib/supplements';
  import { cancelCreatineReminder, scheduleCreatineReminder } from '#lib/notify';
  import DayStrip from '#lib/components/DayStrip.svelte';
  import SupplementCalendar from '#lib/components/SupplementCalendar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  const today = localDay();
  let list = $state<SupplementListResponse | null>(null);
  let name = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let creatineReminderEnabled = $state(false);
  let reminderBusy = $state(false);

  const creatine = (response: SupplementListResponse | null) =>
    response?.items.find((item) => /creatina|creatine/i.test(item.name)) ?? null;

  async function load() {
    try {
      list = (await loadSupplements(today, (r) => {
        list = r;
      })).data;
      creatineReminderEnabled = localStorage.getItem(CREATINE_REMINDER_KEY) === 'on';
    } catch (e) {
      error = e instanceof NetworkError ? t('supplements.offlineEmpty') : t('supplements.loadError');
    }
  }

  onMount(async () => {
    creatineReminderEnabled = localStorage.getItem(CREATINE_REMINDER_KEY) === 'on';
    if (await session.require()) await load();
  });

  async function toggleCreatineReminder() {
    if (reminderBusy) return;
    reminderBusy = true;
    try {
    error = null;
    if (creatineReminderEnabled) {
      if (!(await cancelCreatineReminder())) {
        error = t('supplements.reminderError');
        return;
      }
      localStorage.removeItem(CREATINE_REMINDER_KEY);
      creatineReminderEnabled = false;
      creatineReminderError.set(false);
      return;
    }
    const item = creatine(list);
    if (!item) return;
    if (!(await scheduleCreatineReminder(item.days.includes(localDay())))) {
      error = t('supplements.reminderError');
      return;
    }
    localStorage.setItem(CREATINE_REMINDER_KEY, 'on');
    creatineReminderError.set(false);
    creatineReminderEnabled = true;
    } finally {
      reminderBusy = false;
    }
  }

  /** Day by day, newest first: what was taken. Only days with something taken are listed. */
  const history = $derived.by(() => {
    if (!list) return [];
    const byDay = new Map<string, string[]>();
    for (const s of list.items) for (const d of s.days) byDay.set(d, [...(byDay.get(d) ?? []), s.name]);
    return [...byDay].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, names]) => ({ day, names }));
  });

  async function toggle(id: string, taken: boolean, day = today) {
    if (!list) return;
    // A plain copy: IndexedDB cannot store Svelte's reactive proxies.
    const next = withMark($state.snapshot(list), id, taken, day);
    list = next;
    void persistMark(next, id, taken, day);
  }

  /** A day picked on the calendar, to fill in what was taken on days already gone. */
  let picked = $state<string | null>(null);

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    busy = true;
    error = null;
    try {
      await api('/supplements', { body: { id: crypto.randomUUID(), name: name.trim() } });
      name = '';
      await invalidateCache(['/supplements']);
      await load();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : t('supplements.addNeedsConnection');
    }
    busy = false;
  }

  async function remove(id: string, label: string) {
    if (!confirm(t('supplements.confirmRemove', { name: label }))) return;
    try {
      await api(`/supplements/${id}`, { method: 'DELETE' });
      await invalidateCache(['/supplements']);
      await load();
      if (!creatine(list) && creatineReminderEnabled) await toggleCreatineReminder();
    } catch {
      error = t('supplements.removeNeedsConnection');
    }
  }
</script>

<main>
  <p><a class="back" href="/dashboard"><Icon name="left" size={18} /> {t('nav.home')}</a></p>
  <h1>{t('supplements.title')}</h1>
  <p class="muted lead">{t('supplements.lead', { date: longDate() })}</p>
  {#if creatine(list)}
    <button type="button" class="reminder" role="switch" aria-checked={creatineReminderEnabled} aria-labelledby="reminder-label" aria-describedby="reminder-detail" aria-busy={reminderBusy} disabled={reminderBusy} onclick={toggleCreatineReminder}>
      <span class="reminder-copy">
        <strong id="reminder-label">{t('supplements.reminderChannel')}</strong>
        <span id="reminder-detail">{t('supplements.reminderSchedule')}</span>
        <span class="reminder-status" class:warn={$creatineReminderError && !reminderBusy} aria-live="polite">{reminderBusy ? t('common.loading') : $creatineReminderError ? t('supplements.reminderNeedsAttention') : ''}</span>
      </span>
      <span class="reminder-track" class:on={creatineReminderEnabled} aria-hidden="true"><span class="reminder-thumb"></span></span>
    </button>
  {/if}
  {#if error || $creatineReminderError}<p class="error" role="alert">{error ?? t('supplements.reminderError')}</p>{/if}

  {#if list}
    <ul class="items">
      {#each list.items as s (s.id)}
        <li>
          <div class="row">
            <button type="button" class="tick" class:on={s.taken} aria-pressed={s.taken} aria-label={`${s.name}: ${s.taken ? t('supplements.takenToday') : t('supplements.markTaken')}`} onclick={() => toggle(s.id, !s.taken)}>
              {#if s.taken}<Icon name="check" size={18} />{/if}
            </button>
            <span class="grow">
              <strong>{s.name}</strong>
              <span class="muted">
                {tn('supplements.daysThisMonth', s.days.filter((d) => d.startsWith(list!.day.slice(0, 7))).length)}{#if s.streak > 1} · <span class="streak">{t('supplements.streak', { n: s.streak })}</span>{/if}
              </span>
            </span>
            <button type="button" class="ghost del" aria-label={t('supplements.removeLabel', { name: s.name })} onclick={() => remove(s.id, s.name)}><Icon name="trash" size={18} /></button>
          </div>
          <DayStrip days={s.days} end={list.day} label={s.name} />
        </li>
      {/each}
    </ul>

    <h2>{t('supplements.calendar')}</h2>
    <p class="muted hint">{t('supplements.calendarHint')}</p>
    <SupplementCalendar items={list.items} today={list.day} selected={picked} onpick={(d) => (picked = picked === d ? null : d)} />
    {#if picked}
      {@const day = picked}
      <section class="pick" aria-label={relativeDay(day, list.day)}>
        <strong class="when">{relativeDay(day, list.day)}</strong>
        {#each list.items as s (s.id)}
          {@const on = s.days.includes(day)}
          <button type="button" class="pick-row" aria-pressed={on} onclick={() => toggle(s.id, !on, day)}>
            <span class="tick small" class:on>{#if on}<Icon name="check" size={14} />{/if}</span>
            {s.name}
          </button>
        {/each}
      </section>
    {/if}

    {#if history.length}
      <h2>{t('supplements.dayByDay')}</h2>
      <ul class="log">
        {#each history as h (h.day)}
          <li>
            <span class="when">{relativeDay(h.day, list.day)}</span>
            <span class="what">
              {#each h.names as n (n)}<span class="chip on">{n}</span>{/each}
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <form class="add" onsubmit={add}>
      <input maxlength="40" placeholder={t('supplements.addPlaceholder')} aria-label={t('supplements.newLabel')} bind:value={name} />
      <button type="submit" disabled={busy || !name.trim()}><Icon name="plus" size={18} /> {t('common.add')}</button>
    </form>
  {:else if !error}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</main>

<style>
  .lead {
    margin-top: -0.5rem;
    font-size: var(--t-sm);
  }
  .reminder {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 0.875rem 1rem;
    margin: 0.25rem 0 1.25rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    text-align: left;
    font-weight: 400;
  }
  .reminder:active:not(:disabled) { transform: none; }
  .reminder:disabled { opacity: 1; cursor: progress; }
  .reminder:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .reminder-copy { display: grid; gap: 0.125rem; min-width: 0; }
  .reminder-copy strong { font-size: var(--t-base); font-weight: 600; }
  .reminder-copy > span { color: var(--muted); font-size: var(--t-sm); line-height: 1.4; }
  .reminder-copy .reminder-status:empty { display: none; }
  .reminder-copy .reminder-status { font-size: var(--t-xs); }
  .reminder-copy .reminder-status.warn { color: var(--danger); }
  .reminder-track {
    position: relative;
    flex: 0 0 auto;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: var(--line-strong);
    transition: background-color 200ms var(--ease);
  }
  .reminder-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }
  .reminder-track.on { background: var(--accent); }
  .reminder-track.on .reminder-thumb { background: var(--accent-ink); transform: translateX(18px); }
  .reminder:disabled .reminder-track { opacity: 0.6; }
  @media (prefers-reduced-motion: no-preference) {
    .reminder-thumb { transition: transform 180ms var(--ease), background-color 180ms var(--ease); }
  }
  .items {
    list-style: none;
    margin: 1rem 0;
    padding: 0;
    display: grid;
    gap: 1.25rem;
  }
  li {
    display: grid;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .tick {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 0 0 1.5px var(--line-strong) inset;
    color: var(--accent-ink);
  }
  .tick.on {
    background: var(--accent);
    box-shadow: none;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .streak {
    color: var(--ember);
  }
  .del {
    width: 40px;
    padding: 0;
    color: var(--faint);
  }
  .add {
    display: flex;
    gap: 0.5rem;
  }
  .add input {
    flex: 1;
  }
  .add button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .hint {
    margin: -0.25rem 0 0.75rem;
    font-size: var(--t-sm);
  }
  .pick {
    display: grid;
    gap: 0.25rem;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    background: var(--surface);
  }
  .pick .when {
    text-transform: capitalize;
  }
  .pick-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 48px;
    padding: 0;
    background: none;
    border: 0;
    color: inherit;
    text-align: left;
  }
  .tick.small {
    width: 28px;
    height: 28px;
    min-height: 28px;
  }
  .log {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: grid;
  }
  .log li {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    align-items: center;
    gap: 0.5rem;
    min-height: 48px;
    border-bottom: 1px solid var(--line);
  }
  .when {
    color: var(--muted);
    font-size: var(--t-sm);
    text-transform: capitalize;
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
</style>
