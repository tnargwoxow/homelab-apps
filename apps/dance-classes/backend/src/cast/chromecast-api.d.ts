// chromecast-api ships no types; declare just what we use.
declare module 'chromecast-api' {
  export interface CastDevice {
    name: string;
    friendlyName: string;
    host: string;
    play(url: string, opts: Record<string, unknown>, cb: (err: Error | null) => void): void;
    pause(cb: (err: Error | null) => void): void;
    resume(cb: (err: Error | null) => void): void;
    stop(cb: (err: Error | null) => void): void;
    seekTo(seconds: number, cb: (err: Error | null) => void): void;
    getStatus(cb: (err: Error | null, status: unknown) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    close?: () => void;
  }

  export default class ChromecastAPI {
    constructor();
    on(event: 'device', listener: (device: CastDevice) => void): void;
    devices: CastDevice[];
    update?: () => void;
    destroy?: () => void;
  }
}
