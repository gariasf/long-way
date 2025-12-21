import { NextRequest, NextResponse } from 'next/server';
import { getAllTrips, createTrip } from '@/lib/db';
import { validateString, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/validation';

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
    const body = await request.json();

    // Validate name
    const nameError = validateString(body.name, 'Name', MAX_NAME_LENGTH, true);
    if (nameError) {
      return NextResponse.json({ error: nameError.message }, { status: 400 });
    }

    // Validate description
    const descError = validateString(body.description, 'Description', MAX_DESCRIPTION_LENGTH);
    if (descError) {
      return NextResponse.json({ error: descError.message }, { status: 400 });
    }

    const trip = createTrip(body.name.trim(), body.description?.trim());
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
