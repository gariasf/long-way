import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSetting, getTripById, getStopsByTripId } from '@/lib/db';
import { tools, handleToolCall, getSystemPrompt } from '@/lib/claude-tools';
import { chatRequestSchema, getZodErrorMessage } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/trips/[id]/chat - Send a message to Claude
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: tripId } = await context.params;
    const body = await request.json();

    // Validate request
    const result = chatRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    // Get API key
    const apiKey = await getSetting('anthropic_api_key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please add it in Settings.' },
        { status: 400 }
      );
    }

    // Get trip info
    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Get current stops from database (not from request - saves bandwidth)
    let currentStops = await getStopsByTripId(tripId);

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // Build messages for Claude API
    const claudeMessages: Anthropic.MessageParam[] = result.data.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Track tool calls for the response
    const toolCalls: Array<{ name: string; result: string }> = [];
    let finalResponse = '';

    // Keep calling Claude until we get a final response (no more tool use)
    let continueLoop = true;
    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: getSystemPrompt(trip.name, currentStops),
        tools,
        messages: claudeMessages,
      });

      // Process the response
      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalResponse = block.text;
        } else if (block.type === 'tool_use') {
          hasToolUse = true;
          const toolResult = await handleToolCall(
            block.name,
            block.input as Record<string, unknown>,
            tripId,
            currentStops
          );

          toolCalls.push({ name: block.name, result: toolResult.result });

          // Update current stops if the tool modified them
          if (toolResult.stops) {
            currentStops = toolResult.stops;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult.result,
          });
        }
      }

      if (hasToolUse) {
        // Add assistant response and tool results to messages
        claudeMessages.push({
          role: 'assistant',
          content: response.content,
        });
        claudeMessages.push({
          role: 'user',
          content: toolResults,
        });
      } else {
        // No more tool calls, we're done
        continueLoop = false;
      }

      // Safety limit
      if (claudeMessages.length > 20) {
        continueLoop = false;
      }
    }

    return NextResponse.json({
      response: finalResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stops: currentStops,
    });
  } catch (error) {
    console.error('Chat error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
