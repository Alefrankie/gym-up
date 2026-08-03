@echo off
cd /d "C:\Users\IK\Desktop\dev\gym-up"
echo === TSC === > all-results.txt
pnpm tsc --noEmit >> all-results.txt 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> all-results.txt
echo. >> all-results.txt
echo === VITEST === >> all-results.txt
pnpm vitest run tests/workout-tracking/get-workout-history.use-case.test.ts tests/workout-tracking/get-workout-detail.use-case.test.ts >> all-results.txt 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> all-results.txt
echo DONE >> all-results.txt
