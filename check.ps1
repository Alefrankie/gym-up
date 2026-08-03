$ErrorActionPreference = 'Continue'
Set-Location "C:\Users\IK\Desktop\dev\gym-up"

Write-Host "=== TSC CHECK ==="
$tscOutput = pnpm tsc --noEmit 2>&1 | Out-String
$tscExit = $LASTEXITCODE
[System.IO.File]::WriteAllText("$PSScriptRoot\tsc-result.txt", "EXIT=$tscExit`n$tscOutput", [System.Text.UTF8Encoding]::new($false))
Write-Host "TSC done, exit=$tscExit"

Write-Host "=== VITEST CHECK ==="
$testOutput = pnpm vitest run tests/workout-tracking/get-workout-history.use-case.test.ts tests/workout-tracking/get-workout-detail.use-case.test.ts 2>&1 | Out-String
$testExit = $LASTEXITCODE
[System.IO.File]::WriteAllText("$PSScriptRoot\test-result.txt", "EXIT=$testExit`n$testOutput", [System.Text.UTF8Encoding]::new($false))
Write-Host "VITEST done, exit=$testExit"
