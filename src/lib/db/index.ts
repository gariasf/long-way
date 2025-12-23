import { v4 as uuidv4 } from 'uuid';
import { getAdapter, ensureSchema } from './adapter';
import type {
  Trip,
  Stop,
  StopRow,
  CreateStopRequest,
  UpdateStopRequest,
  ConversationRow,
  Message,
} from './types';
import { rowToStop } from './types';

// Re-export types and utilities
export * from './types';
export { getAdapter, initDatabase, closeDatabase, ensureSchema } from './adapter';

// ============================================================================
// Trip Operations
// ============================================================================

export async function getAllTrips(): Promise<Trip[]> {
  await ensureSchema();
  const adapter = getAdapter();
  return adapter.query<Trip>('SELECT * FROM trips ORDER BY updated_at DESC');
}

export async function getTripById(id: string): Promise<Trip | null> {
  await ensureSchema();
  const adapter = getAdapter();
  return adapter.queryOne<Trip>('SELECT * FROM trips WHERE id = $1', [id]);
}

export async function createTrip(name: string, description?: string): Promise<Trip> {
  await ensureSchema();
  const adapter = getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();

  await adapter.execute(
    `INSERT INTO trips (id, name, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, name, description || null, now, now]
  );

  // Return constructed object instead of re-querying
  return {
    id,
    name,
    description: description || null,
    created_at: now,
    updated_at: now,
  };
}

export async function updateTrip(
  id: string,
  updates: { name?: string; description?: string | null }
): Promise<Trip | null> {
  await ensureSchema();
  const adapter = getAdapter();

  const trip = await adapter.queryOne<Trip>('SELECT * FROM trips WHERE id = $1', [id]);
  if (!trip) return null;

  const name = updates.name ?? trip.name;
  const description = updates.description ?? trip.description;
  const now = new Date().toISOString();

  await adapter.execute(
    `UPDATE trips SET name = $1, description = $2, updated_at = $3 WHERE id = $4`,
    [name, description, now, id]
  );

  // Return updated object instead of re-querying
  return {
    ...trip,
    name,
    description,
    updated_at: now,
  };
}

export async function deleteTrip(id: string): Promise<boolean> {
  await ensureSchema();
  const adapter = getAdapter();
  const result = await adapter.execute('DELETE FROM trips WHERE id = $1', [id]);
  return result.rowCount > 0;
}

// ============================================================================
// Stop Operations
// ============================================================================

export async function getStopsByTripId(tripId: string): Promise<Stop[]> {
  await ensureSchema();
  const adapter = getAdapter();
  const rows = await adapter.query<StopRow>(
    'SELECT * FROM stops WHERE trip_id = $1 ORDER BY "order"',
    [tripId]
  );
  return rows.map(rowToStop);
}

export async function getStopById(id: string): Promise<Stop | null> {
  await ensureSchema();
  const adapter = getAdapter();
  const row = await adapter.queryOne<StopRow>('SELECT * FROM stops WHERE id = $1', [id]);
  return row ? rowToStop(row) : null;
}

export async function getNextOrder(tripId: string): Promise<number> {
  await ensureSchema();
  const adapter = getAdapter();
  const result = await adapter.queryOne<{ max_order: number | null }>(
    'SELECT MAX("order") as max_order FROM stops WHERE trip_id = $1',
    [tripId]
  );
  return (result?.max_order ?? -1) + 1;
}

export async function createStop(tripId: string, data: CreateStopRequest): Promise<Stop> {
  await ensureSchema();
  const adapter = getAdapter();
  const id = uuidv4();
  const order = data.order ?? (await getNextOrder(tripId));
  const now = new Date().toISOString();

  await adapter.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO stops (
        id, trip_id, name, type, description, latitude, longitude,
        duration_value, duration_unit, is_optional, tags, links, notes, "order",
        transport_type, departure_time, arrival_time, departure_location, arrival_location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
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
        data.arrival_location || null,
      ]
    );

    // Update trip's updated_at
    await tx.execute('UPDATE trips SET updated_at = $1 WHERE id = $2', [now, tripId]);
  });

  // Return constructed object instead of re-querying
  return {
    id,
    trip_id: tripId,
    name: data.name,
    type: data.type,
    description: data.description || null,
    latitude: data.latitude,
    longitude: data.longitude,
    duration_value: data.duration_value ?? null,
    duration_unit: data.duration_unit ?? null,
    is_optional: data.is_optional ?? false,
    tags: data.tags || [],
    links: data.links || [],
    notes: data.notes || null,
    order,
    transport_type: data.transport_type || null,
    departure_time: data.departure_time || null,
    arrival_time: data.arrival_time || null,
    departure_location: data.departure_location || null,
    arrival_location: data.arrival_location || null,
  };
}

export async function updateStop(id: string, updates: UpdateStopRequest): Promise<Stop | null> {
  await ensureSchema();
  const adapter = getAdapter();

  const stop = await getStopById(id);
  if (!stop) return null;

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Build updated stop object as we go
  const updatedStop = { ...stop };

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
    updatedStop.name = updates.name;
  }
  if (updates.type !== undefined) {
    fields.push(`type = $${paramIndex++}`);
    values.push(updates.type);
    updatedStop.type = updates.type;
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
    updatedStop.description = updates.description;
  }
  if (updates.latitude !== undefined) {
    fields.push(`latitude = $${paramIndex++}`);
    values.push(updates.latitude);
    updatedStop.latitude = updates.latitude;
  }
  if (updates.longitude !== undefined) {
    fields.push(`longitude = $${paramIndex++}`);
    values.push(updates.longitude);
    updatedStop.longitude = updates.longitude;
  }
  if (updates.duration_value !== undefined) {
    fields.push(`duration_value = $${paramIndex++}`);
    values.push(updates.duration_value);
    updatedStop.duration_value = updates.duration_value;
  }
  if (updates.duration_unit !== undefined) {
    fields.push(`duration_unit = $${paramIndex++}`);
    values.push(updates.duration_unit);
    updatedStop.duration_unit = updates.duration_unit;
  }
  if (updates.is_optional !== undefined) {
    fields.push(`is_optional = $${paramIndex++}`);
    values.push(updates.is_optional ? 1 : 0);
    updatedStop.is_optional = updates.is_optional;
  }
  if (updates.tags !== undefined) {
    fields.push(`tags = $${paramIndex++}`);
    values.push(JSON.stringify(updates.tags));
    updatedStop.tags = updates.tags;
  }
  if (updates.links !== undefined) {
    fields.push(`links = $${paramIndex++}`);
    values.push(JSON.stringify(updates.links));
    updatedStop.links = updates.links;
  }
  if (updates.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(updates.notes);
    updatedStop.notes = updates.notes;
  }
  if (updates.order !== undefined) {
    fields.push(`"order" = $${paramIndex++}`);
    values.push(updates.order);
    updatedStop.order = updates.order;
  }
  if (updates.transport_type !== undefined) {
    fields.push(`transport_type = $${paramIndex++}`);
    values.push(updates.transport_type);
    updatedStop.transport_type = updates.transport_type;
  }
  if (updates.departure_time !== undefined) {
    fields.push(`departure_time = $${paramIndex++}`);
    values.push(updates.departure_time);
    updatedStop.departure_time = updates.departure_time;
  }
  if (updates.arrival_time !== undefined) {
    fields.push(`arrival_time = $${paramIndex++}`);
    values.push(updates.arrival_time);
    updatedStop.arrival_time = updates.arrival_time;
  }
  if (updates.departure_location !== undefined) {
    fields.push(`departure_location = $${paramIndex++}`);
    values.push(updates.departure_location);
    updatedStop.departure_location = updates.departure_location;
  }
  if (updates.arrival_location !== undefined) {
    fields.push(`arrival_location = $${paramIndex++}`);
    values.push(updates.arrival_location);
    updatedStop.arrival_location = updates.arrival_location;
  }

  if (fields.length === 0) return stop;

  const now = new Date().toISOString();

  await adapter.transaction(async (tx) => {
    values.push(id);
    await tx.execute(`UPDATE stops SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);

    // Update trip's updated_at
    await tx.execute('UPDATE trips SET updated_at = $1 WHERE id = $2', [now, stop.trip_id]);
  });

  return updatedStop;
}

