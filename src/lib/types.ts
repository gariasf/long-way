// Trip types
export interface Trip {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type StopType = 'base_camp' | 'waypoint' | 'stop' | 'transport';
export type TransportType = 'ferry' | 'flight' | 'train' | 'bus';
export type DurationUnit = 'hours' | 'nights' | 'days';

export interface Stop {
  id: string;
  trip_id: string;
  name: string;
  type: StopType;
  description: string | null;
  latitude: number;
  longitude: number;
  duration_value: number | null;
  duration_unit: DurationUnit | null;
  is_optional: boolean;
  tags: string[];
  links: string[];
  notes: string | null;
  order: number;
  // Transport-specific fields
  transport_type: TransportType | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string | null;
  arrival_location: string | null;
}

// Database row types (JSON fields stored as strings)
export interface StopRow {
  id: string;
  trip_id: string;
  name: string;
  type: StopType;
  description: string | null;
  latitude: number;
  longitude: number;
  duration_value: number | null;
  duration_unit: DurationUnit | null;
  is_optional: number; // SQLite stores booleans as 0/1
  tags: string; // JSON string
  links: string; // JSON string
  notes: string | null;
  order: number;
  transport_type: TransportType | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string | null;
  arrival_location: string | null;
}

// Conversation types for Claude chat
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  trip_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CreateTripRequest {
  name: string;
  description?: string;
}

export interface UpdateTripRequest {
  name?: string;
  description?: string | null;
}

export interface CreateStopRequest {
  name: string;
  type: StopType;
  description?: string;
  latitude: number;
  longitude: number;
  duration_value?: number;
  duration_unit?: DurationUnit;
  is_optional?: boolean;
  tags?: string[];
  links?: string[];
  notes?: string;
  order?: number;
  transport_type?: TransportType;
  departure_time?: string;
  arrival_time?: string;
  departure_location?: string;
  arrival_location?: string;
}

export interface UpdateStopRequest {
  name?: string;
  type?: StopType;
  description?: string;
  latitude?: number;
  longitude?: number;
  duration_value?: number;
  duration_unit?: DurationUnit;
  is_optional?: boolean;
  tags?: string[];
  links?: string[];
  notes?: string;
  order?: number;
  transport_type?: TransportType;
  departure_time?: string;
  arrival_time?: string;
  departure_location?: string;
  arrival_location?: string;
}

// Helper function to convert database row to Stop
export function rowToStop(row: StopRow): Stop {
  return {
    ...row,
    is_optional: Boolean(row.is_optional),
    tags: JSON.parse(row.tags || '[]'),
    links: JSON.parse(row.links || '[]'),
  };
}

// Helper function to convert Stop to database values
export function stopToRow(stop: Partial<Stop>): Partial<StopRow> {
  const row: Partial<StopRow> = { ...stop } as Partial<StopRow>;
  if (stop.is_optional !== undefined) {
    row.is_optional = stop.is_optional ? 1 : 0;
  }
  if (stop.tags !== undefined) {
    row.tags = JSON.stringify(stop.tags);
  }
  if (stop.links !== undefined) {
    row.links = JSON.stringify(stop.links);
  }
  return row;
}
