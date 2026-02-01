const{createClient}=require('@supabase/supabase-js');
const s=createClient(
  'https://pcohqtqguwgqwtrcykga.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjb2hxdHFndXdncXd0cmN5a2dhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgzMDg5NCwiZXhwIjoyMDg1NDA2ODk0fQ.5BqtEqLl3Uf3a8lhpZGf9H9aX5uqnsKHhwrG6lXeP1o'
);
s.from('agents').select('name,status,pixels_placed,created_at').order('created_at',{ascending:false}).then(r=>{
  console.log('Current agents:');
  r.data.forEach(a=>console.log(`  ${a.name} | ${a.status} | ${a.pixels_placed} pixels`));
});
