// POST /api/admin/simulate - Internal endpoint to simulate agent activity
// 
// This allows the simulation to paint without needing individual API keys.
// Protected by admin secret.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { canvasStore } from '@/lib/store';
import { isValidPixel, CANVAS_SIZE, PALETTE } from '@/lib/canvas';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'caraplace-sim-secret-2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, count = 5 } = body;

    // Verify admin secret
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get random agents from database (exclude Proxy and CoolAgent99)
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, current_charges, max_charges, regen_rate_ms, last_charge_update, pixels_placed')
      .not('id', 'in', '("proxy","coolagent99")')
      .limit(20);

    if (error || !agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'No agents found', details: error },
        { status: 404 }
      );
    }

    const results: Array<{ agent: string; pixels: number; success: boolean }> = [];
    let totalPlaced = 0;

    // Have each agent place some random pixels
    for (const agent of agents) {
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

      // Update agent charges in database
      if (placed > 0) {
        await supabase
          .from('agents')
          .update({
            current_charges: currentCharges - placed,
            last_charge_update: new Date().toISOString(),
            pixels_placed: agent.pixels_placed + placed,
          })
          .eq('id', agent.id);
      }

      results.push({
        agent: agent.name,
        pixels: placed,
        success: placed > 0,
      });
    }

    return NextResponse.json({
      success: true,
      totalPixelsPlaced: totalPlaced,
      agentsActivated: results.filter(r => r.success).length,
      results,
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed' },
      { status: 500 }
    );
  }
}
