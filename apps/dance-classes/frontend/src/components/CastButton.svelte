<script lang="ts">
  import { castDevices, castAvailable, castApi, refreshCastSoon } from '../lib/cast';

  interface Props {
    videoId: number;
    position?: number;
    onCasted?: () => void;
  }
  let { videoId, position = 0, onCasted }: Props = $props();

  let open = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function castTo(deviceId: string) {
    busy = true;
    error = null;
    try {
      await castApi.play(deviceId, videoId, position > 5 ? position : undefined);
      open = false;
      refreshCastSoon();
      onCasted?.();
    } catch (e) {
      error = (e as Error).message ?? String(e);
    } finally {
      busy = false;
    }
  }

  function onDocClick(e: MouseEvent) {
    if (!open) return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest('[data-cast-popover]')) open = false;
  }

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  });
</script>

<div class="relative" data-cast-popover>
  <button
    type="button"
    class="rounded-full px-3 py-1.5 text-sm transition ring-1 shadow-sm"
    style="background: var(--theme-pill-bg); color: var(--theme-pill-text);
           --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
    onclick={(e) => { e.stopPropagation(); open = !open; }}
  >
    📺 Cast to TV
  </button>

  {#if open}
    <!--
      Mobile: anchor to the LEFT of the button so the popover unfurls right
      and stays on-screen. Width-clamped so it never exceeds the viewport.
      Desktop (sm+): anchor to the RIGHT in a fixed 18rem column, the way
      a normal dropdown looks.
    -->
    <div
      class="absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-xl ring-1 sm:left-auto sm:right-0 sm:w-72"
      style="background: var(--theme-pill-bg);
             --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);"
    >
      <div class="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
           style="color: var(--theme-text-muted); border-bottom: 1px solid var(--theme-card-ring);">
        Cast to a Chromecast
      </div>

      {#if !$castAvailable}
        <div class="px-3 py-3 text-sm" style="color: var(--theme-text-muted);">
          Cast service didn't start. Check the server log.
        </div>
      {:else if $castDevices.length === 0}
        <div class="px-3 py-3 text-sm" style="color: var(--theme-text-muted);">
          No Chromecasts found yet. Make sure your TV is on and on the same Wi-Fi as the server.
        </div>
      {:else}
        <ul>
          {#each $castDevices as d (d.id)}
            <li>
              <button
                type="button"
                class="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition disabled:opacity-60"
                style="color: var(--theme-text);"
                disabled={busy}
                onmouseover={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-pill-hover)')}
                onmouseout={(e)  => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                onclick={() => castTo(d.id)}
              >
                <span class="flex-1 truncate">📺 {d.name}</span>
                {#if d.session}
                  <span class="ml-2 shrink-0 text-xs" style="color: var(--theme-text-muted);">in use</span>
                {:else}
                  <span class="ml-2 shrink-0 text-xs" style="color: var(--theme-accent);">play here →</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if busy}
        <div class="px-3 py-2 text-xs" style="color: var(--theme-text-muted); border-top: 1px solid var(--theme-card-ring);">
          Sending to TV…
        </div>
      {/if}

      {#if error}
        <div class="px-3 py-2 text-xs" style="color: #f43f5e; border-top: 1px solid var(--theme-card-ring); overflow-wrap: anywhere;">
          {error}
        </div>
      {/if}
    </div>
  {/if}
</div>
