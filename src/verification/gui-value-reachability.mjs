import { createHash } from 'node:crypto';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';

const transient = new Set(['FunctionCall', 'Param']);
const key = (owner, type, id) => JSON.stringify([owner, type, id]);
const sha = (s) => createHash('sha256').update(s).digest('hex');

function graph(xml, implicitOwner) {
  const root = xmlTree(xml);
  if (root.tag !== 'TriggerData') throw Error('GUI_TRIGGER_DATA_ROOT_REQUIRED');
  const standards = root.children.filter((n) => n.tag === 'Standard');
  if (standards.length > 1) throw Error('GUI_IMPLICIT_LIBRARY_AMBIGUOUS');
  const scopes = [
    {
      owner: standards[0]?.attributes.Id ?? implicitOwner,
      nodes: root.children.filter((n) => !['Library', 'Standard'].includes(n.tag)),
    },
    ...root.children
      .filter((n) => n.tag === 'Library')
      .map((n) => ({ owner: n.attributes.Id, nodes: n.children })),
  ];
  const definitions = new Map(),
    pending = [],
    owners = new Set();
  const references = (node, owner, out) => {
    if (node.tag === 'Library' || node.tag === 'Element')
      throw Error('GUI_NESTED_DEFINITION_UNSUPPORTED');
    const { Type: type, Id: id, Library: library } = node.attributes;
    if (type && id) out.push(key(library ?? owner, type, id));
    for (const child of node.children) references(child, owner, out);
  };
  for (const { owner, nodes } of scopes) {
    if (!nodes.length) continue;
    if (!owner || owners.has(owner)) throw Error('GUI_LIBRARY_OWNER_DUPLICATED');
    owners.add(owner);
    for (const node of nodes) {
      if (node.tag !== 'Element') {
        references(node, owner, pending);
        continue;
      }
      const { Type: type, Id: id } = node.attributes;
      if (!type || !id) throw Error('GUI_TYPED_ELEMENT_IDENTITY_REQUIRED');
      const k = key(owner, type, id);
      if (definitions.has(k)) throw Error('GUI_TYPED_ELEMENT_DUPLICATED');
      const edges = node.children.length ? [] : undefined;
      for (const child of node.children) references(child, owner, edges);
      definitions.set(k, {
        library: owner,
        type,
        id,
        edges,
        start: node.start,
        end: node.end,
        reachable: false,
      });
      // Definitions may have defaults and implementation values even when no
      // visible tree Item refers to them. This pass only checks transient values.
      if (!transient.has(type)) pending.push(k);
    }
  }
  for (let i = 0; i < pending.length; i++) {
    const definition = definitions.get(pending[i]);
    if (!definition || definition.reachable) continue;
    definition.reachable = true;
    for (const edge of definition.edges ?? []) pending.push(edge);
  }
  return definitions;
}

/** Necessary, read-only gate: a new detached value is discarded by Editor.
 * Cycles do not provide a root. Identity is Library/Type/Id, never Id alone.
 * Byte-identical pre-existing orphans are reported separately, not deleted or
 * claimed to be valid. This neither validates ABI/types nor authorizes a PASS.
 */
export function auditGuiValueReachability({ xml, existingXml = '', implicitLibraryId = 'Map' }) {
  const after = graph(xml, implicitLibraryId);
  const before = existingXml.trim() ? graph(existingXml, implicitLibraryId) : undefined;
  const issues = [],
    preservedOrphans = [];
  let checked = 0;
  for (const [k, element] of after) {
    if (!transient.has(element.type)) continue;
    checked++;
    if (element.reachable) continue;
    const { library, type, id, start, end } = element;
    // Only detached values appear in evidence or require comparison with a
    // pre-existing detached definition. The reachability walk is unchanged.
    const sourceSha256 = sha(xml.slice(start, end));
    const record = { library, type, id, sourceSha256 };
    const original = before?.get(k);
    if (
      original &&
      !original.reachable &&
      sha(existingXml.slice(original.start, original.end)) === sourceSha256
    )
      preservedOrphans.push(record);
    else issues.push({ ...record, reason: 'NEW_UNREACHABLE_GUI_VALUE' });
  }
  return {
    kind: 'GUI_VALUE_REACHABILITY',
    passed: issues.length === 0,
    checked,
    issues,
    preservedOrphans,
    sourceOrGuiChanged: false,
    persistentCache: false,
    newNative: 0,
    newCustomScript: 0,
    abiProved: false,
    wholeMapAccepted: false,
  };
}
