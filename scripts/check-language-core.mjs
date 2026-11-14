/** Verify that SDK families share one scanner without changing their grammar. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../src/sdk/', import.meta.url);
const families = [
  'core',
  'array-values',
  'literal-native',
  'lossless-colors',
  'production-preparation',
  'thread-analysis',
];
const moduleUrl = (family, file) => new URL(`${family}/modules/galaxy/language-core/${file}`, root);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const coreTypes = digest(await readFile(moduleUrl('core', 'types.js')));
const coreParser = digest(await readFile(moduleUrl('core', 'parser.js')));
const sharedScanner = await import(moduleUrl('core', 'scanner.js'));
const { SyntaxKind: K } = await import(moduleUrl('core', 'types.js'));

const valid = [
  'int Example(int count) { int total = 0; int i; for (i = 0; i < count; i += 1) { total += i; } while (total > 0) { total -= 1; } return total; }',
  'include "TriggerLibs/NativeLib"\r\nint[4] values;\r\nfixed fraction = 0.125;\r\nstring caption = "A\\n\\\"B";\r\nint hex = 0x1F;\r\n',
  'struct Record { int value; };\nint Read(Record value) { return value.value; }',
];
const invalid = ['int Broken( {', 'string caption = "unterminated'];

function projection(node, seen = new WeakMap(), location = '$') {
  if (typeof node === 'function') return String(node);
  if (!node || typeof node !== 'object') return node;
  if (seen.has(node)) return { reference: seen.get(node) };
  seen.set(node, location);
  if (Array.isArray(node))
    return node.map((value, index) => projection(value, seen, `${location}[${index}]`));
  if (node instanceof Map)
    return [...node].map(([key, value], index) => [
      projection(key, seen, `${location}.key${index}`),
      projection(value, seen, `${location}.value${index}`),
    ]);
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (['parent', 'fileName', 'symbol', 'locals'].includes(key)) continue;
    result[key] = projection(value, seen, `${location}.${key}`);
  }
  return result;
}

const { Parser: CoreParser } = await import(moduleUrl('core', 'parser.js'));
const expected = [...valid, ...invalid].map((source) =>
  projection(new CoreParser().parseFile('fixture.galaxy', source)),
);
if (process.argv.includes('--with-runtime')) {
  const { Parser: ArchiveParser } = await import(
    '@modkit/blizzard-starcraft2/galaxy/language-core'
  );
  for (const [index, source] of [...valid, ...invalid].entries()) {
    assert.deepEqual(
      projection(new ArchiveParser().parseFile('fixture.galaxy', source)),
      expected[index],
      'Retained archive parser differs from the shared implementation',
    );
  }
}
for (const family of families) {
  assert.equal(
    digest(await readFile(moduleUrl(family, 'types.js'))),
    coreTypes,
    `${family}: enum/type definitions diverged`,
  );
  assert.equal(
    digest(await readFile(moduleUrl(family, 'parser.js'))),
    coreParser,
    `${family}: grammar diverged`,
  );
  const scanner = await import(moduleUrl(family, 'scanner.js'));
  assert.equal(scanner.Scanner, sharedScanner.Scanner, `${family}: scanner identity differs`);
  assert.equal(scanner.stringToToken('while'), K.WhileKeyword);
  assert.equal(scanner.tokenToString(K.ForKeyword), 'for');
  const { Parser } = await import(moduleUrl(family, 'parser.js'));
  for (const [index, source] of [...valid, ...invalid].entries()) {
    const ast = new Parser().parseFile('fixture.galaxy', source);
    assert.deepEqual(
      projection(ast),
      expected[index],
      `${family}: source ranges, AST or diagnostics differ`,
    );
    if (index < valid.length)
      assert.equal(ast.parseDiagnostics.length, 0, `${family}: valid fixture rejected`);
    else assert(ast.parseDiagnostics.length > 0, `${family}: invalid fixture accepted`);
    assert.equal(ast.text, source, `${family}: original source changed`);
  }
}
console.log(
  `Verified shared scanner, grammar, source ranges and error diagnostics across ${families.length} SDK families.`,
);
console.log('This is language-core verification, not a converter or map-equivalence pass.');
