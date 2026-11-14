import { deriveNativeTypeMapping } from './types-alternate.mjs';
import { FunctionCandidateIndex } from './function-candidates-alternate-2.mjs';
import { createNativeEventEffectTools } from './native-event-effects.param-aware.mjs';
export const {
  classifyNativeEventContracts,
  createTrustedNativeEventEffects,
  verifiedNativeEventEffect,
  nativeEventEffectEvidence,
} = createNativeEventEffectTools(FunctionCandidateIndex, deriveNativeTypeMapping);
