import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assessCorrectness, rankConverters, runBenchmark } from '../src/benchmark.mjs';
import { censusPackageRoots } from '../src/census.mjs';
import { buildMapManifest } from '../src/package-manifest.mjs';
import { guiLibrarySignature } from '../src/gui-signature.mjs';
import { summarizeAstComparison } from '../src/ast-metrics.mjs';
import { buildReport, diffFunctionLines, enrichGalaxySyntax, renderReportHtml, topLevelComparisonItems } from '../src/report.mjs';
import { compareRuns, writeRunHistory } from '../src/compare-runs.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const javaAvailable = ['java', 'javac'].every(command => spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0);

test('summarizes AST similarity and component-level differences', () => {
  const metrics = summarizeAstComparison({
    syntaxValid: true,
    exact: false,
    functions: { expected: 2, actual: 2, exact: ['A'], missing: [], added: [], differing: ['B'], duplicateExpected: [], duplicateActual: [] },
    signatures: { expected: 2, actual: 3, exact: ['A', 'B'], missing: [], added: ['C'], differing: [], duplicateExpected: [], duplicateActual: [] },
    declarations: { expected: 1, actual: 1, exact: [], missing: ['int:x'], added: [], differing: [], duplicateExpected: [], duplicateActual: [] },
    includes: { expected: 1, actual: 1, exact: false },
    globalInitializers: { expected: 0, actual: 0, exact: true },
    calls: { missingCount: 2, addedCount: 1 },
    callees: { missingCount: 0, addedCount: 0 },
    triggerRegistrations: { missingCount: 1, addedCount: 0 },
  });
  assert.equal(metrics.similarityPercent, 54.5);
  assert.equal(metrics.namedNodeDifferences, 3);
  assert.equal(metrics.sequenceDifferences, 1);
  assert.equal(metrics.callDifferences, 4);
  assert.equal(metrics.astDifferences, 4);
});

test('uses the original package filename as the case display name', () => {
  const report = buildReport({
    results: [{
      caseId: 'real-map-001', converterId: 'modkit', attempt: 1,
      inputArtifacts: [{ role: 'package', path: 'C:/corpus/01-ChainOfAscension.SC2Map' }],
      status: 'completed', correctness: 'fail', diagnostics: [],
    }],
    performanceStats: { modkit: { cases: { 'real-map-001': {} } } },
  });
  assert.equal(report.caseResults[0].caseId, 'real-map-001');
  assert.equal(report.caseResults[0].displayName, '01-ChainOfAscension.SC2Map');
});

test('reports specific process errors and includes timeouts', () => {
  const attempt = (status, error) => ({
    caseId: 'map', converterId: 'modkit', status, error,
    correctness: 'fail', diagnostics: [], inputArtifacts: [], outputArtifacts: [],
  });
  const report = buildReport({
    results: [
      attempt('process-failed', 'at service.js:545\nTypeError: Trigger document 1 has no library'),
      attempt('timeout', ''),
      attempt('invalid-output', ''),
    ],
    performanceStats: { modkit: { cases: {} } },
  });
  assert.deepEqual(report.processErrorSummary.map(item => item.reason), [
    'Trigger document 1 has no library', 'Timed out', 'Invalid output',
  ]);
  assert.deepEqual(report.caseResults[0].failureReasons.map(item => item.reason), [
    'Trigger document 1 has no library', 'Timed out', 'Invalid output',
  ]);
});

test('aligns whole-function Galaxy lines and marks additions and removals', () => {
  const rows = diffFunctionLines('void F() {\n  return;\n}', 'void F() {\n  return true;\n}');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].originalChange, 'same');
  assert.equal(rows[1].originalChange, 'remove');
  assert.equal(rows[1].convertedChange, 'add');
  assert.equal(rows[1].originalText, '  return;');
  assert.equal(rows[1].convertedText, '  return true;');
  assert.equal(rows[2].convertedChange, 'same');
});

test('colors Galaxy diff tokens with ModKit scanner without changing diff marks', async t => {
  const scannerModule = path.resolve(projectRoot, '../modkit-extensions-blizzard/starcraft2/dist/modules/galaxy/language-core/index.js');
  try { await stat(scannerModule); } catch { t.skip('ModKit Galaxy scanner is unavailable'); return; }
  const fn = { expectedSource: 'int x = Foo(42); // note', actualSource: 'int x = Foo("42");' };
  const report = {
    manifestPath: path.join(projectRoot, 'benchmark.real-mixed-5.json'),
    caseResults: [{ attempts: [{ functionDiffs: { script: { functions: [fn] } } }] }],
  };
  await enrichGalaxySyntax(report);
  assert.deepEqual(fn.originalSyntax[0], [[0, 3, 'type'], [8, 11, 'function'], [12, 14, 'number'], [17, 24, 'comment']]);
  assert.deepEqual(fn.convertedSyntax[0], [[0, 3, 'type'], [8, 11, 'function'], [12, 16, 'string']]);
  const html = renderReportHtml(report);
  assert.match(html, /appendSyntaxCode\(code,text,marks,syntax\?\.\[number-1\]\)/u);
  assert.match(html, /\.code-line \.tok-string/u);
  const start = html.indexOf('function appendSyntaxCode('), end = html.indexOf('\ndocument.addEventListener', start);
  const appendSyntaxCode = new Function('el', 'document', `${html.slice(start, end)}; return appendSyntaxCode;`)(
    (_tag, text, className) => ({ textContent: text, className }),
    { createTextNode: text => ({ textContent: text }) },
  );
  const plain = { children: [], append(node) { this.children.push(node); } };
  appendSyntaxCode(plain, 'plain text', [], []);
  assert.equal(plain.children.map(node => node.textContent).join(''), 'plain text');
  const colored = { children: [], append(node) { this.children.push(node); } };
  appendSyntaxCode(colored, 'int x=(1);', [6], [[0, 3, 'type'], [7, 8, 'number']]);
  assert.equal(colored.children.map(node => node.textContent).join(''), 'int x=(1);');
  assert.deepEqual(colored.children.filter(node => node.className).map(node => node.className), ['tok-type', 'code-paren', 'tok-number']);
  assert.deepEqual(diffFunctionLines(fn.expectedSource, fn.actualSource).map(row => row.originalChange), ['remove']);
});

