// GET /api/canvas - Get current canvas state

import { NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { CANVAS_SIZE, PALETTE } from '@/lib/canvas';

export async function GET() {
  const [canvas, stats] = await Promise.all([
    canvasStore.getCanvas(),
    canvasStore.getStats(),
  ]);

  return NextResponse.json({
    canvas,
    size: CANVAS_SIZE,
    palette: PALETTE,
    stats,
  });
}
