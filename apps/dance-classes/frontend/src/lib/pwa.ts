import { writable, derived } from 'svelte/store';

// The Web App Install API event fires when the browser decides the page is
// installable. Browsers only fire it over HTTPS (or http://localhost), so
// on a LAN IP like http://192.168.x.x:8080 the user has to install via the
// browser's manual menu. We surface both paths with this store.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installPrompt = writable<BeforeInstallPromptEvent | null>(null);
export const installed = writable<boolean>(false);

export const installAvailable = derived(installPrompt, $p => $p !== null);

let initialized = false;
export function initPwa(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Already installed (running standalone)?
  const matchStandalone = () => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari quirk
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    installed.set(!!isStandalone);
  };
  matchStandalone();
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', matchStandalone);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.set(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    installPrompt.set(null);
    installed.set(true);
  });
}

/** Try to show the native install prompt. Returns true if the user accepted. */
export async function triggerInstall(): Promise<boolean> {
  let evt: BeforeInstallPromptEvent | null = null;
  installPrompt.subscribe(p => { evt = p; })();
  if (!evt) return false;
  try {
    await (evt as BeforeInstallPromptEvent).prompt();
    const result = await (evt as BeforeInstallPromptEvent).userChoice;
    installPrompt.set(null);
    return result.outcome === 'accepted';
  } catch {
    return false;
  }
}

/** Heuristic: which browser is the user on? Powers the manual-install hints. */
export type BrowserKind = 'samsung' | 'chrome-android' | 'chrome-desktop' | 'safari-ios' | 'firefox' | 'other';
export function detectBrowser(): BrowserKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iP(hone|od|ad)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) return 'safari-ios';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) return 'chrome-android';
  if (/Chrome/i.test(ua)) return 'chrome-desktop';
  return 'other';
}
