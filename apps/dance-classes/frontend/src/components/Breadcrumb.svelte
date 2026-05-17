<script lang="ts">
  import { link } from 'svelte-spa-router';
  import type { BreadcrumbItem } from '../lib/api';

  interface Props {
    items: BreadcrumbItem[];
    final?: string | null;
  }
  let { items, final = null }: Props = $props();

  // Crucial: in flex containers, children default to `min-width: auto`,
  // which prevents them shrinking below their content's intrinsic width
  // — so a long folder name like "Intermediate-Advanced Brazilian Zouk
  // Arthur&Sara" makes the entire layout exceed the viewport even with
  // `flex-wrap`. We force `min-width: 0` so the chip can shrink, then
  // `overflow-wrap: anywhere` lets the text break inside.
  const chipShared =
    'min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word;';
  const chipStyleActive =
    'background: var(--theme-pill-hover); color: var(--theme-text-strong); ' + chipShared;
  const chipStyleLink =
    'color: var(--theme-text-muted); ' + chipShared;
</script>

<nav class="flex max-w-full flex-wrap items-center gap-1 text-sm" style="color: var(--theme-text-muted); min-width: 0;">
  <a use:link href="/" class="rounded-full px-2 py-0.5 hover:opacity-100" style="opacity: 0.85;">Home</a>
  {#each items as item, i (item.id)}
    <span style="color: var(--theme-card-ring);">·</span>
    {#if i === items.length - 1 && !final}
      <span class="rounded-full px-2 py-0.5 font-semibold" style={chipStyleActive}>{item.name}</span>
    {:else}
      <a use:link href={`/folder/${item.id}`} class="rounded-full px-2 py-0.5" style={chipStyleLink}>
        {item.name}
      </a>
    {/if}
  {/each}
  {#if final}
    <span style="color: var(--theme-card-ring);">·</span>
    <span class="rounded-full px-2 py-0.5 font-semibold" style={chipStyleActive}>{final}</span>
  {/if}
</nav>
