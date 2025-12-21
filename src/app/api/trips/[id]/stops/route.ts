import { NextRequest, NextResponse } from 'next/server';
import { getTripById, getStopsByTripId, createStop, reorderStops } from '@/lib/db';
import { CreateStopRequest } from '@/lib/types';
import {
  validateString,
  validateCoordinates,
  validateStopType,
  validateTransportType,
  validateDurationUnit,
  validateArray,
  validateNumber,
  validateUUID,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_ARRAY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_LINK_LENGTH,
} from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/stops - List all stops for a trip
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const trip = getTripById(id);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const stops = getStopsByTripId(id);
    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error fetching stops:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

// POST /api/trips/[id]/stops - Create a new stop
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;
    const body = await request.json();

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Validate required fields
    const nameError = validateString(body.name, 'Name', MAX_NAME_LENGTH, true);
    if (nameError) {
      return NextResponse.json({ error: nameError.message }, { status: 400 });
    }

    const typeError = validateStopType(body.type);
    if (typeError) {
      return NextResponse.json({ error: typeError.message }, { status: 400 });
    }

    const coordError = validateCoordinates(body.latitude, body.longitude);
    if (coordError) {
      return NextResponse.json({ error: coordError.message }, { status: 400 });
    }

    // Validate optional fields
    const descError = validateString(body.description, 'Description', MAX_DESCRIPTION_LENGTH);
    if (descError) {
      return NextResponse.json({ error: descError.message }, { status: 400 });
    }

    const notesError = validateString(body.notes, 'Notes', MAX_NOTES_LENGTH);
    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 400 });
    }

    const transportTypeError = validateTransportType(body.transport_type);
    if (transportTypeError) {
      return NextResponse.json({ error: transportTypeError.message }, { status: 400 });
    }

    const durationUnitError = validateDurationUnit(body.duration_unit);
    if (durationUnitError) {
      return NextResponse.json({ error: durationUnitError.message }, { status: 400 });
    }

    const durationError = validateNumber(body.duration_value, 'Duration', 0, 365);
    if (durationError) {
      return NextResponse.json({ error: durationError.message }, { status: 400 });
    }

    const tagsError = validateArray(body.tags, 'Tags', MAX_ARRAY_LENGTH, MAX_TAG_LENGTH);
    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 400 });
    }

    const linksError = validateArray(body.links, 'Links', MAX_ARRAY_LENGTH, MAX_LINK_LENGTH);
    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 400 });
    }

    const stopData: CreateStopRequest = {
      ...body,
      name: body.name.trim(),
      description: body.description?.trim(),
      notes: body.notes?.trim(),
    };

    const stop = createStop(tripId, stopData);
    return NextResponse.json(stop, { status: 201 });
  } catch (error) {
    console.error('Error creating stop:', error);
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}

// PATCH /api/trips/[id]/stops - Reorder stops
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;
    const body = await request.json();

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (!Array.isArray(body.stopIds)) {
      return NextResponse.json({ error: 'stopIds array is required' }, { status: 400 });
    }

    // Validate each stop ID is a valid UUID
    for (const stopId of body.stopIds) {
      const uuidError = validateUUID(stopId, 'stopId');
      if (uuidError) {
        return NextResponse.json({ error: uuidError.message }, { status: 400 });
      }
    }

    // Verify all stopIds belong to this trip
    const existingStops = getStopsByTripId(tripId);
    const validIds = new Set(existingStops.map(s => s.id));
    const invalidIds = body.stopIds.filter((id: string) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Some stop IDs do not belong to this trip' }, { status: 400 });
    }

    reorderStops(tripId, body.stopIds);
    const stops = getStopsByTripId(tripId);

    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error reordering stops:', error);
    return NextResponse.json({ error: 'Failed to reorder stops' }, { status: 500 });
  }
}
