<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    value = $bindable(''),
    label,
    autocomplete,
    minlength,
  }: { value: string; label: string; autocomplete: 'current-password' | 'new-password'; minlength?: number } = $props();

  let shown = $state(false);
</script>

<label>
  {label}
  <span class="field">
    <input type={shown ? 'text' : 'password'} bind:value {autocomplete} {minlength} required />
    <button type="button" class="eye" aria-pressed={shown} aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'} onclick={() => (shown = !shown)}>
      <Icon name={shown ? 'eyeOff' : 'eye'} size={22} />
    </button>
  </span>
</label>

<style>
  .field {
    position: relative;
    display: block;
  }
  input {
    width: 100%;
    padding-right: 3.2rem;
  }
  .eye {
    position: absolute;
    top: 0;
    right: 0;
    width: 3rem;
    min-height: 48px;
    padding: 0;
    display: grid;
    place-items: center;
    background: none;
    box-shadow: none;
    color: var(--muted);
  }
</style>
