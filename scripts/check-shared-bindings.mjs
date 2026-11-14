/** Check named relative imports into the shared implementations, without running
 * the converter. This does not prove SDK state identity or runtime behavior. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

const root = new URL('../', import.meta.url);
const links = JSON.parse(await readFile(new URL('./shared-module-links.json', import.meta.url)));
const modules = new Map();
function declaredNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') return declaredNames(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return declaredNames(pattern.left);
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(declaredNames);
  if (pattern.type === 'ObjectPattern')
    return pattern.properties.flatMap((p) => declaredNames(p.value ?? p.argument));
  return [];
}
async function load(url) {
  if (modules.has(url.href)) return;
  assert(url.href.startsWith(root.href), 'Shared source escapes the repository');
  const entry = { names: new Set(), stars: [] };
  modules.set(url.href, entry);
  if (url.pathname.endsWith('.json')) {
    entry.names.add('default');
    return;
  }
  const tree = parse(await readFile(url, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  for (const node of tree.body) {
    if (node.type === 'ExportDefaultDeclaration') entry.names.add('default');
    if (node.type === 'ExportNamedDeclaration') {
      for (const item of node.specifiers)
        entry.names.add(item.exported.name ?? item.exported.value);
      const d = node.declaration;
      if (d?.id) entry.names.add(d.id.name);
      if (d?.declarations)
        for (const variable of d.declarations)
          for (const name of declaredNames(variable.id)) entry.names.add(name);
    }
    if (node.type === 'ExportAllDeclaration') {
      if (node.exported) entry.names.add(node.exported.name ?? node.exported.value);
      else {
        assert(
          node.source.value.startsWith('.'),
          'External star exports need runtime qualification',
        );
        const target = new URL(node.source.value, url);
        entry.stars.push(target.href);
        await load(target);
      }
    }
  }
}
for (const target of new Set(links.flatMap((row) => row.targets)))
  await load(new URL(target, root));
let expanded;
do {
  expanded = false;
  for (const entry of modules.values())
    for (const star of entry.stars)
      for (const name of modules.get(star).names)
        if (name !== 'default' && !entry.names.has(name)) {
          entry.names.add(name);
          expanded = true;
        }
} while (expanded);
let checked = 0;
for (const row of links) {
  const owner = new URL(row.file, root);
  const targets = new Set(row.targets.map((target) => new URL(target, root).href));
  const tree = parse(await readFile(owner, 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  for (const node of tree.body) {
    if (!node.source || !['ImportDeclaration', 'ExportNamedDeclaration'].includes(node.type))
      continue;
    const target = new URL(node.source.value, owner);
    if (!targets.has(target.href)) continue;
    for (const item of node.specifiers) {
      if (item.type === 'ImportNamespaceSpecifier') continue;
      const name =
        item.type === 'ImportDefaultSpecifier'
          ? 'default'
          : (item.imported?.name ?? item.imported?.value ?? item.local.name);
      assert(
        modules.get(target.href)?.names.has(name),
        `${row.file}: shared target does not export ${name}`,
      );
      checked++;
    }
  }
}
console.log(
  `Verified ${checked} named binding contracts in ${links.length} shared-module consumers.`,
);
console.log(
  'Computed imports, export ambiguity, cyclic initialization and SDK state require runtime qualification.',
);
