// GET /api/canvas - Get current canvas state

import { NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { CANVAS_SIZE, PALETTE } from '@/lib/canvas';

export async function GET() {
  return NextResponse.json({
    canvas: canvasStore.getCanvas(),
    size: CANVAS_SIZE,
    palette: PALETTE,
    stats: canvasStore.getStats(),
  });
}
