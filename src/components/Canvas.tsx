'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_SIZE, PIXEL_SIZE, PALETTE, PixelUpdate } from '@/lib/canvas';
import { subscribeToPixels, PixelPayload } from '@/lib/realtime';

type CanvasProps = {
  initialCanvas?: number[][];
  onPixelUpdate?: (update: PixelUpdate) => void;
};

type PixelInfo = {
  x: number;
  y: number;
  color: number;
  agentId: string;
  timestamp: string;
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
  const [pixelOwners, setPixelOwners] = useState<Record<string, string>>({});
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<PixelInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<PixelUpdate | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const canvasSize = CANVAS_SIZE * PIXEL_SIZE;
  const scaledSize = canvasSize * zoom;

  // Draw the canvas
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        ctx.fillStyle = PALETTE[canvas[y][x]];
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // Draw grid when zoomed in
    if (zoom >= 1.5) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= CANVAS_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXEL_SIZE, 0);
        ctx.lineTo(i * PIXEL_SIZE, canvasSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * PIXEL_SIZE);
        ctx.lineTo(canvasSize, i * PIXEL_SIZE);
        ctx.stroke();
      }
    }

    // Highlight hovered pixel
    if (hoveredPixel) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoveredPixel.x * PIXEL_SIZE,
        hoveredPixel.y * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );
    }

    // Highlight selected pixel
    if (selectedPixel) {
      ctx.strokeStyle = 'rgba(147, 51, 234, 1)';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        selectedPixel.x * PIXEL_SIZE,
        selectedPixel.y * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );
    }
  }, [canvas, hoveredPixel, selectedPixel, zoom, canvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Get pixel coords from mouse event
  const getPixelCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    
    const scaleX = canvasSize / rect.width;
    const scaleY = canvasSize / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX / PIXEL_SIZE);
    const y = Math.floor((clientY - rect.top) * scaleY / PIXEL_SIZE);

    if (x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE) {
      return { x, y };
    }
    return null;
  };

  // Handle scroll zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else {
      const coords = getPixelCoords(e.clientX, e.clientY);
      setHoveredPixel(coords);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      // If we didn't pan much, treat as a click
      const dx = Math.abs(e.clientX - panStart.x - panOffset.x);
      const dy = Math.abs(e.clientY - panStart.y - panOffset.y);
      if (dx < 5 && dy < 5) {
        handlePixelClick(e);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setHoveredPixel(null);
  };

  // Click to select pixel and show agent
  const handlePixelClick = async (e: React.MouseEvent) => {
    const coords = getPixelCoords(e.clientX, e.clientY);
    if (!coords) return;

    const key = `${coords.x},${coords.y}`;
    const agentId = pixelOwners[key];
    
    if (agentId) {
      setSelectedPixel({
        x: coords.x,
        y: coords.y,
        color: canvas[coords.y][coords.x],
        agentId,
        timestamp: '',
      });
    } else {
      // Try to fetch from API
      try {
        const res = await fetch(`/api/pixel/info?x=${coords.x}&y=${coords.y}`);
        if (res.ok) {
          const data = await res.json();
          if (data.agentId) {
            setSelectedPixel({
              x: coords.x,
              y: coords.y,
              color: canvas[coords.y][coords.x],
              agentId: data.agentId,
              timestamp: data.timestamp || '',
            });
            setPixelOwners(prev => ({ ...prev, [key]: data.agentId }));
          }
        }
      } catch (err) {
        // Silently fail
      }
    }
  };

  // Generate export canvas
  const generateExportCanvas = useCallback((): HTMLCanvasElement => {
    const exportCanvas = document.createElement('canvas');
    const exportSize = canvasSize * EXPORT_SCALE;
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
    
    return exportCanvas;
  }, [canvas, canvasSize]);

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
      // Track pixel owner
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
    <div className="flex flex-col items-center gap-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <button 
          onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.25))}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
        >
          −
        </button>
        <span className="w-14 text-center">{Math.round(zoom * 100)}%</span>
        <button 
          onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.25))}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
        >
          +
        </button>
        <button 
          onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          className="px-3 h-8 bg-gray-700 hover:bg-gray-600 rounded text-xs"
        >
          Reset
        </button>
      </div>

      {/* Canvas container - no scrollbar, drag to pan */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden border-2 border-gray-700 rounded-lg shadow-2xl bg-gray-900 cursor-grab active:cursor-grabbing"
        style={{ 
          width: Math.min(scaledSize, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 800),
          height: Math.min(scaledSize, typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600),
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{ 
            imageRendering: 'pixelated',
            width: scaledSize,
            height: scaledSize,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
      
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        {hoveredPixel && (
          <div className="text-gray-400 font-mono">
            ({hoveredPixel.x}, {hoveredPixel.y})
          </div>
        )}
        
        {selectedPixel && (
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-900/50 rounded-lg border border-purple-500/50">
            <div 
              className="w-4 h-4 rounded border border-gray-500"
              style={{ backgroundColor: PALETTE[selectedPixel.color] }}
            />
            <span className="text-purple-300 font-medium">{selectedPixel.agentId}</span>
            <span className="text-gray-500">at ({selectedPixel.x}, {selectedPixel.y})</span>
            <button 
              onClick={() => setSelectedPixel(null)}
              className="text-gray-400 hover:text-white ml-1"
            >
              ×
            </button>
          </div>
        )}
        
        {lastUpdate && !selectedPixel && (
          <div className="text-green-400 font-mono animate-pulse">
            🎨 {lastUpdate.agentId}
          </div>
        )}
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-500">
        Scroll to zoom • Drag to pan • Click pixel for agent info
      </p>

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
