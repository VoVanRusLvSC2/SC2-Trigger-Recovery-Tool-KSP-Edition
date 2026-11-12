import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K, Printer, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {globalVariables, globalVariableNames, withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {createGuiCapabilityCatalog} from '../bindings/gui-capability-catalog.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
const sha = text => createHash('sha256').update(text).digest('hex'), printer = new Printer();
const ignoredFields = new Set(['parent', 'pos', 'end', 'line', 'char', 'syntaxTokens']);
function walk(root, visit) {
  const pending = [{node: root}];
  while (pending.length) {const {node, parent} = pending.pop();visit(node, parent);forEachChild(node, child => {pending.push({node: child, parent: node});});}
}
function uniqueGlobals(ast) {
  const result = new Map();
  for (const node of ast.statements.filter(node => node.kind === K.VariableDeclaration)) {
    assert(!result.has(node.name.name), 'GUI_GLOBAL_DUPLICATE_DECLARATION');result.set(node.name.name, node);
  }
  return result;
}

// A compiler namespace prefix changes a global's spelling, not its storage
// identity. Qualify it through the actual GUI owner/type/id and bound source
// references. Never rename functions, members, types, strings or external code.
export function transportGuiGlobalBindings(before, after, {libraries, implicitLibraryId = 'Map', externalSources = []}) {
  const input = {fileName: 'global-binding.galaxy', sourceId: 'global-binding', text: before, contentSha256: sha(before), owned: true};
  const program = new GalaxyProgramContext([input], {files: [input], dependencies: []}, sha);
  try {
    const original = program.documents.get(input.fileName);program.attachOriginal(original);assert.equal(original.parseDiagnostics.length, 0);
    const target = parse(after, 'global-binding-target');assert.equal(target.parseDiagnostics.length, 0);
    const sourceGlobals = uniqueGlobals(original), targetGlobals = uniqueGlobals(target), catalog = createGuiCapabilityCatalog(libraries);
    assert.equal(catalog.issues.length, 0, 'GUI_GLOBAL_AMBIGUOUS_CATALOG');
    const mapping = new Map(), targets = new Set(), records = [], refused = [];
    for (const [owner, library] of libraries) {
      const variables = globalVariables(library), names = owner === implicitLibraryId
        ? withImplicitLibrary(owner, () => globalVariableNames(owner, variables)) : globalVariableNames(owner, variables);
      for (const variable of variables) {
        const source = sourceGlobals.get(variable.identifier), name = names.get(variable.id), emitted = targetGlobals.get(name);
        if (!source || !emitted || source.name.name === name) continue;
        const reject = reason => refused.push({library: owner, id: variable.id, source: source.name.name, target: name, reason});
        // Nominal types, arrays and source-owned storage need their own proof.
        if (!(source.type.kind >= K.BoolKeyword && source.type.kind <= K.WavetargetKeyword) || source.type.kind === K.VoidKeyword ||
          variable.isArray || variable.variableType?.typeElement || variable.variableType?.type !== printer.printNode(source.type)) {
          reject('NONSCALAR_OR_GUI_TYPE_UNPROVED');continue;
        }
        try {assertExactAstShape(source.type, emitted.type, {ignoredFields});assert.deepEqual(source.modifiers?.map(m => m.kind) ?? [], emitted.modifiers?.map(m => m.kind) ?? []);}
        catch {reject('SOURCE_AND_EMITTED_TYPE_OR_MODIFIERS_CHANGED');continue;}
        const constant = source.modifiers?.some(m => m.kind === K.ConstKeyword) ?? false;
        if (!!variable.isConstant !== constant || source.modifiers?.some(m => m.kind !== K.ConstKeyword)) {reject('GUI_CONSTANT_OR_STORAGE_ROLE_CHANGED');continue;}
        let capture = false;
        walk(original, (node, parent) => {if (node.kind === K.Identifier && node.name === name && !(parent?.kind === K.PropertyAccessExpression && parent.name === node)) capture = true;});
        if (capture) {reject('TARGET_LEXICAL_CAPTURE');continue;}
        assert(!mapping.has(source) && !targets.has(name), 'GUI_GLOBAL_MULTIPLE_STORAGE_OWNERS');targets.add(name);mapping.set(source, name);
        records.push({library: owner, type: 'Variable', id: variable.id, source: source.name.name, target: name, declarationPosition: source.pos, constant});
      }
    }
    const names = new Set(records.flatMap(row => [row.source, row.target]));
    const mentions = value => [...names].some(name => value.split(/[^A-Za-z0-9_]+/u).includes(name));
    let observed = false;
    const strings = ast => walk(ast, node => {
      if (node.kind !== K.StringLiteral) return;
      const value = readStringLiteralValue(node.text);if (!value || mentions(value.value)) observed = true;
    });
    if (mapping.size) {
      strings(original);
      for (const file of externalSources) {
        assert.equal(typeof file.text, 'string');if (file.sha256 !== undefined) assert.equal(sha(file.text), file.sha256, 'GUI_GLOBAL_EXTERNAL_SHA');
        const ast = parse(file.text, file.fileName ?? 'external-global-observer');assert.equal(ast.parseDiagnostics.length, 0);strings(ast);
        walk(ast, node => {if (node.kind === K.Identifier && names.has(node.name)) observed = true;});
      }
    }
    assert(!observed, 'GUI_GLOBAL_EXTERNAL_OR_TEXTUAL_OBSERVER');
    const edits = [];
    walk(original, (node, parent) => {
      if (node.kind !== K.Identifier) return;
      const declaration = parent?.name === node && mapping.has(parent) ? parent : program.declarationAt(node);
      if (!mapping.has(declaration)) return;
      assert.equal(program.getBinding(node).status, 'BOUND', 'GUI_GLOBAL_REFERENCE_NOT_BOUND');
      assert.equal(before.slice(node.pos, node.end), declaration.name.name);
      edits.push({start: node.pos, end: node.end, before: declaration.name.name, replacement: mapping.get(declaration)});
    });
    edits.sort((a, b) => a.start - b.start);let delta = 0;
    for (let i = 0; i < edits.length; i++) {const edit = edits[i];if (i) assert(edits[i - 1].end <= edit.start);edit.newStart = edit.start + delta;delta += edit.replacement.length - edit.before.length;}
    let text = before;for (const edit of edits.toReversed()) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
    let inverse = text;for (const edit of edits.toReversed()) inverse = inverse.slice(0, edit.newStart) + edit.before + inverse.slice(edit.newStart + edit.replacement.length);
    assert.equal(inverse, before, 'GUI_GLOBAL_INVERSE_FAILED');assert.equal(parse(text, 'global-binding-view').parseDiagnostics.length, 0);
    return {before: text, after, proof: {kind: 'DECLARED_GUI_SCALAR_GLOBAL_BINDING_TRANSPORT', beforeSha256: sha(before), afterSha256: sha(after), viewBeforeSha256: sha(text),
      records, refused, edits, initializersAndRuntimeBodiesNotRemoved: true, onlyBoundIdentifierSpansChanged: true,
      externalAndTextualObserversRejected: true, sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false}};
  } finally {program.dispose();}
}
