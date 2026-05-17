import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface ThumbnailOpts {
  videoPath: string;
  outPath: string;
  durationSec: number | null;
}

export function generateThumbnail({ videoPath, outPath, durationSec }: ThumbnailOpts, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    // Pick a sensible seek point: ~10% into the video, or 1s for very short clips.
    let seekSec = 5;
    if (durationSec !== null && durationSec > 0) {
      seekSec = durationSec < 30 ? Math.min(1, Math.max(0, durationSec / 4)) : durationSec * 0.1;
    }
    // -ss before -i is the fast input-side seek (jumps via container index, no
    // decoding up to the seek point).
    // -an / -sn skip audio + subtitle streams entirely.
    // -update 1 + image2 keeps the muxer simple for a single-frame output.
    // -threads 1 prevents ffmpeg from spawning N decoder threads when the
    // queue itself is what controls parallelism.
    // -loglevel error keeps stderr quiet so the pipe doesn't fill up.
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-ss', seekSec.toFixed(2),
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=320:-2',
      '-q:v', '5',
      '-an',
      '-sn',
      '-threads', '1',
      '-update', '1',
      '-f', 'image2',
      '-y',
      outPath
    ];
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ffmpeg thumbnail timed out for ${videoPath}`));
    }, timeoutMs);
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code}: ${stderr.split('\n').slice(-3).join(' | ').trim()}`));
        return;
      }
      resolve();
    });
  });
}
