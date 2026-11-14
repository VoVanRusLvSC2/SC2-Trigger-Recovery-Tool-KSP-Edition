import { applyDisjointXmlPatches } from '../../utilities/apply-disjoint-xml-patches.mjs';
/** Replace exact self-owned localized text ScriptCode with a GUI text value.
 * The parameter ID/key and every available locale value must remain identical.
 * Empty/missing values refuse: their compiler semantics can differ by ParamDef.
 * Dynamic keys, other-library keys and arbitrary code also remain untouched.
 */
import { xmlTree } from '../../sdk/local-identifier/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseOwnedTriggerDocument as parseTriggerXmlSync } from './trigger-document-scope.mjs';

export function recoverLocalizedTextGui({ triggerXml, localizedTables }) {
  const libraries = parseTriggerXmlSync(triggerXml),
    tree = xmlTree(triggerXml),
    changes = [],
    refused = [],
    patches = [];
  const tables = localizedTables
    .filter((t) => /^[a-z]{2}[A-Z]{2}$/u.test(t.locale) && t.locale.toLowerCase() !== 'base')
    .map((t) => {
      const values = new Map(),
        conflicts = new Set();
      for (const raw of (t.gameStrings ?? '').split(/\r?\n/u)) {
        const line = raw.replace(/^\uFEFF/u, '');
        const split = line.indexOf('=');
        if (split < 0) continue;
        const key = line.slice(0, split);
        if (values.has(key) && values.get(key) !== line.slice(split + 1)) conflicts.add(key);
        values.set(key, line.slice(split + 1));
      }
      return { ...t, values, conflicts };
    });
  const implicit = [...libraries.values()].find((l) => l.implicit)?.id;
  const walk = (n, parentOwner) => {
    const owner = n.tag === 'Library' ? n.attributes.Id : parentOwner;
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const library = owner;
      const lib = libraries.get(library),
        id = n.attributes.Id,
        param = lib?.elementsByType.Param?.[id];
      if (param?.scriptCode && param.valueType?.type === 'text') {
        const code = param.scriptCode.trim(),
          match = /^StringExternal\(\s*("(?:[^"\\]|\\.)*")\s*\)$/u.exec(code);
        if (match) {
          const key = JSON.parse(match[1]),
            expected = lib.implicit ? `Param/Value/${id}` : `Param/Value/lib_${library}_${id}`;
          const reason =
            key !== expected
              ? 'FOREIGN_OR_NONCANONICAL_KEY'
              : !tables.length
                ? 'NO_REAL_LOCALE_TABLES'
                : tables.some((t) => t.conflicts.has(key))
                  ? 'AMBIGUOUS_LOCALE_VALUE'
                  : tables.some((t) => !t.values.has(key) || t.values.get(key) === '')
                    ? 'EMPTY_OR_MISSING_LOCALE_VALUE'
                    : undefined;
          if (reason) refused.push({ library, id, key, reason });
          else {
            const block = n.children.filter((c) => c.tag === 'ScriptCode');
            if (block.length !== 1) throw Error('Ambiguous parameter ScriptCode');
            patches.push({ start: block[0].start, end: block[0].end });
            changes.push({
              library,
              id,
              key,
              rule: 'EXACT_SELF_OWNED_NONEMPTY_LOCALIZED_TEXT_GUI_VALUE',
              locales: tables.map((t) => t.locale),
            });
          }
        }
      }
    }
    for (const child of n.children) walk(child, owner);
  };
  walk(tree, implicit);
  let output = applyDisjointXmlPatches(triggerXml, patches);
  const parsed = parseTriggerXmlSync(output);
  for (const c of changes) {
    const p = parsed.get(c.library)?.elementsByType.Param?.[c.id];
    if (!p || p.scriptCode || p.valueType?.type !== 'text')
      throw Error('GUI text rewrite did not preserve typed parameter');
  }
  return { triggerXml: output, changes, refused };
}
