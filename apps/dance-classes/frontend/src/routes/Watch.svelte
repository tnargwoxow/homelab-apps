<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { push, link } from 'svelte-spa-router';
  import { api, sendProgressBeacon } from '../lib/api';
  import type { VideoMeta } from '../lib/api';
  import Breadcrumb from '../components/Breadcrumb.svelte';
  import CastButton from '../components/CastButton.svelte';
  import SelfReview from '../components/SelfReview.svelte';
  import { activeCast, castApi, refreshCastSoon, setCastLoop } from '../lib/cast';
  import { currentLocalVideo, pipTrack } from '../lib/pip';
  import { applyMediaSession, clearMediaSession } from '../lib/mediaSession';
  import { formatDuration } from '../lib/format';
  import { theme } from '../lib/stores';
  import { celebrate } from '../lib/celebrate';
  import HandoffSheet from '../components/HandoffSheet.svelte';
  import { currentQueue } from '../lib/queue';

  interface Props { params?: { id?: string }; }
  let { params }: Props = $props();

  let meta = $state<VideoMeta | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let videoEl: HTMLVideoElement | null = $state(null);
  let playbackRate = $state(1);
  let showSpeedMenu = $state(false);
  let showHandoff = $state(false);
  let showResumeBanner = $state(false);
  let resumePosition = $state(0);
  let countdown = $state<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  let lastSaveTs = 0;
  let lastSavePos = -1;
  const SAVE_INTERVAL_MS = 5000;
  const SAVE_DELTA_S = 4;

  // A-B loop: session-only, cleared whenever the video changes.
  let loopA = $state<number | null>(null);
  let loopB = $state<number | null>(null);

  // Picture-in-picture state
  let pipEnabled = $state(false);
  let pipActive = $state(false);

  // Self-review (webcam mirror + replay) state. The tile itself is fully
  // self-contained; the parent only owns the toolbar pill + the compare-mode
  // split-pane wiring.
  let showSelfReview = $state(false);
  let compareMode = $state(false);
  let compareBlob = $state<Blob | null>(null);
  let compareUrl = $state('');
  let replayEl: HTMLVideoElement | null = $state(null);
  let syncReplay = $state(true);

  // Manage the object URL lifecycle imperatively so we can revoke the previous
  // URL before swapping in a new one. $derived would leak the old URL.
  $effect(() => {
    const blob = compareBlob;
    const next = blob ? URL.createObjectURL(blob) : '';
    compareUrl = next;
    return () => {
      if (next) {
        try { URL.revokeObjectURL(next); } catch { /* ignore */ }
      }
    };
  });

  // Apply pitch preservation across browsers. Some engines reset this each
  // time playbackRate changes, so call this from setSpeed too.
  function applyPreservesPitch() {
    if (!videoEl) return;
    try {
      videoEl.preservesPitch = true;
      // Legacy vendor-prefixed properties for older Firefox / WebKit
      (videoEl as unknown as { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
      (videoEl as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    } catch { /* ignore */ }
  }

  function currentPosition(): number {
    const cast = get(activeCast);
    if (cast?.session && meta && cast.session.videoId === meta.id) {
      return cast.session.position ?? 0;
    }
    return videoEl?.currentTime ?? 0;
  }

  function setLoopA() {
    loopA = Math.max(0, currentPosition());
    // If existing B is now invalid, drop it.
    if (loopB !== null && loopB <= loopA) loopB = null;
    syncCastLoop();
  }

  function setLoopB() {
    if (loopA === null) return;
    const pos = currentPosition();
    if (pos <= loopA + 0.5) return; // need a meaningful range
    loopB = pos;
    syncCastLoop();
  }

  function clearLoop() {
    loopA = null;
    loopB = null;
    syncCastLoop();
  }

  function syncCastLoop() {
    const cast = get(activeCast);
    if (cast?.session && meta && cast.session.videoId === meta.id && loopA !== null && loopB !== null) {
      setCastLoop({ deviceId: cast.id, a: loopA, b: loopB });
    } else {
      setCastLoop(null);
    }
  }

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
    // New video — drop any A-B loop from the previous one.
    loopA = null;
    loopB = null;
    setCastLoop(null);
    // Tear down compare mode too — the loaded clip belongs to the previous
    // video and the SelfReview tile re-loads its clip list per-video.
    compareMode = false;
    compareBlob = null;

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

  function readHandoffParams(): { t: number | null; speed: number | null } {
    if (typeof window === 'undefined') return { t: null, speed: null };
    const hash = window.location.hash; // e.g. "#/watch/12?t=90&speed=0.75"
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return { t: null, speed: null };
    const qs = new URLSearchParams(hash.slice(qIdx + 1));
    const tRaw = qs.get('t');
    const sRaw = qs.get('speed');
    const tNum = tRaw !== null ? Number(tRaw) : NaN;
    const sNum = sRaw !== null ? Number(sRaw) : NaN;
    return {
      t:     Number.isFinite(tNum) && tNum >= 0 ? tNum : null,
      speed: Number.isFinite(sNum) && sNum >= 0.25 && sNum <= 2 ? sNum : null
    };
  }

  function onLoadedMeta() {
    if (!videoEl || !meta) return;
    const handoff = readHandoffParams();
    if (handoff.t !== null) {
      videoEl.currentTime = handoff.t;
      // Suppress the resume banner — the URL already specified where to start.
      showResumeBanner = false;
    } else if (!meta.progress.watched && meta.progress.position > 5) {
      videoEl.currentTime = meta.progress.position;
    }
    if (handoff.speed !== null) setSpeed(handoff.speed);
    else videoEl.playbackRate = playbackRate;
    applyPreservesPitch();
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
    // Local A-B loop: snap back to A when we cross B. Native timeupdate
    // fires ~4×/sec which is precise enough for practice loops.
    if (videoEl && loopA !== null && loopB !== null && videoEl.currentTime >= loopB - 0.05) {
      try { videoEl.currentTime = loopA; } catch { /* ignore */ }
    }
    // Mirror the source position into the replay pane while comparing. We
    // skip while casting because the local element is paused at 0 in that
    // case and would yank the replay back to the start.
    if (compareMode && syncReplay && replayEl && videoEl && !isCastingThisVideo) {
      const drift = Math.abs(replayEl.currentTime - videoEl.currentTime);
      if (drift > 0.25) {
        try { replayEl.currentTime = videoEl.currentTime; } catch { /* ignore */ }
      }
    }
    if (Date.now() - lastSaveTs < SAVE_INTERVAL_MS) return;
    saveNow();
  }

  function onPause() { saveNow(true); }
  function onSeeked() { saveNow(true); }

  function onEnded() {
    if (!meta || !videoEl) return;
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec;
    api.saveProgress(meta.id, dur ?? videoEl.currentTime, dur).catch(() => {});
    // Hitting the natural end is the only way the local player flips watched
    // automatically; the backend's progress endpoint won't.
    api.setWatched(meta.id, true).catch(() => {});
    if (meta) meta = { ...meta, progress: { ...meta.progress, watched: true } };
    celebrate('small');
    // If a class queue is active and there's a next item in it, prefer that
    // over the natural sibling-by-sibling autoplay chain.
    const q = get(currentQueue);
    if (q && q.index + 1 < q.items.length) {
      currentQueue.update(x => x ? { ...x, index: x.index + 1 } : x);
      startAutoplayCountdown(q.items[q.index + 1].id);
      return;
    }
    if (meta?.nextId) startAutoplayCountdown(meta.nextId);
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

  async function resetProgress() {
    if (!meta) return;
    try {
      await api.resetProgress(meta.id);
      meta = { ...meta, progress: { position: 0, duration: meta.progress.duration, watched: false } };
      try { if (videoEl) videoEl.currentTime = 0; } catch { /* ignore */ }
      const cast = get(activeCast);
      if (cast?.session?.videoId === meta.id) {
        await castApi.seek(cast.id, 0);
      }
      showResumeBanner = false;
    } catch { /* ignore */ }
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
    if (videoEl) {
      videoEl.playbackRate = rate;
      // Some engines reset preservesPitch when playbackRate changes.
      applyPreservesPitch();
    }
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
      else if (k === 'arrowup')   { e.preventDefault(); castApi.adjustVolume(cast.id, 0.05).catch(() => {}); }
      else if (k === 'arrowdown') { e.preventDefault(); castApi.adjustVolume(cast.id, -0.05).catch(() => {}); }
      else if (k === 'm')         { castApi.setMuted(cast.id, true).catch(() => {}); }
      else if (k >= '0' && k <= '9' && dur) {
        castApi.seek(cast.id, dur * (Number(k) / 10)).catch(() => {});
      } else if (k === 'n' && meta.nextId) { push(`/watch/${meta.nextId}`); }
      else if (k === 'p' && meta.prevId)   { push(`/watch/${meta.prevId}`); }
      else if (k === '[') { setLoopA(); }
      else if (k === ']') { setLoopB(); }
      else if (k === '\\') { clearLoop(); }
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
    else if (k === '<' || (e.shiftKey && k === ',')) { setSpeed(Math.max(0.25, +(playbackRate - 0.25).toFixed(2))); }
    else if (k === '[') { setLoopA(); }
    else if (k === ']') { setLoopB(); }
    else if (k === '\\') { clearLoop(); }
  }

  function onUnload() {
    if (!videoEl || !meta) return;
    const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec;
    sendProgressBeacon(meta.id, videoEl.currentTime, dur);
  }

  $effect(() => {
    pipEnabled = typeof document !== 'undefined' && (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled === true;
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  });

  // Bind PiP enter/leave events on the local <video> so the UI stays in sync
  // with the browser's native PiP toggle (e.g. user closes the floating
  // window via its own X button). Also publish the live element to the
  // pip lib so the global click handler can promote it to PiP if the user
  // navigates away while it's playing.
  $effect(() => {
    if (!videoEl) return;
    const onEnter = () => {
      pipActive = true;
      // Tell the global "now playing" bar what's in the floating window.
      if (meta) {
        pipTrack.set({
          id: meta.id,
          title: meta.title,
          thumbUrl: api.thumbUrl(meta.id),
          folderId: meta.folderId
        });
      }
    };
    const onLeave = () => {
      pipActive = false;
      pipTrack.set(null);
    };
    const onPlayEv  = () => updateMediaSession();
    const onPauseEv = () => updateMediaSession();
    const onRateEv  = () => updateMediaSession();
    videoEl.addEventListener('enterpictureinpicture', onEnter);
    videoEl.addEventListener('leavepictureinpicture', onLeave);
    videoEl.addEventListener('play', onPlayEv);
    videoEl.addEventListener('pause', onPauseEv);
    videoEl.addEventListener('ratechange', onRateEv);
    currentLocalVideo.set(videoEl);
    return () => {
      videoEl?.removeEventListener('enterpictureinpicture', onEnter);
      videoEl?.removeEventListener('leavepictureinpicture', onLeave);
      videoEl?.removeEventListener('play', onPlayEv);
      videoEl?.removeEventListener('pause', onPauseEv);
      videoEl?.removeEventListener('ratechange', onRateEv);
      currentLocalVideo.set(null);
    };
  });

  // ---------------------------------------------------------------------------
  // MediaSession integration: push metadata + remote-control handlers to the
  // OS so the lock screen, notification shade, Bluetooth headphones, etc.
  // can drive the current video.
  // ---------------------------------------------------------------------------
  function updateMediaSession() {
    if (!meta) return;
    const cast = get(activeCast);
    const castingHere = !!(cast?.session && cast.session.videoId === meta.id);

    // Pull artist + album from the breadcrumb. Last crumb is the immediate
    // parent folder (closest to artist); first crumb is the top-level
    // category (closest to album).
    const crumbs = meta.breadcrumb ?? [];
    const artist = crumbs.length ? crumbs[crumbs.length - 1].name : '';
    const album  = crumbs.length ? crumbs[0].name : '';

    const playing = castingHere
      ? cast!.session!.state === 'playing' || cast!.session!.state === 'buffering'
      : !!videoEl && !videoEl.paused && !videoEl.ended;

    const duration = castingHere
      ? cast!.session!.duration
      : (videoEl && Number.isFinite(videoEl.duration) ? videoEl.duration : meta.durationSec);

    const position = castingHere
      ? cast!.session!.position ?? 0
      : (videoEl?.currentTime ?? 0);

    const rate = castingHere ? 1 : (videoEl?.playbackRate ?? 1);

    applyMediaSession({
      title: meta.title,
      artist,
      album,
      artworkUrl: api.thumbUrl(meta.id),
      duration: typeof duration === 'number' && duration > 0 ? duration : null,
      position,
      playbackRate: rate,
      playing,
      handlers: {
        onPlay:  () => {
          if (castingHere) castApi.resume(cast!.id).catch(() => {});
          else videoEl?.play().catch(() => {});
        },
        onPause: () => {
          if (castingHere) castApi.pause(cast!.id).catch(() => {});
          else videoEl?.pause();
        },
        onSeekBackward: (sec) => {
          const cur = position;
          const target = Math.max(0, cur - (sec || 10));
          if (castingHere) castApi.seek(cast!.id, target).catch(() => {});
          else if (videoEl) videoEl.currentTime = target;
        },
        onSeekForward: (sec) => {
          const cur = position;
          const cap = duration ?? Number.POSITIVE_INFINITY;
          const target = Math.min(cap, cur + (sec || 10));
          if (castingHere) castApi.seek(cast!.id, target).catch(() => {});
          else if (videoEl) videoEl.currentTime = target;
        },
        onSeekTo: (t) => {
          if (castingHere) castApi.seek(cast!.id, t).catch(() => {});
          else if (videoEl) videoEl.currentTime = t;
        },
        onNextTrack:     meta.nextId ? () => push(`/watch/${meta!.nextId}`) : null,
        onPreviousTrack: meta.prevId ? () => push(`/watch/${meta!.prevId}`) : null
      }
    });
  }

  // Re-publish whenever the meta-driving inputs change, plus once on mount.
  $effect(() => {
    if (!meta) return;
    // Subscribe to activeCast updates so cast play/pause flips also update OS.
    void $activeCast;
    updateMediaSession();
  });

  onDestroy(() => {
    // Only clear the OS media session if we're not handing it off to PiP.
    // When PiP is active the same <video> is still playing, so we want the
    // metadata to remain — leaving and re-entering Watch is normal.
    const doc = document as Document & { pictureInPictureElement?: Element | null };
    if (!doc.pictureInPictureElement) clearMediaSession();
  });

  async function togglePip() {
    if (!videoEl) return;
    try {
      const doc = document as Document & { pictureInPictureElement?: Element | null; exitPictureInPicture?: () => Promise<void> };
      if (doc.pictureInPictureElement === videoEl) {
        await doc.exitPictureInPicture?.();
      } else {
        await (videoEl as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }).requestPictureInPicture?.();
      }
    } catch { /* user gesture / unsupported */ }
  }

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

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div class="min-w-0">
      <div class="relative w-full max-w-full overflow-hidden rounded-3xl bg-black ring-2 shadow-lg"
           style="--tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
        <div class={compareMode ? 'flex flex-col gap-1 sm:grid sm:grid-cols-2' : 'contents'}>
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
            class={compareMode ? 'h-auto w-full bg-black' : 'aspect-video w-full bg-black'}
          ></video>
          {#if compareMode && compareUrl}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              bind:this={replayEl}
              src={compareUrl}
              controls
              muted
              playsinline
              preload="metadata"
              class="h-auto w-full bg-black"
            ></video>
          {/if}
        </div>

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
        <h1
          class="mr-auto min-w-0 max-w-full basis-full font-display text-xl leading-tight sm:basis-auto sm:text-3xl"
          style="color: var(--theme-text-strong); overflow-wrap: anywhere; word-break: break-word;"
        >{meta.title}</h1>

        <CastButton
          videoId={meta.id}
          position={videoEl?.currentTime ?? 0}
          onCasted={() => { try { videoEl?.pause(); } catch { /* ignore */ } }}
        />

        <button class={pillBase} style={pillIdleStyle}
                onmouseover={pillHoverIn} onmouseout={pillHoverOut}
                onclick={() => (showHandoff = true)}
                aria-label="Hand off to another device">📱</button>

        <button
          type="button"
          class={pillBase}
          data-active={showSelfReview ? '1' : '0'}
          style={showSelfReview ? pillActiveStyle : pillIdleStyle}
          disabled={meta?.id === undefined}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={() => (showSelfReview = !showSelfReview)}
          title="Toggle self-review camera tile"
        >📷 Mirror</button>

        <div class="relative">
          <button class={pillBase} style={pillIdleStyle}
                  onmouseover={pillHoverIn} onmouseout={pillHoverOut}
                  onclick={() => (showSpeedMenu = !showSpeedMenu)}>{playbackRate}x</button>
          {#if showSpeedMenu}
            <div class="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-2xl shadow-xl ring-1"
                 style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
              {#each [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as rate}
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

      <!-- A-B loop + PiP row. The loop pills work for both local and cast
           playback; PiP is local-only and hidden while casting. -->
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={pillBase}
          data-active={loopA !== null ? '1' : '0'}
          style={loopA !== null ? pillActiveStyle : pillIdleStyle}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={setLoopA}
          title="Set loop start at the current position ([)"
        >🔁 A {loopA !== null ? formatDuration(loopA) : ''}</button>

        <button
          type="button"
          class={pillBase}
          data-active={loopB !== null ? '1' : '0'}
          style={loopB !== null ? pillActiveStyle : pillIdleStyle}
          disabled={loopA === null}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={setLoopB}
          title="Set loop end at the current position (])"
        >🔁 B {loopB !== null ? formatDuration(loopB) : ''}</button>

        {#if loopA !== null || loopB !== null}
          <button
            type="button"
            class={pillBase}
            style={pillIdleStyle}
            onmouseover={pillHoverIn} onmouseout={pillHoverOut}
            onclick={clearLoop}
            title="Clear A-B loop (\\)"
          >× Loop</button>
        {/if}

        {#if loopA !== null && loopB !== null}
          <span class="text-xs" style="color: var(--theme-text-muted);">
            Looping {formatDuration(loopB - loopA)}
          </span>
        {/if}

        {#if pipEnabled && !isCastingThisVideo}
          <button
            type="button"
            class="ml-auto {pillBase}"
            data-active={pipActive ? '1' : '0'}
            style={pipActive ? pillActiveStyle : pillIdleStyle}
            onmouseover={pillHoverIn} onmouseout={pillHoverOut}
            onclick={togglePip}
            title="Picture-in-picture"
          >🪟 PiP</button>
        {/if}
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        {#if meta.prevId}
          <a use:link href={`/watch/${meta.prevId}`} class={pillBase} style={pillIdleStyle}
             onmouseover={pillHoverIn} onmouseout={pillHoverOut}>← Previous</a>
        {/if}
        <button
          type="button"
          class={pillBase}
          style={pillIdleStyle}
          onmouseover={pillHoverIn} onmouseout={pillHoverOut}
          onclick={resetProgress}
          title="Reset progress and remove from Recently Played"
        >↺ Reset</button>
        {#if meta.nextId}
          <a use:link href={`/watch/${meta.nextId}`} class="ml-auto {pillBase}" style={pillIdleStyle}
             onmouseover={pillHoverIn} onmouseout={pillHoverOut}>Next →</a>
        {/if}
      </div>

      <div class="mt-4 text-xs" style="color: var(--theme-text-muted);">
        Shortcuts: Space play/pause · J/L ±10s · ←/→ ±5s · F fullscreen · M mute · 0–9 jump · N/P next/prev · Shift+&lt;/&gt; speed · [ /] /\ A-B loop
      </div>
    </div>

    <aside class="min-w-0 max-w-full overflow-hidden rounded-3xl p-3 ring-1 lg:max-h-[80vh] lg:overflow-y-auto"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      <h3 class="mb-2 px-2 text-xs font-bold uppercase tracking-wider" style="color: var(--theme-text-muted);">{$theme.sections.inSeries}</h3>
      <ul class="space-y-1">
        {#each meta.siblings as s (s.id)}
          <li class="min-w-0">
            <a
              use:link
              href={`/watch/${s.id}`}
              class="flex min-w-0 items-baseline gap-2 rounded-xl px-2 py-1.5 text-sm transition"
              style={
                s.current
                  ? 'background: var(--theme-pill-hover); font-weight: 600; color: var(--theme-text-strong);'
                  : 'color: var(--theme-text);'
              }
              onmouseover={(e) => { if (!s.current) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)'; }}
              onmouseout={(e)  => { if (!s.current) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              <span class="w-6 shrink-0 text-right" style="color: var(--theme-text-muted);">{s.episodeNum ?? '·'}</span>
              <span class="min-w-0 flex-1 truncate">{s.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    </aside>
  </div>

  <SelfReview
    videoId={meta?.id}
    visible={showSelfReview}
    {compareMode}
    bind:syncReplay
    onCompareToggle={(v) => (compareMode = v)}
    onSelectClipBlob={(b) => (compareBlob = b)}
    onClose={() => (showSelfReview = false)}
  />
{/if}

{#if meta}
  <HandoffSheet
    open={showHandoff}
    videoId={meta.id}
    position={videoEl?.currentTime ?? 0}
    speed={playbackRate}
    onClose={() => (showHandoff = false)}
  />
{/if}
