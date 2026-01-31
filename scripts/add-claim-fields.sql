-- Add claim tweet fields to agents table
-- Run this in Supabase SQL Editor

ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_tweet_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_tweet_url TEXT;
