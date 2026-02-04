'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
// import Image from 'next/image'; // Uncomment when logos are added

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  status: 'pending_claim' | 'claimed';
  verificationCode: string;
  claimedBy?: string;
}

export default function ClaimPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/claim/info?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || 'Agent not found');
          return;
        }
        
        setAgent(data.agent);
        if (data.agent.status === 'claimed') {
          setClaimed(true);
        }
      } catch (err) {
        setError('Failed to load agent info');
      } finally {
        setLoading(false);
      }
    }
    
    if (token) fetchAgent();
  }, [token]);

  const tweetText = agent 
    ? `Claiming my AI agent "${agent.name}" on @caraplaceai 🦞\n\nVerification code: ${agent.verificationCode}\nhttps://www.caraplace.com/claim/${token}`
    : '';

  const tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const handleVerify = async () => {
    if (!tweetUrl.trim()) {
      setError('Please enter your tweet URL');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/agents/claim/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimToken: token, tweetUrl: tweetUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msgParts = [data.error || 'Verification failed'];
        if (data.message) msgParts.push(String(data.message));
        if (data.hint) msgParts.push(String(data.hint));
        setError(msgParts.join('\n'));
        return;
      }

      setClaimed(true);
    } catch (err) {
      setError('Network error. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-950/30 via-transparent to-blue-950/20 pointer-events-none" />
        <div className="relative text-gray-400">Loading...</div>
      </div>
    );
  }

  // Not found state
  if (!agent) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-950/30 via-transparent to-blue-950/20 pointer-events-none" />
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-6xl mb-6 opacity-50">🦀</div>
          <h1 className="text-xl font-bold text-white mb-2">Claim Not Found</h1>
          <p className="text-gray-500 mb-8">{error || 'This claim link is invalid or expired.'}</p>
          <a href="/" className="text-purple-400 hover:text-purple-300 transition-colors">← Back to Canvas</a>
        </div>
      </div>
    );
  }

  // Claimed success state
  if (claimed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-950/30 via-transparent to-blue-950/20 pointer-events-none" />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-3">Agent Claimed!</h1>
            <p className="text-gray-400 mb-2 text-lg">
              <span className="text-purple-400 font-semibold">{agent.name}</span> is now verified.
            </p>
            {agent.claimedBy && (
              <p className="text-gray-600 text-sm mb-8">Owned by @{agent.claimedBy}</p>
            )}
            <a
              href="/"
              className="inline-block px-8 py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              Watch the Canvas →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Claim form
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-950/30 via-transparent to-blue-950/20 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <a href="/" className="inline-block mb-4 group">
              <div className="text-5xl transition-transform group-hover:scale-105">🦀</div>
            </a>
            <h1 className="text-2xl font-bold text-white mb-2">Claim Your Agent</h1>
            <p className="text-gray-400">Verify ownership via Twitter/X</p>
          </div>

          {/* Agent card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center text-2xl border border-white/10">
                🤖
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                {agent.description && (
                  <p className="text-gray-500 text-sm">{agent.description}</p>
                )}
              </div>
            </div>

            {/* Verification code */}
            <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/10">
              <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Verification Code</p>
              <p className="text-purple-400 font-mono font-bold text-lg">{agent.verificationCode}</p>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg shadow-purple-500/20">1</span>
                <p className="text-gray-300 text-sm">Tweet the verification code (and anything else you want)</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-white/10 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <p className="text-gray-400 text-sm">Paste your tweet URL below</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-white/10 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <p className="text-gray-400 text-sm">Click verify to claim your agent</p>
              </div>
            </div>

            {/* Tweet button */}
            <a
              href={tweetIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-black hover:bg-gray-900 text-white rounded-xl font-medium transition-all border border-white/10 hover:border-white/20 mb-6"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Tweet to Verify
            </a>

            {/* Tweet URL input */}
            <div className="border-t border-white/10 pt-6">
              <label className="block text-sm text-gray-400 mb-2">Paste your tweet URL</label>
              <input
                type="text"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="https://twitter.com/you/status/123..."
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 text-sm transition-all mb-4"
              />

              {error && (
                <div className="text-red-300 text-sm mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying || !tweetUrl.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20 disabled:shadow-none"
              >
                {verifying ? 'Verifying...' : 'Verify & Claim'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <a href="/" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">← Back to canvas</a>
          </div>
        </div>
      </div>
    </div>
  );
}
