import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env';

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

export const db = new DatabaseSync(env.dbPath, { enableForeignKeyConstraints: true });
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/**
 * Runs `fn` inside a SQLite transaction, committing on success and rolling
 * back on any thrown error. Mirrors better-sqlite3's `db.transaction(fn)`
 * helper, which node:sqlite's DatabaseSync doesn't provide natively.
 */
export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure — original error is what matters
    }
    throw err;
  }
}

export default db;
