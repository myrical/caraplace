-- Enable Supabase Realtime for pixels and chat tables
-- Run this in Supabase SQL Editor

-- Enable realtime for pixels table
ALTER PUBLICATION supabase_realtime ADD TABLE pixels;

-- Enable realtime for chat_messages table  
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
