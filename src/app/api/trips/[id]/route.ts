import { NextRequest, NextResponse } from 'next/server';
import { getTripById, getTripWithStops, updateTrip, deleteTrip } from '@/lib/db';
import { UpdateTripRequest } from '@/lib/types';
import { validateString, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trips/[id] - Get a single trip with its stops
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = getTripWithStops(id);

    if (!result) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}

// PUT /api/trips/[id] - Update a trip
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = getTripById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Validate name if provided
    if (body.name !== undefined) {
      const nameError = validateString(body.name, 'Name', MAX_NAME_LENGTH, true);
      if (nameError) {
        return NextResponse.json({ error: nameError.message }, { status: 400 });
      }
    }

    // Validate description if provided
    if (body.description !== undefined && body.description !== null) {
      const descError = validateString(body.description, 'Description', MAX_DESCRIPTION_LENGTH);
      if (descError) {
        return NextResponse.json({ error: descError.message }, { status: 400 });
      }
    }

    const updates: UpdateTripRequest = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    const trip = updateTrip(id, updates);
    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error updating trip:', error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}

// DELETE /api/trips/[id] - Delete a trip
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = getTripById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    deleteTrip(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
