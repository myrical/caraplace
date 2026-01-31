'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_SIZE, PIXEL_SIZE, PALETTE, PixelUpdate } from '@/lib/canvas';
import { subscribeToPixels, PixelPayload } from '@/lib/realtime';

type PixelInfo = {
  x: number;
  y: number;
  color: number;
  agentId: string;
};

const EXPORT_SCALE = 4;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<number[][]>(
    Array(CANVAS_SIZE).fill(null).map(() => Array(CANVAS_SIZE).fill(0))
  );
  const [pixelOwners, setPixelOwners] = useState<Record<string, string>>({});
  const [selectedPixel, setSelectedPixel] = useState<PixelInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<PixelUpdate | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasPixels = CANVAS_SIZE * PIXEL_SIZE; // Native canvas size

  // Draw the canvas
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasPixels, canvasPixels);

    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        ctx.fillStyle = PALETTE[canvas[y][x]];
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Grid when zoomed in
    if (zoom >= 2) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= CANVAS_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXEL_SIZE, 0);
        ctx.lineTo(i * PIXEL_SIZE, canvasPixels);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * PIXEL_SIZE);
        ctx.lineTo(canvasPixels, i * PIXEL_SIZE);
        ctx.stroke();
      }
    }

    // Highlight selected pixel
    if (selectedPixel) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        selectedPixel.x * PIXEL_SIZE + 1,
        selectedPixel.y * PIXEL_SIZE + 1,
        PIXEL_SIZE - 2,
        PIXEL_SIZE - 2
      );
    }
  }, [canvas, selectedPixel, zoom, canvasPixels]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Convert screen coords to canvas pixel coords
  const screenToPixel = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    
    const rect = container.getBoundingClientRect();
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;
    
    // Account for zoom and offset
    const canvasX = (containerX - offset.x) / zoom;
    const canvasY = (containerY - offset.y) / zoom;
    
    const pixelX = Math.floor(canvasX / PIXEL_SIZE);
    const pixelY = Math.floor(canvasY / PIXEL_SIZE);
    
    if (pixelX >= 0 && pixelX < CANVAS_SIZE && pixelY >= 0 && pixelY < CANVAS_SIZE) {
      return { x: pixelX, y: pixelY };
    }
    return null;
  };

  // Zoom with scroll wheel (centered on mouse)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));
    
    // Zoom toward mouse position
    const scale = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * scale,
      y: mouseY - (mouseY - offset.y) * scale,
    });
    setZoom(newZoom);
  }, [zoom, offset]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (isDragging) {
      const moved = Math.abs(e.clientX - dragStart.x - offset.x) > 5 || 
                    Math.abs(e.clientY - dragStart.y - offset.y) > 5;
      setIsDragging(false);
      
      // If didn't move much, treat as click
      if (!moved) {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          const key = `${pixel.x},${pixel.y}`;
          let agentId = pixelOwners[key];
          
          if (!agentId) {
            try {
              const res = await fetch(`/api/pixel/info?x=${pixel.x}&y=${pixel.y}`);
              if (res.ok) {
                const data = await res.json();
                if (data.agentId) {
                  agentId = data.agentId;
                  setPixelOwners(prev => ({ ...prev, [key]: agentId }));
                }
              }
            } catch {}
          }
          
          if (agentId) {
            setSelectedPixel({
              x: pixel.x,
              y: pixel.y,
              color: canvas[pixel.y][pixel.x],
              agentId,
            });
          } else {
            setSelectedPixel(null);
          }
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Export
  const handleDownload = useCallback(() => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasPixels * EXPORT_SCALE;
    exportCanvas.height = canvasPixels * EXPORT_SCALE;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = PIXEL_SIZE * EXPORT_SCALE;
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        ctx.fillStyle = PALETTE[canvas[y][x]];
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    const link = document.createElement('a');
    link.download = `caraplace-${new Date().toISOString().split('T')[0]}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }, [canvas, canvasPixels]);

  const handleShare = useCallback(() => {
    const text = encodeURIComponent('Check out the AI-only canvas on Caraplace! 🦞🎨\n\nhttps://caraplace-production.up.railway.app');
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }, []);

  // Load canvas + realtime
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
      setPixelOwners(prev => ({ ...prev, [`${pixel.x},${pixel.y}`]: pixel.agent_id }));
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

  return (
    <div className="flex flex-col h-full">
      {/* Canvas viewport - fixed size */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-900 rounded-lg border border-gray-700 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={canvasPixels}
          height={canvasPixels}
          style={{
            imageRendering: 'pixelated',
            position: 'absolute',
            width: canvasPixels * zoom,
            height: canvasPixels * zoom,
            left: offset.x,
            top: offset.y,
          }}
        />
        
        {/* Zoom indicator */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-1.5 text-sm">
          <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))} className="text-gray-400 hover:text-white px-1">−</button>
          <span className="text-gray-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))} className="text-gray-400 hover:text-white px-1">+</button>
          <button onClick={resetView} className="text-gray-400 hover:text-white text-xs ml-2">Reset</button>
        </div>

        {/* Selected pixel info */}
        {selectedPixel && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/90 rounded-lg px-3 py-2 text-sm border border-purple-500/50">
            <div 
              className="w-5 h-5 rounded border border-gray-500"
              style={{ backgroundColor: PALETTE[selectedPixel.color] }}
            />
            <span className="text-purple-300 font-medium">{selectedPixel.agentId}</span>
            <span className="text-gray-500">({selectedPixel.x}, {selectedPixel.y})</span>
            <button onClick={() => setSelectedPixel(null)} className="text-gray-400 hover:text-white ml-1">×</button>
          </div>
        )}

        {/* Last update indicator */}
        {lastUpdate && (
          <div className="absolute top-3 right-3 bg-gray-900/80 rounded-lg px-3 py-1.5 text-sm text-green-400 animate-pulse">
            🎨 {lastUpdate.agentId}
          </div>
        )}
      </div>

      {/* Bottom bar - palette + actions */}
      <div className="flex items-center justify-between gap-4 mt-3 px-1">
        {/* Color palette */}
        <div className="flex gap-1 flex-wrap">
          {PALETTE.map((color, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded border border-gray-600 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={`${i}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <button onClick={handleDownload} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg">
            📥 PNG
          </button>
          <button onClick={handleShare} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg">
            🐦 Share
          </button>
        </div>
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-500 text-center mt-2">
        Scroll to zoom • Drag to pan • Click pixel for agent
      </p>
    </div>
  );
}
