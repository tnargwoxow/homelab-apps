<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FavoriteItem } from '../lib/api';
  import VideoCard from '../components/VideoCard.svelte';

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
  <h1 class="mr-auto text-2xl font-semibold text-neutral-50">Favorites</h1>
  <label class="text-sm text-neutral-400">
    Sort:
    <select bind:value={sortMode} class="ml-1 rounded bg-neutral-900 px-2 py-1 text-neutral-100 ring-1 ring-neutral-800">
      <option value="date">Recently added</option>
      <option value="title">Title</option>
    </select>
  </label>
</div>

{#if loading}
  <div class="py-10 text-center text-neutral-500">Loading…</div>
{:else if error}
  <div class="py-10 text-center text-rose-400">{error}</div>
{:else if items.length === 0}
  <div class="py-20 text-center text-neutral-500">No favorites yet. Tap the ☆ button on a video to add it.</div>
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
