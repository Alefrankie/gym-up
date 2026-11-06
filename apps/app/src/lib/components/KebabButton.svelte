<script lang="ts">
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  /** The ⋮ at the end of a list row: opens that row's options. Sits inside the row's card, where the chevron was. */
  let { onclick }: { onclick: () => void } = $props();
</script>

<button type="button" class="kebab" data-nodrag aria-label={t('common.moreOptions')} aria-haspopup="dialog" {onclick}>
  <Icon name="moreV" size={20} />
</button>

<style>
  .kebab {
    flex: none;
    align-self: stretch;
    width: 44px;
    min-height: 44px;
    margin-left: -0.25rem;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: var(--radius);
    background: none;
    box-shadow: none;
    color: var(--muted);
    transition: background-color 160ms var(--ease), color 160ms var(--ease);
  }
  .kebab:active {
    background: var(--surface-hi);
    color: var(--text);
  }
</style>
