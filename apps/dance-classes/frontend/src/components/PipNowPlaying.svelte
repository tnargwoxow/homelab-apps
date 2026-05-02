<script lang="ts">
  import { push, location } from 'svelte-spa-router';
  import { pipTrack, pipActive } from '../lib/pip';

  // Show the "now playing in PiP" bar only when:
  //   - there's a remembered track,
  //   - the browser is actually showing a PiP window,
  //   - the user is NOT on the watch route (otherwise the page itself owns
  //     the player and the bar would double up).
  let onWatchRoute = $derived(typeof $location === 'string' && $location.startsWith('/watch/'));
  let visible = $derived(!!$pipTrack && $pipActive && !onWatchRoute);

  async function exitPip() {
    const doc = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };
    if (doc.pictureInPictureElement) {
      try { await doc.exitPictureInPicture?.(); } catch { /* ignore */ }
    }
    pipTrack.set(null);
  }

  async function backToPlayer() {
    if ($pipTrack) push(`/watch/${$pipTrack.id}`);
    // Closing PiP happens naturally once the watch page mounts and starts
    // playing locally, but exit explicitly so the transition is clean.
    await exitPip();
  }
</script>

{#if visible && $pipTrack}
  {@const t = $pipTrack}
  <div
    class="fixed inset-x-2 z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl px-3 py-2 shadow-xl ring-1 backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    style="bottom: calc(env(safe-area-inset-bottom, 0) + 0.5rem);
           background: var(--theme-header-bg);
           --tw-ring-color: var(--theme-card-ring);
           border-color: var(--theme-card-ring);"
  >
    <img
      src={t.thumbUrl}
      alt=""
      loading="lazy"
      class="h-10 w-16 shrink-0 rounded-md object-cover ring-1"
      style="--tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);"
      draggable="false"
    />
    <div class="min-w-0 flex-1">
      <div class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--theme-accent);">
        🪟 Playing in mini-player
      </div>
      <div class="truncate text-sm font-medium" style="color: var(--theme-text-strong);">
        {t.title}
      </div>
    </div>
    <button
      type="button"
      class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1"
      style="background: var(--theme-accent); color: white; --tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);"
      onclick={backToPlayer}
      aria-label="Back to player"
    >↩ Player</button>
    <button
      type="button"
      class="rounded-full px-2 py-1.5 text-xs ring-1"
      style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
      onclick={exitPip}
      aria-label="Close PiP"
    >✕</button>
  </div>
{/if}
