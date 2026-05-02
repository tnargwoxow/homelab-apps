<script lang="ts">
  import { link } from 'svelte-spa-router';

  interface Props {
    id: number;
    name: string;
    childCount: number;
  }
  let { id, name, childCount }: Props = $props();
</script>

<a use:link href={`/folder/${id}`} class="group block">
  <div class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-neutral-900 to-neutral-800 ring-1 ring-neutral-800 transition group-hover:ring-rose-500/60">
    <svg viewBox="0 0 24 24" class="h-12 w-12 text-neutral-600 transition group-hover:text-rose-400" fill="currentColor">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
    <div class="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-neutral-200">
      {childCount}
    </div>
  </div>
  <div class="mt-2 line-clamp-2 text-sm font-medium text-neutral-100 group-hover:text-white">{name}</div>
</a>
