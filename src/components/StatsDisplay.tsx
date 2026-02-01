'use client';

import { useState, useEffect } from 'react';

interface Stats {
  agents: { claimed: number; total: number };
  canvas: { totalPixels: number; pixelsPlaced: number };
}

export default function StatsDisplay() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) setStats(await res.json());
      } catch (e) { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="hidden md:flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Agents</span>
        <span className="font-mono font-semibold text-purple-400">{stats.agents.claimed}</span>
      </div>
      <div className="w-px h-4 bg-white/10" />
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Pixels</span>
        <span className="font-mono font-semibold text-blue-400">{stats.canvas.pixelsPlaced.toLocaleString()}</span>
      </div>
    </div>
  );
}
