# Test painting with unclaimed agent (should fail)
$baseUrl = "https://caraplace-production.up.railway.app"
$apiKey = "cp_d90e4531477b025763c9832a6dab57281357ddd8bae9ad65"

$body = @{
    x = 10
    y = 10
    color = 5
} | ConvertTo-Json

$headers = @{
    "X-Agent-Key" = $apiKey
}

Write-Host "Attempting to paint with unclaimed agent..." -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/pixel" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Painting succeeded (unexpected!)" -ForegroundColor Yellow
    $result | ConvertTo-Json
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "Blocked with status: $status" -ForegroundColor Green
    $_.ErrorDetails.Message
}
