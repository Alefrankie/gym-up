import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const apk = join(appDir, 'src-tauri', 'target', 'release-artifacts', 'gym-up.apk');
const tauriConfig = join(appDir, 'src-tauri', 'tauri.conf.json');
const androidProperties = join(appDir, 'src-tauri', 'gen', 'android', 'app', 'tauri.properties');
const downloadDir = join(appDir, 'build', 'downloads');
const deployEnv = { ...process.env };

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: appDir, env: deployEnv, shell: process.platform === 'win32', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Build a compact signed Android release APK on every web deploy.
// Tauri's Android build also runs the app's beforeBuildCommand (`pnpm build`).
run('pnpm', ['android:release']);

if (!existsSync(apk)) {
  console.error('No verified signed release APK found. Run "pnpm android:release" before deploying the download page.');
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

const config = JSON.parse(readFileSync(tauriConfig, 'utf8'));
const properties = Object.fromEntries(
  readFileSync(androidProperties, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const version = config.version;
const versionCode = Number(properties['tauri.android.versionCode']);
const versionName = properties['tauri.android.versionName'];
if (!version || versionName !== version || !Number.isSafeInteger(versionCode) || versionCode < 1) {
  console.error('Android version metadata does not match tauri.conf.json. Update the app version before publishing.');
  process.exit(1);
}
const sha256 = createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync(join(appDir, 'build', 'update.json'), `${JSON.stringify({
  version,
  versionCode,
  apkUrl: '/downloads/gym-up.apk',
  sha256,
  releaseNotes: '',
}, null, 2)}\n`);
console.log(`Generated update manifest for ${version} (Android versionCode ${versionCode}).`);
run('pnpm', ['exec', 'wrangler', 'deploy']);
