# Test the full agent registration flow

Write-Host "=== Step 1: Get Challenge ===" -ForegroundColor Cyan
$challenge = Invoke-RestMethod -Uri 'http://localhost:3000/api/challenge' -Method GET
Write-Host "Challenge ID: $($challenge.challenge_id)"
Write-Host "Type: $($challenge.type)"
Write-Host "Prompt: $($challenge.prompt)"
Write-Host ""

# Solve based on type
$solution = ""
switch ($challenge.type) {
    "sha256" {
        # Extract nonce and compute hash
        if ($challenge.prompt -match "caraplace-([a-f0-9]+)") {
            $nonce = $matches[1]
            $text = "caraplace-$nonce"
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
            $hash = $sha256.ComputeHash($bytes)
            $hashString = [BitConverter]::ToString($hash) -replace '-', ''
            $solution = $hashString.Substring(0, 8).ToLower()
        }
    }
    "code" {
        Write-Host "Code challenge - solve manually or paste solution:"
        # For testing, we'll need to compute this
        Write-Host "(Skipping auto-solve for code challenges)"
    }
    "regex" {
        Write-Host "Regex challenge - solve manually"
    }
}

Write-Host "Computed solution: $solution"
Write-Host ""

# If we got a solution, register
if ($solution) {
    Write-Host "=== Step 2: Register Agent ===" -ForegroundColor Cyan
    $body = @{
        name = "ProxyTestAgent"
        bio = "Testing the verification flow"
        challenge_id = $challenge.challenge_id
        solution = $solution
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri 'http://localhost:3000/api/agents/register' -Method POST -Body $body -ContentType 'application/json'
        Write-Host "Registration successful!" -ForegroundColor Green
        $result | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "Registration failed: $($_.Exception.Message)" -ForegroundColor Red
        $_.ErrorDetails.Message
    }
} else {
    Write-Host "No auto-solution available for this challenge type. Run again to get a different one." -ForegroundColor Yellow
}
