<script lang="ts">
  // Floating self-review tile.
  //
  // Mirrors the front-facing webcam back at the dancer (so they can spot-check
  // form mid-class), records short clips with MediaRecorder, persists them in
  // IndexedDB scoped per video, and exposes a "compare" mode that hands the
  // selected clip up to the parent for side-by-side replay.
  //
  // Everything lives client-side. There is no upload path — even the thumbnail
  // strip is rendered from data URLs stored alongside each clip.

  import { onDestroy } from 'svelte';
  import {
    addRecording,
    deleteRecording,
    getRecording,
    listRecordings,
    pruneOldest,
    type RecordingMeta
  } from '../lib/selfReviewDb';

  interface Props {
    videoId: number | undefined;
    visible: boolean;
    compareMode: boolean;
    onCompareToggle: (next: boolean) => void;
    onSelectClipBlob: (blob: Blob | null) => void;
    onClose?: () => void;
    syncReplay?: boolean;
  }

  let {
    videoId,
    visible,
    compareMode,
    onCompareToggle,
    onSelectClipBlob,
    onClose,
    syncReplay = $bindable(true)
  }: Props = $props();

  // ---- constants -------------------------------------------------------------
  const MAX_CLIPS_PER_VIDEO = 5;
  const MAX_CLIP_SECONDS = 300;
  const CODEC_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'];

  // ---- state -----------------------------------------------------------------
  type Mode = 'off' | 'mirror' | 'record' | 'compare';
  let mode = $state<Mode>('mirror');
  let corner = $state<'tl' | 'tr' | 'bl' | 'br'>('br');
  let opacity = $state(1);
  let tileSize = $state<'small' | 'medium' | 'large'>('medium');
  let clips = $state<RecordingMeta[]>([]);
  let selectedClipId = $state<string | null>(null);
  let recordingError = $state<string | null>(null);
  let permissionError = $state<string | null>(null);
  let recElapsedSec = $state(0);
  let storageError = $state<string | null>(null);
  let showClips = $state(true);

  // refs to non-reactive plumbing
  let liveVideoEl: HTMLVideoElement | null = $state(null);
  let canvasEl: HTMLCanvasElement | null = $state(null);
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let chosenMime: string | null = null;
  let recTimer: ReturnType<typeof setInterval> | null = null;
  let recStartedAt = 0;

  // Detect codec support once. If nothing matches, recording is disabled.
  function pickMime(): string | null {
    const MR = (typeof window !== 'undefined') ? window.MediaRecorder : undefined;
    if (!MR || typeof MR.isTypeSupported !== 'function') return null;
    for (const m of CODEC_CANDIDATES) {
      try {
        if (MR.isTypeSupported(m)) return m;
      } catch { /* keep walking */ }
    }
    return null;
  }
  let recordSupported = $derived(typeof window !== 'undefined' && !!window.MediaRecorder && pickMime() !== null);

  // ---- camera lifecycle ------------------------------------------------------
  async function startCamera() {
    if (stream) return;
    permissionError = null;
    // Browsers gate `navigator.mediaDevices` to secure contexts. Plain http://
    // on a LAN IP (the typical homelab case) leaves it undefined entirely, so
    // we have to guard before reaching for `.getUserMedia`.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      permissionError = isSecure
        ? 'Camera not supported in this browser.'
        : 'Camera blocked: browsers only allow camera access on https:// or http://localhost. Open via https or, on Chrome desktop, allow this origin in chrome://flags/#unsafely-treat-insecure-origin-as-secure (then restart Chrome).';
      mode = 'off';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // The video element may not be mounted yet on the first $effect run.
      // The other effect below will attach when liveVideoEl appears.
      if (liveVideoEl) {
        liveVideoEl.srcObject = stream;
        liveVideoEl.play().catch(() => { /* may need user gesture */ });
      }
    } catch (err) {
      const e = err as Error;
      permissionError = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Enable it in browser settings to mirror.'
        : `Camera unavailable: ${e?.message ?? 'unknown error'}`;
      mode = 'off';
      stream = null;
    }
  }

  function stopCamera() {
    abortRecorder();
    if (stream) {
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    }
    stream = null;
    if (liveVideoEl) {
      try { liveVideoEl.srcObject = null; } catch { /* ignore */ }
    }
  }

  // Start / stop camera tracks based on visibility and mode.
  $effect(() => {
    if (visible && mode !== 'off') {
      void startCamera();
    } else {
      stopCamera();
    }
  });

  // Once the <video> element mounts (or remounts after a hide/show toggle),
  // wire it to whatever stream is current.
  $effect(() => {
    if (liveVideoEl && stream) {
      try {
        liveVideoEl.srcObject = stream;
        liveVideoEl.play().catch(() => { /* ignore */ });
      } catch { /* ignore */ }
    }
  });

  // ---- clips list ------------------------------------------------------------
  async function refreshClips() {
    if (videoId === undefined) { clips = []; return; }
    try {
      clips = await listRecordings(videoId);
    } catch {
      clips = [];
    }
  }

  // Reload the clip strip whenever the video changes. The previously selected
  // clip belongs to the previous video, so drop it.
  $effect(() => {
    void videoId;
    selectedClipId = null;
    void refreshClips();
  });

  // ---- recording -------------------------------------------------------------
  function abortRecorder() {
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* ignore */ }
    }
    recorder = null;
    chunks = [];
    chosenMime = null;
    recElapsedSec = 0;
  }

  async function captureThumbnail(): Promise<string> {
    if (!liveVideoEl || !canvasEl) return '';
    const w = 160;
    const h = 90;
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return '';
    try {
      // Mirror the thumbnail to match the on-screen preview.
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(liveVideoEl, 0, 0, w, h);
      ctx.restore();
      return canvasEl.toDataURL('image/webp', 0.7);
    } catch {
      return '';
    }
  }

  async function startRecording() {
    if (!stream || videoId === undefined) return;
    if (recorder) return;
    recordingError = null;
    storageError = null;
    const mime = pickMime();
    if (!mime) {
      recordingError = 'Recording not supported on this browser; mirror still works.';
      return;
    }
    chosenMime = mime;
    chunks = [];
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (err) {
      recordingError = `Could not start recorder: ${(err as Error).message ?? 'unknown'}`;
      recorder = null;
      return;
    }
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = () => { void finalizeRecording(); };
    recStartedAt = Date.now();
    recElapsedSec = 0;
    recTimer = setInterval(() => {
      recElapsedSec = Math.floor((Date.now() - recStartedAt) / 1000);
      if (recElapsedSec >= MAX_CLIP_SECONDS) stopRecording();
    }, 250);
    recorder.start(1000);
    mode = 'record';
  }

  function stopRecording() {
    if (!recorder) return;
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    try { recorder.stop(); } catch { /* ignore */ }
  }

  async function finalizeRecording() {
    const localChunks = chunks;
    const localMime = chosenMime ?? 'video/webm';
    const dur = recElapsedSec;
    const thumb = await captureThumbnail();
    chunks = [];
    recorder = null;
    chosenMime = null;
    recElapsedSec = 0;
    mode = 'mirror';
    if (videoId === undefined || localChunks.length === 0) return;
    const blob = new Blob(localChunks, { type: localMime });
    try {
      await addRecording(videoId, blob, dur, thumb);
      await pruneOldest(videoId, MAX_CLIPS_PER_VIDEO);
      await refreshClips();
    } catch (err) {
      storageError = (err as Error).message ?? 'Could not save clip.';
    }
  }

  // ---- compare ---------------------------------------------------------------
  async function toggleCompare() {
    if (compareMode) {
      onCompareToggle(false);
      onSelectClipBlob(null);
      return;
    }
    if (!selectedClipId) return;
    const row = await getRecording(selectedClipId);
    if (!row) return;
    onSelectClipBlob(row.blob);
    onCompareToggle(true);
  }

  function selectClip(id: string) {
    selectedClipId = (selectedClipId === id) ? null : id;
  }

  async function removeClip(id: string, e: Event) {
    e.stopPropagation();
    await deleteRecording(id);
    if (selectedClipId === id) {
      selectedClipId = null;
      if (compareMode) {
        onCompareToggle(false);
        onSelectClipBlob(null);
      }
    }
    await refreshClips();
  }

  // ---- teardown --------------------------------------------------------------
  onDestroy(() => {
    stopCamera();
  });

  // ---- formatting helpers ----------------------------------------------------
  function fmtClock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
  function fmtDate(ts: number): string {
    try { return new Date(ts).toLocaleString(); } catch { return ''; }
  }

  // ---- layout ----------------------------------------------------------------
  let cornerStyle = $derived.by(() => {
    const offset = '1rem';
    const v = corner[0] === 't' ? `top: ${offset};` : `bottom: ${offset};`;
    const h = corner[1] === 'l' ? `left: ${offset};` : `right: ${offset};`;
    return `${v} ${h}`;
  });
  let widthStyle = $derived.by(() => {
    const w = tileSize === 'small' ? 200 : tileSize === 'large' ? 360 : 280;
    return `width: ${w}px;`;
  });

  let recordDisabled = $derived(mode === 'off' || !stream || videoId === undefined || !recordSupported);
