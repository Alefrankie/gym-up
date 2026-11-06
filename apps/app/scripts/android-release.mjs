// Build and verify a compact Android release APK signed by a local key kept outside the repo.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const tauriDir = join(appDir, 'src-tauri');
const androidDir = join(tauriDir, 'gen', 'android');
const isWin = process.platform === 'win32';
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk');
const signingDir = join(homedir(), '.gym-up', 'android-signing');
const keystore = join(signingDir, 'gym-up-release.jks');
const signingProps = join(signingDir, 'keystore.properties');
const alias = 'gym-up-release';
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  NDK_HOME: process.env.NDK_HOME ?? (existsSync(join(sdk, 'ndk')) ? join(sdk, 'ndk', readdirSync(join(sdk, 'ndk')).sort().at(-1)) : ''),
  GYM_UP_ANDROID_SIGNING_PROPERTIES: signingProps,
  GYM_UP_SKIP_GRADLE_RUST: '1',
  PATH: `${join(homedir(), '.cargo', 'bin')}${isWin ? ';' : ':'}${process.env.PATH}`,
};

function run(command, args, { cwd = appDir, capture = false, encoding = 'utf8' } = {}) {
  const safeArgs = args.map((arg, index) => args[index - 1] === '-storepass' || args[index - 1] === '-keypass' ? '[redacted]' : arg);
  console.log(`\n> ${command} ${safeArgs.join(' ')}`);
  return spawnSync(command, args, {
    cwd,
    env,
    shell: isWin,
    encoding,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function ensureSigningMaterial() {
  mkdirSync(signingDir, { recursive: true, mode: 0o700 });
  if (existsSync(keystore) && existsSync(signingProps)) return;
  if (existsSync(keystore) || existsSync(signingProps)) {
    throw new Error(`Signing setup is incomplete. Keep both files together in ${signingDir}; refusing to replace either one.`);
  }

  const storePassword = randomBytes(32).toString('base64url');
  const keyPassword = randomBytes(32).toString('base64url');
  const keygen = run('keytool', [
    '-genkeypair', '-v', '-keystore', keystore, '-storetype', 'JKS', '-storepass', storePassword,
    '-keypass', keyPassword, '-alias', alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=GymUp,O=GymUp,C=PT',
  ]);
  if (keygen.status !== 0 || !existsSync(keystore)) {
    throw new Error('Could not create the Android signing key. Check that keytool (JDK) is installed and on PATH.');
  }

  const propertyText = [
    `storeFile=${keystore.replaceAll('\\', '/')}`,
    `storePassword=${storePassword}`,
    `keyAlias=${alias}`,
    `keyPassword=${keyPassword}`,
    '',
  ].join('\n');
  writeFileSync(signingProps, propertyText, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.log(`Created a private Android signing key outside the repository: ${keystore}`);
  console.log(`Its password file is also outside the repository: ${signingProps}`);
  console.log('Back up both files securely; future updates must use this same signing key.');
}

function patchGradleSigning() {
  const gradleFile = join(androidDir, 'app', 'build.gradle.kts');
  if (!existsSync(gradleFile)) throw new Error(`Generated Android Gradle project is missing: ${gradleFile}`);
  let source = readFileSync(gradleFile, 'utf8');
  if (!source.includes('// GYM_UP_SIGNING_CONFIG_START')) {
    const propertiesMarker = 'val tauriProperties = Properties().apply {';
    const propertiesStart = source.indexOf(propertiesMarker);
    if (propertiesStart < 0) throw new Error('Unrecognized generated Android Gradle file (Tauri properties block not found).');
    const propertiesEnd = source.indexOf('\n}', propertiesStart) + 2;
    const signingBlock = `\n\n// GYM_UP_SIGNING_CONFIG_START\nval gymUpSigningProperties = Properties().apply {\n    val path = System.getenv("GYM_UP_ANDROID_SIGNING_PROPERTIES")\n    if (path != null) file(path).takeIf { it.exists() }?.inputStream()?.use { load(it) }\n}\nval gymUpHasSigning = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all {\n    !gymUpSigningProperties.getProperty(it).isNullOrBlank()\n}\n// GYM_UP_SIGNING_CONFIG_END`;
    source = source.slice(0, propertiesEnd) + signingBlock + source.slice(propertiesEnd);
  }
  if (!source.includes('create("gymUpRelease")')) {
    const buildTypes = '    buildTypes {';
    if (!source.includes(buildTypes)) throw new Error('Unrecognized generated Android Gradle file (buildTypes block not found).');
    const signingConfigs = `    if (gymUpHasSigning) {\n        signingConfigs {\n            create("gymUpRelease") {\n                storeFile = file(gymUpSigningProperties.getProperty("storeFile"))\n                storePassword = gymUpSigningProperties.getProperty("storePassword")\n                keyAlias = gymUpSigningProperties.getProperty("keyAlias")\n                keyPassword = gymUpSigningProperties.getProperty("keyPassword")\n            }\n        }\n    }\n`;
    source = source.replace(buildTypes, `${signingConfigs}${buildTypes}`);
  }
  const releaseBlock = '        getByName("release") {';
  if (source.includes(releaseBlock) && !source.includes('signingConfig = signingConfigs.getByName("gymUpRelease")')) {
    source = source.replace(releaseBlock, `${releaseBlock}\n            if (gymUpHasSigning) signingConfig = signingConfigs.getByName("gymUpRelease")`);
  }
  writeFileSync(gradleFile, source, 'utf8');
}

ensureSigningMaterial();
// Sign inside Tauri's own Gradle run so its APK can ship without a second Gradle pass.
patchGradleSigning();

const releaseLib = join(tauriDir, 'target', 'aarch64-linux-android', 'release', 'libapp_lib.so');
const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'arm64', 'release', 'app-arm64-release.apk');
// A cached library or APK must never pass for this build's output.
rmSync(releaseLib, { force: true });
rmSync(apk, { force: true });

const tauri = run('pnpm', ['exec', 'tauri', 'android', 'build', '--apk', '--target', 'aarch64'], { capture: true });
const output = `${tauri.stdout ?? ''}${tauri.stderr ?? ''}`;
process.stdout.write(output.split('\n').filter((line) => /Finished|Compiling|symbolic|error/i.test(line)).slice(-12).join('\n') + '\n');

if (tauri.status !== 0 && !/symbolic link/i.test(output)) {
  console.error('\nThe optimized Android library build failed for a reason other than the expected Windows symlink restriction.');
  process.exit(tauri.status ?? 1);
}
if (!existsSync(releaseLib) || !/Finished.*\brelease\b.*profile/i.test(output)) {
  console.error(`\nThe optimized Android library was not produced by this build: ${releaseLib}`);
  process.exit(1);
}

// On Windows Tauri stops at the jniLibs symlink before Gradle runs, so package the APK here.
if (tauri.status !== 0 || !existsSync(apk)) {
  const jni = join(androidDir, 'app', 'src', 'main', 'jniLibs', 'arm64-v8a');
  mkdirSync(jni, { recursive: true });
  copyFileSync(releaseLib, join(jni, 'libapp_lib.so'));
  rmSync(apk, { force: true });
  const gradle = run(join(androidDir, isWin ? 'gradlew.bat' : 'gradlew'), [
    'assembleArm64Release', '-x', 'rustBuildArm64Release', '-x', 'rustBuildArmRelease', '-x', 'rustBuildUniversalRelease',
    '-x', 'rustBuildX86Release', '-x', 'rustBuildX86_64Release', '--console=plain',
  ], { cwd: androidDir });
  if (gradle.status !== 0) process.exit(gradle.status ?? 1);
}
if (!existsSync(apk)) throw new Error(`Expected release APK was not produced: ${apk}`);

const buildTools = join(sdk, 'build-tools');
const apksignerDir = process.env.ANDROID_BUILD_TOOLS_VERSION
  ?? (existsSync(buildTools) ? readdirSync(buildTools).sort().at(-1) : undefined);
const apksigner = apksignerDir ? join(buildTools, apksignerDir, isWin ? 'apksigner.bat' : 'apksigner') : '';
if (!apksigner || !existsSync(apksigner)) throw new Error(`Android apksigner was not found under ${buildTools}.`);
const aapt = apksignerDir ? join(buildTools, apksignerDir, isWin ? 'aapt.exe' : 'aapt') : '';
if (!aapt || !existsSync(aapt)) throw new Error(`Android aapt was not found under ${buildTools}.`);
const tauriConfig = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'));
const androidProperties = Object.fromEntries(
  readFileSync(join(androidDir, 'app', 'tauri.properties'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const badging = run(aapt, ['dump', 'badging', apk], { cwd: androidDir, capture: true });
const badgingOutput = `${badging.stdout ?? ''}${badging.stderr ?? ''}`;
const packageLine = badgingOutput.split(/\r?\n/).find((line) => line.startsWith('package: ')) ?? '';
const expectedPackage = `package: name='${tauriConfig.identifier}' versionCode='${androidProperties['tauri.android.versionCode']}' versionName='${tauriConfig.version}'`;
if (badging.status !== 0 || !packageLine.startsWith(expectedPackage)) {
  throw new Error(`Release APK metadata mismatch. Expected "${expectedPackage}"; received "${packageLine}".`);
}
console.log(`Verified release package metadata: ${packageLine}`);
const verification = run(apksigner, ['verify', '--verbose', '--print-certs', apk], { cwd: androidDir, capture: true });
const verificationOutput = `${verification.stdout ?? ''}${verification.stderr ?? ''}`;
const signerDn = verificationOutput.match(/^(?:Signer #1 certificate DN:|V2 Signer: certificate DN:)\s*(.+)$/im)?.[1];
const signerDigest = verificationOutput.match(/^(?:Signer #1 certificate SHA-256 digest:|V2 Signer: certificate SHA-256 digest:)\s*([a-f\d:]+)$/im)?.[1];
const signingPropertiesText = readFileSync(signingProps, 'utf8');
const storePassword = signingPropertiesText.match(/^storePassword=(.*)$/m)?.[1];
const keyAlias = signingPropertiesText.match(/^keyAlias=(.*)$/m)?.[1];
if (!storePassword || !keyAlias) throw new Error('Android signing properties are incomplete.');
const trustedCertificate = run('keytool', [
  '-exportcert', '-keystore', keystore, '-storepass', storePassword, '-alias', keyAlias,
], { cwd: androidDir, capture: true, encoding: null });
const trustedDigest = trustedCertificate.stdout && createHash('sha256').update(trustedCertificate.stdout).digest('hex');
const normalizedSignerDigest = signerDigest?.replaceAll(':', '').toLowerCase();
const normalizedTrustedDigest = trustedDigest?.toLowerCase();
const exactGymUpDn = signerDn?.replace(/\s+/g, '').toLowerCase() === 'cn=gymup,o=gymup,c=pt';
if (verification.status !== 0 || trustedCertificate.status !== 0 || !exactGymUpDn
    || !normalizedSignerDigest || normalizedSignerDigest !== normalizedTrustedDigest) {
  throw new Error('APK signature verification failed or the release certificate is not Gym Up.');
}
console.log('Verified APK signature against the configured Gym Up release key.');

const bytes = statSync(apk).size;
if (bytes > 25 * 1024 * 1024) throw new Error('The signed APK exceeds Cloudflare Workers static asset limit (25 MiB).');
const releaseArtifacts = join(tauriDir, 'target', 'release-artifacts');
mkdirSync(releaseArtifacts, { recursive: true });
const finalApk = join(releaseArtifacts, 'gym-up.apk');
copyFileSync(apk, finalApk);
console.log(`\nVerified signed release APK: ${finalApk} (${(bytes / (1024 * 1024)).toFixed(1)} MiB)`);
