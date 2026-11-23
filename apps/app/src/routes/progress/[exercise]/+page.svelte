<script lang="ts">
  import { page } from '$app/state';
  import Progress from '../+page.svelte';
</script>

{#key page.params.exercise}
  <Progress />
{/key}
