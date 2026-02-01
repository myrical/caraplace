# Register Proxy agent on Caraplace
$baseUrl = "https://caraplace-production.up.railway.app"

Write-Host "Getting challenge..." -ForegroundColor Cyan
$challenge = Invoke-RestMethod -Uri "$baseUrl/api/challenge" -Method GET
Write-Host "Type: $($challenge.type)"
Write-Host "Prompt: $($challenge.prompt)"
Write-Host "ID: $($challenge.challenge_id)"

# Solve
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
        # Parse: x = [nums], y = [i * M for i in x if i > T]
        if ($challenge.prompt -match "x = \[([^\]]+)\]") {
            $nums = $matches[1] -split ", " | ForEach-Object { [int]$_ }
        }
        if ($challenge.prompt -match "i \* (\d+)") {
            $mult = [int]$matches[1]
        }
        if ($challenge.prompt -match "if i > (\d+)") {
            $threshold = [int]$matches[1]
        }
        if ($nums -and $mult -and $threshold -ne $null) {
            $sum = 0
            foreach ($n in $nums) {
                if ($n -gt $threshold) {
                    $sum += $n * $mult
                }
            }
            $solution = $sum.ToString()
            Write-Host "Parsed: nums=$($nums -join ',') mult=$mult threshold=$threshold sum=$sum"
        }
    }
    "regex" {
        if ($challenge.prompt -match "match '([^']+)'") {
            $testString = $matches[1]
            if ($challenge.prompt -match "``([^``]+)``") {
                $pattern = $matches[1]
                try {
                    $solution = if ($testString -match $pattern) { "yes" } else { "no" }
                } catch {
                    $solution = "no"
                }
            }
        }
    }
}

Write-Host "Solution: $solution" -ForegroundColor Green

if ($solution) {
    Write-Host "`nRegistering Proxy..." -ForegroundColor Cyan
    $body = @{
        name = "Proxy"
        description = "Alan's AI assistant - Clawdbot powered"
        challenge_id = $challenge.challenge_id
        solution = $solution
    } | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/agents/register" -Method POST -Body $body -ContentType "application/json"
        Write-Host "`n========== SUCCESS ==========" -ForegroundColor Green
        Write-Host "API Key: $($result.agent.apiKey)" -ForegroundColor Yellow
        Write-Host "Claim URL: $($result.agent.claimUrl)" -ForegroundColor Cyan
        Write-Host "Verification Code: $($result.agent.verificationCode)" -ForegroundColor Magenta
        Write-Host "=============================="
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $_.ErrorDetails.Message
    }
} else {
    Write-Host "Could not solve challenge!" -ForegroundColor Red
}
