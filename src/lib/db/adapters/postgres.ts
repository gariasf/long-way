import { sql, db as vercelDb } from '@vercel/postgres';
import type { DbAdapter } from '../types';

class PostgresAdapter implements DbAdapter {
  readonly dialect = 'postgres' as const;

  async query<T>(sqlQuery: string, params: unknown[] = []): Promise<T[]> {
    // Use tagged template literal for @vercel/postgres
    const result = await vercelDb.query(sqlQuery, params);
    return result.rows as T[];
  }

  async queryOne<T>(sqlQuery: string, params: unknown[] = []): Promise<T | null> {
    const result = await vercelDb.query(sqlQuery, params);
    return (result.rows[0] as T) ?? null;
  }

  async execute(sqlQuery: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const result = await vercelDb.query(sqlQuery, params);
    return { rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: (adapter: DbAdapter) => Promise<T>): Promise<T> {
    // Start transaction
    await vercelDb.query('BEGIN');

    try {
      const result = await fn(this);
      await vercelDb.query('COMMIT');
      return result;
    } catch (error) {
      await vercelDb.query('ROLLBACK');
      throw error;
    }
  }

  async initSchema(): Promise<void> {
    // PostgreSQL schema - similar to SQLite but with Postgres-specific syntax
    await vercelDb.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await vercelDb.query(`
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

    await vercelDb.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await vercelDb.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indexes if they don't exist (Postgres syntax)
    await vercelDb.query(`
      CREATE INDEX IF NOT EXISTS idx_stops_trip_id ON stops(trip_id)
    `);
    await vercelDb.query(`
      CREATE INDEX IF NOT EXISTS idx_stops_order ON stops(trip_id, "order")
    `);
    await vercelDb.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_trip_id ON conversations(trip_id)
    `);
  }

  async close(): Promise<void> {
    // @vercel/postgres manages connection pooling automatically
    // No explicit close needed
  }
}

export function createPostgresAdapter(): DbAdapter {
  return new PostgresAdapter();
}
