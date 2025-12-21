import { z } from 'zod';

// Validation constants
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_NOTES_LENGTH = 10000;
export const MAX_ARRAY_LENGTH = 100;
export const MAX_TAG_LENGTH = 50;
export const MAX_LINK_LENGTH = 500;

// Enum schemas (single source of truth)
export const stopTypeSchema = z.enum(['base_camp', 'waypoint', 'stop', 'transport']);
export const transportTypeSchema = z.enum(['ferry', 'flight', 'train', 'bus']);
export const durationUnitSchema = z.enum(['hours', 'nights', 'days']);
export const messageRoleSchema = z.enum(['user', 'assistant']);

// Derived enum types
export type StopType = z.infer<typeof stopTypeSchema>;
export type TransportType = z.infer<typeof transportTypeSchema>;
export type DurationUnit = z.infer<typeof durationUnitSchema>;

// UUID validation helper
const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID format'
);

// Trip schemas
export const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(MAX_NAME_LENGTH),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
});

export const updateTripSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).nullable().optional(),
});

// Stop schemas
export const createStopSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(MAX_NAME_LENGTH),
  type: stopTypeSchema,
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  duration_value: z.number().int().min(0).max(365).optional(),
  duration_unit: durationUnitSchema.optional(),
  is_optional: z.boolean().default(false),
  tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_ARRAY_LENGTH).default([]),
  links: z.array(z.string().max(MAX_LINK_LENGTH)).max(MAX_ARRAY_LENGTH).default([]),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
  order: z.number().int().optional(),
  transport_type: transportTypeSchema.optional(),
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  departure_location: z.string().max(MAX_NAME_LENGTH).optional(),
  arrival_location: z.string().max(MAX_NAME_LENGTH).optional(),
  // Optional day planning (null = not assigned to specific days)
  day_start: z.number().int().min(1).max(365).nullable().optional(),
  day_end: z.number().int().min(1).max(365).nullable().optional(),
});

export const updateStopSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  type: stopTypeSchema.optional(),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  duration_value: z.number().int().min(0).max(365).optional(),
  duration_unit: durationUnitSchema.optional(),
  is_optional: z.boolean().optional(),
  tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_ARRAY_LENGTH).optional(),
  links: z.array(z.string().max(MAX_LINK_LENGTH)).max(MAX_ARRAY_LENGTH).optional(),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
  order: z.number().int().optional(),
  transport_type: transportTypeSchema.optional(),
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  departure_location: z.string().max(MAX_NAME_LENGTH).optional(),
  arrival_location: z.string().max(MAX_NAME_LENGTH).optional(),
  day_start: z.number().int().min(1).max(365).nullable().optional(),
  day_end: z.number().int().min(1).max(365).nullable().optional(),
});

// Reorder schema
export const reorderStopsSchema = z.object({
  stopIds: z.array(uuidSchema).min(1, 'At least one stop ID is required'),
});

// Message schema for saving conversation (timestamp required)
export const messageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1).max(50000),
  timestamp: z.string(),
});

// Conversation schema
export const saveConversationSchema = z.object({
  messages: z.array(messageSchema).max(1000),
});

// Chat request schema
export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: messageRoleSchema,
    content: z.string().min(1).max(50000),
  })).min(1).max(1000),
});

// Settings schema
export const saveSettingsSchema = z.object({
  apiKey: z.string()
    .min(1, 'API key is required')
    .refine(key => key.startsWith('sk-ant-'), 'API key must start with sk-ant-'),
});

// Derive request types from schemas
export type CreateTripRequest = z.infer<typeof createTripSchema>;
export type UpdateTripRequest = z.infer<typeof updateTripSchema>;
export type CreateStopRequest = z.infer<typeof createStopSchema>;
export type UpdateStopRequest = z.infer<typeof updateStopSchema>;
export type ReorderStopsRequest = z.infer<typeof reorderStopsSchema>;
export type SaveConversationRequest = z.infer<typeof saveConversationSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Entity types (these come from database, not user input)
export interface Trip {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

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
  transport_type: TransportType | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string | null;
  arrival_location: string | null;
  day_start: number | null;
  day_end: number | null;
}

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

// Database row type (JSON fields stored as strings)
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
  day_start: number | null;
  day_end: number | null;
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

// Helper to extract first error message from Zod error
export function getZodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Validation failed';
}
