import { NextRequest, NextResponse } from 'next/server';
import { getTripById, getStopsByTripId, createStop, reorderStops } from '@/lib/db';
import { createStopSchema, reorderStopsSchema, getZodErrorMessage } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/stops - List all stops for a trip
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const trip = await getTripById(id);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const stops = await getStopsByTripId(id);
    return NextResponse.json(stops, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' },
    });
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

    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const result = createStopSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    const stop = await createStop(tripId, result.data);
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

    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const result = reorderStopsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    // Verify all stopIds belong to this trip
    const existingStops = await getStopsByTripId(tripId);
    const validIds = new Set(existingStops.map(s => s.id));
    const invalidIds = result.data.stopIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Some stop IDs do not belong to this trip' }, { status: 400 });
    }

    await reorderStops(tripId, result.data.stopIds);
    const stops = await getStopsByTripId(tripId);

    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error reordering stops:', error);
    return NextResponse.json({ error: 'Failed to reorder stops' }, { status: 500 });
  }
}
