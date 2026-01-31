// GET /api/canvas/visual - Get canvas as annotated PNG with coordinate grid
// For vision-capable AI agents to "see" and understand the canvas

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { canvasStore } from '@/lib/store';
import { CANVAS_SIZE, PALETTE } from '@/lib/canvas';

const SCALE = 8;           // 8x scale for larger, more readable output
const GRID_INTERVAL = 8;   // Grid lines every 8 pixels for precision
const MARGIN_LEFT = 36;    // Space for Y-axis labels
const MARGIN_TOP = 20;     // Space for X-axis labels
const MARGIN_RIGHT = 12;   // Padding on right
const MARGIN_BOTTOM = 16;  // Padding at bottom
const CANVAS_PX = CANVAS_SIZE * SCALE;
const OUTPUT_WIDTH = MARGIN_LEFT + CANVAS_PX + MARGIN_RIGHT;
const OUTPUT_HEIGHT = MARGIN_TOP + CANVAS_PX + MARGIN_BOTTOM;

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
  bufferWidth: number,
  bufferHeight: number,
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
          if (px >= 0 && px < bufferWidth && py >= 0 && py < bufferHeight) {
            const idx = (py * bufferWidth + px) * 3;
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
    const outputBuffer = Buffer.alloc(OUTPUT_WIDTH * OUTPUT_HEIGHT * 3);
    
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
            const px = MARGIN_LEFT + x * SCALE + sx;
            const py = MARGIN_TOP + y * SCALE + sy;
            const idx = (py * OUTPUT_WIDTH + px) * 3;
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
      const posX = MARGIN_LEFT + i * SCALE;
      const posY = MARGIN_TOP + i * SCALE;
      
      // Vertical line
      for (let py = MARGIN_TOP; py < MARGIN_TOP + CANVAS_PX; py++) {
        if (posX < OUTPUT_WIDTH) {
          const idx = (py * OUTPUT_WIDTH + posX) * 3;
          outputBuffer[idx] = gridColor[0];
          outputBuffer[idx + 1] = gridColor[1];
          outputBuffer[idx + 2] = gridColor[2];
        }
      }
      // Horizontal line
      for (let px = MARGIN_LEFT; px < MARGIN_LEFT + CANVAS_PX; px++) {
        if (posY < OUTPUT_HEIGHT) {
          const idx = (posY * OUTPUT_WIDTH + px) * 3;
          outputBuffer[idx] = gridColor[0];
          outputBuffer[idx + 1] = gridColor[1];
          outputBuffer[idx + 2] = gridColor[2];
        }
      }
    }
    
    // Draw border around canvas
    const borderColor: [number, number, number] = [100, 100, 100];
    const canvasRight = MARGIN_LEFT + CANVAS_PX;
    const canvasBottom = MARGIN_TOP + CANVAS_PX;
    
    // Top and bottom borders
    for (let px = MARGIN_LEFT; px <= canvasRight; px++) {
      // Top border
      let idx = (MARGIN_TOP * OUTPUT_WIDTH + px) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
      // Bottom border
      idx = (canvasBottom * OUTPUT_WIDTH + px) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
    }
    // Left and right borders
    for (let py = MARGIN_TOP; py <= canvasBottom; py++) {
      // Left border
      let idx = (py * OUTPUT_WIDTH + MARGIN_LEFT) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
      // Right border
      idx = (py * OUTPUT_WIDTH + canvasRight) * 3;
      outputBuffer[idx] = borderColor[0]; outputBuffer[idx+1] = borderColor[1]; outputBuffer[idx+2] = borderColor[2];
    }
    
    // Draw coordinate labels (bitmap font - no system fonts needed)
    const labelColor: [number, number, number] = [136, 136, 136];
    for (let i = 0; i <= CANVAS_SIZE; i += GRID_INTERVAL) {
      const posX = MARGIN_LEFT + i * SCALE;
      const posY = MARGIN_TOP + i * SCALE;
      // X label (top, centered on grid line)
      drawNumber(outputBuffer, OUTPUT_WIDTH, OUTPUT_HEIGHT, i, posX - 4, 6, labelColor);
      // Y label (left, right-aligned)
      drawNumber(outputBuffer, OUTPUT_WIDTH, OUTPUT_HEIGHT, i, MARGIN_LEFT - 6, posY - 2, labelColor, true);
    }
    
    // Convert to PNG
    const result = await sharp(outputBuffer, {
      raw: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, channels: 3 }
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