export async function deleteStop(id: string): Promise<boolean> {
  await ensureSchema();
  const adapter = getAdapter();

  const stop = await getStopById(id);
  if (!stop) return false;

  const tripId = stop.trip_id;
  const now = new Date().toISOString();

  let deleted = false;
  await adapter.transaction(async (tx) => {
    const result = await tx.execute('DELETE FROM stops WHERE id = $1', [id]);
    deleted = result.rowCount > 0;

    if (deleted) {
      // Update trip's updated_at
      await tx.execute('UPDATE trips SET updated_at = $1 WHERE id = $2', [now, tripId]);
    }
  });

  return deleted;
}

export async function reorderStops(tripId: string, stopIds: string[]): Promise<boolean> {
  await ensureSchema();
  const adapter = getAdapter();
  const now = new Date().toISOString();

  await adapter.transaction(async (tx) => {
    for (let i = 0; i < stopIds.length; i++) {
      await tx.execute('UPDATE stops SET "order" = $1 WHERE id = $2 AND trip_id = $3', [
        i,
        stopIds[i],
        tripId,
      ]);
    }
    await tx.execute('UPDATE trips SET updated_at = $1 WHERE id = $2', [now, tripId]);
  });

  return true;
}

// Get trip with all stops
export async function getTripWithStops(
  tripId: string
): Promise<{ trip: Trip; stops: Stop[] } | null> {
  const trip = await getTripById(tripId);
  if (!trip) return null;

  const stops = await getStopsByTripId(tripId);
  return { trip, stops };
}

