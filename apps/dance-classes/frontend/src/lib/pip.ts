import { writable, get } from 'svelte/store';

// The live <video> element on the Watch page (or null when not on it).
// Watch.svelte registers it on mount and clears on unmount.
export const currentLocalVideo = writable<HTMLVideoElement | null>(null);

// Lightweight metadata about the most recently played local video — kept
// alive across route changes so a global "now playing" bar can render even
// after Watch.svelte has unmounted (e.g. while the user is browsing other
// folders with PiP active).
export interface PipTrack {
  id: number;
  title: string;
  thumbUrl: string;
  folderId: number | null;
}
export const pipTrack = writable<PipTrack | null>(null);

// Whether the browser is currently showing a PiP window. Updated by global
// document listeners + a visibility-change re-check (some browsers detach
// the PiP window on tab hide/show without firing leavepictureinpicture).
export const pipActive = writable<boolean>(false);

function syncPipActive() {
  const doc = document as Document & { pictureInPictureElement?: Element | null };
  pipActive.set(!!doc.pictureInPictureElement);
}

// Listen for clicks that navigate the user *away* from the Watch route while
// the local <video> is playing, and silently promote it to picture-in-picture
// before the route change. The click itself is the user gesture that the
// browser requires to allow programmatic PiP entry; once the request lands
// the floating window survives the DOM unmount.
let initialized = false;
export function initAutoPip(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  // Track PiP state at the document level so any component can read it.
  document.addEventListener('enterpictureinpicture', syncPipActive, true);
  document.addEventListener('leavepictureinpicture', () => {
    syncPipActive();
    // PiP closing also means whatever was queued as "now playing" is gone.
    pipTrack.set(null);
  }, true);
  document.addEventListener('visibilitychange', syncPipActive);
  syncPipActive();

  document.addEventListener(
    'click',
    async (e) => {
      try {
        // Only kick in when a video is actually playing and PiP is supported
        const v = get(currentLocalVideo);
        if (!v || v.paused || v.ended) return;
        const doc = document as Document & {
          pictureInPictureElement?: Element | null;
          pictureInPictureEnabled?: boolean;
        };
        if (!doc.pictureInPictureEnabled) return;
        if (doc.pictureInPictureElement) return;

        // Find the link being clicked, if any.
        const target = e.target as HTMLElement | null;
        const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!link) return;
        const href = link.getAttribute('href') ?? '';
        // svelte-spa-router uses hash routing: links look like "#/foo".
        const route = href.startsWith('#') ? href.slice(1) : href;

        // We only auto-PiP when leaving the watch page entirely. Navigating
        // to a sibling lesson (/watch/<n>) stays on the player.
        const onWatchNow = window.location.hash.startsWith('#/watch/');
        if (!onWatchNow) return;
        if (route.startsWith('/watch/')) return;

        await (v as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> })
          .requestPictureInPicture?.();
      } catch {
        // Browser may decline (e.g. iOS Safari, or recent gesture expired).
        // Nothing to do — the navigation will continue normally.
      }
    },
    true // capture phase, so we run before svelte-spa-router's bubble handler
  );
}
