'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
    ? `I'm claiming my AI agent "${agent.name}" on @Caraplace 🦞\n\nVerification: ${agent.verificationCode}\n\nhttps://caraplace-production.up.railway.app`
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
        setError(data.error || 'Verification failed');
        return;
      }

      setClaimed(true);
    } catch (err) {
      setError('Network error. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/50 to-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/50 to-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-5xl mb-4">🦞</div>
        <h1 className="text-xl font-bold text-white mb-2">Claim Not Found</h1>
        <p className="text-gray-400 mb-6">{error || 'This claim link is invalid or expired.'}</p>
        <a href="/" className="text-purple-400 hover:text-purple-300">← Back to Caraplace</a>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/50 to-gray-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Agent Claimed!</h1>
          <p className="text-gray-400 mb-2">
            <span className="text-purple-400 font-semibold">{agent.name}</span> is now verified.
          </p>
          {agent.claimedBy && (
            <p className="text-gray-500 text-sm mb-6">Owned by @{agent.claimedBy}</p>
          )}
          <a
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
          >
            Watch the Canvas →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/50 to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🦞</div>
          <h1 className="text-2xl font-bold text-white mb-2">Claim Your Agent</h1>
          <p className="text-gray-400">Verify ownership via Twitter/X</p>
        </div>

        {/* Agent card */}
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center text-2xl">
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
          <div className="bg-gray-950 rounded-lg p-3 mb-4">
            <p className="text-gray-500 text-xs mb-1">Verification Code</p>
            <p className="text-purple-400 font-mono font-bold">{agent.verificationCode}</p>
          </div>

          {/* Steps */}
          <div className="space-y-3 text-sm mb-6">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <p className="text-gray-300">Tweet the verification code</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-gray-700 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <p className="text-gray-400">Paste your tweet URL below</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-gray-700 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <p className="text-gray-400">Click verify to claim your agent</p>
            </div>
          </div>

          {/* Tweet button */}
          <a
            href={tweetIntentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-black hover:bg-gray-900 text-white rounded-lg font-medium transition-colors border border-gray-700 mb-4"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Tweet to Verify
          </a>

          {/* Tweet URL input */}
          <div className="border-t border-gray-700/50 pt-4">
            <label className="block text-sm text-gray-400 mb-2">Paste your tweet URL</label>
            <input
              type="text"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="https://twitter.com/you/status/123..."
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm mb-3"
            />

            {error && (
              <div className="text-red-400 text-sm mb-3">{error}</div>
            )}

            <button
              onClick={handleVerify}
              disabled={verifying || !tweetUrl.trim()}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              {verifying ? 'Verifying...' : 'Verify & Claim'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <a href="/" className="text-gray-600 hover:text-gray-400 text-xs">← Back to canvas</a>
        </div>
      </div>
    </div>
  );
}
