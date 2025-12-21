import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, deleteSetting } from '@/lib/db';
import { saveSettingsSchema, getZodErrorMessage } from '@/lib/schemas';

const API_KEY_SETTING = 'anthropic_api_key';

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
    }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
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

    // Handle empty apiKey as delete request
    if (body.apiKey === '' || body.apiKey === null) {
      deleteSetting(API_KEY_SETTING);
      return NextResponse.json({ success: true });
    }

    const result = saveSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: getZodErrorMessage(result.error) }, { status: 400 });
    }

    setSetting(API_KEY_SETTING, result.data.apiKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
