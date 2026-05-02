// Thin wrapper around the Web Media Session API. Sets metadata + action
// handlers so the OS-level media UI (Android lock screen, notification
// shade, Bluetooth headphones, smartwatch, CarPlay) shows the current
// dance lesson and can be controlled remotely.
//
// Browsers without `mediaSession` are no-ops; everything is safely guarded.

export interface MediaSessionInput {
  title: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  duration: number | null;
  position: number;
  playbackRate: number;
  playing: boolean;
  handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onSeekBackward?: (seconds: number) => void;
    onSeekForward?: (seconds: number) => void;
    onSeekTo?: (time: number) => void;
    onNextTrack?: (() => void) | null;
    onPreviousTrack?: (() => void) | null;
  };
}

type ActionHandler = ((details: { seekOffset?: number; seekTime?: number; fastSeek?: boolean }) => void) | null;

interface MediaSessionLike {
  metadata: unknown;
  playbackState: 'none' | 'paused' | 'playing';
  setActionHandler: (action: string, handler: ActionHandler) => void;
  setPositionState?: (state: { duration: number; position: number; playbackRate: number }) => void;
}

function getSession(): MediaSessionLike | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return (navigator as unknown as { mediaSession: MediaSessionLike }).mediaSession;
}

export function applyMediaSession(input: MediaSessionInput): void {
  const session = getSession();
  if (!session) return;

  try {
    const MetadataCtor = (window as unknown as { MediaMetadata?: new (init: unknown) => unknown }).MediaMetadata;
    if (MetadataCtor) {
      session.metadata = new MetadataCtor({
        title: input.title,
        artist: input.artist ?? '',
        album: input.album ?? '',
        artwork: input.artworkUrl
          ? [
              { src: input.artworkUrl, sizes: '320x180', type: 'image/jpeg' },
              { src: input.artworkUrl, sizes: '512x288', type: 'image/jpeg' }
            ]
          : []
      });
    }
  } catch {
    /* ignore */
  }

  try {
    session.playbackState = input.playing ? 'playing' : 'paused';
  } catch { /* ignore */ }

  // Register / clear action handlers. Passing null disables the corresponding
  // OS button; that's important because Android shows ⏭ greyed out when no
  // handler is registered (vs hidden if explicitly null).
  const setAction = (name: string, fn: ActionHandler) => {
    try { session.setActionHandler(name, fn); } catch { /* unsupported action, ignore */ }
  };

  setAction('play',  input.handlers.onPlay  ? () => input.handlers.onPlay!()  : null);
  setAction('pause', input.handlers.onPause ? () => input.handlers.onPause!() : null);
  setAction('seekbackward', input.handlers.onSeekBackward
    ? (d) => input.handlers.onSeekBackward!(d?.seekOffset ?? 10)
    : null);
  setAction('seekforward', input.handlers.onSeekForward
    ? (d) => input.handlers.onSeekForward!(d?.seekOffset ?? 10)
    : null);
  setAction('seekto', input.handlers.onSeekTo
    ? (d) => { if (typeof d?.seekTime === 'number') input.handlers.onSeekTo!(d.seekTime); }
    : null);
  setAction('nexttrack', input.handlers.onNextTrack ?? null);
  setAction('previoustrack', input.handlers.onPreviousTrack ?? null);

  if (typeof session.setPositionState === 'function' &&
      input.duration !== null && input.duration > 0 &&
      input.position >= 0 && input.position <= input.duration) {
    try {
      session.setPositionState({
        duration: input.duration,
        position: Math.min(input.position, input.duration),
        playbackRate: input.playbackRate || 1
      });
    } catch { /* values out of range — drop the position state */ }
  }
}

export function clearMediaSession(): void {
  const session = getSession();
  if (!session) return;
  try {
    session.metadata = null;
    session.playbackState = 'none';
    for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'nexttrack', 'previoustrack']) {
      try { session.setActionHandler(a, null); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
