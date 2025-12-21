import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Trip, Stop, StopRow, rowToStop, CreateStopRequest, UpdateStopRequest } from './schemas';

// Database path - store in data directory at project root
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'longway.db');

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
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
}

// Trip operations
export function getAllTrips(): Trip[] {
  const db = getDb();
  return db.prepare('SELECT * FROM trips ORDER BY updated_at DESC').all() as Trip[];
}

export function getTripById(id: string): Trip | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as Trip | undefined;
}

export function createTrip(name: string, description?: string): Trip {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO trips (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, now, now);

  return getTripById(id)!;
}

export function updateTrip(id: string, updates: { name?: string; description?: string | null }): Trip | undefined {
  const db = getDb();
  const trip = getTripById(id);
  if (!trip) return undefined;

  const name = updates.name ?? trip.name;
  const description = updates.description ?? trip.description;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE trips SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, now, id);

  return getTripById(id);
}

export function deleteTrip(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM trips WHERE id = ?').run(id);
  return result.changes > 0;
}

// Stop operations
export function getStopsByTripId(tripId: string): Stop[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM stops WHERE trip_id = ? ORDER BY "order"').all(tripId) as StopRow[];
  return rows.map(rowToStop);
}

export function getStopById(id: string): Stop | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM stops WHERE id = ?').get(id) as StopRow | undefined;
  return row ? rowToStop(row) : undefined;
}

export function getNextOrder(tripId: string): number {
  const db = getDb();
  const result = db.prepare('SELECT MAX("order") as max_order FROM stops WHERE trip_id = ?').get(tripId) as { max_order: number | null };
  return (result.max_order ?? -1) + 1;
}

export function createStop(tripId: string, data: CreateStopRequest): Stop {
  const db = getDb();
  const id = uuidv4();
  const order = data.order ?? getNextOrder(tripId);

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO stops (
        id, trip_id, name, type, description, latitude, longitude,
        duration_value, duration_unit, is_optional, tags, links, notes, "order",
        transport_type, departure_time, arrival_time, departure_location, arrival_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tripId,
      data.name,
      data.type,
      data.description || null,
      data.latitude,
      data.longitude,
      data.duration_value ?? null,
      data.duration_unit ?? null,
      data.is_optional ? 1 : 0,
      JSON.stringify(data.tags || []),
      JSON.stringify(data.links || []),
      data.notes || null,
      order,
      data.transport_type || null,
      data.departure_time || null,
      data.arrival_time || null,
      data.departure_location || null,
      data.arrival_location || null
    );

    // Update trip's updated_at
    db.prepare('UPDATE trips SET updated_at = datetime("now") WHERE id = ?').run(tripId);
  });

  transaction();
  return getStopById(id)!;
}

export function updateStop(id: string, updates: UpdateStopRequest): Stop | undefined {
  const db = getDb();
  const stop = getStopById(id);
  if (!stop) return undefined;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.latitude !== undefined) { fields.push('latitude = ?'); values.push(updates.latitude); }
  if (updates.longitude !== undefined) { fields.push('longitude = ?'); values.push(updates.longitude); }
  if (updates.duration_value !== undefined) { fields.push('duration_value = ?'); values.push(updates.duration_value); }
  if (updates.duration_unit !== undefined) { fields.push('duration_unit = ?'); values.push(updates.duration_unit); }
  if (updates.is_optional !== undefined) { fields.push('is_optional = ?'); values.push(updates.is_optional ? 1 : 0); }
  if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
  if (updates.links !== undefined) { fields.push('links = ?'); values.push(JSON.stringify(updates.links)); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.order !== undefined) { fields.push('"order" = ?'); values.push(updates.order); }
  if (updates.transport_type !== undefined) { fields.push('transport_type = ?'); values.push(updates.transport_type); }
  if (updates.departure_time !== undefined) { fields.push('departure_time = ?'); values.push(updates.departure_time); }
  if (updates.arrival_time !== undefined) { fields.push('arrival_time = ?'); values.push(updates.arrival_time); }
  if (updates.departure_location !== undefined) { fields.push('departure_location = ?'); values.push(updates.departure_location); }
  if (updates.arrival_location !== undefined) { fields.push('arrival_location = ?'); values.push(updates.arrival_location); }

  if (fields.length === 0) return stop;

  const transaction = db.transaction(() => {
    values.push(id);
    db.prepare(`UPDATE stops SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Update trip's updated_at
    db.prepare('UPDATE trips SET updated_at = datetime("now") WHERE id = ?').run(stop.trip_id);
  });

  transaction();
  return getStopById(id);
}

export function deleteStop(id: string): boolean {
  const db = getDb();
  const stop = getStopById(id);
  if (!stop) return false;

  const tripId = stop.trip_id;
  let deleted = false;

  const transaction = db.transaction(() => {
    const result = db.prepare('DELETE FROM stops WHERE id = ?').run(id);
    deleted = result.changes > 0;

    if (deleted) {
      // Update trip's updated_at
      db.prepare('UPDATE trips SET updated_at = datetime("now") WHERE id = ?').run(tripId);
    }
  });

  transaction();
  return deleted;
}

export function reorderStops(tripId: string, stopIds: string[]): boolean {
  const db = getDb();
  const updateStmt = db.prepare('UPDATE stops SET "order" = ? WHERE id = ? AND trip_id = ?');

  const transaction = db.transaction(() => {
    for (let i = 0; i < stopIds.length; i++) {
      updateStmt.run(i, stopIds[i], tripId);
    }
    db.prepare('UPDATE trips SET updated_at = datetime("now") WHERE id = ?').run(tripId);
  });

  transaction();
  return true;
}

// Get trip with all stops
export function getTripWithStops(tripId: string): { trip: Trip; stops: Stop[] } | undefined {
  const trip = getTripById(tripId);
  if (!trip) return undefined;

  const stops = getStopsByTripId(tripId);
  return { trip, stops };
}

// Settings operations
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Conversation operations
export function getConversation(tripId: string): { id: string; messages: Array<{ role: string; content: string; timestamp: string }> } | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM conversations WHERE trip_id = ?').get(tripId) as { id: string; messages: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    messages: JSON.parse(row.messages),
  };
}

export function saveConversation(tripId: string, messages: Array<{ role: string; content: string; timestamp: string }>): void {
  const db = getDb();
  const existing = getConversation(tripId);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE conversations SET messages = ?, updated_at = ? WHERE trip_id = ?
    `).run(JSON.stringify(messages), now, tripId);
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO conversations (id, trip_id, messages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, tripId, JSON.stringify(messages), now, now);
  }
}

export function clearConversation(tripId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE trip_id = ?').run(tripId);
}
