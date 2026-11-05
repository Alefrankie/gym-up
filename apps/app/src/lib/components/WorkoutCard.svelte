<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { likeStateSchema, type CommunityWorkoutDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { deleteRequest, uploadBlob } from '#lib/api/binary';
  import { compressImage } from '#lib/image';
  import { day, forgetPhoto, photoUrl, volume, weight } from '#lib/community';
  import { exerciseName } from '#lib/exercise-name';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  let { workout, showAuthor = true }: { workout: CommunityWorkoutDto; showAuthor?: boolean } = $props();

  const SHOWN = 4;
  // The card owns a copy: likes and photo changes are local edits, and lists key cards by id.
  // svelte-ignore state_referenced_locally
  let w = $state<CommunityWorkoutDto>(structuredClone($state.snapshot(workout)) as CommunityWorkoutDto);
  let src = $state<string | null>(null);
  let photoFailed = $state(false);
  let busy = $state(false);
  let note = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let version = $state(0);

  $effect(() => {
    void version;
    if (!w.hasPhoto) {
      src = null;
      return;
    }
    let live = true;
    photoUrl(w.id)
      .then((u) => live && (src = u))
      .catch(() => live && (photoFailed = true));
    return () => {
      live = false;
    };
  });

  async function toggleLike() {
    if (busy) return;
    if (!navigator.onLine) {
      note = t('community.likeOffline');
      return;
    }
    const before = { likeCount: w.likeCount, viewerHasLiked: w.viewerHasLiked };
    const liking = !w.viewerHasLiked;
    // Optimistic: the heart answers the thumb at once and rolls back if the server refuses.
    w.viewerHasLiked = liking;
    w.likeCount += liking ? 1 : -1;
    busy = true;
    note = null;
    try {
      const state = await api(`/community/workouts/${w.id}/like`, { method: liking ? 'PUT' : 'DELETE', schema: likeStateSchema });
      w.likeCount = state.likeCount;
      w.viewerHasLiked = state.viewerHasLiked;
    } catch (e) {
      Object.assign(w, before);
      note = e instanceof NetworkError ? t('community.likeOffline') : t('community.likeError');
    } finally {
      busy = false;
    }
  }

  async function pickPhoto(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    busy = true;
    note = null;
    try {
      // Re-encoding through a canvas also drops EXIF, including location.
      const blob = await compressImage(file, 1440, 0.8);
      await uploadBlob(`/community/workouts/${w.id}/photo`, blob);
      forgetPhoto(w.id);
      photoFailed = false;
      w.hasPhoto = true;
      version += 1;
    } catch (err) {
      note = err instanceof ApiRequestError && err.status === 503 ? t('community.photoUnavailable') : t('community.photoError');
    } finally {
      busy = false;
    }
  }

  async function removePhoto() {
    busy = true;
    note = null;
    try {
      await deleteRequest(`/community/workouts/${w.id}/photo`);
      forgetPhoto(w.id);
      w.hasPhoto = false;
    } catch {
      note = t('community.photoError');
    } finally {
      busy = false;
    }
  }

  const reps = (e: CommunityWorkoutDto['exercises'][number]) => Math.round(e.reps / Math.max(1, e.sets));
</script>

<article class="post">
  <header>
    {#if showAuthor}
      <a class="who" href="/community/members/{w.author.id}">
        <Avatar name={w.author.displayName} size={40} />
        <span class="grow">
          <strong>{w.author.displayName}</strong>
          <span class="meta">{day(w.workoutDate)}{#if w.durationMinutes}{' · '}{t('community.minutes', { n: w.durationMinutes })}{/if}</span>
        </span>
      </a>
    {:else}
      <span class="meta">{day(w.workoutDate, { weekday: 'long', day: 'numeric', month: 'long' })}{#if w.durationMinutes}{' · '}{t('community.minutes', { n: w.durationMinutes })}{/if}</span>
    {/if}
    <h3>{w.dayName}</h3>
    {#if w.routineName}<p class="routine">{w.routineName}</p>{/if}
  </header>

  {#if w.hasPhoto && !photoFailed}
    <figure class="photo" class:ready={!!src}>
      {#if src}<img {src} alt={t('community.photoAlt', { name: w.author.displayName })} loading="lazy" decoding="async" />{/if}
    </figure>
  {/if}

  {#if w.exercises.length}
    <ul class="lifts">
      {#each w.exercises.slice(0, SHOWN) as e (e.exerciseId)}
        <li>
          <span class="name">{exerciseName(e.name)}</span>
          <span class="num">{e.sets} × {reps(e)}{#if e.topWeightKg}{' · '}{weight(e.topWeightKg)}{/if}</span>
        </li>
      {/each}
    </ul>
    {#if w.exercises.length > SHOWN}<p class="more">{tn('community.moreExercises', w.exercises.length - SHOWN)}</p>{/if}
  {/if}

  <footer>
    <span class="totals">
      {tn('community.sets', w.totalSets)}{#if w.volumeKg}{' · '}{t('community.volume', { v: volume(w.volumeKg) })}{/if}
    </span>
    {#if w.isMine}
      {#if w.likeCount}<span class="count"><Icon name="heart" size={18} />{w.likeCount}</span>{/if}
    {:else}
      <button
        class="like"
        class:on={w.viewerHasLiked}
        aria-pressed={w.viewerHasLiked}
        aria-label={`${t('community.like')} · ${tn('community.likes', w.likeCount)}`}
        onclick={toggleLike}
      >
        <Icon name="heart" size={22} />
        <span class="num">{w.likeCount}</span>
      </button>
    {/if}
  </footer>

  {#if w.isMine}
    <div class="own">
      <input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onchange={pickPhoto} />
      <button class="ghost" disabled={busy} onclick={() => fileInput?.click()}>
        <Icon name="camera" size={18} />
        {w.hasPhoto ? t('community.photoChange') : t('community.photoAdd')}
      </button>
      {#if w.hasPhoto}
        <button class="ghost" disabled={busy} onclick={removePhoto}>{t('community.photoRemove')}</button>
      {:else}
        <p class="meta">{t('community.photoAudience')}</p>
      {/if}
    </div>
  {/if}

  {#if note}<p class="error" role="status">{note}</p>{/if}
</article>

<style>
  .post {
    display: grid;
    gap: 0.875rem;
    padding: 1rem;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }
  header {
    display: grid;
    gap: 0.25rem;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 48px;
    margin-bottom: 0.5rem;
    color: var(--text);
    text-decoration: none;
  }
  .who .grow {
    display: grid;
    min-width: 0;
  }
  .who strong {
    font-size: var(--t-base);
    font-weight: 600;
  }
  .meta {
    color: var(--muted);
    font-size: var(--t-sm);
  }
  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    text-wrap: balance;
  }
  .routine {
    margin: 0;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .photo {
    margin: 0 -1rem;
    aspect-ratio: 4 / 5;
    background: var(--surface-hi);
    overflow: hidden;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: reveal 420ms var(--ease) both;
  }
  @keyframes reveal {
    from {
      opacity: 0;
      filter: blur(12px);
    }
  }
  .lifts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  .lifts li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--line);
    font-size: var(--t-sm);
  }
  .lifts .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .lifts .num {
    color: var(--muted);
  }
  .more {
    margin: -0.5rem 0 0;
    color: var(--faint);
    font-size: var(--t-sm);
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .totals {
    color: var(--muted);
    font-size: var(--t-sm);
    font-variant-numeric: tabular-nums;
  }
  .like {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 72px;
    min-height: 48px;
    padding: 0 1rem;
    border-radius: 999px;
    background: var(--surface-hi);
    color: var(--muted);
    transition:
      color 160ms var(--ease),
      background-color 160ms var(--ease);
  }
  .like.on {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .like.on :global(path) {
    fill: currentColor;
  }
  .like:active :global(svg) {
    transform: scale(0.88);
  }
  .like :global(svg) {
    transition: transform 160ms var(--ease);
  }
  .count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--muted);
    font-size: var(--t-sm);
    font-variant-numeric: tabular-nums;
  }
  .own {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .own button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 48px;
  }
  .own .meta {
    margin: 0;
    flex-basis: 100%;
  }
  .error {
    margin: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .photo img {
      animation: none;
    }
    .like :global(svg) {
      transition: none;
    }
  }
</style>
