// Builds the signed release APK used for sharing, never the debug variant.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const tauriDir = join(appDir, 'src-tauri');
const isWin = process.platform === 'win32';
const releaseApk = join(tauriDir, 'target', 'release-artifacts', 'gym-up.apk');
const shareApk = join(tauriDir, 'target', 'share-artifacts', 'gym-up.apk');

const release = spawnSync('pnpm', ['android:release'], {
  cwd: appDir,
  shell: isWin,
  stdio: 'inherit',
});
if (release.status !== 0) process.exit(release.status ?? 1);
if (!existsSync(releaseApk)) throw new Error(`Expected verified release APK was not produced: ${releaseApk}`);

const size = statSync(releaseApk).size;
if (size > 25 * 1024 * 1024) {
  throw new Error('The signed release APK exceeds Cloudflare Workers static asset limit (25 MiB).');
}

mkdirSync(join(tauriDir, 'target', 'share-artifacts'), { recursive: true });
copyFileSync(releaseApk, shareApk);
console.log(`Saved verified signed release APK for sharing: ${shareApk} (${(size / (1024 * 1024)).toFixed(1)} MiB)`);
