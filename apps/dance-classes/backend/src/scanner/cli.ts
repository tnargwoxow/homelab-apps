import { loadConfig } from '../config.js';
import { openDb, runMigrations } from '../db/index.js';
import { walkLibrary } from './walker.js';

const config = loadConfig();
const db = openDb(config.dbPath);
runMigrations(db);

walkLibrary(db, config.videosDir)
  .then(summary => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
    db.close();
  })
  .catch(err => {
    console.error(err);
    db.close();
    process.exit(1);
  });
