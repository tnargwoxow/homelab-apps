import { writable } from 'svelte/store';
import type { VideoListItem } from './api';

// ---------------------------------------------------------------------------
// Client-side "current queue" — the list the user is actively building/playing
// on this device, persisted to localStorage so a page reload doesn't dump it.
// `playlistId` is set when the queue was hydrated from a saved playlist (so
// we can do "resave" later); a new ad-hoc queue has it undefined.
// ---------------------------------------------------------------------------
export interface CurrentQueue {
  playlistId?: number;
  name?: string;
  items: VideoListItem[];
  index: number;
}

const STORAGE_KEY = 'mimi:currentQueue';

function readInitial(): CurrentQueue | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      playlistId: parsed.playlistId,
      name: parsed.name,
      items: parsed.items,
      index: typeof parsed.index === 'number' ? parsed.index : 0
    };
  } catch {
    return null;
  }
}

export const currentQueue = writable<CurrentQueue | null>(readInitial());

if (typeof window !== 'undefined') {
  currentQueue.subscribe(v => {
    try {
      if (v === null) localStorage.removeItem(STORAGE_KEY);
      else            localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch { /* quota / private mode */ }
  });
}

// ---------------------------------------------------------------------------
// REST helpers — kept here so we don't need to touch lib/api.ts (which has
// parallel work in flight for the calendar feature).
// ---------------------------------------------------------------------------

async function describeError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    if (typeof data?.error === 'string')   return data.error;
    if (typeof data?.message === 'string') return data.message;
  } catch { /* not JSON */ }
  try { return (await res.text()).trim(); } catch { return ''; }
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    const detail = await describeError(r);
    throw new Error(detail ? `${r.status}: ${detail}` : `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const detail = await describeError(r);
    throw new Error(detail ? `${r.status}: ${detail}` : `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

export interface PlaylistSummary {
  id: number;
  name: string;
  itemCount: number;
  totalSeconds: number;
  updatedAt: number;
}
export interface PlaylistDetail {
  id: number;
  name: string;
  updatedAt: number;
  items: VideoListItem[];
}

export interface CastQueueState {
  videoIds: number[];
  index: number;
  urlBase: string;
}

export const queueApi = {
  list:           () => get<{ playlists: PlaylistSummary[] }>('/api/playlists'),
  get:            (id: number) => get<PlaylistDetail>(`/api/playlists/${id}`),
  create:         (name: string) =>
    send<{ id: number; name: string }>('/api/playlists', 'POST', { name }),
  rename:         (id: number, name: string) =>
    send<{ ok: boolean }>(`/api/playlists/${id}`, 'PUT', { name }),
  deletePlaylist: (id: number) =>
    send<{ ok: boolean }>(`/api/playlists/${id}`, 'DELETE'),
  appendItem:     (id: number, videoId: number, position?: number) =>
    send<{ ok: boolean; position: number }>(
      `/api/playlists/${id}/items`,
      'POST',
      position === undefined ? { videoId } : { videoId, position }
    ),
  removeItem:     (id: number, position: number) =>
    send<{ ok: boolean }>(`/api/playlists/${id}/items/${position}`, 'DELETE'),
  reorder:        (id: number, from: number, to: number) =>
    send<{ ok: boolean }>(`/api/playlists/${id}/items/reorder`, 'PUT', { from, to }),

  // Cast queue
  castQueue:      (deviceId: string, videoIds: number[], startIndex = 0, position = 0) =>
    send<{ ok: boolean; queued: number }>(
      '/api/cast/queue',
      'POST',
      { deviceId, videoIds, startIndex, position }
    ),
  clearCastQueue: (deviceId: string) =>
    send<{ ok: boolean }>('/api/cast/queue', 'DELETE', { deviceId }),
  getCastQueue:   (deviceId: string) =>
    get<{ queue: CastQueueState | null }>(
      `/api/cast/queue?deviceId=${encodeURIComponent(deviceId)}`
    )
};
