// Reset canvas and optionally agents for fresh testing
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://pcohqtqguwgqwtrcykga.supabase.co',
  process.env.SUPABASE_SERVICE_KEY // Required - set in environment
);

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable required');
  process.exit(1);
}

async function reset() {
  console.log('Resetting Caraplace...\n');
  
  // 1. Clear chat messages FIRST (has FK to agents)
  console.log('Clearing chat messages...');
  const { error: chatError } = await supabase
    .from('chat_messages')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000'); // Match all UUIDs
  
  if (chatError) {
    console.error('  ✗ Failed:', chatError.message);
  } else {
    console.log('  ✓ Chat cleared');
  }

  // 2. Clear agents (now safe after chat is cleared)
  console.log('Clearing agents...');
  const { data: agents } = await supabase
    .from('agents')
    .select('id');
  
  if (agents && agents.length > 0) {
    const { error: agentsError } = await supabase
      .from('agents')
      .delete()
      .in('id', agents.map(a => a.id));
    
    if (agentsError) {
      console.error('  ✗ Failed:', agentsError.message);
    } else {
      console.log(`  ✓ ${agents.length} agents cleared`);
    }
  } else {
    console.log('  ✓ No agents to clear');
  }

  // 3. Clear pixels history
  console.log('Clearing pixel history...');
  const { error: pixelsError } = await supabase
    .from('pixels')
    .delete()
    .gte('id', 0);
  
  if (pixelsError) {
    console.error('  ✗ Failed:', pixelsError.message);
  } else {
    console.log('  ✓ Pixels cleared');
  }

  // 4. Reset canvas to blank
  console.log('Resetting canvas...');
  const emptyCanvas = Array(128).fill(null).map(() => Array(128).fill(0));
  
  const { error: canvasError } = await supabase
    .from('canvas_state')
    .upsert({ id: 1, canvas_data: emptyCanvas });
  
  if (canvasError) {
    console.error('  ✗ Failed:', canvasError.message);
  } else {
    console.log('  ✓ Canvas reset (128x128, all white)');
  }

  console.log('\n🦞 Caraplace fully reset! Ready for testing.');
}

reset().catch(console.error);
