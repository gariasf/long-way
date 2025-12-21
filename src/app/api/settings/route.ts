import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, deleteSetting } from '@/lib/db';

const API_KEY_SETTING = 'anthropic_api_key';
const MAX_API_KEY_LENGTH = 200;

// Mask API key for display (show first 7 and last 4 chars)
function maskApiKey(key: string): string {
  if (key.length <= 15) return '***';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

// GET /api/settings - Get settings (API key masked, never exposed)
export async function GET() {
  try {
    const apiKey = getSetting(API_KEY_SETTING);
    return NextResponse.json({
      hasApiKey: !!apiKey,
      keyPreview: apiKey ? maskApiKey(apiKey) : null,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST /api/settings - Save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.apiKey !== undefined) {
      const apiKey = String(body.apiKey).trim();

      if (apiKey.length > MAX_API_KEY_LENGTH) {
        return NextResponse.json({ error: 'API key too long' }, { status: 400 });
      }

      if (apiKey) {
        // Basic validation - Anthropic keys start with sk-ant-
        if (!apiKey.startsWith('sk-ant-')) {
          return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
        }
        setSetting(API_KEY_SETTING, apiKey);
      } else {
        deleteSetting(API_KEY_SETTING);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
