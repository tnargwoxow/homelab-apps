<script lang="ts">
  import { link } from 'svelte-spa-router';
  import type { BreadcrumbItem } from '../lib/api';

  interface Props {
    items: BreadcrumbItem[];
    final?: string | null;
  }
  let { items, final = null }: Props = $props();
</script>

<nav class="flex flex-wrap items-center gap-1 text-sm text-neutral-400">
  <a use:link href="/" class="rounded px-1.5 py-0.5 hover:bg-neutral-800 hover:text-neutral-100">Library</a>
  {#each items as item, i (item.id)}
    <span class="text-neutral-600">/</span>
    {#if i === items.length - 1 && !final}
      <span class="rounded px-1.5 py-0.5 text-neutral-100">{item.name}</span>
    {:else}
      <a use:link href={`/folder/${item.id}`} class="rounded px-1.5 py-0.5 hover:bg-neutral-800 hover:text-neutral-100">
        {item.name}
      </a>
    {/if}
  {/each}
  {#if final}
    <span class="text-neutral-600">/</span>
    <span class="rounded px-1.5 py-0.5 text-neutral-100">{final}</span>
  {/if}
</nav>
