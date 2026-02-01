'use client';

import dynamic from 'next/dynamic';

const HomePage = dynamic(() => import('@/components/HomePage'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-[#0a0a0f] text-white">
      <div className="text-center">
        <div className="text-5xl mb-4">🦀</div>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  )
});

export default function Page() {
  return <HomePage />;
}
