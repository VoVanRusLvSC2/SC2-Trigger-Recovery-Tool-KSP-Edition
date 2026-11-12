import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const moduleSpec = process.env.MODKIT_CONVERSION_MODULE;
if (!moduleSpec) throw new Error('MODKIT_CONVERSION_MODULE must name the ModKit conversion module');
const moduleUrl = moduleSpec.startsWith('file:')
  ? new URL(moduleSpec)
  : pathToFileURL(path.resolve(process.cwd(), moduleSpec));
const publicApi = await import(moduleUrl.href);
const internals = await import(new URL('./internal/galaxy-to-trigger.js', moduleUrl));
if (typeof publicApi.compareGalaxyPrograms !== 'function' || typeof internals.parseGalaxySource !== 'function') {
  throw new TypeError('ModKit module must expose compareGalaxyPrograms and parseGalaxySource');
}

function compare(expected, actual, options) {
  return publicApi.compareGalaxyPrograms(
    internals.parseGalaxySource(expected, 'oracle-expected.galaxy'),
    internals.parseGalaxySource(actual, 'oracle-actual.galaxy'),
    options,
  );
}

export function runOracleSelfTest() {
  const base = [
    'int Add(int left, int right) { return left + right; }',
    'void Run() { int result = Add(2, 3); }',
  ].join('\n');
  const mustReject = [
    { id: 'operator', source: base.replace('left + right', 'left - right') },
    { id: 'argument-order', source: base.replace('Add(2, 3)', 'Add(3, 2)') },
    { id: 'drop-function', source: 'void Run() { int result = Add(2, 3); }' },
    { id: 'syntax-error', source: `${base}\n@` },
    { id: 'drop-call', source: base.replace('int result = Add(2, 3);', 'int result = 0;') },
    { id: 'integer-to-fixed', source: base.replace('Add(2, 3)', 'Add(2.0, 3.0)') },
    { id: 'other-library-prefix',
      expected: 'void libA_gt_Run() { libA_gt_Target(); }',
      source: 'void libB_gt_Run() { libC_gt_Target(); }',
      options: { libraryId: 'A', implicitLibrary: true } },
  ];
  const mustAccept = [
    { id: 'formatting', source: base.replaceAll(' ', '  ').replaceAll('\n', '\n\n') },
    { id: 'empty-else', source: 'int Add(int left, int right) { if (left) { return left + right; } else {} return right; }\nvoid Run() {}',
      expected: 'int Add(int left, int right) { if (left) { return left + right; } return right; }\nvoid Run() {}' },
  ];
  const mutations = [
    ...mustReject.map(mutation => {
      const { id, source } = mutation;
      const result = compare(mutation.expected ?? base, source, mutation.options);
      return { id, expected: 'reject', actual: result.exact ? 'accepted' : 'rejected', passed: !result.exact,
        difference: result.exact ? undefined : result.functions.differenceSamples[0] };
    }),
    ...mustAccept.map(({ id, source, expected }) => {
      const result = compare(expected ?? base, source);
      return { id, expected: 'accept', actual: result.exact ? 'accepted' : 'rejected', passed: result.exact,
        difference: result.exact ? undefined : result.functions.differenceSamples[0] };
    }),
  ];
  return {
    schemaVersion: 1,
    oracle: 'ModKit compareGalaxyPrograms mutation self-test',
    trustworthyForExactPass: mutations.every(item => item.passed),
    passed: mutations.filter(item => item.passed).length,
    total: mutations.length,
    mutations,
    caveat: 'This tests the ModKit comparator itself; it is not an independent semantic proof.',
  };
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const result = runOracleSelfTest();
    console.log(JSON.stringify(result, null, 2));
    if (!result.trustworthyForExactPass) process.exitCode = 1;
    return;
  }
  if (process.argv[2] === 'compare' && process.argv[3] && process.argv[4]) {
    const [expectedPath, actualPath, ...flags] = process.argv.slice(3);
    const options = {};
    for (let index = 0; index < flags.length; index += 1) {
      if (flags[index] === '--implicit-library') options.implicitLibrary = true;
      else if (flags[index] === '--library-id' && flags[index + 1]) options.libraryId = flags[++index];
      else throw new TypeError(`unknown or incomplete option: ${flags[index]}`);
    }
    const [expected, actual] = await Promise.all([
      readFile(path.resolve(expectedPath), 'utf8'),
      readFile(path.resolve(actualPath), 'utf8'),
    ]);
    const comparison = compare(expected, actual, options);
    console.log(JSON.stringify({
      schemaVersion: 1,
      status: comparison.syntaxValid ? comparison.exact ? 'equivalent' : 'different' : 'invalid-syntax',
      comparison,
      caveat: 'Structural AST comparison is not a general proof of runtime equivalence.',
    }, null, 2));
    if (!comparison.syntaxValid || !comparison.exact) process.exitCode = 1;
    return;
  }
  console.error('Usage: node src/oracle.mjs --self-test | compare <expected.galaxy> <actual.galaxy> [--library-id ID] [--implicit-library]');
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
