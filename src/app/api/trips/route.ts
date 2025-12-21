import { NextRequest, NextResponse } from 'next/server';
import { getAllTrips, createTrip } from '@/lib/db';
import { createTripSchema, getZodErrorMessage } from '@/lib/schemas';

// GET /api/trips - List all trips
export async function GET() {
  try {
    const trips = getAllTrips();
    return NextResponse.json(trips, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}

// POST /api/trips - Create a new trip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createTripSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    const trip = createTrip(result.data.name, result.data.description);
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
