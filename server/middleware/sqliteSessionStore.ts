import session from 'express-session';
import { db } from '../db/connection';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimal express-session Store backed by our own SQLite `sessions` table.
 * Chosen over a third-party sqlite-session package to avoid depending on an
 * obscure/less-maintained library for something this small and security
 * sensitive — sessions survive server restarts, same as the requirement.
 */
export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    // Best-effort cleanup of expired sessions on boot. Swallow errors: this
    // runs at module-load time, which (via ESM import evaluation order) is
    // before index.ts's runMigrations() call — on a brand-new database the
    // sessions table doesn't exist yet, and there's nothing to clean up.
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    } catch {
      // no-op — table not created yet
    }
  }

  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
    try {
      const row = db
        .prepare('SELECT session_json, expires_at FROM sessions WHERE sid = ?')
        .get(sid) as { session_json: string; expires_at: number } | undefined;
      if (!row || row.expires_at < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.session_json));
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? ONE_DAY_MS;
      const expiresAt = Date.now() + maxAge;
      db.prepare(
        `INSERT INTO sessions (sid, session_json, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET session_json = excluded.session_json, expires_at = excluded.expires_at`
      ).run(sid, JSON.stringify(sessionData), expiresAt);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, sessionData: session.SessionData, callback?: () => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? ONE_DAY_MS;
      const expiresAt = Date.now() + maxAge;
      db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(expiresAt, sid);
      callback?.();
    } catch {
      callback?.();
    }
  }
}
