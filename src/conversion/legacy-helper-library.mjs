import assert from 'node:assert/strict';
import { toGalaxyFunctionName } from './native-expression-identity/core-alternate.mjs';
import { readLocalizedOwnedGuiLibraries } from './implicit-gui-localization/localized-owned-libraries.mjs';
import { globalVariables } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { applyDisjointXmlPatches } from '../utilities/apply-disjoint-xml-patches.mjs';
import { SyntaxKind as K, forEachChild } from './exact-function-signatures/index-alternate-3.js';

const key = ({ Type, Id }) => Type + ':' + Id;
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const child = (node, tag) => node.children.find((item) => item.tag === tag);

/** A numeric embedded helper introduces an Editor-generated InitLib guard.
 * Fold it into the map only when its startup has no remaining effects after
 * native initialization, its declarations are local and its ABI is known. */
export async function foldLegacyHelperLibrary({
  xml,
  strings,
  source,
  parseXml,
  parseGalaxy,
  nativeSource,
}) {
  // Avoid parsing ordinary maps a further time.
  if (!/<Library Id="[1-9]\d{0,2}">/u.test(xml)) return;
  const tree = parseXml(xml);
  const only = tree.children.filter((node) => node.tag === 'Library');
  if (only.length !== 1) return;
  const owner = only[0];
  const id = owner.attributes.Id;
  if (!/^[1-9]\d{0,2}$/u.test(id)) return;
  const prefix = 'lib' + id + '_';
  const ast = parseGalaxy(source, 'MapScript.galaxy');
  if (ast.parseDiagnostics.length) return;
  const startupNames = new Set([
    prefix + 'InitLib',
    prefix + 'InitLib_completed',
    prefix + 'InitLibraries',
    prefix + 'InitCustomScript',
    'InitLibs',
  ]);
  const phasesInSource = ast.statements.filter((node) => startupNames.has(node.name?.name));
  if (phasesInSource.length !== startupNames.size) return;
  const compact = phasesInSource
    .map((node) => source.slice(node.pos, node.end))
    .join('\n')
    .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, '')
    .replace(/\s+/gu, '');
  const initializer =
    `bool ${prefix}InitLib_completed=false;void ${prefix}InitLib(){if(${prefix}InitLib_completed){return;}` +
    `${prefix}InitLib_completed=true;${prefix}InitLibraries();${prefix}InitCustomScript();}`;
  const phases = [
    initializer,
    `void ${prefix}InitLibraries(){libNtve_InitVariables();}`,
    `void ${prefix}InitCustomScript(){}`,
  ];
  if (!phases.every((text) => compact.includes(text.replaceAll(' ', '')))) return;
  const startup = /voidInitLibs\(\)\{([^{}]*)\}/u.exec(compact)?.[1];
  if (!startup?.startsWith('libNtve_InitLib();') || !startup.endsWith(prefix + 'InitLib();'))
    return;
  let foreignStartupUse = false;
  function checkReferences(node) {
    if (
      [K.Identifier, K.StringLiteral].includes(node.kind) &&
      (node.name ?? node.text)?.includes(prefix + 'Init')
    )
      foreignStartupUse = true;
    forEachChild(node, checkReferences);
  }
  for (const statement of ast.statements) {
    if (!phasesInSource.includes(statement)) checkReferences(statement);
  }
  if (foreignStartupUse) return;
  const native = parseGalaxy(nativeSource, 'NativeLib.galaxy');
  if (native.parseDiagnostics.length) return;
  const nativeBody = (name) => {
    const fn = native.statements.find(
      (node) => node.kind === K.FunctionDeclaration && node.name.name === name && node.body,
    );
    return fn && nativeSource.slice(fn.body.pos, fn.body.end).replace(/\s+/gu, '');
  };
  if (
    !nativeBody('libNtve_InitLib')?.includes('libNtve_InitVariables();') ||
    !nativeBody('libNtve_InitVariables')?.includes(
      'if(libNtve_InitVariables_completed){return;}libNtve_InitVariables_completed=true;',
    )
  )
    return;

  const libraries = await readLocalizedOwnedGuiLibraries(xml, strings);
  const library = libraries.get(id);
  const owned = owner.children.filter((node) => node.tag === 'Element');
  const libraryRoot = child(owner, 'Root'),
    root = child(tree, 'Root');
  if (
    !library ||
    !root ||
    !libraryRoot ||
    owner.children.some((node) => !['Root', 'Element'].includes(node.tag)) ||
    owned.some(
      (node) =>
        ![
          'Category',
          'CustomScript',
          'FunctionCall',
          'FunctionDef',
          'Param',
          'ParamDef',
          'Variable',
        ].includes(node.attributes.Type),
    ) ||
    globalVariables(library).length ||
    owned.some((node) => node.attributes.Type === 'CustomScript' && child(node, 'InitFunc'))
  )
    return;

  const taken = new Set(
    tree.children.filter((node) => node.tag === 'Element').map((node) => key(node.attributes)),
  );
  const original = new Map(owned.map((node) => [key(node.attributes), node]));
  assert.equal(original.size, owned.length, 'DUPLICATE_LEGACY_LIBRARY_ELEMENT');
  let next = 0xe1000000;
  const allocate = (type) => {
    let candidate;
    do candidate = (next++).toString(16).toUpperCase();
    while (taken.has(type + ':' + candidate) || original.has(type + ':' + candidate));
    taken.add(type + ':' + candidate);
    return candidate;
  };
  const folder = allocate('Category');
  const title = new RegExp(`^Library/Name/${id}=(.*)$`, 'm').exec(strings)?.[1]?.trim();
  if (!title) return;
  const folderIdentifier = title.replace(/[^A-Za-z0-9_]/gu, '');
  if (!folderIdentifier) return;
  const ids = new Map();
  for (const node of owned) {
    const { Type, Id } = node.attributes;
    const k = key(node.attributes);
    ids.set(k, taken.has(k) ? allocate(Type) : Id);
    taken.add(Type + ':' + ids.get(k));
  }

  const context = { library, libId: id, allLibraries: libraries, functionNameGroups: new Map() };
  const names = new Map();
  for (const def of Object.values(library.elementsByType.FunctionDef ?? {})) {
    if (def.flags?.includes('NoScriptPrefix') || def.flags?.includes('Operator')) continue;
    const name = toGalaxyFunctionName(def, context);
    if (!name?.startsWith(prefix + 'gf_') || !source.includes(name + ' (')) return;
    names.set(def.id, name);
  }

  function scan(node, inside, patches) {
    const a = node.attributes;
    if (a.Library === id || (inside && a.Type && a.Id && a.Library === undefined)) {
      const mapped = ids.get(key(a));
      assert(mapped, 'MISSING_LEGACY_LIBRARY_REFERENCE:' + key(a));
      const tag = xml
        .slice(node.start, node.openEnd)
        .replace(/\s+Library="[^"]*"/u, '')
        .replace(/\bId="[^"]*"/u, `Id="${mapped}"`);
      patches.push({ start: node.start, end: node.openEnd, text: tag });
    }
    const name = inside && node.tag === 'Element' && a.Type === 'FunctionDef' && names.get(a.Id);
    if (name) {
      const identifier = child(node, 'Identifier');
      if (identifier)
        patches.push({ start: identifier.openEnd, end: identifier.closeStart, text: name });
      else
        patches.push({
          start: node.openEnd,
          end: node.openEnd,
          text: '\n      <Identifier>' + name + '</Identifier>',
        });
      patches.push({
        start: node.closeStart,
        end: node.closeStart,
        text: '<FlagNoScriptPrefix/>\n    ',
      });
    }
    for (const c of node.children) scan(c, inside, patches);
  }
  const inside = [];
  for (const node of owner.children) scan(node, true, inside);
  const render = (start, end, edits) =>
    applyDisjointXmlPatches(
      xml.slice(start, end),
      edits
        .filter((edit) => edit.start >= start && edit.end <= end)
        .map((edit) => ({
          ...edit,
          start: edit.start - start,
          end: edit.end - start,
        })),
    );
  const moved = render(libraryRoot.end, owner.closeStart, inside);
  const folderItems = render(libraryRoot.openEnd, libraryRoot.closeStart, inside);
  const edits = [
    {
      start: root.closeStart,
      end: root.closeStart,
      text: `    <Item Type="Category" Id="${folder}"/>\n  `,
    },
    {
      start: owner.start,
      end: owner.end,
      text: `<Element Type="Category" Id="${folder}"><Identifier>${escape(folderIdentifier)}</Identifier>${folderItems}</Element>${moved}`,
    },
  ];
  for (const node of tree.children) {
    if (node !== owner) scan(node, false, edits);
  }
  const triggerXml = applyDisjointXmlPatches(xml, edits);
  parseXml(triggerXml);
  return {
    triggerXml,
    libraryId: id,
    moved: owned.length,
    preservedFunctions: [...names.values()],
    localized(text) {
      const lines = text.split(/\r?\n/u);
      const existing = new Set(lines.map((line) => line.split('=', 1)[0]));
      const added = [`Category/Name/${folder}=${title}`];
      for (const line of lines) {
        const match = /^([^/]+)\/([^/]+)\/lib_([^_]+)_([^=]+)=(.*)$/u.exec(line);
        if (!match || match[3] !== id) continue;
        const mapped = ids.get(match[1] + ':' + match[4]);
        if (!mapped) continue;
        const target = match[1] + '/' + match[2] + '/' + mapped;
        if (!existing.has(target)) {
          existing.add(target);
          added.push(target + '=' + match[5]);
        }
      }
      return text + (text.endsWith('\n') || !text ? '' : '\n') + added.join('\n') + '\n';
    },
  };
}
