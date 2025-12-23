import type { DbAdapter } from './types';

// Singleton adapter instance
let adapter: DbAdapter | null = null;
let schemaInitPromise: Promise<void> | null = null;

/**
 * Get the database adapter based on environment configuration.
 * - If DATABASE_URL is set, uses PostgreSQL (Neon)
 * - Otherwise, uses SQLite (local file)
 *
 * Schema is initialized once on first adapter creation.
 */
export function getAdapter(): DbAdapter {
  if (adapter) {
    return adapter;
  }

  let newAdapter: DbAdapter;

  if (process.env.DATABASE_URL) {
    // Use PostgreSQL (Neon serverless)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPostgresAdapter } = require('./adapters/postgres');
    newAdapter = createPostgresAdapter();
  } else {
    // Check if we're on Vercel - SQLite won't work there
    if (process.env.VERCEL) {
      throw new Error(
        'SQLite cannot be used on Vercel (read-only filesystem). ' +
          'Please set DATABASE_URL to use Neon PostgreSQL.'
      );
    }
    // Use SQLite for local development
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSqliteAdapter } = require('./adapters/sqlite');
    newAdapter = createSqliteAdapter();
  }

  // Cache the adapter
  adapter = newAdapter;

  // Initialize schema once (fire and forget, but cache the promise)
  schemaInitPromise = newAdapter.initSchema().catch((err) => {
    console.error('Failed to initialize database schema:', err);
    throw err;
  });

  return newAdapter;
}

/**
 * Ensure the database schema is initialized.
 * Call this before making queries if you need to guarantee schema exists.
 */
export async function ensureSchema(): Promise<void> {
  getAdapter(); // Ensure adapter is created
  if (schemaInitPromise) {
    await schemaInitPromise;
  }
}

/**
 * Initialize the database (creates schema if needed).
 * Call this on application startup.
 */
export async function initDatabase(): Promise<void> {
  await ensureSchema();
}

/**
 * Close the database connection.
 * Call this on application shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
    schemaInitPromise = null;
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
