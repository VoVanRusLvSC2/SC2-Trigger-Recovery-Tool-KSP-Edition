// Late structural passes can add named folders after string serialization.
// Supply only missing labels of NEW categories from their explicit Identifier;
// preserve existing category IDs/translations, XML and executable source bytes.
import {readOwnedGuiLibraries} from "./read-owned-gui-libraries-alternate.mjs";
import {xmlTree} from "../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js";
const identity=(owner,id)=>JSON.stringify([owner,id]);
export function completeNewCategoryLocalization({xml,triggerStrings='',existingXml='',libraryId='Map'}){
 const current=readOwnedGuiLibraries(xml,libraryId),old=existingXml.trim()?readOwnedGuiLibraries(existingXml,libraryId):new Map();
 const existing=new Set([...old].flatMap(([owner,lib])=>Object.values(lib.elements).filter(e=>e.type==='Category').map(e=>identity(owner,e.id))));
 const explicitOwners=new Set(xmlTree(xml).children.filter(n=>n.tag==='Library').map(n=>n.attributes.Id));
 const keys=new Set(triggerStrings.split(/\r?\n/u).filter(line=>line.includes('=')).map(line=>line.slice(0,line.indexOf('='))));
 const added=[];
 for(const [owner,lib]of current)for(const e of Object.values(lib.elements)){
  if(e.type!=='Category'||existing.has(identity(owner,e.id)))continue;
  const value=e.identifier??e.name;
  if(typeof value!=='string'||!value.length)continue;
  if(/[\r\n\0]/u.test(value))throw Error('GUI_CATEGORY_LABEL_TRANSPORT_REQUIRED');
  const key=(explicitOwners.has(owner)?`Lib${owner}/`:'')+`Category/Name/${e.id}`;
  if(keys.has(key))continue;
  keys.add(key);added.push({library:owner,id:e.id,key,value});
 }
 const newline=triggerStrings.includes('\r\n')?'\r\n':'\n';
 const text=added.length?triggerStrings+(triggerStrings&&!triggerStrings.endsWith('\n')?newline:'')+added.map(r=>r.key+'='+r.value+newline).join(''):triggerStrings;
 return {text,proof:{kind:'NEW_CATEGORY_LOCALIZATION_FROM_EXPLICIT_IDENTIFIER',added,existingStringsPrefixPreserved:text.startsWith(triggerStrings),xmlChanged:false,runtimeChanged:false,benchmarkChanged:false}};
}
