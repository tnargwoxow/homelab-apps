<script lang="ts">
  import { link } from 'svelte-spa-router';
  import type { BreadcrumbItem } from '../lib/api';

  interface Props {
    items: BreadcrumbItem[];
    final?: string | null;
  }
  let { items, final = null }: Props = $props();

  // Wrap-anywhere keeps long folder names from blowing out the viewport on
  // mobile (which then makes the entire page scroll horizontally).
  const chipStyleActive =
    'background: var(--theme-pill-hover); color: var(--theme-text-strong); ' +
    'overflow-wrap: anywhere; word-break: break-word; max-width: 100%;';
  const chipStyleLink =
    'color: var(--theme-text-muted); ' +
    'overflow-wrap: anywhere; word-break: break-word; max-width: 100%;';
</script>

<nav class="flex max-w-full flex-wrap items-center gap-1 text-sm" style="color: var(--theme-text-muted);">
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
