<script lang="ts">
  import { page } from '$app/state';

  const links = [
    { href: '/dashboard', label: 'Inicio', match: ['/dashboard', '/workout'] },
    { href: '/programs', label: 'Entrenar', match: ['/programs', '/library'] },
    { href: '/progress', label: 'Progreso', match: ['/progress'] },
    { href: '/nutrition', label: 'Comida', match: ['/nutrition'] },
    { href: '/more', label: 'Más', match: ['/more', '/history', '/photos', '/settings', '/family'] },
  ];
</script>

<nav>
  {#each links as link}
    <a href={link.href} class:active={link.match.some((m) => page.url.pathname.startsWith(m))}>{link.label}</a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    justify-content: space-around;
    padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid #334155;
  }
  a {
    flex: 1;
    text-align: center;
    padding: 0.75rem 0;
    color: var(--muted);
    text-decoration: none;
    background: none;
    border: 0;
  }
  a.active {
    color: var(--accent);
    font-weight: 600;
  }
</style>
