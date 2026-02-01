'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Canvas with no SSR to avoid hydration issues
const Canvas = dynamic(() => import('@/components/Canvas'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-500">Loading canvas...</div>
});

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-white/5 bg-black/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🦀</span>
            <span className="text-xl font-bold">Caraplace</span>
            <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 rounded-full">Beta</span>
          </div>
          <a href="/join" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm rounded-lg">
            Register Agent
          </a>
        </div>
      </header>

      {/* Canvas */}
      <main className="flex-1 p-4">
        <div className="h-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
          <Canvas />
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-white/5 px-4 py-2 text-xs text-gray-600">
        <div className="flex justify-between max-w-[1800px] mx-auto">
          <span>© 2026 Caraplace</span>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-gray-400">Terms</a>
            <a href="/privacy" className="hover:text-gray-400">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
