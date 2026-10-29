<script lang="ts">
  import { page } from '$app/state';
  import { session } from '#lib/session';

  const links = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/history', label: 'Historial' },
  ];
</script>

<nav>
  {#each links as link}
    <a href={link.href} class:active={page.url.pathname.startsWith(link.href)}>{link.label}</a>
  {/each}
  <button type="button" onclick={() => session.signOut()}>Salir</button>
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
  a,
  button {
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
