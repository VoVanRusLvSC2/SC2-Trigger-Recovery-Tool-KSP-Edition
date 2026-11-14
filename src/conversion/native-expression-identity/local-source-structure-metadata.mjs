import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { boundStorageShape } from '../../model/bound-storage-shape.source-axes.mjs';
import { resolveBoundStructref } from '../../types/bound-type-alias.mjs';
import { createSourceProvidedNominalProxy } from '../../gui/source-provided-nominal-interfaces.mjs';
import { memberVarName } from './ttg-core.js';
import {
  SyntaxKind as K,
  forEachChild,
  tokenToString,
} from '../../sdk/array-values/modules/galaxy/language-core/index.js';
const sha = (s) => createHash('sha256').update(s).digest('hex'),
  ref = (e) => ({ library: e.library, type: e.type, id: e.id });
const root = (n) => {
  while (n?.parent) n = n.parent;
  return n;
};

/** Metadata for source-defined local value storage. Disabled Structure metadata
 * describes field identity but emits no second source type declaration. Root
 * declarations requiring that type before its include remain explicit blockers. */
export function attachLocalSourceStructureMetadata({
  program,
  statements,
  libraryId,
  elements,
  structuresByName,
  membersByKey,
  memberKey,
  allocate,
}) {
  const candidates = new Map(),
    records = [],
    refused = [];
  function nominal(type) {
    const s = boundStorageShape(program, type);
    return s.status === 'RESOLVED'
      ? (s.nominal ?? resolveBoundStructref(program, type).nominal)
      : undefined;
  }
  for (const fn of statements) {
    if (fn.kind !== K.FunctionDeclaration || !fn.body) continue;
    function visit(n) {
      if (n.kind === K.VariableDeclaration) {
        const shape = boundStorageShape(program, n.type),
          target = shape.status === 'RESOLVED' && shape.nominal;
        if (target && !structuresByName.has(target.name.name))
          candidates.set(target, {
            target,
            uses: [...(candidates.get(target)?.uses ?? []), program.location(n)],
          });
      }
      forEachChild(n, visit);
    }
    visit(fn.body);
  }
  for (const { target, uses } of candidates.values()) {
    const where = program.location(target),
      input = program.verifiedInputIdentity(where?.sourceFile),
      ast = program.documents.get(where?.sourceFile);
    // Unowned external declarations remain under their loaded library contracts.
    if (input?.owned !== true || !ast?.statements.includes(target) || statements.includes(target))
      continue;
    try {
      assert.equal(input.contentSha256, sha(ast.text), 'LOCAL_SOURCE_TYPE_REVISION');
      const headerUses = [];
      for (const n of statements) {
        const types =
          n.kind === K.StructDeclaration
            ? n.members.map((m) => m.type)
            : n.kind === K.VariableDeclaration
              ? [n.type]
              : n.kind === K.FunctionDeclaration
                ? [n.type, ...n.parameters.map((p) => p.type)]
                : [];
        for (const type of types)
          if (nominal(type) === target) headerUses.push(program.location(n));
      }
      assert.equal(headerUses.length, 0, 'LOCAL_SOURCE_TYPE_HEADER_SCHEDULE_REQUIRED');
      const occupied = new Set(
          Object.values(elements).map((e) => JSON.stringify([e.library, e.type, e.id])),
        ),
        issued = new Set();
      const fresh = (type, key) => {
        const id = allocate(type, key),
          k = JSON.stringify([libraryId, type, id]);
        assert(!occupied.has(k) && !issued.has(k), 'LOCAL_SOURCE_TYPE_ID_COLLISION');
        issued.add(k);
        return id;
      };
      const proxy = createSourceProvidedNominalProxy({
        program,
        source: { fileName: where.sourceFile, text: ast.text, sha256: input.contentSha256 },
        symbol: target.name.name,
        library: libraryId,
        allocate: fresh,
        existingIdentities: occupied,
      });
      const structure = { ...proxy.structure, variables: [] },
        fields = [];
      for (const field of target.members) {
        assert(
          field.kind === K.PropertyDeclaration && !field.modifiers?.length && !field.initializer,
          'LOCAL_SOURCE_TYPE_PLAIN_FIELD_REQUIRED',
        );
        const type = boundStorageShape(program, field.type);
        assert(
          type.status === 'RESOLVED' &&
            !type.rank &&
            !type.nominal &&
            type.node.kind >= K.BoolKeyword &&
            type.node.kind <= K.WavetargetKeyword &&
            type.node.kind !== K.VoidKeyword,
          'LOCAL_SOURCE_TYPE_SCALAR_FIELD_REQUIRED',
        );
        const variable = {
          library: libraryId,
          type: 'Variable',
          id: fresh('Variable', field.name.name),
          name: field.name.name,
          identifier: field.name.name,
          flags: ['NoScriptPrefix'],
          variableType: { type: tokenToString(type.node.kind) },
        };
        assert.equal(
          memberVarName(variable, libraryId),
          field.name.name,
          'LOCAL_SOURCE_TYPE_FIELD_SPELLING',
        );
        structure.variables.push(ref(variable));
        fields.push({ variable, source: program.location(field), aliases: type.aliases });
      }
      assert.equal(
        new Set(target.members.map((m) => m.name.name)).size,
        target.members.length,
        'LOCAL_SOURCE_TYPE_DUPLICATE_FIELD',
      );
      // Commit only after the complete source type and declaration schedule passed.
      elements[structure.id] = structure;
      structuresByName.set(target.name.name, ref(structure));
      for (const { variable, source } of fields) {
        elements[variable.id] = variable;
        membersByKey.set(memberKey(structure.id, variable.identifier, libraryId), ref(variable));
        membersByKey.set(memberKey(structure.id, variable.identifier), ref(variable));
      }
      records.push({
        kind: 'SOURCE_DEFINED_LOCAL_STRUCTURE_METADATA',
        source: where,
        sourceSha256: input.contentSha256,
        structure: ref(structure),
        symbol: target.name.name,
        disabled: true,
        fields: fields.map((f) => ({
          reference: ref(f.variable),
          source: f.source,
          type: f.variable.variableType,
          aliases: f.aliases,
        })),
        uses,
        rootDeclarationScheduleProved: true,
        sourceTypeBodyCopied: false,
        newRuntimeTypeDeclarations: 0,
        nativeQualification: 'NOT_RUN',
      });
    } catch (error) {
      refused.push({
        source: where,
        symbol: target.name.name,
        uses,
        reason: String(error.message).slice(0, 400),
      });
    }
  }
  return {
    kind: 'LOCAL_SOURCE_STRUCTURE_METADATA',
    records,
    refused,
    sourceFilesChanged: false,
    newNative: 0,
    newRuntimeFunctions: 0,
    wholeMapAccepted: false,
  };
}
