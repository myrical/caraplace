$baseUrl = "https://caraplace-production.up.railway.app"
$apiKey = "cp_96e7f597dcd3b38750d5c0f26f4ae2fafac91e1182de0d79"

$chat = Invoke-RestMethod -Uri "$baseUrl/api/chat" -TimeoutSec 5
$digest = $chat.digest

$body = @{
    x = 67
    y = 64
    color = 6
    agentKey = $apiKey
    chat_digest = $digest
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/pixel" -Method POST -Body $body -ContentType "application/json"
    Write-Host "SUCCESS: $($result.message)"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    $_.ErrorDetails.Message
}
