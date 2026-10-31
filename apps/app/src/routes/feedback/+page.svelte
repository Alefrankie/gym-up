<script lang="ts">
  import { onMount } from 'svelte';
  import { api, NetworkError } from '#lib/api/client';
  import { session } from '#lib/session';
  import { t } from '#lib/i18n';
  import { createFeedbackRequestSchema, feedbackListSchema, feedbackItemSchema, type FeedbackItemDto } from '@gym-up/contracts';
  import AppNav from '#lib/components/AppNav.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';

  let items = $state<FeedbackItemDto[]>([]);
  let title = $state('');
  let description = $state('');
  let category = $state<'idea' | 'bug' | 'other'>('idea');
  let busy = $state(false);
  let loading = $state(true);
  let canManage = $state(false);
  let error = $state('');
  let notice = $state('');

  async function refresh() {
    try {
      await session.require();
      const result = await api('/feedback', { schema: feedbackListSchema });
      items = result.items; canManage = result.canManage;
    } catch (e) {
      error = e instanceof NetworkError ? t('feedback.needsConnection') : t('feedback.loadError');
    } finally { loading = false; }
  }
  onMount(() => { void refresh(); });

  async function submit(event: SubmitEvent) {
    event.preventDefault(); error = ''; notice = '';
    const body = createFeedbackRequestSchema.safeParse({ title, description, category });
    if (!body.success) { error = t('feedback.saveError'); return; }
    busy = true;
    try {
      const created = await api('/feedback', { method: 'POST', body: body.data, schema: feedbackItemSchema });
      items = [created, ...items]; title = ''; description = ''; category = 'idea'; notice = t('feedback.saved');
    } catch { error = t('feedback.saveError'); }
    finally { busy = false; }
  }

  async function setStatus(item: FeedbackItemDto, status: FeedbackItemDto['status']) {
    try {
      const updated = await api(`/feedback/${item.id}/status`, { method: 'PATCH', body: { status }, schema: feedbackItemSchema });
      items = items.map((entry) => entry.id === updated.id ? updated : entry);
    } catch { error = t('feedback.saveError'); }
  }

  async function remove(item: FeedbackItemDto) {
    if (!confirm(t('feedback.deleteConfirm', { title: item.title }))) return;
    try {
      await api(`/feedback/${item.id}`, { method: 'DELETE' });
      items = items.filter((entry) => entry.id !== item.id);
    } catch { error = t('feedback.deleteError'); }
  }

  type View = 'pending' | 'resolved' | 'all';
  let view = $state<View>('pending');
  let categoryFilter = $state<'all' | 'idea' | 'bug' | 'other'>('all');
  const inView = (item: FeedbackItemDto) =>
    (view === 'all' || (view === 'resolved') === (item.status === 'resolved')) &&
    (categoryFilter === 'all' || item.category === categoryFilter);
  const shown = $derived(items.filter(inView));
  const count = (v: View) => items.filter((i) => v === 'all' || (v === 'resolved') === (i.status === 'resolved')).length;

  const statuses = ['open', 'planned', 'in_progress', 'resolved'] as const;
</script>

