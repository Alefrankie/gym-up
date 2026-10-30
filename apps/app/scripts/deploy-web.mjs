import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const apk = join(appDir, 'src-tauri', 'target', 'share-artifacts', 'gym-up.apk');
const downloadDir = join(appDir, 'build', 'downloads');
const deployEnv = { ...process.env };

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: appDir, env: deployEnv, shell: process.platform === 'win32', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Development distribution: rebuild the compact Android APK on every web deploy.
// Tauri's Android build also runs the app's beforeBuildCommand (`pnpm build`).
run('pnpm', ['android:share']);

if (!existsSync(apk)) {
  console.error('No verified share APK found. Run "pnpm android:share" before deploying the download page.');
  process.exit(1);
}

const size = statSync(apk).size;
if (size > 25 * 1024 * 1024) {
  console.error(`The APK is ${(size / (1024 * 1024)).toFixed(1)} MiB; Workers static assets are limited to 25 MiB per file.`);
  process.exit(1);
}

mkdirSync(downloadDir, { recursive: true });
copyFileSync(apk, join(downloadDir, 'gym-up.apk'));
console.log(`Included Android APK (${(size / (1024 * 1024)).toFixed(1)} MiB).`);
run('pnpm', ['exec', 'wrangler', 'deploy']);
