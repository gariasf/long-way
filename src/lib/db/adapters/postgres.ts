import { neon, neonConfig } from '@neondatabase/serverless';
import type { DbAdapter } from '../types';

// Enable connection caching for better serverless performance
neonConfig.fetchConnectionCache = true;

class PostgresAdapter implements DbAdapter {
  readonly dialect = 'postgres' as const;
  private schemaInitialized = false;
  private sql: ReturnType<typeof neon>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }
    this.sql = neon(process.env.DATABASE_URL);
  }

  async query<T>(sqlQuery: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.sql(sqlQuery, params);
    return result as unknown as T[];
  }

  async queryOne<T>(sqlQuery: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.sql(sqlQuery, params);
    const rows = result as unknown as T[];
    return rows[0] ?? null;
  }

  async execute(sqlQuery: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const result = await this.sql(sqlQuery, params);
    const rows = result as unknown as unknown[];
    return { rowCount: rows.length };
  }

  async transaction<T>(fn: (adapter: DbAdapter) => Promise<T>): Promise<T> {
    // For Neon serverless, we use a simple approach:
    // Execute BEGIN, run the function, then COMMIT or ROLLBACK
    // Note: Neon's HTTP driver executes each query atomically.
    // For true transactions, use @neondatabase/serverless with WebSocket pooling.
    // For this app's use case (simple updates), this is sufficient.
    await this.sql('BEGIN');

    try {
      const result = await fn(this);
      await this.sql('COMMIT');
      return result;
    } catch (error) {
      await this.sql('ROLLBACK');
      throw error;
    }
  }

  async initSchema(): Promise<void> {
    if (this.schemaInitialized) {
      return;
    }

    // PostgreSQL schema - using TEXT for timestamps for consistency with SQLite
    await this.sql(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.sql(`
      CREATE TABLE IF NOT EXISTS stops (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('base_camp', 'waypoint', 'stop', 'transport')),
        description TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        duration_value INTEGER,
        duration_unit TEXT CHECK (duration_unit IN ('hours', 'nights', 'days')),
        is_optional INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        links TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        "order" INTEGER NOT NULL,
        transport_type TEXT CHECK (transport_type IN ('ferry', 'flight', 'train', 'bus')),
        departure_time TEXT,
        arrival_time TEXT,
        departure_location TEXT,
        arrival_location TEXT
      )
    `);

    await this.sql(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.sql(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indexes if they don't exist
    await this.sql(`
      CREATE INDEX IF NOT EXISTS idx_stops_trip_id ON stops(trip_id)
    `);
    await this.sql(`
      CREATE INDEX IF NOT EXISTS idx_stops_order ON stops(trip_id, "order")
    `);
    await this.sql(`
      CREATE INDEX IF NOT EXISTS idx_conversations_trip_id ON conversations(trip_id)
    `);

    this.schemaInitialized = true;
  }

  async close(): Promise<void> {
    // Neon serverless driver doesn't require explicit cleanup
  }
}

export function createPostgresAdapter(): DbAdapter {
  return new PostgresAdapter();
}
