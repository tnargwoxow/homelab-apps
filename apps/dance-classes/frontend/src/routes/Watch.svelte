<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { push, link } from 'svelte-spa-router';
  import { api, sendProgressBeacon } from '../lib/api';
  import type { VideoMeta } from '../lib/api';
  import Breadcrumb from '../components/Breadcrumb.svelte';
  import CastButton from '../components/CastButton.svelte';
  import { activeCast, castApi, refreshCastSoon } from '../lib/cast';
  import { formatDuration } from '../lib/format';
  import { theme } from '../lib/stores';

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
    // Only autoplay locally when there isn't an active cast — otherwise
    // we'd play on the phone AND on the TV at the same time.
    if (!get(activeCast)?.session) {
      videoEl.play().catch(() => { /* user gesture required, fine */ });
    }
  }

  // When a cast is active and the user navigates to a new video, hand the
  // new video off to the same TV instead of starting local playback. Once
  // a route has been "handed off", remember it so we don't loop.
  let lastCastSwitchVideoId: number | null = null;
  $effect(() => {
    if (!meta) return;
    const cast = $activeCast;
    if (!cast?.session) return;

    // Always pause local; the TV is what's playing.
    try { videoEl?.pause(); } catch { /* ignore */ }

    if (cast.session.videoId === meta.id) {
      lastCastSwitchVideoId = meta.id;
      return;
    }
    if (lastCastSwitchVideoId === meta.id) return;
    lastCastSwitchVideoId = meta.id;

    const start = meta.progress?.position && meta.progress.position > 5
      ? meta.progress.position
      : undefined;
    castApi.play(cast.id, meta.id, start)
      .then(() => refreshCastSoon())
      .catch(err => { error = `Cast failed: ${err.message ?? err}`; });
  });

  let isCastingThisVideo = $derived(
    !!($activeCast?.session && meta && $activeCast.session.videoId === meta.id)
  );

  function saveNow(force = false) {
    if (!videoEl || !meta) return;
    // While casting this video, the local element is paused at 0 — saving
    // would overwrite the real (TV-side) position with 0. Skip it.
    if (get(activeCast)?.session?.videoId === meta.id) return;
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
    if (!meta) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const k = e.key.toLowerCase();

    // Route to the cast when active — the local player isn't doing anything.
    const cast = get(activeCast);
    if (cast?.session && cast.session.videoId === meta.id) {
      const pos = cast.session.position ?? 0;
      const dur = cast.session.duration ?? null;
      if (k === ' ') {
        e.preventDefault();
        if (cast.session.state === 'paused') castApi.resume(cast.id).catch(() => {});
        else castApi.pause(cast.id).catch(() => {});
      } else if (k === 'j')          castApi.seek(cast.id, Math.max(0, pos - 10)).catch(() => {});
      else if (k === 'l')            castApi.seek(cast.id, pos + 10).catch(() => {});
      else if (k === 'arrowleft')    castApi.seek(cast.id, Math.max(0, pos - 5)).catch(() => {});
      else if (k === 'arrowright')   castApi.seek(cast.id, pos + 5).catch(() => {});
      else if (k >= '0' && k <= '9' && dur) {
        castApi.seek(cast.id, dur * (Number(k) / 10)).catch(() => {});
      } else if (k === 'n' && meta.nextId) { push(`/watch/${meta.nextId}`); }
      else if (k === 'p' && meta.prevId)   { push(`/watch/${meta.prevId}`); }
      return;
    }

    if (!videoEl) return;
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

  // Inline style helpers used by buttons + pills
  const pillBase = 'rounded-full px-3 py-1.5 text-sm transition ring-1 shadow-sm';
  const pillIdleStyle = 'background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);';
  const pillActiveStyle = 'background: var(--theme-accent); color: white; --tw-ring-color: var(--theme-accent); border-color: var(--theme-accent);';
  function pillHoverIn(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (el.dataset.active !== '1') el.style.background = 'var(--theme-pill-hover)';
  }
  function pillHoverOut(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (el.dataset.active !== '1') el.style.background = 'var(--theme-pill-bg)';
  }
</script>

{#if loading}
  <div class="py-20 text-center" style="color: var(--theme-text-muted);">Loading…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else if meta}
  <div class="mb-3">
    <Breadcrumb items={meta.breadcrumb} final={meta.title} />
  </div>

  <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
    <div>
      <div class="relative overflow-hidden rounded-3xl bg-black ring-2 shadow-lg"
           style="--tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
        <video
          bind:this={videoEl}
          src={api.streamUrl(meta.id)}
          controls
          preload="metadata"
          onloadedmetadata={onLoadedMeta}
          ontimeupdate={onTimeUpdate}
          onpause={onPause}
          onseeked={onSeeked}
          onended={onEnded}
          class="aspect-video w-full bg-black"
        ></video>

        {#if isCastingThisVideo && $activeCast}
          <div class="absolute inset-0 z-10 flex items-center justify-center bg-black/85 text-white">
            <div class="px-6 text-center">
              <div class="text-5xl">📺</div>
              <div class="mt-3 font-display text-2xl">Casting to {$activeCast.name}</div>
              <div class="mt-1 text-sm opacity-80">{$activeCast.session?.title ?? meta.title}</div>
              <div class="mt-3 text-xs opacity-60">Use the player at the bottom of the screen for play / pause / seek.</div>
            </div>
          </div>
        {/if}

        {#if showResumeBanner}
          <div class="absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ring-1"
               style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
            <button class="font-semibold" style="color: var(--theme-accent);" onclick={resumeFromSaved}>
              ✨ Resume from {formatDuration(resumePosition)}
            </button>
            <button class="ml-3" style="color: var(--theme-text-muted);" onclick={() => (showResumeBanner = false)}>
              Start over
            </button>
          </div>
        {/if}

        {#if countdown !== null}
          <div class="absolute inset-0 flex items-center justify-center bg-black/70">
            <div class="rounded-3xl p-6 text-center shadow-2xl ring-2"
                 style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
              <div class="text-xs font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">Up next in {countdown}s</div>
              <div class="mt-2 text-lg font-semibold" style="color: var(--theme-text-strong);">
                {meta.siblings.find(s => s.id === meta.nextId)?.title ?? 'Next lesson'}
              </div>
              <div class="mt-4 flex justify-center gap-2">
                <button
                  class="rounded-full px-4 py-2 text-sm font-semibold text-white shadow"
                  style="background: linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2));"
                  onclick={() => meta?.nextId && (clearCountdown(), push(`/watch/${meta.nextId}`))}
                >Play now ✨</button>
                <button
                  class="rounded-full px-4 py-2 text-sm"
                  style="background: var(--theme-pill-hover); color: var(--theme-text-strong);"
                  onclick={cancelAutoplay}
                >Cancel</button>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <h1 class="mr-auto font-display text-2xl sm:text-3xl" style="color: var(--theme-text-strong);">{meta.title}</h1>

        <CastButton
          videoId={meta.id}
          position={videoEl?.currentTime ?? 0}
          onCasted={() => { try { videoEl?.pause(); } catch { /* ignore */ } }}
        />

        <div class="relative">
          <button class={pillBase} style={pillIdleStyle}
                  onmouseover={pillHoverIn} onmouseout={pillHoverOut}
                  onclick={() => (showSpeedMenu = !showSpeedMenu)}>{playbackRate}x</button>
          {#if showSpeedMenu}
            <div class="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-2xl shadow-xl ring-1"
                 style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
              {#each [0.75, 1, 1.25, 1.5, 1.75, 2] as rate}
                <button
                  class="block w-full px-3 py-1.5 text-left text-sm"
                  style={
                    rate === playbackRate
                      ? 'background: var(--theme-pill-hover); color: var(--theme-accent); font-weight: 600;'
                      : 'color: var(--theme-text);'
                  }
                  onmouseover={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-pill-hover)')}
                  onmouseout={(e)  => ((e.currentTarget as HTMLButtonElement).style.background = rate === playbackRate ? 'var(--theme-pill-hover)' : 'transparent')}
                  onclick={() => setSpeed(rate)}
                >{rate}x</button>
              {/each}
            </div>
          {/if}
        </div>

        <button
          class={pillBase}
          data-active={meta.favorite ? '1' : '0'}
          style={meta.favorite ? pillActiveStyle : pillIdleStyle}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={toggleFavorite}
        >
          {meta.favorite ? `${$theme.favoritesIcon} Favorited` : `${$theme.favoritesIcon} Favorite`}
        </button>

        <button
          class={pillBase}
          data-active={meta.progress.watched ? '1' : '0'}
          style={meta.progress.watched ? 'background: #10b981; color: white; --tw-ring-color: #10b981; border-color: #10b981;' : pillIdleStyle}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={toggleWatched}
        >
          {meta.progress.watched ? '✓ Watched' : 'Mark watched'}
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        {#if meta.prevId}
          <a use:link href={`/watch/${meta.prevId}`} class={pillBase} style={pillIdleStyle}
             onmouseover={pillHoverIn} onmouseout={pillHoverOut}>← Previous</a>
        {/if}
        {#if meta.nextId}
          <a use:link href={`/watch/${meta.nextId}`} class="ml-auto {pillBase}" style={pillIdleStyle}
             onmouseover={pillHoverIn} onmouseout={pillHoverOut}>Next →</a>
        {/if}
      </div>

      <div class="mt-4 text-xs" style="color: var(--theme-text-muted);">
        Shortcuts: Space play/pause · J/L ±10s · ←/→ ±5s · F fullscreen · M mute · 0–9 jump · N/P next/prev · Shift+&lt;/&gt; speed
      </div>
    </div>

    <aside class="rounded-3xl p-3 ring-1 lg:max-h-[80vh] lg:overflow-y-auto"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      <h3 class="mb-2 px-2 text-xs font-bold uppercase tracking-wider" style="color: var(--theme-text-muted);">{$theme.sections.inSeries}</h3>
      <ul class="space-y-1">
        {#each meta.siblings as s (s.id)}
          <li>
            <a
              use:link
              href={`/watch/${s.id}`}
              class="flex items-baseline gap-2 rounded-xl px-2 py-1.5 text-sm transition"
              style={
                s.current
                  ? 'background: var(--theme-pill-hover); font-weight: 600; color: var(--theme-text-strong);'
                  : 'color: var(--theme-text);'
              }
              onmouseover={(e) => { if (!s.current) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)'; }}
              onmouseout={(e)  => { if (!s.current) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              <span class="w-6 shrink-0 text-right" style="color: var(--theme-text-muted);">{s.episodeNum ?? '·'}</span>
              <span class="truncate">{s.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    </aside>
  </div>
{/if}
