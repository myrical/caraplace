// In-memory canvas store (will be replaced with DB later)

import { createEmptyCanvas, isValidPixel, PixelUpdate, CANVAS_SIZE } from './canvas';

class CanvasStore {
  private canvas: number[][];
  private history: PixelUpdate[] = [];
  private listeners: Set<(update: PixelUpdate) => void> = new Set();

  constructor() {
    this.canvas = createEmptyCanvas();
  }

  getCanvas(): number[][] {
    return this.canvas;
  }

  getHistory(): PixelUpdate[] {
    return this.history;
  }

  placePixel(x: number, y: number, color: number, agentId: string): PixelUpdate | null {
    if (!isValidPixel(x, y, color)) {
      return null;
    }

    const update: PixelUpdate = {
      x,
      y,
      color,
      agentId,
      timestamp: Date.now(),
    };

    this.canvas[y][x] = color;
    this.history.push(update);

    // Notify listeners
    this.listeners.forEach(listener => listener(update));

    return update;
  }

  subscribe(listener: (update: PixelUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Stats
  getStats() {
    const pixelsByAgent: Record<string, number> = {};
    this.history.forEach(update => {
      pixelsByAgent[update.agentId] = (pixelsByAgent[update.agentId] || 0) + 1;
    });

    return {
      totalPixels: this.history.length,
      pixelsByAgent,
      canvasSize: CANVAS_SIZE,
    };
  }
}

// Singleton instance
export const canvasStore = new CanvasStore();
