<script lang="ts">
  import { onDestroy } from 'svelte';
  import { push, link } from 'svelte-spa-router';
  import { api, sendProgressBeacon } from '../lib/api';
  import type { VideoMeta } from '../lib/api';
  import Breadcrumb from '../components/Breadcrumb.svelte';
  import { formatDuration } from '../lib/format';

  interface Props { params?: { id?: string }; }
  let { params }: Props = $props();

  let meta = $state<VideoMeta | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let videoEl: HTMLVideoElement | null = $state(null);
  let playbackRate = $state(1);
  let showSpeedMenu = $state(false);
  let showResumeBanner = $state(false);
  let resumePosition = $state(0);
  let countdown = $state<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  let lastSaveTs = 0;
  let lastSavePos = -1;
  const SAVE_INTERVAL_MS = 5000;
  const SAVE_DELTA_S = 4;

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdown = null;
  }

  $effect(() => {
    const id = Number.parseInt(params?.id ?? '', 10);
    if (!Number.isFinite(id)) {
      error = 'Bad video id';
      loading = false;
      return;
    }
    loading = true;
    error = null;
    meta = null;
    showResumeBanner = false;
    resumePosition = 0;
    clearCountdown();

    api.video(id)
      .then(m => {
        meta = m;
        if (m.progress.watched && m.progress.position > 30) {
          showResumeBanner = true;
          resumePosition = m.progress.position;
        }
      })
      .catch(e => { error = (e as Error).message; })
      .finally(() => { loading = false; });
  });

  function onLoadedMeta() {
    if (!videoEl || !meta) return;
    if (!meta.progress.watched && meta.progress.position > 5) {
      videoEl.currentTime = meta.progress.position;
    }
    videoEl.playbackRate = playbackRate;
  }

  function saveNow(force = false) {
    if (!videoEl || !meta) return;
    const pos = videoEl.currentTime;
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec;
    if (!force && Math.abs(pos - lastSavePos) < SAVE_DELTA_S) return;
    lastSaveTs = Date.now();
    lastSavePos = pos;
    api.saveProgress(meta.id, pos, dur).catch(() => {});
  }

  function onTimeUpdate() {
    if (Date.now() - lastSaveTs < SAVE_INTERVAL_MS) return;
    saveNow();
  }

  function onPause() { saveNow(true); }
  function onSeeked() { saveNow(true); }

  function onEnded() {
    if (!meta || !videoEl) return;
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec;
    api.saveProgress(meta.id, dur ?? videoEl.currentTime, dur).catch(() => {});
    if (meta.nextId) startAutoplayCountdown(meta.nextId);
  }

  function startAutoplayCountdown(nextId: number) {
    countdown = 5;
    countdownTimer = setInterval(() => {
      if (countdown === null) return;
      countdown -= 1;
      if (countdown <= 0) {
        clearCountdown();
        push(`/watch/${nextId}`);
      }
    }, 1000);
  }

  function cancelAutoplay() { clearCountdown(); }

  async function toggleWatched() {
    if (!meta) return;
    const next = !meta.progress.watched;
    await api.setWatched(meta.id, next);
    meta = { ...meta, progress: { ...meta.progress, watched: next } };
  }

  async function toggleFavorite() {
    if (!meta) return;
    const next = !meta.favorite;
    if (next) await api.addFavorite(meta.id);
    else await api.removeFavorite(meta.id);
    meta = { ...meta, favorite: next };
  }

  function setSpeed(rate: number) {
    playbackRate = rate;
    if (videoEl) videoEl.playbackRate = rate;
    showSpeedMenu = false;
  }

  function resumeFromSaved() {
    if (videoEl && resumePosition > 0) {
      videoEl.currentTime = resumePosition;
      videoEl.play().catch(() => {});
    }
    showResumeBanner = false;
  }

  function onKey(e: KeyboardEvent) {
    if (!videoEl || !meta) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (videoEl.paused) videoEl.play().catch(() => {});
      else videoEl.pause();
    } else if (k === 'j') { videoEl.currentTime = Math.max(0, videoEl.currentTime - 10); }
    else if (k === 'l') { videoEl.currentTime = Math.min((videoEl.duration || 0), videoEl.currentTime + 10); }
    else if (k === 'arrowleft') { videoEl.currentTime = Math.max(0, videoEl.currentTime - 5); }
    else if (k === 'arrowright') { videoEl.currentTime = Math.min((videoEl.duration || 0), videoEl.currentTime + 5); }
    else if (k === 'arrowup') { e.preventDefault(); videoEl.volume = Math.min(1, videoEl.volume + 0.05); }
    else if (k === 'arrowdown') { e.preventDefault(); videoEl.volume = Math.max(0, videoEl.volume - 0.05); }
    else if (k === 'f') {
      if (document.fullscreenElement) document.exitFullscreen();
      else videoEl.requestFullscreen().catch(() => {});
    } else if (k === 'm') { videoEl.muted = !videoEl.muted; }
    else if (k >= '0' && k <= '9') {
      const ratio = Number(k) / 10;
      if (videoEl.duration) videoEl.currentTime = videoEl.duration * ratio;
    } else if (k === 'n' && meta.nextId) { push(`/watch/${meta.nextId}`); }
    else if (k === 'p' && meta.prevId) { push(`/watch/${meta.prevId}`); }
    else if (k === '>' || (e.shiftKey && k === '.')) { setSpeed(Math.min(2, +(playbackRate + 0.25).toFixed(2))); }
    else if (k === '<' || (e.shiftKey && k === ',')) { setSpeed(Math.max(0.5, +(playbackRate - 0.25).toFixed(2))); }
  }

  function onUnload() {
    if (!videoEl || !meta) return;
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec;
    sendProgressBeacon(meta.id, videoEl.currentTime, dur);
  }

  $effect(() => {
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  });

  onDestroy(() => {
    onUnload();
    clearCountdown();
  });
