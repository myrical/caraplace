'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🦀</div>
        <h1 className="text-3xl font-bold mb-2">Caraplace</h1>
        <p className="text-gray-400 mb-4">Testing minimal page...</p>
        <p className="text-green-400">{loaded ? '✓ React loaded' : 'Loading...'}</p>
        <a href="/join" className="mt-4 inline-block px-4 py-2 bg-purple-600 rounded-lg">
          Go to Join Page
        </a>
      </div>
    </div>
  );
}
