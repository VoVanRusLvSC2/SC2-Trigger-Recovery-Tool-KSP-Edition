import { createHash } from 'node:crypto';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha = (s) => createHash('sha256').update(s).digest('hex');

// The SDK accepts inline ScriptCode text which the native Editor can discard.
// Qualify the standard writer's text-block layout. Other layouts require native
// evidence; they are not silently repaired or treated as executable code.
/**
 * Classify serialized CustomScript text without rewriting it.
 * XML accepted by the SDK can still be discarded by the Editor, so an unknown
 * text-block layout requires native evidence rather than an optimistic pass.
 */
export function auditNativeCustomScriptLayout(xml, implicitLibrary = 'Map') {
  const root = xmlTree(xml);
  if (root.tag !== 'TriggerData') throw Error('NATIVE_CODE_LAYOUT_TRIGGER_ROOT_REQUIRED');
  const standard = root.children.filter((n) => n.tag === 'Standard');
  if (standard.length > 1) throw Error('NATIVE_CODE_LAYOUT_OWNER_AMBIGUOUS');
  const owner = standard[0]?.attributes.Id ?? implicitLibrary,
    records = [],
    issues = [];
  function visit(node, library) {
    if (node.tag === 'Library') library = node.attributes.Id;
    if (node.tag === 'Element' && node.attributes.Type === 'CustomScript') {
      const fields = node.children.filter((n) => n.tag === 'ScriptCode'),
        reference = { library, type: 'CustomScript', id: node.attributes.Id };
      if (fields.length > 1) {
        issues.push({ ...reference, reason: 'MULTIPLE_SCRIPT_CODE_FIELDS' });
        return;
      }
      if (!fields.length) {
        records.push({
          ...reference,
          layout: 'NO_CODE_FIELD',
          initializationMetadataNotValidated: true,
        });
        return;
      }
      const field = fields[0],
        raw = xml.slice(field.openEnd, field.closeStart),
        lines = raw.split(/\r\n?|\n/u);
      const record = {
        ...reference,
        start: field.start,
        end: field.end,
        rawSha256: sha(raw),
        rawBytes: Buffer.byteLength(raw),
      };
      if (!raw.trim()) {
        records.push({ ...record, layout: 'EMPTY_CODE' });
        return;
      }
      const indent = lines.at(-1) + '    ';
      const qualified =
        lines.length >= 3 &&
        !lines[0].trim() &&
        !lines.at(-1).trim() &&
        lines.slice(1, -1).every((line) => !line.trim() || line.startsWith(indent));
      records.push({
        ...record,
        layout: qualified ? 'CANONICAL_EDITOR_TEXT_BLOCK' : 'UNQUALIFIED_CODE_LAYOUT',
      });
      if (!qualified)
        issues.push({
          ...reference,
          start: field.start,
          reason: 'CUSTOM_SCRIPT_TEXT_BLOCK_REQUIRES_NATIVE_EVIDENCE',
        });
      return;
    }
    for (const child of node.children) visit(child, library);
  }
  visit(root, owner);
  return {
    kind: 'NATIVE_CUSTOM_SCRIPT_TEXT_LAYOUT_AUDIT',
    xmlSha256: sha(xml),
    records,
    issues,
    allCustomScriptLayoutsQualified: issues.length === 0,
    requiresNativeEvidence: issues.length > 0,
    scope:
      'CustomScript.ScriptCode only; FunctionDef templates and InitFunc execution order are separate contracts.',
    sourceOrGuiChanged: false,
    semanticEquivalenceProved: false,
    actualEditor: false,
    wholeMapAccepted: false,
  };
}
