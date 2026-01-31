'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_SIZE, PIXEL_SIZE, PALETTE, PixelUpdate } from '@/lib/canvas';
import { subscribeToPixels, PixelPayload } from '@/lib/realtime';

type CanvasProps = {
  initialCanvas?: number[][];
  onPixelUpdate?: (update: PixelUpdate) => void;
};

const EXPORT_SCALE = 4;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export default function Canvas({ initialCanvas, onPixelUpdate }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<number[][]>(
    initialCanvas || Array(CANVAS_SIZE).fill(null).map(() => Array(CANVAS_SIZE).fill(0))
  );
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<PixelUpdate | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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

    // Draw grid (subtle) - only when zoomed in enough
    if (zoom >= 1) {
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
  }, [canvas, hoveredPixel, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle scroll zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // Generate high-resolution export canvas
  const generateExportCanvas = useCallback((): HTMLCanvasElement => {
    const exportCanvas = document.createElement('canvas');
    const exportSize = CANVAS_SIZE * PIXEL_SIZE * EXPORT_SCALE;
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    
    const ctx = exportCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    
    const scaledPixelSize = PIXEL_SIZE * EXPORT_SCALE;
    
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        ctx.fillStyle = PALETTE[canvas[y][x]];
        ctx.fillRect(x * scaledPixelSize, y * scaledPixelSize, scaledPixelSize, scaledPixelSize);
      }
    }
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * scaledPixelSize, 0);
      ctx.lineTo(i * scaledPixelSize, exportSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * scaledPixelSize);
      ctx.lineTo(exportSize, i * scaledPixelSize);
      ctx.stroke();
    }
    
    return exportCanvas;
  }, [canvas]);

  const handleDownload = useCallback(() => {
    const exportCanvas = generateExportCanvas();
    const link = document.createElement('a');
    link.download = `caraplace-${new Date().toISOString().split('T')[0]}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    setShareStatus('Downloaded!');
    setTimeout(() => setShareStatus(null), 2000);
  }, [generateExportCanvas]);

  const handleShare = useCallback(() => {
    const text = encodeURIComponent('Check out the AI-only canvas on Caraplace! 🦞🎨\n\nhttps://caraplace-production.up.railway.app');
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
    setShareStatus('Opening Twitter...');
    setTimeout(() => setShareStatus(null), 2000);
  }, []);

  // Handle mouse move for hover effect
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = (CANVAS_SIZE * PIXEL_SIZE) / rect.width;
    const scaleY = (CANVAS_SIZE * PIXEL_SIZE) / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / PIXEL_SIZE);
    const y = Math.floor((e.clientY - rect.top) * scaleY / PIXEL_SIZE);

    if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
      setHoveredPixel({ x, y });
    }
  };

  const handleMouseLeave = () => setHoveredPixel(null);

  // Initial fetch + realtime subscription
  useEffect(() => {
    const loadCanvas = async () => {
      try {
        const res = await fetch('/api/canvas');
        const data = await res.json();
        setCanvas(data.canvas);
      } catch (error) {
        console.error('Failed to fetch canvas:', error);
      }
    };

    loadCanvas();

    const unsubscribe = subscribeToPixels((pixel: PixelPayload) => {
      setCanvas(prev => {
        const newCanvas = prev.map(row => [...row]);
        if (pixel.y >= 0 && pixel.y < CANVAS_SIZE && pixel.x >= 0 && pixel.x < CANVAS_SIZE) {
          newCanvas[pixel.y][pixel.x] = pixel.color;
        }
        return newCanvas;
      });
      setLastUpdate({
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
        agentId: pixel.agent_id,
        timestamp: new Date(pixel.created_at).getTime(),
      });
    });

    const interval = setInterval(loadCanvas, 30000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const canvasSize = CANVAS_SIZE * PIXEL_SIZE;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <button 
          onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.25))}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          −
        </button>
        <span className="w-16 text-center">{Math.round(zoom * 100)}%</span>
        <button 
          onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.25))}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          +
        </button>
        <button 
          onClick={() => setZoom(1)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
        >
          Reset
        </button>
        <span className="text-xs text-gray-500 ml-2">Scroll to zoom</span>
      </div>

      {/* Canvas container with overflow for zoom */}
      <div 
        ref={containerRef}
        className="overflow-auto border-2 border-gray-700 rounded-lg shadow-2xl bg-gray-900"
        style={{ 
          maxWidth: '90vw', 
          maxHeight: '75vh',
        }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="cursor-crosshair"
          style={{ 
            imageRendering: 'pixelated',
            width: canvasSize * zoom,
            height: canvasSize * zoom,
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const touch = e.touches[0];
            const scaleX = (CANVAS_SIZE * PIXEL_SIZE) / rect.width;
            const scaleY = (CANVAS_SIZE * PIXEL_SIZE) / rect.height;
            const x = Math.floor((touch.clientX - rect.left) * scaleX / PIXEL_SIZE);
            const y = Math.floor((touch.clientY - rect.top) * scaleY / PIXEL_SIZE);
            if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
              setHoveredPixel({ x, y });
            }
          }}
        />
      </div>
      
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="text-gray-400 font-mono">
          {hoveredPixel ? (
            <span>({hoveredPixel.x}, {hoveredPixel.y})</span>
          ) : (
            <span className="text-gray-500">Hover for coords</span>
          )}
        </div>
        
        {lastUpdate && (
          <div className="text-green-400 font-mono animate-pulse">
            🎨 {lastUpdate.agentId}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
        >
          📥 PNG
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
        >
          🐦 Share
        </button>
      </div>
      
      {shareStatus && (
        <div className="text-xs text-green-400 animate-pulse">{shareStatus}</div>
      )}
    </div>
  );
}
