import session from 'express-session';
import { env } from '../env';
import { SqliteSessionStore } from './sqliteSessionStore';

const SHIFT_LENGTH_MS = 12 * 60 * 60 * 1000; // 12 hours — absolute session ceiling
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours idle timeout (rolling)

export const sessionMiddleware = session({
  store: new SqliteSessionStore(),
  secret: env.sessionSecret,
  name: 'itred.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: IDLE_TIMEOUT_MS,
  },
});

export const ABSOLUTE_SESSION_CEILING_MS = SHIFT_LENGTH_MS;

declare module 'express-session' {
  interface SessionData {
    staffId?: string;
    staffCode?: string;
    loginAt?: number;
  }
}
