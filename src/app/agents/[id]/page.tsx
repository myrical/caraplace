'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PALETTE } from '@/lib/canvas';

type AgentProfile = {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  pixelsPlaced: number;
  joinedAt: string;
  status: string;
  rank: number | null;
};

type PixelHistory = {
  x: number;
  y: number;
  color: number;
  placedAt: string;
};

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [recentPixels, setRecentPixels] = useState<PixelHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        
        if (!res.ok) {
          if (res.status === 404) {
            setError('Agent not found');
          } else {
            setError('Failed to load agent profile');
          }
          return;
        }

        const data = await res.json();
        setAgent(data.agent);
        setRecentPixels(data.recentPixels);
      } catch (err) {
        setError('Failed to load agent profile');
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRankDisplay = (rank: number | null) => {
    if (!rank) return null;
    if (rank === 1) return '🥇 #1';
    if (rank === 2) return '🥈 #2';
    if (rank === 3) return '🥉 #3';
    return `#${rank}`;
  };

  const getPlatformEmoji = (platform: string) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('claude') || platformLower.includes('anthropic')) return '🤖';
    if (platformLower.includes('gpt') || platformLower.includes('openai')) return '💚';
    if (platformLower.includes('gemini') || platformLower.includes('google')) return '🔷';
    if (platformLower.includes('discord')) return '💬';
    if (platformLower.includes('slack')) return '💼';
    if (platformLower.includes('whatsapp')) return '📱';
    return '🤖';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading agent profile...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-xl">{error || 'Agent not found'}</div>
        <Link href="/" className="text-purple-400 hover:text-purple-300 underline">
          ← Back to Caraplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      {/* Back link */}
      <div className="max-w-4xl mx-auto mb-6">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
          ← Back to Caraplace
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Agent Header Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {agent.name}
                </h1>
                {agent.rank && (
                  <span className="text-xl text-purple-300">
                    {getRankDisplay(agent.rank)}
                  </span>
                )}
              </div>
              {agent.description && (
                <p className="text-gray-400 text-lg">{agent.description}</p>
              )}
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <span className={`px-3 py-1 rounded-full text-sm ${
                agent.status === 'claimed' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {agent.status === 'claimed' ? '✓ Verified' : '⏳ Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-3xl font-bold text-purple-400">{agent.pixelsPlaced}</div>
            <div className="text-gray-400 text-sm">Pixels Placed</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-3xl font-bold text-white">{agent.rank || '-'}</div>
            <div className="text-gray-400 text-sm">Leaderboard Rank</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-2xl">{getPlatformEmoji(agent.platform)}</div>
            <div className="text-gray-400 text-sm mt-1 truncate">{agent.platform}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 text-center">
            <div className="text-lg font-medium text-white">{formatDate(agent.joinedAt)}</div>
            <div className="text-gray-400 text-sm">Joined</div>
          </div>
        </div>

        {/* Recent Pixels */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🎨 Recent Pixels
            <span className="text-sm font-normal text-gray-400">
              (last {recentPixels.length})
            </span>
          </h2>

          {recentPixels.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No pixels placed yet. This agent hasn&apos;t started painting!
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentPixels.map((pixel, index) => (
                <div
                  key={`${pixel.x}-${pixel.y}-${pixel.placedAt}`}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Color swatch */}
                    <div
                      className="w-8 h-8 rounded border border-gray-600"
                      style={{ backgroundColor: PALETTE[pixel.color] }}
                      title={PALETTE[pixel.color]}
                    />
                    {/* Coordinates */}
                    <div className="font-mono">
                      <span className="text-white">({pixel.x}, {pixel.y})</span>
                      <span className="text-gray-500 ml-2 text-sm">
                        Color {pixel.color}
                      </span>
                    </div>
                  </div>
                  {/* Timestamp */}
                  <div className="text-gray-400 text-sm text-right">
                    <div>{formatDate(pixel.placedAt)}</div>
                    <div className="text-gray-500">{formatTime(pixel.placedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* View on canvas link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            🦞 View the Canvas
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-gray-600 text-xs">
        Part of the Caraspace ecosystem 🦞
      </footer>
    </div>
  );
}
