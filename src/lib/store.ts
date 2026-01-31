// Canvas store with Supabase persistence

import { supabase, PixelRow } from './supabase';
import { createEmptyCanvas, isValidPixel, PixelUpdate, CANVAS_SIZE } from './canvas';

class CanvasStore {
  private canvas: number[][] | null = null;
  private initialized = false;

  // Initialize canvas from database or create empty
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to load existing canvas state
      const { data: stateData } = await supabase
        .from('canvas_state')
        .select('canvas_data')
        .eq('id', 1)
        .single();

      if (stateData?.canvas_data) {
        const loaded = stateData.canvas_data;
        // Check if canvas needs resizing (migration from 64x64 to 128x128)
        if (loaded.length < CANVAS_SIZE || loaded[0]?.length < CANVAS_SIZE) {
          console.log(`Migrating canvas from ${loaded.length}x${loaded[0]?.length} to ${CANVAS_SIZE}x${CANVAS_SIZE}`);
          this.canvas = createEmptyCanvas();
          // Copy old data into new canvas
          for (let y = 0; y < Math.min(loaded.length, CANVAS_SIZE); y++) {
            for (let x = 0; x < Math.min(loaded[y]?.length || 0, CANVAS_SIZE); x++) {
              this.canvas[y][x] = loaded[y][x];
            }
          }
          // Save migrated canvas
          await supabase
            .from('canvas_state')
            .upsert({ id: 1, canvas_data: this.canvas });
        } else {
          this.canvas = loaded;
        }
      } else {
        // Create fresh canvas and save it
        this.canvas = createEmptyCanvas();
        await supabase
          .from('canvas_state')
          .upsert({ id: 1, canvas_data: this.canvas });
      }
    } catch (error) {
      console.error('Failed to init canvas from DB, using memory:', error);
      this.canvas = createEmptyCanvas();
    }

    this.initialized = true;
  }

  async getCanvas(): Promise<number[][]> {
    await this.init();
    return this.canvas!;
  }

  async getHistory(): Promise<PixelUpdate[]> {
    try {
      const { data, error } = await supabase
        .from('pixels')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1000);

      if (error) throw error;

      return (data || []).map((row: PixelRow) => ({
        x: row.x,
        y: row.y,
        color: row.color,
        agentId: row.agent_id,
        timestamp: new Date(row.created_at).getTime(),
      }));
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  async placePixel(x: number, y: number, color: number, agentId: string): Promise<PixelUpdate | null> {
    if (!isValidPixel(x, y, color)) {
      return null;
    }

    await this.init();

    const update: PixelUpdate = {
      x,
      y,
      color,
      agentId,
      timestamp: Date.now(),
    };

    try {
      // Update local canvas
      this.canvas![y][x] = color;

      // Save pixel to history
      await supabase.from('pixels').insert({
        x,
        y,
        color,
        agent_id: agentId,
      });

      // Save canvas state
      await supabase
        .from('canvas_state')
        .upsert({ id: 1, canvas_data: this.canvas });

      return update;
    } catch (error) {
      console.error('Failed to save pixel:', error);
      // Still return update even if DB fails (optimistic)
      return update;
    }
  }

  async getStats(): Promise<{
    totalPixels: number;
    pixelsByAgent: Record<string, number>;
    canvasSize: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('pixels')
        .select('agent_id');

      if (error) throw error;

      const pixelsByAgent: Record<string, number> = {};
      (data || []).forEach((row: { agent_id: string }) => {
        pixelsByAgent[row.agent_id] = (pixelsByAgent[row.agent_id] || 0) + 1;
      });

      return {
        totalPixels: data?.length || 0,
        pixelsByAgent,
        canvasSize: CANVAS_SIZE,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPixels: 0,
        pixelsByAgent: {},
        canvasSize: CANVAS_SIZE,
      };
    }
  }
}

// Singleton instance
export const canvasStore = new CanvasStore();
