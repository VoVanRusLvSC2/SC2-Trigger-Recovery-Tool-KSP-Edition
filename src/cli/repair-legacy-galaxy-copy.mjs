import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGalaxySource } from '../conversion/runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
import { updateMapCandidate } from './package-candidate.mjs';
import { openSc2Package } from './sc2-package.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const supported = [
  [
    'SC1Backend.galaxy',
    'b301b390d13b527534089540ccb42fef32d574f43b5719e375a231a35762da3d',
    normalizeBackend,
  ],
  [
    'SC1Compatibility.galaxy',
    'fe57cf7fb8ba105da1481552ca154949b50577c8695c31ed0679f5d9af47e9f3',
    normalizeCompatibility,
  ],
];

export async function hasRepairableLegacyGalaxy(reader) {
  for (const [name, expected] of supported) {
    const entry = reader.find(name);
    if (!entry || entry.size >= 1024 * 1024 || digest(await reader.read(entry.id)) !== expected)
      return false;
  }
  return true;
}

function rewrite(text, replacements) {
  for (const [from, to] of replacements) {
    const next = text.replace(from, to);
    assert.notEqual(next, text, 'Expected generated Galaxy pattern was absent');
    text = next;
  }
  return text;
}

function normalizeBackend(text) {
  return rewrite(text, [
    [
      'return converted_backend_unit_invincible[lv_sc1Index] ? 1 : 0;',
      'if (converted_backend_unit_invincible[lv_sc1Index]) { return 1; } return 0;',
    ],
    [
      'state = converted_backend_doodad_state[doodadId] == 5 ? 4 : 5;',
      'if (converted_backend_doodad_state[doodadId] == 5) { state = 4; } else { state = 5; }',
    ],
    [
      /Converted_BackendRecordEvent\("control", paused \? ("[^"]+") : ("[^"]+"), ([^;]+)\);/u,
      'if (paused) { Converted_BackendRecordEvent("control", $1, $3); } else { Converted_BackendRecordEvent("control", $2, $3); }',
    ],
    [
      /Converted_BackendRecordEvent\("shared-vision", enabled \? ("[^"]+") : ("[^"]+"), ([^;]+)\);/u,
      'if (enabled) { Converted_BackendRecordEvent("shared-vision", $1, $3); } else { Converted_BackendRecordEvent("shared-vision", $2, $3); }',
    ],
    ['int color, int editorType', 'int playerColor, int editorType'],
    [
      'converted_backend_player_color[playerIndex] = color;',
      'converted_backend_player_color[playerIndex] = playerColor;',
    ],
    ['unitgroup doorUnits;', 'unitgroup doorUnits; region doorRegion;'],
    [/region doorRegion = RegionEntireMap\(\);/gu, 'doorRegion = RegionEntireMap();'],
  ]);
}

function normalizeCompatibility(text) {
  return rewrite(text, [
    [/return (converted_scenario_[a-z_]+_present) \? 1 : 0;/gu, 'if ($1) { return 1; } return 0;'],
    [
      /Converted_ActionAdapter\(opcode == 30 \? "Converted_Act_MuteUnitSpeech" : "Converted_Act_UnmuteUnitSpeech", ([^;]+)\);/u,
      'if (opcode == 30) { Converted_ActionAdapter("Converted_Act_MuteUnitSpeech", $1); } else { Converted_ActionAdapter("Converted_Act_UnmuteUnitSpeech", $1); }',
    ],
  ]);
}

export async function repairLegacyGalaxyCopy(original, output, mpq) {
  const source = await fs.readFile(original);
  const archiveSha256 = digest(source);
  const reader = await openSc2Package(original);
  const edits = [];
  try {
    assert.equal(reader.archiveSha256, archiveSha256, 'Source archive changed during repair');
    assert(
      await hasRepairableLegacyGalaxy(reader),
      'This archive has no supported generated Galaxy repair',
    );
    for (const [name, before, normalize] of supported) {
      const entry = reader.find(name);
      const originalText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        await reader.read(entry.id),
      );
      const text = normalize(originalText);
      const errors = parseGalaxySource(text, name).parseDiagnostics;
      assert.equal(
        errors.length,
        0,
        'Repaired Galaxy is invalid: ' + name + ': ' + errors[0]?.messageText,
      );
      edits.push({ path: entry.path, before, bytes: Buffer.from(text) });
    }
  } finally {
    reader.dispose();
  }
  const directory = path.join(output, 'source');
  const components = path.join(directory, 'components');
  await fs.mkdir(components, { recursive: true });
  const manifest = [];
  for (const edit of edits) {
    await fs.writeFile(path.join(components, edit.path), edit.bytes, { flag: 'wx' });
    manifest.push({ path: edit.path, sha256: digest(edit.bytes), bytes: edit.bytes.length });
  }
  const archive = path.join(directory, path.basename(original));
  const verification = await updateMapCandidate(
    { archive: original, archiveSha256, mpq },
    archive,
    directory,
    manifest,
    { sourceBytes: source },
  );
  assert.equal(
    digest(await fs.readFile(original)),
    archiveSha256,
    'Original changed during repair',
  );
  const receipt = {
    kind: 'SC1_GENERATED_GALAXY_REPAIR',
    original,
    originalSha256: archiveSha256,
    archive,
    archiveSha256: verification.archiveSha256,
    changedComponents: manifest.map(({ path, sha256 }, index) => ({
      path,
      before: edits[index].before,
      after: sha256,
    })),
    originalUnchanged: true,
  };
  await fs.writeFile(
    path.join(output, 'SOURCE_REPAIR.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  return receipt;
}
