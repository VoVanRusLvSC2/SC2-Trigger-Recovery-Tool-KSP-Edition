/** Supply a parser-only implicit map scope without changing authored XML.
 * Raw SAX parsing otherwise omits map elements when <Standard> is absent.
 * Explicit Library ancestors are tracked by callers, never guessed by IDs.
 */
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-parameter-stem-v372-2026-10-05/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {parseTriggerXmlSync} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/53a57c7fd134-484629154d84-663e223bd355-5043cb6fea58-310f33a8eef8-sax-reader.js';
export function parseOwnedTriggerDocument(xml){
 const tree=xmlTree(xml),standard=tree.children.filter(c=>c.tag==='Standard');
 if(standard.length>1)throw Error('Ambiguous implicit Standard scope');
 if(standard.length||!tree.children.some(c=>c.tag==='Root'))return parseTriggerXmlSync(xml);
 const ids=new Set(tree.children.filter(c=>c.tag==='Library').map(c=>c.attributes.Id));
 let id='__GuiMapRoot';for(let n=0;ids.has(id);n++)id='__GuiMapRoot'+n;
 return parseTriggerXmlSync(xml.slice(0,tree.openEnd)+`<Standard Id="${id}"/>`+xml.slice(tree.openEnd));
}
