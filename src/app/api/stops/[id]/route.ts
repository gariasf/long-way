import { NextRequest, NextResponse } from 'next/server';
import { getStopById, updateStop, deleteStop } from '@/lib/db';
import { updateStopSchema, getZodErrorMessage } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/stops/[id] - Get a single stop
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const stop = await getStopById(id);

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

    const existing = await getStopById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    const result = updateStopSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    const stop = await updateStop(id, result.data);
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

    const existing = await getStopById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    await deleteStop(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stop:', error);
    return NextResponse.json({ error: 'Failed to delete stop' }, { status: 500 });
  }
}
