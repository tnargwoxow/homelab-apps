import { spawn } from 'node:child_process';

export interface ProbeResult {
  durationSec: number | null;
}

export function ffprobe(absPath: string, timeoutMs = 30_000): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      absPath
    ];
    const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ffprobe timed out for ${absPath}`));
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
        return;
      }
      const trimmed = stdout.trim();
      const num = Number.parseFloat(trimmed);
      resolve({ durationSec: Number.isFinite(num) ? num : null });
    });
  });
}
