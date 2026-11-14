// A GUI text literal may compile to StringExternal("") when its key is absent
// in the Editor's active locale. Keep the authored lookup as the actual loaded
// native GUI call if any supplied locale lacks a unique nonempty value.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  Parser,
  SyntaxKind as K,
  forEachChild,
} from '../exact-function-signatures/index-alternate-3.js';
import { parseOwnedTriggerDocument } from './trigger-document-scope.mjs';
import { xmlTree } from '../../sdk/local-identifier/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseLocalizedValueTable } from '../../libraries/gui/localized-value-retention.mjs';
import { applyDisjointXmlPatches } from '../../utilities';
import { recoverLocalizedExternalGui as original } from './localized-external-gui.mjs';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function recoverLocalizedExternalGui({
  triggerXml,
  localizedTables,
  nativeTriggerData,
  source,
}) {
  assert.equal(typeof source, 'string');
  const ast = new Parser().parseFile('localized-key-source.galaxy', source);
  assert.equal(ast.parseDiagnostics.length, 0, 'INVALID_LOCALIZED_KEY_SOURCE');
  const sourceKeys = new Set();
  const visit = (n) => {
    if (
      n.kind === K.CallExpression &&
      n.expression?.kind === K.Identifier &&
      n.expression.name === 'StringExternal' &&
      n.arguments?.length === 1 &&
      n.arguments[0].kind === K.StringLiteral
    )
      sourceKeys.add(n.arguments[0].value);
    forEachChild(n, visit);
  };
  visit(ast);
  const tables = localizedTables
    .filter((t) => /^[a-z]{2}[A-Z]{2}$/u.test(t.locale ?? ''))
    .map((t) => ({
      locale: t.locale,
      values: parseLocalizedValueTable(Buffer.from(t.gameStrings ?? '', 'utf8')).values,
    }));
  assert.equal(new Set(tables.map((t) => t.locale)).size, tables.length, 'DUPLICATE_REAL_LOCALE');
  const libs = parseOwnedTriggerDocument(triggerXml),
    tree = xmlTree(triggerXml),
    implicit = [...libs.values()].find((l) => l.implicit)?.id,
    patches = [],
    retained = [];
  const walk = (n, parent) => {
    const owner = n.tag === 'Library' ? n.attributes.Id : parent;
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const lib = libs.get(owner),
        id = n.attributes.Id,
        p = lib?.elementsByType.Param?.[id];
      const key = lib?.implicit ? `Param/Value/${id}` : `Param/Value/lib_${owner}_${id}`;
      const valueFields = [
        'scriptCode',
        'expressionCode',
        'functionCall',
        'variable',
        'paramRef',
        'preset',
        'valueElement',
        'valueId',
        'value',
        'array',
        'structMember',
        'localizedValue',
      ];
      if (
        p?.valueType?.type === 'text' &&
        sourceKeys.has(key) &&
        valueFields.every((k) => p[k] === undefined)
      ) {
        const missing = tables.filter((t) => {
          const v = t.values.get(key);
          return !v || v.length !== 1 || v.includes('');
        });
        if (!tables.length || missing.length) {
          assert(!n.selfClosing && Number.isInteger(n.closeStart), 'TEXT_PARAM_INSERTION_UNPROVEN');
          patches.push({
            start: n.closeStart,
            end: n.closeStart,
            text: `<ScriptCode>${escape('StringExternal(' + JSON.stringify(key) + ')')}</ScriptCode>`,
          });
          retained.push({
            library: owner,
            id,
            key,
            missingOrEmptyLocales: missing.map((t) => t.locale),
            authoredLiteralLookupVerified: true,
          });
        }
      }
    }
    for (const c of n.children) walk(c, owner);
  };
  walk(tree, implicit);
  const augmented = applyDisjointXmlPatches(triggerXml, patches),
    result = original({ triggerXml: augmented, localizedTables, nativeTriggerData });
  const parsed = parseOwnedTriggerDocument(result.triggerXml);
  for (const r of retained) {
    const p = parsed.get(r.library)?.elementsByType.Param?.[r.id];
    assert(
      p?.functionCall && !p.scriptCode && !p.expressionCode,
      'AUTHORED_EXTERNAL_KEY_REQUIRES_ACTUAL_LOADED_GUI_FUNCTION',
    );
  }
  return {
    ...result,
    keyRetentionProof: {
      kind: 'AUTHORED_EXTERNAL_KEYS_PRESERVED_ACROSS_PARTIAL_LOCALES',
      sourceSha256: sha(source),
      beforeSha256: sha(triggerXml),
      afterSha256: sha(result.triggerXml),
      retained,
      localesModified: false,
      newNativeDefinitions: 0,
      rawCodeRemainingForRetainedKeys: 0,
    },
  };
}
