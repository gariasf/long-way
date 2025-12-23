import { NextRequest, NextResponse } from 'next/server';
import { getTripById, getTripWithStops, updateTrip, deleteTrip } from '@/lib/db';
import { updateTripSchema, getZodErrorMessage } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trips/[id] - Get a single trip with its stops
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getTripWithStops(id);

    if (!result) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' },
    });
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

    const existing = await getTripById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const result = updateTripSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    const trip = await updateTrip(id, result.data);
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

    const existing = await getTripById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    await deleteTrip(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
