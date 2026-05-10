<script lang="ts">
  import QRCode from 'qrcode';
  import { onMount, untrack } from 'svelte';

  interface Props {
    open: boolean;
    videoId: number;
    position: number;       // seconds
    speed?: number;         // playbackRate
    onClose: () => void;
  }
  let { open, videoId, position, speed = 1, onClose }: Props = $props();

  const url = $derived.by(() => {
    const t = Math.max(0, Math.floor(position));
    const params = new URLSearchParams();
    if (t > 0) params.set('t', String(t));
    if (speed !== 1) params.set('speed', String(speed));
    const qs = params.toString();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#/watch/${videoId}${qs ? `?${qs}` : ''}`;
  });

  let canvas = $state<HTMLCanvasElement | null>(null);
  let copied = $state(false);

  $effect(() => {
    if (!open || !canvas) return;
    QRCode.toCanvas(canvas, url, { width: 256, margin: 1, errorCorrectionLevel: 'M' }).catch(() => {});
  });

  $effect(() => {
    if (!open) untrack(() => { copied = false; });
  });

  function fmtPos(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m}:${String(r).padStart(2, '0')}`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Fallback for non-secure contexts: select the text element instead.
      const input = document.getElementById('handoff-url-fallback') as HTMLInputElement | null;
      if (input) { input.select(); document.execCommand?.('copy'); copied = true; setTimeout(() => (copied = false), 1500); }
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
       role="dialog" aria-modal="true" aria-label="Hand off to another device">
    <button type="button"
            class="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close"
            onclick={onClose}></button>

    <div class="relative w-full max-w-md rounded-t-3xl p-6 ring-1 shadow-xl sm:rounded-3xl"
         style="background: var(--theme-card-bg);
                --tw-ring-color: var(--theme-card-ring);
                border-color: var(--theme-card-ring);">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-display text-xl" style="color: var(--theme-text-strong);">📱 Hand off</h2>
        <button type="button"
                class="rounded-full p-1.5 text-lg transition"
                style="background: var(--theme-pill-bg); color: var(--theme-pill-text);"
                onclick={onClose}
                aria-label="Close">✕</button>
      </div>

      <p class="mb-3 text-sm" style="color: var(--theme-text-muted);">
        Scan with your phone to keep watching from
        <span class="font-semibold tabular-nums" style="color: var(--theme-text-strong);">{fmtPos(position)}</span>
        {#if speed !== 1}
          <span> · {speed}× speed</span>
        {/if}
      </p>

      <div class="mb-4 flex justify-center rounded-2xl bg-white p-3">
        <canvas bind:this={canvas} class="block" width="256" height="256"></canvas>
      </div>

      <div class="mb-3">
        <input id="handoff-url-fallback"
               readonly
               value={url}
               class="w-full rounded-xl px-3 py-2 text-xs font-mono ring-1 outline-none"
               style="background: var(--theme-pill-bg);
                      color: var(--theme-text);
                      --tw-ring-color: var(--theme-pill-ring);
                      border-color: var(--theme-pill-ring);"
               onclick={(e) => (e.currentTarget as HTMLInputElement).select()} />
      </div>

      <button type="button"
              class="w-full rounded-full px-4 py-2.5 text-sm font-semibold transition"
              style="background: var(--theme-accent); color: white;"
              onclick={copy}>
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
    </div>
  </div>
{/if}
