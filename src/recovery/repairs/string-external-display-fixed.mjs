import { filterCaptionTables } from './caption-keys.mjs';
/** Add localized UI captions to pure StringExternal parameters.
 * Runtime ScriptCode is byte-preserved. Complex expressions are never evaluated.
 * Reads this map's actual tables; no localization cache persists between calls.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseGalaxySource } from '../../sdk/core/modules/triggers/services/galaxy-conversion/internal/galaxy-to-trigger.js';
import { attributeDisplayNames } from '../../utilities/attribute-display-text.mjs';
const require = createRequire(
  new URL(
    '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2/package.json',
    import.meta.url,
  ),
);
const { SyntaxKind: K } = await import(
  pathToFileURL(require.resolve('@modkit/blizzard-starcraft2/galaxy/language-core')).href
);
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, v) =>
    v[0] === '#'
      ? String.fromCodePoint(
          v[1].toLowerCase() === 'x' ? parseInt(v.slice(2), 16) : Number(v.slice(1)),
        )
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[v.toLowerCase()],
  );
const encode = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const unwrap = (n) => {
  while (n?.kind === K.ParenthesizedExpression) n = n.expression;
  return n;
};
export function literalExternalKey(code) {
  if (!code.includes('StringExternal')) return null;
  const ast = parseGalaxySource('text CaptionProbe(){return ' + code + ';}', 'caption.galaxy');
  if (ast.parseDiagnostics.length || ast.statements.length !== 1) return null;
  const body = ast.statements[0].body;
  if (!body || body.statements.length !== 1 || body.statements[0].kind !== K.ReturnStatement)
    return null;
  const call = unwrap(body.statements[0].expression),
    callee = unwrap(call?.expression),
    arg = unwrap(call?.arguments?.[0]);
  return call?.kind === K.CallExpression &&
    callee?.kind === K.Identifier &&
    callee.name === 'StringExternal' &&
    call.arguments.length === 1 &&
    arg?.kind === K.StringLiteral
    ? arg.value
    : null;
}
export function restoreExternalDisplayText({
  triggerXml,
  localizedStrings,
  preferredLocale = 'enUS',
  parseXml,
}) {
  const needed = new Set();
  function collect(n) {
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const scripts = n.children.filter((c) => c.tag === 'ScriptCode'),
        types = n.children.filter((c) => c.tag === 'ValueType');
      if (
        scripts.length === 1 &&
        types.length === 1 &&
        types[0].attributes.Type === 'text' &&
        !scripts[0].selfClosing
      ) {
        const script = scripts[0],
          key = literalExternalKey(
            decode(triggerXml.slice(script.openEnd, script.closeStart).trim()),
          );
        if (key !== null) needed.add(key);
      }
    }
    for (const child of n.children) collect(child);
  }
  collect(parseXml(triggerXml));
  const names = attributeDisplayNames(
      filterCaptionTables(localizedStrings, needed),
      preferredLocale,
    ),
    changes = [],
    unresolved = [],
    edits = [];
  function visit(n) {
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const scripts = n.children.filter((c) => c.tag === 'ScriptCode'),
        types = n.children.filter((c) => c.tag === 'ValueType');
      if (
        scripts.length === 1 &&
        types.length === 1 &&
        types[0].attributes.Type === 'text' &&
        !scripts[0].selfClosing
      ) {
        const s = scripts[0],
          key = literalExternalKey(decode(triggerXml.slice(s.openEnd, s.closeStart).trim()));
        if (key !== null) {
          const label = names.get(key),
            displays = n.children.filter((c) => c.tag === 'DisplayText');
          if (displays.length > 1) throw Error('Ambiguous DisplayText for ' + n.attributes.Id);
          if (!label || !label.text)
            unresolved.push({
              paramId: n.attributes.Id,
              key,
              reason: 'No nonempty localized value',
            });
          else {
            if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(label.text))
              throw Error('Invalid XML character for ' + key);
            const d = displays[0],
              old = d && !d.selfClosing ? decode(triggerXml.slice(d.openEnd, d.closeStart)) : null;
            if (old !== label.text) {
              const text = '<DisplayText>' + encode(label.text) + '</DisplayText>';
              if (d) edits.push({ start: d.start, end: d.end, text });
              else {
                const t = types[0],
                  indent = triggerXml
                    .slice(triggerXml.lastIndexOf('\n', t.start) + 1, t.start)
                    .match(/^\s*/)[0];
                edits.push({
                  start: t.end,
                  end: t.end,
                  text: (triggerXml.includes('\r\n') ? '\r\n' : '\n') + indent + text,
                });
              }
              changes.push({
                paramId: n.attributes.Id,
                key,
                displayText: label.text,
                localizationPath: label.path,
                previousDisplayText: old,
              });
            }
          }
        }
      }
    }
    for (const child of n.children) visit(child);
  }
  visit(parseXml(triggerXml));
  let cursor = triggerXml.length;
  const parts = [];
  // Prototype: retain the exact descending edit order, copy each source span once.
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    if (e.end > cursor) throw Error('Overlapping caption edits');
    parts.push(triggerXml.slice(e.end, cursor), e.text);
    cursor = e.start;
  }
  parts.push(triggerXml.slice(0, cursor));
  const result = parts.reverse().join('');
  parseXml(result);
  return { triggerXml: result, changes, unresolved, preferredLocale, scriptCodeUnchanged: true };
}
