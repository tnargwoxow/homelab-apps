<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FolderPayload, RecentItem, FavoriteItem } from '../lib/api';
  import VideoCard from '../components/VideoCard.svelte';
  import FolderCard from '../components/FolderCard.svelte';
  import Sparkle from '../components/Sparkle.svelte';
  import Squirtle from '../components/Squirtle.svelte';
  import Mew from '../components/Mew.svelte';

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
<section class="relative mb-8 overflow-hidden rounded-3xl bg-white/60 p-6 ring-1 ring-pink-200 shadow-sm sm:p-8">
  <div class="flex items-center gap-4">
    <div class="hidden sm:block">
      <Squirtle class="h-20 w-20 mimi-float" />
    </div>
    <div class="flex-1">
      <h1 class="font-display text-3xl text-fuchsia-700 sm:text-4xl">
        Welcome to Mimi's Dance Wonderland
        <Sparkle class="-mt-1 inline-block h-6 w-6 text-amber-400" />
      </h1>
      <p class="mt-1 text-sm text-fuchsia-700/80">Pick up where you left off, find a favourite, or pirouette into something new.</p>
    </div>
    <div class="hidden sm:block">
      <Mew class="h-20 w-20 mimi-bob" />
    </div>
  </div>
</section>

{#if loading}
  <div class="py-20 text-center text-fuchsia-500">Loading library…</div>
{:else if error}
  <div class="py-10 text-center text-rose-500">{error}</div>
{:else}
  {#if continueItems.length > 0}
    <section class="mb-10">
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl text-fuchsia-700">
        <Sparkle class="h-4 w-4 text-amber-400" /> Continue Watching
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
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if favorites.length > 0}
    <section class="mb-10">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="flex items-center gap-2 font-display text-2xl text-fuchsia-700">
          <span class="text-rose-400">♥</span> Your Favorites
        </h2>
        <a href="#/favorites" class="text-xs text-fuchsia-600 hover:text-fuchsia-800">See all</a>
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
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl text-fuchsia-700">
        <Sparkle class="h-4 w-4 text-amber-400" /> Recently Played
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
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if root && root.folders.length > 0}
    <section>
      <h2 class="mb-3 flex items-center gap-2 font-display text-2xl text-fuchsia-700">
        <Sparkle class="h-4 w-4 text-amber-400" /> Browse the Library
      </h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each root.folders as f (f.id)}
          <FolderCard id={f.id} name={f.name} childCount={f.childCount} thumbVideoIds={f.thumbVideoIds} />
        {/each}
      </div>
    </section>
  {:else if root && root.videos.length > 0}
    <section>
      <h2 class="mb-3 font-display text-2xl text-fuchsia-700">All Videos</h2>
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
    <div class="rounded-2xl bg-white/70 p-10 text-center text-fuchsia-700/80 ring-1 ring-pink-200">
      <div class="mx-auto mb-4 flex w-fit items-end gap-2">
        <Squirtle class="h-20 w-20" />
        <Mew class="h-20 w-20" />
      </div>
      The wonderland is empty! Make sure
      <code class="rounded bg-pink-100 px-1.5 py-0.5 text-fuchsia-700">VIDEOS_HOST_PATH</code> is set correctly.
    </div>
  {/if}
{/if}
