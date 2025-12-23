import type { DbAdapter } from './types';

// Singleton adapter instance
let adapter: DbAdapter | null = null;

/**
 * Get the database adapter based on environment configuration.
 * - If DATABASE_URL is set, uses PostgreSQL (Vercel Postgres)
 * - Otherwise, uses SQLite (local file)
 */
export function getAdapter(): DbAdapter {
  if (adapter) {
    return adapter;
  }

  if (process.env.DATABASE_URL) {
    // Dynamic import to avoid loading postgres module when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPostgresAdapter } = require('./adapters/postgres');
    adapter = createPostgresAdapter();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSqliteAdapter } = require('./adapters/sqlite');
    adapter = createSqliteAdapter();
  }

  return adapter!;
}

/**
 * Initialize the database (creates schema if needed).
 * Call this on application startup.
 */
export async function initDatabase(): Promise<void> {
  const db = getAdapter();
  await db.initSchema();
}

/**
 * Close the database connection.
 * Call this on application shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

/**
 * Convert $1, $2, ... placeholders to ? for SQLite.
 * PostgreSQL uses $1, $2 natively.
 */
export function toSqlitePlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

/**
 * Get current timestamp SQL for the given dialect.
 */
export function nowSql(dialect: 'sqlite' | 'postgres'): string {
  return dialect === 'sqlite' ? "datetime('now')" : 'NOW()';
}
