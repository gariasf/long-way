import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, deleteSetting } from '@/lib/db';

const API_KEY_SETTING = 'anthropic_api_key';

// GET /api/settings - Get settings (API key masked)
export async function GET() {
  try {
    const apiKey = getSetting(API_KEY_SETTING);
    return NextResponse.json({
      apiKey: apiKey || '',
      hasApiKey: !!apiKey,
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
      if (body.apiKey.trim()) {
        setSetting(API_KEY_SETTING, body.apiKey.trim());
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
