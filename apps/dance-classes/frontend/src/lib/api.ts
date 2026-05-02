export interface BreadcrumbItem { id: number; name: string; }

export interface FolderSummary { id: number; name: string; childCount: number; thumbVideoIds: number[]; }

export interface VideoListItem {
  id: number;
  title: string;
  episodeNum: number | null;
  filename: string;
  durationSec: number | null;
  hasThumb: boolean;
  scanStatus: string;
  position: number;
  watched: boolean;
  favorite: boolean;
}

export interface FolderPayload {
  folder: { id: number | null; name: string; relPath: string; parentId: number | null };
  breadcrumb: BreadcrumbItem[];
  folders: FolderSummary[];
  videos: VideoListItem[];
}

export interface VideoMeta {
  id: number;
  title: string;
  filename: string;
  episodeNum: number | null;
  durationSec: number | null;
  sizeBytes: number;
  hasThumb: boolean;
  scanStatus: string;
  folderId: number;
  breadcrumb: BreadcrumbItem[];
  progress: { position: number; duration: number | null; watched: boolean };
  favorite: boolean;
  siblings: Array<{ id: number; title: string; episodeNum: number | null; filename: string; current: boolean }>;
  prevId: number | null;
  nextId: number | null;
}

export interface RecentItem {
  id: number;
  title: string;
  durationSec: number | null;
  hasThumb: boolean;
  folderId: number;
  position: number;
  progressDuration: number | null;
  watched: boolean;
  updatedAt: number;
}

export interface FavoriteItem {
  id: number;
  title: string;
  durationSec: number | null;
  hasThumb: boolean;
  folderId: number;
  createdAt: number;
  position: number;
  watched: boolean;
}

export type SearchItem =
  | {
      kind: 'video';
      id: number;
      title: string;
      path: string;
      snippet: string;
      durationSec: number | null;
      hasThumb: boolean;
      folderId: number | null;
      position: number;
      watched: boolean;
    }
  | { kind: 'folder'; id: number; title: string; path: string; snippet: string };

export interface LibraryStatus {
  scanning: boolean;
  total: number;
  probed: number;
  thumbnailed: number;
  errored: number;
  queueDepth: number;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

export const api = {
  rootFolder: () => get<FolderPayload>('/api/folders/root'),
  folder: (id: number) => get<FolderPayload>(`/api/folders/${id}`),
  video: (id: number) => get<VideoMeta>(`/api/videos/${id}`),
  recent: (limit = 20) => get<{ items: RecentItem[] }>(`/api/recent?limit=${limit}`),
  continueWatching: (limit = 20) => get<{ items: RecentItem[] }>(`/api/continue?limit=${limit}`),
  favorites: () => get<{ items: FavoriteItem[] }>('/api/favorites'),
  search: (q: string, limit = 50) =>
    get<{ items: SearchItem[] }>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  status: () => get<LibraryStatus>('/api/library/status'),
  rescan: () => send<{ ok: boolean }>('/api/library/rescan', 'POST'),
  saveProgress: (id: number, position: number, duration: number | null) =>
    send<{ ok: boolean }>(`/api/videos/${id}/progress`, 'POST', { position, duration }),
  setWatched: (id: number, watched: boolean) =>
    send<{ ok: boolean; watched: boolean }>(`/api/videos/${id}/watched`, 'POST', { watched }),
  addFavorite: (id: number) => send<{ ok: boolean }>(`/api/favorites/${id}`, 'POST'),
  removeFavorite: (id: number) => send<{ ok: boolean }>(`/api/favorites/${id}`, 'DELETE'),
  thumbUrl: (id: number) => `/api/videos/${id}/thumb`,
  streamUrl: (id: number) => `/api/videos/${id}/stream`
};

export function sendProgressBeacon(id: number, position: number, duration: number | null): void {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  const blob = new Blob([JSON.stringify({ position, duration })], { type: 'application/json' });
  navigator.sendBeacon(`/api/videos/${id}/progress`, blob);
}
