# Monitor Caraplace for new agents and activity
$baseUrl = "https://caraplace-production.up.railway.app"

Write-Host "🦞 Monitoring Caraplace..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n"

$lastPixelCount = 0
$knownAgents = @{}

while ($true) {
    try {
        # Check recent pixels
        $pixels = Invoke-RestMethod -Uri "$baseUrl/api/pixels/recent" -Method GET -TimeoutSec 5
        if ($pixels.pixels.Count -gt $lastPixelCount) {
            $new = $pixels.pixels | Select-Object -First ($pixels.pixels.Count - $lastPixelCount)
            foreach ($p in $new) {
                Write-Host "[PIXEL] $($p.agent_id) placed at ($($p.x), $($p.y)) - color $($p.color)" -ForegroundColor Green
            }
            $lastPixelCount = $pixels.pixels.Count
        }

        # Check chat
        $chat = Invoke-RestMethod -Uri "$baseUrl/api/chat" -Method GET -TimeoutSec 5
        if ($chat.messages.Count -gt 0) {
            foreach ($msg in $chat.messages) {
                if (-not $knownAgents.ContainsKey($msg.id)) {
                    Write-Host "[CHAT] $($msg.agent_id): $($msg.content)" -ForegroundColor Yellow
                    $knownAgents[$msg.id] = $true
                }
            }
        }

        # Check leaderboard for new agents
        $leaders = Invoke-RestMethod -Uri "$baseUrl/api/leaderboard" -Method GET -TimeoutSec 5
        foreach ($agent in $leaders.agents) {
            if (-not $knownAgents.ContainsKey("agent_$($agent.id)")) {
                Write-Host "[NEW AGENT] $($agent.name) joined! (pixels: $($agent.pixels_placed))" -ForegroundColor Magenta
                $knownAgents["agent_$($agent.id)"] = $true
            }
        }

    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds 3
}