test('Galaxy diff ignores comments, blank lines, and spacing without erasing string contents', () => {
  const original = 'void F() {\n  // first\n  string s = "a // b"; /* note */\n\n  Foo ( 1 );\n}';
  const converted = 'void F(){\n  string s="a // b";\n  /* another\n     note */\n  Foo(1); // after\n}';
  const rows = diffFunctionLines(original, converted);
  assert.deepEqual(rows.map(row => row.originalLine), [1, 3, 5, 6]);
  assert.deepEqual(rows.map(row => row.convertedLine), [1, 2, 5, 6]);
  assert.ok(rows.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  assert.equal(diffFunctionLines('string s = "a b";', 'string s="ab";')[0].originalChange, 'remove');
});

test('Galaxy diff shows a comparison with true as a yellow form, not a change', () => {
  const aliases = { original: [['c', '$p0']], converted: [['lp_c', '$p0']] };
  const rows = diffFunctionLines('void f(bool c) {\n  if (c) {\n    Use(p, c);\n  }\n}',
    'void f(bool lp_c) {\n  if ((lp_c == true)) {\n    Use(p, (lp_c != false));\n  }\n}', aliases);
  assert.ok(rows.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  assert.ok(rows[1].convertedParenHighlights.length > 0);
  // A comparison with false negates the condition and stays a change; so does a call argument in parentheses.
  assert.equal(diffFunctionLines('void f() {\n  if (c) { }\n}', 'void f() {\n  if ((c == false)) { }\n}')[1].originalChange, 'remove');
  assert.equal(diffFunctionLines('void f() {\n  Foo(c);\n}', 'void f() {\n  Foo(c + 1);\n}')[1].originalChange, 'remove');
});

test('Galaxy diff shows inert block semicolons in yellow without hiding control-flow bodies', () => {
  const inert = diffFunctionLines('void f() {\n  ping();\n  ;\n}', 'void f() {\n  ping();\n}');
  assert.ok(inert.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  const mark = inert.find(row => row.originalText.trim() === ';');
  assert.deepEqual(mark.originalParenHighlights.map(index => mark.originalText[index]), [';']);
  const significant = diffFunctionLines('void f(bool x) {\n  if (x)\n    ;\n  ping();\n}',
    'void f(bool x) {\n  if (x)\n    ping();\n}');
  assert.ok(significant.some(row => row.originalChange === 'remove' || row.convertedChange === 'add'));
});

test('Galaxy diff ignores redundant value and unary-call parentheses but keeps meaningful grouping', () => {
  const same = (a, b) => diffFunctionLines(a, b).every(row => row.originalChange === 'same' && row.convertedChange === 'same');
  const route = diffFunctionLines('lv_routePath = ("BE-Path " + IntToString(lv_route));', 'lv_routePath = "BE-Path " + IntToString(lv_route);')[0];
  assert.equal(route.originalChange, 'same');
  assert.deepEqual(route.originalParenHighlights.map(index => route.originalText[index]), ['(', ')']);
  assert.deepEqual(route.convertedParenHighlights, []);
  const first = diffFunctionLines('lv_isFirst = !(libARRA_gf_IIF13(GetTask()));', 'lv_isFirst = !libARRA_gf_IIF13(GetTask());')[0];
  assert.equal(first.originalChange, 'same');
  assert.deepEqual(first.originalParenHighlights.map(index => first.originalText[index]), ['(', ')']);
  assert.deepEqual(first.convertedParenHighlights, []);
  const nested = diffFunctionLines('x = ((a + b));', 'x = (a + b);')[0];
  assert.equal(nested.originalParenHighlights.length, 2);
  assert.deepEqual(nested.convertedParenHighlights, []);
  assert.deepEqual(diffFunctionLines('x = (a + b);', 'x=(a+b);')[0].originalParenHighlights, []);
  assert.equal(same('return ((a + b));', 'return a + b;'), true);
  assert.equal(same('x = (a + b) * c;', 'x = a + b * c;'), false);
  assert.equal(same('x = !(a + b);', 'x = !a + b;'), false);
  assert.equal(same('string s = "!(Call())";', 'string s = "!Call()";'), false);
});

test('Galaxy diff ignores line wrapping without hiding code changes', () => {
  const compact = 'if(libARRA_gf_TaskActive(libARRA_gv_task) == false){return true;}';
  const expanded = 'if ((libARRA_gf_TaskActive(libARRA_gv_task) == false)) {\n    return true;\n}';
  const rows = diffFunctionLines(compact, expanded);
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  assert.deepEqual(rows.map(row => row.originalLine), [1, null, null]);
  assert.deepEqual(rows.map(row => row.convertedLine), [1, 2, 3]);
  assert.deepEqual(rows[0].convertedParenHighlights.map(index => rows[0].convertedText[index]), ['(', ')']);
  assert.deepEqual(diffFunctionLines('x = Alpha +\nBeta;', 'x=Alpha+Beta;').map(row => row.originalChange), ['same', 'same']);
  assert.equal(diffFunctionLines(compact, expanded.replace('return true;', 'return false;'))[0].originalChange, 'remove');
  const surrounded = diffFunctionLines(`x = before;\n${compact}\ny = before;`, `x = after;\n${expanded}\ny = after;`);
  assert.deepEqual(surrounded.map(row => row.originalChange), ['remove', 'same', 'same', 'same', 'remove']);
});

test('Galaxy diff treats paired local names and redundant comparison parentheses as formatting only', () => {
  const aliases = { original: [['lp_p', '$p0']], converted: [['p', '$p0']] };
  const rows = diffFunctionLines('if (((lp_p < 0) || (lp_p >= 16))) {', 'if (p < 0 || p >= 16) {', aliases);
  assert.equal(rows[0].originalChange, 'same');
  assert.deepEqual(rows[0].originalParenHighlights.map(index => rows[0].originalText[index]), ['(', '(', ')', '(', ')', ')']);
  assert.equal(rows[0].originalAliasHighlights.map(index => rows[0].originalText[index]).join(''), 'lp_plp_p');
  assert.equal(rows[0].convertedAliasHighlights.map(index => rows[0].convertedText[index]).join(''), 'pp');
  const wrapped = diffFunctionLines(
    'if ((gv_cai_playerAI[lp_p] == "aiF917F4D7")) {\n  return aiF917F4D7_getCustomData(lp_p);\n}',
    'if (gv_cai_playerAI[p] == "aiF917F4D7") { return aiF917F4D7_getCustomData(p); }', aliases,
  );
  assert.ok(wrapped.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  const locals = { original: [['auto2B48B269_val', '$v0']], converted: [['autoA0000B82_val', '$v0']] };
  const renamed = diffFunctionLines('int auto2B48B269_val;', 'int autoA0000B82_val;', locals)[0];
  assert.equal(renamed.originalChange, 'same');
  assert.equal(renamed.originalAliasHighlights.map(index => renamed.originalText[index]).join(''), 'auto2B48B269_val');
  assert.equal(renamed.convertedAliasHighlights.map(index => renamed.convertedText[index]).join(''), 'autoA0000B82_val');
  const swapped = { original: [['a', '$v0'], ['b', '$v1']], converted: [['x', '$v0'], ['y', '$v1']] };
  assert.equal(diffFunctionLines('a=b;', 'y=x;', swapped)[0].originalChange, 'remove');
  assert.equal(diffFunctionLines('x=(a+b)*c;', 'x=a+b*c;')[0].originalChange, 'remove');
});

test('Galaxy diff marks typed Color spelling and empty else as nonsemantic without masking arithmetic', () => {
  const color = diffFunctionLines('lv_color = Color(0,0,0);', 'lv_color = Color(0.00, 0.00, 0.00);');
  assert.equal(color[0].originalChange, 'same');
  assert.equal(color[0].convertedChange, 'same');
  assert.equal(color[0].convertedParenHighlights.map(index => color[0].convertedText[index]).join(''), '0.000.000.00');
  assert.equal(diffFunctionLines('x=0/2;', 'x=0.00/2;')[0].originalChange, 'remove');
  assert.equal(diffFunctionLines('string s="Color(0,0,0)";', 'string s="Color(0.00,0.00,0.00)";')[0].originalChange, 'remove');
  const comment = diffFunctionLines('// Color(0,0,0)\nGo();', '// Color(0.00,0.00,0.00)\nGo();');
  assert.equal(comment[0].originalChange, 'same');
  assert.deepEqual(comment[0].originalParenHighlights, []);
  const emptyElse = diffFunctionLines('if (ready) { Go();\n} else {\n}', 'if (ready) { Go();\n}');
  assert.ok(emptyElse.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  assert.ok(emptyElse.some(row => row.originalParenHighlights.length > 0));
  assert.equal(diffFunctionLines('if (ready) { Go();\n} else { Stop(); }', 'if (ready) { Go();\n}')[1].originalChange, 'remove');
});

test('Galaxy diff aligns wrapped break with renamed auto local inside larger functions', () => {
  const aliases = { original: [['auto2F5A3431_var', '$v11']], converted: [['autoA00053A7_var', '$v11']] };
  const original = 'for (;;) {\n  if (auto2F5A3431_var == null) { break; }\n  UnitFlashSelection(auto2F5A3431_var);\n}';
  const converted = 'for (;;) {\n  if (autoA00053A7_var == null) {\n    break;\n  }\n  UnitFlashSelection(autoA00053A7_var);\n}';
  const rows = diffFunctionLines(original, converted, aliases);
  assert.ok(rows.every(row => row.originalChange === 'same' && row.convertedChange === 'same'));
  const renamed = rows.find(row => row.originalText.includes('if (auto2F5A3431_var'));
  assert.equal(renamed.originalAliasHighlights.map(index => renamed.originalText[index]).join(''), 'auto2F5A3431_var');
  assert.equal(renamed.convertedAliasHighlights.map(index => renamed.convertedText[index]).join(''), 'autoA00053A7_var');
});

test('top-level include and prototype differences remain inspectable when functions match', () => {
  const original = 'include "TriggerLibs/NativeLib"\ninclude "TriggerLibs/SwarmLib"\n';
  const converted = 'include "TriggerLibs/natives"\ninclude "TriggerLibs/NativeLib"\nvoid NewPrototype();\n';
  const prototypeStart = converted.indexOf('void NewPrototype');
  const parsed = { includes: { exact: false }, signatures: { added: ['NewPrototype'] }, declarations: {} };
  const sections = topLevelComparisonItems(parsed, { statements: [] }, {
    statements: [{ parameters: [], name: { name: 'NewPrototype' }, pos: prototypeStart, end: converted.length }],
  }, original, converted);
  assert.deepEqual(sections.map(section => section.name), ['Includes', 'Function signatures']);
  assert.match(sections[0].expectedSource, /SwarmLib/u);
  assert.match(sections[0].actualSource, /natives/u);
  assert.equal(sections[1].actualSource, 'void NewPrototype();');
});

test('compares a Java converter with another command on identical inputs', { skip: !javaAvailable }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-java-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  execFileSync('javac', ['-d', directory, path.join(projectRoot, 'fixtures', 'JavaCandidateFixture.java')], { windowsHide: true });
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [
      {
        id: 'java-candidate',
        command: 'java',
        args: ['-cp', directory, 'JavaCandidateFixture', '{request}'],
      },
      {
        id: 'node-candidate',
        command: process.execPath,
        args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
      },
    ],
    cases: [{ id: 'map', documentKind: 'map', inputs: [{ role: 'script', path: source }] }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results.length, 2);
  const byConverter = Object.fromEntries(summary.results.map(result => [result.converterId, result]));
  assert.equal(byConverter['java-candidate'].status, 'completed');
  assert.equal(byConverter['node-candidate'].status, 'completed');
  assert.equal(byConverter['java-candidate'].correctness, 'inconclusive');
  assert.equal(byConverter['java-candidate'].inputArtifacts[0].sha256, byConverter['node-candidate'].inputArtifacts[0].sha256);
  assert.equal(await readFile(byConverter['java-candidate'].outputArtifacts[0].path, 'utf8'), '<TriggerData/>\n');
});

test('censuses extracted packages and checks whether TriggerData contains elements', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'galaxy-census-'));
  const packageRoot = path.join(root, 'Example.SC2Map');
  const localeRoot = path.join(packageRoot, 'enUS.SC2Data', 'LocalizedData');
  await mkdir(localeRoot, { recursive: true });
  await writeFile(path.join(packageRoot, 'MapScript.galaxy'), 'void InitMap() {}\n');
  await writeFile(path.join(packageRoot, 'Triggers'), '<TriggerData><Element Type="Trigger" Id="first"/></TriggerData>');
  await writeFile(path.join(localeRoot, 'TriggerStrings.txt'), 'test strings');
  await writeFile(path.join(localeRoot, 'GameStrings.txt'), 'game strings');
  const result = await censusPackageRoots([root]);
  assert.equal(result.totals.packages, 1);
  assert.equal(result.totals.roundtripBaselinePackages, 1);
  assert.equal(result.packages[0].mapScripts[0], 'MapScript.galaxy');
  assert.equal(result.packages[0].triggerDataFiles[0], 'Triggers');
  assert.equal(result.packages[0].triggerStringsFiles[0], 'enUS.SC2Data/LocalizedData/TriggerStrings.txt');
  assert.equal(result.packages[0].gameStringsFiles[0], 'enUS.SC2Data/LocalizedData/GameStrings.txt');
  assert.equal(result.packages[0].bytes, Buffer.byteLength('void InitMap() {}\n<TriggerData><Element Type="Trigger" Id="first"/></TriggerData>test stringsgame strings'));
});

test('does not treat an empty Triggers document as an original trigger baseline', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'galaxy-empty-triggers-'));
  const packageRoot = path.join(root, 'Empty.SC2Map');
  await mkdir(packageRoot);
  await writeFile(path.join(packageRoot, 'MapScript.galaxy'), 'void InitMap() {}\n');
  await writeFile(path.join(packageRoot, 'Triggers'), '<TriggerData><Library Id="Map"/></TriggerData>');
  const census = await censusPackageRoots([root]);
  assert.deepEqual(census.packages[0].triggerDataFiles, []);
  assert.deepEqual(census.packages[0].emptyTriggerDataFiles, ['Triggers']);
  assert.equal(census.totals.roundtripBaselinePackages, 0);
  const manifest = buildMapManifest(census, { count: 1, baseDirectory: process.cwd(), manifestDirectory: root });
  assert.equal(manifest.cases[0].tags.includes('gui-baseline'), false);
  assert.equal(manifest.cases[0].inputs.some(input => input.role === 'original-trigger-data' || input.role === 'expected-trigger-data'), false);
});

