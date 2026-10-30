<script lang="ts">
  import { t } from '#lib/i18n';
  import { tokenStore } from '#lib/api/token';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto(tokenStore.get() ? '/dashboard' : '/login', { replaceState: true });
  });
</script>

<main>
  <p class="muted loading">{t('common.loading')}</p>
</main>
