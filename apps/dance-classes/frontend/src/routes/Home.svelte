<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FolderPayload, RecentItem, FavoriteItem } from '../lib/api';
  import { theme } from '../lib/stores';
  import VideoCard from '../components/VideoCard.svelte';
  import FolderCard from '../components/FolderCard.svelte';
  import Sparkle from '../components/Sparkle.svelte';
  import Mascot from '../components/Mascot.svelte';

  let root = $state<FolderPayload | null>(null);
  let continueItems = $state<RecentItem[]>([]);
  let recent = $state<RecentItem[]>([]);
  let favorites = $state<FavoriteItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const [r, c, rec, fav] = await Promise.all([
        api.rootFolder(),
        api.continueWatching(12),
        api.recent(12),
        api.favorites()
      ]);
      root = r;
      continueItems = c.items;
      recent = rec.items;
      favorites = fav.items.slice(0, 12);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<!-- Hero greeting -->
<section class="relative mb-8 overflow-hidden rounded-3xl p-6 ring-1 shadow-sm sm:p-8"
         style="background: var(--theme-card-bg);
                --tw-ring-color: var(--theme-card-ring);
                border-color: var(--theme-card-ring);
                box-shadow: var(--theme-card-shadow);">
  <div class="flex items-center gap-4">
    <div class="hidden sm:block">
      <Mascot slot="left" class="h-20 w-20 mimi-float" />
    </div>
    <div class="flex-1">
      <h1 class="font-display text-3xl sm:text-4xl" style="color: var(--theme-text-strong);">
        {$theme.welcomeTitle}
        <Sparkle class="-mt-1 inline-block h-6 w-6" />
      </h1>
      <p class="mt-1 text-sm" style="color: var(--theme-text-muted);">{$theme.welcomeBlurb}</p>
    </div>
    <div class="hidden sm:block">
      <Mascot slot="right" class="h-20 w-20 mimi-bob" />
    </div>
  </div>
</section>

{#if loading}
  <div class="py-20 text-center" style="color: var(--theme-text-muted);">Loading library…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else}
  {#if continueItems.length > 0}
    <section class="mb-10">
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl" style="color: var(--theme-text-strong);">
        <Sparkle class="h-4 w-4" /> {$theme.sections.continueWatching}
      </h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each continueItems as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
            onReset={(rid) => {
              continueItems = continueItems.filter(x => x.id !== rid);
              recent        = recent.filter(x => x.id !== rid);
            }}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if favorites.length > 0}
    <section class="mb-10">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="flex items-center gap-2 font-display text-2xl" style="color: var(--theme-text-strong);">
          <span style="color: var(--theme-accent);">{$theme.favoritesIcon}</span>
          {$theme.sections.favorites}
        </h2>
        <a href="#/favorites" class="text-xs" style="color: var(--theme-text-muted);">See all</a>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each favorites as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
            favorite={true}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if recent.length > 0}
    <section class="mb-10">
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl" style="color: var(--theme-text-strong);">
        <Sparkle class="h-4 w-4" /> {$theme.sections.recent}
      </h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each recent as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
            onReset={(rid) => {
              continueItems = continueItems.filter(x => x.id !== rid);
              recent        = recent.filter(x => x.id !== rid);
            }}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if root && root.folders.length > 0}
    <section>
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl" style="color: var(--theme-text-strong);">
        <Sparkle class="h-4 w-4" /> {$theme.sections.browse}
      </h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each root.folders as f (f.id)}
          <FolderCard id={f.id} name={f.name} childCount={f.childCount} thumbVideoIds={f.thumbVideoIds}
                      videoCount={f.videoCount} watchedCount={f.watchedCount} inProgressCount={f.inProgressCount} />
        {/each}
      </div>
    </section>
  {:else if root && root.videos.length > 0}
    <section>
      <h2 class="mb-3 font-display text-2xl" style="color: var(--theme-text-strong);">All Videos</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each root.videos as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
            favorite={v.favorite}
            episodeNum={v.episodeNum}
          />
        {/each}
      </div>
    </section>
  {:else if root}
    <div class="rounded-2xl p-10 text-center ring-1"
         style="background: var(--theme-card-bg);
                color: var(--theme-text-muted);
                --tw-ring-color: var(--theme-card-ring);
                border-color: var(--theme-card-ring);">
      <div class="mx-auto mb-4 flex w-fit items-end gap-2">
        <Mascot slot="left" class="h-20 w-20" />
        <Mascot slot="right" class="h-20 w-20" />
      </div>
      {$theme.emptyHint} Make sure
      <code class="rounded px-1.5 py-0.5"
            style="background: var(--theme-pill-hover); color: var(--theme-text-strong);">VIDEOS_HOST_PATH</code> is set correctly.
    </div>
  {/if}
{/if}