test('builds a deterministic size-stratified package manifest with an enforced unique-package gate', () => {
  const census = { packages: Array.from({ length: 5 }, (_, index) => ({
    id: `Map${index}.SC2Map`,
    kind: 'map',
    packagePath: `maps/Map${index}.SC2Map`,
    bytes: 100,
    galaxyFiles: ['MapScript.galaxy'],
    galaxyFileBytes: { 'MapScript.galaxy': (index + 1) * 100 },
    mapScripts: ['MapScript.galaxy'],
    triggerDataFiles: index === 2 ? ['Triggers'] : [],
    triggerStringsFiles: [],
    gameStringsFiles: index === 2 ? ['enUS.SC2Data/LocalizedData/GameStrings.txt'] : [],
  })) };
  const manifest = buildMapManifest(census, { count: 3, baseDirectory: '/data', manifestDirectory: '/bench' });
  assert.equal(manifest.repetitions, 1);
  assert.equal(manifest.cases.length, 3);
  assert.deepEqual(manifest.cases.map(item => item.inputs[0].path), ['../data/maps/Map0.SC2Map', '../data/maps/Map2.SC2Map', '../data/maps/Map4.SC2Map']);
  assert.equal(manifest.cases[1].inputs.some(item => item.role === 'expected-trigger-data'), true);
  assert.equal(manifest.cases[1].inputs.some(item => item.role === 'original-trigger-data'), true);
  assert.deepEqual(manifest.cases[1].inputs.filter(item => item.role === 'game-strings').map(item => item.path),
    ['enUS.SC2Data/LocalizedData/GameStrings.txt']);
  assert.equal(manifest.coverageRequirements.minTags['has-game-strings'], 1);
  assert.equal(manifest.coverageRequirements.minUniquePackages, 3);
  assert.deepEqual(Array.from({ length: 5 }, (_, tier) => manifest.coverageRequirements.minTags[`script-size-tier-${tier + 1}`]), [1, 1, 0, 1, 0]);
  assert.equal(manifest.coverageRequirements.minTags['gui-baseline'], 1);
  const dependencyConfig = {
    id: 'ntve', packagePath: 'deps/Ntve.SC2Mod',
    triggerDataPath: 'Triggers', triggerStringsPath: 'TriggerStrings.txt', gameStringsPath: 'GameStrings.txt',
  };
  const withDependency = buildMapManifest(census, {
    count: 3,
    baseDirectory: '/data',
    manifestDirectory: '/bench',
    dependencies: [
      { id: 'native-lib', group: 'NativeLib', packagePath: 'deps/NativeLib.SC2Mod', triggerDataPath: 'Triggers' },
      dependencyConfig,
    ],
  });
  assert.deepEqual(withDependency.cases[0].inputs.filter(input => input.role.startsWith('dependency-')).map(input => input.role), [
    'dependency-trigger-data', 'dependency-trigger-data', 'dependency-trigger-strings', 'dependency-game-strings',
  ]);
  assert.equal(withDependency.cases[0].inputs.find(input => input.id === 'ntve').path, '../data/deps/Ntve.SC2Mod');
  assert.equal(withDependency.coverageRequirements.minUniquePackages, 5);
  assert.deepEqual(withDependency.cases[0].inputs.filter(input => input.role === 'dependency-trigger-data').map(input => input.group), ['NativeLib', 'ntve']);
  assert.equal(Object.hasOwn(dependencyConfig, 'group'), false, 'manifest generation must not mutate dependency config');
  assert.throws(() => buildMapManifest(census, { count: 6 }), /has 5 usable map scripts/);
});

