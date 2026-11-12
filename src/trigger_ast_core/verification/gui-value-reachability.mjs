import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';

const transient = new Set(['FunctionCall', 'Param']);
const key = (owner, type, id) => JSON.stringify([owner, type, id]);
const sha = s => createHash('sha256').update(s).digest('hex');

function graph(xml, implicitOwner) {
  const root = xmlTree(xml);
  if (root.tag !== 'TriggerData') throw Error('GUI_TRIGGER_DATA_ROOT_REQUIRED');
  const standards = root.children.filter(n => n.tag === 'Standard');
  if (standards.length > 1) throw Error('GUI_IMPLICIT_LIBRARY_AMBIGUOUS');
  const scopes = [{owner: standards[0]?.attributes.Id ?? implicitOwner,
    nodes: root.children.filter(n => !['Library', 'Standard'].includes(n.tag))},
    ...root.children.filter(n => n.tag === 'Library').map(n => ({owner:n.attributes.Id, nodes:n.children}))];
  const definitions = new Map(), roots = [], owners = new Set();
  const references = (node, owner, out = []) => {
    if (node.tag === 'Library' || node.tag === 'Element') throw Error('GUI_NESTED_DEFINITION_UNSUPPORTED');
    const {Type:type, Id:id, Library:library} = node.attributes;
    if (type && id) out.push(key(library ?? owner, type, id));
    for (const child of node.children) references(child, owner, out);
    return out;
  };
  for (const {owner, nodes} of scopes) {
    if (!nodes.length) continue;
    if (!owner || owners.has(owner)) throw Error('GUI_LIBRARY_OWNER_DUPLICATED');
    owners.add(owner);
    for (const node of nodes) {
      if (node.tag !== 'Element') { roots.push(...references(node, owner)); continue; }
      const {Type:type, Id:id} = node.attributes;
      if (!type || !id) throw Error('GUI_TYPED_ELEMENT_IDENTITY_REQUIRED');
      const k = key(owner, type, id);
      if (definitions.has(k)) throw Error('GUI_TYPED_ELEMENT_DUPLICATED');
      const edges = node.children.flatMap(child => references(child, owner));
      definitions.set(k, {library:owner, type, id, edges,
        sourceSha256:sha(xml.slice(node.start, node.end))});
      // Definitions may have defaults and implementation values even when no
      // visible tree Item refers to them. This pass only checks transient values.
      if (!transient.has(type)) roots.push(k);
    }
  }
  const reachable = new Set(), pending = [...roots];
  for (let i = 0; i < pending.length; i++) {
    const k = pending[i];
    if (reachable.has(k)) continue;
    reachable.add(k);
    pending.push(...definitions.get(k)?.edges ?? []);
  }
  return {definitions, reachable};
}

/** Necessary, read-only gate: a new detached value is discarded by Editor.
 * Cycles do not provide a root. Identity is Library/Type/Id, never Id alone.
 * Byte-identical pre-existing orphans are reported separately, not deleted or
 * claimed to be valid. This neither validates ABI/types nor authorizes a PASS.
 */
export function auditGuiValueReachability({xml, existingXml='', implicitLibraryId='Map'}) {
  const after = graph(xml, implicitLibraryId);
  const before = existingXml.trim() ? graph(existingXml, implicitLibraryId) : undefined;
  const issues = [], preservedOrphans = [];
  let checked = 0;
  for (const [k, element] of after.definitions) {
    if (!transient.has(element.type)) continue;
    checked++;
    if (after.reachable.has(k)) continue;
    const {edges, ...record} = element;
    const original = before?.definitions.get(k);
    if (original && !before.reachable.has(k) && original.sourceSha256 === element.sourceSha256)
      preservedOrphans.push(record);
    else issues.push({...record, reason:'NEW_UNREACHABLE_GUI_VALUE'});
  }
  return {kind:'GUI_VALUE_REACHABILITY', passed:issues.length===0, checked,
    issues, preservedOrphans, sourceOrGuiChanged:false, persistentCache:false,
    newNative:0, newCustomScript:0, abiProved:false, wholeMapAccepted:false};
}
