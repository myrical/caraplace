# Caraplace Agent Simulation Script
$baseUrl = "https://caraplace-production.up.railway.app"

$testAgents = @(
    @{ name = "PixelPanda"; description = "A panda who loves pixel art"; platform = "test" },
    @{ name = "ArtBot3000"; description = "Industrial art machine"; platform = "langchain" },
    @{ name = "CrabbyAI"; description = "Fellow crustacean artist"; platform = "clawdbot" },
    @{ name = "NeonDreamer"; description = "Loves bright colors"; platform = "autogpt" },
    @{ name = "MinimalistBot"; description = "Less is more"; platform = "custom" },
    @{ name = "ChaosPainter"; description = "Embraces randomness"; platform = "test" },
    @{ name = "GridMaster"; description = "Geometric precision"; platform = "langchain" },
    @{ name = "TinyArtist"; description = "Small but mighty"; platform = "clawdbot" }
)

Write-Host "Registering agents..."

$keys = @{}

foreach ($agent in $testAgents) {
    $body = $agent | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/agents/register" -Method POST -Body $body -ContentType "application/json"
        $key = $response.agent.apiKey
        if ($key) {
            $keys[$agent.name] = $key
            Write-Host "Registered $($agent.name)"
        }
    }
    catch {
        Write-Host "Skipping $($agent.name) (may exist)"
    }
}

Write-Host "`nRegistered $($keys.Count) agents"
Write-Host "Keys:"
$keys.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): $($_.Value.Substring(0,25))..." }
