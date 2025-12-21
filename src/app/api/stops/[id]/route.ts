import { NextRequest, NextResponse } from 'next/server';
import { getStopById, updateStop, deleteStop } from '@/lib/db';
import { UpdateStopRequest } from '@/lib/types';
import {
  validateString,
  validateCoordinates,
  validateStopType,
  validateTransportType,
  validateDurationUnit,
  validateArray,
  validateNumber,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_ARRAY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_LINK_LENGTH,
} from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/stops/[id] - Get a single stop
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const stop = getStopById(id);

    if (!stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    return NextResponse.json(stop);
  } catch (error) {
    console.error('Error fetching stop:', error);
    return NextResponse.json({ error: 'Failed to fetch stop' }, { status: 500 });
  }
}

// PUT /api/stops/[id] - Update a stop
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = getStopById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Validate fields if provided
    if (body.name !== undefined) {
      const nameError = validateString(body.name, 'Name', MAX_NAME_LENGTH, true);
      if (nameError) {
        return NextResponse.json({ error: nameError.message }, { status: 400 });
      }
    }

    if (body.type !== undefined) {
      const typeError = validateStopType(body.type);
      if (typeError) {
        return NextResponse.json({ error: typeError.message }, { status: 400 });
      }
    }

    if (body.latitude !== undefined || body.longitude !== undefined) {
      const lat = body.latitude ?? existing.latitude;
      const lng = body.longitude ?? existing.longitude;
      const coordError = validateCoordinates(lat, lng);
      if (coordError) {
        return NextResponse.json({ error: coordError.message }, { status: 400 });
      }
    }

    if (body.description !== undefined) {
      const descError = validateString(body.description, 'Description', MAX_DESCRIPTION_LENGTH);
      if (descError) {
        return NextResponse.json({ error: descError.message }, { status: 400 });
      }
    }

    if (body.notes !== undefined) {
      const notesError = validateString(body.notes, 'Notes', MAX_NOTES_LENGTH);
      if (notesError) {
        return NextResponse.json({ error: notesError.message }, { status: 400 });
      }
    }

    if (body.transport_type !== undefined) {
      const transportTypeError = validateTransportType(body.transport_type);
      if (transportTypeError) {
        return NextResponse.json({ error: transportTypeError.message }, { status: 400 });
      }
    }

    if (body.duration_unit !== undefined) {
      const durationUnitError = validateDurationUnit(body.duration_unit);
      if (durationUnitError) {
        return NextResponse.json({ error: durationUnitError.message }, { status: 400 });
      }
    }

    if (body.duration_value !== undefined) {
      const durationError = validateNumber(body.duration_value, 'Duration', 0, 365);
      if (durationError) {
        return NextResponse.json({ error: durationError.message }, { status: 400 });
      }
    }

    if (body.tags !== undefined) {
      const tagsError = validateArray(body.tags, 'Tags', MAX_ARRAY_LENGTH, MAX_TAG_LENGTH);
      if (tagsError) {
        return NextResponse.json({ error: tagsError.message }, { status: 400 });
      }
    }

    if (body.links !== undefined) {
      const linksError = validateArray(body.links, 'Links', MAX_ARRAY_LENGTH, MAX_LINK_LENGTH);
      if (linksError) {
        return NextResponse.json({ error: linksError.message }, { status: 400 });
      }
    }

    const updates: UpdateStopRequest = { ...body };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim();
    if (body.notes !== undefined) updates.notes = body.notes?.trim();

    const stop = updateStop(id, updates);
    return NextResponse.json(stop);
  } catch (error) {
    console.error('Error updating stop:', error);
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 });
  }
}

// DELETE /api/stops/[id] - Delete a stop
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = getStopById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    deleteStop(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stop:', error);
    return NextResponse.json({ error: 'Failed to delete stop' }, { status: 500 });
  }
}
