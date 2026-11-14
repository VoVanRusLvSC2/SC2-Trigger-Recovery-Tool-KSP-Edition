import { publicNativeEventAlias as previous } from './public-native-event-alias.mjs';
const presentationView = (value) => {
  if (!value) return value;
  const { displayName, ...semantic } = value;
  return semantic;
};
// SDK localization adds displayName after XML parsing. It is editor presentation,
// never the native identifier or ParamDef type. Keep the original objects for
// binding/serialization; only the equivalence proof uses this projection.
export function publicNativeEventAlias(index, query, candidates) {
  const views = candidates.map((c) => ({ ...c, definition: presentationView(c.definition) }));
  const semanticIndex = {
    carrier: (...args) => index.carrier(...args),
    formal: (...args) => presentationView(index.formal(...args)),
  };
  const result = previous(semanticIndex, query, views);
  if (!result) return;
  return {
    candidate: candidates.find((c) => c.key === result.candidate.key),
    proof: {
      ...result.proof,
      excludedPresentationFields: ['displayName'],
      originalMetadataPreserved: true,
    },
  };
}
