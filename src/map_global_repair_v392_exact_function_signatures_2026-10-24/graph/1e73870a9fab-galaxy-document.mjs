import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

const sha = text => createHash('sha256').update(text).digest('hex');

// A pass receives an immutable syntax tree. Source spans remain valid until
// commit; changed text is parsed before the next pass can observe it.
function freezeSyntaxTree(root) {
  const seen = new Set(), pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) if (key !== 'parent') pending.push(child);
    Object.freeze(value);
  }
  return root;
}

/** Mutable ownership of immutable AST revisions, limited to one conversion.
 * No result cache, no global context, no map-specific decisions. Verification
 * of emitted GUI/archives still runs independently with its own parser. */
export function createGalaxyDocument({fileName, text, role = 'owned'}) {
  assert.equal(typeof fileName, 'string');
  assert.equal(typeof text, 'string');
  let parses = 0, revision = 0, running = false, disposed = false;
  const history = [];
  const parse = source => {
    const tree = new Parser().parseFile(fileName, source);
    parses++;
    assert.equal(tree.parseDiagnostics.length, 0, 'INVALID_GALAXY_REVISION: ' + fileName);
    return freezeSyntaxTree(tree);
  };
  let current = {text, ast: parse(text)};
  const originalSha256 = sha(text);
  return Object.freeze({
    get text() { assert(!disposed, 'DISPOSED_GALAXY_DOCUMENT'); return current.text; },
    get ast() { assert(!disposed, 'DISPOSED_GALAXY_DOCUMENT'); return current.ast; },
    run(name, operation) {
      assert(!disposed, 'DISPOSED_GALAXY_DOCUMENT');
      assert(!running, 'REENTRANT_GALAXY_PASS');
      assert.equal(typeof name, 'string');
      running = true;
      let active = true, staged = current;
      const before = current, parseStart = parses;
      const view = Object.freeze({
        input(source) {
          assert(active, 'EXPIRED_GALAXY_PASS');
          assert.equal(source, before.text, 'STALE_GALAXY_INPUT');
          return before.ast;
        },
        output(source) {
          assert(active, 'EXPIRED_GALAXY_PASS');
          assert.equal(typeof source, 'string');
          if (source === before.text) return before.ast;
          if (source !== staged.text) staged = {text: source, ast: parse(source)};
          return staged.ast;
        },
      });
      try {
        const result = operation(view);
        assert(result && typeof result.text === 'string', 'SYNCHRONOUS_GALAXY_PASS_RESULT_REQUIRED');
        const ast = view.output(result.text), changed = result.text !== before.text;
        if (changed) revision++;
        current = {text: result.text, ast};
        history.push({name, revision, changed, inputSha256: sha(before.text), outputSha256: sha(result.text), parses: parses - parseStart});
        return result;
      } finally {
        active = false;
        running = false;
      }
    },
    evidence() {
      assert(!disposed, 'DISPOSED_GALAXY_DOCUMENT');
      return {fileName, role, originalSha256, outputSha256: sha(current.text), revision, parses,
        passes: history.map(row => ({...row})), immutableAst: true, persistentCache: false};
    },
    dispose() {
      assert(!running, 'DISPOSE_DURING_GALAXY_PASS');
      current = null;
      disposed = true;
    },
  });
}
