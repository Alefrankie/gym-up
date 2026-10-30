// Builds a small, installable share APK without putting Rust debug symbols in the download.
// The app still uses Android's debug build type and debug signature for easy sideloading.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const tauriDir = join(appDir, 'src-tauri');
const androidDir = join(tauriDir, 'gen', 'android');
const isWin = process.platform === 'win32';
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk');
const ndkRoot = join(sdk, 'ndk');
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  NDK_HOME: process.env.NDK_HOME ?? (existsSync(ndkRoot) ? join(ndkRoot, readdirSync(ndkRoot).sort().at(-1)) : ''),
  PATH: `${join(homedir(), '.cargo', 'bin')}${isWin ? ';' : ':'}${process.env.PATH}`,
};

function run(command, args, { cwd = appDir, capture = false } = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  return spawnSync(command, args, {
    cwd,
    env,
    shell: isWin,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

const tauri = run('pnpm', ['exec', 'tauri', 'android', 'build', '--apk', '--target', 'aarch64'], { capture: true });
const output = `${tauri.stdout ?? ''}${tauri.stderr ?? ''}`;
process.stdout.write(output.split('\n').filter((line) => /Finished|Compiling|symbolic|error/i.test(line)).slice(-12).join('\n') + '\n');

const releaseLib = join(tauriDir, 'target', 'aarch64-linux-android', 'release', 'libapp_lib.so');
if (tauri.status !== 0 && !/symbolic link/i.test(output)) {
  console.error('\nThe optimized Android library build failed for a reason other than the expected Windows symlink restriction.');
  process.exit(tauri.status ?? 1);
}
if (!existsSync(releaseLib) || !/Finished.*\brelease\b.*profile/i.test(output)) {
  console.error(`\nThe optimized Android library was not produced by this build: ${releaseLib}`);
  process.exit(1);
}

const jni = join(androidDir, 'app', 'src', 'main', 'jniLibs', 'arm64-v8a');
mkdirSync(jni, { recursive: true });
copyFileSync(releaseLib, join(jni, 'libapp_lib.so'));

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'arm64', 'debug', 'app-arm64-debug.apk');
// Gradle can leave unused padding from an older, much larger APK when it reuses the output path.
if (existsSync(apk)) rmSync(apk);

const gradle = run(join(androidDir, isWin ? 'gradlew.bat' : 'gradlew'), [
  'assembleArm64Debug', '-x', 'rustBuildArm64Debug', '-x', 'rustBuildArmDebug', '-x', 'rustBuildUniversalDebug',
  '-x', 'rustBuildX86Debug', '-x', 'rustBuildX86_64Debug', '--console=plain',
], { cwd: androidDir });
if (gradle.status !== 0) process.exit(gradle.status ?? 1);

if (!existsSync(apk)) {
  console.error(`\nExpected APK was not produced: ${apk}`);
  process.exit(1);
}

const bytes = statSync(apk).size;
const mib = bytes / (1024 * 1024);
console.log(`\nAPK: ${apk} (${mib.toFixed(1)} MiB)`);
if (bytes > 25 * 1024 * 1024) {
  console.error('The APK exceeds Cloudflare Workers static asset limit (25 MiB). Host it in R2 or reduce the APK before deployment.');
  process.exit(1);
}
