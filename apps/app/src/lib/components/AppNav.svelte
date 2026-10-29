<script lang="ts">
  import { page } from '$app/state';
  import Icon, { type IconName } from './Icon.svelte';

  const links: Array<{ href: string; label: string; icon: IconName; match: string[] }> = [
    { href: '/dashboard', label: 'Inicio', icon: 'home', match: ['/dashboard', '/workout'] },
    { href: '/programs', label: 'Entrenar', icon: 'dumbbell', match: ['/programs', '/library'] },
    { href: '/progress', label: 'Progreso', icon: 'chart', match: ['/progress'] },
    { href: '/groups', label: 'Grupos', icon: 'users', match: ['/groups'] },
    { href: '/more', label: 'Más', icon: 'more', match: ['/more', '/history', '/photos', '/settings', '/nutrition'] },
  ];
</script>

<nav aria-label="Principal">
  {#each links as link}
    {@const active = link.match.some((m) => page.url.pathname.startsWith(m))}
    <a href={link.href} class:active aria-current={active ? 'page' : undefined}>
      <span class="ico"><Icon name={link.icon} size={24} /></span>
      <span class="label">{link.label}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    view-transition-name: nav;
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    justify-content: space-around;
    padding: 0 0.25rem env(safe-area-inset-bottom);
    background: var(--bg);
    border-top: 1px solid var(--line);
  }
  a {
    position: relative;
    flex: 1;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.25rem;
    min-height: 68px;
    color: var(--faint);
    text-decoration: none;
    font-size: var(--t-xs);
    font-weight: 500;
    transition: color 180ms var(--ease);
  }
  .ico {
    display: grid;
    place-items: center;
    width: 56px;
    height: 32px;
    border-radius: 999px;
    transition: background-color 200ms var(--ease);
  }
  /* Active tab: accent icon on a soft pill, accent label. */
  a.active {
    color: var(--accent);
  }
  a.active .ico {
    background: var(--accent-soft);
  }
</style>
