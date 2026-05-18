declare module "better-sqlite3" {
  interface BackupProgress {
    totalPages: number;
    remainingPages: number;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement<Result = unknown> {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Result | undefined;
    all(...params: unknown[]): Result[];
  }

  class Database {
    constructor(filename: string, options?: Record<string, unknown>);
    prepare<Result = unknown>(source: string): Statement<Result>;
    transaction<F extends (...args: never[]) => unknown>(
      fn: F,
    ): (...args: Parameters<F>) => ReturnType<F>;
    backup(
      filename: string,
      options?: {
        attached?: string;
        progress?: (progress: BackupProgress) => number | undefined;
      },
    ): Promise<BackupProgress>;
    pragma(source: string): unknown;
    exec(source: string): this;
    close(): void;
  }

  export = Database;
}
