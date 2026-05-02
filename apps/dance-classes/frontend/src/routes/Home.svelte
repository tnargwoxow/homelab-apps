<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FolderPayload, RecentItem, FavoriteItem } from '../lib/api';
  import VideoCard from '../components/VideoCard.svelte';
  import FolderCard from '../components/FolderCard.svelte';

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

{#if loading}
  <div class="py-20 text-center text-neutral-500">Loading library…</div>
{:else if error}
  <div class="py-10 text-center text-rose-400">{error}</div>
{:else}
  {#if continueItems.length > 0}
    <section class="mb-10">
      <h2 class="mb-3 text-lg font-semibold text-neutral-100">Continue Watching</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each continueItems as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if favorites.length > 0}
    <section class="mb-10">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-lg font-semibold text-neutral-100">Favorites</h2>
        <a href="#/favorites" class="text-xs text-neutral-400 hover:text-neutral-200">See all</a>
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
      <h2 class="mb-3 text-lg font-semibold text-neutral-100">Recently Played</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each recent as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if root && root.folders.length > 0}
    <section>
      <h2 class="mb-3 text-lg font-semibold text-neutral-100">Browse Library</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each root.folders as f (f.id)}
          <FolderCard id={f.id} name={f.name} childCount={f.childCount} />
        {/each}
      </div>
    </section>
  {:else if root && root.videos.length > 0}
    <section>
      <h2 class="mb-3 text-lg font-semibold text-neutral-100">All Videos</h2>
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
    <div class="py-20 text-center text-neutral-500">
      Library is empty. Make sure <code class="rounded bg-neutral-900 px-1.5 py-0.5">VIDEOS_HOST_PATH</code> is set correctly.
    </div>
  {/if}
{/if}
