<script lang="ts">
  import Router, { link } from 'svelte-spa-router';
  import { routes } from './router';
  import { libraryStatus, startStatusPolling, theme } from './lib/stores';
  import { startCastPolling } from './lib/cast';
  import { initAutoPip } from './lib/pip';
  import { onMount } from 'svelte';
  import SearchBar from './components/SearchBar.svelte';
  import BalletShoe from './components/BalletShoe.svelte';
  import FlyingStepsLogo from './components/FlyingStepsLogo.svelte';
  import Sparkle from './components/Sparkle.svelte';
  import Mascot from './components/Mascot.svelte';
  import ThemeSelector from './components/ThemeSelector.svelte';
  import CastNowPlaying from './components/CastNowPlaying.svelte';
  import PipNowPlaying from './components/PipNowPlaying.svelte';
  import WeeklyGoals from './components/WeeklyGoals.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import StatsListModal from './components/StatsListModal.svelte';

  let errorsModalOpen = $state(false);

  onMount(() => {
    initAutoPip();
    const stopStatus = startStatusPolling(7000);
    const stopCast = startCastPolling(5000);
    return () => { stopStatus(); stopCast(); };
  });
</script>

<div class="relative min-h-full w-full max-w-full overflow-hidden">
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
      <!-- min-w-0 + truncate so a long wordmark on a wide cursive font
           doesn't drag the header past the viewport on phones. -->
      <a use:link href="/" class="flex min-w-0 flex-1 items-center gap-2 sm:flex-none" style="color: var(--theme-text-strong);">
        {#if $theme.id === 'ballet'}
          <BalletShoe class="h-7 w-7 shrink-0" />
          <span class="truncate font-display text-base leading-none sm:text-2xl">{$theme.appName}</span>
        {:else if $theme.id === 'hiphop'}
          <FlyingStepsLogo class="h-7 shrink-0 sm:h-9" />
          <span class="hidden font-display text-sm leading-none tracking-wider opacity-70 lg:inline">ACADEMY</span>
        {:else}
          <span class="shrink-0 text-xl">{$theme.emoji}</span>
          <span class="truncate font-display text-base leading-none sm:text-2xl">{$theme.appName}</span>
        {/if}
      </a>
      <nav class="ml-2 hidden items-center gap-1 text-sm font-medium md:flex" style="color: var(--theme-text-strong);">
        <a use:link href="/" class="rounded-full px-3 py-1.5"
           onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
           onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>Home</a>
        <a use:link href="/favorites" class="rounded-full px-3 py-1.5"
           onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
           onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>{$theme.sections.favorites}</a>
        <a use:link href="/stats" class="rounded-full px-3 py-1.5"
           onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
           onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>📈 Stats</a>
      </nav>
      <div class="ml-auto flex min-w-0 shrink items-center gap-2 sm:max-w-md sm:flex-1">
        <div class="min-w-0 flex-1"><SearchBar /></div>
        <ThemeSelector />
      </div>
    </div>
    {#if $libraryStatus}
      {@const s = $libraryStatus}
      {#if s.scanning || s.queueDepth > 0 || s.thumbnailed < s.total || s.errored > 0}
        <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 text-xs" style="color: var(--theme-text-muted);">
          {#if s.scanning}<span>✨ Scanning library…</span>{/if}
          <span>{s.thumbnailed}/{s.total} thumbnails</span>
          {#if s.queueDepth > 0}<span>queue: {s.queueDepth}</span>{/if}
          {#if s.errored > 0}
            <button
              type="button"
              class="rounded-full px-2 py-0.5 ring-1 transition"
              style="background: rgba(244,63,94,0.12); color: #f43f5e; --tw-ring-color: rgba(244,63,94,0.4); border-color: rgba(244,63,94,0.4);"
              onclick={() => (errorsModalOpen = true)}
              aria-label="Show library errors"
            >errors: {s.errored} ›</button>
          {/if}
        </div>
      {/if}
    {/if}
  </header>

  <main class="relative mx-auto w-full max-w-full px-4 pt-4 pb-24 sm:max-w-7xl sm:pb-6">
    <WeeklyGoals />
    <Router {routes} />
  </main>

  <footer class="relative hidden border-t px-4 py-6 text-center text-xs sm:block"
          style="background: var(--theme-header-bg); border-color: var(--theme-header-ring); color: var(--theme-text-muted);">
    <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <span class="font-display text-base" style="color: var(--theme-text-strong);">{$theme.appName}</span>
      <span>· {$theme.tagline}</span>
      <span style="color: var(--theme-accent);">{$theme.favoritesIcon}</span>
      <span>· LAN-only</span>
    </div>
  </footer>

  <BottomNav />
  <CastNowPlaying />
  <PipNowPlaying />

  <StatsListModal
    open={errorsModalOpen}
    title="Library errors"
    subtitle="Files the scanner couldn't probe or thumbnail"
    source="errors"
    onClose={() => (errorsModalOpen = false)}
  />
</div>
