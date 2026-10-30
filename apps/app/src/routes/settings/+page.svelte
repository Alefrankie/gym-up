<script lang="ts">
  import Select from '#lib/components/Select.svelte';
  import { onMount } from 'svelte';
  import { updateProfileRequestSchema, userSchema, type UpdateProfileRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { API_URL } from '#lib/api/config';
  import { session } from '#lib/session';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { i18n, t, type LocalePreference } from '#lib/i18n';

  let displayName = $state('');
  let weightUnit = $state<'kg' | 'lbs'>('kg');
  let routineType = $state<'hombre' | 'mujer'>('hombre');
  // Shown in the chosen unit, stored in kg.
  let bodyWeight = $state<number | null>(null);
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    const user = await session.require();
    if (!user) return;
    displayName = user.displayName;
    weightUnit = user.weightUnit;
    routineType = user.routineType;
    bodyWeight = user.bodyWeightKg ? Math.round(toDisplay(user.bodyWeightKg, user.weightUnit)) : null;
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    message = null;
    error = null;
    const bodyWeightKg = bodyWeight ? Math.round((weightUnit === 'lbs' ? bodyWeight / 2.20462 : bodyWeight) * 10) / 10 : null;
    const body: UpdateProfileRequest = { displayName, weightUnit, routineType, bodyWeightKg };
    if (!updateProfileRequestSchema.safeParse(body).success) {
      error = t('settings.nameInvalid');
      return;
    }
    busy = true;
    try {
      const user = await api('/auth/me', { method: 'PATCH', body, schema: userSchema });
      await session.set(user);
      message = t('settings.savedMessage');
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('settings.offline')
          : e instanceof ApiRequestError
            ? e.message
            : t('settings.saveError');
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>{t('settings.title')}</h1>
  <SyncBanner />
  <section class="card">
    <h2 class="first">{t('settings.profile')}</h2>
    <form onsubmit={save}>
      <label>
        {t('auth.name')}
        <input bind:value={displayName} maxlength="80" required />
      </label>
      <label>
        {t('settings.weightUnit')}
        <Select bind:value={weightUnit} options={[{ value: 'kg', label: t('settings.kg') }, { value: 'lbs', label: t('settings.lbs') }]} />
      </label>
      <label>
        {t('settings.bodyWeight', { unit: weightUnit })}
        <input type="number" inputmode="decimal" min="25" max="660" step="0.1" bind:value={bodyWeight} />
        <span class="muted hint">{t('settings.bodyWeightHint')}</span>
      </label>
      <label>
        {t('settings.routine')}
        <Select bind:value={routineType} options={[{ value: 'hombre', label: t('auth.planMen') }, { value: 'mujer', label: t('auth.planWomen') }]} />
      </label>
      {#if message}<p class="ok" role="status">{message}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="primary" type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
    </form>
  </section>

  <section class="card">
    <h2 class="first">{t('language.title')}</h2>
    <div class="lang" role="radiogroup" aria-label={t('language.title')}>
      {#each [['system', t('language.system')], ['es', t('language.es')], ['en', t('language.en')]] as [value, text] (value)}
        <button type="button" role="radio" aria-checked={i18n.preference === value} class:on={i18n.preference === value} onclick={() => i18n.set(value as LocalePreference)}>
          {text}
        </button>
      {/each}
    </div>
    <p class="muted hint">{t('language.hint')}</p>
  </section>

  <section class="card">
    <h2 class="first">{t('settings.account')}</h2>
    <p class="muted email">{session.user?.email}</p>
    <button type="button" class="out" onclick={() => session.signOut()}>
      <Icon name="logout" size={20} /> {t('settings.signOut')}
    </button>
  </section>

  <p class="muted small">{t('settings.server', { url: API_URL })}</p>
</main>

<AppNav />

<style>
  .first {
    margin: 0 0 0.75rem;
  }
  .email {
    font-size: var(--t-sm);
    overflow-wrap: anywhere;
  }
  .out {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .small {
    color: var(--faint);
    font-size: var(--t-xs);
    word-break: break-all;
  }
  .lang {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: var(--radius);
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .lang button {
    min-height: 42px;
    padding: 0 0.4rem;
    background: none;
    box-shadow: none;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .lang button.on {
    background: var(--raised);
    color: var(--text);
  }
  .hint {
    margin: 0.6rem 0 0;
    font-size: var(--t-sm);
  }
</style>
