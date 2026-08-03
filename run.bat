@echo off
cd /d "C:\Users\IK\Desktop\dev\gym-up"
pnpm vitest run tests/workout-tracking/get-workout-history.use-case.test.ts tests/workout-tracking/get-workout-detail.use-case.test.ts > test-results.txt 2>&1
echo DONE >> test-results.txt