test('builds a mixed map/mod corpus without scoring whole-mod GUI data against one library', () => {
  const maps = Array.from({ length: 3 }, (_, index) => ({
    id: `Map${index}.SC2Map`, kind: 'map', packagePath: `maps/Map${index}.SC2Map`,
    galaxyFiles: ['MapScript.galaxy', 'MapScript_h.galaxy'],
    galaxyFileBytes: { 'MapScript.galaxy': (index + 1) * 100 },
    mapScripts: ['MapScript.galaxy'], triggerDataFiles: ['Triggers'], triggerStringsFiles: [],
  }));
  const mods = Array.from({ length: 2 }, (_, index) => ({
    id: `Mod${index}.SC2Mod`, kind: 'mod', packagePath: `mods/Mod${index}.SC2Mod`,
    galaxyFiles: index === 0
      ? ['Base.SC2Data/LibABC.galaxy', 'Base.SC2Data/LibABC_h.galaxy']
      : ['Base.SC2Data/LibABC.galaxy', 'Base.SC2Data/LibABC_h.galaxy', 'Base.SC2Data/LibDEF.galaxy', 'Base.SC2Data/LibDEF_h.galaxy'],
    galaxyFileBytes: index === 0
      ? { 'Base.SC2Data/LibABC.galaxy': 250 }
      : { 'Base.SC2Data/LibABC.galaxy': 350, 'Base.SC2Data/LibDEF.galaxy': 500 },
    mapScripts: [], triggerDataFiles: ['Triggers'], triggerStringsFiles: ['enUS.SC2Data/LocalizedData/TriggerStrings.txt'],
  }));
  const mixed = buildMapManifest({ packages: [...maps, ...mods] }, {
    count: 5, modCount: 2, baseDirectory: '/data', manifestDirectory: '/bench',
  });
  assert.equal(mixed.name, 'real-mixed-5');
  assert.equal(mixed.cases.length, 5);
  assert.equal(mixed.coverageRequirements.minDocumentKinds.map, 3);
  assert.equal(mixed.coverageRequirements.minDocumentKinds.mod, 2);
  assert.equal(mixed.coverageRequirements.minUniquePackages, 5);
  assert.equal(mixed.cases.filter(item => item.documentKind === 'mod').length, 2);
  assert.deepEqual(mixed.cases.filter(item => item.documentKind === 'mod').map(item => item.options.libraryId).sort(), ['ABC', 'DEF']);
  for (const item of mixed.cases.filter(item => item.documentKind === 'mod')) {
    const packageInput = item.inputs.find(input => input.role === 'package');
    assert.equal(packageInput.id, 'mod-package');
    assert.ok(item.inputs.filter(input => input.fromPackage).every(input => input.fromPackage === packageInput.id));
  }
  assert.equal(mixed.cases.find(item => item.id.includes('mod') && item.options.libraryId === 'ABC')
    .inputs.some(input => input.role === 'expected-trigger-data'), true);
  assert.equal(mixed.cases.find(item => item.id.includes('mod') && item.options.libraryId === 'DEF')
    .inputs.some(input => input.role === 'expected-trigger-data'), false);
  assert.equal(mixed.cases.filter(item => item.documentKind === 'mod').every(item =>
    item.inputs.some(input => input.role === 'original-trigger-data')), true);
  assert.deepEqual(Array.from({ length: 5 }, (_, tier) => mixed.coverageRequirements.minTags[`script-size-tier-${tier + 1}`]), [1, 1, 1, 1, 1]);
  assert.equal(mixed.cases.filter(item => item.tags.includes('multi-library-package')).length, 1);
  assert.equal(mixed.coverageRequirements.minTags['multi-library-package'], 1);
  assert.equal(mixed.cases.filter(item => item.tags.includes('has-galaxy-header')).length, 5);
});

test('selects the largest map and mod scripts for a complex corpus without reusing spread case IDs', () => {
  const maps = Array.from({ length: 5 }, (_, index) => ({
    kind: 'map', packagePath: `maps/Map${index}.SC2Map`, galaxyFiles: ['MapScript.galaxy'],
    galaxyFileBytes: { 'MapScript.galaxy': (index + 1) * 100 }, mapScripts: ['MapScript.galaxy'],
    triggerDataFiles: [], triggerStringsFiles: [],
  }));
  const mods = Array.from({ length: 3 }, (_, index) => ({
    kind: 'mod', packagePath: `mods/Mod${index}.SC2Mod`, galaxyFiles: ['Base.SC2Data/LibABC.galaxy'],
    galaxyFileBytes: { 'Base.SC2Data/LibABC.galaxy': (index + 1) * 100 }, mapScripts: [],
    triggerDataFiles: ['Triggers'], triggerStringsFiles: [],
  }));
  const manifest = buildMapManifest({ packages: [...maps, ...mods] }, {
    count: 4, modCount: 1, selection: 'complex', baseDirectory: '/data', manifestDirectory: '/bench',
  });
  assert.equal(manifest.name, 'real-mixed-4-complex');
  assert.deepEqual(manifest.cases.map(item => item.inputs[0].path), [
    '../data/maps/Map2.SC2Map', '../data/mods/Mod2.SC2Mod', '../data/maps/Map3.SC2Map', '../data/maps/Map4.SC2Map',
  ]);
  assert.ok(manifest.cases.every(item => item.id.startsWith('complex-')));
  assert.equal(manifest.coverageRequirements.minUniquePackages, 4);
});

test('runs a converter, hashes artifacts, and writes resumable records', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    name: 'test',
    repetitions: 2,
    timeoutMs: 5000,
    converters: [{
      id: 'mock',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [{
      id: 'map',
      documentKind: 'map',
      tags: ['fixture', 'galaxy-to-triggers', '__proto__'],
      inputs: [{ role: 'script', path: source }],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results.length, 2);
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.results[0].inputArtifacts.length, 1);
  assert.equal(summary.results[0].outputArtifacts.length, 2);
  assert.equal(typeof summary.results[0].peakWorkingSetBytes, 'number');
  assert.match(summary.results[0].outputArtifacts[0].sha256, /^[a-f0-9]{64}$/);

  const persisted = JSON.parse(await readFile(path.join(summary.runDirectory, 'summary.json'), 'utf8'));
  assert.equal(persisted.counts.mock.completed, 2);
  assert.equal(persisted.qualityCounts.mock['not-reported'], 2);
  assert.equal(persisted.correctnessCounts.mock.inconclusive, 2);
  assert.equal(persisted.caseCoverage.caseCount, 1);
  assert.equal(persisted.coverageRequirements, null);
  assert.equal(persisted.caseCoverage.tags.fixture, 1);
  assert.equal(persisted.caseCoverage.tags['galaxy-to-triggers'], 1);
  assert.equal(Object.hasOwn(persisted.caseCoverage.tags, '__proto__'), true);
  assert.equal(persisted.caseCoverage.tags.__proto__, 1);
  assert.equal(persisted.performanceStats.mock.cases.map.wallTimeMs.sampleCount, 2);
  assert.equal(typeof persisted.performanceStats.mock.wallTimeMs.median, 'number');
  assert.equal(persisted.performanceStats.mock.allAttempts.wallTimeMs.sampleCount, 2);
  const report = JSON.parse(await readFile(path.join(summary.runDirectory, 'report.json'), 'utf8'));
  assert.equal(report.reportSchemaVersion, 2);
  assert.equal(report.caseResults.length, 1);
  assert.equal(report.caseResults[0].documentKind, 'map');
  assert.equal(report.caseResults[0].attempts.length, 2);
  assert.equal(report.caseResults[0].outputMetrics.galaxyInputLines, 1);
  assert.equal(report.caseResults[0].outputMetrics.triggerDataLines, 1);
  const html = await readFile(path.join(summary.runDirectory, 'report.html'), 'utf8');
  assert.match(html, /report\.json/u);
  assert.match(html, /Results by map \/ mod/u);
  assert.match(html, /Lines G \/ T/u);
  assert.match(html, /input Galaxy/u);
  assert.match(html, /Triggers → Galaxy/u);
  assert.match(html, /Original AST/u);
  assert.match(html, /Process errors/u);
  assert.match(html, /Roundtrip AST/u);
  assert.match(html, /id="diff-dialog"/u);
  assert.match(html, /id="details-dialog"/u);
  assert.match(html, /detailsButton\.addEventListener\('click',\(\)=>showDetails\(c\)\)/u);
  assert.doesNotMatch(html, /cases-table tbody\{display:grid/u);
  assert.match(html, /'Compare','link-button diff-button'/u);
  assert.match(html, /Roundtrip Galaxy/u);
  assert.match(html, /Editor Galaxy/u);
  assert.match(html, /code-added/u);
  assert.match(html, /code-removed/u);
  assert.doesNotMatch(html, /Type \/ operation/u);
  assert.doesNotMatch(html, /<th>Tags<\/th>/u);
  const events = (await readFile(path.join(summary.runDirectory, 'events.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(events.length, 4);
});

test('resumes an interrupted run without repeating completed attempts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-resume-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1, name: 'resume', repetitions: 2, timeoutMs: 5000,
    converters: [{ id: 'mock', command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'] }],
    cases: [{ id: 'map', documentKind: 'map', inputs: [{ role: 'script', path: source }] }],
  }));
  const first = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const journal = path.join(first.runDirectory, 'events.jsonl');
  const events = (await readFile(journal, 'utf8')).trim().split('\n');
  await writeFile(journal, `${events.slice(0, 3).join('\n')}\n`);
  const resumed = await runBenchmark(manifestPath, path.join(directory, 'runs'), { resumeDirectory: first.runDirectory });
  assert.equal(resumed.results.length, 2);
  assert.equal(resumed.results[0].wallTimeMs, first.results[0].wallTimeMs);
  assert.equal((await readFile(journal, 'utf8')).trim().split('\n').length, 5);
  const cases = await readdir(path.join(first.runDirectory, 'cases', 'map', 'mock'));
  assert.ok(cases.some(name => name.startsWith('attempt-02-interrupted-')));
});

test('validate-only checks package-linked files and coverage without launching converters or creating a run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-preflight-'));
  const packageDirectory = path.join(directory, 'fixture.SC2Map');
  const outputRoot = path.join(directory, 'runs');
  const manifestPath = path.join(directory, 'benchmark.json');
  await mkdir(packageDirectory);
  await writeFile(path.join(packageDirectory, 'MapScript.galaxy'), 'void InitMap () {}\n');
  const manifest = {
    schemaVersion: 1,
    name: 'preflight-only',
    coverageRequirements: { minCases: 1, minUniquePackages: 1, minDocumentKinds: { map: 1 } },
    converters: [{ id: 'must-not-launch', command: path.join(directory, 'missing-converter.exe') }],
    cases: [{
      id: 'map',
      documentKind: 'map',
      operation: 'galaxy-triggers-roundtrip',
      inputs: [
        { role: 'package', id: 'map-package', path: 'fixture.SC2Map' },
        { role: 'script', fromPackage: 'map-package', path: 'MapScript.galaxy' },
      ],
    }],
  };
  await writeFile(manifestPath, JSON.stringify(manifest));

  const summary = await runBenchmark(manifestPath, outputRoot, { validateOnly: true });
  assert.equal(summary.valid, true);
  assert.equal(summary.caseCount, 1);
  assert.equal(summary.caseCoverage.uniquePackageCount, 1);
  assert.equal(summary.packageInputsChecked, 1);
  assert.equal(summary.fileInputsChecked, 1);
  await assert.rejects(stat(outputRoot));

  manifest.cases[0].inputs[1].path = 'missing.galaxy';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(runBenchmark(manifestPath, outputRoot, { validateOnly: true }), /ENOENT/u);
  await assert.rejects(stat(outputRoot));
});