</script>

{#if visible}
  <div
    class="fixed z-30 select-none rounded-2xl ring-2 shadow-2xl"
    style="{cornerStyle} {widthStyle} background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring); opacity: {opacity};"
    aria-label="Self-review tile"
  >
    <!-- header -->
    <div class="flex items-center justify-between gap-2 rounded-t-2xl px-3 py-2"
         style="background: var(--theme-pill-bg); border-bottom: 1px solid var(--theme-card-ring);">
      <span class="text-xs font-semibold" style="color: var(--theme-text-strong);">
        {#if mode === 'record'}
          <span class="inline-block h-2 w-2 animate-pulse rounded-full" style="background:#ef4444;"></span>
          REC {fmtClock(recElapsedSec)}
        {:else}
          📷 Self-review
        {/if}
      </span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="rounded-full px-2 py-0.5 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          onclick={() => (tileSize = tileSize === 'small' ? 'medium' : tileSize === 'medium' ? 'large' : 'small')}
          title="Cycle tile size"
        >{tileSize === 'small' ? 'S' : tileSize === 'medium' ? 'M' : 'L'}</button>
        <button
          type="button"
          class="rounded-full px-2 py-0.5 text-xs ring-1"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
          onclick={() => onClose?.()}
          title="Hide tile"
          aria-label="Close self-review"
        >✕</button>
      </div>
    </div>

    <!-- live video -->
    <div class="relative bg-black">
      {#if permissionError}
        <div class="aspect-video w-full p-3 text-center text-xs"
             style="color: var(--theme-text);">
          {permissionError}
        </div>
      {:else}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={liveVideoEl}
          autoplay
          muted
          playsinline
          class="aspect-video w-full"
          style="transform: scaleX(-1); background:#000;"
        ></video>
      {/if}
    </div>

    <!-- footer / controls -->
    <div class="flex flex-col gap-2 p-2">
      <!-- record + compare row -->
      <div class="flex flex-wrap items-center gap-1">
        {#if mode === 'record'}
          <button
            type="button"
            class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow"
            style="background:#ef4444;"
            onclick={stopRecording}
          >■ Stop</button>
        {:else}
          <button
            type="button"
            class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50"
            style={recordDisabled
              ? 'background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);'
              : 'background:#ef4444; color:#fff; --tw-ring-color:#ef4444; border-color:#ef4444;'}
            disabled={recordDisabled}
            title={recordSupported ? 'Record up to 5 minutes' : 'Not supported on this browser'}
            onclick={startRecording}
          >● Record</button>
        {/if}

        <button
          type="button"
          class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50"
          style={compareMode
            ? 'background: var(--theme-accent); color:#fff; --tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);'
            : 'background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);'}
          disabled={!compareMode && !selectedClipId}
          onclick={toggleCompare}
          title={compareMode ? 'Stop comparing' : 'Compare selected clip'}
        >↔ {compareMode ? 'Stop' : 'Compare'}</button>
      </div>

      {#if compareMode}
        <label class="flex items-center gap-2 text-xs" style="color: var(--theme-text);">
          <input type="checkbox" bind:checked={syncReplay} />
          Sync replay to source
        </label>
      {/if}

      {#if recordingError}
        <div class="rounded-lg px-2 py-1 text-xs" style="background:#fef2f2; color:#991b1b;">
          {recordingError}
        </div>
      {/if}
      {#if storageError}
        <div class="rounded-lg px-2 py-1 text-xs" style="background:#fef2f2; color:#991b1b;">
          {storageError}
        </div>
      {/if}

      <!-- corner picker + opacity -->
      <div class="flex flex-wrap items-center gap-1">
        {#each [['tl','↖'],['tr','↗'],['bl','↙'],['br','↘']] as [c, glyph] (c)}
          <button
            type="button"
            class="rounded-full px-2 py-0.5 text-xs ring-1"
            style={corner === c
              ? 'background: var(--theme-accent); color:#fff; --tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);'
              : 'background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);'}
            onclick={() => (corner = c as 'tl' | 'tr' | 'bl' | 'br')}
            title="Move tile to {c}"
          >{glyph}</button>
        {/each}
        <label class="ml-auto flex items-center gap-1 text-xs" style="color: var(--theme-text-muted);">
          α
          <input
            type="range"
            min="0.4"
            max="1"
            step="0.05"
            bind:value={opacity}
            class="w-20"
          />
        </label>
      </div>

      <!-- clips list -->
      {#if clips.length > 0}
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold" style="color: var(--theme-text-muted);">
            Clips ({clips.length}/{MAX_CLIPS_PER_VIDEO})
          </span>
          <button
            type="button"
            class="text-xs underline"
            style="color: var(--theme-text-muted);"
            onclick={() => (showClips = !showClips)}
          >{showClips ? 'Hide' : 'Show'}</button>
        </div>
        {#if showClips}
          <ul class="grid grid-cols-2 gap-1">
            {#each clips as c (c.id)}
              <li class="relative">
                <button
                  type="button"
                  class="block w-full overflow-hidden rounded-lg ring-1"
                  style={selectedClipId === c.id
                    ? '--tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);'
                    : '--tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);'}
                  onclick={() => selectClip(c.id)}
                  title={fmtDate(c.createdAt)}
                  aria-pressed={selectedClipId === c.id}
                >
                  {#if c.thumbDataUrl}
                    <img src={c.thumbDataUrl} alt="" class="aspect-video w-full object-cover" />
                  {:else}
                    <div class="aspect-video w-full bg-black"></div>
                  {/if}
                  <span class="pointer-events-none absolute bottom-0 left-0 rounded-tr-md px-1 text-[10px] text-white"
                        style="background: rgba(0,0,0,0.65);">
                    {fmtClock(c.durationSec)}
                  </span>
                </button>
                <button
                  type="button"
                  class="absolute right-0 top-0 rounded-bl-md px-1 text-[10px] text-white opacity-80 hover:opacity-100"
                  style="background: rgba(0,0,0,0.65);"
                  onclick={(e) => removeClip(c.id, e)}
                  title="Delete clip"
                  aria-label="Delete clip"
                >×</button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        <p class="text-center text-xs" style="color: var(--theme-text-muted);">
          {videoId === undefined ? 'Pick a video to record clips.' : 'No clips yet — hit Record.'}
        </p>
      {/if}

      <p class="text-center text-[10px]" style="color: var(--theme-text-muted);">
        Stored locally. Nothing uploaded.
      </p>
    </div>

    <!-- offscreen canvas for thumbnails -->
    <canvas bind:this={canvasEl} width="160" height="90" class="hidden"></canvas>
  </div>
{/if}
