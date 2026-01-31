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

// Simple 3x5 pixel font for digits 0-9
const DIGIT_FONT: Record<string, number[][]> = {
  '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
};

// Draw a number into the buffer at given position
function drawNumber(
  buffer: Buffer,
  width: number,
  num: number,
  startX: number,
  startY: number,
  color: [number, number, number],
  rightAlign = false
) {
  const str = num.toString();
  const charWidth = 4; // 3px char + 1px spacing
  const totalWidth = str.length * charWidth - 1;
  
  let x = rightAlign ? startX - totalWidth : startX;
  
  for (const char of str) {
    const glyph = DIGIT_FONT[char];
    if (!glyph) continue;
    
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row][col]) {
          const px = x + col;
          const py = startY + row;
          if (px >= 0 && px < width && py >= 0 && py < OUTPUT_SIZE) {
            const idx = (py * width + px) * 3;
            buffer[idx] = color[0];
            buffer[idx + 1] = color[1];
            buffer[idx + 2] = color[2];
          }
        }
      }
    }
    x += charWidth;
  }
}

export async function GET() {
  try {
    const canvasData = await canvasStore.getCanvas();
    
    // Create full output buffer including margins
    const outputBuffer = Buffer.alloc(OUTPUT_SIZE * OUTPUT_SIZE * 3);
    
    // Fill background with dark color
    for (let i = 0; i < outputBuffer.length; i += 3) {
      outputBuffer[i] = 0x11;
      outputBuffer[i + 1] = 0x11;
      outputBuffer[i + 2] = 0x11;
    }
    
    // Draw the canvas pixels
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const color = hexToRgb(PALETTE[canvasData[y][x]]);
        // Fill SCALE x SCALE block
        for (let sy = 0; sy < SCALE; sy++) {
          for (let sx = 0; sx < SCALE; sx++) {
            const px = MARGIN + x * SCALE + sx;
            const py = MARGIN + y * SCALE + sy;
            const idx = (py * OUTPUT_SIZE + px) * 3;
            outputBuffer[idx] = color[0];
            outputBuffer[idx + 1] = color[1];
            outputBuffer[idx + 2] = color[2];
          }
        }
      }
    }
    
    // Draw grid lines
    const gridColor: [number, number, number] = [80, 80, 80];
    for (let i = 0; i <= CANVAS_SIZE; i += GRID_INTERVAL) {
      const pos = MARGIN + i * SCALE;
      // Vertical line
      for (let py = MARGIN; py < OUTPUT_SIZE; py++) {
        const idx = (py * OUTPUT_SIZE + pos) * 3;
        outputBuffer[idx] = gridColor[0];
        outputBuffer[idx + 1] = gridColor[1];
        outputBuffer[idx + 2] = gridColor[2];
      }
      // Horizontal line
      for (let px = MARGIN; px < OUTPUT_SIZE; px++) {
        const idx = (pos * OUTPUT_SIZE + px) * 3;
        outputBuffer[idx] = gridColor[0];
        outputBuffer[idx + 1] = gridColor[1];
        outputBuffer[idx + 2] = gridColor[2];
      }
    }
    
    // Draw border around canvas
    const borderColor: [number, number, number] = [100, 100, 100];
    for (let px = MARGIN; px < OUTPUT_SIZE; px++) {
      // Top border
      let idx = (MARGIN * OUTPUT_SIZE + px) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
      // Bottom border
      idx = ((OUTPUT_SIZE - 1) * OUTPUT_SIZE + px) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
    }
    for (let py = MARGIN; py < OUTPUT_SIZE; py++) {
      // Left border
      let idx = (py * OUTPUT_SIZE + MARGIN) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
      // Right border
      idx = (py * OUTPUT_SIZE + OUTPUT_SIZE - 1) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
    }
    
    // Draw coordinate labels (bitmap font - no system fonts needed)
    const labelColor: [number, number, number] = [136, 136, 136];
    for (let i = 0; i <= CANVAS_SIZE; i += GRID_INTERVAL) {
      const pos = MARGIN + i * SCALE;
      // X label (top, centered on grid line)
      drawNumber(outputBuffer, OUTPUT_SIZE, i, pos - 4, 10, labelColor);
      // Y label (left, right-aligned)
      drawNumber(outputBuffer, OUTPUT_SIZE, i, MARGIN - 6, pos - 2, labelColor, true);
    }
    
    // Convert to PNG
    const result = await sharp(outputBuffer, {
      raw: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 3 }
    })
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
