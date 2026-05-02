<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { formatDuration, progressRatio } from '../lib/format';
  import ProgressBar from './ProgressBar.svelte';

  interface Props {
    id: number;
    title: string;
    durationSec: number | null;
    hasThumb: boolean;
    position?: number;
    watched?: boolean;
    favorite?: boolean;
    episodeNum?: number | null;
  }
  let {
    id,
    title,
    durationSec,
    hasThumb,
    position = 0,
    watched = false,
    favorite = false,
    episodeNum = null
  }: Props = $props();

  let ratio = $derived(progressRatio(position, durationSec));
</script>

<a use:link href={`/watch/${id}`} class="group block">
  <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-neutral-800 transition group-hover:ring-rose-500/60">
    {#if hasThumb}
      <img
        src={api.thumbUrl(id)}
        alt={title}
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
      />
    {:else}
      <div class="absolute inset-0 flex items-center justify-center text-neutral-700">
        <svg viewBox="0 0 24 24" class="h-10 w-10" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    {/if}

    {#if watched}
      <div class="absolute right-2 top-2 rounded-full bg-emerald-500/90 p-1 text-white shadow">
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M7.629 14.571 3.5 10.443l1.414-1.414 2.715 2.714 7.457-7.457 1.414 1.414z"/></svg>
      </div>
    {/if}

    {#if favorite}
      <div class="absolute left-2 top-2 rounded-full bg-rose-500/90 p-1 text-white shadow">
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M10 18 8.55 16.7C3.4 12.04 0 8.99 0 5.5 0 2.42 2.42 0 5.5 0c1.74 0 3.41.81 4.5 2.09C11.09.81 12.76 0 14.5 0 17.58 0 20 2.42 20 5.5c0 3.49-3.4 6.54-8.55 11.2z"/></svg>
      </div>
    {/if}

    {#if durationSec}
      <div class="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-neutral-100">
        {formatDuration(durationSec)}
      </div>
    {/if}

    {#if ratio > 0 && !watched}
      <ProgressBar {ratio} />
    {/if}
  </div>
  <div class="mt-2">
    <div class="line-clamp-2 text-sm text-neutral-100 group-hover:text-white">
      {#if episodeNum !== null}<span class="text-neutral-500">{episodeNum}.</span> {/if}{title}
    </div>
  </div>
</a>
