<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { queueApi, currentQueue } from '../lib/queue';
  import type { PlaylistSummary } from '../lib/queue';
  import ClassBuilder from '../components/ClassBuilder.svelte';
  import { formatDuration } from '../lib/format';

  let lists = $state<PlaylistSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let builderOpen = $state(false);

  async function reload() {
    loading = true;
    try {
      const r = await queueApi.list();
      lists = r.playlists;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(reload);

  async function openInBuilder(p: PlaylistSummary) {
    try {
      const detail = await queueApi.get(p.id);
      currentQueue.set({ playlistId: detail.id, name: detail.name, items: detail.items, index: 0 });
      builderOpen = true;
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function onRowKey(p: PlaylistSummary, ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openInBuilder(p);
    }
  }

  async function playNow(p: PlaylistSummary, ev: Event) {
    ev.stopPropagation();
    try {
      const detail = await queueApi.get(p.id);
      if (detail.items.length === 0) return;
      currentQueue.set({ playlistId: detail.id, name: detail.name, items: detail.items, index: 0 });
      push(`/watch/${detail.items[0].id}`);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function deleteOne(p: PlaylistSummary, ev: Event) {
    ev.stopPropagation();
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await queueApi.deletePlaylist(p.id);
      lists = lists.filter(x => x.id !== p.id);
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<div class="mb-6 flex flex-wrap items-center gap-3">
  <h1 class="mr-auto font-display text-3xl sm:text-4xl" style="color: var(--theme-text-strong);">
    📋 Playlists
  </h1>
  <button
    type="button"
    class="rounded-full px-3 py-1.5 text-sm font-semibold"
    style="background: var(--theme-pill-hover); color: var(--theme-text-strong);"
    onclick={() => (builderOpen = true)}
  >Open current queue</button>
</div>

{#if loading}
  <div class="py-10 text-center" style="color: var(--theme-text-muted);">Loading…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else if lists.length === 0}
  <div class="rounded-2xl p-10 text-center ring-1"
       style="background: var(--theme-card-bg);
              color: var(--theme-text-muted);
              --tw-ring-color: var(--theme-card-ring);
              border-color: var(--theme-card-ring);">
    No saved playlists yet. Long-press a video to add it to your current queue,
    open the queue, then choose <span style="color: var(--theme-text-strong);">💾 Save as playlist</span>.
  </div>
{:else}
  <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {#each lists as p (p.id)}
      <li>
        <div
          role="button"
          tabindex="0"
          class="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition"
          style="background: var(--theme-card-bg);
                 --tw-ring-color: var(--theme-card-ring);
                 border-color: var(--theme-card-ring);"
          onclick={() => openInBuilder(p)}
          onkeydown={(e) => onRowKey(p, e)}
          onmouseover={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--theme-pill-hover)')}
          onmouseout={(e)  => ((e.currentTarget as HTMLDivElement).style.background = 'var(--theme-card-bg)')}
          onfocus={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--theme-pill-hover)')}
          onblur={(e)  => ((e.currentTarget as HTMLDivElement).style.background = 'var(--theme-card-bg)')}
        >
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
               style="background: linear-gradient(135deg, var(--theme-grad-1), var(--theme-grad-2)); color: white;">📋</div>
          <div class="min-w-0 flex-1">
            <div class="line-clamp-1 font-semibold" style="color: var(--theme-text-strong);">{p.name}</div>
            <div class="text-xs" style="color: var(--theme-text-muted);">
              {p.itemCount} {p.itemCount === 1 ? 'video' : 'videos'} · {formatDuration(p.totalSeconds)}
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
            style="background: linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2));"
            onclick={(e) => playNow(p, e)}
            aria-label="Play now"
          >▶</button>
          <button
            type="button"
            class="shrink-0 rounded-full px-2 py-1 text-sm"
            style="color: #f43f5e;"
            onclick={(e) => deleteOne(p, e)}
            aria-label="Delete playlist"
          >🗑</button>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<ClassBuilder open={builderOpen} onClose={() => (builderOpen = false)} />
