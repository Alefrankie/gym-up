<script lang="ts">
  import { onMount } from 'svelte';

  let { message, onundo, ondismiss }: { message: string; onundo: () => void; ondismiss: () => void } = $props();

  onMount(() => {
    const t = setTimeout(ondismiss, 5000);
    return () => clearTimeout(t);
  });
</script>

<div class="toast" role="status">
  <span>{message}</span>
  <button type="button" onclick={onundo}>Deshacer</button>
</div>

<style>
  .toast {
    position: fixed;
    left: 1rem;
    right: 1rem;
    bottom: calc(5.2rem + env(safe-area-inset-bottom));
    z-index: 40;
    max-width: 30rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.4rem 0.5rem 0.4rem 1rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--raised), var(--surface-hi));
    box-shadow: var(--shadow-card), 0 20px 30px -10px rgb(0 0 0 / 0.7);
    animation: pop 200ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes pop {
    from {
      transform: translateY(0.6rem);
      opacity: 0;
    }
  }
  button {
    min-height: 44px;
    background: none;
    box-shadow: none;
    color: var(--accent-hi);
  }
</style>
