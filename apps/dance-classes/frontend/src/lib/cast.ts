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

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.json() as Promise<T>;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
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
    get<{ status: CastSession | null }>(`/api/cast/status?deviceId=${encodeURIComponent(deviceId)}`)
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
let pollIntervalMs = 5000;

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const r = await castApi.devices();
    castAvailable.set(r.available);
    castDevices.set(r.devices);
  } catch {
    // ignore — preserve last known state
  } finally {
    pollInFlight = false;
  }
}

export function startCastPolling(intervalMs = 5000): () => void {
  pollIntervalMs = intervalMs;
  void poll();
  pollTimer = setInterval(poll, pollIntervalMs);
  return () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
}

// Trigger an immediate refresh — useful right after starting/stopping a cast.
export function refreshCastSoon(delay = 600) {
  setTimeout(() => void poll(), delay);
}
