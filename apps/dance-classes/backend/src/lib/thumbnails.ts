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
    const args = [
      '-ss', seekSec.toFixed(2),
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=320:-2',
      '-q:v', '5',
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
