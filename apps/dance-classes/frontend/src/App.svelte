<script lang="ts">
  import Router, { link } from 'svelte-spa-router';
  import { routes } from './router';
  import { libraryStatus, startStatusPolling } from './lib/stores';
  import { onMount } from 'svelte';
  import SearchBar from './components/SearchBar.svelte';
  import BalletShoe from './components/BalletShoe.svelte';
  import Sparkle from './components/Sparkle.svelte';
  import Squirtle from './components/Squirtle.svelte';
  import Mew from './components/Mew.svelte';

  onMount(() => startStatusPolling(7000));
</script>

<div class="relative min-h-full overflow-hidden">
  <!-- Floating mascots: peeking from corners on larger screens -->
  <div class="pointer-events-none absolute -left-6 top-32 hidden md:block">
    <div class="mimi-float opacity-90">
      <Squirtle class="h-32 w-32 drop-shadow-[0_8px_18px_rgba(236,72,153,0.25)]" />
    </div>
  </div>
  <div class="pointer-events-none absolute right-0 top-40 hidden md:block">
    <div class="mimi-bob opacity-90">
      <Mew class="h-32 w-32 drop-shadow-[0_8px_18px_rgba(168,85,247,0.25)]" />
    </div>
  </div>

  <!-- Decorative twinkles scattered behind -->
  <div class="pointer-events-none absolute left-[12%] top-24 text-pink-300 mimi-twinkle"><Sparkle class="h-5 w-5" /></div>
  <div class="pointer-events-none absolute right-[18%] top-72 text-fuchsia-300 mimi-twinkle" style="animation-delay:.6s"><Sparkle class="h-4 w-4" /></div>
  <div class="pointer-events-none absolute left-[40%] top-10 text-rose-300 mimi-twinkle" style="animation-delay:1.2s"><Sparkle class="h-3 w-3" /></div>
  <div class="pointer-events-none absolute right-[30%] top-16 text-purple-300 mimi-twinkle" style="animation-delay:1.8s"><Sparkle class="h-4 w-4" /></div>

  <header class="sticky top-0 z-30 border-b border-pink-200/60 bg-white/70 backdrop-blur-md">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4">
      <a use:link href="/" class="flex shrink-0 items-center gap-2 text-fuchsia-700">
        <BalletShoe class="h-7 w-7" />
        <span class="font-display text-xl leading-none text-fuchsia-700 sm:text-2xl">Mimi's Dance Wonderland</span>
      </a>
      <nav class="ml-2 hidden items-center gap-1 text-sm font-medium text-fuchsia-700 md:flex">
        <a use:link href="/" class="rounded-full px-3 py-1.5 hover:bg-pink-100">Home</a>
        <a use:link href="/favorites" class="rounded-full px-3 py-1.5 hover:bg-pink-100">Favorites</a>
      </nav>
      <div class="ml-auto w-full max-w-md">
        <SearchBar />
      </div>
    </div>
    {#if $libraryStatus}
      {@const s = $libraryStatus}
      {#if s.scanning || s.queueDepth > 0 || s.thumbnailed < s.total}
        <div class="mx-auto max-w-7xl px-4 pb-2 text-xs text-fuchsia-700/80">
          {#if s.scanning}<span class="mr-3">✨ Scanning library…</span>{/if}
          <span class="mr-3">{s.thumbnailed}/{s.total} thumbnails</span>
          {#if s.queueDepth > 0}<span class="mr-3">queue: {s.queueDepth}</span>{/if}
          {#if s.errored > 0}<span class="text-rose-500">errors: {s.errored}</span>{/if}
        </div>
      {/if}
    {/if}
  </header>

  <main class="relative mx-auto max-w-7xl px-4 py-6">
    <Router {routes} />
  </main>

  <footer class="relative border-t border-pink-200/60 bg-white/40 px-4 py-6 text-center text-xs text-fuchsia-700/80">
    <span class="font-display text-base text-fuchsia-700">Mimi's Dance Wonderland</span>
    <span class="mx-1">·</span> made with
    <span class="text-rose-500">♥</span>
    <span class="mx-1">·</span> LAN-only
  </footer>
</div>
