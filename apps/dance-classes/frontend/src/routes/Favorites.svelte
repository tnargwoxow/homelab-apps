<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FavoriteItem } from '../lib/api';
  import { theme } from '../lib/stores';
  import VideoCard from '../components/VideoCard.svelte';
  import Mascot from '../components/Mascot.svelte';

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
  <h1 class="mr-auto font-display text-3xl sm:text-4xl" style="color: var(--theme-text-strong);">
    <span style="color: var(--theme-accent);">{$theme.favoritesIcon}</span>
    {$theme.sections.favorites}
  </h1>
  <label class="text-sm" style="color: var(--theme-text-muted);">
    Sort:
    <select bind:value={sortMode}
      class="ml-1 rounded-full px-3 py-1 outline-none ring-1"
      style="background: var(--theme-pill-bg);
             color: var(--theme-text);
             --tw-ring-color: var(--theme-pill-ring);
             border-color: var(--theme-pill-ring);">
      <option value="date">Recently added</option>
      <option value="title">Title</option>
    </select>
  </label>
</div>

{#if loading}
  <div class="py-10 text-center" style="color: var(--theme-text-muted);">Loading…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else if items.length === 0}
  <div class="rounded-2xl p-10 text-center ring-1"
       style="background: var(--theme-card-bg);
              color: var(--theme-text-muted);
              --tw-ring-color: var(--theme-card-ring);
              border-color: var(--theme-card-ring);">
    <Mascot slot="right" class="mx-auto mb-3 h-24 w-24 mimi-bob" />
    No favorites yet. Tap the {$theme.favoritesIcon} button on a video to add it.
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
