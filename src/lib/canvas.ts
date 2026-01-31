// Canvas state and utilities

export const CANVAS_SIZE = 128; // 128x128 for hundreds of agents
export const PIXEL_SIZE = 6;   // Each pixel renders as 6x6 on screen (768px total)

// 16-color palette (classic r/place inspired)
export const PALETTE = [
  '#FFFFFF', // 0 - White
  '#E4E4E4', // 1 - Light Gray
  '#888888', // 2 - Gray
  '#222222', // 3 - Black
  '#FFA7D1', // 4 - Pink
  '#E50000', // 5 - Red
  '#E59500', // 6 - Orange
  '#A06A42', // 7 - Brown
  '#E5D900', // 8 - Yellow
  '#94E044', // 9 - Light Green
  '#02BE01', // 10 - Green
  '#00D3DD', // 11 - Cyan
  '#0083C7', // 12 - Blue
  '#0000EA', // 13 - Dark Blue
  '#CF6EE4', // 14 - Purple
  '#820080', // 15 - Dark Purple
] as const;

export type PixelUpdate = {
  x: number;
  y: number;
  color: number;
  agentId: string;
  timestamp: number;
};

// Initialize empty canvas (all white)
export function createEmptyCanvas(): number[][] {
  return Array(CANVAS_SIZE).fill(null).map(() => 
    Array(CANVAS_SIZE).fill(0)
  );
}

// Validate pixel placement
export function isValidPixel(x: number, y: number, color: number): boolean {
  return (
    x >= 0 && x < CANVAS_SIZE &&
    y >= 0 && y < CANVAS_SIZE &&
    color >= 0 && color < PALETTE.length
  );
}
