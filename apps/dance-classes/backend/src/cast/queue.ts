// In-memory cast queue keyed by deviceId (== device.host in the rest of the
// cast layer). Lost on backend restart — that's an explicit product choice
// since LAN-only single-user use makes a persistent queue unnecessary.

export interface CastQueueState {
  videoIds: number[];
  index: number;
  urlBase: string;
}

const queues = new Map<string, CastQueueState>();

export function setQueue(
  deviceId: string,
  videoIds: number[],
  urlBase: string,
  startIndex = 0
): void {
  const safeStart = Number.isFinite(startIndex)
    ? Math.max(0, Math.min(startIndex, Math.max(0, videoIds.length - 1)))
    : 0;
  queues.set(deviceId, { videoIds: [...videoIds], index: safeStart, urlBase });
}

export function getQueue(deviceId: string): CastQueueState | undefined {
  return queues.get(deviceId);
}

/**
 * Advance the queue for `deviceId` to the next item. Returns the new
 * videoId (and the urlBase needed to build a stream URL) or null if the
 * queue is empty / exhausted (in which case the queue is also cleared).
 */
export function advance(
  deviceId: string
): { videoId: number; urlBase: string } | null {
  const q = queues.get(deviceId);
  if (!q) return null;
  const nextIndex = q.index + 1;
  if (nextIndex >= q.videoIds.length) {
    queues.delete(deviceId);
    return null;
  }
  q.index = nextIndex;
  return { videoId: q.videoIds[nextIndex], urlBase: q.urlBase };
}

export function clearQueue(deviceId: string): void {
  queues.delete(deviceId);
}
