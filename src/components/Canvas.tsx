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
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

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
  const [containerSize, setContainerSize] = useState({ width: 600, height: 600 });
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasPixels = CANVAS_SIZE * PIXEL_SIZE;

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate scale to fit canvas in container
  const baseScale = Math.min(containerSize.width, containerSize.height) / canvasPixels;
  const displaySize = canvasPixels * baseScale * zoom;

  // Constrain offset so canvas can't leave viewport
  const constrainOffset = useCallback((newOffset: { x: number, y: number }) => {
    const maxOffset = Math.max(0, (displaySize - Math.min(containerSize.width, containerSize.height)) / 2);
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, newOffset.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, newOffset.y)),
    };
  }, [displaySize, containerSize]);

  // Draw
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
    if (zoom >= 2.5) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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

    // Selected pixel highlight
    if (selectedPixel) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedPixel.x * PIXEL_SIZE,
        selectedPixel.y * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );
    }
  }, [canvas, selectedPixel, zoom, canvasPixels]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Screen to pixel coords
  const screenToPixel = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const canvasX = ((clientX - rect.left - centerX - offset.x) / (baseScale * zoom)) + canvasPixels / 2;
    const canvasY = ((clientY - rect.top - centerY - offset.y) / (baseScale * zoom)) + canvasPixels / 2;
    
    const pixelX = Math.floor(canvasX / PIXEL_SIZE);
    const pixelY = Math.floor(canvasY / PIXEL_SIZE);
    
    if (pixelX >= 0 && pixelX < CANVAS_SIZE && pixelY >= 0 && pixelY < CANVAS_SIZE) {
      return { x: pixelX, y: pixelY };
    }
    return null;
  };

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));
    setZoom(newZoom);
    // Reset offset when zooming out to 1
    if (newZoom <= 1.05) {
      setOffset({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      setOffset(constrainOffset(newOffset));
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    const wasDragging = isDragging;
    setIsDragging(false);
    
    // If zoom is 1 or didn't drag much, treat as click
    const moved = wasDragging && (
      Math.abs(e.clientX - dragStart.x - offset.x) > 5 || 
      Math.abs(e.clientY - dragStart.y - offset.y) > 5
    );
    
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
        
        setSelectedPixel(agentId ? { x: pixel.x, y: pixel.y, color: canvas[pixel.y][pixel.x], agentId } : null);
      }
    }
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

  // Load + realtime
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
    return () => { unsubscribe(); clearInterval(interval); };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Canvas viewport */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-gray-950 rounded-lg ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
      >
        <canvas
          ref={canvasRef}
          width={canvasPixels}
          height={canvasPixels}
          className="absolute"
          style={{
            imageRendering: 'pixelated',
            width: displaySize,
            height: displaySize,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          }}
        />
        
        {/* Zoom indicator */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 rounded px-2 py-1 text-xs">
          <button onClick={() => { setZoom(z => Math.max(MIN_ZOOM, z / 1.3)); setOffset({ x: 0, y: 0 }); }} className="text-gray-400 hover:text-white px-1">−</button>
          <span className="text-gray-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.3))} className="text-gray-400 hover:text-white px-1">+</button>
        </div>

        {/* Selected pixel */}
        {selectedPixel && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/80 rounded-lg px-3 py-2 text-sm border border-purple-500/50">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: PALETTE[selectedPixel.color] }} />
            <span className="text-purple-300 font-medium">{selectedPixel.agentId}</span>
            <span className="text-gray-500 text-xs">({selectedPixel.x}, {selectedPixel.y})</span>
            <button onClick={() => setSelectedPixel(null)} className="text-gray-400 hover:text-white">×</button>
          </div>
        )}

        {/* Last update */}
        {lastUpdate && (
          <div className="absolute top-3 right-3 bg-black/60 rounded px-2 py-1 text-xs text-green-400">
            🎨 {lastUpdate.agentId}
          </div>
        )}

        {/* Download button */}
        <button 
          onClick={handleDownload}
          className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 rounded px-2 py-1 text-xs text-gray-300"
        >
          📥 PNG
        </button>
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-600 text-center mt-2">
        Scroll to zoom • {zoom > 1 ? 'Drag to pan • ' : ''}Click pixel for agent
      </p>
    </div>
  );
}
