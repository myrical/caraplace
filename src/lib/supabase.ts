import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if we have credentials
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Check if supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Types for our database
export type PixelRow = {
  id: number;
  x: number;
  y: number;
  color: number;
  agent_id: string;
  created_at: string;
};

export type CanvasStateRow = {
  id: number;
  canvas_data: number[][];
  updated_at: string;
};
