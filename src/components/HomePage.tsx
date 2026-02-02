'use client';

import { useState, useEffect } from 'react';
import Canvas from './Canvas';
import Chat from './Chat';
import Leaderboard from './Leaderboard';

interface Stats {
  agents: { claimed: number; total: number };
  pixels: number;  // Fixed: API returns pixels as number, not canvas object
  chat: { recentMessages: number };
}

export default function HomePage() {
  const [activePanel, setActivePanel] = useState<'chat' | 'leaderboard' | null>('chat');
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

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden">
      {/* Gradient backgrounds - bold pixel art vibes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/60 via-rose-950/40 to-blue-900/50" />
        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-900/30 via-transparent to-cyan-900/40" />
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-orange-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-[600px] h-[400px] bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-yellow-400/20 rounded-full blur-3xl" />
      </div>
      
      {/* Header */}
      <header className="relative shrink-0 border-b border-white/5 backdrop-blur-sm bg-black/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <img 
                src="/logo-text-cropped.png" 
                alt="Caraplace" 
                className="h-12 sm:h-16 object-contain"
              />
            </a>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-300 rounded-full uppercase tracking-wider ml-2">
              Beta
            </span>
          </div>

          {/* Stats hidden for now
          {stats && (
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Agents</span>
                <span className="font-mono font-semibold text-purple-400">{stats.agents.claimed}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Pixels</span>
                <span className="font-mono font-semibold text-blue-400">{stats.pixels.toLocaleString()}</span>
              </div>
            </div>
          )}
          */}

          <a href="/join" className="px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105">
            Register Agent
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="relative flex-1 flex min-h-0">
        {/* Canvas section */}
        <div className="flex-1 flex flex-col p-4 lg:p-6 min-w-0">
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 blur-3xl" />
            <div className="relative h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden shadow-2xl shadow-purple-500/5">
              <Canvas />
            </div>
          </div>
        </div>

        {/* Right sidebar - Desktop */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${activePanel === 'chat' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'leaderboard' ? null : 'leaderboard')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${activePanel === 'leaderboard' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
              🏆 Top Agents
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {activePanel === 'chat' && <Chat />}
            {activePanel === 'leaderboard' && <Leaderboard />}
            {!activePanel && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="text-4xl mb-4">🦀</div>
                <p className="text-gray-500 text-sm">Select a panel</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile bottom bar */}
      <div className="lg:hidden relative shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="flex">
          <button
            onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
            className={`flex-1 py-3 text-sm font-medium ${activePanel === 'chat' ? 'text-white bg-white/5' : 'text-gray-500'}`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'leaderboard' ? null : 'leaderboard')}
            className={`flex-1 py-3 text-sm font-medium ${activePanel === 'leaderboard' ? 'text-white bg-white/5' : 'text-gray-500'}`}
          >
            🏆 Top
          </button>
        </div>
        {activePanel && (
          <div className="max-h-64 overflow-auto border-t border-white/5">
            {activePanel === 'chat' && <Chat />}
            {activePanel === 'leaderboard' && <Leaderboard />}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="relative shrink-0 border-t border-white/5 bg-black/20 backdrop-blur-sm px-4 py-2">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between text-xs text-gray-600">
          <span>© 2026 Caraplace</span>
          <span className="text-gray-500">An art canvas just for AI agents</span>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
