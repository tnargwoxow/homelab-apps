<script lang="ts">
  import { activeCast, castApi, refreshCastSoon } from '../lib/cast';
  import { formatDuration } from '../lib/format';

  let busy = $state(false);
  let dragging = $state(false);
  let dragValue = $state(0);

  async function safeCall(fn: () => Promise<unknown>) {
    if (busy) return;
    busy = true;
    try { await fn(); refreshCastSoon(300); }
    catch { /* ignore */ }
    finally { busy = false; }
  }

  let session = $derived($activeCast?.session ?? null);
  let isPaused = $derived(session?.state === 'paused');
  let duration = $derived(session?.duration && session.duration > 0 ? session.duration : 0);
  let displayPos = $derived(dragging ? dragValue : (session?.position ?? 0));
  let progressPct = $derived(duration > 0 ? Math.max(0, Math.min(100, (displayPos / duration) * 100)) : 0);

  function startDrag() { dragging = true; }
  function commitDrag(value: number) {
    dragging = false;
    if ($activeCast) void safeCall(() => castApi.seek($activeCast.id, value));
  }
</script>

{#if $activeCast && session}
  <div
    class="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-2xl rounded-2xl px-4 py-3 shadow-xl ring-1 backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:bottom-4 sm:-translate-x-1/2"
    style="background: var(--theme-header-bg);
           --tw-ring-color: var(--theme-card-ring);
           border-color: var(--theme-card-ring);"
  >
    <div class="flex items-center gap-3">
      <div class="text-2xl">📺</div>
      <div class="min-w-0 flex-1">
        <div class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--theme-accent);">
          Casting to {$activeCast.name}
          <span class="ml-1" style="color: var(--theme-text-muted);">· {session.state}</span>
        </div>
        <div class="truncate text-sm font-medium" style="color: var(--theme-text-strong);">
          {session.title}
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="rounded-full px-2 py-1 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          aria-label="Back 10 seconds"
          disabled={busy}
          onclick={() => safeCall(() => castApi.seek($activeCast!.id, Math.max(0, (session?.position ?? 0) - 10)))}
        >−10s</button>

        <button
          type="button"
          class="rounded-full px-3 py-1 text-sm font-semibold ring-1"
          style="background: var(--theme-accent); color: white; --tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);"
          aria-label={isPaused ? 'Resume' : 'Pause'}
          disabled={busy}
          onclick={() => safeCall(() => isPaused ? castApi.resume($activeCast!.id) : castApi.pause($activeCast!.id))}
        >{isPaused ? '▶' : '⏸'}</button>

        <button
          type="button"
          class="rounded-full px-2 py-1 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          aria-label="Forward 10 seconds"
          disabled={busy}
          onclick={() => safeCall(() => castApi.seek($activeCast!.id, (session?.position ?? 0) + 10))}
        >+10s</button>

        <button
          type="button"
          class="ml-1 rounded-full px-2 py-1 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          aria-label="Stop casting"
          disabled={busy}
          onclick={() => safeCall(() => castApi.stop($activeCast!.id))}
        >✕</button>
      </div>
    </div>

    <!-- Volume row -->
    <div class="mt-2 flex items-center gap-1.5">
      <span class="text-base">🔊</span>
      <button
        type="button"
        class="rounded-full px-2 py-1 text-xs ring-1"
        style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
        aria-label="Volume down"
        disabled={busy}
        onclick={() => safeCall(() => castApi.adjustVolume($activeCast!.id, -0.05))}
      >−</button>
      <button
        type="button"
        class="rounded-full px-2 py-1 text-xs ring-1"
        style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
        aria-label="Volume up"
        disabled={busy}
        onclick={() => safeCall(() => castApi.adjustVolume($activeCast!.id, 0.05))}
      >+</button>
      <span class="ml-1 text-[10px]" style="color: var(--theme-text-muted);">
        TV volume · phone hardware buttons stay on phone
      </span>
    </div>

    <!-- Scrub bar: a styled <input type=range> so we get native touch +
         mouse drag for free. Local dragValue prevents the slider from
         snapping back to the polled position while the user is moving. -->
    <div class="mt-2 flex items-center gap-2">
      <span class="tabular-nums text-[11px]" style="color: var(--theme-text-muted);">
        {formatDuration(displayPos)}
      </span>
      <input
        type="range"
        min="0"
        max={duration > 0 ? duration : 1}
        step="1"
        value={displayPos}
        disabled={duration === 0}
        oninput={(e) => { dragValue = Number((e.currentTarget as HTMLInputElement).value); }}
        onpointerdown={startDrag}
        onkeydown={startDrag}
        onchange={(e) => commitDrag(Number((e.currentTarget as HTMLInputElement).value))}
        class="cast-slider flex-1"
        style="--p: {progressPct}%;"
        aria-label="Seek"
      />
      <span class="tabular-nums text-[11px]" style="color: var(--theme-text-muted);">
        {formatDuration(duration)}
      </span>
    </div>
  </div>
{/if}

<style>
  /* Themed range slider: a thin track with a colored fill up to the
     current position, plus a small round thumb. Works for both touch
     and mouse on Chromium / WebKit / Firefox. */
  .cast-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 16px;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }
  .cast-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      var(--theme-progress-from) 0%,
      var(--theme-progress-to) var(--p, 0%),
      var(--theme-card-ring) var(--p, 0%),
      var(--theme-card-ring) 100%
    );
  }
  .cast-slider::-moz-range-track {
    height: 4px;
    border-radius: 9999px;
    background: var(--theme-card-ring);
  }
  .cast-slider::-moz-range-progress {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--theme-progress-from), var(--theme-progress-to));
  }
  .cast-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: var(--theme-accent);
    border: 2px solid white;
    margin-top: -5px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .cast-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: var(--theme-accent);
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .cast-slider:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
