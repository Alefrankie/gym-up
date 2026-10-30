<script lang="ts">
  import { t, type MessageKey } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { appUpdates } from '#lib/updates.svelte';
  import type { ComponentProps } from 'svelte';

  const landingUrl = new URL(
    '/descarga',
    import.meta.env.VITE_LANDING_URL || 'https://gym-up-web.gymup-phase0-spike.workers.dev',
  ).toString();
  let qrVisible = $state(false);
  let qrLoading = $state(false);
  let qrDataUrl = $state('');
  let shareMessage = $state('');

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

  async function shareApp() {
    shareMessage = '';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Gym Up', text: t('more.shareText'), url: landingUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(landingUrl);
      shareMessage = t('more.linkCopied');
    } catch {
      shareMessage = t('more.copyLinkManually');
    }
  }

  async function toggleQr() {
    if (qrDataUrl) {
      qrVisible = !qrVisible;
      return;
    }

    qrLoading = true;
    try {
      const QRCode = (await import('qrcode')).default;
      qrDataUrl = await QRCode.toDataURL(landingUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#17171a', light: '#ffffff' },
      });
      qrVisible = true;
    } catch {
      shareMessage = t('more.qrError');
    } finally {
      qrLoading = false;
    }
  }
</script>

<main>
  <h1>{t('nav.more')}</h1>
  <section class="card share-card" aria-labelledby="share-title">
    <div class="share-heading">
      <span class="ico"><Icon name="share" size={18} /></span>
      <div>
        <h2 id="share-title">{t('more.shareTitle')}</h2>
        <p class="muted hint">{t('more.shareHint')}</p>
      </div>
    </div>
    <div class="share-actions">
      <button type="button" class="primary" onclick={shareApp}>
        <Icon name="share" size={18} />{t('more.sendLink')}
      </button>
      <button type="button" class="qr-button" onclick={toggleQr} disabled={qrLoading}>
        <Icon name="qr" size={18} />{qrLoading ? t('common.loading') : qrVisible ? t('more.hideQr') : t('more.showQr')}
      </button>
    </div>
    {#if shareMessage}<p class="muted share-message" role="status">{shareMessage}</p>{/if}
    <a class="landing-link" href={landingUrl} target="_blank" rel="noreferrer">{landingUrl}</a>
    {#if qrVisible && qrDataUrl}
      <div class="qr-preview">
        <img src={qrDataUrl} alt={t('more.qrAlt')} width="240" height="240" />
        <span class="muted hint">{t('more.qrCaption')}</span>
      </div>
    {/if}
  </section>
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
  .share-card {
    display: grid;
    gap: 0.75rem;
  }
  .share-heading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .share-heading h2 {
    margin: 0 0 0.15rem;
  }
  .share-heading p {
    margin: 0;
  }
  .share-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .share-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 48px;
    margin: 0;
    padding-inline: 0.5rem;
    font-size: var(--t-sm);
  }
  .share-actions .primary {
    width: auto;
  }
  .qr-button {
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line-strong) inset;
  }
  .share-message {
    margin: 0;
    font-size: var(--t-sm);
  }
  .landing-link {
    min-width: 0;
    font-size: var(--t-xs);
    overflow-wrap: anywhere;
  }
  .qr-preview {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }
  .qr-preview img {
    display: block;
    width: min(240px, 100%);
    height: auto;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    background: #fff;
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
