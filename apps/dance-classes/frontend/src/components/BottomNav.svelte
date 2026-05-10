<script lang="ts">
  import { link, location } from 'svelte-spa-router';
  import { theme } from '../lib/stores';

  // Active when the current route starts with the tab's path. Watch and
  // sub-routes don't highlight any tab so the nav stays neutral while
  // playing.
  let route = $derived(typeof $location === 'string' ? $location : '/');

  interface Tab { href: string; icon: string; label: string; activeMatch: (r: string) => boolean }
  let tabs = $derived<Tab[]>([
    { href: '/',          icon: '🏠', label: 'Home',                 activeMatch: r => r === '/' },
    { href: '/favorites', icon: $theme.favoritesIcon === '★' ? '⭐' : ($theme.favoritesIcon === '🔥' ? '🔥' : '♥'),
                                       label: $theme.sections.favorites, activeMatch: r => r.startsWith('/favorites') },
    { href: '/stats',     icon: '📈', label: 'Stats',                activeMatch: r => r.startsWith('/stats') }
  ]);
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t backdrop-blur-md md:hidden"
  style="background: var(--theme-header-bg);
         border-color: var(--theme-header-ring);
         padding-bottom: env(safe-area-inset-bottom, 0);"
  aria-label="Bottom navigation"
>
  {#each tabs as t (t.href)}
    {@const active = t.activeMatch(route)}
    <a
      use:link
      href={t.href}
      class="flex flex-1 flex-col items-center justify-center py-2 text-xs"
      style={
        active
          ? `color: var(--theme-accent); background: var(--theme-pill-hover);`
          : `color: var(--theme-text-muted); background: transparent;`
      }
      aria-current={active ? 'page' : undefined}
    >
      <span class="text-xl leading-none">{t.icon}</span>
      <span class="mt-1 text-[11px] font-medium" style={active ? 'color: var(--theme-accent);' : ''}>{t.label}</span>
    </a>
  {/each}
</nav>
