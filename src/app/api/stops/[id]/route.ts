import { NextRequest, NextResponse } from 'next/server';
import { getStopById, updateStop, deleteStop } from '@/lib/db';
import { UpdateStopRequest } from '@/lib/types';

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
    const body: UpdateStopRequest = await request.json();

    const existing = getStopById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Validate fields if provided
    if (body.type !== undefined && !['base_camp', 'waypoint', 'stop', 'transport'].includes(body.type)) {
      return NextResponse.json({ error: 'Invalid stop type' }, { status: 400 });
    }
    if (body.duration_unit !== undefined && !['hours', 'nights', 'days'].includes(body.duration_unit)) {
      return NextResponse.json({ error: 'Invalid duration unit' }, { status: 400 });
    }
    if (body.transport_type !== undefined && body.transport_type !== null &&
        !['ferry', 'flight', 'train', 'bus'].includes(body.transport_type)) {
      return NextResponse.json({ error: 'Invalid transport type' }, { status: 400 });
    }

    const updates: UpdateStopRequest = { ...body };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim();

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
