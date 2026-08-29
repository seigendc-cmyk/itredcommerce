import 'dotenv/config';
import path from 'node:path';

export const env = {
  apiPort: Number(process.env.API_PORT) || 4000,
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || './data/itred.db'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
};
