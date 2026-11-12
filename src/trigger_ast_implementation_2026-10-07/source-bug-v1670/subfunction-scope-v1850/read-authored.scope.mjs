import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const graph=JSON.parse(await readFile(new URL('./GRAPH_SOURCES_v1850.json',import.meta.url),'utf8'));
const {parseTriggerXmlSync,readTriggerLibrariesFast}=await import(pathToFileURL(graph.correctedParser));
const {TriggerDocument}=await import(pathToFileURL(graph.sdk+'/dist/modules/triggers/services/galaxy-conversion/trigger-document.js'));
const {xmlTree}=await import(pathToFileURL(graph.sdk+'/dist/modules/triggers/shared/trigger-document/lossless-xml.js'));
export {validateAuthoredReferences} from '../../../read_authored_trigger_document_v1632.mjs';
export async function readAuthoredTriggerDocument(raw,sdk,strings=''){
 assert.equal(sdk,graph.sdk);const cst=xmlTree(raw),standards=cst.children.filter(n=>n.tag==='Standard');assert(standards.length<=1);let input=raw;if(!standards.length&&cst.children.some(n=>n.tag==='Element')){assert(!cst.children.some(n=>n.tag==='Library'&&n.attributes.Id==='Map'));input=raw.slice(0,cst.openEnd)+'<Standard Id="Map"/>'+raw.slice(cst.openEnd);}
 const parsed=parseTriggerXmlSync(input),loaded=await readTriggerLibrariesFast([parsed],new Map([...parsed.keys()].map(id=>[id,strings]))),document=new TriggerDocument(raw,new Map([...loaded].map(([id,result])=>[id,result.library])));let xmlElements=0;function count(n){if(n.tag==='Element')xmlElements++;for(const c of n.children)count(c);}count(cst);const parsedElements=[...document.libraries.values()].reduce((n,l)=>n+Object.keys(l.elements??{}).length,0);assert.equal(parsedElements,xmlElements);assert(xmlElements===0||document.libraries.size>0);return {document,scopeProof:{implicitMapRootSupplied:input!==raw,originalBytesPreserved:true,xmlElements,parsedElements}};
}
