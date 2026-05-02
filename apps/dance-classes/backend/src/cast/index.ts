import ChromecastAPI from 'chromecast-api';
import type { CastDevice } from 'chromecast-api';
import type { Logger } from '../types.js';

export interface CastDeviceInfo {
  id: string;        // device.host (stable for the LAN)
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
  position: number;          // seconds
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
const devices = new Map<string, CastDevice>();
const sessions = new Map<string, InternalSession>();

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

export function startCast(log: Logger): void {
  logger = log;
  try {
    api = new ChromecastAPI();
  } catch (err) {
    log.warn({ err }, 'failed to start ChromecastAPI; cast disabled');
    api = null;
    return;
  }

  api.on('device', device => {
    devices.set(device.host, device);
    log.info({ host: device.host, name: device.friendlyName }, 'cast device discovered');

    // Many cast libs don't strongly type events; wrap defensively.
    try {
      device.on('finished', () => {
        log?.info?.({ host: device.host }, 'cast playback finished');
        sessions.delete(device.host);
      });
      device.on('disconnected', () => {
        log?.info?.({ host: device.host }, 'cast device disconnected');
        sessions.delete(device.host);
      });
    } catch {
      /* no-op */
    }
  });
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
    // chromecast-api 0.4.x reads `opts.startTime` (seconds) and ignores
    // anything else — title/contentType were no-ops and the manual seekTo
    // we used to fire 1.8s later was racing the player's IDLE → BUFFERING
    // transition and triggering the 500. Pass startTime here instead.
    const playOpts = opts.startTime && opts.startTime > 5
      ? { startTime: Math.floor(opts.startTime) }
      : {};

    device.play(mediaUrl, playOpts, (err: Error | null) => {
      if (err) {
        logger?.error?.({ err, deviceId, mediaUrl }, 'cast play failed');
        return reject(err);
      }

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
    });
  });
}

function callDevice(deviceId: string, fn: (d: CastDevice, cb: (e: Error | null) => void) => void): Promise<void> {
  const device = devices.get(deviceId);
  if (!device) return Promise.reject(new Error(`Cast device not found: ${deviceId}`));
  return new Promise((resolve, reject) => {
    fn(device, err => err ? reject(err) : resolve());
  });
}

export const pause  = (id: string) => callDevice(id, (d, cb) => d.pause(cb));
export const resume = (id: string) => callDevice(id, (d, cb) => d.resume(cb));
export const seekTo = (id: string, seconds: number) => callDevice(id, (d, cb) => d.seekTo(seconds, cb));

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
