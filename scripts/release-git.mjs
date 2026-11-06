// Keep version numbers monotonic even when an earlier deployment published a tag
// without its release commit. Never rewrite those published tags.
export function latestVersion(current, tags) {
  return tags.split(/\r?\n/).reduce((latest, tag) => {
    const match = /^v(\d+\.\d+\.\d+)$/.exec(tag);
    if (!match) return latest;
    const parts = match[1].split('.').map(Number);
    const previous = latest.split('.').map(Number);
    const difference = parts.map((part, i) => part - previous[i]).find((part) => part !== 0) ?? 0;
    return difference > 0 ? match[1] : latest;
  }, current);
}

export function publishRelease(run, version, env) {
  // A source commit can land while the APK builds. Replay only our generated
  // version commit on top of it; conflicts stop the release rather than overwrite work.
  run('git', ['fetch', 'origin', 'main'], { env });
  run('git', ['rebase', 'origin/main'], { env });
  run('git', ['tag', '-a', `v${version}`, '-m', `v${version}`]);
  // If main advances again, reject BOTH refs. A failed branch push must not
  // leave a published tag pointing at an unmerged release commit.
  run('git', ['push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/v${version}`], { env });
}
