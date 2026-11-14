/** One-map, one-process cache of analysis for identical packed inputs.
 * Candidates still get independent archive verification and real Editor tests.
 * No disk persistence, shared singleton, or reuse between maps/runs.
 */
import { createHash } from 'node:crypto';
export function createVariantAnalysisCache(mapIdentity) {
  let previous;
  return {
    key(inputs) {
      return createHash('sha256')
        .update(JSON.stringify([mapIdentity, inputs]))
        .digest('hex');
    },
    get(key) {
      return previous?.key === key ? previous.value : undefined;
    },
    put(key, value) {
      previous = { key, value };
    },
    clear() {
      previous = undefined;
    },
  };
}
