/** Replace one explicit library while retaining all other document bytes. */
import assert from 'node:assert/strict';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';

export function mergeLibrary(xml, generated, libraryId) {
  const source = xml || '<TriggerData/>',
    root = xmlTree(source),
    next = xmlTree(generated);
  assert(root.tag === 'TriggerData' && next.tag === 'TriggerData', 'Expected TriggerData');
  const matching = (tree) =>
    tree.children.filter((node) => node.tag === 'Library' && node.attributes.Id === libraryId);
  const old = matching(root),
    fresh = matching(next);
  assert(old.length <= 1 && fresh.length === 1, 'Ambiguous or missing library: ' + libraryId);
  const replacement = generated.slice(fresh[0].start, fresh[0].end);
  if (old.length) return source.slice(0, old[0].start) + replacement + source.slice(old[0].end);
  if (root.selfClosing)
    return (
      source.slice(0, root.start) +
      source.slice(root.start, root.openEnd).replace(/\/>$/, '>') +
      '\n' +
      replacement +
      '\n</TriggerData>' +
      source.slice(root.end)
    );
  return (
    source.slice(0, root.closeStart) + '\n' + replacement + '\n' + source.slice(root.closeStart)
  );
}

export function mergeStringTable(original, updates) {
  if (!updates || updates === original) return original;
  const table = (text) =>
    new Map(
      text
        .replace(/^\uFEFF/, '')
        .split(/\r\n|\r|\n/)
        .flatMap((line) => {
          const at = line.indexOf('=');
          return at < 0 ? [] : [[line.slice(0, at), line.slice(at + 1)]];
        }),
    );
  const previous = table(original),
    next = table(updates);
  if ([...next].every(([key, value]) => previous.get(key) === value)) return original;
  const lines = original.split(/\r\n|\r|\n/).map((line) => {
    const at = line.indexOf('='),
      key = line.slice(0, at);
    if (at < 0 || !next.has(key)) return line;
    const value = next.get(key);
    next.delete(key);
    return key + '=' + value;
  });
  return (
    lines.join('\n').replace(/\n*$/, '\n') +
    [...next].map(([key, value]) => key + '=' + value).join('\n') +
    (next.size ? '\n' : '')
  );
}

export function assertNoNewRawGui(before, after) {
  const records = (xml) => {
    const found = new Set();
    if (!xml.trim()) return found;
    function visit(node, owner = '') {
      if (node.tag === 'Library') owner = node.attributes.Id;
      if (
        node.tag === 'Element' &&
        (node.attributes.Type === 'CustomScript' ||
          node.children.some((child) => ['FlagNative', 'ScriptCode'].includes(child.tag)))
      )
        found.add([owner, node.attributes.Type, node.attributes.Id].join(':'));
      for (const child of node.children) visit(child, owner);
    }
    visit(xmlTree(xml));
    return found;
  };
  const original = records(before);
  for (const key of records(after))
    assert(original.has(key), 'New Native/Custom Script GUI is forbidden: ' + key);
}
