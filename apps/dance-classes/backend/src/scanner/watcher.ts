import chokidar, { type FSWatcher } from 'chokidar';
import type { DB } from '../db/index.js';
import type { Logger } from '../types.js';
import { walkLibrary } from './walker.js';

interface WatcherOpts {
  db: DB;
  videosDir: string;
  logger: Logger;
  onChange: () => void;
}

export function startWatcher({ db, videosDir, logger, onChange }: WatcherOpts): FSWatcher {
  let pending: NodeJS.Timeout | null = null;
  const debounce = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      pending = null;
      try {
        const summary = await walkLibrary(db, videosDir);
        logger.info({ summary }, 'watcher rescan');
        onChange();
      } catch (err) {
        logger.error({ err }, 'watcher rescan failed');
      }
    }, 2000);
  };

  const watcher = chokidar.watch(videosDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 5000, pollInterval: 1000 },
    ignored: /(^|[/\\])\../
  });
  watcher.on('add', debounce).on('unlink', debounce).on('addDir', debounce).on('unlinkDir', debounce);
  watcher.on('error', err => logger.error({ err }, 'watcher error'));
  return watcher;
}
