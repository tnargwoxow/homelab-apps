<script lang="ts">
  import { activeCast, castApi, refreshCastSoon } from '../lib/cast';
  import { formatDuration } from '../lib/format';

  let busy = $state(false);

  async function safeCall(fn: () => Promise<unknown>) {
    if (busy) return;
    busy = true;
    try { await fn(); refreshCastSoon(300); }
    catch { /* ignore */ }
    finally { busy = false; }
  }

  let session = $derived($activeCast?.session ?? null);
  let isPaused = $derived(session?.state === 'paused');
  let progress = $derived(
    session && session.duration ? Math.max(0, Math.min(1, session.position / session.duration)) : 0
  );
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
        <div class="mt-1 flex items-center gap-2 text-[11px]" style="color: var(--theme-text-muted);">
          <span class="tabular-nums">{formatDuration(session.position)}</span>
          <div class="h-1 flex-1 overflow-hidden rounded-full" style="background: var(--theme-card-ring);">
            <div class="h-full" style="width: {progress * 100}%; background: linear-gradient(90deg, var(--theme-progress-from), var(--theme-progress-to));"></div>
          </div>
          <span class="tabular-nums">{formatDuration(session.duration ?? 0)}</span>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="rounded-full px-2 py-1 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          aria-label="Back 10 seconds"
          disabled={busy}
          onclick={() => safeCall(() => castApi.seek($activeCast!.id, Math.max(0, session!.position - 10)))}
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
          onclick={() => safeCall(() => castApi.seek($activeCast!.id, session!.position + 10))}
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
  </div>
{/if}
