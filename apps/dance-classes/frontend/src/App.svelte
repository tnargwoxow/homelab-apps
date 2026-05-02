<script lang="ts">
  import Router, { link } from 'svelte-spa-router';
  import { routes } from './router';
  import { libraryStatus, startStatusPolling, theme } from './lib/stores';
  import { onMount } from 'svelte';
  import SearchBar from './components/SearchBar.svelte';
  import BalletShoe from './components/BalletShoe.svelte';
  import Sparkle from './components/Sparkle.svelte';
  import Mascot from './components/Mascot.svelte';
  import ThemeSelector from './components/ThemeSelector.svelte';

  onMount(() => startStatusPolling(7000));
</script>

<div class="relative min-h-full overflow-hidden">
  <!-- Floating mascots: peeking from corners on larger screens -->
  <div class="pointer-events-none absolute -left-6 top-32 hidden md:block">
    <div class="mimi-float opacity-90">
      <Mascot slot="left" class="h-32 w-32 drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)]" />
    </div>
  </div>
  <div class="pointer-events-none absolute right-0 top-40 hidden md:block">
    <div class="mimi-bob opacity-90">
      <Mascot slot="right" class="h-32 w-32 drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)]" />
    </div>
  </div>

  <!-- Decorative twinkles scattered behind -->
  <div class="pointer-events-none absolute left-[12%] top-24 mimi-twinkle" style="color: var(--theme-twinkle-1);"><Sparkle class="h-5 w-5" /></div>
  <div class="pointer-events-none absolute right-[18%] top-72 mimi-twinkle" style="animation-delay:.6s; color: var(--theme-twinkle-2);"><Sparkle class="h-4 w-4" /></div>
  <div class="pointer-events-none absolute left-[40%] top-10 mimi-twinkle" style="animation-delay:1.2s; color: var(--theme-twinkle-3);"><Sparkle class="h-3 w-3" /></div>
  <div class="pointer-events-none absolute right-[30%] top-16 mimi-twinkle" style="animation-delay:1.8s; color: var(--theme-twinkle-4);"><Sparkle class="h-4 w-4" /></div>

  <header class="sticky top-0 z-30 border-b backdrop-blur-md"
          style="background: var(--theme-header-bg); border-color: var(--theme-header-ring);">
    <div class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4">
      <a use:link href="/" class="flex shrink-0 items-center gap-2" style="color: var(--theme-text-strong);">
        {#if $theme.id === 'ballet'}
          <BalletShoe class="h-7 w-7" />
        {:else if $theme.id === 'heels'}
          <span class="text-xl">{$theme.emoji}</span>
        {:else}
          <span class="text-xl">{$theme.emoji}</span>
        {/if}
        <span class="font-display text-lg leading-none sm:text-2xl">{$theme.appName}</span>
      </a>
      <nav class="ml-2 hidden items-center gap-1 text-sm font-medium md:flex" style="color: var(--theme-text-strong);">
        <a use:link href="/" class="rounded-full px-3 py-1.5"
           onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
           onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>Home</a>
        <a use:link href="/favorites" class="rounded-full px-3 py-1.5"
           onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
           onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>{$theme.sections.favorites}</a>
      </nav>
      <div class="ml-auto flex items-center gap-2 max-w-md w-full sm:w-auto sm:flex-1">
        <div class="flex-1"><SearchBar /></div>
        <ThemeSelector />
      </div>
    </div>
    {#if $libraryStatus}
      {@const s = $libraryStatus}
      {#if s.scanning || s.queueDepth > 0 || s.thumbnailed < s.total}
        <div class="mx-auto max-w-7xl px-4 pb-2 text-xs" style="color: var(--theme-text-muted);">
          {#if s.scanning}<span class="mr-3">✨ Scanning library…</span>{/if}
          <span class="mr-3">{s.thumbnailed}/{s.total} thumbnails</span>
          {#if s.queueDepth > 0}<span class="mr-3">queue: {s.queueDepth}</span>{/if}
          {#if s.errored > 0}<span style="color: var(--theme-accent-2);">errors: {s.errored}</span>{/if}
        </div>
      {/if}
    {/if}
  </header>

  <main class="relative mx-auto max-w-7xl px-4 py-6">
    <Router {routes} />
  </main>

  <footer class="relative border-t px-4 py-6 text-center text-xs"
          style="background: var(--theme-header-bg); border-color: var(--theme-header-ring); color: var(--theme-text-muted);">
    <span class="font-display text-base" style="color: var(--theme-text-strong);">{$theme.appName}</span>
    <span class="mx-1">·</span> {$theme.tagline}
    <span style="color: var(--theme-accent);">{$theme.favoritesIcon}</span>
    <span class="mx-1">·</span> LAN-only
  </footer>
</div>
