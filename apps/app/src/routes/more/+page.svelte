<script lang="ts">
  import { t, type MessageKey } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { appUpdates } from '#lib/updates.svelte';
  import type { ComponentProps } from 'svelte';

  type IconName = ComponentProps<typeof Icon>['name'];

  onMount(() => {
    void session.require();
    void appUpdates.check(true);
  });

  const links: Array<{ href: string; title: MessageKey; hint: MessageKey; icon: IconName }> = [
    { href: '/nutrition', title: 'more.nutrition', hint: 'more.nutritionHint', icon: 'utensils' },
    { href: '/history', title: 'more.history', hint: 'more.historyHint', icon: 'history' },
    { href: '/supplements', title: 'more.supplements', hint: 'more.supplementsHint', icon: 'check' },
    { href: '/photos', title: 'more.photos', hint: 'more.photosHint', icon: 'camera' },
    { href: '/feedback', title: 'feedback.title', hint: 'feedback.lead', icon: 'users' },
    { href: '/voice-benchmark', title: 'more.voiceBenchmark', hint: 'more.voiceBenchmarkHint', icon: 'mic' },
    { href: '/settings', title: 'more.settings', hint: 'more.settingsHint', icon: 'sliders' },
  ];
</script>

<main>
  <h1>{t('nav.more')}</h1>
  <ul class="list">
    {#each links as l}
      <li>
        <a href={l.href}>
          <span class="ico"><Icon name={l.icon} size={18} /></span>
          <span class="grow">
            <strong>{t(l.title)}</strong>
            <span class="muted hint">{t(l.hint)}</span>
          </span>
          <span class="muted"><Icon name="right" size={16} /></span>
        </a>
      </li>
    {/each}
  </ul>

  {#if appUpdates.supported}
    <section class="card updates">
      <strong>{t('update.check')}</strong>
      <p class="muted hint">
        {#if appUpdates.installedVersion}{t('update.installed', { version: appUpdates.installedVersion })} · {/if}
        {#if appUpdates.checking}
          {t('update.checking')}
        {:else if appUpdates.available}
          {t('update.description', { version: appUpdates.available.version })}
        {:else if appUpdates.checked && !appUpdates.error}
          {t('update.current')}
        {/if}
      </p>
      {#if appUpdates.error}
        <p class="error" role="alert">{appUpdates.errorDetail || t('update.error')}</p>
      {/if}
      <div class="update-actions">
        {#if appUpdates.available}
          <button type="button" class="primary" disabled={appUpdates.downloading} onclick={() => appUpdates.install()}>
            {appUpdates.downloading
              ? appUpdates.progressPercent !== null
                ? t('update.progress', { percent: appUpdates.progressPercent })
                : t('update.downloading')
              : t('update.install')}
          </button>
        {/if}
        <button type="button" class:primary={!appUpdates.available} disabled={appUpdates.checking} onclick={() => appUpdates.check(true)}>
          {appUpdates.checking ? t('update.checking') : t('update.check')}
        </button>
      </div>
      {#if appUpdates.permissionRequired}<p class="muted hint">{t('update.permission')}</p>{/if}
    </section>
  {/if}
</main>

<AppNav />

<style>
  .ico {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-hi);
    flex: none;
  }
  .hint {
    font-size: var(--t-sm);
  }
  .updates {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .update-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
