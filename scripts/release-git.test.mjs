import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestVersion, publishRelease } from './release-git.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('chooses the highest published stable version, including unmerged tags', () => {
  assert.equal(latestVersion('0.31.0', 'v0.9.0\nv0.32.0\nv0.31.0\nv1.0.0-beta'), '0.32.0');
  assert.equal(latestVersion('0.33.0', 'v0.32.0'), '0.33.0');
  assert.equal(latestVersion('0.9.0', 'v0.10.0'), '0.10.0');
});

test('integrates remote commits before tagging and publishes both refs atomically', () => {
  const calls = [];
  const env = { GH_TOKEN: 'test' };
  publishRelease((...args) => calls.push(args), '0.33.0', env);
  assert.deepEqual(calls, [
    ['git', ['fetch', 'origin', 'main'], { env }],
    ['git', ['rebase', 'origin/main'], { env }],
    ['git', ['tag', '-a', 'v0.33.0', '-m', 'v0.33.0']],
    ['git', ['push', '--atomic', 'origin', 'HEAD:refs/heads/main', 'refs/tags/v0.33.0'], { env }],
  ]);
});

test('a rebase conflict stops before creating or pushing a tag', () => {
  const calls = [];
  assert.throws(() => publishRelease((_command, args) => {
    calls.push(args[0]);
    if (args[0] === 'rebase') throw new Error('conflict');
  }, '0.33.0', {}), /conflict/);
  assert.deepEqual(calls, ['fetch', 'rebase']);
});

test('real Git preserves concurrent source changes and rejects a racing tag atomically', () => {
  const root = mkdtempSync(join(tmpdir(), 'gym-up-release-test-'));
  const remote = join(root, 'remote.git');
  const source = join(root, 'source');
  const release = join(root, 'release');
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Release test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Release test', GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (cwd, args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(root, ['init', '--bare', '--initial-branch=main', remote]);
    git(root, ['clone', remote, source]);
    writeFileSync(join(source, 'version.txt'), '1');
    git(source, ['add', '.']);
    git(source, ['commit', '-m', 'initial']);
    git(source, ['push', 'origin', 'main']);
    git(root, ['clone', remote, release]);
    writeFileSync(join(release, 'version.txt'), '2');
    git(release, ['commit', '-am', 'release']);
    writeFileSync(join(source, 'source.txt'), 'concurrent source change');
    git(source, ['add', '.']);
    git(source, ['commit', '-m', 'concurrent source']);
    git(source, ['push', 'origin', 'main']);
    publishRelease((_command, args) => git(release, args), '0.2.0', env);
    assert.equal(git(release, ['show', 'HEAD:source.txt']), 'concurrent source change');
    assert.equal(git(remote, ['rev-parse', 'main']), git(remote, ['rev-parse', 'v0.2.0^{}']));

    writeFileSync(join(release, 'version.txt'), '3');
    git(release, ['commit', '-am', 'next release']);
    assert.throws(() => publishRelease((_command, args) => {
      if (args[0] === 'push') {
        git(source, ['pull', '--rebase', 'origin', 'main']);
        writeFileSync(join(source, 'source.txt'), 'another source change');
        git(source, ['commit', '-am', 'race after fetch']);
        git(source, ['push', 'origin', 'main']);
      }
      return git(release, args);
    }, '0.3.0', env));
    assert.equal(git(remote, ['tag', '--list', 'v0.3.0']), '');
    assert.equal(git(remote, ['show', 'main:source.txt']), 'another source change');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
