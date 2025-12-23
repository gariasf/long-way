import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { DbAdapter } from '../types';
import { toSqlitePlaceholders } from '../adapter';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'longway.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

class SqliteAdapter implements DbAdapter {
  readonly dialect = 'sqlite' as const;
  private schemaInitialized = false;

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const sqlite = getDb();
    const convertedSql = toSqlitePlaceholders(sql);
    return sqlite.prepare(convertedSql).all(...params) as T[];
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const sqlite = getDb();
    const convertedSql = toSqlitePlaceholders(sql);
    const result = sqlite.prepare(convertedSql).get(...params) as T | undefined;
    return result ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const sqlite = getDb();
    const convertedSql = toSqlitePlaceholders(sql);
    const result = sqlite.prepare(convertedSql).run(...params);
    return { rowCount: result.changes };
  }

  async transaction<T>(fn: (adapter: DbAdapter) => Promise<T>): Promise<T> {
    const sqlite = getDb();

    // Manual transaction management for async functions
    try {
      sqlite.exec('BEGIN');
      const result = await fn(this);
      sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  async initSchema(): Promise<void> {
    if (this.schemaInitialized) {
      return;
    }

    const sqlite = getDb();
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stops (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('base_camp', 'waypoint', 'stop', 'transport')),
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
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
        arrival_location TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stops_trip_id ON stops(trip_id);
      CREATE INDEX IF NOT EXISTS idx_stops_order ON stops(trip_id, "order");
      CREATE INDEX IF NOT EXISTS idx_conversations_trip_id ON conversations(trip_id);
    `);

    this.schemaInitialized = true;
  }

  async close(): Promise<void> {
    if (db) {
      db.close();
      db = null;
    }
  }
}

export function createSqliteAdapter(): DbAdapter {
  return new SqliteAdapter();
}
