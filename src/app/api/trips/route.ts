import { NextRequest, NextResponse } from 'next/server';
import { getAllTrips, createTrip } from '@/lib/db';
import { CreateTripRequest } from '@/lib/types';

// GET /api/trips - List all trips
export async function GET() {
  try {
    const trips = getAllTrips();
    return NextResponse.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}

// POST /api/trips - Create a new trip
export async function POST(request: NextRequest) {
  try {
    const body: CreateTripRequest = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'Trip name is required' }, { status: 400 });
    }

    const trip = createTrip(body.name.trim(), body.description?.trim());
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