test('ranks correctness before speed and memory', () => {
  const performance = Object.fromEntries(['accurate', 'fast-but-wrong'].map(id => [id, {
    wallTimeMs: { median: id === 'accurate' ? 500 : 1 },
    peakWorkingSetBytes: { median: id === 'accurate' ? 1000 : 1 },
  }]));
  const ranking = rankConverters([
    { converterId: 'accurate', correctness: 'pass' },
    { converterId: 'fast-but-wrong', correctness: 'fail' },
  ], [{ id: 'fast-but-wrong' }, { id: 'accurate' }], performance);

  assert.deepEqual(ranking.map(({ rank, converterId }) => ({ rank, converterId })), [
    { rank: 1, converterId: 'accurate' },
    { rank: 2, converterId: 'fast-but-wrong' },
  ]);
  assert.equal(ranking[0].rates.fail, 0);
  assert.equal(ranking[1].rates.fail, 1);
});

test('incomplete Galaxy validation cannot produce a pass even with only warnings', () => {
  assert.equal(assessCorrectness({
    status: 'completed',
    operation: 'triggers-to-galaxy',
    diagnostics: [{ severity: 'warning', code: 'unresolved-symbol' }],
    conversionQuality: { completeness: 'complete', galaxyValidation: 'incomplete', dropped: 0, unsupported: 0 },
    structuralComparison: { script: { status: 'equivalent' } },
  }), 'inconclusive');
  assert.equal(assessCorrectness({
    status: 'completed',
    operation: 'triggers-to-galaxy',
    diagnostics: [],
    conversionQuality: { completeness: 'complete', galaxyValidation: 'failed', dropped: 0, unsupported: 0 },
    structuralComparison: { script: { status: 'equivalent' } },
  }), 'fail');
});

test('exact forward Galaxy is a warning when only nonexecuting TriggerData fields are unsupported', () => {
  assert.equal(assessCorrectness({
    status: 'completed',
    operation: 'triggers-to-galaxy',
    diagnostics: [{ severity: 'warning', code: 'semantic-reader-remainder' }],
    conversionQuality: { completeness: 'partial', galaxyValidation: 'passed', dropped: 0, unsupported: 28 },
    structuralComparison: { script: { status: 'equivalent' }, header: { status: 'equivalent' } },
  }), 'warning');
  assert.equal(assessCorrectness({
    status: 'completed',
    operation: 'triggers-to-galaxy',
    diagnostics: [],
    conversionQuality: { completeness: 'partial', galaxyValidation: 'passed', dropped: 0, unsupported: 28 },
    structuralComparison: { script: { status: 'different' } },
  }), 'fail');
});

test('GUI signatures ignore generated IDs but detect changed trigger semantics', () => {
  const makeLibrary = (triggerId, paramId, value, categorized = false) => ({
    id: 'TEST',
    rootRefs: [categorized
      ? { type: 'Category', library: 'TEST', id: 'CAT' }
      : { type: 'Trigger', library: 'TEST', id: triggerId }],
    elements: {
      [triggerId]: {
        type: 'Trigger', id: triggerId, library: 'TEST', name: 'Start',
        events: [], conditions: [], actions: [{ type: 'Param', library: 'TEST', id: paramId }],
      },
      [paramId]: { type: 'Param', id: paramId, library: 'TEST', value, valueType: { type: 'int' } },
      ...(categorized ? {
        'Category:CAT': {
          type: 'Category', id: 'CAT', library: 'TEST',
          items: [{ type: 'Trigger', library: 'TEST', id: triggerId }],
        },
      } : {}),
    },
  });

  const expected = guiLibrarySignature(makeLibrary('00000001', '00000002', '7'));
  assert.equal(guiLibrarySignature(makeLibrary('A1', 'B2', '7')), expected);
  assert.equal(guiLibrarySignature(makeLibrary('A1', 'B2', '7', true)), expected);
  assert.notEqual(guiLibrarySignature(makeLibrary('A1', 'B2', '8')), expected);
});

test('GUI signatures include orphan semantics and use items when rootRefs is absent', () => {
  const makeLibrary = (value, rootRefs) => ({
    id: 'TEST',
    ...(rootRefs === undefined ? {} : { rootRefs }),
    items: [{ type: 'Trigger', id: 'trigger', library: 'TEST' }],
    elements: {
      'Trigger:trigger': {
        type: 'Trigger', id: 'trigger', library: 'TEST', name: 'Start',
        events: [], conditions: [], actions: [],
      },
      'FunctionDef:orphan': { type: 'FunctionDef', id: 'orphan', library: 'TEST', name: value },
    },
  });

  assert.notEqual(guiLibrarySignature(makeLibrary('A')), guiLibrarySignature(makeLibrary('B')));
  assert.notEqual(
    guiLibrarySignature(makeLibrary('A')),
    guiLibrarySignature(makeLibrary('A', [])),
  );
});

test('GUI signatures do not resolve external references to same-ID local elements', () => {
  const makeLibrary = externalLibrary => ({
    id: 'TEST',
    rootRefs: [{ type: 'Trigger', id: 'trigger', library: 'TEST' }],
    elements: {
      'Trigger:trigger': {
        type: 'Trigger', id: 'trigger', library: 'TEST', name: 'Start',
        events: [], conditions: [], actions: [{
          type: 'FunctionDef', id: 'same-id', library: externalLibrary,
        }],
      },
      'FunctionDef:same-id': {
        type: 'FunctionDef', id: 'same-id', library: 'TEST', name: 'Local',
      },
    },
  });

  assert.notEqual(guiLibrarySignature(makeLibrary('LibraryA')), guiLibrarySignature(makeLibrary('LibraryB')));
});

test('compares converters on identical inputs and alternates their run order', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-pair-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  const command = process.execPath;
  const adapter = path.join(projectRoot, 'fixtures', 'mock-converter.mjs');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    repetitions: 2,
    converters: ['current', 'java-candidate'].map(id => ({
      id,
      command,
      args: [adapter, '{request}'],
    })),
    cases: [{ id: 'same-input', inputs: [{ role: 'script', path: source }] }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.deepEqual(summary.results.map(result => `${result.converterId}:${result.attempt}`), [
    'current:1', 'java-candidate:1', 'java-candidate:2', 'current:2',
  ]);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[0].sha256)).size, 1);
  assert.equal(summary.results.length, 4);
});

