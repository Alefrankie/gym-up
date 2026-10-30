<script lang="ts">
  import { t, type MessageKey } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import type { ComponentProps } from 'svelte';

  type IconName = ComponentProps<typeof Icon>['name'];

  onMount(() => {
    void session.require();
  });

  const links: Array<{ href: string; title: MessageKey; hint: MessageKey; icon: IconName }> = [
    { href: '/nutrition', title: 'more.nutrition', hint: 'more.nutritionHint', icon: 'utensils' },
    { href: '/history', title: 'more.history', hint: 'more.historyHint', icon: 'history' },
    { href: '/supplements', title: 'more.supplements', hint: 'more.supplementsHint', icon: 'check' },
    { href: '/photos', title: 'more.photos', hint: 'more.photosHint', icon: 'camera' },
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
</style>
