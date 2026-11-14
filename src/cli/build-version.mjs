/** Version records for newly generated components target the pinned installed
 * build. Existing component version records remain authoritative and unchanged. */
import assert from 'node:assert/strict';
import { parseBuildInfo, getActiveBuild } from '@modkit/blizzard-casc';

export function componentVersionForBuild(buildInfo, requested) {
  const records = parseBuildInfo(buildInfo);
  assert.equal(records.filter((r) => r.active).length, 1, 'Exactly one active CASC build required');
  const active = getActiveBuild(records);
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/u.exec(active.version ?? '');
  assert(match, 'Active CASC build must provide a complete version tuple');
  const [major, minor, patch, build] = match.slice(1).map(Number);
  const version = { major, minor, patch, build };
  assert(
    Object.values(version).every(Number.isSafeInteger),
    'Version tuple exceeds integer bounds',
  );
  if (requested !== undefined)
    for (const [key, value] of Object.entries(version))
      assert.equal(
        requested?.[key],
        value,
        'Requested component version differs from installed build: ' + key,
      );
  return version;
}
