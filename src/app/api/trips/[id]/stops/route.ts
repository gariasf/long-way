import { NextRequest, NextResponse } from 'next/server';
import { getTripById, getStopsByTripId, createStop, reorderStops } from '@/lib/db';
import { CreateStopRequest } from '@/lib/types';

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
    const body: CreateStopRequest = await request.json();

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'Stop name is required' }, { status: 400 });
    }
    if (!body.type || !['base_camp', 'waypoint', 'stop', 'transport'].includes(body.type)) {
      return NextResponse.json({ error: 'Valid stop type is required' }, { status: 400 });
    }
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return NextResponse.json({ error: 'Valid coordinates are required' }, { status: 400 });
    }

    const stop = createStop(tripId, {
      ...body,
      name: body.name.trim(),
      description: body.description?.trim(),
    });

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

    reorderStops(tripId, body.stopIds);
    const stops = getStopsByTripId(tripId);

    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error reordering stops:', error);
    return NextResponse.json({ error: 'Failed to reorder stops' }, { status: 500 });
  }
}
