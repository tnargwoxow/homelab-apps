import ChromecastAPI from 'chromecast-api';
import type { CastDevice } from 'chromecast-api';
import { createRequire } from 'node:module';
import type { Logger } from '../types.js';
import type { DB } from '../db/index.js';

// chromecast-api 0.4.x is built on castv2-client / castv2 / multicast-dns.
// We need to reach into a couple of those for runtime fixes.
const _require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Runtime patch: castv2.Client.prototype.close throws when the underlying
// TLS socket has already been nulled by the close-event handler, which is
// exactly what happens when chromecast-api's error path also calls close().
// Make it null-safe so the play() callback receives the *real* connection
// error instead of a confusing "Cannot read properties of null" message.
// ---------------------------------------------------------------------------
type CastV2ClientLike = { socket: unknown; close: () => void; __patchedClose?: boolean };
try {
  const castv2 = _require('castv2') as { Client?: { prototype: CastV2ClientLike } };
  const proto = castv2.Client?.prototype;
  if (proto && !proto.__patchedClose) {
    const original = proto.close;
    proto.close = function (this: CastV2ClientLike) {
      if (!this.socket) return;
      try { return original.call(this); }
      catch { this.socket = null; }
    };
    proto.__patchedClose = true;
  }
} catch { /* castv2 not present */ }

// ---------------------------------------------------------------------------
// Resolve a Bonjour/mDNS hostname (foo.local) to an IPv4 address. Alpine's
// musl libc has no nss-mdns, so node's getaddrinfo can't see .local names,
// and chromecast-api's tls.connect() fails outright. We do the A-record
// query ourselves over multicast.
// ---------------------------------------------------------------------------
type MdnsResponse = { answers: Array<{ type: string; name: string; data: string }> };
type MdnsInstance = {
  on: (e: 'response', cb: (r: MdnsResponse) => void) => void;
  query: (q: { questions: Array<{ name: string; type: string }> }) => void;
  destroy: () => void;
};

