/** Supply a parser-only implicit map scope without changing authored XML.
 * Raw SAX parsing otherwise omits map elements when <Standard> is absent.
 * Explicit Library ancestors are tracked by callers, never guessed by IDs.
 */
import { xmlTree } from '../../sdk/parameter-stem/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseTriggerXmlSync } from './sax-reader.js';
export function parseOwnedTriggerDocument(xml) {
  const tree = xmlTree(xml),
    standard = tree.children.filter((c) => c.tag === 'Standard');
  if (standard.length > 1) throw Error('Ambiguous implicit Standard scope');
  if (standard.length || !tree.children.some((c) => c.tag === 'Root'))
    return parseTriggerXmlSync(xml);
  const ids = new Set(tree.children.filter((c) => c.tag === 'Library').map((c) => c.attributes.Id));
  let id = '__GuiMapRoot';
  for (let n = 0; ids.has(id); n++) id = '__GuiMapRoot' + n;
  return parseTriggerXmlSync(
    xml.slice(0, tree.openEnd) + `<Standard Id="${id}"/>` + xml.slice(tree.openEnd),
  );
}
