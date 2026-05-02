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

export interface StatsPayload {
  total: {
    classesStarted: number;
    classesCompleted: number;
    seconds: number;
    favorites: number;
    videosInLibrary: number;
    daysPracticed: number;
  };
  thisWeek:  { classes: number; seconds: number; days: number };
  thisMonth: { classes: number; seconds: number; days: number };
  streak: { current: number; longest: number };
  daily30:  Array<{ day: string; classes: number; seconds: number }>;
  weekly12: Array<{ week_start: string; classes: number; seconds: number }>;
  topVideos: Array<{
    id: number; title: string; durationSec: number | null;
    hasThumb: boolean; folderId: number; folderName: string;
    position: number; watched: boolean; updatedAt: number;
  }>;
  topFolders: Array<{
    id: number; name: string; classesStarted: number;
    classesCompleted: number; seconds: number;
  }>;
}

async function describeError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    if (typeof data?.error === 'string')   return data.error;
    if (typeof data?.message === 'string') return data.message;
  } catch { /* not JSON */ }
  try { return (await res.text()).trim(); } catch { return ''; }
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const detail = await describeError(res);
    throw new Error(detail ? `${res.status}: ${detail}` : `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  // Critical: only set Content-Type: application/json when we actually have
  // a body. Fastify rejects POST with that header but no body
  // (FST_ERR_CTP_EMPTY_JSON_BODY) — which was breaking add-favorite,
  // remove-favorite, manual rescan, etc.
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const detail = await describeError(res);
    throw new Error(detail ? `${res.status}: ${detail}` : `${res.status} ${res.statusText}`);
  }
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
  resetProgress: (id: number) =>
    send<{ ok: boolean }>(`/api/videos/${id}/progress`, 'DELETE'),
  setWatched: (id: number, watched: boolean) =>
    send<{ ok: boolean; watched: boolean }>(`/api/videos/${id}/watched`, 'POST', { watched }),
  stats: () => get<StatsPayload>('/api/stats'),
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
