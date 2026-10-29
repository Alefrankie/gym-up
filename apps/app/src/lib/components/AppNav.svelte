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
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    justify-content: space-around;
    padding: 0.4rem 0.5rem calc(0.4rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow:
      0 1px 0 rgb(255 255 255 / 0.06) inset,
      0 -14px 30px -12px rgb(0 0 0 / 0.8);
  }
  a {
    flex: 1;
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    padding: 0.35rem 0 0.2rem;
    min-height: 56px;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .ico {
    display: grid;
    place-items: center;
    width: 3.4rem;
    height: 2rem;
    border-radius: 999px;
    transition:
      background 180ms cubic-bezier(0.22, 1, 0.36, 1),
      color 180ms;
  }
  a.active {
    color: var(--accent-hi);
  }
  a.active .ico {
    background: var(--accent-soft);
    box-shadow: 0 0 18px -4px rgb(255 106 43 / 0.55);
  }
</style>
