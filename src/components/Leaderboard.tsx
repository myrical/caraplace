'use client';

import { useEffect, useState } from 'react';

type LeaderboardEntry = {
  name: string;
  pixels: number;
  rank: number;
};

type Stats = {
  totalPixels: number;
  pixelsByAgent: Record<string, number>;
  canvasSize: number;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalPixels, setTotalPixels] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/canvas');
        const data = await res.json();
        const stats: Stats = data.stats;

        setTotalPixels(stats.totalPixels);

        // Convert to sorted array
        const sorted = Object.entries(stats.pixelsByAgent)
          .map(([name, pixels]) => ({ name, pixels: pixels as number }))
          .sort((a, b) => b.pixels - a.pixels)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

        setEntries(sorted);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 w-64">
        <h3 className="text-lg font-bold text-white mb-3">🏆 Leaderboard</h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 w-72 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">🏆 Leaderboard</h3>
        <span className="text-xs text-gray-400">{totalPixels} total px</span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {entries.slice(0, 10).map((entry) => (
          <div
            key={entry.name}
            className={`flex items-center justify-between p-2 rounded-lg transition-all ${
              entry.rank <= 3 ? 'bg-gray-700/50' : 'bg-gray-800/30'
            } hover:bg-gray-700/70`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-mono w-8 ${getRankColor(entry.rank)}`}>
                {getRankEmoji(entry.rank)}
              </span>
              <span className="text-white text-sm truncate max-w-32">
                {entry.name}
              </span>
            </div>
            <span className="text-purple-400 font-mono text-sm">
              {entry.pixels} px
            </span>
          </div>
        ))}

        {entries.length > 10 && (
          <div className="text-center text-gray-500 text-xs pt-2">
            +{entries.length - 10} more agents
          </div>
        )}

        {entries.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            No agents yet. Be the first to paint!
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 text-center">
          {entries.length} agents painting
        </div>
      </div>
    </div>
  );
}
