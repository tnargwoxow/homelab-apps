<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FavoriteItem } from '../lib/api';
  import VideoCard from '../components/VideoCard.svelte';
  import Mew from '../components/Mew.svelte';

  let items = $state<FavoriteItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let sortMode = $state<'date' | 'title'>('date');

  let sorted = $derived(
    sortMode === 'title'
      ? [...items].sort((a, b) => a.title.localeCompare(b.title))
      : items
  );

  onMount(async () => {
    try {
      const r = await api.favorites();
      items = r.items;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="mb-6 flex flex-wrap items-center gap-3">
  <h1 class="mr-auto font-display text-3xl text-fuchsia-700 sm:text-4xl">♥ Favorites</h1>
  <label class="text-sm text-fuchsia-700/80">
    Sort:
    <select bind:value={sortMode} class="ml-1 rounded-full border border-pink-200 bg-white px-3 py-1 text-fuchsia-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200">
      <option value="date">Recently added</option>
      <option value="title">Title</option>
    </select>
  </label>
</div>

{#if loading}
  <div class="py-10 text-center text-fuchsia-500">Loading…</div>
{:else if error}
  <div class="py-10 text-center text-rose-500">{error}</div>
{:else if items.length === 0}
  <div class="rounded-2xl bg-white/70 p-10 text-center text-fuchsia-700/80 ring-1 ring-pink-200">
    <Mew class="mx-auto mb-3 h-24 w-24 mimi-bob" />
    No favorites yet. Tap the ♡ button on a video to add it.
  </div>
{:else}
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {#each sorted as v (v.id)}
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
{/if}
