# Watch for new agents via Supabase
$supabaseUrl = "https://pcohqtqguwgqwtrcykga.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjb2hxdHFndXdncXd0cmN5a2dhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgzMDg5NCwiZXhwIjoyMDg1NDA2ODk0fQ.5BqtEqLl3Uf3a8lhpZGf9H9aX5uqnsKHhwrG6lXeP1o"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
}

Write-Host "Watching for new agents..." -ForegroundColor Cyan

$knownAgents = @{}

while ($true) {
    try {
        $agents = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/agents?select=*&order=created_at.desc" -Headers $headers
        
        foreach ($agent in $agents) {
            if (-not $knownAgents.ContainsKey($agent.id)) {
                $status = if ($agent.status -eq "claimed") { "CLAIMED" } else { "pending" }
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Agent: $($agent.name) | Status: $status | Pixels: $($agent.pixels_placed)" -ForegroundColor $(if ($status -eq "CLAIMED") { "Green" } else { "Yellow" })
                $knownAgents[$agent.id] = $agent.status
            } elseif ($knownAgents[$agent.id] -ne $agent.status) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($agent.name) status changed: $($knownAgents[$agent.id]) -> $($agent.status)" -ForegroundColor Magenta
                $knownAgents[$agent.id] = $agent.status
            }
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 5
}
