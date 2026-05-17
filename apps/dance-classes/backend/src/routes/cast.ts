import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import * as cast from '../cast/index.js';
import * as castQueue from '../cast/queue.js';
import type { DB } from '../db/index.js';

interface VideoRow {
  id: number;
  display_title: string;
  duration_sec: number | null;
}

function buildStreamUrl(req: FastifyRequest, videoId: number): string {
  // Allow operator override; otherwise reuse whatever host the phone is
  // connecting to (which by definition is reachable from the same LAN as
  // the Chromecast).
  const base = process.env.PUBLIC_BASE_URL ?? `http://${req.headers.host ?? '127.0.0.1'}`;
  return `${base.replace(/\/$/, '')}/api/videos/${videoId}/stream`;
}

interface PlayBody     { deviceId: string; videoId: number; position?: number }
interface DeviceBody   { deviceId: string }
interface SeekBody     { deviceId: string; position: number }

export async function registerCastRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get('/api/cast/devices', async () => {
    const list = cast.listDevices();
    // Refresh statuses for any devices currently playing.
    const liveStatuses = await cast.getAllStatuses();
    return {
      available: cast.isAvailable(),
      devices: list.map(d => ({ ...d, session: liveStatuses[d.id] ?? d.session }))
    };
  });

  app.post<{ Body: PlayBody }>('/api/cast/play', async (req, reply) => {
    const { deviceId, videoId, position } = req.body ?? ({} as PlayBody);
    if (!deviceId || !Number.isFinite(videoId)) {
      return reply.code(400).send({ error: 'deviceId and videoId required' });
    }
    const video = db
      .prepare<[number], VideoRow>('SELECT id, display_title, duration_sec FROM videos WHERE id = ?')
      .get(videoId);
    if (!video) return reply.code(404).send({ error: 'Video not found' });

    const url = buildStreamUrl(req, video.id);
    try {
      await cast.play(deviceId, url, {
        title: video.display_title,
        videoId: video.id,
        durationSec: video.duration_sec,
        startTime: position
      });
      return { ok: true, url };
    } catch (err) {
      return reply.code(500).send({ error: String((err as Error).message ?? err) });
    }
  });

  app.post<{ Body: DeviceBody }>('/api/cast/pause', async (req, reply) => {
    try { await cast.pause(req.body.deviceId); return { ok: true }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: DeviceBody }>('/api/cast/resume', async (req, reply) => {
    try { await cast.resume(req.body.deviceId); return { ok: true }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: SeekBody }>('/api/cast/seek', async (req, reply) => {
    const { deviceId, position } = req.body ?? ({} as SeekBody);
    if (!deviceId || !Number.isFinite(position)) {
      return reply.code(400).send({ error: 'deviceId and position required' });
    }
    try { await cast.seekTo(deviceId, position); return { ok: true }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: DeviceBody }>('/api/cast/stop', async (req, reply) => {
    try { await cast.stop(req.body.deviceId); return { ok: true }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: { deviceId: string; level: number } }>('/api/cast/volume', async (req, reply) => {
    const { deviceId, level } = req.body ?? ({} as { deviceId: string; level: number });
    if (!deviceId || !Number.isFinite(level)) {
      return reply.code(400).send({ error: 'deviceId and level (0..1) required' });
    }
    try { await cast.setVolume(deviceId, level); return { ok: true, level: Math.max(0, Math.min(1, level)) }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: { deviceId: string; delta: number } }>('/api/cast/volume/adjust', async (req, reply) => {
    const { deviceId, delta } = req.body ?? ({} as { deviceId: string; delta: number });
    if (!deviceId || !Number.isFinite(delta)) {
      return reply.code(400).send({ error: 'deviceId and delta required' });
    }
    try { const level = await cast.adjustVolume(deviceId, delta); return { ok: true, level }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.post<{ Body: { deviceId: string; muted: boolean } }>('/api/cast/mute', async (req, reply) => {
    const { deviceId, muted } = req.body ?? ({} as { deviceId: string; muted: boolean });
    if (!deviceId) return reply.code(400).send({ error: 'deviceId required' });
    try { await cast.setMuted(deviceId, !!muted); return { ok: true, muted: !!muted }; }
    catch (err) { return reply.code(500).send({ error: String((err as Error).message ?? err) }); }
  });

  app.get<{ Querystring: { deviceId: string } }>('/api/cast/status', async req => {
    if (!req.query?.deviceId) return { status: null };
    return { status: await cast.getStatus(req.query.deviceId) };
  });

  // -------------------------------------------------------------------------
  // Cast queue: a flat list of videoIds played back-to-back on a device.
  // Auto-advance happens server-side via the chromecast 'finished' event.
  // -------------------------------------------------------------------------
  interface QueueBody {
    deviceId: string;
    videoIds: number[];
    startIndex?: number;
    position?: number;
  }
  app.post<{ Body: QueueBody }>('/api/cast/queue', async (req, reply) => {
    const { deviceId, videoIds, startIndex, position } = req.body ?? ({} as QueueBody);
    if (!deviceId || !Array.isArray(videoIds) || videoIds.length === 0) {
      return reply.code(400).send({ error: 'deviceId and non-empty videoIds[] required' });
    }
    if (videoIds.some(v => !Number.isFinite(v))) {
      return reply.code(400).send({ error: 'videoIds must be numbers' });
    }

    // Validate every videoId exists before we lock anything in.
    const placeholders = videoIds.map(() => '?').join(',');
    const found = db
      .prepare<number[], { id: number }>(`SELECT id FROM videos WHERE id IN (${placeholders})`)
      .all(...videoIds);
    if (found.length !== new Set(videoIds).size) {
      return reply.code(400).send({ error: 'one or more videoIds do not exist' });
    }

    const safeStart = Number.isFinite(startIndex)
      ? Math.max(0, Math.min(Number(startIndex), videoIds.length - 1))
      : 0;
    const firstVideoId = videoIds[safeStart];

    const urlBase = (process.env.PUBLIC_BASE_URL ?? `http://${req.headers.host ?? '127.0.0.1'}`).replace(/\/$/, '');
    castQueue.setQueue(deviceId, videoIds, urlBase, safeStart);

    const video = db
      .prepare<[number], VideoRow>('SELECT id, display_title, duration_sec FROM videos WHERE id = ?')
      .get(firstVideoId);
    if (!video) {
      castQueue.clearQueue(deviceId);
      return reply.code(404).send({ error: 'Video not found' });
    }

    const url = buildStreamUrl(req, video.id);
    try {
      await cast.play(deviceId, url, {
        title: video.display_title,
        videoId: video.id,
        durationSec: video.duration_sec,
        startTime: position
      });
      return { ok: true, queued: videoIds.length };
    } catch (err) {
      castQueue.clearQueue(deviceId);
      return reply.code(500).send({ error: String((err as Error).message ?? err) });
    }
  });

  app.delete<{ Body: DeviceBody }>('/api/cast/queue', async (req, reply) => {
    const { deviceId } = req.body ?? ({} as DeviceBody);
    if (!deviceId) return reply.code(400).send({ error: 'deviceId required' });
    castQueue.clearQueue(deviceId);
    return { ok: true };
  });

  app.get<{ Querystring: { deviceId: string } }>('/api/cast/queue', async req => {
    const id = req.query?.deviceId;
    if (!id) return { queue: null };
    return { queue: castQueue.getQueue(id) ?? null };
  });
}