// ============================================================================
// Settings Operations
// ============================================================================

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const adapter = getAdapter();
  const row = await adapter.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  const adapter = getAdapter();

  // Use INSERT ... ON CONFLICT for upsert (works in both SQLite and PostgreSQL)
  await adapter.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await ensureSchema();
  const adapter = getAdapter();
  await adapter.execute('DELETE FROM settings WHERE key = $1', [key]);
}

// ============================================================================
// Conversation Operations
// ============================================================================

export async function getConversation(
  tripId: string
): Promise<{ id: string; messages: Message[] } | null> {
  await ensureSchema();
  const adapter = getAdapter();
  const row = await adapter.queryOne<ConversationRow>(
    'SELECT * FROM conversations WHERE trip_id = $1',
    [tripId]
  );
  if (!row) return null;

  // Safe JSON parse with fallback
  let messages: Message[] = [];
  try {
    messages = JSON.parse(row.messages);
  } catch {
    console.error('Failed to parse conversation messages JSON');
  }

  return {
    id: row.id,
    messages,
  };
}

export async function saveConversation(tripId: string, messages: Message[]): Promise<void> {
  await ensureSchema();
  const adapter = getAdapter();
  const existing = await getConversation(tripId);
  const now = new Date().toISOString();

  if (existing) {
    await adapter.execute(
      `UPDATE conversations SET messages = $1, updated_at = $2 WHERE trip_id = $3`,
      [JSON.stringify(messages), now, tripId]
    );
  } else {
    const id = uuidv4();
    await adapter.execute(
      `INSERT INTO conversations (id, trip_id, messages, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tripId, JSON.stringify(messages), now, now]
    );
  }
}

export async function clearConversation(tripId: string): Promise<void> {
  await ensureSchema();
  const adapter = getAdapter();
  await adapter.execute('DELETE FROM conversations WHERE trip_id = $1', [tripId]);
}
