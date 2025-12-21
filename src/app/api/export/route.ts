import { NextResponse } from 'next/server';
import { exportAllData } from '@/lib/db';

// GET /api/export - Export all data as JSON
export async function GET() {
  try {
    const data = exportAllData();

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="longway-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
