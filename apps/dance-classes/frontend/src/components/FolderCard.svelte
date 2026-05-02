<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import ProgressBar from './ProgressBar.svelte';

  interface Props {
    id: number;
    name: string;
    childCount: number;
    thumbVideoIds?: number[];
    videoCount?: number;
    watchedCount?: number;
    inProgressCount?: number;
  }
  let {
    id, name, childCount, thumbVideoIds = [],
    videoCount = 0, watchedCount = 0, inProgressCount = 0
  }: Props = $props();

  const ratio = $derived(videoCount > 0 ? watchedCount / videoCount : 0);
</script>

<a use:link href={`/folder/${id}`} class="group block">
  <div
    class="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 shadow-sm transition group-hover:shadow-md"
    style="background: var(--theme-card-bg);
           --tw-ring-color: var(--theme-card-ring);
           border-color: var(--theme-card-ring);
           box-shadow: var(--theme-card-shadow);"
    onmouseover={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--theme-card-shadow-h)'; (e.currentTarget as HTMLDivElement).style.setProperty('--tw-ring-color', 'var(--theme-card-ring-hover)'); }}
    onmouseout={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--theme-card-shadow)'; (e.currentTarget as HTMLDivElement).style.setProperty('--tw-ring-color', 'var(--theme-card-ring)'); }}
  >
    {#if thumbVideoIds.length >= 4}
      <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        {#each thumbVideoIds.slice(0, 4) as vid (vid)}
          <img src={api.thumbUrl(vid)} alt="" loading="lazy" class="h-full w-full object-cover" />
        {/each}
      </div>
    {:else if thumbVideoIds.length === 3}
      <div class="absolute inset-0 grid grid-cols-2 gap-0.5">
        <img src={api.thumbUrl(thumbVideoIds[0])} alt="" loading="lazy" class="h-full w-full object-cover" />
        <div class="grid grid-rows-2 gap-0.5">
          <img src={api.thumbUrl(thumbVideoIds[1])} alt="" loading="lazy" class="h-full w-full object-cover" />
          <img src={api.thumbUrl(thumbVideoIds[2])} alt="" loading="lazy" class="h-full w-full object-cover" />
        </div>
      </div>
    {:else if thumbVideoIds.length === 2}
      <div class="absolute inset-0 grid grid-cols-2 gap-0.5">
        {#each thumbVideoIds as vid (vid)}
          <img src={api.thumbUrl(vid)} alt="" loading="lazy" class="h-full w-full object-cover" />
        {/each}
      </div>
    {:else if thumbVideoIds.length === 1}
      <img src={api.thumbUrl(thumbVideoIds[0])} alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
    {:else}
      <svg viewBox="0 0 100 60" class="absolute inset-0 h-full w-full opacity-50" preserveAspectRatio="none">
        <path d="M0 50 Q 25 30 50 45 T 100 40" fill="none" stroke="var(--theme-card-ring)" stroke-width="0.8"/>
        <path d="M0 20 Q 25 5 50 18 T 100 12"  fill="none" stroke="var(--theme-card-ring)" stroke-width="0.8"/>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="h-12 w-12 transition group-hover:scale-110" style="color: var(--theme-accent);" fill="currentColor">
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
      </div>
    {/if}

    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent"></div>

    {#if videoCount > 0}
      <div class="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm tabular-nums"
           style="background: var(--theme-pill-bg); color: var(--theme-text-strong);"
           title={`${watchedCount} of ${videoCount} watched${inProgressCount ? `, ${inProgressCount} in progress` : ''}`}>
        {watchedCount}/{videoCount}
      </div>
      <ProgressBar {ratio} />
    {/if}

    <div class="absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm"
         style="background: var(--theme-pill-bg); color: var(--theme-text-strong);">
      {childCount}
    </div>

    <div class="absolute left-1.5 top-1.5 rounded-full px-1.5 py-1 shadow-sm ring-1"
         style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" style="color: var(--theme-accent);" fill="currentColor">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    </div>
  </div>
  <div class="mt-2 line-clamp-2 text-sm font-semibold" style="color: var(--theme-text);">{name}</div>
</a>
