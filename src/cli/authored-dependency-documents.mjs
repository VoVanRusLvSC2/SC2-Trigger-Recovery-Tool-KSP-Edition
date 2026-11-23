import { createHash } from 'node:crypto';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { verifiedStockOwnersByXml } from './verified-blizzard-library-facts.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const fileStem = (file) =>
  file
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:galaxy|triggerlib|sc2lib)$/iu, '')
    .toLowerCase();

function xmlOwnerReferences(xml, ids) {
  const visit = (node) => {
    if (node.attributes.Library) ids.add(node.attributes.Library.toLowerCase());
    for (const child of node.children) visit(child);
  };
  visit(xmlTree(xml));
}

/** Project the GUI emitter's model inputs from the authenticated installed
 * closure. This lane is reserved for unchanged authored GUI with no owned
 * scripts or locale-ABI overlays. Package and catalog authority stay whole. */
export function selectAuthoredDependencyDocuments({
  libraries,
  authority,
  prepared,
  originalXml,
  script,
  declarations,
}) {
  if (prepared.actualMods?.length || !prepared.includeEvidence?.length) return;
  const pins = new Map(authority.files.map((p) => [p.sha256, p]));
  const rows = libraries.map((document) => {
    const digest = sha(document.triggerData);
    const pin = pins.get(digest);
    const owners = verifiedStockOwnersByXml.get(digest);
    return {
      document,
      pin,
      owner:
        pin?.path === document.sourcePath && owners?.length === 1 && pin.libraryId === owners[0]
          ? owners[0].toLowerCase()
          : undefined,
      stem: fileStem(document.sourcePath),
    };
  });
  if (!rows.some(({ owner }) => owner && owner !== 'ntve')) return;
  const needed = new Set(['ntve']);
  const requestedPaths = new Set(prepared.includeEvidence.map(({ path }) => fileStem(path)));
  // Dependency include resolution is already pinned. The Galaxy scan also
  // catches references to stock globals and handles when there is no aliasing
  // include named after their provider.
  for (const text of [script, ...declarations.map((d) => d.text)])
    for (const [, id] of text.matchAll(/\blib([a-z0-9]+)_/giu)) needed.add(id.toLowerCase());
  for (const { owner, stem } of rows)
    if (
      owner &&
      (requestedPaths.has(stem) ||
        requestedPaths.has(stem + '_h') ||
        requestedPaths.has('lib' + owner) ||
        requestedPaths.has('lib' + owner + '_h'))
    )
      needed.add(owner);
  xmlOwnerReferences(originalXml, needed);
  const selected = new Set();
  let priorSize;
  do {
    priorSize = selected.size;
    for (const row of rows) {
      if (selected.has(row) || (row.owner && !needed.has(row.owner))) continue;
      selected.add(row);
      // NativeLib has only self-references. A matching digest verifies that fact.
      if (row.owner !== 'ntve') xmlOwnerReferences(row.document.triggerData, needed);
    }
  } while (selected.size !== priorSize);
  if (selected.size === rows.length) return;
  return {
    documents: rows.filter((row) => selected.has(row)).map(({ document }) => document),
    omittedOwners: rows.filter((row) => !selected.has(row)).map(({ pin }) => pin.libraryId),
  };
}
