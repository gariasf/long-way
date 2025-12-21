import { NextRequest, NextResponse } from 'next/server';
import { getConversation, saveConversation, clearConversation, getTripById } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trips/[id]/conversation - Get conversation history
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const conversation = getConversation(tripId);
    return NextResponse.json({
      messages: conversation?.messages || [],
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// POST /api/trips/[id]/conversation - Save conversation history
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;
    const { messages } = await request.json();

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    saveConversation(tripId, messages);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving conversation:', error);
    return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
  }
}

// DELETE /api/trips/[id]/conversation - Clear conversation history
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;

    const trip = getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    clearConversation(tripId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 });
  }
}