<main>
  <h1>{t('feedback.title')}</h1>
  <p class="muted lead">{t('feedback.lead')}</p>

  <section class="card">
    <h2 class="first">{t('feedback.new')}</h2>
    <form onsubmit={submit}>
      <label>{t('feedback.titleLabel')}<input bind:value={title} maxlength="120" minlength="3" required /></label>
      <label>{t('feedback.descriptionLabel')}<textarea bind:value={description} maxlength="1000" rows="3"></textarea></label>
      <label>{t('feedback.category')}<select bind:value={category}>
        <option value="idea">{t('feedback.idea')}</option><option value="bug">{t('feedback.bug')}</option><option value="other">{t('feedback.other')}</option>
      </select></label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if notice}<p class="ok" role="status">{notice}</p>{/if}
      <button class="primary" disabled={busy}>{busy ? t('common.saving') : t('feedback.submit')}</button>
    </form>
  </section>

  <section class="board" aria-label={t('feedback.title')}>
    <div class="filters" role="group" aria-label={t('feedback.filters')}>
      {#each ['pending', 'resolved', 'all'] as const as v (v)}
        <button type="button" class="chip" class:on={view === v} aria-pressed={view === v} onclick={() => (view = v)}>{t(`feedback.view.${v}`)} <span class="n">{count(v)}</span></button>
      {/each}
      <select class="cat" bind:value={categoryFilter} aria-label={t('feedback.category')}>
        <option value="all">{t('feedback.allCategories')}</option><option value="idea">{t('feedback.idea')}</option><option value="bug">{t('feedback.bug')}</option><option value="other">{t('feedback.other')}</option>
      </select>
    </div>
    {#if items.some((i) => i.canDelete)}<p class="muted hint">{t('feedback.swipeHint')}</p>{/if}
    {#if loading}<p class="muted">{t('feedback.loading')}</p>
    {:else if shown.length === 0}<p class="muted empty">{items.length ? t('feedback.emptyFilter') : t('feedback.empty')}</p>
    {:else}
      <SortableRows items={shown} key={(i) => i.id} reorderable={false} onreorder={() => {}} onremove={remove} canRemove={(i) => i.canDelete}>
        {#snippet row(item)}
        <article class="card item" class:resolved={item.status === 'resolved'}>
          <div class="top"><span class="tag">{t(`feedback.${item.category}` as Parameters<typeof t>[0])}</span><span class="status" class:done={item.status === 'resolved'}>{t(`feedback.status.${item.status}` as Parameters<typeof t>[0])}</span></div>
          <h2>{item.title}</h2>
          {#if item.description}<p class="description">{item.description}</p>{/if}
          <div class="foot"><span class="muted">{t('feedback.author', { name: item.authorName })}</span>
            {#if canManage}<label class="status-control"><select aria-label={t('feedback.ownStatus')} value={item.status} onchange={(e) => setStatus(item, e.currentTarget.value as FeedbackItemDto['status'])}>{#each statuses as status}<option value={status}>{t(`feedback.status.${status}` as Parameters<typeof t>[0])}</option>{/each}</select></label>{/if}
          </div>
        </article>
        {/snippet}
      </SortableRows>
    {/if}
  </section>
</main>
<AppNav />

<style>
  .lead { margin-top: -.45rem; margin-bottom: 1rem; }
  .first { margin: 0 0 .75rem; }
  form { display: grid; gap: .75rem; }
  textarea { resize: vertical; }
  .board { display: grid; gap: .75rem; margin: 1rem 0 6rem; }
  .item { padding: 1rem; }
  .item h2 { margin: .65rem 0 .35rem; font-size: var(--t-lg); }
  .description { margin: 0 0 .75rem; white-space: pre-wrap; overflow-wrap: anywhere; }
  .top, .foot { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
  .tag, .status { border-radius: 99px; padding: .25rem .6rem; background: var(--accent-soft); color: var(--accent-hi); font-size: var(--t-xs); }
  .status { background: var(--raised); color: var(--muted); }
  .status.done { color: var(--accent-hi); }
  .resolved { opacity: .8; }
  .foot { border-top: 1px solid var(--line); padding-top: .65rem; font-size: var(--t-sm); }
  .filters { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
  .filters .n { opacity: .7; margin-left: .2rem; }
  .cat { min-height: 40px; margin-left: auto; }
  .hint { margin: 0; font-size: var(--t-xs); }
  .status-control { display: flex; align-items: center; gap: .4rem; font-size: var(--t-xs); }
  .status-control select { min-height: 40px; padding: .25rem .5rem; }
  .empty { text-align: center; padding: 1.5rem 1rem; }
</style>
