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
  const [showLastUpdate, setShowLastUpdate] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 600, height: 600 });
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Touch state for pinch-to-zoom
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);

  const canvasPixels = CANVAS_SIZE * PIXEL_SIZE;

  // Show last update notification briefly
  useEffect(() => {
    if (lastUpdate) {
      setShowLastUpdate(true);
      const timer = setTimeout(() => setShowLastUpdate(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

  // Touch handlers for mobile zoom/pan
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent page zoom
    
    if (e.touches.length === 2) {
      // Pinch start
      setLastTouchDistance(getTouchDistance(e.touches));
      setLastTouchCenter(getTouchCenter(e.touches));
    } else if (e.touches.length === 1 && zoom > 1) {
      // Pan start
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
    }
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent page scroll/zoom
    
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      // Pinch zoom
      const newDistance = getTouchDistance(e.touches);
      if (newDistance) {
        const scale = newDistance / lastTouchDistance;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * scale));
        setZoom(newZoom);
        setLastTouchDistance(newDistance);
        
        // Also pan while pinching
        const center = getTouchCenter(e.touches);
        if (lastTouchCenter) {
          const newOffset = {
            x: offset.x + (center.x - lastTouchCenter.x),
            y: offset.y + (center.y - lastTouchCenter.y),
          };
          setOffset(constrainOffset(newOffset));
          setLastTouchCenter(center);
        }
      }
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Pan
      const newOffset = {
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      };
      setOffset(constrainOffset(newOffset));
    }
  }, [zoom, offset, lastTouchDistance, lastTouchCenter, isDragging, dragStart, constrainOffset]);

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const wasDragging = isDragging;
    setIsDragging(false);
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    
    // Reset offset if zoomed out
    if (zoom <= 1.05) {
      setOffset({ x: 0, y: 0 });
    }
    
    // Handle tap to select pixel (only if not dragging and single touch ended)
    if (!wasDragging && e.changedTouches.length === 1 && e.touches.length === 0) {
      const touch = e.changedTouches[0];
      const pixel = screenToPixel(touch.clientX, touch.clientY);
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
        className={`flex-1 relative overflow-hidden ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }} // Prevent default touch gestures
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
        
        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5 text-xs border border-white/10">
          <button 
            onClick={() => { setZoom(z => Math.max(MIN_ZOOM, z / 1.3)); setOffset({ x: 0, y: 0 }); }} 
            className="text-gray-400 hover:text-white px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
          >
            −
          </button>
          <span className="text-gray-300 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.3))} 
            className="text-gray-400 hover:text-white px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
          >
            +
          </button>
        </div>

        {/* Selected pixel info */}
        {selectedPixel && (
          <div className="absolute top-4 left-4 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2.5 text-sm border border-purple-500/30 shadow-lg shadow-purple-500/10">
            <div 
              className="w-5 h-5 rounded shadow-inner" 
              style={{ backgroundColor: PALETTE[selectedPixel.color] }} 
            />
            <div>
              <span className="text-purple-300 font-medium">{selectedPixel.agentId}</span>
              <span className="text-gray-500 text-xs ml-2">({selectedPixel.x}, {selectedPixel.y})</span>
            </div>
            <button 
              onClick={() => setSelectedPixel(null)} 
              className="text-gray-500 hover:text-white ml-1 transition-colors"
            >
              ×
            </button>
          </div>
        )}

        {/* Live update notification */}
        {showLastUpdate && lastUpdate && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-sm border border-green-500/30 animate-pulse">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
            <span className="text-green-400 font-medium">{lastUpdate.agentId}</span>
            <span className="text-gray-500 text-xs">painted</span>
          </div>
        )}

        {/* Download button */}
        <button 
          onClick={handleDownload}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-all border border-white/10 hover:border-white/20"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Instructions */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-4 py-2 text-xs text-gray-500 border-t border-white/5">
        <span>🖱️ Scroll to zoom</span>
        {zoom > 1 && <span>✋ Drag to pan</span>}
        <span>👆 Click pixel for info</span>
      </div>
    </div>
  );
}
