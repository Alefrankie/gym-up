<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '#lib/i18n';
  import { appUpdates } from '#lib/updates.svelte';
  import FloatingNotice from './FloatingNotice.svelte';

  onMount(() => {
    void appUpdates.check();
  });
</script>

{#if appUpdates.supported && appUpdates.available && !appUpdates.dismissed}
  <FloatingNotice placement="update" ondismiss={appUpdates.downloading ? undefined : () => appUpdates.dismiss()}>
    <aside class="update" aria-label={t('update.title')}>
      <div class="copy">
        <strong>{t('update.title')}</strong>
        <p>{t('update.description', { version: appUpdates.available.version })}</p>
        {#if appUpdates.available.releaseNotes}
          <p class="notes">{t('update.notes')}: {appUpdates.available.releaseNotes}</p>
        {/if}
        {#if appUpdates.downloading}
          <p class="progress" aria-live="polite">
            {appUpdates.progressPercent === null
              ? t('update.downloading')
              : t('update.progress', { percent: appUpdates.progressPercent })}
          </p>
          <progress max="100" value={appUpdates.progressPercent ?? undefined}></progress>
        {/if}
        {#if appUpdates.permissionRequired}
          <p>{t('update.permission')}</p>
        {/if}
        {#if appUpdates.error}<p class="error" role="alert">{appUpdates.errorDetail || t('update.downloadError')}</p>{/if}
      </div>
      <div class="actions">
        {#if !appUpdates.downloading}
          <button type="button" class="primary" onclick={() => appUpdates.install()}>{t('update.install')}</button>
          <button type="button" class="dismiss" onclick={() => appUpdates.dismiss()}>{t('update.dismiss')}</button>
        {/if}
      </div>
    </aside>
  </FloatingNotice>
{/if}

<style>
  .update {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .copy { min-width: 0; }
  strong { color: var(--accent-hi); font-size: var(--t-xs); }
  p { margin: 0.3rem 0 0; color: var(--muted); font-size: var(--t-sm); }
  .notes { color: var(--text); }
  .error { color: var(--danger, #d44); }
  .progress { margin-bottom: 0.3rem; }
  progress { width: min(18rem, 100%); accent-color: var(--accent); }
  .actions { display: flex; flex: 0 0 auto; flex-direction: column; gap: 0.35rem; align-items: stretch; }
  .dismiss { background: transparent; color: var(--muted); box-shadow: none; }
  @media (max-width: 560px) {
    .update { align-items: stretch; flex-direction: column; gap: 0.65rem; }
    .actions { flex-direction: row; }
    .actions button { flex: 1; }
  }
</style>