test('stages an isolated copy of each package input per converter attempt', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-package-'));
  const packageDirectory = path.join(directory, 'fixture.SC2Map');
  const packageFile = path.join(directory, 'fixture.SC2Mod');
  const source = path.join(packageDirectory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await mkdir(packageDirectory);
  await writeFile(source, 'original map script\n');
  await writeFile(packageFile, 'opaque package bytes');
  const adapter = path.join(projectRoot, 'fixtures', 'mock-converter.mjs');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: ['current', 'java-candidate'].map(id => ({
      id,
      command: process.execPath,
      args: [adapter, '{request}'],
    })),
    cases: [{
      id: 'package-mutation',
      operation: 'triggers-to-galaxy',
      inputs: [
        { role: 'package', id: 'map', path: 'fixture.SC2Map' },
        { role: 'script', fromPackage: 'map', path: 'MapScript.galaxy' },
        { role: 'package', path: 'fixture.SC2Mod' },
      ],
      options: { mode: 'mutate-package' },
    }],
    coverageRequirements: { minUniquePackages: 2 },
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(await readFile(source, 'utf8'), 'original map script\n');
  assert.equal(summary.caseCoverage.uniquePackageCount, 2);
  assert.equal(summary.results.length, 2);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[0].sha256)).size, 1);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[0].stagedPath)).size, 2);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[1].sha256)).size, 1);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[1].stagedPath)).size, 2);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[2].sha256)).size, 1);
  assert.equal(new Set(summary.results.map(result => result.inputArtifacts[2].stagedPath)).size, 2);
  for (const result of summary.results) {
    assert.equal(result.status, 'completed');
    assert.equal(await readFile(result.outputArtifacts[0].path, 'utf8'), 'original map script\n');
    assert.equal(await readFile(path.join(result.inputArtifacts[0].stagedPath, 'MapScript.galaxy'), 'utf8'), 'mutated by converter');
    assert.equal(result.inputArtifacts[1].stagedPath, path.join(result.inputArtifacts[0].stagedPath, 'MapScript.galaxy'));
    assert.equal(await readFile(result.inputArtifacts[1].stagedPath, 'utf8'), 'mutated by converter');
    assert.equal(await readFile(result.inputArtifacts[2].stagedPath, 'utf8'), 'opaque package bytes');
  }
});

test('rejects package-linked paths that escape the package', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-package-escape-'));
  const packageDirectory = path.join(directory, 'fixture.SC2Map');
  await mkdir(packageDirectory);
  await writeFile(path.join(directory, 'outside.galaxy'), 'outside package');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{ id: 'mock', command: process.execPath, args: [] }],
    cases: [{
      id: 'package-escape',
      inputs: [
        { role: 'package', id: 'map', path: 'fixture.SC2Map' },
        { role: 'script', fromPackage: 'map', path: '../outside.galaxy' },
      ],
    }],
  }));

  await assert.rejects(
    runBenchmark(manifestPath, path.join(directory, 'runs')),
    /package-linked path must stay inside its package/u,
  );
});

test('enforces minimum case and feature coverage before launching converters', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-coverage-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const packageDirectory = path.join(directory, 'same-map.SC2Map');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  await mkdir(packageDirectory);
  await writeFile(path.join(packageDirectory, 'MapScript.galaxy'), 'void InitMap () {}\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{
      id: 'mock',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    coverageRequirements: {
      minCases: 2,
      minUniquePackages: 2,
      minDocumentKinds: { map: 2, mod: 1 },
      minOperations: { 'triggers-to-galaxy': 1 },
      minTags: { 'gui-trigger': 2, dependencies: 1 },
    },
    cases: [{
      id: 'map',
      documentKind: 'map',
      tags: ['gui-trigger'],
      inputs: [
        { role: 'package', path: 'same-map.SC2Map' },
        { role: 'script', path: source },
      ],
    }, {
      id: 'same-map-again',
      documentKind: 'map',
      tags: ['gui-trigger'],
      inputs: [
        { role: 'package', path: 'same-map.SC2Map' },
        { role: 'script', path: source },
      ],
    }],
  }));

  await assert.rejects(runBenchmark(manifestPath, path.join(directory, 'runs')), error =>
    ['uniquePackageCount', 'documentKinds', 'operations', 'tags'].every(dimension =>
      error.message.includes(`"dimension":"${dimension}"`)));
  await assert.rejects(stat(path.join(directory, 'runs')), { code: 'ENOENT' });

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.coverageRequirements = {
    minCases: 1,
    minUniquePackages: 1,
    minDocumentKinds: { map: 1 },
    minOperations: { 'galaxy-to-triggers': 1 },
    minTags: { 'gui-trigger': 1 },
  };
  await writeFile(manifestPath, JSON.stringify(manifest));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.coverageRequirements.minCases, 1);
  assert.equal(summary.caseCoverage.uniquePackageCount, 1);
});

test('records a failed process and continues with the next case', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-crash-'));
  const source = path.join(directory, 'MapScript.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  const converter = {
    id: 'mock',
    command: process.execPath,
    args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
  };
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [
      { id: 'missing-executable', command: path.join(directory, 'missing-converter.exe') },
      converter,
    ],
    cases: [
      { id: 'crash', inputs: [{ role: 'script', path: source }], options: { mode: 'crash' } },
      { id: 'timeout', timeoutMs: 250, inputs: [{ role: 'script', path: source }], options: { mode: 'slow' } },
      { id: 'invalid-output', inputs: [{ role: 'script', path: source }], options: { mode: 'invalid-output' } },
      { id: 'empty-artifacts', inputs: [{ role: 'script', path: source }], options: { mode: 'empty-artifacts' } },
      { id: 'survivor', inputs: [{ role: 'script', path: source }] },
    ],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.deepEqual(summary.results.map(result => result.status), [
    'spawn-failed', 'process-failed', 'spawn-failed', 'timeout', 'spawn-failed', 'invalid-output',
    'spawn-failed', 'invalid-output', 'spawn-failed', 'completed',
  ]);
  assert.deepEqual(summary.results.map(result => result.correctness), [
    'fail', 'fail', 'fail', 'fail', 'fail', 'fail', 'fail', 'fail', 'fail', 'inconclusive',
  ]);
  assert.deepEqual(summary.correctnessCounts['missing-executable'], { fail: 5 });
  assert.deepEqual(summary.correctnessCounts.mock, { fail: 4, inconclusive: 1 });
  assert.match(summary.results[1].error, /mock converter crashed deliberately/u);
  assert.equal(summary.performanceStats.mock.wallTimeMs.sampleCount, 1);
  assert.equal(summary.performanceStats.mock.allAttempts.wallTimeMs.sampleCount, 5);
  assert.ok(summary.performanceStats.mock.cases.crash.allAttempts.wallTimeMs.max > 0);
  assert.match(summary.results[7].error, /missing required trigger-data artifact/u);
  for (const result of summary.results) {
    assert.equal(typeof result.logFiles.stdout, 'string');
    assert.equal(typeof result.logFiles.stderr, 'string');
    await stat(result.logFiles.stdout);
    await stat(result.logFiles.stderr);
  }
});

test('ModKit adapter preserves companion files and dependency groups', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-modkit-'));
  const files = {
    script: 'void InitMap () {}\n',
    header: '// BenchmarkHeader\n',
    declaration: 'native void BenchmarkNative ();\n',
    dependency: '<TriggerData/>\n',
    dependencyStrings: 'DocInfo/Name=Dependency\n',
    gameStrings: 'Param/Value/A0000001=Localized\n',
    expectedTriggerData: '<TriggerData><Element Type="Trigger" id="baseline"/></TriggerData>\n',
  };
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(directory, name), contents);
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'map',
      documentKind: 'map',
      options: { fixtureDiagnostic: '__proto__' },
      inputs: [
        { role: 'script', path: 'script' },
        { role: 'header', path: 'header' },
        { role: 'game-strings', path: 'gameStrings' },
        { role: 'galaxy-declaration', path: 'declaration' },
        { role: 'dependency-trigger-data', group: 'dep', path: 'dependency' },
        { role: 'dependency-trigger-strings', group: 'dep', path: 'dependencyStrings' },
        { role: 'expected-trigger-data', path: 'expectedTriggerData' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.results[0].converterReport.fidelity.complete, true);
  assert.equal(summary.results[0].guiComparison.status, 'different');
  assert.deepEqual(summary.results[0].guiComparison.differences.typeCounts.Trigger, { expected: 1, actual: 0 });
  assert.deepEqual(summary.results[0].outputArtifacts.map(item => item.role), [
    'trigger-data',
    'trigger-strings',
    'game-strings',
    'generation-options',
  ]);
  const gameStringsArtifact = summary.results[0].outputArtifacts.find(item => item.role === 'game-strings');
  assert.equal(await readFile(gameStringsArtifact.path, 'utf8'), files.gameStrings);
  const persisted = JSON.parse(await readFile(path.join(summary.runDirectory, 'summary.json'), 'utf8'));
  assert.equal(persisted.qualityCounts.modkit.elementTypes.Trigger, 1);
  assert.equal(Object.hasOwn(persisted.qualityCounts.modkit.diagnosticCodes, '__proto__'), true);
  assert.equal(persisted.qualityCounts.modkit.diagnosticCodes['__proto__'], 1);
});

