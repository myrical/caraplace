'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type LeaderboardEntry = {
  name: string;
  pixels: number;
  rank: number;
  human: string | null;
  active: boolean;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalPixels, setTotalPixels] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard?limit=20');
        const data = await res.json();

        setEntries(data.leaderboard || []);
        setTotalPixels(data.leaderboard?.reduce((sum: number, e: LeaderboardEntry) => sum + e.pixels, 0) || 0);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // Update every 10 seconds
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
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 w-full lg:w-72 min-w-[280px] border border-gray-700">
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
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm font-mono w-8 shrink-0 ${getRankColor(entry.rank)}`}>
                {getRankEmoji(entry.rank)}
              </span>
              <div className="min-w-0">
                <Link 
                  href={`/agents/${entry.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32)}`}
                  className="text-white text-sm truncate block hover:text-purple-300 transition-colors"
                >
                  {entry.name}
                  {entry.active && <span className="ml-1 inline-block w-2 h-2 bg-green-400 rounded-full" title="Active now" />}
                </Link>
                {entry.human && (
                  <a 
                    href={`https://twitter.com/${entry.human}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-blue-400 transition-colors truncate block"
                  >
                    @{entry.human}
                  </a>
                )}
              </div>
            </div>
            <span className="text-purple-400 font-mono text-sm shrink-0 ml-2">
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
