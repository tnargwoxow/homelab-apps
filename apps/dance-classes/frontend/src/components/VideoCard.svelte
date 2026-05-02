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
    /** Called after a successful progress reset so the parent can drop the
     *  card from "Continue Watching" / "Recently Played" without a refetch. */
    onReset?: (id: number) => void;
  }
  let {
    id,
    title,
    durationSec,
    hasThumb,
    position = 0,
    watched = false,
    favorite = false,
    episodeNum = null,
    onReset
  }: Props = $props();

  let ratio = $derived(progressRatio(position, durationSec));
  let hasProgress = $derived(position > 5 || watched);
  let resetting = $state(false);

  async function handleReset(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (resetting) return;
    resetting = true;
    try {
      await api.resetProgress(id);
      onReset?.(id);
    } catch {
      /* idempotent on the backend; silent failure is fine */
    } finally {
      resetting = false;
    }
  }
</script>

<!--
  The reset button must NOT live inside the <a>: svelte-spa-router's
  link action attaches a click listener on the anchor that fires
  unconditionally on bubbled clicks even when we stopPropagation in
  the inner handler (a known quirk on touch browsers). Making the
  button a sibling of the anchor — both absolutely positioned inside
  the same wrapper — bypasses propagation entirely.
-->
<div class="group relative block">
  <a use:link href={`/watch/${id}`} class="block">
    <div
      class="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 shadow-sm transition group-hover:shadow-md"
      style="background: var(--theme-card-bg);
             --tw-ring-color: var(--theme-card-ring);
             border-color: var(--theme-card-ring);
             box-shadow: var(--theme-card-shadow);"
      onmouseover={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--theme-card-shadow-h)'; (e.currentTarget as HTMLDivElement).style.setProperty('--tw-ring-color', 'var(--theme-card-ring-hover)'); }}
      onmouseout={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--theme-card-shadow)'; (e.currentTarget as HTMLDivElement).style.setProperty('--tw-ring-color', 'var(--theme-card-ring)'); }}
    >
      {#if hasThumb}
        <img
          src={api.thumbUrl(id)}
          alt={title}
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      {:else}
        <div class="absolute inset-0 flex items-center justify-center" style="color: var(--theme-card-ring);">
          <svg viewBox="0 0 24 24" class="h-10 w-10" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      {/if}

      {#if watched}
        <div class="absolute right-2 top-2 rounded-full bg-emerald-400 p-1 text-white shadow ring-2 ring-white">
          <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M7.629 14.571 3.5 10.443l1.414-1.414 2.715 2.714 7.457-7.457 1.414 1.414z"/></svg>
        </div>
      {/if}

      {#if favorite}
        <div class="absolute left-2 top-2 rounded-full p-1 text-white shadow ring-2 ring-white" style="background: var(--theme-accent);">
          <svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="currentColor"><path d="M10 18 8.55 16.7C3.4 12.04 0 8.99 0 5.5 0 2.42 2.42 0 5.5 0c1.74 0 3.41.81 4.5 2.09C11.09.81 12.76 0 14.5 0 17.58 0 20 2.42 20 5.5c0 3.49-3.4 6.54-8.55 11.2z"/></svg>
        </div>
      {/if}

      {#if durationSec}
        <div class="absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm"
             style="background: var(--theme-pill-bg); color: var(--theme-text-strong);">
          {formatDuration(durationSec)}
        </div>
      {/if}

      {#if ratio > 0 && !watched}
        <ProgressBar {ratio} />
      {/if}
    </div>
    <div class="mt-2">
      <div class="line-clamp-2 text-sm font-medium" style="color: var(--theme-text);">
        {#if episodeNum !== null}<span class="mr-1" style="color: var(--theme-text-muted);">{episodeNum}.</span>{/if}{title}
      </div>
    </div>
  </a>

  {#if hasProgress}
    <!-- Sibling of the anchor, NOT a descendant. Sized larger than the
         old version so it's a comfortable touch target. -->
    <button
      type="button"
      class="absolute bottom-7 left-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition disabled:opacity-50"
      style="background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);"
      disabled={resetting}
      aria-label="Remove from history"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={handleReset}
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>
  {/if}
</div>
