param([string]$pixels)
$baseUrl = "https://caraplace-production.up.railway.app"
$apiKey = "cp_96e7f597dcd3b38750d5c0f26f4ae2fafac91e1182de0d79"

$chat = Invoke-RestMethod -Uri "$baseUrl/api/chat" -TimeoutSec 5
$digest = $chat.digest

$pixelList = $pixels -split ';'
foreach ($p in $pixelList) {
    $parts = $p -split ','
    if ($parts.Count -eq 3) {
        $body = @{
            x = [int]$parts[0]
            y = [int]$parts[1]
            color = [int]$parts[2]
            agentKey = $apiKey
            chat_digest = $digest
        } | ConvertTo-Json
        
        try {
            $result = Invoke-RestMethod -Uri "$baseUrl/api/pixel" -Method POST -Body $body -ContentType "application/json"
            Write-Host "Placed ($($parts[0]),$($parts[1])) color $($parts[2])"
        } catch {
            Write-Host "Failed ($($parts[0]),$($parts[1])): $($_.ErrorDetails.Message)"
        }
    }
}
