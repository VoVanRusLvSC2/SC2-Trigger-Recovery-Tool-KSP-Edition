import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedConversionProgram} from '../model/verified-conversion-program.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {nativeAttributeGuiSchema} from '../../map_attributes/attribute_gui.mjs';
import {assertDocumentAttributeModel, withDocumentAttributeContext, qualifyDocumentAttributeSelector} from '../../map_attributes/attribute_identity_context.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = value => createHash('sha256').update(value).digest('hex');

// Comparison view only. A short document selector gains its verified owner at
// an actual, source-bound native query. Arbitrary strings and foreign owners
// never change. This does not prove defaults, whole lobby data or API bodies.
export async function qualifyDocumentAttributeView(source, {context, model, nativeXml, parseXml,
  ownedSources = [], externalSources = [], includeEvidence = []}) {
  assertDocumentAttributeModel(context, model);
  const schema = nativeAttributeGuiSchema(nativeXml, parseXml);
  const bindings = new Map(schema.bindings.map(row => [row.apiName, row]));
  const root = {fileName: 'MapScript.galaxy', text: source};
  const closure = removeAlreadyLoadedOwnedIncludes({root, ownedSources, externalSources, includeEvidence, includeRoot: false});
  assert.equal(closure.proof.completeReachableClosure, true, 'ATTRIBUTE_QUERY_INCLUDE_CLOSURE_REQUIRED');
  const reachable = new Map(closure.proof.resolvedFiles.map(row => [logicalSourcePath(row.path), row.sha256]));
  const files = [], seen = new Set();
  for (const file of [root, ...ownedSources, ...externalSources]) {
    const name = logicalSourcePath(file.originalPath ?? file.fileName);
    if (!reachable.has(name) || seen.has(name)) continue;
    const digest = sha(file.text);
    assert.equal(digest, reachable.get(name), 'ATTRIBUTE_QUERY_SOURCE_CHANGED');
    if (file.sha256 !== undefined) assert.equal(digest, file.sha256, 'ATTRIBUTE_QUERY_SOURCE_SHA');
    seen.add(name);
    files.push({...file, fileName: name, owned: file === root || ownedSources.includes(file), contentSha256: digest});
  }
  const program = createVerifiedConversionProgram(files);
  try {
    const ast = program.documents.get(logicalSourcePath(root.fileName));
    program.attachOriginal(ast);
    return await withDocumentAttributeContext(context, async scope => {
      const edits = [], refused = [];
      const walk = node => {
        const binding = node.kind === K.CallExpression && node.expression?.kind === K.Identifier && bindings.get(node.expression.name);
        if (binding) {
          const identity = program.getBinding(node.expression), declaration = program.declarationAt(node.expression);
          let owner = declaration;
          while (owner?.parent) owner = owner.parent;
          const native = identity.status === 'BOUND' && declaration?.kind === K.FunctionDeclaration && !declaration.body &&
            program.inputs.get(owner?.fileName)?.owned === false && declaration.modifiers?.length === 1 &&
            declaration.modifiers[0].kind === K.NativeKeyword && declaration.type?.kind === K.StringKeyword &&
            declaration.parameters?.[0]?.type?.kind === K.StringKeyword && !declaration.parameters[0].isReference &&
            declaration.parameters.length === node.arguments.length;
          const arg = node.arguments[0], literal = arg?.kind === K.StringLiteral && readStringLiteralValue(arg.text);
          if (!native || !literal) refused.push({start: node.pos, api: node.expression.name, reason: 'UNBOUND_NONNATIVE_OR_INDIRECT_ATTRIBUTE_QUERY'});
          else {
            const after = qualifyDocumentAttributeSelector(binding.valueType, literal.value, {source: 'MapScript.galaxy', start: arg.pos});
            if (after !== literal.value) edits.push({start: arg.pos, end: arg.end, before: source.slice(arg.pos, arg.end),
              replacement: JSON.stringify(after), api: binding.apiName, domain: binding.attributeType,
              symbolId: identity.symbolId, beforeSelector: literal.value, afterSelector: after});
          }
        }
        forEachChild(node, walk);
      };
      walk(ast);
      edits.sort((a, b) => a.start - b.start);
      for (let i = 1; i < edits.length; i++) assert(edits[i - 1].end <= edits[i].start);
      let text = source;
      for (const edit of [...edits].reverse()) {
        assert.equal(text.slice(edit.start, edit.end), edit.before);
        text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
      }
      return {text, proof: {kind: 'SOURCE_BOUND_VERIFIED_DOCUMENT_ATTRIBUTE_SELECTORS', sourceSha256: sha(source), viewSha256: sha(text),
        context: scope.context, nativeXmlSha256: sha(nativeXml), closure: closure.proof,
        edits, refused, decisions: scope.decisions, sourceOrExportChanged: false,
        onlySelectorsChangedInView: true, rawOracleReplaced: false, fullOriginalLobbyProved: false, wholeMapAccepted: false}};
    });
  } finally { program.dispose(); }
}
