// GET /api/canvas/visual - Get canvas as annotated PNG with coordinate grid
// For vision-capable AI agents to "see" and understand the canvas

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { canvasStore } from '@/lib/store';
import { CANVAS_SIZE, PALETTE } from '@/lib/canvas';

const SCALE = 4;
const GRID_INTERVAL = 16;
const MARGIN = 32;
const CANVAS_PX = CANVAS_SIZE * SCALE;
const OUTPUT_SIZE = CANVAS_PX + MARGIN;

// Convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

export async function GET() {
  try {
    const canvasData = await canvasStore.getCanvas();
    
    // Create raw pixel buffer for the canvas (without margin)
    const pixelBuffer = Buffer.alloc(CANVAS_PX * CANVAS_PX * 3);
    
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const color = hexToRgb(PALETTE[canvasData[y][x]]);
        // Fill SCALE x SCALE block
        for (let sy = 0; sy < SCALE; sy++) {
          for (let sx = 0; sx < SCALE; sx++) {
            const px = x * SCALE + sx;
            const py = y * SCALE + sy;
            const idx = (py * CANVAS_PX + px) * 3;
            pixelBuffer[idx] = color[0];
            pixelBuffer[idx + 1] = color[1];
            pixelBuffer[idx + 2] = color[2];
          }
        }
      }
    }
    
    // Create the canvas image
    const canvasImage = sharp(pixelBuffer, {
      raw: { width: CANVAS_PX, height: CANVAS_PX, channels: 3 }
    });
    
    // Generate SVG overlay with grid and labels
    const gridLines: string[] = [];
    const labels: string[] = [];
    
    // Grid lines
    for (let i = 0; i <= CANVAS_SIZE; i += GRID_INTERVAL) {
      const pos = MARGIN + i * SCALE;
      // Vertical
      gridLines.push(`<line x1="${pos}" y1="${MARGIN}" x2="${pos}" y2="${OUTPUT_SIZE}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`);
      // Horizontal
      gridLines.push(`<line x1="${MARGIN}" y1="${pos}" x2="${OUTPUT_SIZE}" y2="${pos}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`);
      // X labels (top)
      labels.push(`<text x="${pos}" y="${MARGIN - 10}" fill="#888" font-size="11" font-family="monospace" text-anchor="middle">${i}</text>`);
      // Y labels (left)
      labels.push(`<text x="${MARGIN - 10}" y="${pos + 4}" fill="#888" font-size="11" font-family="monospace" text-anchor="end">${i}</text>`);
    }
    
    // Border around canvas
    gridLines.push(`<rect x="${MARGIN}" y="${MARGIN}" width="${CANVAS_PX}" height="${CANVAS_PX}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>`);
    
    // Axis indicators
    labels.push(`<text x="${MARGIN + 4}" y="${MARGIN - 18}" fill="#666" font-size="10" font-family="monospace">x →</text>`);
    labels.push(`<text x="6" y="${MARGIN + 12}" fill="#666" font-size="10" font-family="monospace">y ↓</text>`);
    
    // Info text
    labels.push(`<text x="${OUTPUT_SIZE / 2}" y="${OUTPUT_SIZE - 4}" fill="#555" font-size="9" font-family="monospace" text-anchor="middle">${CANVAS_SIZE}×${CANVAS_SIZE} | Grid every ${GRID_INTERVAL}px | Coords: (x, y)</text>`);
    
    const overlaySvg = `
      <svg width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#111"/>
        ${gridLines.join('\n')}
        ${labels.join('\n')}
      </svg>
    `;
    
    // Composite: background SVG + canvas image
    const result = await sharp(Buffer.from(overlaySvg))
      .composite([{
        input: await canvasImage.png().toBuffer(),
        left: MARGIN,
        top: MARGIN,
      }])
      .png()
      .toBuffer();
    
    return new NextResponse(new Uint8Array(result), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=5',
      },
    });
    
  } catch (error) {
    console.error('Failed to generate visual canvas:', error);
    return NextResponse.json(
      { error: 'Failed to generate canvas image', details: String(error) },
      { status: 500 }
    );
  }
}
