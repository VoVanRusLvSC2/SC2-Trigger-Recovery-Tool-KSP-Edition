// Existing GUI may have a display name but no explicit, case-sensitive script
// stem. Repair only a source-qualified declaration; never rebuild its children.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SyntaxKind as K } from './index-alternate-3.js';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';
import { assertExactAstShape } from '../../verification/exact-ast-shape.mjs';
import { literalByteSyntaxShape } from './literal-byte-syntax-shape.mjs';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const identifier = /^[A-Za-z_][A-Za-z_0-9]*$/u;
function structures(text, label) {
  const ast = parseImmutableGalaxySyntax(text, label);
  assert.equal(ast.parseDiagnostics.length, 0, 'STRUCTURE_IDENTITY_SYNTAX');
  const declarations = ast.statements.filter((n) => n.kind === K.StructDeclaration);
  const byName = new Map(declarations.map((n) => [n.name.name, n]));
  assert.equal(byName.size, declarations.length, 'STRUCTURE_IDENTITY_DUPLICATE_SOURCE_TYPE');
  return byName;
}
function renameType(type, names) {
  if (!type || typeof type !== 'object') return;
  if (type.kind === K.Identifier && names.has(type.name)) type.name = names.get(type.name);
  // Array sizes are expressions, not type names. Never rename them or members.
  if (type.kind === K.ArrayType) renameType(type.elementType, names);
}
function declarationShape(node, names, syntaxShape) {
  const shape = literalByteSyntaxShape(node, syntaxShape);
  if (names.has(shape.name.name)) shape.name.name = names.get(shape.name.name);
  for (const member of shape.members ?? []) renameType(member.type, names);
  return shape;
}
export function reconcileAuthoredStructureIdentifiers({
  xml,
  source,
  generated,
  library,
  syntaxShape,
}) {
  const proof = {
    kind: 'SOURCE_QUALIFIED_AUTHORED_STRUCTURE_IDENTIFIERS',
    records: [],
    refused: [],
    sourceSha256: sha(source),
    generatedBeforeSha256: sha(generated),
    xmlBeforeSha256: sha(xml),
    newElementIds: 0,
    deletedElementIds: 0,
    treeRebuilt: false,
    wholeProgramEquivalenceProved: false,
  };
  const definitions = Object.values(library.elements ?? {}).filter((e) => e.type === 'Structure');
  // No additional parsing on documents that cannot contain this mismatch.
  const possible = definitions.filter(
    (e) =>
      e.identifier === undefined &&
      identifier.test(e.name ?? '') &&
      e.name[0] !== e.name[0].toUpperCase(),
  );
  if (!possible.length)
    return {
      xml,
      proof: { ...proof, xmlAfterSha256: sha(xml), allOtherXmlBytesExactByInverse: true },
    };
  const before = structures(generated, 'authored-structure-emission'),
    desired = structures(source, 'authored-structure-source');
  const prefix = (library.implicit ? '' : 'lib' + library.id + '_') + 'gs_',
    plans = [],
    names = new Map(),
    targets = new Set();
  for (const element of possible) {
    const stem = element.name,
      current = prefix + stem[0].toUpperCase() + stem.slice(1),
      target = prefix + stem;
    if (!before.has(current) || !desired.has(target)) continue;
    if (before.has(target) || desired.has(current) || names.has(current) || targets.has(target)) {
      proof.refused.push({
        library: library.id,
        id: element.id,
        reason: 'AMBIGUOUS_STRUCTURE_IDENTITY',
      });
      continue;
    }
    names.set(current, target);
    targets.add(target);
    plans.push({ element, current, target, stem });
  }
  // Qualify the entire mutually referenced group before committing any edit.
  // A renamed field, dimension, initializer, layout or unrelated type refuses it.
  for (const plan of plans)
    assertExactAstShape(
      declarationShape(before.get(plan.current), names, syntaxShape),
      declarationShape(desired.get(plan.target), new Map(), syntaxShape),
      { label: 'STRUCTURE_IDENTITY_LAYOUT_MISMATCH' },
    );
  const nodes = new Map();
  function visit(node, owner) {
    if (node.tag === 'Library') owner = node.attributes.Id;
    if (node.tag === 'Element' && node.attributes.Type === 'Structure') {
      const key = (owner ?? 'Map') + ':' + node.attributes.Id;
      assert(!nodes.has(key), 'STRUCTURE_IDENTITY_DUPLICATE_XML_ID');
      nodes.set(key, node);
    }
    for (const child of node.children) visit(child, owner);
  }
  visit(xmlTree(xml));
  const edits = [];
  for (const { element, current, target, stem } of plans) {
    const node = nodes.get(library.id + ':' + element.id);
    assert(node, 'STRUCTURE_IDENTITY_XML_OWNER_MISSING');
    assert(
      !node.children.some((n) => n.tag === 'Identifier'),
      'STRUCTURE_IDENTITY_EXPLICIT_XML_IDENTIFIER',
    );
    assert(node.closeStart > node.openEnd, 'STRUCTURE_IDENTITY_SELF_CLOSING_ELEMENT');
    const lineStart = xml.lastIndexOf('\n', node.start) + 1;
    const indent = /^[ \t]*/u.exec(xml.slice(lineStart, node.openEnd))[0];
    const newline = xml.includes('\r\n') ? '\r\n' : '\n';
    edits.push({
      at: node.openEnd,
      text: newline + indent + '    <Identifier>' + stem + '</Identifier>',
    });
    proof.records.push({
      library: library.id,
      id: element.id,
      sourceType: target,
      emittedBefore: current,
      identifier: stem,
      layoutAstExact: true,
    });
  }
  let result = '',
    cursor = 0;
  const inverse = [];
  for (const edit of edits.sort((a, b) => a.at - b.at)) {
    assert(edit.at >= cursor, 'STRUCTURE_IDENTITY_OVERLAPPING_EDIT');
    result += xml.slice(cursor, edit.at);
    inverse.push({ at: result.length, length: edit.text.length });
    result += edit.text;
    cursor = edit.at;
  }
  result += xml.slice(cursor);
  xmlTree(result);
  let restored = result;
  for (const edit of inverse.toReversed())
    restored = restored.slice(0, edit.at) + restored.slice(edit.at + edit.length);
  assert.equal(restored, xml, 'STRUCTURE_IDENTITY_INVERSE_NOT_EXACT');
  return {
    xml: result,
    proof: { ...proof, xmlAfterSha256: sha(result), allOtherXmlBytesExactByInverse: true },
  };
}
