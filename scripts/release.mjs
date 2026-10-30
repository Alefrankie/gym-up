// Cut a semver release: bump from commits since the last v* tag, deploy API + web/APK, tag and push.
// Usage: pnpm release [major|minor|patch]   (omit to infer from Conventional Commits)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const isWin = process.platform === 'win32';
const tauriConfigPath = join(root, 'apps', 'app', 'src-tauri', 'tauri.conf.json');
const packageFiles = ['package.json', 'apps/app/package.json', 'apps/api/package.json'].map((file) => join(root, file));

function run(command, args, { cwd = root, capture = false } = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, shell: isWin && command === 'pnpm', encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return (result.stdout ?? '').trim();
}

if (run('git', ['status', '--porcelain'], { capture: true })) {
  console.error('Working tree is not clean. Commit or stash changes before releasing.');
  process.exit(1);
}

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
const current = tauriConfig.version;
const lastTag = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], { cwd: root, encoding: 'utf8' }).stdout.trim();
// Without a tag yet, count commits since the version field last changed.
const base = lastTag || run('git', ['log', '-1', '--format=%H', '-S', `"version": "${current}"`, '--', tauriConfigPath], { capture: true });
const log = run('git', ['log', '--format=%s%n%b%x00', `${base}..HEAD`], { capture: true });
const commits = log.split('\0').map((entry) => entry.trim()).filter(Boolean);
if (commits.length === 0) {
  console.error(`No commits since ${lastTag || current}; nothing to release.`);
  process.exit(1);
}

let bump = process.argv[2];
if (!bump) {
  if (commits.some((c) => /^\w+(\(.+\))?!:/.test(c) || /BREAKING CHANGE/.test(c))) bump = 'major';
  else if (commits.some((c) => /^feat(\(.+\))?:/.test(c))) bump = 'minor';
  else bump = 'patch';
}
if (!['major', 'minor', 'patch'].includes(bump)) {
  console.error(`Unknown bump "${bump}". Use major, minor or patch.`);
  process.exit(1);
}

const [major, minor, patch] = current.split('.').map(Number);
const next = bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
console.log(`Releasing ${current} -> ${next} (${bump}, ${commits.length} commits)`);

tauriConfig.version = next;
writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
for (const file of packageFiles) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = next;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

run('pnpm', ['--filter', '@gym-up/api', 'run', 'deploy']);
run('pnpm', ['--filter', '@gym-up/app', 'run', 'deploy:web']);

run('git', ['add', tauriConfigPath, ...packageFiles]);
run('git', ['commit', '-m', `chore(release): v${next}`]);
run('git', ['tag', '-a', `v${next}`, '-m', `v${next}`]);
run('git', ['push', '--follow-tags', 'origin', 'HEAD']);
console.log(`\nReleased v${next}.`);
