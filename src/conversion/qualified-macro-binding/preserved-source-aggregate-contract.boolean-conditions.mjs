import { sourceInlineRoleFlags } from '../../bindings/source-inline-role-flags.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGalaxyDocument } from '../exact-function-signatures/galaxy-document.collections.mjs';
import { logicalSourcePath } from '../../model/source-ownership.mjs';
import { indexPreservedSourceFunctions as baseIndex } from './preserved-source-member-contract.boolean-conditions.mjs';
import { SyntaxKind as K, Printer } from '../exact-function-signatures/index-alternate-3.js';
import { checkPreservedSourceValueInterface as baseValueCheck } from './preserved-source-member-contract.boolean-conditions.mjs';
export { checkPreservedSourceFunctionInterface } from './preserved-source-member-contract.boolean-conditions.mjs';
const printer = new Printer(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const typeOf = (node) => {
  const dimensions = [];
  while (node?.kind === K.ArrayType) {
    dimensions.push(printer.printNode(node.size));
    node = node.elementType;
  }
  return { elementType: printer.printNode(node), dimensions };
};
const identifier = '[A-Za-z_]\\w*';
export function indexPreservedSourceFunctions(input) {
  const base = baseIndex(input),
    reachable = new Map(
      base.closure.resolvedFiles.map((f) => [logicalSourcePath(f.path), f.sha256]),
    );
  const structures = new Map(),
    globals = new Map(),
    outside = new Set();
  const scan = (file, owned) => {
    const owner = logicalSourcePath(file.originalPath ?? file.fileName),
      digest = sha(file.text);
    if (owner !== logicalSourcePath(input.root.fileName) && !reachable.has(owner)) return;
    if (reachable.has(owner))
      assert.equal(reachable.get(owner), digest, 'SOURCE_AGGREGATE_OWNER_SHA');
    const doc = createGalaxyDocument(file);
    const record = (node) => ({
      owner,
      sourceSha256: digest,
      declarationSha256: sha(file.text.slice(node.pos, node.end)),
      declarationStart: node.pos,
      declarationEnd: node.end,
    });
    try {
      for (const node of doc.ast.statements) {
        if (node.kind === K.StructDeclaration) {
          if (!owned) {
            outside.add(node.name.name);
            continue;
          }
          const fields = node.members.map((field) => ({
            name: field.name.name,
            ...record(field),
            ...typeOf(field.type),
            constant: !!field.modifiers?.some((m) => m.kind === K.ConstKeyword),
          }));
          const row = {
            name: node.name.name,
            ...record(node),
            fields,
            valid:
              node.members.every((f) => f.kind === K.PropertyDeclaration) &&
              new Set(fields.map((f) => f.name)).size === fields.length,
          };
          const list = structures.get(row.name) ?? [];
          list.push(row);
          structures.set(row.name, list);
        }
        if (owned && node.kind === K.VariableDeclaration) {
          const row = {
            name: node.name.name,
            ...record(node),
            ...typeOf(node.type),
            constant: !!node.modifiers?.some((m) => m.kind === K.ConstKeyword),
            static: !!node.modifiers?.some((m) => m.kind === K.StaticKeyword),
          };
          const list = globals.get(row.name) ?? [];
          list.push(row);
          globals.set(row.name, list);
        }
      }
    } finally {
      doc.dispose();
    }
  };
  scan(input.root, false);
  for (const file of input.externalSources ?? []) scan(file, false);
  for (const file of input.ownedSources ?? []) scan(file, true);
  return Object.freeze({
    ...base,
    isStructType: (name) => structures.has(name) || outside.has(name),
    resolveAccess(name, steps, mode = 'read') {
      const refused = (reason) => ({ status: 'UNSUPPORTED_SOURCE_ACCESS', reason });
      const global = base.resolveGlobal(name),
        matches = globals.get(name) ?? [];
      if (global.status !== 'UNIQUE_GLOBAL_VALUE' || matches.length !== 1)
        return refused('GLOBAL_NOT_UNIQUE');
      const root = matches[0];
      if (root.static || (mode === 'write' && root.constant) || !['read', 'write'].includes(mode))
        return refused('GLOBAL_ROLE');
      let type = { elementType: root.elementType, dimensions: [...root.dimensions] },
        index = 0;
      const members = [];
      if (
        !Array.isArray(steps) ||
        steps.length > 32 ||
        (mode !== 'write' && !steps.some((s) => s.kind === 'member'))
      )
        return refused('MEMBER_PATH_REQUIRED');
      for (const step of steps) {
        if (step.kind === 'index') {
          if (!type.dimensions.length || step.index !== index++) return refused('ARRAY_AXIS');
          type = { ...type, dimensions: type.dimensions.slice(1) };
        } else if (step.kind === 'member') {
          const candidates = structures.get(type.elementType) ?? [];
          if (
            type.dimensions.length ||
            outside.has(type.elementType) ||
            candidates.length !== 1 ||
            !candidates[0].valid
          )
            return refused('STRUCT_NOT_UNIQUE_OR_NOT_INDEXED');
          const fields = candidates[0].fields.filter((f) => f.name === step.name);
          if (fields.length !== 1 || (mode === 'write' && fields[0].constant))
            return refused('FIELD_NOT_UNIQUE_OR_READONLY');
          const field = fields[0];
          members.push({
            ...field,
            struct: candidates[0].name,
            structDeclarationSha256: candidates[0].declarationSha256,
          });
          type = { elementType: field.elementType, dimensions: [...field.dimensions] };
        } else return refused('UNKNOWN_ACCESS_STEP');
      }
      if (
        type.dimensions.length ||
        structures.has(type.elementType) ||
        outside.has(type.elementType) ||
        !new RegExp('^' + identifier + '$', 'u').test(type.elementType) ||
        type.elementType === 'void'
      )
        return refused('COMPLETE_SCALAR_REQUIRED');
      return {
        status: 'UNIQUE_SCALAR_ACCESS',
        access: {
          root,
          members,
          steps: steps.map((s) =>
            s.kind === 'index'
              ? { kind: 'index', index: s.index }
              : { kind: 'member', name: s.name },
          ),
          elementType: type.elementType,
          indexCount: index,
          mode,
        },
      };
    },
  });
}

export function parseSourceAggregateTemplate(code) {
  assert(typeof code === 'string' && code.length <= 4096, 'SOURCE_AGGREGATE_TEMPLATE_BOUND');
  let text = code.replace(/\s+/gu, ''),
    operator,
    valueName;
  const assignment = text.match(
    new RegExp('^(.*?)([+\\-*/%]?=)#PARAM\\((' + identifier + ')\\);$', 'u'),
  );
  if (assignment) {
    [, text, operator, valueName] = assignment;
  }
  const root = text.match(new RegExp('^(' + identifier + ')', 'u'));
  assert(root, 'SOURCE_AGGREGATE_TEMPLATE_ROOT');
  let rest = text.slice(root[0].length),
    axis = 0;
  const steps = [],
    indexNames = [];
  while (rest) {
    assert(steps.length < 32, 'SOURCE_AGGREGATE_PATH_BOUND');
    const member = rest.match(new RegExp('^\\.(' + identifier + ')', 'u'));
    if (member) {
      steps.push({ kind: 'member', name: member[1] });
      rest = rest.slice(member[0].length);
      continue;
    }
    const index = rest.match(new RegExp('^\\[#PARAM\\((' + identifier + ')\\)\\]', 'u'));
    assert(index, 'SOURCE_AGGREGATE_TEMPLATE_SYNTAX');
    indexNames.push(index[1]);
    steps.push({ kind: 'index', index: axis++ });
    rest = rest.slice(index[0].length);
  }
  assert(operator || steps.some((s) => s.kind === 'member'), 'SOURCE_AGGREGATE_MEMBER_REQUIRED');
  return {
    name: root[1],
    steps,
    indexNames,
    operator,
    valueName,
    mode: operator ? 'write' : 'read',
  };
}

export function sourceAggregateScript(access, indexNames, valueName, operator = '=') {
  let script = access.root.name;
  for (const step of access.steps)
    script += step.kind === 'member' ? '.' + step.name : `[#PARAM(${indexNames[step.index]})]`;
  return access.mode === 'write' ? script + ' ' + operator + ' #PARAM(' + valueName + ');' : script;
}

export function checkPreservedSourceAggregateInterface(
  index,
  definition,
  elements,
  library,
  carrier = (t) => t?.type,
) {
  const template = parseSourceAggregateTemplate(definition.scriptCode),
    write = template.mode === 'write';
  const flags = sourceInlineRoleFlags(definition),
    role = write ? 'Action' : 'Call';
  assert(
    definition.type === 'FunctionDef' &&
      definition.library === library &&
      flags.has('Operator') &&
      flags.has(role) &&
      !flags.has(write ? 'Call' : 'Action') &&
      [...flags].every((f) => ['Operator', role, 'NoScriptPrefix'].includes(f)),
    'SOURCE_AGGREGATE_INTERFACE_ROLE',
  );
  assert(
    !definition.actions?.length &&
      !definition.localVariables?.length &&
      !definition.subFunctionTypes?.length &&
      !definition.isSubFunction &&
      !definition.disabled &&
      definition.expressionCode === undefined,
    'SOURCE_AGGREGATE_INTERFACE_BODY',
  );
  const parameters = (definition.parameters ?? []).map((ref) => {
    assert(
      ref.type === 'ParamDef' && (ref.library ?? library) === library,
      'SOURCE_AGGREGATE_FORMAL_OWNER',
    );
    const found = [...new Set([elements[ref.id], elements['ParamDef:' + ref.id]].filter(Boolean))];
    assert.equal(found.length, 1, 'SOURCE_AGGREGATE_FORMAL_UNIQUE');
    const p = found[0];
    assert(
      p.type === 'ParamDef' &&
        p.id === ref.id &&
        p.library === library &&
        !p.isReference &&
        new RegExp('^' + identifier + '$', 'u').test(p.name),
      'SOURCE_AGGREGATE_FORMAL_IDENTITY',
    );
    return p;
  });
  assert.equal(
    new Set(parameters.map((p) => p.name)).size,
    parameters.length,
    'SOURCE_AGGREGATE_FORMAL_COLLISION',
  );
  assert.equal(
    parameters.length,
    template.indexNames.length + Number(write),
    'SOURCE_AGGREGATE_FORMAL_ARITY',
  );
  const indices = parameters.slice(0, template.indexNames.length);
  assert.deepEqual(
    indices.map((p) => p.name),
    template.indexNames,
    'SOURCE_AGGREGATE_INDEX_ORDER',
  );
  assert(
    indices.every((p) => carrier(p.paramType, library) === 'int'),
    'SOURCE_AGGREGATE_INDEX_ABI',
  );
  const resolved = index.resolveAccess(template.name, template.steps, template.mode);
  assert.equal(resolved.status, 'UNIQUE_SCALAR_ACCESS', resolved.reason);
  const access = resolved.access;
  if (write) {
    const value = parameters.at(-1);
    assert.equal(value.name, template.valueName, 'SOURCE_AGGREGATE_VALUE_FORMAL');
    assert.equal(
      carrier(value.paramType, library),
      access.elementType,
      'SOURCE_AGGREGATE_WRITE_ABI',
    );
    assert.equal(definition.returnType?.type ?? 'void', 'void', 'SOURCE_AGGREGATE_WRITE_RESULT');
    if (template.operator !== '=')
      assert(
        ['int', 'byte', 'fixed', 'string'].includes(access.elementType) &&
          (access.elementType !== 'string' || template.operator === '+=') &&
          (access.elementType !== 'fixed' || template.operator !== '%='),
        'SOURCE_AGGREGATE_COMPOUND_TYPE',
      );
  } else
    assert.equal(
      carrier(definition.returnType, library),
      access.elementType,
      'SOURCE_AGGREGATE_READ_ABI',
    );
  assert.equal(
    definition.scriptCode.replace(/\s+/gu, ''),
    sourceAggregateScript(
      access,
      indices.map((p) => p.name),
      write ? parameters.at(-1).name : undefined,
      template.operator,
    ).replace(/\s+/gu, ''),
    'SOURCE_AGGREGATE_EXACT_TEMPLATE',
  );
  return {
    kind: 'CLOSED_PRESERVED_SOURCE_AGGREGATE_INTERFACE',
    ...access,
    operator: template.operator,
    interface: { library, type: definition.type, id: definition.id },
    newRuntimeFunction: false,
    newNative: false,
    guiBindingAuthorized: false,
    semanticEquivalenceProved: false,
    accepted: false,
  };
}

export function checkPreservedSourceValueInterface(index, ...args) {
  const proof = baseValueCheck(index, ...args);
  assert(!index.isStructType(proof.elementType), 'WHOLE_SOURCE_STRUCT_IS_NOT_SCALAR');
  return proof;
}
