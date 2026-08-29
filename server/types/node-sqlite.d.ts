// Minimal ambient typings for Node's built-in `node:sqlite` module.
// It ships with Node 22.5+/24 but @types/node in this project's pinned
// version doesn't declare it yet — this covers only the surface we use.
declare module 'node:sqlite' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export type SqlBindable = string | number | bigint | boolean | Buffer | Uint8Array | null;

  export class StatementSync {
    run(...params: SqlBindable[]): RunResult;
    get(...params: SqlBindable[]): any;
    all(...params: SqlBindable[]): any[];
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
