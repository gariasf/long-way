import Anthropic from '@anthropic-ai/sdk';
import { Stop, CreateStopRequest } from './schemas';
import { createStop, updateStop, deleteStop, reorderStops, getStopsByTripId } from './db';

// Tool definitions for Claude
export const tools: Anthropic.Tool[] = [
  {
    name: 'get_trip_info',
    description: 'Get information about the current trip including all stops. Use this to understand the current state of the trip.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_stop',
    description: 'Add a new stop to the trip. Requires at minimum a name, type, and coordinates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the stop (e.g., "Bergen City Center")',
        },
        type: {
          type: 'string',
          enum: ['base_camp', 'waypoint', 'stop', 'transport'],
          description: 'Type of stop: base_camp (multi-night anchor), waypoint (overnight), stop (hours only), transport (ferry/flight/train)',
        },
        latitude: {
          type: 'number',
          description: 'Latitude coordinate',
        },
        longitude: {
          type: 'number',
          description: 'Longitude coordinate',
        },
        description: {
          type: 'string',
          description: 'Short description of why this stop matters',
        },
        duration_value: {
          type: 'number',
          description: 'Duration value (e.g., 2)',
        },
        duration_unit: {
          type: 'string',
          enum: ['hours', 'nights', 'days'],
          description: 'Duration unit',
        },
        is_optional: {
          type: 'boolean',
          description: 'Whether this is an optional/serendipity stop',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the stop',
        },
        transport_type: {
          type: 'string',
          enum: ['ferry', 'flight', 'train', 'bus'],
          description: 'For transport stops, the type of transport',
        },
        departure_location: {
          type: 'string',
          description: 'For transport stops, the departure location',
        },
        arrival_location: {
          type: 'string',
          description: 'For transport stops, the arrival location',
        },
        departure_time: {
          type: 'string',
          description: 'For transport stops, the departure time (HH:MM)',
        },
        arrival_time: {
          type: 'string',
          description: 'For transport stops, the arrival time (HH:MM)',
        },
      },
      required: ['name', 'type', 'latitude', 'longitude'],
    },
  },
  {
    name: 'update_stop',
    description: 'Update an existing stop. Provide the stop ID and any fields to update.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stop_id: {
          type: 'string',
          description: 'ID of the stop to update',
        },
        name: { type: 'string', description: 'New name' },
        type: {
          type: 'string',
          enum: ['base_camp', 'waypoint', 'stop', 'transport'],
        },
        description: { type: 'string', description: 'New description' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        duration_value: { type: 'number' },
        duration_unit: { type: 'string', enum: ['hours', 'nights', 'days'] },
        is_optional: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['stop_id'],
    },
  },
  {
    name: 'remove_stop',
    description: 'Remove a stop from the trip.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stop_id: {
          type: 'string',
          description: 'ID of the stop to remove',
        },
      },
      required: ['stop_id'],
    },
  },
  {
    name: 'reorder_stops',
    description: 'Reorder the stops in the trip. Provide an array of stop IDs in the new order.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stop_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of stop IDs in the new order',
        },
      },
      required: ['stop_ids'],
    },
  },
];

// Tool handler (async to support async database operations)
export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  tripId: string,
  currentStops: Stop[]
): Promise<{ result: string; stops?: Stop[] }> {
  switch (toolName) {
    case 'get_trip_info': {
      const stopsInfo = currentStops.map((s, i) => ({
        id: s.id,
        order: i + 1,
        name: s.name,
        type: s.type,
        description: s.description,
        coordinates: { lat: s.latitude, lng: s.longitude },
        duration: s.duration_value ? `${s.duration_value} ${s.duration_unit}` : null,
        is_optional: s.is_optional,
      }));
      return {
        result: JSON.stringify({ stops: stopsInfo, total: stopsInfo.length }),
      };
    }

    case 'add_stop': {
      const input = toolInput as {
        name: string;
        type: 'base_camp' | 'waypoint' | 'stop' | 'transport';
        latitude: number;
        longitude: number;
        description?: string;
        duration_value?: number;
        duration_unit?: 'hours' | 'nights' | 'days';
        is_optional?: boolean;
        notes?: string;
        transport_type?: 'ferry' | 'flight' | 'train' | 'bus';
        departure_location?: string;
        arrival_location?: string;
        departure_time?: string;
        arrival_time?: string;
      };

      const stopData: CreateStopRequest = {
        name: input.name,
        type: input.type,
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
        duration_value: input.duration_value,
        duration_unit: input.duration_unit,
        is_optional: input.is_optional ?? false,
        notes: input.notes,
        transport_type: input.transport_type,
        departure_location: input.departure_location,
        arrival_location: input.arrival_location,
        departure_time: input.departure_time,
        arrival_time: input.arrival_time,
        tags: [],
        links: [],
      };

      const newStop = await createStop(tripId, stopData);
      const updatedStops = await getStopsByTripId(tripId);

      return {
        result: `Added stop "${newStop.name}" (${newStop.type}) at position ${updatedStops.length}`,
        stops: updatedStops,
      };
    }

    case 'update_stop': {
      const { stop_id, ...updates } = toolInput as { stop_id: string } & Record<string, unknown>;
      const updatedStop = await updateStop(stop_id, updates);

      if (!updatedStop) {
        return { result: `Stop with ID ${stop_id} not found` };
      }

      const updatedStops = await getStopsByTripId(tripId);
      return {
        result: `Updated stop "${updatedStop.name}"`,
        stops: updatedStops,
      };
    }

    case 'remove_stop': {
      const { stop_id } = toolInput as { stop_id: string };
      const stop = currentStops.find(s => s.id === stop_id);

      if (!stop) {
        return { result: `Stop with ID ${stop_id} not found` };
      }

      await deleteStop(stop_id);
      const updatedStops = await getStopsByTripId(tripId);

      return {
        result: `Removed stop "${stop.name}"`,
        stops: updatedStops,
      };
    }

    case 'reorder_stops': {
      const { stop_ids } = toolInput as { stop_ids: string[] };
      await reorderStops(tripId, stop_ids);
      const updatedStops = await getStopsByTripId(tripId);

      return {
        result: `Reordered ${stop_ids.length} stops`,
        stops: updatedStops,
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}

// System prompt for Claude
export function getSystemPrompt(tripName: string, stops: Stop[]): string {
  const stopsDescription = stops.length > 0
    ? stops.map((s, i) => `${i + 1}. ${s.name} (${s.type}${s.is_optional ? ', optional' : ''}): ${s.description || 'no description'}`).join('\n')
    : 'No stops yet.';

  return `You are a helpful trip planning assistant for the trip "${tripName}". Your role is to help the user plan and organize their journey.

Current stops in the trip:
${stopsDescription}

You can:
- Add new stops to the trip (use the add_stop tool)
- Update existing stops (use the update_stop tool)
- Remove stops (use the remove_stop tool)
- Reorder stops (use the reorder_stops tool)
- Get current trip information (use the get_trip_info tool)

When adding stops, you'll need coordinates. If the user mentions a place without coordinates, use your knowledge to provide approximate coordinates for well-known locations, or ask the user to provide coordinates or a Google Maps link.

Be concise in your responses. When you make changes, briefly confirm what you did. Focus on being a helpful planning partner.`;
}
