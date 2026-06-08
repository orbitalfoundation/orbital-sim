// Shared SQLite connection for all data agents.
// Module-level singleton — one connection per process, shared across all bus instances.
// WAL mode allows concurrent reads while writes are in progress.
//
// DB file: $ORBITAL_DATA_DIR/db/signals.db  (production, bind-mounted)
//          public/.data/db/signals.db        (dev fallback)

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const _dir      = dirname(fileURLToPath(import.meta.url));
const _repoRoot = join(_dir, '../../..');

// DATA_DIR is the bind-mounted data directory. Set ORBITAL_DATA_DIR in .env for
// production; falls back to repo-local public/.data/ for development.
export const DATA_DIR = process.env.ORBITAL_DATA_DIR
  ?? join(_repoRoot, 'public/.data');

export const DB_PATH = join(DATA_DIR, 'db/signals.db');

let _db = null;

export function getDb() {
  if (_db) return _db;
  mkdirSync(join(DATA_DIR, 'db'), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // concurrent reads + writes
  _db.pragma('synchronous = NORMAL'); // safe with WAL, faster than FULL
  _db.pragma('foreign_keys = ON');
  _db.pragma('temp_store = MEMORY');
  return _db;
}
