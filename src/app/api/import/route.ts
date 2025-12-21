import { NextRequest, NextResponse } from 'next/server';
import { importData, ExportData } from '@/lib/db';
import { z } from 'zod';

const importRequestSchema = z.object({
  data: z.object({
    version: z.number(),
    exportedAt: z.string(),
    trips: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      created_at: z.string().optional(),
      updated_at: z.string().optional(),
      stops: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['base_camp', 'waypoint', 'stop', 'transport']),
        description: z.string().nullable().optional(),
        latitude: z.number(),
        longitude: z.number(),
        duration_value: z.number().nullable().optional(),
        duration_unit: z.string().nullable().optional(),
        is_optional: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        links: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
        transport_type: z.string().nullable().optional(),
        departure_time: z.string().nullable().optional(),
        arrival_time: z.string().nullable().optional(),
        departure_location: z.string().nullable().optional(),
        arrival_location: z.string().nullable().optional(),
      })),
      conversation: z.object({
        messages: z.array(z.object({
          role: z.string(),
          content: z.string(),
          timestamp: z.string(),
        })),
      }).optional(),
    })),
  }),
  mode: z.enum(['merge', 'replace']).optional().default('merge'),
});

// POST /api/import - Import data from JSON
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = importRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid import data format', details: result.error.issues },
        { status: 400 }
      );
    }

    const { data, mode } = result.data;
    const importResult = importData(data as ExportData, mode);

    return NextResponse.json({
      success: true,
      imported: importResult.imported,
      skipped: importResult.skipped,
      message: `Imported ${importResult.imported} trip(s), skipped ${importResult.skipped} existing trip(s)`,
    });
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
