import assert from 'node:assert/strict';
import {
  matchTemplatePrefix,
  parseTemplateFragment,
} from '../src/conversion/native-expression-identity/balanced-script-template-alternate.mjs';
import { functionSyntaxIndex } from '../src/conversion/runtime-event-public-alias/g2t-actions.mjs';
import { proveCompletedLibraryReferences } from '../src/conversion/exact-function-signatures/completed-library-reference-proof.mjs';
import { Parser } from '../src/conversion/exact-function-signatures/index-alternate-3.js';
import { createVerifiedConversionProgram } from '../src/conversion/exact-function-signatures/verified-conversion-program.mjs';
import {
  capturePartitionStartupOwnership,
  readPartitionStartupOwnership,
} from '../src/model/partition-startup-ownership.mjs';

const statements = (source) => parseTemplateFragment(source, false);
const template = {
  nodes: statements('Begin(); Body(); End();'),
  holes: new Map([['Body', { kind: 'block', name: 'body' }]]),
};
const nodes = statements('Prior(); Begin(); Begin(); Step(); End(); End(); After();');
const match = matchTemplatePrefix(template, nodes, undefined, 1);
assert.equal(match.consumed, 5);
assert.deepEqual(match.bindings.blocks.get('body'), nodes.slice(2, 5));
assert.deepEqual(match, matchTemplatePrefix(template, nodes.slice(1)));
assert.equal(matchTemplatePrefix(template, nodes, undefined, 3), undefined);
assert.equal(matchTemplatePrefix(template, nodes, undefined, nodes.length), undefined);
// One synthetic node can appear under two different parents. Excluding just
// one path must leave the other use visible, even if parser parent links differ.
const [declaration, first] = statements('int local; Use(local);');
const second = { ...first };
const index = functionSyntaxIndex([declaration, first, second]);
const names = new Set(['local']);
assert.equal(index.declarations.get('local'), declaration);
assert.equal(index.mentionsOutside(names, new Set([declaration, first])), true);
assert.equal(index.mentionsOutside(names, new Set([declaration, first, second])), false);

const initializers = ['A', 'B']
  .map(
    (id) =>
      `bool done${id} = false; void lib${id}_InitLib() { if (done${id}) { return; } done${id} = true; }`,
  )
  .join('\n');
function completed(calls, extra = '') {
  const ast = new Parser().parseFile(
    'startup.galaxy',
    initializers + '\nvoid InitMap() { ' + calls + ' }\n' + extra,
  );
  assert.equal(ast.parseDiagnostics.length, 0);
  return proveCompletedLibraryReferences(ast, new Map([['B', ['A']]])).records.length;
}
const ordered = 'libA_InitLib(); libB_InitLib();';
assert.equal(completed(ordered), 1);
assert.equal(completed('libB_InitLib(); libA_InitLib();'), 0);
assert.equal(completed(ordered + ' libA_InitLib();'), 0);
assert.equal(completed(ordered, 'void Reset() { doneA = false; }'), 0);
assert.equal(completed(ordered, 'string hook = "prefix_libA_InitLib_suffix";'), 0);
const startupFiles = [
  {
    fileName: 'startup.galaxy',
    text: [
      'native trigger TriggerCreate(string callback);',
      'trigger gt_Sample;',
      'void Make() { gt_Sample = TriggerCreate("Callback"); }',
      'void Boot() { Make(); }',
      'void InitMap() { Boot(); }',
      'void Runtime() { Make(); }',
    ].join('\n'),
    owned: true,
  },
];
const program = createVerifiedConversionProgram(startupFiles);
const parent = createVerifiedConversionProgram(startupFiles, undefined, undefined, {
  partitionStartup: true,
});
try {
  assert.deepEqual(parent.report(), program.report());
  const ordinary = readPartitionStartupOwnership(
    capturePartitionStartupOwnership(program),
    program,
  );
  const ctor = program.documents
    .get('startup.galaxy')
    .statements.find((node) => node.name?.name === 'Make');
  const narrowed = readPartitionStartupOwnership(
    capturePartitionStartupOwnership(parent, { constructorsOnly: true }),
    program,
  );
  assert.deepEqual(narrowed.proof, ordinary.proof);
  assert.deepEqual(narrowed.functionOwnership(ctor), ordinary.functionOwnership(ctor));
  assert.deepEqual(
    ordinary
      .functionOwnership(ctor)
      .callers.map((call) => call.directStartupPath)
      .sort(),
    [false, true],
  );
} finally {
  parent.dispose();
  program.dispose();
}
// Two different UTF-16 strings may encode to the same UTF-8 bytes. An already
// attached document must still match the exact program input string.
const surrogateProgram = createVerifiedConversionProgram([
  { fileName: 'source.galaxy', text: '// \ud800\nvoid InitMap() {}', owned: true },
]);
try {
  const source = surrogateProgram.documents.get('source.galaxy');
  source.text = source.text.replace('\ud800', '\ud801');
  assert.throws(
    () => capturePartitionStartupOwnership(surrogateProgram),
    /Source text differs from semantic snapshot/,
  );
} finally {
  surrogateProgram.dispose();
}
console.log('Recovery matching, scoped identifiers and startup proofs passed.');
