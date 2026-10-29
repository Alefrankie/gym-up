<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import type { ComponentProps } from 'svelte';

  type IconName = ComponentProps<typeof Icon>['name'];

  onMount(() => {
    void session.require();
  });

  const links: Array<{ href: string; title: string; hint: string; icon: IconName }> = [
    { href: '/nutrition', title: 'Comida', hint: 'Lo que comes cada día', icon: 'utensils' },
    { href: '/history', title: 'Historial', hint: 'Todos tus entrenamientos', icon: 'history' },
    { href: '/photos', title: 'Fotos de progreso', hint: 'Privadas, solo para ti', icon: 'camera' },
    { href: '/settings', title: 'Ajustes', hint: 'Nombre, unidad de peso, rutina y cuenta', icon: 'sliders' },
  ];
</script>

<main>
  <h1>Más</h1>
  <ul class="list">
    {#each links as l}
      <li>
        <a href={l.href}>
          <span class="ico"><Icon name={l.icon} size={22} /></span>
          <span class="grow">
            <strong>{l.title}</strong>
            <span class="muted hint">{l.hint}</span>
          </span>
          <span class="muted"><Icon name="right" size={18} /></span>
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
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-hi);
    flex: none;
  }
  .hint {
    font-size: 0.88rem;
  }
</style>
