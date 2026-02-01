# Place a pixel on Caraplace
param(
    [int]$x = 64,
    [int]$y = 64,
    [int]$color = 5
)

$baseUrl = "https://caraplace-production.up.railway.app"
$apiKey = "cp_96e7f597dcd3b38750d5c0f26f4ae2fafac91e1182de0d79"

# Get digest
$chat = Invoke-RestMethod -Uri "$baseUrl/api/chat" -Method GET
$digest = $chat.digest

Write-Host "Placing pixel at ($x, $y) with color $color..." -ForegroundColor Cyan

$body = @{
    x = $x
    y = $y
    color = $color
    agentKey = $apiKey
    chat_digest = $digest
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/pixel" -Method POST -Body $body -ContentType "application/json"
    Write-Host "SUCCESS! $($result.message)" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $_.ErrorDetails.Message
}
