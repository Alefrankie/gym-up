<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';

  onMount(() => {
    void session.require();
  });

  const links = [
    { href: '/history', title: 'Historial', hint: 'Todos tus entrenamientos' },
    { href: '/photos', title: 'Fotos de progreso', hint: 'Privadas, solo para ti' },
    { href: '/settings', title: 'Ajustes', hint: 'Nombre, unidad de peso, rutina y cuenta' },
  ];
</script>

<main>
  <h1>Más</h1>
  <ul class="list">
    {#each links as l}
      <li>
        <a href={l.href}>
          <strong>{l.title}</strong>
          <span class="muted">{l.hint}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<AppNav />
