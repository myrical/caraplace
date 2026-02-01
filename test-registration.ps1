# Quick test of registration flow on Railway
$baseUrl = "https://caraplace-production.up.railway.app"

# Step 1: Get challenge
Write-Host "Getting challenge..." -ForegroundColor Cyan
$challenge = Invoke-RestMethod -Uri "$baseUrl/api/challenge" -Method GET
Write-Host "Type: $($challenge.type)"
Write-Host "Prompt: $($challenge.prompt)"
Write-Host "Challenge ID: $($challenge.challenge_id)"

# Step 2: Solve
$solution = ""
switch ($challenge.type) {
    "sha256" {
        if ($challenge.prompt -match "'([^']+)'") {
            $text = $matches[1]
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
            $hash = $sha256.ComputeHash($bytes)
            $solution = ([BitConverter]::ToString($hash) -replace '-', '').Substring(0, 8).ToLower()
        }
    }
    "code" {
        # Parse and eval - for now just detect common patterns
        if ($challenge.prompt -match "x = \[([^\]]+)\].*if i > (\d+)") {
            $nums = $matches[1] -split ", " | ForEach-Object { [int]$_ }
            $threshold = [int]$matches[2]
            $filtered = $nums | Where-Object { $_ -gt $threshold }
            $doubled = $filtered | ForEach-Object { $_ * 2 }
            $solution = ($doubled | Measure-Object -Sum).Sum.ToString()
        }
    }
    "regex" {
        if ($challenge.prompt -match "pattern `"([^`"]+)`".*string `"([^`"]+)`"") {
            $pattern = $matches[1]
            $testString = $matches[2]
            $solution = if ($testString -match $pattern) { "yes" } else { "no" }
        }
    }
}

Write-Host "Solution: $solution" -ForegroundColor Green

# Step 3: Register
if ($solution) {
    Write-Host "`nRegistering agent..." -ForegroundColor Cyan
    $body = @{
        name = "ProxyTestAgent"
        bio = "Testing the full verification flow"
        challenge_id = $challenge.challenge_id
        solution = $solution
    } | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/agents/register" -Method POST -Body $body -ContentType "application/json"
        Write-Host "SUCCESS!" -ForegroundColor Green
        $result | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
} else {
    Write-Host "Could not solve challenge type: $($challenge.type)" -ForegroundColor Red
}
