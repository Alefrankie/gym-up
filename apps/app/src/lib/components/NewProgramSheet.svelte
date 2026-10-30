<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { programDetailDtoSchema, type ProgramDetailDto, type ProgramSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { saveBody } from '#lib/programs';
  import Icon from './Icon.svelte';
  import ProgramThumb from './ProgramThumb.svelte';
  import Sheet from './Sheet.svelte';

  /** Two ways to start a program: from scratch with N training days, or from a template copied as-is. */
  let { templates, onclose }: { templates: ProgramSummaryDto[]; onclose: () => void } = $props();

  let from = $state<'empty' | string>('empty');
  let name = $state('');
  let days = $state(4);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const DAY_NAMES = [
    'programs.weekday.mon',
    'programs.weekday.tue',
    'programs.weekday.wed',
    'programs.weekday.thu',
    'programs.weekday.fri',
    'programs.weekday.sat',
    'programs.weekday.sun',
  ] as const;

  async function create(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = null;
    try {
      let id: string;
      if (from === 'empty') {
        id = crypto.randomUUID();
        const created = await api<ProgramDetailDto>('/programs', {
          method: 'POST',
          body: { id, name: name.trim() || 'Mi programa' },
          schema: programDetailDtoSchema,
        });
        // One empty routine per training day, named after the weekday: the user fills them in next.
        const routines = Array.from({ length: days }, (_, i) => ({
          id: crypto.randomUUID(),
          dayNumber: i + 1,
          name: t(DAY_NAMES[i]!),
          focus: '',
          notes: null,
          exercises: [],
        }));
        await api(`/programs/${id}`, { method: 'PUT', body: saveBody(created, { routines }) });
      } else {
        const copy = await api<ProgramDetailDto>(`/programs/${from}/adopt`, { method: 'POST', schema: programDetailDtoSchema });
        id = copy.id;
        if (name.trim() && name.trim() !== copy.name) {
          await api(`/programs/${id}`, { method: 'PUT', body: saveBody(copy, { name: name.trim() }) });
        }
      }
      await invalidateCache(['/programs', '/workouts/today']);
      await goto(`/programs/${id}`);
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : t('programs.createOffline');
      busy = false;
    }
  }
</script>

<Sheet title={t('programs.new')} {onclose}>
  <form onsubmit={create}>
    <label>
      {t('programs.name')}
      <input maxlength="60" placeholder={from === 'empty' ? t('programs.namePlaceholder') : t('programs.nameSameAsTemplate')} bind:value={name} />
    </label>

    <fieldset>
      <legend>{t('programs.startFrom')}</legend>
      <div class="options">
        <button type="button" class="opt" class:on={from === 'empty'} aria-pressed={from === 'empty'} onclick={() => (from = 'empty')}>
          <span class="blank"><Icon name="plus" size={20} /></span>
          <span class="grow"><strong>{t('programs.fromScratch')}</strong><span class="muted">{t('programs.fromScratchHint')}</span></span>
        </button>
        {#each templates as tpl (tpl.id)}
          <button type="button" class="opt" class:on={from === tpl.id} aria-pressed={from === tpl.id} onclick={() => (from = tpl.id)}>
            <ProgramThumb muscles={tpl.muscles} size={44} />
            <span class="grow"><strong>{tpl.name}</strong><span class="muted">{tn('programs.days', tpl.routineCount)} · {tn('programs.exercises', tpl.exerciseCount ?? 0)}</span></span>
          </button>
        {/each}
      </div>
    </fieldset>

    {#if from === 'empty'}
      <fieldset>
        <legend>{t('programs.daysPerWeek')}</legend>
        <div class="days" role="group">
          {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
            <button type="button" class:on={days === n} aria-pressed={days === n} onclick={() => (days = n)}>{n}</button>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" disabled={busy}>{busy ? t('programs.creating') : t('programs.create')}</button>
  </form>
</Sheet>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    margin-bottom: 0.4rem;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .options {
    display: grid;
    gap: 0.4rem;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 60px;
    padding: 0.5rem 0.75rem 0.5rem 0.5rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: none;
    text-align: left;
  }
  .opt.on {
    box-shadow: 0 0 0 1.5px var(--accent) inset;
    background: var(--accent-soft);
  }
  .blank {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius);
    background: var(--raised);
    color: var(--accent-hi);
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .grow .muted {
    font-size: var(--t-sm);
    font-weight: 400;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.35rem;
  }
  .days button {
    min-height: 44px;
    padding: 0;
    font-weight: 600;
  }
  .days button.on {
    background: var(--accent);
    color: var(--accent-ink);
    box-shadow: none;
  }
</style>