test('ModKit adapter auto-loads one bundled NativeLib (library ID Ntve)', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-native-lib-'));
  const moduleDirectory = path.join(directory, 'starcraft2', 'dist', 'modules', 'triggers', 'services', 'galaxy-conversion');
  const assetRoot = path.join(directory, 'starcraft2', 'assets', 'sc2-data-triggers', 'mods', 'core.sc2mod');
  const modulePath = path.join(moduleDirectory, 'index.mjs');
  const nativeLibraryPath = path.join(assetRoot, 'base.sc2data', 'TriggerLibs', 'NativeLib.TriggerLib');
  const nativeStringsPath = path.join(assetRoot, 'enus.sc2data', 'LocalizedData', 'TriggerStrings.txt');
  const nativeLibrary = '<TriggerData><Element Type="FunctionDef" Id="native"/></TriggerData>\n';
  const nativeStrings = 'FunctionDef/Name/Ntve_native=Native function\n';
  await mkdir(moduleDirectory, { recursive: true });
  await mkdir(path.dirname(nativeLibraryPath), { recursive: true });
  await mkdir(path.dirname(nativeStringsPath), { recursive: true });
  await writeFile(modulePath, await readFile(path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs')));
  await writeFile(nativeLibraryPath, nativeLibrary);
  await writeFile(nativeStringsPath, nativeStrings);
  for (const [name, contents] of Object.entries({
    script: 'void InitMap () {}\n',
    header: '// BenchmarkHeader\n',
    declaration: 'native void BenchmarkNative ();\n',
  })) await writeFile(path.join(directory, name), contents);
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: modulePath },
    }],
    cases: [{
      id: 'bundled-native-lib',
      inputs: [
        { role: 'script', path: 'script' },
        { role: 'header', path: 'header' },
        { role: 'galaxy-declaration', path: 'declaration' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const result = summary.results[0];
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.converterReport.dependencySources.map(source => source.file), [
    'NativeLib.TriggerLib',
    'TriggerStrings.txt',
  ]);
  assert.equal(result.converterReport.dependencySources[0].sha256,
    (await import('node:crypto')).createHash('sha256').update(nativeLibrary).digest('hex'));
});

test('ModKit adapter maps benchmark mod documents to its library API kind', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-mod-library-'));
  await writeFile(path.join(directory, 'script.galaxy'), 'void InitMap () {}\n');
  await writeFile(path.join(directory, 'header.galaxy'), '// BenchmarkHeader\n');
  await writeFile(path.join(directory, 'declaration.galaxy'), 'native void BenchmarkNative ();\n');
  await writeFile(path.join(directory, 'dependency'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'dependency-strings'), 'DocInfo/Name=Dependency\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'mod-library',
      documentKind: 'mod',
      operation: 'galaxy-triggers-roundtrip',
      inputs: [
        { role: 'script', path: 'script.galaxy' },
        { role: 'header', path: 'header.galaxy' },
        { role: 'galaxy-declaration', path: 'declaration.galaxy' },
        { role: 'dependency-trigger-data', group: 'ntve', path: 'dependency' },
        { role: 'dependency-trigger-strings', group: 'ntve', path: 'dependency-strings' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.results[0].converterReport.provenance.forward.documentKind, 'library');
});

test('ModKit adapter supports forward conversion and exact golden artifacts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-forward-'));
  const inputs = {
    triggerData: '<TriggerData/>\n',
    expectedScript: 'void Run() {}\n',
    expectedHeader: 'void Run();\n',
  };
  for (const [name, contents] of Object.entries(inputs)) await writeFile(path.join(directory, name), contents);
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'forward',
      operation: 'triggers-to-galaxy',
      documentKind: 'library',
      inputs: [
        { role: 'trigger-data', path: 'triggerData' },
        { role: 'expected-script', path: 'expectedScript' },
        { role: 'expected-header', path: 'expectedHeader' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const result = summary.results[0];
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.goldenComparison, {
    script: { byteExact: true, exact: true, expectedBytes: 14, actualBytes: 14 },
    header: { byteExact: true, exact: true, expectedBytes: 12, actualBytes: 12 },
  });
  assert.deepEqual(result.structuralComparison, {
    script: { status: 'equivalent', syntaxValid: true, exact: true, differenceSamples: [] },
    header: { status: 'equivalent', syntaxValid: true, exact: true, differenceSamples: [] },
  });
  assert.equal(result.correctness, 'pass');
  const persisted = JSON.parse(await readFile(path.join(summary.runDirectory, 'summary.json'), 'utf8'));
  assert.equal(persisted.qualityCounts.modkit['ast-script-equivalent'], 1);
  assert.equal(persisted.correctnessCounts.modkit.pass, 1);
  assert.equal(persisted.performanceStats.modkit.converterTimeMs.conversionWallTimeMs.sampleCount, 1);
  assert.equal(persisted.performanceStats.modkit.converterTimeMs.galaxyToTriggersMs.sampleCount, 0);
});

test('AST mismatch is a correctness failure even when conversion completes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-ast-mismatch-'));
  await writeFile(path.join(directory, 'triggers'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'expected'), 'void Changed() {}\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'mismatch',
      operation: 'triggers-to-galaxy',
      documentKind: 'library',
      inputs: [
        { role: 'trigger-data', path: 'triggers' },
        { role: 'expected-script', path: 'expected' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.results[0].structuralComparison.script.status, 'different');
  assert.equal(summary.results[0].correctness, 'fail');
  assert.equal(summary.correctnessCounts.modkit.fail, 1);
});

test('shared AST oracle overrides converter-reported equivalence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-shared-ast-'));
  await writeFile(path.join(directory, 'triggers'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'expected'), 'void Changed() {}\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'untrusted',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [{
      id: 'forward-mismatch',
      operation: 'triggers-to-galaxy',
      documentKind: 'library',
      inputs: [
        { role: 'trigger-data', path: 'triggers' },
        { role: 'expected-script', path: 'expected' },
      ],
    }],
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].structuralComparison.script.status, 'different');
  assert.equal(summary.results[0].correctness, 'fail');
});

test('AST oracle exceptions fail only the affected attempt instead of aborting the run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-oracle-error-'));
  await writeFile(path.join(directory, 'triggers'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'expected'), 'void Changed() {}\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'throwing-oracle.mjs'),
    converters: [{
      id: 'mock',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [1, 2].map(index => ({
      id: `case-${index}`,
      operation: 'triggers-to-galaxy',
      documentKind: 'library',
      inputs: [
        { role: 'trigger-data', path: 'triggers' },
        { role: 'expected-script', path: 'expected' },
      ],
    })),
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results.length, 2);
  assert.deepEqual(summary.results.map(item => item.correctness), ['fail', 'fail']);
  assert.match(summary.results[0].structuralComparison.script.differenceSamples[0], /oracle fixture failure/);
});

test('GUI structure mismatch reaches the correctness gate', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-gui-mismatch-'));
  const source = path.join(directory, 'script.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap () {}\n');
  await writeFile(path.join(directory, 'expected-trigger-data'), '<TriggerData><Element Type="Trigger" Id="baseline"/></TriggerData>\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'mock',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [{
      id: 'gui-mismatch',
      inputs: [
        { role: 'script', path: source },
        { role: 'expected-trigger-data', path: 'expected-trigger-data' },
      ],
      options: { guiComparison: { status: 'equivalent-structure' } },
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const result = summary.results[0];
  assert.equal(result.guiComparison.status, 'different');
  assert.equal(result.correctness, 'fail');
  assert.equal(summary.qualityCounts.mock['gui-comparison-different'], 1);
});

