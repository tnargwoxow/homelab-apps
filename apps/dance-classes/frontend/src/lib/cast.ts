import { writable, derived } from 'svelte/store';

export type CastPlayerState =
  | 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'stopped';

export interface CastSession {
  deviceId: string;
  videoId: number;
  title: string;
  state: CastPlayerState;
  position: number;
  duration: number | null;
  startedAt: number;
}

export interface CastDevice {
  id: string;
  name: string;
  host: string;
  session: CastSession | null;
}

interface DeviceListResponse {
  available: boolean;
  devices: CastDevice[];
}

async function explainError(r: Response): Promise<string> {
  try {
    const data = await r.clone().json();
    if (typeof data?.error === 'string') return data.error;
  } catch { /* not JSON */ }
  try { return (await r.text()).trim(); } catch { return ''; }
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    const detail = await explainError(r);
    throw new Error(detail ? `${r.status}: ${detail}` : `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const detail = await explainError(r);
    throw new Error(detail ? `${r.status}: ${detail}` : `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

export const castApi = {
  devices: () => get<DeviceListResponse>('/api/cast/devices'),
  play:    (deviceId: string, videoId: number, position?: number) =>
    post<{ ok: boolean }>('/api/cast/play', { deviceId, videoId, position }),
  pause:   (deviceId: string) => post<{ ok: boolean }>('/api/cast/pause', { deviceId }),
  resume:  (deviceId: string) => post<{ ok: boolean }>('/api/cast/resume', { deviceId }),
  seek:    (deviceId: string, position: number) =>
    post<{ ok: boolean }>('/api/cast/seek', { deviceId, position }),
  stop:    (deviceId: string) => post<{ ok: boolean }>('/api/cast/stop', { deviceId }),
  status:  (deviceId: string) =>
    get<{ status: CastSession | null }>(`/api/cast/status?deviceId=${encodeURIComponent(deviceId)}`),
  setVolume: (deviceId: string, level: number) =>
    post<{ ok: boolean; level: number }>('/api/cast/volume', { deviceId, level }),
  adjustVolume: (deviceId: string, delta: number) =>
    post<{ ok: boolean; level: number }>('/api/cast/volume/adjust', { deviceId, delta }),
  setMuted: (deviceId: string, muted: boolean) =>
    post<{ ok: boolean; muted: boolean }>('/api/cast/mute', { deviceId, muted })
};

export const castAvailable = writable(true);
export const castDevices = writable<CastDevice[]>([]);

export const activeCast = derived(castDevices, $devices => {
  // Prefer an actively-playing/paused device over a stale "stopped" one.
  return $devices.find(d => d.session && d.session.state !== 'stopped' && d.session.state !== 'idle')
    ?? $devices.find(d => d.session)
    ?? null;
});

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;
let baseIntervalMs = 5000;

// Optional A-B loop in effect on the active cast. While set, polling speeds
// up to ~1s so we can snap back to A reasonably tightly when position passes B.
interface CastLoop { deviceId: string; a: number; b: number; }
let castLoop: CastLoop | null = null;

function activeIntervalMs(): number {
  return castLoop ? 1000 : baseIntervalMs;
}

function reschedule() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, activeIntervalMs());
}

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const r = await castApi.devices();
    castAvailable.set(r.available);
    castDevices.set(r.devices);

    // Enforce the cast-side A-B loop here so it works regardless of which
    // page the user is on (or even if they've closed the Watch tab).
    if (castLoop) {
      const dev = r.devices.find(d => d.id === castLoop!.deviceId);
      const pos = dev?.session?.position ?? -1;
      if (pos >= castLoop.b - 0.5) {
        try { await castApi.seek(castLoop.deviceId, castLoop.a); } catch { /* ignore */ }
      }
    }
  } catch {
    // ignore — preserve last known state
  } finally {
    pollInFlight = false;
  }
}

export function startCastPolling(intervalMs = 5000): () => void {
  baseIntervalMs = intervalMs;
  void poll();
  pollTimer = setInterval(poll, activeIntervalMs());
  return () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
}

// Trigger an immediate refresh — useful right after starting/stopping a cast.
export function refreshCastSoon(delay = 600) {
  setTimeout(() => void poll(), delay);
}

/**
 * Activate (or clear) a cast-side A-B loop. While active, the polling
 * interval drops to ~1s and the poller will seek back to `a` whenever the
 * device's reported position passes `b`.
 */
export function setCastLoop(loop: CastLoop | null): void {
  castLoop = loop;
  if (pollTimer) reschedule();
}
