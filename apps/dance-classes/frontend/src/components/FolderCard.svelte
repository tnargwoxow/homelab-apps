<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { api } from '../lib/api';

  interface Props {
    id: number;
    name: string;
    childCount: number;
    thumbVideoIds?: number[];
  }
  let { id, name, childCount, thumbVideoIds = [] }: Props = $props();
</script>

<a use:link href={`/folder/${id}`} class="group block">
  <div class="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-100 via-pink-50 to-purple-100 ring-1 ring-fuchsia-200 shadow-sm transition group-hover:shadow-md group-hover:ring-fuchsia-400">
    {#if thumbVideoIds.length >= 4}
      <!-- 2x2 mosaic -->
      <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
        {#each thumbVideoIds.slice(0, 4) as vid (vid)}
          <img src={api.thumbUrl(vid)} alt="" loading="lazy" class="h-full w-full object-cover" />
        {/each}
      </div>
    {:else if thumbVideoIds.length === 3}
      <!-- 1 large left + 2 stacked right -->
      <div class="absolute inset-0 grid grid-cols-2 gap-0.5">
        <img src={api.thumbUrl(thumbVideoIds[0])} alt="" loading="lazy" class="h-full w-full object-cover" />
        <div class="grid grid-rows-2 gap-0.5">
          <img src={api.thumbUrl(thumbVideoIds[1])} alt="" loading="lazy" class="h-full w-full object-cover" />
          <img src={api.thumbUrl(thumbVideoIds[2])} alt="" loading="lazy" class="h-full w-full object-cover" />
        </div>
      </div>
    {:else if thumbVideoIds.length === 2}
      <!-- side by side -->
      <div class="absolute inset-0 grid grid-cols-2 gap-0.5">
        {#each thumbVideoIds as vid (vid)}
          <img src={api.thumbUrl(vid)} alt="" loading="lazy" class="h-full w-full object-cover" />
        {/each}
      </div>
    {:else if thumbVideoIds.length === 1}
      <img src={api.thumbUrl(thumbVideoIds[0])} alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
    {:else}
      <!-- fallback: ribbon decoration + folder icon -->
      <svg viewBox="0 0 100 60" class="absolute inset-0 h-full w-full opacity-50" preserveAspectRatio="none">
        <path d="M0 50 Q 25 30 50 45 T 100 40" fill="none" stroke="#f9a8d4" stroke-width="0.8"/>
        <path d="M0 20 Q 25 5 50 18 T 100 12" fill="none" stroke="#f0abfc" stroke-width="0.8"/>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="h-12 w-12 text-pink-400 transition group-hover:scale-110 group-hover:text-fuchsia-500" fill="currentColor">
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
      </div>
    {/if}

    <!-- soft pink overlay on hover for cohesion -->
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-fuchsia-900/15 via-transparent to-transparent"></div>

    <!-- count pill -->
    <div class="absolute bottom-1.5 right-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 shadow-sm">
      {childCount}
    </div>

    <!-- corner ribbon icon -->
    <div class="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-1 shadow-sm ring-1 ring-pink-200">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-pink-500" fill="currentColor">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    </div>
  </div>
  <div class="mt-2 line-clamp-2 text-sm font-semibold text-fuchsia-900 group-hover:text-fuchsia-700">{name}</div>
</a>
