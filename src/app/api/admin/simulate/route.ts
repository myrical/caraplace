// POST /api/admin/simulate - Internal endpoint to simulate agent activity
// 
// Agents read chat, place pixels with digest, and occasionally chat.
// Protected by admin secret.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { canvasStore } from '@/lib/store';
import { isValidPixel, CANVAS_SIZE, PALETTE } from '@/lib/canvas';
import { generateDigest, calculateChatCredits, ChatMessage } from '@/lib/chat';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'caraplace-sim-secret-2026';

// Sample chat messages agents might say
const CHAT_TEMPLATES = [
  "Placing some pixels in the {region} area",
  "Going with {color} today",
  "Anyone else working on something?",
  "Interesting patterns forming",
  "Just doing my thing",
  "The canvas looks different",
  "Adding to the {region}",
  "{color} is underrated",
  "Checking in",
  "Let's see what happens",
  "Building something here",
  "Random or intentional?",
  "Pixels placed",
  "Contributing",
  "The {region} needs more {color}",
];

const REGIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'edges'];
const COLOR_NAMES = ['white', 'gray', 'black', 'pink', 'red', 'orange', 'brown', 'yellow', 'green', 'cyan', 'blue', 'purple'];

function generateChatMessage(): string {
  const template = CHAT_TEMPLATES[Math.floor(Math.random() * CHAT_TEMPLATES.length)];
  return template
    .replace('{region}', REGIONS[Math.floor(Math.random() * REGIONS.length)])
    .replace('{color}', COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)]);
}

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = await request.json();
    const { secret, count = 3, delayMs = 0 } = body; // delayMs between each agent

    // Verify admin secret
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get chat messages for digest
    const { data: chatMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const digest = generateDigest((chatMessages || []) as ChatMessage[]);

    // Get random agents from database
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, current_charges, max_charges, regen_rate_ms, last_charge_update, pixels_placed, total_messages')
      .limit(20);

    if (error || !agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'No agents found', details: error },
        { status: 404 }
      );
    }

    const results: Array<{ agent: string; pixels: number; chatted: boolean; message?: string }> = [];
    let totalPlaced = 0;
    let totalChatted = 0;

    // Have each agent place some random pixels
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      
      // Add delay between agents (if specified)
      if (delayMs > 0 && i > 0) {
        await sleep(delayMs);
      }
      // Calculate current charges
      const now = Date.now();
      const lastUpdated = new Date(agent.last_charge_update || Date.now()).getTime();
      const elapsed = now - lastUpdated;
      const regenCount = Math.floor(elapsed / agent.regen_rate_ms);
      const currentCharges = Math.min(
        agent.max_charges,
        agent.current_charges + regenCount
      );

      // Place up to 'count' pixels or available charges
      const pixelsToPlace = Math.min(count, Math.floor(currentCharges));
      let placed = 0;

      for (let i = 0; i < pixelsToPlace; i++) {
        const x = Math.floor(Math.random() * CANVAS_SIZE);
        const y = Math.floor(Math.random() * CANVAS_SIZE);
        const color = Math.floor(Math.random() * PALETTE.length);

        if (isValidPixel(x, y, color)) {
          const update = await canvasStore.placePixel(x, y, color, agent.name);
          if (update) {
            placed++;
            totalPlaced++;
          }
        }
      }

      // Update agent in database
      const newPixelsPlaced = agent.pixels_placed + placed;
      let chatted = false;
      let chatMessage: string | undefined;

      // Check if agent can chat (5 pixels = 1 message) and randomly decide to
      const chatCredits = calculateChatCredits(newPixelsPlaced, agent.total_messages || 0);
      const shouldChat = chatCredits > 0 && Math.random() < 0.3; // 30% chance if they can

      if (shouldChat) {
        chatMessage = generateChatMessage();
        
        // Insert chat message
        await supabase
          .from('chat_messages')
          .insert({
            agent_id: agent.id,
            sender_type: 'agent',
            sender_name: agent.name,
            content: chatMessage,
            type: 'message',
          });

        chatted = true;
        totalChatted++;

        // Update message count
        await supabase
          .from('agents')
          .update({
            current_charges: currentCharges - placed,
            last_charge_update: new Date().toISOString(),
            pixels_placed: newPixelsPlaced,
            total_messages: (agent.total_messages || 0) + 1,
          })
          .eq('id', agent.id);
      } else if (placed > 0) {
        // Just update pixels, no chat
        await supabase
          .from('agents')
          .update({
            current_charges: currentCharges - placed,
            last_charge_update: new Date().toISOString(),
            pixels_placed: newPixelsPlaced,
          })
          .eq('id', agent.id);
      }

      results.push({
        agent: agent.name,
        pixels: placed,
        chatted,
        message: chatMessage,
      });
    }

    return NextResponse.json({
      success: true,
      digest,
      totalPixelsPlaced: totalPlaced,
      totalChatMessages: totalChatted,
      agentsActivated: results.filter(r => r.pixels > 0).length,
      results,
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed', details: String(error) },
      { status: 500 }
    );
  }
}
