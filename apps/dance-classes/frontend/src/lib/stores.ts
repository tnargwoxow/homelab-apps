import { writable, derived } from 'svelte/store';
import type { LibraryStatus } from './api';
import { api } from './api';
import { THEMES, DEFAULT_THEME, type ThemeId } from './themes';

export const libraryStatus = writable<LibraryStatus | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startStatusPolling(intervalMs = 5000): () => void {
  const tick = async () => {
    try {
      libraryStatus.set(await api.status());
    } catch {
      // ignore
    }
  };
  void tick();
  pollTimer = setInterval(tick, intervalMs);
  return () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
}

// ----- theme -----

const STORAGE_KEY = 'mimi-theme';

function readInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && (saved === 'ballet' || saved === 'heels' || saved === 'hiphop')) return saved;
  return DEFAULT_THEME;
}

export const themeId = writable<ThemeId>(readInitialTheme());

themeId.subscribe(id => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
});

export const theme = derived(themeId, $id => THEMES[$id]);

// ----- streak -----
// Mirror of /api/stats `streak` so multiple components can show the flame
// without each polling the endpoint. WeeklyGoals already polls every 5 min
// and pushes into here; other consumers just subscribe.

export interface StreakState { current: number; longest: number; atRisk: boolean; }
export const streakState = writable<StreakState>({ current: 0, longest: 0, atRisk: false });

