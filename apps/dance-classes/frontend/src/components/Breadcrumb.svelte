<script lang="ts">
  import { link } from 'svelte-spa-router';
  import type { BreadcrumbItem } from '../lib/api';

  interface Props {
    items: BreadcrumbItem[];
    final?: string | null;
  }
  let { items, final = null }: Props = $props();
</script>

<nav class="flex flex-wrap items-center gap-1 text-sm text-fuchsia-700/80">
  <a use:link href="/" class="rounded-full px-2 py-0.5 hover:bg-pink-100 hover:text-fuchsia-700">Home</a>
  {#each items as item, i (item.id)}
    <span class="text-pink-300">·</span>
    {#if i === items.length - 1 && !final}
      <span class="rounded-full bg-pink-100 px-2 py-0.5 font-semibold text-fuchsia-800">{item.name}</span>
    {:else}
      <a use:link href={`/folder/${item.id}`} class="rounded-full px-2 py-0.5 hover:bg-pink-100 hover:text-fuchsia-700">
        {item.name}
      </a>
    {/if}
  {/each}
  {#if final}
    <span class="text-pink-300">·</span>
    <span class="rounded-full bg-pink-100 px-2 py-0.5 font-semibold text-fuchsia-800">{final}</span>
  {/if}
</nav>
