import assert from 'node:assert/strict';
import {
  withAuthoredStorageScope,
  currentAuthoredStorageScope,
} from '../../bindings/authored-storage-scope.mjs';
import { createAuthoredStorageIndex } from '../retained-nominal-storage/authored-storage-index.mjs';
import { authoredStorageBindingProof } from '../bound-static-primary-storage/bound-source-access.authored-alternate.mjs';
import {
  checkPreservedSourceValueInterface,
  checkPreservedSourceAggregateInterface,
} from './preserved-source-aggregate-contract.boolean-conditions.mjs';
import { sourceInlineRoleFlags } from '../../bindings/source-inline-role-flags.mjs';
import { parseTriggerXmlSync } from '../implicit-gui-localization/sax-reader-alternate-3.js';
const key = (e) => JSON.stringify([e.library, e.type, e.id]);
const signature = (e) =>
  JSON.stringify({
    flags: [...sourceInlineRoleFlags(e)].sort(),
    parameters: (e.parameters ?? []).map((r) => ({
      type: r.type ?? 'ParamDef',
      library: r.library ?? e.library,
      id: r.id,
    })),
    returnType: e.returnType?.type === 'void' ? undefined : e.returnType,
    scriptCode: e.scriptCode?.replace(/\r\n?/gu, '\n'),
    actions: e.actions?.length ? e.actions : undefined,
    localVariables: e.localVariables?.length ? e.localVariables : undefined,
    subFunctionTypes: e.subFunctionTypes?.length ? e.subFunctionTypes : undefined,
    isSubFunction: e.isSubFunction === true,
    disabled: e.disabled === true,
    expressionCode: e.expressionCode,
  });
export async function withAuthoredStorageInterfaces(input, sections, operation) {
  const context = {
    index: sections.length ? createAuthoredStorageIndex(input, sections) : undefined,
    records: new Map(),
    active: true,
  };
  return withAuthoredStorageScope(context, async () => {
    try {
      return await operation();
    } finally {
      context.active = false;
      context.index?.dispose();
    }
  });
}
function owned(binding) {
  const context = currentAuthoredStorageScope(),
    proof = authoredStorageBindingProof(binding);
  if (!context?.index || !proof) return;
  const found = context.index.resolveGlobal(binding.name);
  if (found.status !== 'UNIQUE_GLOBAL_VALUE') return;
  const root = found.declaration;
  // Virtual parser file names can differ, but the original global declaration
  // must have the same verified bytes/range/name and unique global binding.
  if (
    root.sourceSha256 !== proof.root.contentSha256 ||
    root.declarationStart !== proof.root.start ||
    root.declarationEnd !== proof.root.end ||
    root.name !== proof.root.name
  )
    return;
  return { context, root, proof };
}
export function resolveAuthoredSourceValue(binding) {
  const row = owned(binding);
  if (
    !row ||
    row.context.index.isStructType(row.root.elementType) ||
    row.root.rank !== binding.indices.length ||
    row.proof.elementType !== row.root.elementType
  )
    return;
  return row.root;
}
export function resolveAuthoredSourceAggregate(binding) {
  const row = owned(binding);
  if (!row) return;
  const result = row.context.index.resolveAccess(binding.name, binding.steps, binding.mode);
  if (result.status !== 'UNIQUE_SCALAR_ACCESS') return;
  const access = result.access;
  if (access.elementType !== row.proof.elementType) return;
  const fields = binding.steps.filter((s) => s.kind === 'member');
  if (fields.length !== access.members.length) return;
  for (let i = 0; i < fields.length; i++) {
    const actual = fields[i],
      expected = access.members[i];
    if (
      actual.name !== expected.name ||
      actual.struct !== expected.struct ||
      actual.contentSha256 !== expected.sourceSha256 ||
      actual.declarationStart !== expected.declarationStart ||
      actual.declarationEnd !== expected.declarationEnd
    )
      return;
  }
  return access;
}
export function registerAuthoredStorageInterfaces(elements, library, carrier) {
  const context = currentAuthoredStorageScope();
  if (!context?.index) return;
  for (const e of new Set(Object.values(elements))) {
    if (e.type !== 'FunctionDef' || typeof e.scriptCode !== 'string' || !e.scriptCode.trim())
      continue;
    const name = /^\s*([_A-Za-z]\w*)/u.exec(e.scriptCode)?.[1];
    if (!name || context.index.resolveGlobal(name).status !== 'UNIQUE_GLOBAL_VALUE') continue;
    const aggregate = e.scriptCode.includes('.') || e.isFuncAction || e.flags?.includes('Action');
    const proof = (
      aggregate ? checkPreservedSourceAggregateInterface : checkPreservedSourceValueInterface
    )(context.index, e, elements, library, carrier);
    context.records.set(key(e), { signature: signature(e), proof });
  }
}
export function isAuthoredStorageInterfaceElement(e) {
  const context = currentAuthoredStorageScope(),
    record = context?.records.get(key(e));
  return !!record && record.signature === signature(e);
}
export function isAuthoredStorageInterfaceXml(fragment, library) {
  const context = currentAuthoredStorageScope();
  if (!context?.records.size) return false;
  if (
    (fragment.match(/<ScriptCode(?:\s|>)/gu) ?? []).length !== 1 ||
    /<(?:ExpressionCode|FlagNative)(?:\s|>|\/)/u.test(fragment)
  )
    return false;
  try {
    const lib = parseTriggerXmlSync(
      `<TriggerData><Library Id="${library}">${fragment}</Library></TriggerData>`,
    ).get(library);
    return !!lib && Object.values(lib.elements).some(isAuthoredStorageInterfaceElement);
  } catch {
    return false;
  }
}
export function authoredStorageInterfaceProof() {
  const context = currentAuthoredStorageScope();
  assert(context, 'AUTHORED_STORAGE_SCOPE_REQUIRED');
  return {
    kind: 'ORIGINAL_AUTHORED_SCALAR_STORAGE_INTERFACES',
    records: [...context.records.values()].map((r) => r.proof),
    newNative: 0,
    newRuntimeFunctions: 0,
    sourceBodyChanged: false,
    semanticEquivalenceProved: false,
  };
}
