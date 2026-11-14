// Non-executing GUI dependency carriers. Runtime equivalence is accepted only
// after the actual Editor export and the complete unchanged program benchmark.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const has = (n, tag) => n.children.some((c) => c.tag === tag);
const safe = (s) => typeof s === 'string' && /^[A-Za-z0-9_]{1,64}$/u.test(s);

export function retainSourceLibraryCompilerDemand(
  xml,
  { plan, metadata, onlyUnreferencedLibraries = false },
) {
  assert(
    plan?.kind === 'ORIGINAL_COMPILER_LIBRARY_AUTOLOAD_DEMAND' && Array.isArray(plan.demands),
    'SOURCE_BOUND_LIBRARY_PLAN_REQUIRED',
  );
  assert(typeof xml === 'string' && xml.length <= 64 * 1024 ** 2, 'GUI_DEMAND_INPUT_BOUND');
  const tree = xmlTree(xml);
  assert.equal(tree.tag, 'TriggerData');
  const roots = tree.children.filter((n) => n.tag === 'Root');
  assert.equal(roots.length, 1, 'GUI_DEMAND_ROOT_UNIQUE');
  const root = roots[0];
  assert(!tree.selfClosing && !root.selfClosing, 'GUI_DEMAND_OPEN_ROOT_REQUIRED');
  const ids = new Set();
  for (const n of tree.children.filter((n) => n.tag === 'Element')) {
    const key = n.attributes.Type + '\0' + n.attributes.Id;
    assert(!ids.has(key), 'GUI_DEMAND_DUPLICATE_TYPED_ID');
    ids.add(key);
  }
  const alloc = (type, seed) => {
    for (let collision = 0; collision < 1000; collision++) {
      const id = sha(type + '\0' + seed + '\0' + collision)
          .slice(0, 8)
          .toUpperCase(),
        key = type + '\0' + id;
      if (!ids.has(key)) {
        ids.add(key);
        return id;
      }
    }
    throw Error('GUI_DEMAND_ID_ALLOCATION_BOUND');
  };
  const records = [],
    refused = [],
    insertions = [],
    items = [],
    retainedBindings = [];
  const referencedLibraries = new Set();
  const scan = (n) => {
    if (n.tag !== 'Element' && n.attributes.Library && n.attributes.Type && n.attributes.Id)
      referencedLibraries.add(n.attributes.Library);
    for (const c of n.children) scan(c);
  };
  scan(tree);
  const originalElements = tree.children.filter((n) => n.tag === 'Element');
  for (const demand of [...plan.demands].sort((a, b) => a.sourceOrder - b.sourceOrder)) {
    assert(
      safe(demand.id) &&
        typeof demand.initializer === 'string' &&
        plan.required[demand.sourceOrder] === demand.initializer,
      'GUI_DEMAND_SOURCE_ORDER_REQUIRED',
    );
    const file = metadata.find(
      (f) => f.fileName === demand.metadata.fileName && f.sha256 === demand.metadata.sha256,
    );
    assert(file && sha(file.text) === file.sha256, 'GUI_DEMAND_EXACT_METADATA_REQUIRED');
    const parsed = xmlTree(file.text);
    const scopes = [parsed, ...parsed.children.filter((n) => n.tag === 'Library')].filter(
      (n) =>
        n.attributes.Id === demand.id ||
        n.children.some((c) => c.tag === 'Standard' && c.attributes.Id === demand.id),
    );
    assert.equal(scopes.length, 1, 'GUI_DEMAND_METADATA_SCOPE_UNIQUE');
    const scope = scopes[0];
    if (onlyUnreferencedLibraries && referencedLibraries.has(demand.id)) {
      retainedBindings.push({
        library: demand.id,
        reason: 'EXISTING_TYPED_FOREIGN_GUI_REFERENCE',
        actualEditorExportRequired: true,
      });
      continue;
    }
    // A stock no-argument Action is used only as a compiler reference. Its body
    // is never emitted by this disabled trigger; never synthesize a FunctionDef.
    const candidates = scope.children.filter(
      (n) =>
        n.tag === 'Element' &&
        n.attributes.Type === 'FunctionDef' &&
        safe(n.attributes.Id) &&
        has(n, 'FlagAction') &&
        !has(n, 'FlagEvent') &&
        !has(n, 'Internal') &&
        !has(n, 'Disabled') &&
        !has(n, 'Parameter') &&
        (!n.children.find((c) => c.tag === 'ReturnType')?.children.find((c) => c.tag === 'Type') ||
          n.children.find((c) => c.tag === 'ReturnType').children.find((c) => c.tag === 'Type')
            .attributes.Value === 'void'),
    );
    const selected = candidates.sort((a, b) => a.attributes.Id.localeCompare(b.attributes.Id))[0];
    if (!selected) {
      refused.push({ library: demand.id, reason: 'NO_PUBLIC_PARAMETERLESS_STOCK_ACTION' });
      continue;
    }
    const identifier = 'SourceLibraryCompilerDemand_' + demand.id;
    const existing = originalElements.filter(
      (n) =>
        n.attributes.Type === 'Trigger' &&
        n.children.some(
          (c) => c.tag === 'Identifier' && xml.slice(c.openEnd, c.closeStart) === identifier,
        ),
    );
    assert(existing.length <= 1, 'GUI_DEMAND_CARRIER_NOT_UNIQUE');
    if (existing.length) {
      const trigger = existing[0],
        actions = trigger.children.filter((n) => n.tag === 'Action');
      assert(
        has(trigger, 'Disabled') &&
          actions.length === 1 &&
          actions[0].attributes.Type === 'FunctionCall',
        'GUI_DEMAND_EXISTING_CARRIER_CONFLICT',
      );
      const calls = originalElements.filter(
        (n) => n.attributes.Type === 'FunctionCall' && n.attributes.Id === actions[0].attributes.Id,
      );
      const defs =
        calls.length === 1 ? calls[0].children.filter((n) => n.tag === 'FunctionDef') : [];
      assert(
        calls.length === 1 &&
          !has(calls[0], 'Disabled') &&
          defs.length === 1 &&
          defs[0].attributes.Library === demand.id &&
          defs[0].attributes.Id === selected.attributes.Id,
        'GUI_DEMAND_EXISTING_BINDING_CONFLICT',
      );
      const refs = root.children.filter(
        (n) =>
          n.tag === 'Item' &&
          n.attributes.Type === 'Trigger' &&
          n.attributes.Id === trigger.attributes.Id,
      );
      assert.equal(refs.length, 1, 'GUI_DEMAND_EXISTING_ROOT_OWNERSHIP');
      records.push({
        library: demand.id,
        alreadyPresent: true,
        trigger: trigger.attributes.Id,
        functionDef: selected.attributes.Id,
      });
      continue;
    }
    const trigger = alloc('Trigger', identifier),
      call = alloc('FunctionCall', identifier);
    items.push(`\n    <Item Type="Trigger" Id="${trigger}"/>`);
    insertions.push(
      `\n  <Element Type="Trigger" Id="${trigger}"><Identifier>${identifier}</Identifier><Disabled/><Action Type="FunctionCall" Id="${call}"/></Element>\n  <Element Type="FunctionCall" Id="${call}"><FunctionDef Type="FunctionDef" Library="${demand.id}" Id="${selected.attributes.Id}"/></Element>`,
    );
    records.push({
      library: demand.id,
      initializer: demand.initializer,
      sourceOrder: demand.sourceOrder,
      trigger,
      call,
      functionDef: selected.attributes.Id,
      metadataSha256: file.sha256,
    });
  }
  const edits = [
    { at: root.closeStart, text: items.join('') },
    { at: tree.closeStart, text: insertions.join('') },
  ].filter((e) => e.text);
  let output = xml;
  for (const edit of [...edits].sort((a, b) => b.at - a.at))
    output = output.slice(0, edit.at) + edit.text + output.slice(edit.at);
  xmlTree(output);
  let restored = output,
    shift = 0;
  const inverse = [...edits]
    .sort((a, b) => a.at - b.at)
    .map((e) => {
      const r = { at: e.at + shift, text: e.text };
      shift += e.text.length;
      return r;
    });
  for (const edit of inverse.reverse()) {
    assert.equal(restored.slice(edit.at, edit.at + edit.text.length), edit.text);
    restored = restored.slice(0, edit.at) + restored.slice(edit.at + edit.text.length);
  }
  assert.equal(restored, xml, 'GUI_DEMAND_AUTHORED_BYTES_CHANGED');
  return {
    xml: output,
    proof: {
      kind: 'SOURCE_BOUND_NONEXECUTING_COMPILER_LIBRARY_DEMAND',
      records,
      refused,
      retainedBindings,
      beforeSha256: sha(xml),
      afterSha256: sha(output),
      allOtherBytesExactByInverse: true,
      newNative: 0,
      newCustomScript: 0,
      newFunctionDefs: 0,
      newRuntimeFunctionsExpected: 0,
      actualEditorExportRequired: true,
      wholeMapAccepted: false,
    },
  };
}
