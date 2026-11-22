import { indexGuiXmlElements } from '../utilities/index-gui-xml-elements.mjs';
import { recoveryTextSha256 as sha } from '../utilities/recovery-parse-scope.mjs';
import assert from 'node:assert/strict';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
const child = (node, tag) => node.children.find((n) => n.tag === tag);
const groups = (root) => [root, ...root.children.filter((n) => n.tag === 'Library')];
const owner = (node, fallback) =>
  node.attributes.Id ?? child(node, 'Standard')?.attributes.Id ?? fallback;

/** The native editor emits named integer constants for integer presets.
 * A custom preset with GenConstVar is not an equivalent encoding. Upgrade
 * newly generated, exact zero-based ordinal domains only; retain authored GUI. */
export function normalizeGeneratedIntegerConstantPresets({
  xml,
  existingXml = '',
  implicitLibraryId = 'Map',
}) {
  const root = xmlTree(xml),
    prior = new Set(),
    edits = [],
    records = [];
  if (existingXml)
    for (const group of groups(xmlTree(existingXml)))
      for (const node of group.children)
        if (node.tag === 'Element' && node.attributes.Type === 'Preset')
          prior.add(JSON.stringify([owner(group, implicitLibraryId), node.attributes.Id]));
  for (const group of groups(root)) {
    const library = owner(group, implicitLibraryId);
    const { byType, duplicate } = indexGuiXmlElements(group);
    assert(!duplicate, 'INTEGER_PRESET_DUPLICATE_TYPED_ID');
    const definitions = byType.get('PresetValue');
    for (const preset of byType.get('Preset')?.values() ?? []) {
      if (prior.has(JSON.stringify([library, preset.attributes.Id]))) continue;
      const custom = child(preset, 'PresetCustom');
      if (
        !custom ||
        !child(preset, 'PresetGenConstVar') ||
        child(preset, 'PresetInteger') ||
        child(preset, 'PresetAsBits') ||
        child(preset, 'PresetGenIdentFunc') ||
        child(preset, 'PresetExtends') ||
        child(preset, 'BaseType')?.attributes.Value !== 'int'
      )
        continue;
      const items = preset.children.filter((n) => n.tag === 'Item');
      if (!items.length) continue;
      const values = items.map((item) => {
        if (
          item.attributes.Type !== 'PresetValue' ||
          (item.attributes.Library ?? library) !== library
        )
          return null;
        const node = definitions?.get(item.attributes.Id),
          value = node && child(node, 'Value');
        if (!value || value.children.length || child(node, 'ScriptCode')) return null;
        return { id: item.attributes.Id, token: xml.slice(value.openEnd, value.closeStart) };
      });
      if (values.some((value, index) => value?.token !== String(index))) continue;
      assert(
        custom.selfClosing && Object.keys(custom.attributes).length === 0,
        'INTEGER_PRESET_CUSTOM_FLAG_SHAPE',
      );
      edits.push({ start: custom.start, end: custom.end, text: '<PresetInteger/>' });
      records.push({ library, presetId: preset.attributes.Id, values });
    }
  }
  const pieces = [];
  let cursor = 0;
  for (const edit of edits.toSorted((a, b) => a.start - b.start)) {
    assert(edit.start >= cursor);
    pieces.push(xml.slice(cursor, edit.start), edit.text);
    cursor = edit.end;
  }
  pieces.push(xml.slice(cursor));
  const output = pieces.join('');
  xmlTree(output);
  return {
    xml: output,
    proof: {
      kind: 'GENERATED_ORDINAL_INTEGER_CONSTANT_PRESETS',
      changed: edits.length > 0,
      beforeSha256: sha(xml),
      afterSha256: sha(output),
      records,
      onlyCustomIntegerKindFlagsChanged: true,
      sourceValuesAndReferenceIdentitiesUnchanged: true,
      newNative: 0,
      newCustomScript: 0,
      newRuntimeWrappers: 0,
      wholeMapAccepted: false,
    },
  };
}
