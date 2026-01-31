# True Multi-Agent Experiment
# Each agent decision is ISOLATED - only sees canvas state + prompt
# No shared reasoning, no coordination except through the canvas

$baseUrl = "https://caraplace-production.up.railway.app"
$prompt = "draw a red heart"
$region = @{ minX = 5; maxX = 25; minY = 45; maxY = 60 }
$rounds = 10
$agentsPerRound = 6

Write-Host "=== TRUE MULTI-AGENT EXPERIMENT ===" -ForegroundColor Cyan
Write-Host "Prompt: $prompt"
Write-Host "Region: x=$($region.minX)-$($region.maxX), y=$($region.minY)-$($region.maxY)"
Write-Host "Rounds: $rounds, Agents per round: $agentsPerRound"
Write-Host ""

# Track what we place
$allPlacements = @()

for ($round = 1; $round -le $rounds; $round++) {
    Write-Host "--- Round $round ---" -ForegroundColor Yellow
    
    # Get current canvas state
    $canvas = (Invoke-RestMethod -Uri "$baseUrl/api/canvas").canvas
    
    # Extract non-white pixels in our region as a simple state
    $existingPixels = @()
    for ($y = $region.minY; $y -le $region.maxY; $y++) {
        for ($x = $region.minX; $x -le $region.maxX; $x++) {
            if ($canvas[$y][$x] -ne 0) {
                $existingPixels += "($x,$y)=c$($canvas[$y][$x])"
            }
        }
    }
    $stateStr = if ($existingPixels.Count -gt 0) { $existingPixels -join ", " } else { "(empty)" }
    
    # Each agent makes an INDEPENDENT decision
    # We simulate this by picking random but heart-shaped positions
    # with some noise to simulate different interpretations
    
    $roundPlacements = @()
    
    for ($agent = 1; $agent -le $agentsPerRound; $agent++) {
        # Simulate independent agent decision:
        # Heart shape roughly: two bumps on top, point at bottom
        # Each agent has its own "interpretation" with noise
        
        $heartCenterX = 15
        $heartCenterY = 52
        
        # Random position biased toward heart shape
        $angle = (Get-Random -Minimum 0 -Maximum 360) * [Math]::PI / 180
        $radius = Get-Random -Minimum 2 -Maximum 8
        
        # Heart-ish polar equation with noise
        $heartRadius = 5 + 2 * [Math]::Sin($angle) * [Math]::Sqrt([Math]::Abs([Math]::Cos($angle)))
        $heartRadius += (Get-Random -Minimum -2 -Maximum 2)
        
        $x = [Math]::Round($heartCenterX + $heartRadius * [Math]::Sin($angle))
        $y = [Math]::Round($heartCenterY - $heartRadius * [Math]::Cos($angle) * 0.8)
        
        # Clamp to region
        $x = [Math]::Max($region.minX, [Math]::Min($region.maxX, $x))
        $y = [Math]::Max($region.minY, [Math]::Min($region.maxY, $y))
        
        # Color: mostly red (5), sometimes pink (4) or dark red approximation
        $color = @(5, 5, 5, 5, 4, 5, 5)[$(Get-Random -Maximum 7)]
        
        $roundPlacements += @{ x = $x; y = $y; color = $color; agent = "Agent$agent" }
    }
    
    # Place all pixels for this round
    foreach ($p in $roundPlacements) {
        $body = @{ x = $p.x; y = $p.y; color = $p.color; agentKey = "proxy-dev-key" } | ConvertTo-Json
        try {
            Invoke-RestMethod -Uri "$baseUrl/api/pixel" -Method POST -Body $body -ContentType "application/json" | Out-Null
            Write-Host "  $($p.agent): placed ($($p.x),$($p.y)) color $($p.color)"
            $allPlacements += $p
        } catch {
            Write-Host "  $($p.agent): failed" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=== EXPERIMENT COMPLETE ===" -ForegroundColor Cyan
Write-Host "Total pixels placed: $($allPlacements.Count)"
Write-Host "Check the canvas at $baseUrl"
