import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import * as cast from '../cast/index.js';
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
}
