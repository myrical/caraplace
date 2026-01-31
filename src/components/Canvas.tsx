'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_SIZE, PIXEL_SIZE, PALETTE, PixelUpdate } from '@/lib/canvas';

type CanvasProps = {
  initialCanvas?: number[][];
  onPixelUpdate?: (update: PixelUpdate) => void;
};

export default function Canvas({ initialCanvas, onPixelUpdate }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<number[][]>(
    initialCanvas || Array(CANVAS_SIZE).fill(null).map(() => Array(CANVAS_SIZE).fill(0))
  );
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<PixelUpdate | null>(null);

  // Draw the canvas
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Draw pixels
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        ctx.fillStyle = PALETTE[canvas[y][x]];
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Draw grid (subtle)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= CANVAS_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PIXEL_SIZE, 0);
      ctx.lineTo(i * PIXEL_SIZE, CANVAS_SIZE * PIXEL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * PIXEL_SIZE);
      ctx.lineTo(CANVAS_SIZE * PIXEL_SIZE, i * PIXEL_SIZE);
      ctx.stroke();
    }

    // Highlight hovered pixel
    if (hoveredPixel) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoveredPixel.x * PIXEL_SIZE,
        hoveredPixel.y * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );
    }
  }, [canvas, hoveredPixel]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse move for hover effect
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / PIXEL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / PIXEL_SIZE);

    if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
      setHoveredPixel({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPixel(null);
  };

  // Update canvas when receiving new pixel
  const updatePixel = useCallback((update: PixelUpdate) => {
    setCanvas(prev => {
      const newCanvas = prev.map(row => [...row]);
      newCanvas[update.y][update.x] = update.color;
      return newCanvas;
    });
    setLastUpdate(update);
  }, []);

  // Expose updatePixel for parent components
  useEffect(() => {
    if (onPixelUpdate) {
      // Parent can call this via ref if needed
    }
  }, [onPixelUpdate]);

  // Poll for updates (will be replaced with WebSocket)
  useEffect(() => {
    const pollCanvas = async () => {
      try {
        const res = await fetch('/api/canvas');
        const data = await res.json();
        setCanvas(data.canvas);
      } catch (error) {
        console.error('Failed to fetch canvas:', error);
      }
    };

    pollCanvas();
    const interval = setInterval(pollCanvas, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE * PIXEL_SIZE}
        height={CANVAS_SIZE * PIXEL_SIZE}
        className="border-2 border-gray-700 rounded-lg shadow-2xl cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Coordinates display */}
      <div className="text-sm text-gray-400 font-mono">
        {hoveredPixel ? (
          <span>
            ({hoveredPixel.x}, {hoveredPixel.y}) — 
            Color: {PALETTE[canvas[hoveredPixel.y][hoveredPixel.x]]}
          </span>
        ) : (
          <span>Hover over canvas to see coordinates</span>
        )}
      </div>

      {/* Last update */}
      {lastUpdate && (
        <div className="text-xs text-green-400 font-mono animate-pulse">
          🎨 {lastUpdate.agentId} placed pixel at ({lastUpdate.x}, {lastUpdate.y})
        </div>
      )}
    </div>
  );
}
