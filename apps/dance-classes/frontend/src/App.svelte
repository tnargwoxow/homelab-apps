<script lang="ts">
  import Router, { link } from 'svelte-spa-router';
  import { routes } from './router';
  import { libraryStatus, startStatusPolling } from './lib/stores';
  import { onMount } from 'svelte';
  import SearchBar from './components/SearchBar.svelte';

  onMount(() => startStatusPolling(7000));
</script>

<div class="min-h-full">
  <header class="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
      <a use:link href="/" class="flex items-center gap-2 text-lg font-semibold text-neutral-50">
        <svg viewBox="0 0 24 24" class="h-6 w-6 text-rose-500" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Dance Classes
      </a>
      <nav class="ml-2 hidden items-center gap-1 text-sm text-neutral-300 md:flex">
        <a use:link href="/" class="rounded-full px-3 py-1.5 hover:bg-neutral-800 hover:text-white">Home</a>
        <a use:link href="/favorites" class="rounded-full px-3 py-1.5 hover:bg-neutral-800 hover:text-white">Favorites</a>
      </nav>
      <div class="ml-auto w-full max-w-md">
        <SearchBar />
      </div>
    </div>
    {#if $libraryStatus}
      {@const s = $libraryStatus}
      {#if s.scanning || s.queueDepth > 0 || s.thumbnailed < s.total}
        <div class="mx-auto max-w-7xl px-4 pb-2 text-xs text-neutral-400">
          {#if s.scanning}<span class="mr-3">Scanning library…</span>{/if}
          <span class="mr-3">{s.thumbnailed}/{s.total} thumbnails</span>
          {#if s.queueDepth > 0}<span class="mr-3">queue: {s.queueDepth}</span>{/if}
          {#if s.errored > 0}<span class="text-rose-400">errors: {s.errored}</span>{/if}
        </div>
      {/if}
    {/if}
  </header>

  <main class="mx-auto max-w-7xl px-4 py-6">
    <Router {routes} />
  </main>

  <footer class="border-t border-neutral-900 px-4 py-6 text-center text-xs text-neutral-600">
    Dance Classes · LAN-only
  </footer>
</div>
