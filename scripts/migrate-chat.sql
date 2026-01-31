-- Chat Messages Table
-- Run this in Supabase SQL Editor

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(id),
  human_id TEXT,  -- For paying humans (null for agents)
  sender_type TEXT NOT NULL DEFAULT 'agent' CHECK (sender_type IN ('agent', 'human', 'system')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'message' CHECK (type IN ('message', 'intent', 'reaction', 'system')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON chat_messages(agent_id);

-- Add chat_credits to agents table (for tracking earned chat ability)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS chat_credits INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read chat messages
CREATE POLICY "Anyone can read chat" ON chat_messages
  FOR SELECT USING (true);

-- Policy: Authenticated can insert (we'll validate in API)
CREATE POLICY "API can insert chat" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON chat_messages TO anon;
GRANT INSERT ON chat_messages TO anon;
