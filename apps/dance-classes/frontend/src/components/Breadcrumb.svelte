<script lang="ts">
  import { link } from 'svelte-spa-router';
  import type { BreadcrumbItem } from '../lib/api';

  interface Props {
    items: BreadcrumbItem[];
    final?: string | null;
  }
  let { items, final = null }: Props = $props();
</script>

<nav class="flex flex-wrap items-center gap-1 text-sm" style="color: var(--theme-text-muted);">
  <a use:link href="/" class="rounded-full px-2 py-0.5 hover:opacity-100" style="opacity: 0.85;">Home</a>
  {#each items as item, i (item.id)}
    <span style="color: var(--theme-card-ring);">·</span>
    {#if i === items.length - 1 && !final}
      <span class="rounded-full px-2 py-0.5 font-semibold"
            style="background: var(--theme-pill-hover); color: var(--theme-text-strong);">{item.name}</span>
    {:else}
      <a use:link href={`/folder/${item.id}`} class="rounded-full px-2 py-0.5"
         style="color: var(--theme-text-muted);">
        {item.name}
      </a>
    {/if}
  {/each}
  {#if final}
    <span style="color: var(--theme-card-ring);">·</span>
    <span class="rounded-full px-2 py-0.5 font-semibold"
          style="background: var(--theme-pill-hover); color: var(--theme-text-strong);">{final}</span>
  {/if}
</nav>
