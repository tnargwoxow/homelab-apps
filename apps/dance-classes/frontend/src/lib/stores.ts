import { writable } from 'svelte/store';
import type { LibraryStatus } from './api';
import { api } from './api';

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
