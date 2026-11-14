import { normalizeBooleanLogicForms } from '../exact-native-export/boolean-logic-forms.mjs';
import { normalizePrototypeParameterNames } from '../exact-native-export/prototype-parameter-names.mjs';
import { normalizeConstantArrayDimensions } from '../exact-native-export/constant-array-dimensions.mjs';
import { normalizeGuardedStartupNoops } from '../exact-native-export/guarded-startup-noops.mjs';
import { normalizeImmutableGlobalConstants } from '../exact-native-export/immutable-global-constants.mjs';
/** Additional, evidence-bound static comparison. This is NOT Editor evidence.
 * Executable calls, values, public symbols and registration order remain strict.
 */
import { normalizeLeadingInitializers } from '../exact-native-export/declaration-initializers.mjs';
import { normalizeLoopCounterBindings } from '../exact-native-export/loop-counter-binding.mjs';
import { normalizeControlFlowForms } from '../exact-native-export/control-flow-forms.mjs';
import { normalizePrivateThreadCaptures } from './private-thread-captures.mjs';
import { normalizeVerifiedNativeIncludes } from '../../utilities';
import { compareGalaxyPrograms } from './index-alternate.mjs';
import { SyntaxKind as K, forEachChild } from '../exact-function-signatures/index-alternate-4.js';
import { normalizeIndependentOrder } from '../../recovery/archives/independent-order.mjs';
import { normalizeSemanticPair } from '../exact-native-export/semantic-forms.mjs';
import { expandLocalScripts } from '../../recovery/automatic/local-scripts.mjs';

export function compareGalaxyBusiness(
  leftText,
  rightText,
  { parseGalaxy, nativeProof, declarations, leftAi = [], rightAi = [] } = {},
) {
  let aiProof;
  try {
    const a = expandLocalScripts(leftText, leftAi, parseGalaxy),
      b = expandLocalScripts(rightText, rightAi, parseGalaxy);
    leftText = a.text;
    rightText = b.text;
    aiProof = { original: a.proof, generated: b.proof };
  } catch (e) {
    return {
      equivalent: false,
      verdict: 'INVALID_LOCAL_SCRIPT',
      error: String(e),
      editorVerified: false,
    };
  }
  const left = parseGalaxy(leftText, 'original.galaxy'),
    right = parseGalaxy(rightText, 'generated.galaxy');
  if (left.parseDiagnostics.length || right.parseDiagnostics.length)
    return {
      equivalent: false,
      verdict: 'INVALID',
      syntaxErrors: [left.parseDiagnostics.length, right.parseDiagnostics.length],
      editorVerified: false,
    };
  const strict = compareGalaxyPrograms(left, right, { libraryId: 'Map', sampleLimit: 40 });
  // Recognize compiler machinery before lowering local initializer syntax;
  // that lowering intentionally changes the recognizer's exact callback shape.
  const captures = normalizePrivateThreadCaptures(left, right, K, forEachChild, {
    foreignCode: declarations,
  });
  const leading = [
    normalizeLeadingInitializers(captures.original, K, forEachChild),
    normalizeLeadingInitializers(captures.generated, K, forEachChild),
  ];
  const startup = leading.map((v) =>
    normalizeGuardedStartupNoops(v.source, K, forEachChild, { declarations }),
  );
  const native = startup.map((v) =>
    normalizeVerifiedNativeIncludes(v.source, K, { declarations, nativeProof, parseGalaxy }),
  );
  const flow = native.map((v) => normalizeControlFlowForms(v.source, K, forEachChild));
  const counters = flow.map((v) => normalizeLoopCounterBindings(v.source, K, forEachChild));
  const constants = counters.map((v) =>
    normalizeImmutableGlobalConstants(v.source, K, { declarations, parseGalaxy }),
  );
  const arrays = constants.map((v) =>
    normalizeConstantArrayDimensions(v.source, K, forEachChild, { declarations, parseGalaxy }),
  );
  const prototypes = arrays.map((v) => normalizePrototypeParameterNames(v.source, K));
  const booleans = prototypes.map((v) => normalizeBooleanLogicForms(v.source, K, forEachChild));
  const a = normalizeIndependentOrder(booleans[0].source, K, { nativeIncludesNatives: false }),
    b = normalizeIndependentOrder(booleans[1].source, K, { nativeIncludesNatives: false });
  let comparison = compareGalaxyPrograms(a.source, b.source, { libraryId: 'Map', sampleLimit: 40 }),
    forms;
  if (!comparison.exact) {
    forms = normalizeSemanticPair(a.source, b.source, K, forEachChild);
    comparison = compareGalaxyPrograms(forms.original.source, forms.exported.source, {
      libraryId: 'Map',
      sampleLimit: 40,
    });
  }
  return {
    equivalent: comparison.exact,
    verdict: comparison.exact ? 'EQUIVALENT_ROOT' : 'DIFFERENT',
    strictExact: strict.exact,
    strict,
    comparison,
    aiProof,
    allowedTransforms: {
      original: [
        ...leading[0].notes,
        ...startup[0].notes,
        ...native[0].notes,
        ...flow[0].notes,
        ...counters[0].notes,
        ...constants[0].notes,
        ...arrays[0].notes,
        ...prototypes[0].notes,
        ...booleans[0].notes,
        ...captures.notes,
        ...a.notes,
        ...(forms?.original.notes ?? []),
      ],
      generated: [
        ...leading[1].notes,
        ...startup[1].notes,
        ...native[1].notes,
        ...flow[1].notes,
        ...counters[1].notes,
        ...constants[1].notes,
        ...arrays[1].notes,
        ...prototypes[1].notes,
        ...booleans[1].notes,
        ...b.notes,
        ...(forms?.exported.notes ?? []),
      ],
    },
    nativeProof,
    nativeGraphProof: native.map((v) => v.proof ?? { refused: v.refused }),
    privateCaptureForeignSourceProof: captures.foreignSourceProof,
    scope:
      'Static root plus actual map-owned include bodies; actual foreign source proof. Types, attribute metadata, packed AI compatibility and native compilation are separate gates.',
    editorVerified: false,
  };
}
