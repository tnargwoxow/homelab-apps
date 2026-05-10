<script lang="ts">
  import { themeId } from '../lib/stores';
  import { THEMES, THEME_ORDER, type ThemeId } from '../lib/themes';

  let open = $state(false);

  function pick(id: ThemeId) {
    themeId.set(id);
    open = false;
  }

  function onDocClick(e: MouseEvent) {
    if (!open) return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest('[data-theme-selector]')) open = false;
  }

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  });
</script>

<div class="relative" data-theme-selector>
  <button
    type="button"
    class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm shadow-sm ring-1 transition"
    style="background: var(--theme-pill-bg); color: var(--theme-pill-text);
           --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
    onclick={(e) => { e.stopPropagation(); open = !open; }}
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span aria-hidden="true">{THEMES[$themeId].emoji}</span>
    <span class="hidden sm:inline">{THEMES[$themeId].label}</span>
    <svg viewBox="0 0 20 20" class="h-3.5 w-3.5 opacity-70" fill="currentColor">
      <path d="M5.5 7.5 10 12l4.5-4.5z"/>
    </svg>
  </button>

  {#if open}
    <ul
      role="listbox"
      class="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-2xl shadow-xl ring-1"
      style="background: var(--theme-pill-bg);
             --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
    >
      {#each THEME_ORDER as id (id)}
        {@const t = THEMES[id]}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={id === $themeId}
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition"
            style={
              id === $themeId
                ? 'background: var(--theme-pill-hover); color: var(--theme-accent);'
                : 'color: var(--theme-pill-text);'
            }
            onmouseover={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-pill-hover)')}
            onmouseout={(e) => ((e.currentTarget as HTMLButtonElement).style.background = id === $themeId ? 'var(--theme-pill-hover)' : 'transparent')}
            onclick={() => pick(id)}
          >
            <span class="text-base">{t.emoji}</span>
            <span class="flex-1">
              <span class="block font-semibold">{t.label}</span>
              <span class="block text-xs opacity-70">{t.appName}</span>
            </span>
            {#if id === $themeId}
              <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M7.629 14.571 3.5 10.443l1.414-1.414 2.715 2.714 7.457-7.457 1.414 1.414z"/></svg>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
