// Builds the debug APK (arm64) and installs it on the connected phone.
//
//   pnpm --filter @gym-up/app android:debug            build + install
//   pnpm --filter @gym-up/app android:debug -- --no-install
//
// Why not just `tauri android build`? On Windows without Developer Mode the Tauri CLI cannot create the
// symlink to libapp_lib.so (SeCreateSymbolicLinkPrivilege) and aborts after compiling. This script lets
// the CLI compile the Rust library (which also builds the frontend), then copies the library into jniLibs
// and runs Gradle itself, skipping the Gradle rust tasks that would call the CLI again.
// With Developer Mode on, `pnpm tauri android build --debug --apk --target aarch64` works on its own.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const tauriDir = join(appDir, 'src-tauri');
const androidDir = join(tauriDir, 'gen', 'android');
const isWin = process.platform === 'win32';
const install = !process.argv.includes('--no-install');

const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk');
const ndkRoot = join(sdk, 'ndk');
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  NDK_HOME: process.env.NDK_HOME ?? (existsSync(ndkRoot) ? join(ndkRoot, readdirSync(ndkRoot).sort().at(-1)) : ''),
  PATH: `${join(homedir(), '.cargo', 'bin')}${isWin ? ';' : ':'}${process.env.PATH}`,
};

function run(cmd, args, options = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', cwd: options.cwd ?? appDir, env, shell: isWin, encoding: 'utf8' });
  return r;
}

// 1. Compile Rust (and build the frontend). A symlink failure at the end is expected on Windows without Developer Mode.
const tauri = run('pnpm', ['tauri', 'android', 'build', '--debug', '--apk', '--target', 'aarch64'], { capture: true });
const output = `${tauri.stdout ?? ''}${tauri.stderr ?? ''}`;
process.stdout.write(output.split('\n').filter((l) => /Finished|Compiling app|symbolic|error/i.test(l)).slice(-8).join('\n') + '\n');
const lib = join(tauriDir, 'target', 'aarch64-linux-android', 'debug', 'libapp_lib.so');
if (tauri.status !== 0 && !/symbolic link/i.test(output)) {
  console.error('\nThe Rust build failed for a reason other than the symlink step. Full output above.');
  process.exit(tauri.status ?? 1);
}
if (!existsSync(lib)) {
  console.error(`\nExpected ${lib} after the build.`);
  process.exit(1);
}

// 2. Put the library where Gradle expects it (a copy instead of a symlink).
const jni = join(androidDir, 'app', 'src', 'main', 'jniLibs', 'arm64-v8a');
mkdirSync(jni, { recursive: true });
copyFileSync(lib, join(jni, 'libapp_lib.so'));

// 3. Gradle, without the tasks that re-run the Tauri CLI.
const gradle = run(join(androidDir, isWin ? 'gradlew.bat' : 'gradlew'), [
  'assembleArm64Debug', '-x', 'rustBuildArm64Debug', '-x', 'rustBuildArmDebug', '-x', 'rustBuildUniversalDebug',
  '-x', 'rustBuildX86Debug', '-x', 'rustBuildX86_64Debug', '--console=plain',
], { cwd: androidDir });
if (gradle.status !== 0) process.exit(gradle.status ?? 1);

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'arm64', 'debug', 'app-arm64-debug.apk');
console.log(`\nAPK: ${apk}`);

// 4. Install on the first connected device.
if (install) {
  const adb = join(sdk, 'platform-tools', isWin ? 'adb.exe' : 'adb');
  const bin = existsSync(adb) ? adb : 'adb';
  const devices = run(bin, ['devices'], { capture: true }).stdout ?? '';
  if (!/\tdevice\b/.test(devices)) {
    console.log('No device connected (enable USB debugging and accept the prompt). Install later with:\n  adb install -r "' + apk + '"');
  } else {
    const r = run(bin, ['install', '-r', apk]);
    if (r.status === 0) run(bin, ['shell', 'monkey', '-p', 'com.gymup.app.debug', '-c', 'android.intent.category.LAUNCHER', '1']);
  }
}
