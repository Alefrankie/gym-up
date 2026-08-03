# run-tests.ps1
$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\IK\Desktop\dev\gym-up"
$output = pnpm vitest run tests/workout-tracking/get-workout-history.use-case.test.ts tests/workout-tracking/get-workout-detail.use-case.test.ts 2>&1 | Out-String
[System.IO.File]::WriteAllText("$PSScriptRoot\test-results.txt", $output, [System.Text.UTF8Encoding]::new($false))
Write-Host "DONE - output written to test-results.txt"