async function resolveLocal(name: string, timeoutMs = 3000): Promise<string | null> {
  let mdns: MdnsInstance;
  try {
    const factory = _require('multicast-dns') as () => MdnsInstance;
    mdns = factory();
  } catch {
    return null;
  }
  return new Promise<string | null>(resolve => {
    let done = false;
    const finish = (ip: string | null) => {
      if (done) return;
      done = true;
      try { mdns.destroy(); } catch { /* ignore */ }
      resolve(ip);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    mdns.on('response', resp => {
      for (const a of resp.answers ?? []) {
        if (a.type === 'A' && a.name === name && typeof a.data === 'string') {
          clearTimeout(timer);
          finish(a.data);
          return;
        }
      }
    });
    try { mdns.query({ questions: [{ name, type: 'A' }] }); }
    catch { clearTimeout(timer); finish(null); }
  });
}

// ---------------------------------------------------------------------------

export interface CastDeviceInfo {
  id: string;
  name: string;
  host: string;
  session: CastSessionStatus | null;
}

export type CastPlayerState =
  | 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'stopped';

export interface CastSessionStatus {
  deviceId: string;
  videoId: number;
  title: string;
  state: CastPlayerState;
  position: number;
  duration: number | null;
  startedAt: number;
}

interface InternalSession {
  videoId: number;
  title: string;
  duration: number | null;
  startedAt: number;
  lastStatus: CastSessionStatus;
  lastFetched: number;
}

const STATUS_TTL_MS = 1000;

let api: ChromecastAPI | null = null;
let logger: Logger | null = null;
let dbRef: DB | null = null;
const devices = new Map<string, CastDevice>();
const sessions = new Map<string, InternalSession>();

function markWatchedInDb(videoId: number): void {
  if (!dbRef) return;
  try {
    dbRef.prepare(`
      INSERT INTO progress(video_id, watched, position_seconds, updated_at)
      VALUES (?, 1, 0, unixepoch())
      ON CONFLICT(video_id) DO UPDATE SET
        watched = 1,
        updated_at = unixepoch()
    `).run(videoId);
  } catch (err) {
    logger?.warn?.({ err, videoId }, 'failed to mark cast video as watched');
  }
}

function buildIdleStatus(deviceId: string, opts: { videoId: number; title: string; duration: number | null; startedAt: number; state?: CastPlayerState; position?: number }): CastSessionStatus {
  return {
    deviceId,
    videoId: opts.videoId,
    title: opts.title,
    state: opts.state ?? 'loading',
    position: opts.position ?? 0,
    duration: opts.duration,
    startedAt: opts.startedAt
  };
}

export function startCast(log: Logger, db?: DB): void {
  logger = log;
  dbRef = db ?? null;
  try {
    api = new ChromecastAPI();
  } catch (err) {
    log.warn({ err }, 'failed to start ChromecastAPI; cast disabled');
    api = null;
    return;
  }

  api.on('device', device => {
    void onDeviceDiscovered(device);
  });
}

async function onDeviceDiscovered(device: CastDevice): Promise<void> {
  // Replace the .local hostname with a resolved IPv4 — see top of file.
  if (device.host && /\.local\.?$/.test(device.host)) {
    const original = device.host;
    const ip = await resolveLocal(original.replace(/\.$/, ''));
    if (ip) {
      logger?.info?.({ name: device.friendlyName, host: original, ip }, 'cast device discovered (resolved)');
      device.host = ip;
    } else {
      logger?.warn?.({ name: device.friendlyName, host: original }, 'cast device discovered, .local lookup timed out');
    }
  } else {
    logger?.info?.({ name: device.friendlyName, host: device.host }, 'cast device discovered');
  }

  devices.set(device.host, device);

  try {
    device.on('finished', () => {
      const session = sessions.get(device.host);
      logger?.info?.({ host: device.host, videoId: session?.videoId }, 'cast playback finished');
      if (session) markWatchedInDb(session.videoId);
      sessions.delete(device.host);
    });
    device.on('disconnected', () => {
      logger?.info?.({ host: device.host }, 'cast device disconnected');
      sessions.delete(device.host);
    });
    device.on('error', (...args: unknown[]) => {
      logger?.warn?.({ host: device.host, err: args[0] }, 'cast device error');
    });
  } catch { /* defensive */ }
}

export function stopCast(): void {
  for (const [host] of devices) {
    try { devices.get(host)?.close?.(); } catch { /* ignore */ }
  }
  devices.clear();
  sessions.clear();
  try { api?.destroy?.(); } catch { /* ignore */ }
  api = null;
}

export function listDevices(): CastDeviceInfo[] {
  const out: CastDeviceInfo[] = [];
  for (const [id, device] of devices) {
    const s = sessions.get(id);
    out.push({
      id,
      name: device.friendlyName ?? device.name ?? id,
      host: device.host,
      session: s ? s.lastStatus : null
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

interface PlayOpts {
  title: string;
  videoId: number;
  durationSec: number | null;
  startTime?: number;
}

export function play(deviceId: string, mediaUrl: string, opts: PlayOpts): Promise<void> {
  const device = devices.get(deviceId);
  if (!device) return Promise.reject(new Error(`Cast device not found: ${deviceId}`));

  return new Promise((resolve, reject) => {
    // chromecast-api 0.4.x reads `opts.startTime` (seconds). Title etc are
    // ignored. Pass startTime here instead of running a separate seekTo
    // afterwards (which raced the player's IDLE → BUFFERING transition).
    const playOpts = opts.startTime && opts.startTime > 5
      ? { startTime: Math.floor(opts.startTime) }
      : {};

    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) {
        logger?.error?.({ err: err.message ?? err, deviceId, mediaUrl, host: device.host }, 'cast play failed');
        // After a connection failure, drop our cached Device so the next
        // discovery refresh can hand us a working one. The library's stale
        // Client object would just keep failing the same way.
        try { device.close?.(); } catch { /* ignore */ }
        devices.delete(deviceId);
        reject(err);
      } else {
        const startedAt = Date.now();
        sessions.set(deviceId, {
          videoId: opts.videoId,
          title: opts.title,
          duration: opts.durationSec,
          startedAt,
          lastStatus: buildIdleStatus(deviceId, {
            videoId: opts.videoId,
            title: opts.title,
            duration: opts.durationSec,
            startedAt,
            state: 'loading',
            position: opts.startTime ?? 0
          }),
          lastFetched: 0
        });
        resolve();
      }
    };

    try {
      device.play(mediaUrl, playOpts, (err: Error | null) => finish(err ?? undefined));
    } catch (err) {
      finish(err as Error);
    }
  });
}

function callDevice(deviceId: string, fn: (d: CastDevice, cb: (e: Error | null) => void) => void): Promise<void> {
  const device = devices.get(deviceId);
  if (!device) return Promise.reject(new Error(`Cast device not found: ${deviceId}`));
  return new Promise((resolve, reject) => {
    try { fn(device, err => err ? reject(err) : resolve()); }
    catch (err) { reject(err as Error); }
  });
}

export const pause  = (id: string) => callDevice(id, (d, cb) => d.pause(cb));
export const resume = (id: string) => callDevice(id, (d, cb) => d.resume(cb));
export const seekTo = (id: string, seconds: number) => callDevice(id, (d, cb) => d.seekTo(seconds, cb));

interface VolumeAware {
  setVolume: (level: number, cb: (e: Error | null) => void) => void;
  setVolumeMuted: (muted: boolean, cb: (e: Error | null) => void) => void;
  getVolume: (cb: (e: Error | null, v: { level?: number; muted?: boolean } | null) => void) => void;
}

export const setVolume = (id: string, level: number) =>
  callDevice(id, (d, cb) => (d as unknown as VolumeAware).setVolume(Math.max(0, Math.min(1, level)), cb));

export const setMuted = (id: string, muted: boolean) =>
  callDevice(id, (d, cb) => (d as unknown as VolumeAware).setVolumeMuted(muted, cb));

export async function adjustVolume(id: string, delta: number): Promise<number> {
  const device = devices.get(id);
  if (!device) throw new Error(`Cast device not found: ${id}`);
  const v = await new Promise<{ level: number; muted: boolean }>((resolve) => {
    (device as unknown as VolumeAware).getVolume((err, raw) => {
      const level = (!err && raw && typeof raw.level === 'number') ? raw.level : 0.5;
      const muted = (!err && raw && typeof raw.muted === 'boolean') ? raw.muted : false;
      resolve({ level, muted });
    });
  });
  const next = Math.max(0, Math.min(1, v.level + delta));
  await setVolume(id, next);
  return next;
}

export async function stop(deviceId: string): Promise<void> {
  await callDevice(deviceId, (d, cb) => d.stop(cb));
  sessions.delete(deviceId);
}

interface RawCastStatus {
  playerState?: string;
  currentTime?: number;
  media?: { duration?: number };
}

function mapPlayerState(raw: string | undefined): CastPlayerState {
  switch ((raw ?? '').toUpperCase()) {
    case 'PLAYING': return 'playing';
    case 'PAUSED':  return 'paused';
    case 'BUFFERING': return 'buffering';
    case 'IDLE':    return 'idle';
    default:        return 'stopped';
  }
}

export async function getStatus(deviceId: string): Promise<CastSessionStatus | null> {
  const device = devices.get(deviceId);
  const session = sessions.get(deviceId);
  if (!device || !session) return null;

  const now = Date.now();
  if (now - session.lastFetched < STATUS_TTL_MS) {
    return session.lastStatus;
  }
  session.lastFetched = now;

  try {
    const raw = await new Promise<RawCastStatus | null>((resolve) => {
      device.getStatus((err, status) => {
        if (err || !status) return resolve(null);
        resolve(status as RawCastStatus);
      });
    });
    if (raw) {
      session.lastStatus = {
        deviceId,
        videoId: session.videoId,
        title: session.title,
        state: mapPlayerState(raw.playerState),
        position: typeof raw.currentTime === 'number' ? raw.currentTime : session.lastStatus.position,
        duration: raw.media?.duration ?? session.duration,
        startedAt: session.startedAt
      };
    }
  } catch (err) {
    logger?.debug?.({ err }, 'cast getStatus failed');
  }
  return session.lastStatus;
}

export async function getAllStatuses(): Promise<Record<string, CastSessionStatus>> {
  const out: Record<string, CastSessionStatus> = {};
  for (const id of sessions.keys()) {
    const s = await getStatus(id);
    if (s) out[id] = s;
  }
  return out;
}

export function isAvailable(): boolean {
  return api !== null;
}
