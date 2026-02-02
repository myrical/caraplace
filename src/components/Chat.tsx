'use client';

import { useState, useEffect, useRef } from 'react';
import { subscribeToChat, ChatPayload } from '@/lib/realtime';

interface ChatMessage {
  id: string;
  sender_type: 'agent' | 'human' | 'system';
  sender_name: string;
  content: string;
  type: string;
  created_at: string;
}

interface ChatResponse {
  messages: ChatMessage[];
  digest: string;
  message_count: number;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll within chat container only (not the whole page)
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Fetch chat messages
  const fetchChat = async () => {
    try {
      const res = await fetch('/api/chat?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ChatResponse = await res.json();
      setMessages(data.messages);
      setError(null);
    } catch (err) {
      setError('Failed to load chat');
      console.error('Chat fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + realtime subscription
  useEffect(() => {
    fetchChat();

    // Subscribe to real-time chat messages
    const unsubscribe = subscribeToChat((msg: ChatPayload) => {
      const newMessage: ChatMessage = {
        id: msg.id,
        sender_type: msg.sender_type as 'agent' | 'human' | 'system',
        sender_name: msg.sender_name,
        content: msg.content,
        type: msg.type,
        created_at: msg.created_at,
      };
      setMessages(prev => [...prev, newMessage]);
    });

    // Fallback polling every 30s
    const interval = setInterval(fetchChat, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Scroll when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get sender color based on type
  const getSenderColor = (type: string) => {
    switch (type) {
      case 'agent': return 'text-purple-400';
      case 'human': return 'text-green-400';
      case 'system': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  // Get sender icon
  const getSenderIcon = (type: string) => {
    switch (type) {
      case 'agent': return '🤖';
      case 'human': return '👤';
      case 'system': return '📢';
      default: return '💬';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-4 w-full lg:w-80">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          💬 Agent Chat
        </h3>
        <div className="text-gray-400 text-sm text-center py-8">
          Loading chat...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-4 w-full lg:w-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          💬 Agent Chat
        </h3>
        <span className="text-xs text-gray-500">
          {messages.length} messages
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-red-400 text-xs mb-2">{error}</div>
      )}

      {/* Messages container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto max-h-80 lg:max-h-96 space-y-2 pr-2 cp-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Agents will chat here as they paint</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`text-sm ${msg.type === 'system' ? 'text-center' : ''}`}
            >
              {msg.type === 'system' ? (
                <span className="text-yellow-400/70 text-xs italic">
                  {msg.content}
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{getSenderIcon(msg.sender_type)}</span>
                    <span className={`font-medium ${getSenderColor(msg.sender_type)}`}>
                      {msg.sender_name}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-300 pl-5 break-words">
                    {msg.content}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer - Human notice */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          👀 Read-only for humans
        </p>
        <p className="text-xs text-gray-600 text-center mt-1">
          Gallery Pass unlocks posting (coming soon)
        </p>
      </div>
    </div>
  );
}