test('shared GUI oracle rejects converter claims when no independent baseline exists', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-gui-overclaim-'));
  const source = path.join(directory, 'script.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap() {}\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'overclaim',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [{
      id: 'no-baseline',
      inputs: [{ role: 'script', path: source }],
      options: { mode: 'overclaim-gui' },
    }],
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].guiComparison.status, 'inconclusive');
  assert.equal(summary.results[0].correctness, 'inconclusive');
});

test('unconfigured shared oracle prevents converter self-reported correctness passes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-no-oracle-'));
  const source = path.join(directory, 'script.galaxy');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(source, 'void InitMap() {}\n');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{
      id: 'overclaim',
      command: process.execPath,
      args: [path.join(projectRoot, 'fixtures', 'mock-converter.mjs'), '{request}'],
    }],
    cases: [{
      id: 'no-oracle',
      inputs: [{ role: 'script', path: source }],
      options: { mode: 'overclaim-gui' },
    }],
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].guiComparison.status, 'inconclusive');
  assert.equal(summary.results[0].structuralComparison, undefined);
  assert.equal(summary.results[0].converterReport.selfReportedGuiComparison.status, 'equivalent-structure');
  assert.equal(summary.results[0].correctness, 'inconclusive');
});

test('roundtrip evaluates Galaxy source against regenerated Galaxy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-roundtrip-'));
  await writeFile(path.join(directory, 'script'), 'void InitMap() {}\n');
  await writeFile(path.join(directory, 'header'), '// BenchmarkHeader\n');
  await writeFile(path.join(directory, 'declaration'), 'native void BenchmarkNative();\n');
  await writeFile(path.join(directory, 'dependency'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'expectedTriggerData'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'dependencyStrings'), 'DocInfo/Name=Dependency\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'modkit',
      command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'roundtrip',
      operation: 'galaxy-triggers-roundtrip',
      documentKind: 'map',
      options: { fixtureRequirePreserve: true },
      inputs: [
        { role: 'script', path: 'script' },
        { role: 'header', path: 'header' },
        { role: 'expected-trigger-data', path: 'expectedTriggerData' },
        { role: 'galaxy-declaration', path: 'declaration' },
        { role: 'dependency-trigger-data', group: 'dep', path: 'dependency' },
        { role: 'dependency-trigger-strings', group: 'dep', path: 'dependencyStrings' },
      ],
    }],
  }));

  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const result = summary.results[0];
  assert.equal(result.status, 'completed');
  assert.equal(result.outputArtifacts.some(artifact => artifact.role === 'trigger-data'), true);
  assert.equal(result.outputArtifacts.some(artifact => artifact.role === 'roundtrip-script'), true);
  assert.equal(Object.hasOwn(result.goldenComparison, 'trigger-data'), false);
  assert.equal(result.structuralComparison.script.status, 'different');
  assert.equal(result.correctness, 'fail');
  assert.equal(typeof result.converterMetrics.galaxyToTriggersMs, 'number');
  assert.equal(typeof result.converterMetrics.triggersToGalaxyMs, 'number');
  assert.equal(summary.performanceStats.modkit.converterTimeMs.galaxyToTriggersMs.sampleCount, 1);
  assert.equal(summary.performanceStats.modkit.cases.roundtrip.converterTimeMs.triggersToGalaxyMs.sampleCount, 1);
});

test('compares original Triggers Galaxy independently beside roundtrip Galaxy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-dual-'));
  await writeFile(path.join(directory, 'script'), 'void InitMap() {}\n');
  await writeFile(path.join(directory, 'original-triggers'), '<TriggerData><Element Type="Trigger" Id="first"/></TriggerData>\n');
  await writeFile(path.join(directory, 'declaration'), 'native void BenchmarkNative();\n');
  await writeFile(path.join(directory, 'dependency'), '<TriggerData/>\n');
  await writeFile(path.join(directory, 'dependencyStrings'), 'DocInfo/Name=Dependency\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    astOracleModule: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs'),
    converters: [{
      id: 'modkit', command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{
      id: 'dual', operation: 'galaxy-triggers-roundtrip', documentKind: 'map',
      inputs: [
        { role: 'script', path: 'script' },
        { role: 'original-trigger-data', path: 'original-triggers' },
        { role: 'galaxy-declaration', path: 'declaration' },
        { role: 'dependency-trigger-data', group: 'dep', path: 'dependency' },
        { role: 'dependency-trigger-strings', group: 'dep', path: 'dependencyStrings' },
      ],
    }],
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  const result = summary.results[0];
  assert.equal(result.status, 'completed');
  assert.equal(result.originalConversion.status, 'completed');
  assert.equal(result.outputArtifacts.some(item => item.role === 'original-script'), true);
  assert.equal(result.structuralComparison.originalScript.status, 'different');
  assert.equal(result.structuralComparison.script.status, 'different');
  const report = JSON.parse(await readFile(path.join(summary.runDirectory, 'report.json'), 'utf8'));
  assert.equal(report.caseResults[0].attempts[0].originalConversion.status, 'completed');
});

test('keeps the converter failure when roundtrip has no original Triggers', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-roundtrip-error-'));
  await writeFile(path.join(directory, 'script'), 'void InitMap() {}\n');
  const manifestPath = path.join(directory, 'benchmark.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    converters: [{
      id: 'modkit', command: process.execPath,
      args: [path.join(projectRoot, 'adapters', 'modkit.mjs'), '{request}'],
      env: { MODKIT_CONVERSION_MODULE: path.join(projectRoot, 'fixtures', 'fake-modkit-conversion.mjs') },
    }],
    cases: [{ id: 'roundtrip-error', operation: 'galaxy-triggers-roundtrip', documentKind: 'map',
      inputs: [{ role: 'script', path: 'script' }] }],
  }));
  const summary = await runBenchmark(manifestPath, path.join(directory, 'runs'));
  assert.equal(summary.results[0].status, 'completed');
  assert.equal(summary.results[0].roundtripConversion.status, 'failed');
  assert.match(summary.results[0].roundtripConversion.error, /missing header/);
});

test('does not pass Galaxy-to-Triggers without semantic GUI-structure evidence', () => {
  assert.equal(assessCorrectness({
    status: 'completed',
    operation: 'galaxy-triggers-roundtrip',
    diagnostics: [],
    conversionQuality: { completeness: 'complete', dropped: 0, unsupported: 0 },
    structuralComparison: { script: { status: 'equivalent' }, header: { status: 'equivalent' } },
  }), 'inconclusive');
});

test('keeps every report and compares code, errors, time, and memory across runs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'galaxy-benchmark-history-'));
  const makeReport = (name, startedAt, ast, errors, time) => ({
    name: 'suite', startedAt, manifestSha256: 'same-inputs',
    caseResults: [{
      caseId: 'map', converterId: 'modkit', displayName: 'Test.SC2Map', shortStatus: 'Failed',
      attempts: [{ diagnosticsSummary: { byCode: [{ severity: 'error', count: errors }] } }],
      outputMetrics: { astDifferences: ast, callDifferences: ast * 2, guiTriggers: 4, customScriptTags: 1 },
      performance: { wallTimeMs: { median: time }, peakWorkingSetBytes: { median: 50_000_000 } },
    }],
  });
  const directories = ['old', 'new'].map(name => path.join(root, name));
  for (const directory of directories) await mkdir(directory);
  const oldText = JSON.stringify(makeReport('old', '2026-09-22T00:00:00Z', 10, 3, 2000));
  await writeFile(path.join(directories[0], 'report.json'), oldText);
  await writeFile(path.join(directories[1], 'report.json'), JSON.stringify(makeReport('new', '2026-09-23T00:00:00Z', 6, 1, 1500)));
  const comparison = await compareRuns(directories);
  assert.equal(comparison.runs[0].cases.get('map\0modkit').astDifferences, 10);
  assert.equal(comparison.runs[1].cases.get('map\0modkit').errors, 1);
  assert.equal(comparison.runs[1].cases.get('map\0modkit').wallTimeMs, 1500);
  const history = await writeRunHistory(root);
  assert.equal(history.runs, 2);
  const html = await readFile(history.target, 'utf8');
  assert.match(html, /AST diffs/u);
  assert.match(html, /Error diagnostics/u);
  assert.match(html, /Test.SC2Map/u);
  assert.equal(await readFile(path.join(directories[0], 'report.json'), 'utf8'), oldText);
});
