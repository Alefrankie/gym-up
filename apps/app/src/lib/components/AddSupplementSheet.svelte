<script lang="ts">
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  /** Add a supplement: one tap on a common one, or type any name. The parent saves it and closes the sheet. */
  let { existing, onadd, onclose }: { existing: string[]; onadd: (name: string) => Promise<string | null>; onclose: () => void } = $props();

  const COMMON = ['Creatina', 'Proteína', 'Omega 3', 'Vitamina D', 'Magnesio', 'Cafeína'];
  const taken = $derived(new Set(existing.map((n) => n.trim().toLowerCase())));
  const suggestions = $derived(COMMON.filter((n) => !taken.has(n.toLowerCase())));

  let name = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function save(value: string) {
    if (!value.trim() || busy) return;
    busy = true;
    error = await onadd(value.trim());
    busy = false;
  }
</script>

<Sheet title={t('supplements.newTitle')} {onclose}>
  <p class="muted sub">{t('supplements.newHint')}</p>

  {#if suggestions.length}
    <ul class="options">
      {#each suggestions as s (s)}
        <li>
          <button type="button" class="opt" disabled={busy} onclick={() => save(s)}>
            <span class="badge"><Icon name="plus" size={18} /></span>
            <span class="grow">{s}</span>
            <Icon name="right" size={18} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <form
    class="custom"
    onsubmit={(e) => {
      e.preventDefault();
      save(name);
    }}
  >
    <label for="supplement-name">{t('supplements.customLabel')}</label>
    <input id="supplement-name" maxlength="40" autocomplete="off" placeholder={t('supplements.addPlaceholder')} bind:value={name} />
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" disabled={busy || !name.trim()}>{busy ? t('common.loading') : t('common.add')}</button>
  </form>
</Sheet>

<style>
  .sub {
    margin: -0.5rem 0 1rem;
    font-size: var(--t-sm);
  }
  .options {
    list-style: none;
    margin: 0 0 1.25rem;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: 100%;
    min-height: 56px;
    padding: 0.375rem 0.25rem;
    background: none;
    box-shadow: none;
    text-align: left;
    font-weight: 500;
    color: var(--text);
  }
  .opt :global(svg:last-child) {
    color: var(--muted);
  }
  .badge {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius);
    background: var(--surface-hi);
    color: var(--accent-hi);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .custom {
    display: grid;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  label {
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .error {
    margin: 0;
  }
</style>
