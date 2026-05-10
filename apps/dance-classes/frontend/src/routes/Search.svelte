<script lang="ts">
  import { querystring, link } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import type { SearchItem } from '../lib/api';
  import { theme } from '../lib/stores';
  import VideoCard from '../components/VideoCard.svelte';

  let q = $state('');
  let items = $state<SearchItem[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const params = new URLSearchParams($querystring ?? '');
    q = params.get('q') ?? '';
  });

  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q || q.trim().length < 2) {
      items = [];
      loading = false;
      return;
    }
    loading = true;
    error = null;
    const term = q;
    debounceTimer = setTimeout(() => {
      api.search(term)
        .then(r => { items = r.items; })
        .catch(e => { error = (e as Error).message; })
        .finally(() => { loading = false; });
    }, 250);
  });

  let folderHits = $derived(items.filter(i => i.kind === 'folder'));
  let videoHits = $derived(items.filter(i => i.kind === 'video'));
</script>

<div class="mb-6">
  <h1 class="font-display text-3xl sm:text-4xl" style="color: var(--theme-text-strong);">{$theme.search.resultsTitle}</h1>
  {#if q}
    <p class="mt-1 text-sm" style="color: var(--theme-text-muted);">Results for "<span class="font-semibold" style="color: var(--theme-text);">{q}</span>"</p>
  {/if}
</div>

{#if loading}
  <div class="py-10 text-center" style="color: var(--theme-text-muted);">Searching…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else if !q || q.trim().length < 2}
  <div class="rounded-2xl p-10 text-center ring-1"
       style="background: var(--theme-card-bg);
              color: var(--theme-text-muted);
              --tw-ring-color: var(--theme-card-ring);
              border-color: var(--theme-card-ring);">Type at least 2 characters to search.</div>
{:else if items.length === 0}
  <div class="rounded-2xl p-10 text-center ring-1"
       style="background: var(--theme-card-bg);
              color: var(--theme-text-muted);
              --tw-ring-color: var(--theme-card-ring);
              border-color: var(--theme-card-ring);">No matches.</div>
{:else}
  {#if folderHits.length > 0}
    <section class="mb-8">
      <h2 class="mb-3 text-xs font-bold uppercase tracking-wider" style="color: var(--theme-text-muted);">Folders</h2>
      <ul class="space-y-1">
        {#each folderHits as f (f.id)}
          <li>
            <a use:link href={`/folder/${f.id}`} class="block rounded-2xl px-4 py-2 ring-1 transition"
               style="background: var(--theme-card-bg);
                      --tw-ring-color: var(--theme-card-ring);
                      border-color: var(--theme-card-ring);"
               onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
               onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-card-bg)')}>
              <div class="font-semibold" style="color: var(--theme-text-strong);">{f.title}</div>
              <div class="text-xs" style="color: var(--theme-text-muted);">{f.path}</div>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if videoHits.length > 0}
    <section>
      <h2 class="mb-3 text-xs font-bold uppercase tracking-wider" style="color: var(--theme-text-muted);">Videos</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each videoHits as v (v.id)}
          {#if v.kind === 'video'}
            <VideoCard
              id={v.id}
              title={v.title}
              durationSec={v.durationSec}
              hasThumb={v.hasThumb}
              position={v.position}
              watched={v.watched}
            />
          {/if}
        {/each}
      </div>
    </section>
  {/if}
{/if}
