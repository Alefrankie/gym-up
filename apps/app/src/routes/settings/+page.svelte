<script lang="ts">
  import Select from '#lib/components/Select.svelte';
  import { onMount } from 'svelte';
  import { updateProfileRequestSchema, userSchema, type AddressForm, type CoachTone, type UpdateProfileRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { API_URL } from '#lib/api/config';
  import { session } from '#lib/session';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { i18n, t, type LocalePreference } from '#lib/i18n';
  import { appUpdates } from '#lib/updates.svelte';
  import { coachLine } from '#lib/coach/coach.svelte';
  import { nudge } from '#lib/nudge.svelte';
  import { CLOUD_OPTIONS, coachVoice, type VoiceOption } from '#lib/coach/voice.svelte';
  import { coachRecordings } from '#lib/coach/recordings.svelte';

  let displayName = $state('');
  let weightUnit = $state<'kg' | 'lbs'>('kg');
  let routineType = $state<'hombre' | 'mujer'>('hombre');
  // Shown in the chosen unit, stored in kg.
  let bodyWeight = $state<number | null>(null);
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let coachTone = $state<CoachTone>('normal');
  let addressForm = $state<AddressForm>('m');
  let coachMessage = $state<string | null>(null);
  let coachError = $state<string | null>(null);

  onMount(async () => {
    const user = await session.require();
    if (!user) return;
    displayName = user.displayName;
    weightUnit = user.weightUnit;
    routineType = user.routineType;
    bodyWeight = user.bodyWeightKg ? Math.round(toDisplay(user.bodyWeightKg, user.weightUnit)) : null;
    coachTone = user.coachTone;
    addressForm = user.addressForm;
  });

  /** Coach settings save as soon as they change; gymrat asks first because it swears. */
  // Voices to compare: the phone's male voices (filled in once the app asks Android) and the cloud ones.
  let voiceOptions = $state<VoiceOption[]>([{ id: 'auto', kind: 'auto', name: 'auto' }, ...CLOUD_OPTIONS]);
  onMount(() => {
    void coachVoice.options().then((o) => (voiceOptions = o));
  });
  const phoneVoices = $derived(voiceOptions.filter((o) => o.kind === 'native'));
  function voiceLabel(o: VoiceOption): string {
    if (o.kind === 'auto') return t('coach.voiceAuto');
    if (o.kind === 'native') return t('coach.voicePhone', { n: phoneVoices.indexOf(o) + 1 });
    return o.name.charAt(0).toUpperCase() + o.name.slice(1);
  }
  function voiceHint(o: VoiceOption): string {
    if (o.kind === 'cloud') return t('coach.voiceCloudHint');
    if (o.kind === 'native') return t('coach.voicePhoneHint', { locale: o.locale ?? '' });
    return t('coach.voiceAutoHint');
  }

  /** Says a Home line now and reports how it went, instead of failing in silence. */
  let voiceSaid = $state(false);
  async function testVoice() {
    voiceSaid = false;
    const line = coachLine('home');
    if (!line) return;
    nudge.show(line.text, 4000);
    voiceSaid = await coachVoice.test(line.text, line.locale);
  }

  function setVoice(on: boolean) {
    coachVoice.set(on);
    voiceSaid = false;
    if (on) coachVoice.prewarm();
  }

  async function saveCoach(patch: Pick<UpdateProfileRequest, 'coachTone' | 'addressForm'>) {
    coachMessage = null;
    coachError = null;
    const before = { coachTone: session.user?.coachTone ?? 'normal', addressForm: session.user?.addressForm ?? 'm' };
    if (patch.coachTone === 'gymrat' && before.coachTone !== 'gymrat' && !confirm(t('coach.gymratConfirm'))) {
      coachTone = before.coachTone;
      return;
    }
    try {
      await session.set(await api('/auth/me', { method: 'PATCH', body: patch, schema: userSchema }));
      coachMessage = t('coach.saved');
      if (patch.coachTone && coachVoice.enabled) void coachRecordings.prefetch(patch.coachTone);
    } catch (e) {
      coachTone = before.coachTone;
      addressForm = before.addressForm;
      coachError = e instanceof NetworkError ? t('settings.offline') : e instanceof ApiRequestError ? e.message : t('settings.saveError');
    }
  }

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
  {#if appUpdates.supported}
  <section class="card">
    <h2 class="first">{t('update.title')}</h2>
    <p class="muted hint">
      {#if appUpdates.checking}
        {t('update.checking')}
      {:else if appUpdates.available}
        {t('update.description', { version: appUpdates.available.version })}
      {:else if appUpdates.checked}
        {t('update.current')}
      {/if}
    </p>
    {#if appUpdates.error}<p class="error" role="alert">{t('update.error')}</p>{/if}
    <div class="update-actions">
      <button type="button" class="primary" disabled={appUpdates.checking} onclick={() => appUpdates.check(true)}>
        {appUpdates.checking ? t('update.checking') : t('update.check')}
      </button>
      {#if appUpdates.available}
        <button type="button" disabled={appUpdates.downloading} onclick={() => appUpdates.install()}>
          {appUpdates.downloading ? t('update.downloading') : t('update.install')}
        </button>
      {/if}
    </div>
    {#if appUpdates.permissionRequired}<p class="muted hint">{t('update.permission')}</p>{/if}
  </section>
  {/if}

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
    <h2 class="first">{t('coach.title')}</h2>
    <p class="muted hint lead">{t('coach.hint')}</p>
    <div class="coach">
      <label>
        {t('coach.tone')}
        <Select
          bind:value={coachTone}
          options={(['flower', 'normal', 'hard', 'gymrat'] as const).map((v) => ({ value: v, label: t(`coach.tone.${v}`) }))}
          onchange={(v) => saveCoach({ coachTone: v })}
        />
        {#if coachTone === 'gymrat'}<span class="muted hint">{t('coach.gymratHint')}</span>{/if}
      </label>
      <label>
        {t('coach.addressForm')}
        <Select
          bind:value={addressForm}
          options={(['m', 'f'] as const).map((v) => ({ value: v, label: t(`coach.address.${v}`) }))}
          onchange={(v) => saveCoach({ addressForm: v })}
        />
      </label>
      <div>
        <span class="field">{t('coach.voice')}</span>
        <div class="lang two" role="radiogroup" aria-label={t('coach.voice')}>
          {#each [true, false] as on (on)}
            <button type="button" role="radio" aria-checked={coachVoice.enabled === on} class:on={coachVoice.enabled === on} onclick={() => setVoice(on)}>
              {on ? t('coach.voiceOn') : t('coach.voiceOff')}
            </button>
          {/each}
        </div>
        <p class="muted hint">{t('coach.voiceHint')}</p>
        {#if coachVoice.enabled}
          <button type="button" class="test" disabled={coachVoice.busy} onclick={testVoice}>
            <Icon name="bolt" size={16} /> {coachVoice.busy ? t('coach.voicePreparing') : t('coach.voiceTest')}
          </button>
          {@const d = coachVoice.download}
          {#if d?.phase === 'download'}
            <p class="muted hint" role="status">
              {d.totalMb ? t('coach.voiceDownloadMb', { loaded: d.loadedMb ?? 0, total: d.totalMb, percent: d.percent ?? 0 }) : t('coach.voiceDownload')}
            </p>
            {#if d.percent !== null}<progress max="100" value={d.percent}></progress>{/if}
          {:else if d?.phase === 'load'}
            <p class="muted hint" role="status">{t('coach.voiceLoading')}</p>
          {:else if coachVoice.problem?.kind === 'noVoice'}
            <p class="error" role="alert">{t('coach.voiceNone')}</p>
          {:else if coachVoice.problem?.kind === 'failed'}
            <p class="error" role="alert">{t('coach.voiceFailed', { message: coachVoice.problem.message })}</p>
          {:else if coachVoice.problem?.kind === 'notMale'}
            <p class="muted hint" role="status">{t('coach.voiceNotMale')}</p>
          {:else if d?.phase === 'ready' || voiceSaid}
            <p class="ok" role="status">{t('coach.voiceReady')}</p>
          {/if}
          <p class="field pick-title">{t('coach.voicePick')}</p>
          <div class="voices" role="radiogroup" aria-label={t('coach.voicePick')}>
            {#each voiceOptions as o (o.id)}
              {@const tried = coachVoice.tried[o.id]}
              <div class="voice" class:on={coachVoice.voiceId === o.id}>
                <button type="button" role="radio" aria-checked={coachVoice.voiceId === o.id} class="pick" onclick={() => coachVoice.choose(o.id)}>
                  <strong>{voiceLabel(o)}</strong>
                  <span class="muted">{voiceHint(o)}</span>
                </button>
                <div class="try-row">
                  <button type="button" class="try" disabled={coachVoice.trying !== null} onclick={() => coachVoice.tryOption(o.id)}>
                    {coachVoice.trying === o.id ? t('coach.voiceTrying') : t('coach.voiceTry')}
                  </button>
                  {#if tried}
                    <span class="lat" class:bad={!!tried.error}>
                      {tried.error ? t('coach.voiceTryFailed', { message: tried.error }) : t('coach.voiceLatency', { ms: tried.latencyMs ?? '?' })}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          {#if coachVoice.inApp && (coachVoice.problem?.kind === 'noVoice' || coachVoice.problem?.kind === 'notMale' || coachVoice.problem?.kind === 'failed')}
            <button type="button" class="test" onclick={() => coachVoice.openSystemSettings()}>{t('coach.voiceSystemSettings')}</button>
          {/if}
        {/if}
      </div>
    </div>
    {#if coachMessage}<p class="ok" role="status">{coachMessage}</p>{/if}
    {#if coachError}<p class="error" role="alert">{coachError}</p>{/if}
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
  .lead {
    margin: 0 0 0.75rem;
  }
  .coach {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: block;
    margin-bottom: 0.4rem;
  }
  .lang.two {
    grid-template-columns: repeat(2, 1fr);
  }
  .pick-title {
    margin: 1rem 0 0.4rem;
  }
  .voices {
    display: grid;
    gap: 0.5rem;
  }
  .voice {
    display: grid;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .voice.on {
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .pick {
    display: grid;
    gap: 0.15rem;
    min-height: 0;
    padding: 0;
    background: none;
    box-shadow: none;
    color: var(--text);
    text-align: left;
  }
  .pick span {
    font-size: var(--t-xs);
    font-weight: 400;
  }
  .try-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .try {
    min-height: 36px;
    width: auto;
    margin: 0;
    padding: 0 0.9rem;
    font-size: var(--t-sm);
  }
  .lat {
    color: var(--ok);
    font-size: var(--t-sm);
    font-variant-numeric: tabular-nums;
  }
  .lat.bad {
    color: var(--danger, #e5484d);
  }
  progress {
    width: 100%;
    margin-top: 0.4rem;
    accent-color: var(--accent);
  }
  .test {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }
  .update-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
</style>
