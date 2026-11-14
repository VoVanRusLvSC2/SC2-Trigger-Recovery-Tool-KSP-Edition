import assert from 'node:assert/strict';
import { parseGalaxySource } from '../src/conversion/runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
import { attributeUseInGalaxy } from '../src/verification/attribute-use-evidence.mjs';

const source = `
native string GameAttributeGameValue(string name);
string label = "GameAttributePlayerValue()";
// GameAttributePlayersForTeam(1)
void Test() { GameAttributeGameValue("difficulty"); GameAttributePlayersForTeam(1); }
`;
const evidence = attributeUseInGalaxy(parseGalaxySource(source, 'test.galaxy'), 'test.galaxy');
assert.deepEqual(
  evidence.calls.map((item) => item.function),
  ['GameAttributeGameValue', 'GameAttributePlayersForTeam'],
);
assert.throws(() => attributeUseInGalaxy({ parseDiagnostics: [{}] }, 'bad'));
console.log(
  'Attribute use evidence: real calls detected; strings, comments and declarations ignored.',
);