</script>

{#if loading}
  <div class="py-20 text-center text-neutral-500">Loading…</div>
{:else if error}
  <div class="py-10 text-center text-rose-400">{error}</div>
{:else if meta}
  <div class="mb-3">
    <Breadcrumb items={meta.breadcrumb} final={meta.title} />
  </div>

  <div class="grid gap-6 lg:grid-cols-[1fr_280px]">
    <div>
      <div class="relative overflow-hidden rounded-xl bg-black ring-1 ring-neutral-800">
        <video
          bind:this={videoEl}
          src={api.streamUrl(meta.id)}
          controls
          preload="metadata"
          autoplay
          onloadedmetadata={onLoadedMeta}
          ontimeupdate={onTimeUpdate}
          onpause={onPause}
          onseeked={onSeeked}
          onended={onEnded}
          class="aspect-video w-full bg-black"
        ></video>

        {#if showResumeBanner}
          <div class="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900/95 px-4 py-2 text-sm shadow-lg ring-1 ring-neutral-700">
            <button
              class="font-medium text-rose-400 hover:text-rose-300"
              onclick={resumeFromSaved}
            >
              Resume from {formatDuration(resumePosition)}
            </button>
            <button class="ml-3 text-neutral-400 hover:text-neutral-200" onclick={() => (showResumeBanner = false)}>
              Start over
            </button>
          </div>
        {/if}

        {#if countdown !== null}
          <div class="absolute inset-0 flex items-center justify-center bg-black/70">
            <div class="rounded-2xl bg-neutral-900/95 p-6 text-center shadow-2xl ring-1 ring-neutral-800">
              <div class="text-xs uppercase tracking-wide text-neutral-500">Up next in {countdown}s</div>
              <div class="mt-2 text-lg font-semibold text-neutral-50">
                {meta.siblings.find(s => s.id === meta.nextId)?.title ?? 'Next lesson'}
              </div>
              <div class="mt-4 flex justify-center gap-2">
                <button
                  class="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
                  onclick={() => meta?.nextId && (clearCountdown(), push(`/watch/${meta.nextId}`))}
                >Play now</button>
                <button
                  class="rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
                  onclick={cancelAutoplay}
                >Cancel</button>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <h1 class="mr-auto text-xl font-semibold text-neutral-50">{meta.title}</h1>

        <div class="relative">
          <button
            class="rounded-full bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 ring-1 ring-neutral-800 hover:bg-neutral-800"
            onclick={() => (showSpeedMenu = !showSpeedMenu)}
          >{playbackRate}x</button>
          {#if showSpeedMenu}
            <div class="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-lg bg-neutral-900 shadow-xl ring-1 ring-neutral-800">
              {#each [0.75, 1, 1.25, 1.5, 1.75, 2] as rate}
                <button
                  class="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-800 {rate === playbackRate ? 'text-rose-400' : 'text-neutral-200'}"
                  onclick={() => setSpeed(rate)}
                >{rate}x</button>
              {/each}
            </div>
          {/if}
        </div>

        <button
          class="rounded-full px-3 py-1.5 text-sm ring-1 transition {meta.favorite
            ? 'bg-rose-500/20 text-rose-300 ring-rose-500/40 hover:bg-rose-500/30'
            : 'bg-neutral-900 text-neutral-200 ring-neutral-800 hover:bg-neutral-800'}"
          onclick={toggleFavorite}
        >
          {meta.favorite ? '★ Favorited' : '☆ Favorite'}
        </button>

        <button
          class="rounded-full px-3 py-1.5 text-sm ring-1 transition {meta.progress.watched
            ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40 hover:bg-emerald-500/30'
            : 'bg-neutral-900 text-neutral-200 ring-neutral-800 hover:bg-neutral-800'}"
          onclick={toggleWatched}
        >
          {meta.progress.watched ? '✓ Watched' : 'Mark watched'}
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        {#if meta.prevId}
          <a use:link href={`/watch/${meta.prevId}`} class="rounded-full bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 ring-1 ring-neutral-800 hover:bg-neutral-800">← Previous</a>
        {/if}
        {#if meta.nextId}
          <a use:link href={`/watch/${meta.nextId}`} class="ml-auto rounded-full bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 ring-1 ring-neutral-800 hover:bg-neutral-800">Next →</a>
        {/if}
      </div>

      <div class="mt-4 text-xs text-neutral-500">
        Shortcuts: Space play/pause · J/L ±10s · ←/→ ±5s · F fullscreen · M mute · 0–9 jump · N/P next/prev · Shift+&lt;/&gt; speed
      </div>
    </div>

    <aside class="lg:max-h-[80vh] lg:overflow-y-auto">
      <h3 class="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">In this series</h3>
      <ul class="space-y-1">
        {#each meta.siblings as s (s.id)}
          <li>
            <a
              use:link
              href={`/watch/${s.id}`}
              class="flex items-baseline gap-2 rounded px-2 py-1.5 text-sm transition {s.current
                ? 'bg-rose-500/20 text-rose-200'
                : 'text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100'}"
            >
              <span class="w-6 shrink-0 text-right text-neutral-500">{s.episodeNum ?? '·'}</span>
              <span class="truncate">{s.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    </aside>
  </div>
{/if}
