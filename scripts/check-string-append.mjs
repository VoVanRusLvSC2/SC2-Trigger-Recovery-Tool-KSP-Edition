import assert from 'node:assert/strict';
import { createVerifiedConversionProgram } from '../src/conversion/exact-function-signatures/verified-conversion-program.mjs';
import { planStableGlobalConcatAssignment } from '../src/conversion/bound-static-primary-storage/stable-global-concat-assignment.mjs';
import {
  privateFrameConcatAssignmentRecipe,
  withBoundSourceCallReturns,
} from '../src/conversion/bound-static-primary-storage/bound-source-access.concat.mjs';
import {
  SyntaxKind as K,
  forEachChild,
  Printer,
} from '../src/conversion/exact-function-signatures/index-alternate-3.js';
const declarations =
  'native string IntToString(int value); struct Debug { string permissions; }; Debug gv_debug; string gv_password;';
function plans(source, recipe = planStableGlobalConcatAssignment) {
  const program = createVerifiedConversionProgram(
    Array.isArray(source) ? source : [{ fileName: 'append.galaxy', text: source }],
  );
  const results = [];
  for (const ast of program.documents.values()) {
    assert.equal(ast.parseDiagnostics.length, 0, source);
    const visit = (node) => {
      if (
        node.kind === K.ExpressionStatement &&
        node.expression?.operatorToken?.kind === K.PlusEqualsToken
      )
        results.push(recipe(program, node));
      forEachChild(node, (c) => {
        visit(c);
      });
    };
    visit(ast);
  }
  return results;
}
const positives = plans(
  declarations +
    ' void gf_Append(){ gv_password += "suffix"; gv_debug.permissions += ("account[" + IntToString(-1) + "]"); }',
);
assert.equal(positives.length, 2);
for (const plan of positives) {
  assert.equal(plan.proof.kind, 'STABLE_GLOBAL_CONCAT_APPEND_TO_ASSIGNMENT');
  assert.equal(plan.node.expression.operatorToken.kind, K.EqualsToken);
  assert.equal(plan.node.expression.right.operatorToken.kind, K.PlusToken);
  assert.equal(plan.proof.newCustomScript, 0);
}
const printed = new Printer().printNode(positives[1].node.expression);
assert(printed.includes('gv_debug.permissions'));
assert(!printed.includes('./index.js'));
const imported = plans([
  { fileName: 'library.galaxy', text: declarations.replaceAll('gv_', 'libTEST_gv_') },
  {
    fileName: 'map.galaxy',
    text: 'void f(){ libTEST_gv_password += "suffix"; libTEST_gv_debug.permissions += ("[" + IntToString(-1) + "]"); }',
  },
]);
assert.equal(imported.length, 2);
assert(imported.every(Boolean));
const negatives = [
  declarations +
    ' string gf_Mutate(){ gv_password="changed"; return "x"; } void f(){gv_password += gf_Mutate();}',
  'string IntToString(int value){return "shadow";} string gv_password; void f(){gv_password += IntToString(1);}',
  declarations +
    ' string[2] gv_values; int gf_Next(){return 1;} void f(){gv_values[gf_Next()] += "x";}',
  declarations + ' string[2] gv_values; void f(){gv_values[0] += "x";}',
  'const string gv_password="fixed"; void f(){gv_password += "x";}',
  declarations + ' void f(){missing += "x";}',
  'int gv_count; void f(){gv_count += 1;}',
];
for (const source of negatives)
  assert(
    plans(source).every((x) => x === undefined),
    source,
  );
// The public recipe keeps its prior local-variable path and sees the new global path.
const bridged = plans(
  declarations + ' void f(){string lv_value=""; gv_password += "x"; lv_value += "local";}',
  (p, n) => withBoundSourceCallReturns(p, () => privateFrameConcatAssignmentRecipe(n)),
);
assert(bridged.every(Boolean));
console.log(
  JSON.stringify({
    stableGlobalAppends: positives.length,
    conservativeRefusals: negatives.length,
    existingLocalPathPreserved: true,
  }),
);

const nativeAt = process.argv.indexOf('--native-root');
if (nativeAt >= 0) {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { convertGalaxyToTriggers, convertTriggersToGalaxy } = await import(
    '../src/conversion/index.mjs'
  );
  const nativeRoot = process.argv[nativeAt + 1];
  assert(nativeRoot);
  const dependencyLibraries = [
    {
      sourcePath: 'TriggerLibs/NativeLib.TriggerLib',
      triggerData: await readFile(path.join(nativeRoot, 'NativeLib.TriggerLib'), 'utf8'),
      triggerStrings: '',
    },
  ];
  const galaxyDeclarations = await Promise.all(
    ['natives.galaxy', 'NativeLib_h.galaxy', 'NativeLib.galaxy'].map(async (name) => ({
      fileName: 'TriggerLibs/' + name,
      text: await readFile(path.join(nativeRoot, name), 'utf8'),
    })),
  );
  const input = {
    script:
      'struct gs_Debug { string lv_permissions; }; gs_Debug gv_debug; string gv_password; void gf_Append(){ gv_password += "suffix"; gv_debug.lv_permissions += ("account[" + IntToString(-1) + "]"); }',
    header: '',
    libraryId: 'Map',
    dependencyLibraries,
    galaxyDeclarations,
    strictSymbols: true,
    guiRecoveryMode: 'preserve-source',
  };
  const converted = await convertGalaxyToTriggers(input);
  assert(!/<(?:ScriptCode|CustomScript)\b/.test(converted.output.triggerData));
  assert(!converted.output.triggerData.includes('ExpressionStatement'));
  const regenerated = await convertTriggersToGalaxy(converted.output.triggerData, {
    ...input,
    ...converted.output.generationOptions,
    triggerStrings: converted.output.triggerStrings,
  });
  assert(
    regenerated.output.script.includes('libMap_gv_password = (libMap_gv_password + "suffix")'),
  );
  assert(
    regenerated.output.script.includes(
      'libMap_gv_debug.lv_permissions = (libMap_gv_debug.lv_permissions + ("account[" + IntToString(-1) + "]"))',
    ),
  );
  assert(!regenerated.output.script.includes('./index.js'));
  console.log(
    'Public API: global and record appends roundtrip through standard GUI without script helpers.',
  );
}
